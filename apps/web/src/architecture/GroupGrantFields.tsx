import {
  type Architecture,
  type BackendAccessPolicy,
  backendEntityFields,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { NativeSelect, Stack, Text } from "@mantine/core";
import { type DataNavigation, exact, Many, namedOptions, Pick } from "./BackendFields.tsx";

type Grant = Extract<BackendAccessPolicy["clauses"][number], { kind: "group-grant" }>;
export function GroupGrantFields({
  design,
  draft,
  policy,
  clause: c,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  policy: BackendAccessPolicy;
  clause: Grant;
  onChange: (c: Grant) => void;
  navigate: DataNavigation;
}) {
  const entities = draft.backend?.entities ?? [],
    doc = { ...design, architecture: draft };
  const find = (ref: { id: string; version: string }) =>
    entities.find((e) => contractKey(e) === contractKey(ref));
  const fields = (ref: { id: string; version: string }) => {
    const e = find(ref);
    return e
      ? backendEntityFields(doc, e).filter(
          (f) =>
            f.required &&
            !f.nullable &&
            e.fields.some((a) => a.field === f.id && a.storage.kind === "scalar"),
        )
      : [];
  };
  let parent = find(policy.resource);
  const paths = [];
  for (let i = 0; i < 3; i++) {
    const current = parent;
    paths.push(
      <Pick
        key={i}
        label={`Grant parent relation ${i + 1}`}
        value={c.resourcePath[i] ?? ""}
        options={(current?.relations ?? []).map((r) => ({
          value: r.id,
          label: `${r.id} → ${contractKey(r.target)}`,
        }))}
        onChange={(value) =>
          onChange({
            ...c,
            resourcePath: [...c.resourcePath.slice(0, i), ...(value ? [value] : [])],
          })
        }
      />,
    );
    const r = parent?.relations.find((r) => r.id === c.resourcePath[i]);
    parent = r ? find(r.target) : undefined;
    if (!c.resourcePath[i]) break;
  }
  const source = (label: string, part: "grant" | "membership" | "workspaceMembership") => {
    const v = c[part],
      e = find(v.entity),
      f = fields(v.entity),
      update = (patch: Partial<typeof v>) => onChange({ ...c, [part]: { ...v, ...patch } });
    return (
      <Stack gap="xs" key={part}>
        <Text fw={600}>{label}</Text>
        <Pick
          label={`${label} entity`}
          value={contractKey(v.entity)}
          options={namedOptions(entities)}
          onChange={(key) => {
            const e = entities.find((e) => contractKey(e) === key);
            if (e) update({ entity: exact(e) });
          }}
          onOpen={() => navigate("entities", contractKey(v.entity))}
        />
        {"principal" in v ? (
          <Pick
            label={`${label} principal field`}
            value={v.principal}
            options={f
              .filter((f) => f.type === "uuid")
              .map((f) => ({ value: f.id, label: f.name }))}
            onChange={(principal) => update({ principal })}
          />
        ) : null}
        {"active" in v ? (
          <>
            <Pick
              label={`${label} active field`}
              value={v.active.field}
              options={f
                .filter((f) => f.type === "boolean" || f.enumValues?.length)
                .map((f) => ({ value: f.id, label: f.name }))}
              onChange={(field) =>
                update({
                  active: {
                    field,
                    value:
                      f.find((f) => f.id === field)?.type === "boolean"
                        ? true
                        : (f.find((f) => f.id === field)?.enumValues?.[0] ?? "unselected"),
                  },
                })
              }
            />
            <NativeSelect
              label={`${label} active value`}
              value={String(v.active.value)}
              data={
                f.find((f) => f.id === v.active.field)?.type === "boolean"
                  ? ["true", "false"]
                  : (f.find((f) => f.id === v.active.field)?.enumValues ?? [String(v.active.value)])
              }
              onChange={(event) =>
                update({
                  active: {
                    ...v.active,
                    value:
                      f.find((f) => f.id === v.active.field)?.type === "boolean"
                        ? event.currentTarget.value === "true"
                        : event.currentTarget.value,
                  },
                })
              }
            />
          </>
        ) : null}
        {"groupRelation" in v ? (
          <Pick
            label={`${label} group relation`}
            value={v.groupRelation}
            options={(e?.relations ?? []).map((r) => ({ value: r.id, label: r.id }))}
            onChange={(groupRelation) => update({ groupRelation })}
          />
        ) : null}
        {"resourceRelation" in v ? (
          <>
            <Pick
              label="Grant resource relation"
              value={v.resourceRelation}
              options={(e?.relations ?? []).map((r) => ({ value: r.id, label: r.id }))}
              onChange={(resourceRelation) => update({ resourceRelation })}
            />
            <Pick
              label="Grant access enum field"
              value={v.access.field}
              options={f
                .filter((f) => f.enumValues?.length)
                .map((f) => ({ value: f.id, label: f.name }))}
              onChange={(field) => update({ access: { field, values: [] } })}
            />
            <Many
              label="Grant allowed access values"
              value={v.access.values}
              max={20}
              options={(f.find((f) => f.id === v.access.field)?.enumValues ?? []).map((value) => ({
                value,
                label: value,
              }))}
              onChange={(values) => update({ access: { ...v.access, values } })}
            />
          </>
        ) : null}
      </Stack>
    );
  };
  const parentFields = parent ? backendEntityFields(doc, parent) : [];
  return (
    <Stack gap="sm">
      <Text size="xs">
        Current workspace membership AND (explicit public category OR current grant joined to active
        membership in the same group). All identities and scopes come from server checks. No
        recursive traversal.
      </Text>
      {paths}
      <NativeSelect
        label="Grant subject"
        value={c.subject.kind}
        data={["session-principal", "resource-field"]}
        onChange={(e) =>
          onChange({
            ...c,
            subject:
              e.currentTarget.value === "session-principal"
                ? { kind: "session-principal" }
                : { kind: "resource-field", field: "unselected" },
          })
        }
      />
      {c.subject.kind === "resource-field" ? (
        <Pick
          label="Grant recipient UUID field"
          value={c.subject.field}
          options={fields(policy.resource)
            .filter((f) => f.type === "uuid")
            .map((f) => ({ value: f.id, label: f.name }))}
          onChange={(field) => onChange({ ...c, subject: { kind: "resource-field", field } })}
        />
      ) : null}
      {source("Workspace membership", "workspaceMembership")}
      {source("Grant", "grant")}
      {source("Group membership", "membership")}
      <Pick
        label="Public category field (optional)"
        value={c.public?.field ?? ""}
        options={parentFields
          .filter((f) => f.type === "boolean" || f.enumValues?.length)
          .map((f) => ({ value: f.id, label: f.name }))}
        onChange={(field) =>
          onChange({
            ...c,
            public: field
              ? {
                  field,
                  value:
                    parentFields.find((f) => f.id === field)?.type === "boolean"
                      ? true
                      : (parentFields.find((f) => f.id === field)?.enumValues?.[0] ?? "unselected"),
                }
              : undefined,
          })
        }
      />
      {c.public ? (
        <NativeSelect
          label="Public category value"
          value={String(c.public.value)}
          data={
            parentFields.find((f) => f.id === c.public?.field)?.type === "boolean"
              ? ["true", "false"]
              : (parentFields.find((f) => f.id === c.public?.field)?.enumValues ?? [
                  String(c.public.value),
                ])
          }
          onChange={(e) =>
            onChange({
              ...c,
              public: {
                field: c.public?.field ?? "unselected",
                value:
                  parentFields.find((f) => f.id === c.public?.field)?.type === "boolean"
                    ? e.currentTarget.value === "true"
                    : e.currentTarget.value,
              },
            })
          }
        />
      ) : null}
    </Stack>
  );
}

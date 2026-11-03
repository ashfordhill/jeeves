import {
  type Architecture,
  type BackendAccessPolicy,
  backendEntityFields,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { NativeSelect, Stack, TagsInput, Text, TextInput } from "@mantine/core";
import { type DataNavigation, exact, Many, namedOptions, Pick } from "./BackendFields.tsx";

type Clause = BackendAccessPolicy["clauses"][number];
export const clauseKinds = [
  "authenticated",
  "owner",
  "role",
  "membership",
  "visibility",
  "action",
  "service-purpose",
] as const;
export function newPolicyClause(kind: Clause["kind"], id: string, p: BackendAccessPolicy): Clause {
  const field = p.projections[0]?.fields[0] ?? "unselected";
  switch (kind) {
    case "authenticated":
      return { id, kind };
    case "owner":
      return { id, kind, field };
    case "role":
      return {
        id,
        kind,
        authority: "persisted-role-store",
        entity: p.resource,
        principal: "unselected",
        field: "unselected",
        values: [],
      };
    case "membership":
      return {
        id,
        kind,
        scope: "group",
        entity: p.resource,
        principal: "unselected",
        relation: "unselected",
        active: { field: "unselected", value: true },
      };
    case "visibility":
      return { id, kind, field, value: false };
    case "action":
      return { id, kind, actions: ["read"] };
    case "service-purpose":
      return { id, kind, purpose: p.context.service?.purpose ?? "unselected" };
  }
}
export function PolicyClauseFields({
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
  clause: Clause;
  onChange: (c: Clause) => void;
  navigate: DataNavigation;
}) {
  const entities = draft.backend?.entities ?? [];
  const resource = entities.find((e) => contractKey(e) === contractKey(policy.resource));
  const source =
    "entity" in c ? entities.find((e) => contractKey(e) === contractKey(c.entity)) : resource;
  const fields = source
    ? backendEntityFields({ ...design, architecture: draft }, source).filter((f) =>
        source.fields.some((a) => a.field === f.id && a.storage.kind === "scalar"),
      )
    : [];
  const options = (kind?: string) =>
    fields
      .filter((f) => !kind || (f.type === kind && f.required && !f.nullable))
      .map((f) => ({ value: f.id, label: f.name }));
  return (
    <Stack gap="xs">
      <Text size="xs">Clause identity: {c.id}</Text>
      <NativeSelect
        label="Clause kind"
        data={[...clauseKinds]}
        value={c.kind}
        onChange={(e) =>
          onChange(newPolicyClause(e.currentTarget.value as Clause["kind"], c.id, policy))
        }
      />
      {"entity" in c ? (
        <Pick
          label="Persisted clause entity"
          value={contractKey(c.entity)}
          options={namedOptions(entities)}
          onChange={(key) => {
            const e = entities.find((e) => contractKey(e) === key);
            if (e) onChange({ ...c, entity: exact(e) });
          }}
          onOpen={() => navigate("entities", contractKey(c.entity))}
        />
      ) : null}
      {"principal" in c ? (
        <Pick
          label="Persisted principal UUID field"
          value={c.principal}
          options={options("uuid")}
          onChange={(principal) => onChange({ ...c, principal })}
        />
      ) : null}
      {c.kind === "owner" ? (
        <Pick
          label="Owner UUID field"
          value={c.field}
          options={options("uuid")}
          onChange={(field) => onChange({ ...c, field })}
        />
      ) : null}
      {c.kind === "role" ? (
        <>
          <Pick
            label="Persisted role enum field"
            value={c.field}
            options={fields
              .filter((f) => f.enumValues?.length)
              .map((f) => ({ value: f.id, label: f.name }))}
            onChange={(field) => onChange({ ...c, field, values: [] })}
          />
          <Many
            label="Allowed persisted roles"
            value={c.values}
            max={20}
            options={(fields.find((f) => f.id === c.field)?.enumValues ?? []).map((value) => ({
              value,
              label: value,
            }))}
            onChange={(values) => onChange({ ...c, values })}
          />
        </>
      ) : null}
      {c.kind === "membership" ? (
        <>
          <NativeSelect
            label="Membership scope"
            data={["organization", "resource", "group"]}
            value={c.scope}
            onChange={(e) => onChange({ ...c, scope: e.currentTarget.value as typeof c.scope })}
          />
          <Pick
            label="Membership resource relation"
            value={c.relation}
            options={(source?.relations ?? []).map((r) => ({
              value: r.id,
              label: `${r.id} → ${contractKey(r.target)}`,
            }))}
            onChange={(relation) => onChange({ ...c, relation })}
          />
          <Pick
            label="Protected resource via relation (optional)"
            value={c.via ?? ""}
            options={(resource?.relations ?? []).map((r) => ({
              value: r.id,
              label: `${r.id} → ${contractKey(r.target)}`,
            }))}
            onChange={(via) => onChange({ ...c, via: via || undefined })}
          />
          <Pick
            label="Active membership boolean field"
            value={c.active.field}
            options={options("boolean")}
            onChange={(field) => onChange({ ...c, active: { field, value: true } })}
          />
          <Text size="xs">
            Only active persisted membership grants a clause. At most one declared forward relation;
            no recursive traversal.
          </Text>
        </>
      ) : null}
      {c.kind === "visibility" ? (
        <>
          <Pick
            label="Visibility boolean or enum field"
            value={c.field}
            options={fields
              .filter((f) => f.type === "boolean" || f.enumValues?.length)
              .map((f) => ({ value: f.id, label: f.name }))}
            onChange={(field) => {
              const f = fields.find((f) => f.id === field);
              onChange({
                ...c,
                field,
                value: f?.type === "boolean" ? false : (f?.enumValues?.[0] ?? "unselected"),
              });
            }}
          />
          <NativeSelect
            label="Visible value"
            value={String(c.value)}
            data={
              fields.find((f) => f.id === c.field)?.type === "boolean"
                ? ["false", "true"]
                : (fields.find((f) => f.id === c.field)?.enumValues ?? [String(c.value)])
            }
            onChange={(e) =>
              onChange({
                ...c,
                value:
                  fields.find((f) => f.id === c.field)?.type === "boolean"
                    ? e.currentTarget.value === "true"
                    : e.currentTarget.value,
              })
            }
          />
        </>
      ) : null}
      {c.kind === "action" ? (
        <TagsInput
          label="Clause allowed actions"
          value={c.actions}
          maxTags={20}
          onChange={(actions) => onChange({ ...c, actions })}
        />
      ) : null}
      {c.kind === "service-purpose" ? (
        <TextInput
          label="Verified service purpose clause"
          value={c.purpose}
          maxLength={63}
          onChange={(e) => onChange({ ...c, purpose: e.currentTarget.value })}
        />
      ) : null}
    </Stack>
  );
}

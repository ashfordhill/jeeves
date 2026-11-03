import {
  type Architecture,
  type BackendLifecycle,
  backendEntityFields,
  contractKey,
  type DesignDocument,
  validateBackendBehaviorTransition,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Table, Text } from "@mantine/core";
import { useState } from "react";
import {
  type DataNavigation,
  DataRows,
  dataId,
  exact,
  Many,
  namedOptions,
  Pick,
  RecordHeader,
} from "./BackendFields.tsx";
import { GuardFields } from "./BehaviorValueFields.tsx";

export function lifecycleProtected(base: DesignDocument, l: BackendLifecycle) {
  const original = base.architecture?.backend?.lifecycles?.find(
    (v) => contractKey(v) === contractKey(l),
  );
  if (!original || !base.architecture?.backend) return false;
  return (
    validateBackendBehaviorTransition(base, {
      ...base,
      architecture: {
        ...base.architecture,
        backend: {
          ...base.architecture.backend,
          lifecycles: base.architecture.backend.lifecycles?.filter((v) => v !== original),
        },
      },
    }).length > 0
  );
}
export function BackendLifecycleEditor({
  design,
  draft,
  lifecycle: l,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  lifecycle: BackendLifecycle;
  onChange: (v: BackendLifecycle) => void;
  navigate: DataNavigation;
}) {
  const [section, setSection] = useState("states");
  const locked = lifecycleProtected(design, l);
  const update = (p: Partial<BackendLifecycle>) => onChange({ ...l, ...p });
  const aggregates = draft.backend?.aggregates ?? [];
  const aggregate = aggregates.find((a) => contractKey(a) === contractKey(l.aggregate));
  const fields = (draft.backend?.entities ?? [])
    .filter(
      (e) =>
        aggregate &&
        [aggregate.root, ...aggregate.children].some((r) => contractKey(r) === contractKey(e)),
    )
    .flatMap((e) =>
      backendEntityFields({ ...design, architecture: draft }, e)
        .filter(
          (f) =>
            f.type === "text" &&
            f.required &&
            !f.nullable &&
            f.enumValues?.length &&
            !e.fields.find((p) => p.field === f.id)?.serverOwned,
        )
        .map((f) => ({
          value: `${contractKey(e)}/${f.id}`,
          label: `${e.name} · ${f.name}`,
          entity: exact(e),
          field: f.id,
          states: f.enumValues ?? [],
        })),
    );
  const context = { design, draft, navigate };
  return (
    <Stack gap="sm">
      <RecordHeader
        label="Lifecycle"
        name={l.name}
        version={l.version}
        versionDisabled={locked}
        onChange={update}
      />
      <Text size="xs">Exact lifecycle: {contractKey(l)}</Text>
      {locked ? (
        <Alert>
          Referenced lifecycle semantics are protected. Create a successor and explicitly select it
          for reviewed consumers. Display names remain editable.
        </Alert>
      ) : null}
      <NativeSelect
        label="Lifecycle section"
        data={[
          { value: "states", label: "State table & ownership" },
          { value: "guards", label: "Finite guards" },
          { value: "transitions", label: "Transitions" },
        ]}
        value={section}
        onChange={(e) => setSection(e.currentTarget.value)}
      />
      <Group>
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => navigate("aggregates", contractKey(l.aggregate))}
        >
          Open lifecycle aggregate
        </Button>
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => navigate("entities", contractKey(l.state.entity))}
        >
          Open lifecycle state entity
        </Button>
      </Group>
      <fieldset className="policy-edit-fields" disabled={locked}>
        <Stack gap="sm">
          {section === "states" ? (
            <>
              <Pick
                label="Lifecycle aggregate"
                value={contractKey(l.aggregate)}
                options={namedOptions(aggregates)}
                onChange={(key) => {
                  const a = aggregates.find((a) => contractKey(a) === key);
                  if (a) update({ aggregate: exact(a) });
                }}
              />
              <Pick
                label="Persisted state field"
                value={`${contractKey(l.state.entity)}/${l.state.field}`}
                options={fields}
                onChange={(key) => {
                  const f = fields.find((f) => f.value === key);
                  if (f)
                    update({
                      state: { entity: f.entity, field: f.field },
                      states: f.states,
                      initial: f.states[0] ?? "",
                      transitions: [],
                    });
                }}
              />
              <Pick
                label="Initial state"
                value={l.initial}
                options={l.states.map((s) => ({ value: s, label: s }))}
                onChange={(initial) => update({ initial })}
              />
              <Text size="sm">
                States come from the exact required enum field. Add explicit transitions so every
                state is reachable. Guards do not execute here.
              </Text>
              <Table aria-label="Lifecycle state table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>State</Table.Th>
                    <Table.Th>Initial</Table.Th>
                    <Table.Th>Transitions to</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {l.states.map((s) => (
                    <Table.Tr key={s}>
                      <Table.Td>{s}</Table.Td>
                      <Table.Td>{s === l.initial ? "Yes" : ""}</Table.Td>
                      <Table.Td>
                        {l.transitions
                          .filter((t) => t.from === s)
                          .map((t) => t.to)
                          .join(", ") || "None"}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          ) : null}
          {section === "guards" ? (
            <GuardFields
              guards={l.guards}
              onChange={(guards) => update({ guards })}
              context={context}
            />
          ) : null}
          {section === "transitions" ? (
            <DataRows<BackendLifecycle["transitions"][number]>
              label="Transition"
              rows={l.transitions}
              max={30}
              create={() => ({
                id: dataId("transition"),
                from: l.initial,
                to: l.states.find((s) => s !== l.initial) ?? l.initial,
                guards: [],
              })}
              onChange={(transitions) => update({ transitions })}
            >
              {(t, i, change) => (
                <>
                  <Text size="xs">Transition identity: {t.id}</Text>
                  <Pick
                    label={`Transition ${i + 1} from`}
                    value={t.from}
                    options={l.states.map((s) => ({ value: s, label: s }))}
                    onChange={(from) => change({ ...t, from })}
                  />
                  <Pick
                    label={`Transition ${i + 1} to`}
                    value={t.to}
                    options={l.states.map((s) => ({ value: s, label: s }))}
                    onChange={(to) => change({ ...t, to })}
                  />
                  <Many
                    label={`Transition ${i + 1} guards`}
                    value={t.guards}
                    options={l.guards.map((g) => ({ value: g.id, label: `${g.id} · ${g.kind}` }))}
                    max={20}
                    onChange={(guards) => change({ ...t, guards })}
                  />
                </>
              )}
            </DataRows>
          ) : null}
        </Stack>
      </fieldset>
    </Stack>
  );
}

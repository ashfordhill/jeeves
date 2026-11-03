import {
  type Architecture,
  type ArchitectureComponent,
  architectureSchema,
  type BackendLifecycle,
  type BackendOperation,
  backendEntityFields,
  contractKey,
  type DesignDocument,
  isStructural,
  validateBackendBehavior,
} from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { type DataNavigation, dataId, exact, namedOptions, Pick } from "./BackendFields.tsx";
import { BackendLifecycleEditor, lifecycleProtected } from "./BackendLifecycleEditor.tsx";
import {
  BackendOperationEditor,
  commandKeyPolicy,
  providedOperations,
} from "./BackendOperationEditor.tsx";
import { PayloadFields } from "./ContractFields.tsx";
import { ContractTypeScope } from "./ContractTypeScope.tsx";

/** Behavior is part of the same architecture draft and Save as General/Data/Access. */
export function ComponentBehaviorEditor({
  design,
  draft,
  component,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  component: ArchitectureComponent;
  onChange: (v: Architecture) => void;
  navigate: DataNavigation;
}) {
  const [section, setSection] = useState("operations");
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [commandRequest, setCommandRequest] = useState<{ section: string }>();
  const selected = selection[section] ?? "";
  const select = (key: string) => setSelection((s) => ({ ...s, [section]: key }));
  const onNavigate = (kind: "operations" | "lifecycles", key: string) => {
    setSection(kind);
    setSelection((s) => ({ ...s, [kind]: key }));
  };
  const backend = draft.backend ?? { schemaVersion: 1 as const, entities: [], aggregates: [] };
  const update = (patch: Partial<typeof backend>) =>
    onChange({ ...draft, backend: { ...backend, ...patch } });
  const owner = { kind: "component" as const, id: component.id };
  const operations = (backend.operations ?? []).filter(
    (o) => o.target.owner.kind === owner.kind && o.target.owner.id === owner.id,
  );
  const lifecycles = backend.lifecycles ?? [];
  const operation = operations.find((o) => contractKey(o) === selected);
  const lifecycle = lifecycles.find((l) => contractKey(l) === selected);
  const aggregate = backend.aggregates.find(
    (a) => a.owner.kind === owner.kind && a.owner.id === owner.id,
  );
  const targets = providedOperations(draft, owner);
  const inspection = operations.find((o) => contractKey(o) === selection.inspection);
  const contract = draft.contracts?.find(
    (c) => inspection && contractKey(c) === contractKey(inspection.target.contract),
  );
  const wire = contract?.shape?.operations.find((o) => o.id === inspection?.target.operation);
  const parsed = architectureSchema.safeParse(draft);
  const gaps = parsed.success
    ? validateBackendBehavior({ ...design, architecture: parsed.data }).filter(
        (f) =>
          !isStructural(f) &&
          (f.target.path?.[2] === "lifecycles" ||
            operations.some((o) => contractKey(o) === f.target.path?.[3])),
      )
    : [];
  return (
    <Stack gap="md" className="component-behavior-editor">
      <Text size="sm">
        Commands describe local transaction intent. Lifecycles own finite states and transitions.
        These declarations do not run commands or verify behavior. All sections share Save
        component.
      </Text>
      <NativeSelect
        label="Behavior section"
        value={section}
        data={[
          { value: "operations", label: "Commands & read-only operations" },
          { value: "lifecycles", label: "Lifecycles & state tables" },
          { value: "inspection", label: "Inspect exact operation contract" },
        ]}
        onChange={(e) => setSection(e.currentTarget.value)}
      />
      {section === "operations" ? (
        <>
          <Pick
            label="Command definition"
            value={selected}
            options={namedOptions(operations)}
            onChange={select}
          />
          <Button
            variant="default"
            disabled={(backend.operations?.length ?? 0) >= 200 || !targets.length || !aggregate}
            onClick={() => {
              if (!aggregate || !targets[0]) return;
              const target =
                targets.find(
                  (t) =>
                    !operations.some(
                      (o) => `${contractKey(o.target.contract)}/${o.target.operation}` === t.value,
                    ),
                ) ?? targets[0];
              const wire = draft.contracts
                ?.find((c) => contractKey(c) === contractKey(target.target.contract))
                ?.shape?.operations.find((o) => o.id === target.target.operation);
              const key = wire?.input.find(
                (f) =>
                  f.type === "text" &&
                  f.required &&
                  f.minLength &&
                  f.maxLength &&
                  f.maxLength <= 200,
              );
              const expected = wire?.input.find((f) => f.type === "integer" && f.required);
              const id = dataId("command");
              const next: BackendOperation = {
                id,
                version: "v1",
                name: wire?.name ?? "New command",
                target: target.target,
                kind: "command",
                aggregate: exact(aggregate),
                identity: [],
                access: { policy: { kind: "unresolved" }, action: target.target.operation },
                guards: [],
                actions: [],
                writes: [],
                expectedVersion:
                  aggregate.concurrency.kind === "optimistic"
                    ? { kind: "input", path: [expected?.id ?? "unselected"] }
                    : { kind: "none" },
                transaction: {
                  kind: "local",
                  store: aggregate.store,
                  participants: [aggregate.root, ...aggregate.children].map(exact),
                  connection: "single",
                  externalIO: "forbidden",
                  access: "current-state-in-transaction",
                  concurrency: "aggregate-policy",
                  failure: "rollback",
                  commit: "disconnect-is-unknown",
                },
                idempotency: commandKeyPolicy(
                  [key?.id ?? "unselected"],
                  (wire?.input ?? []).filter((f) => f.id !== key?.id).map((f) => [f.id]),
                ),
                cancellation: {
                  kind: "cooperative",
                  startsWork: false,
                  deadlineSeconds: 30,
                  beforeCommit: "rollback",
                  afterCommit: "committed-or-unknown",
                },
                outcomes: [
                  {
                    outcome: wire?.outcomes?.find((o) => o.kind === "Success")?.id ?? "unselected",
                    trigger: "success",
                    values: [],
                  },
                ],
              };
              update({ operations: [...(backend.operations ?? []), next] });
              select(contractKey(next));
            }}
          >
            Add command
          </Button>
          {!targets.length || !aggregate ? (
            <Text size="sm">
              Declare an exact provided operation in Interfaces and an owned aggregate in Data
              before adding a command.
            </Text>
          ) : null}
          {operation ? (
            <>
              <BackendOperationEditor
                key={operation.id}
                design={design}
                draft={draft}
                operation={operation}
                navigate={navigate}
                onNavigate={onNavigate}
                sectionRequest={commandRequest}
                onInspect={() => {
                  setSection("inspection");
                  setSelection((s) => ({ ...s, inspection: contractKey(operation) }));
                }}
                onChange={(next) => {
                  update({
                    operations: backend.operations?.map((o) => (o === operation ? next : o)),
                  });
                  select(contractKey(next));
                }}
              />
              <Button
                variant="subtle"
                color="red"
                onClick={() => {
                  update({ operations: backend.operations?.filter((o) => o !== operation) });
                  select("");
                }}
              >
                Remove command
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      {section === "lifecycles" ? (
        <>
          <Pick
            label="Lifecycle definition"
            value={selected}
            options={namedOptions(lifecycles)}
            onChange={select}
          />
          <Button
            variant="default"
            disabled={lifecycles.length >= 100 || !aggregate}
            onClick={() => {
              if (!aggregate) return;
              const field = backend.entities
                .filter((e) =>
                  [aggregate.root, ...aggregate.children].some(
                    (r) => contractKey(r) === contractKey(e),
                  ),
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
                    .map((f) => ({ entity: exact(e), field: f.id, states: f.enumValues ?? [] })),
                )[0];
              const next: BackendLifecycle = {
                id: dataId("lifecycle"),
                version: "v1",
                name: "New lifecycle",
                aggregate: exact(aggregate),
                state: {
                  entity: field?.entity ?? aggregate.root,
                  field: field?.field ?? "unselected",
                },
                states: field?.states ?? ["unselected"],
                initial: field?.states[0] ?? "unselected",
                guards: [],
                transitions: [],
              };
              update({ lifecycles: [...lifecycles, next] });
              select(contractKey(next));
            }}
          >
            Add lifecycle
          </Button>
          {lifecycle ? (
            <>
              <BackendLifecycleEditor
                key={lifecycle.id}
                design={design}
                draft={draft}
                lifecycle={lifecycle}
                navigate={navigate}
                onChange={(next) => {
                  update({ lifecycles: lifecycles.map((l) => (l === lifecycle ? next : l)) });
                  select(contractKey(next));
                }}
              />
              <Group>
                <Button
                  variant="default"
                  disabled={lifecycles.length >= 100}
                  onClick={() => {
                    let n = 2;
                    while (lifecycles.some((l) => l.id === lifecycle.id && l.version === `v${n}`))
                      n++;
                    const next = { ...structuredClone(lifecycle), version: `v${n}` };
                    update({ lifecycles: [...lifecycles, next] });
                    select(contractKey(next));
                  }}
                >
                  Create lifecycle successor
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  disabled={lifecycleProtected(design, lifecycle)}
                  onClick={() => {
                    update({ lifecycles: lifecycles.filter((l) => l !== lifecycle) });
                    select("");
                  }}
                >
                  Remove lifecycle
                </Button>
              </Group>
              <Text size="sm">
                Exact consumers keep their old version until deliberately retargeted.
              </Text>
              <section aria-label="Lifecycle consumers">
                {(backend.operations ?? [])
                  .filter((o) =>
                    o.actions.some(
                      (a) =>
                        a.kind === "transition" &&
                        contractKey(a.lifecycle) === contractKey(lifecycle),
                    ),
                  )
                  .map((o) => (
                    <Text size="sm" key={contractKey(o)}>
                      {o.name} · {contractKey(o)}
                      {operations.includes(o) ? (
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          onClick={() => onNavigate("operations", contractKey(o))}
                        >
                          Open lifecycle command {o.name}
                        </Button>
                      ) : null}
                    </Text>
                  ))}
              </section>
            </>
          ) : null}
        </>
      ) : null}
      {section === "inspection" ? (
        <>
          <Pick
            label="Inspected command"
            value={selection.inspection ?? ""}
            options={namedOptions(operations)}
            onChange={(key) => setSelection((s) => ({ ...s, inspection: key }))}
          />
          {wire && contract?.shape ? (
            <>
              <Text size="sm">
                {contractKey(contract)} / {wire.id} · {inspection?.target.owner.kind}{" "}
                {inspection?.target.owner.id}. Referenced contract shapes and outcome identities are
                protected; use Interfaces for explicit successors.
              </Text>
              <ContractTypeScope
                shape={contract.shape}
                original={contract.shape}
                disabled
                onChange={() => {}}
              >
                <PayloadFields
                  label="Command wire input"
                  fields={wire.input}
                  disabled
                  onChange={() => {}}
                />
                <PayloadFields
                  label="Command wire output"
                  fields={wire.output}
                  disabled
                  onChange={() => {}}
                />
                {(wire.outcomes ?? []).map((o) => (
                  <details key={o.id}>
                    <summary>
                      {o.name} · {o.id}
                    </summary>
                    <Text size="sm">
                      {o.kind} · {o.state} · {o.retry} · HTTP {o.status ?? "unspecified"}.{" "}
                      {o.condition}
                    </Text>
                    <PayloadFields
                      label={`${o.name} payload`}
                      fields={o.payload ?? []}
                      disabled
                      onChange={() => {}}
                    />
                  </details>
                ))}
              </ContractTypeScope>
              <Button
                variant="subtle"
                onClick={() => {
                  if (inspection) onNavigate("operations", contractKey(inspection));
                }}
              >
                Return to command
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      {gaps.length ? (
        <Alert
          title="Unresolved behavior decisions"
          color="yellow"
          styles={{ label: { color: "var(--ink)" } }}
        >
          <Stack gap="xs">
            {gaps.map((g, i) => (
              <div key={`${g.target.path?.join("/")}-${g.message}`}>
                <Text size="sm">
                  {g.target.path?.join(" / ")}: {g.message}
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => {
                    onNavigate(
                      g.target.path?.[2] === "lifecycles" ? "lifecycles" : "operations",
                      String(g.target.path?.[3] ?? ""),
                    );
                    const field = String(g.target.path?.[4] ?? "");
                    setCommandRequest({
                      section:
                        field === "identity"
                          ? "transaction"
                          : field === "access"
                            ? "access"
                            : field === "actions"
                              ? "actions"
                              : "outcomes",
                    });
                  }}
                >
                  Open behavior decision {i + 1}
                </Button>
              </div>
            ))}
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
}

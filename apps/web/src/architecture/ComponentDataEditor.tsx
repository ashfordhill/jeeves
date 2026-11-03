import {
  type Architecture,
  type ArchitectureComponent,
  type BackendAccessBinding,
  type BackendAccessPolicy,
  type BackendAggregate,
  type BackendQuery,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { BackendAccessUseEditor } from "./BackendAccessUseEditor.tsx";
import { BackendAggregateEditor } from "./BackendAggregateEditor.tsx";
import { BackendDatasetEditor } from "./BackendDatasetEditor.tsx";
import { BackendEntityEditor, entityForDataset } from "./BackendEntityEditor.tsx";
import {
  type DataNavigation,
  dataId,
  exact,
  namedOptions,
  Pick,
  RecordHeader,
} from "./BackendFields.tsx";
import { BackendPolicyEditor, policyProtected } from "./BackendPolicyEditor.tsx";
import { BackendQueryEditor } from "./BackendQueryEditor.tsx";
import { DataContractEditor } from "./DataContractEditor.tsx";

/** Subeditors operate on the component dialog's architecture draft, never an independent save. */
export function ComponentDataEditor({
  design,
  draft,
  component,
  onChange,
  mode,
  onArea,
  navigation,
}: {
  mode: "data" | "access";
  onArea: (area: "data" | "access") => void;
  navigation?: { kind: Parameters<DataNavigation>[0]; key: string };
  design: DesignDocument;
  draft: Architecture;
  component: ArchitectureComponent;
  onChange: (draft: Architecture) => void;
}) {
  const [dataSection, setDataSection] = useState<Parameters<DataNavigation>[0]>("entities");
  const [accessSection, setAccessSection] = useState<Parameters<DataNavigation>[0]>("policies");
  const section = mode === "access" ? accessSection : dataSection;
  const setSection = (kind: Parameters<DataNavigation>[0]) => {
    const access = kind === "policies" || kind === "accessBindings";
    if (access) setAccessSection(kind);
    else setDataSection(kind);
    onArea(access ? "access" : "data");
  };
  const [selection, setSelection] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!navigation) return;
    if (navigation.kind === "policies" || navigation.kind === "accessBindings")
      setAccessSection(navigation.kind);
    else setDataSection(navigation.kind);
    setSelection((s) => ({ ...s, [navigation.kind]: navigation.key }));
  }, [navigation]);
  const selected = selection[section] ?? "";
  const select = (key: string) => setSelection((s) => ({ ...s, [section]: key }));
  const navigate: DataNavigation = (kind, key) => {
    setSection(kind);
    setSelection((s) => ({ ...s, [kind]: key }));
  };
  const backend = draft.backend ?? { schemaVersion: 1 as const, entities: [], aggregates: [] };
  const updateBackend = (patch: Partial<typeof backend>) =>
    onChange({ ...draft, backend: { ...backend, ...patch } });
  const dataset = draft.datasets?.find((d) => d.id === selected);
  const entity = backend.entities.find((e) => contractKey(e) === selected);
  const aggregate = backend.aggregates.find((a) => contractKey(a) === selected);
  const query = backend.queries?.find((q) => contractKey(q) === selected);
  const records =
    section === "entities"
      ? backend.entities
      : section === "aggregates"
        ? backend.aggregates
        : (backend.queries ?? []);
  const record = section === "entities" ? entity : section === "aggregates" ? aggregate : query;
  const policy = backend.accessPolicies?.find((p) => contractKey(p) === selected);
  const binding = backend.accessBindings?.find((b) => contractKey(b) === selected);
  const name = section === "entities" ? "Entity" : section === "aggregates" ? "Aggregate" : "Query";
  const updateRecord = (patch: { name?: string; version?: string }) => {
    if (!record || !["entities", "aggregates", "queries"].includes(section)) return;
    updateBackend({ [section]: records.map((r) => (r === record ? { ...r, ...patch } : r)) });
    select(contractKey({ ...record, ...patch }));
  };
  return (
    <Stack gap="md" className="component-data-editor">
      <Text size="sm">
        {mode === "access"
          ? "Reuse exact policies across queries and sensitive byte/output paths. These declarations describe access intent; no runtime authorization executes."
          : "Data contracts supply types; datasets supply authority and stores. Entities add persistence intent."}{" "}
        All sections save together with this component.
      </Text>
      <NativeSelect
        label={mode === "access" ? "Access section" : "Data section"}
        value={section}
        data={
          mode === "access"
            ? [
                { value: "policies", label: "Access policies" },
                { value: "accessBindings", label: "Sensitive access uses" },
              ]
            : [
                { value: "contracts", label: "Data contracts & local types" },
                { value: "datasets", label: "Datasets & authority" },
                { value: "entities", label: "Entities & relations" },
                { value: "aggregates", label: "Aggregates & concurrency" },
                { value: "queries", label: "Bounded queries" },
              ]
        }
        onChange={(e) => setSection(e.currentTarget.value as typeof section)}
      />
      {section === "contracts" ? (
        <DataContractEditor
          base={design}
          draft={draft}
          selected={selected}
          onSelect={select}
          onChange={onChange}
        />
      ) : null}
      {section === "datasets" ? (
        <>
          <Pick
            label="Dataset definition"
            value={selected}
            options={(draft.datasets ?? []).map((d) => ({ value: d.id, label: d.name }))}
            onChange={select}
          />
          <Button
            variant="default"
            disabled={(draft.datasets?.length ?? 0) >= 100}
            onClick={() => {
              const id = dataId("dataset");
              const contract = draft.contracts?.find((c) => c.kind === "data" && !c.source);
              onChange({
                ...draft,
                datasets: [
                  ...(draft.datasets ?? []),
                  {
                    id,
                    name: "New dataset",
                    contract: contract ? exact(contract) : { id: "unselected", version: "v1" },
                    owners: [{ kind: "component", id: component.id }],
                    ownershipDecision: "",
                    readers: [],
                    writers: [],
                    tenant: "Unknown",
                    deletion: "Unknown",
                    exportAccess: "Unknown",
                  },
                ],
              });
              select(id);
            }}
          >
            Add dataset
          </Button>
          {dataset ? (
            <>
              <BackendDatasetEditor
                design={design}
                draft={draft}
                dataset={dataset}
                onChange={(value) =>
                  onChange({
                    ...draft,
                    datasets: draft.datasets?.map((d) => (d === dataset ? value : d)),
                  })
                }
                navigate={navigate}
              />
              <Button
                variant="subtle"
                color="red"
                onClick={() => {
                  onChange({ ...draft, datasets: draft.datasets?.filter((d) => d !== dataset) });
                  select("");
                }}
              >
                Remove dataset
              </Button>
            </>
          ) : null}
        </>
      ) : null}
      {["entities", "aggregates", "queries"].includes(section) ? (
        <>
          <Pick
            label={`${name} definition`}
            value={selected}
            options={namedOptions(records)}
            onChange={select}
          />
          <Button
            variant="default"
            disabled={records.length >= (section === "aggregates" ? 50 : 100)}
            onClick={() => {
              const root = backend.entities[0];
              if (section === "entities") {
                const available = draft.datasets?.find(
                  (d) => !backend.entities.some((e) => e.dataset === d.id),
                );
                const e = entityForDataset(draft, available?.id ?? "");
                updateBackend({ entities: [...backend.entities, e] });
                select(contractKey(e));
              } else if (section === "aggregates") {
                const ref = root ? exact(root) : { id: "unselected", version: "v1" };
                const dataset = draft.datasets?.find((d) => d.id === root?.dataset);
                const a: BackendAggregate = {
                  id: dataId("aggregate"),
                  version: "v1",
                  name: "New aggregate",
                  root: ref,
                  children: [],
                  owner: { kind: "component", id: component.id },
                  store: dataset?.store ?? "unselected",
                  concurrency: {
                    kind: "row-lock",
                    entities: [ref],
                    order: "entity-id-primary-key",
                  },
                  invariants: [],
                };
                updateBackend({ aggregates: [...backend.aggregates, a] });
                select(contractKey(a));
              } else {
                const order = (root?.primaryKey ?? []).map((field) => ({
                  field: { source: "root", field },
                  direction: "asc" as const,
                }));
                const q: BackendQuery = {
                  id: dataId("query"),
                  version: "v1",
                  name: "New query",
                  root: root ? exact(root) : { id: "unselected", version: "v1" },
                  joins: [],
                  filters: [],
                  projection: (root?.fields ?? []).map((f) => ({
                    id: dataId("output"),
                    field: { source: "root", field: f.field },
                  })),
                  order,
                  cursor: { kind: "keyset", fields: order.map((o) => o.field) },
                  limit: { default: 25, maximum: 100 },
                  accessPolicy: { kind: "unresolved" },
                  freshness: { kind: "authoritative" },
                };
                updateBackend({ queries: [...(backend.queries ?? []), q] });
                select(contractKey(q));
              }
            }}
          >
            Add {name.toLowerCase()}
          </Button>
          {record ? (
            <RecordHeader
              label={name}
              name={record.name}
              version={record.version}
              onChange={updateRecord}
            />
          ) : null}
          {section === "entities" && entity ? (
            <BackendEntityEditor
              design={design}
              draft={draft}
              entity={entity}
              navigate={navigate}
              onChange={(value) =>
                updateBackend({ entities: backend.entities.map((e) => (e === entity ? value : e)) })
              }
            />
          ) : null}
          {section === "aggregates" && aggregate ? (
            <BackendAggregateEditor
              design={design}
              draft={draft}
              aggregate={aggregate}
              navigate={navigate}
              onChange={(value) =>
                updateBackend({
                  aggregates: backend.aggregates.map((a) => (a === aggregate ? value : a)),
                })
              }
            />
          ) : null}
          {section === "queries" && query ? (
            <BackendQueryEditor
              design={design}
              draft={draft}
              query={query}
              navigate={navigate}
              onChange={(value) =>
                updateBackend({ queries: backend.queries?.map((q) => (q === query ? value : q)) })
              }
            />
          ) : null}
          {record ? (
            <Group>
              <Button
                variant="default"
                disabled={records.length >= (section === "aggregates" ? 50 : 100)}
                onClick={() => {
                  let n = 2;
                  while (records.some((r) => r.id === record.id && r.version === `v${n}`)) n++;
                  const next = { ...structuredClone(record), version: `v${n}` };
                  updateBackend({ [section]: [...records, next] });
                  select(contractKey(next));
                }}
              >
                Create {name.toLowerCase()} successor
              </Button>
              <Button
                variant="subtle"
                color="red"
                onClick={() => {
                  updateBackend({ [section]: records.filter((r) => r !== record) });
                  select("");
                }}
              >
                Remove {name.toLowerCase()}
              </Button>
            </Group>
          ) : null}
        </>
      ) : null}
      {section === "policies" ? (
        <>
          <Pick
            label="Access policy reference"
            value={selected}
            options={namedOptions(backend.accessPolicies ?? [])}
            onChange={select}
          />
          <Button
            variant="default"
            disabled={(backend.accessPolicies?.length ?? 0) >= 100}
            onClick={() => {
              const root =
                backend.entities.find((e) =>
                  draft.datasets
                    ?.find((d) => d.id === e.dataset)
                    ?.owners.some((o) => o.kind === "component" && o.id === component.id),
                ) ?? backend.entities[0];
              const p: BackendAccessPolicy = {
                id: dataId("policy"),
                version: "v1",
                name: "New access policy",
                resource: root ? exact(root) : { id: "unselected", version: "v1" },
                context: {
                  identity: "session-principal",
                  authentication: "server-established",
                  scope: root?.scope.kind === "field" ? "authorized-scope" : "global",
                  correlation: "server-established",
                },
                default: "deny",
                conflict: "deny-wins",
                clauses: [],
                rules: [],
                projections: [],
                revocation: { strategy: "current-state", cache: "none", recheck: [] },
              };
              updateBackend({ accessPolicies: [...(backend.accessPolicies ?? []), p] });
              select(contractKey(p));
            }}
          >
            Add access policy
          </Button>
          {policy ? (
            <>
              <BackendPolicyEditor
                design={design}
                draft={draft}
                policy={policy}
                navigate={navigate}
                onChange={(p) => {
                  updateBackend({
                    accessPolicies: backend.accessPolicies?.map((v) => (v === policy ? p : v)),
                  });
                  select(contractKey(p));
                }}
              />
              <Group>
                <Button
                  variant="default"
                  disabled={(backend.accessPolicies?.length ?? 0) >= 100}
                  onClick={() => {
                    let n = 2;
                    while (
                      backend.accessPolicies?.some(
                        (v) => v.id === policy.id && v.version === `v${n}`,
                      )
                    )
                      n++;
                    const next = { ...structuredClone(policy), version: `v${n}` };
                    updateBackend({ accessPolicies: [...(backend.accessPolicies ?? []), next] });
                    select(contractKey(next));
                  }}
                >
                  Create policy successor
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  disabled={policyProtected(design, policy)}
                  onClick={() => {
                    updateBackend({
                      accessPolicies: backend.accessPolicies?.filter((v) => v !== policy),
                    });
                    select("");
                  }}
                >
                  Remove access policy
                </Button>
              </Group>
            </>
          ) : null}
        </>
      ) : null}
      {section === "accessBindings" ? (
        <>
          <Pick
            label="Access use definition"
            value={selected}
            options={namedOptions(backend.accessBindings ?? [])}
            onChange={select}
          />
          <Button
            variant="default"
            disabled={(backend.accessBindings?.length ?? 0) >= 200}
            onClick={() => {
              const root = backend.entities[0];
              const p = backend.accessPolicies?.find(
                (p) => root && contractKey(p.resource) === contractKey(root),
              );
              const b: BackendAccessBinding = {
                id: dataId("access-use"),
                version: "v1",
                name: "New sensitive access use",
                resource: root ? exact(root) : { id: "unselected", version: "v1" },
                target: {
                  kind: "projection",
                  entity: root ? exact(root) : { id: "unselected", version: "v1" },
                  fields: [],
                },
                policy: p ? { kind: "policy", reference: exact(p) } : { kind: "unresolved" },
                action: "bytes",
                site: "bytes",
              };
              updateBackend({ accessBindings: [...(backend.accessBindings ?? []), b] });
              select(contractKey(b));
            }}
          >
            Add access use
          </Button>
          {binding ? (
            <>
              <BackendAccessUseEditor
                design={design}
                draft={draft}
                binding={binding}
                navigate={navigate}
                onChange={(b) => {
                  updateBackend({
                    accessBindings: backend.accessBindings?.map((v) => (v === binding ? b : v)),
                  });
                  select(contractKey(b));
                }}
              />
              <Button
                variant="subtle"
                color="red"
                onClick={() => {
                  updateBackend({
                    accessBindings: backend.accessBindings?.filter((v) => v !== binding),
                  });
                  select("");
                }}
              >
                Remove access use
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}

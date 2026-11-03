import {
  type Architecture,
  type ArchitectureComponent,
  type BackendAggregate,
  type BackendQuery,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { useState } from "react";
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
import { BackendQueryEditor } from "./BackendQueryEditor.tsx";
import { DataContractEditor } from "./DataContractEditor.tsx";

/** Subeditors operate on the component dialog's architecture draft, never an independent save. */
export function ComponentDataEditor({
  design,
  draft,
  component,
  onChange,
}: {
  design: DesignDocument;
  draft: Architecture;
  component: ArchitectureComponent;
  onChange: (draft: Architecture) => void;
}) {
  const [section, setSection] = useState<Parameters<DataNavigation>[0]>("entities");
  const [selection, setSelection] = useState<Record<string, string>>({});
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
  const name = section === "entities" ? "Entity" : section === "aggregates" ? "Aggregate" : "Query";
  const updateRecord = (patch: { name?: string; version?: string }) => {
    if (!record || !["entities", "aggregates", "queries"].includes(section)) return;
    updateBackend({ [section]: records.map((r) => (r === record ? { ...r, ...patch } : r)) });
    select(contractKey({ ...record, ...patch }));
  };
  return (
    <Stack gap="md" className="component-data-editor">
      <Text size="sm">
        Data contracts supply types; datasets supply authority and stores. Entities add persistence
        intent. All sections save together with this component.
      </Text>
      <NativeSelect
        label="Data section"
        value={section}
        data={[
          { value: "contracts", label: "Data contracts & local types" },
          { value: "datasets", label: "Datasets & authority" },
          { value: "entities", label: "Entities & relations" },
          { value: "aggregates", label: "Aggregates & concurrency" },
          { value: "queries", label: "Bounded queries" },
          { value: "policies", label: "Access policy references" },
        ]}
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
          {policy ? (
            <section className="policy-group" aria-label="Exact policy reference">
              <h3>
                {policy.name} · {policy.version}
              </h3>
              <Text size="sm">
                Trusted {policy.context.identity} · default deny · deny wins. Recheck:{" "}
                {policy.revocation.recheck.join(", ") || "undecided"}. Design intent, not runtime
                evidence.
              </Text>
              <Button
                variant="subtle"
                onClick={() => navigate("entities", contractKey(policy.resource))}
              >
                Open policy resource entity
              </Button>
            </section>
          ) : (
            <Text size="sm">
              Policies are reused by exact version. The finite Access editor is the next package,
              P67b.
            </Text>
          )}
        </>
      ) : null}
    </Stack>
  );
}

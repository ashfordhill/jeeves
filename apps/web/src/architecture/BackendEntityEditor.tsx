import {
  type Architecture,
  type BackendEntity,
  backendEntityFields,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { Checkbox, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import {
  type DataNavigation,
  DataRows,
  dataId,
  exact,
  Many,
  namedOptions,
  Pick,
} from "./BackendFields.tsx";
export function entityForDataset(draft: Architecture, datasetId: string): BackendEntity {
  const dataset = draft.datasets?.find((d) => d.id === datasetId);
  const contract = draft.contracts?.find(
    (c) => dataset && contractKey(c) === contractKey(dataset.contract),
  );
  const fields = contract?.shape?.payload ?? [];
  const primary = fields.find((f) => f.type === "uuid" && f.required && !f.nullable) ?? fields[0];
  return {
    id: dataId("entity"),
    version: "v1",
    name: dataset?.name ?? "New entity",
    dataset: datasetId || "unselected",
    contract: dataset?.contract ?? { id: "unselected", version: "v1" },
    storageId: dataId("table"),
    fields: fields.map((f) => ({
      field: f.id,
      storageId: dataId("column"),
      required: f.required,
      nullable: !!f.nullable,
      storage: ["object", "array", "map", "tagged-union"].includes(f.type)
        ? { kind: "json", query: "opaque" }
        : { kind: "scalar" },
      ...(f === primary && f.type === "uuid" ? { serverOwned: "id" as const } : {}),
    })),
    primaryKey: primary ? [primary.id] : [],
    scope: { kind: "global" },
    relations: [],
    uniqueKeys: [],
    indexes: [],
  };
}
export function BackendEntityEditor({
  design,
  draft,
  entity,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  entity: BackendEntity;
  onChange: (entity: BackendEntity) => void;
  navigate: DataNavigation;
}) {
  const update = (patch: Partial<BackendEntity>) => onChange({ ...entity, ...patch });
  const document = { ...design, architecture: draft };
  const fields = backendEntityFields(document, entity);
  const options = fields.map((f) => ({ value: f.id, label: `${f.name} · ${f.type}` }));
  const saved = design.architecture?.backend?.entities.find((e) => e.id === entity.id);
  const fieldOptions = (target: BackendEntity | undefined) =>
    target
      ? backendEntityFields(document, target).map((f) => ({ value: f.id, label: f.name }))
      : [];
  return (
    <Stack gap="sm">
      <Pick
        label="Entity dataset"
        value={entity.dataset}
        options={(draft.datasets ?? []).map((d) => ({ value: d.id, label: d.name }))}
        disabled={!!saved}
        onChange={(id) => {
          const seed = entityForDataset(draft, id);
          update({
            dataset: seed.dataset,
            contract: seed.contract,
            fields: seed.fields,
            primaryKey: seed.primaryKey,
          });
        }}
        onOpen={() => navigate("datasets", entity.dataset)}
      />
      <Text size="sm">
        Contract {contractKey(entity.contract)} supplies field types and required/nullability.
        Storage identities persist through renames.
      </Text>
      <Pick
        label="Entity data contract"
        value={contractKey(entity.contract)}
        options={(draft.contracts ?? [])
          .filter((c) => c.kind === "data")
          .map((c) => ({ value: contractKey(c), label: `${c.name} · ${c.version}` }))}
        onChange={(key) => {
          const c = draft.contracts?.find((c) => contractKey(c) === key);
          if (c?.shape)
            update({
              contract: exact(c),
              fields: c.shape.payload.map((f) => ({
                ...(entity.fields.find((v) => v.field === f.id) ?? {
                  field: f.id,
                  storageId: dataId("column"),
                  storage: { kind: "scalar" as const },
                }),
                required: f.required,
                nullable: !!f.nullable,
              })),
            });
        }}
        onOpen={() => navigate("contracts", contractKey(entity.contract))}
      />
      <TextInput
        label="Entity storage identity"
        value={entity.storageId}
        disabled={!!saved}
        onChange={(e) => update({ storageId: e.currentTarget.value })}
      />
      <Many
        label="Primary key fields (in order)"
        value={entity.primaryKey}
        options={options}
        max={10}
        onChange={(primaryKey) => update({ primaryKey })}
      />
      <Pick
        label="Entity scope field"
        value={entity.scope.kind === "field" ? entity.scope.field : ""}
        options={options}
        onChange={(field) =>
          update({ scope: field ? { kind: "field", field } : { kind: "global" } })
        }
      />
      <Text size="sm">
        No scope field means global scope. Tenant-scoped datasets require an explicit persisted
        scope field.
      </Text>
      <section aria-label="Field storage annotations">
        <h3>Field storage annotations</h3>
        {entity.fields.map((f, i) => {
          const value = fields.find((v) => v.id === f.field);
          const change = (patch: Partial<typeof f>) =>
            update({ fields: entity.fields.map((v, n) => (n === i ? { ...f, ...patch } : v)) });
          return (
            <details className="contract-field" key={f.field}>
              <summary>
                {value?.name ?? f.field} · {f.storage.kind}
                {f.serverOwned ? ` · server ${f.serverOwned}` : ""}
              </summary>
              <Stack gap="xs" mt="xs">
                <TextInput
                  label={`Field ${i + 1} storage identity`}
                  value={f.storageId}
                  disabled={!!saved?.fields.some((v) => v.field === f.field)}
                  onChange={(e) => change({ storageId: e.currentTarget.value })}
                />
                <Checkbox
                  label={`Field ${i + 1} required (from contract)`}
                  checked={f.required}
                  disabled
                />
                <Checkbox
                  label={`Field ${i + 1} nullable (from contract)`}
                  checked={f.nullable}
                  disabled
                />
                <NativeSelect
                  label={`Field ${i + 1} storage kind`}
                  data={["scalar", "json", "money"]}
                  value={f.storage.kind}
                  onChange={(e) =>
                    change({
                      storage:
                        e.currentTarget.value === "money"
                          ? {
                              kind: "money",
                              minorUnits: "unselected",
                              currency: "unselected",
                              currencyStorageId: dataId("currency"),
                            }
                          : e.currentTarget.value === "json"
                            ? { kind: "json", query: "opaque" }
                            : { kind: "scalar" },
                    })
                  }
                />
                {f.storage.kind === "json" ? (
                  <Text size="sm">
                    Bounded JSON storage is opaque to query filters, ordering and joins.
                  </Text>
                ) : null}
                {f.storage.kind === "money" ? (
                  <>
                    <Pick
                      label={`Field ${i + 1} minor units`}
                      value={f.storage.minorUnits}
                      options={(value?.fields ?? []).map((v) => ({ value: v.id, label: v.name }))}
                      onChange={(minorUnits) => {
                        if (f.storage.kind === "money")
                          change({ storage: { ...f.storage, minorUnits } });
                      }}
                    />
                    <Pick
                      label={`Field ${i + 1} currency`}
                      value={f.storage.currency}
                      options={(value?.fields ?? []).map((v) => ({ value: v.id, label: v.name }))}
                      onChange={(currency) => {
                        if (f.storage.kind === "money")
                          change({ storage: { ...f.storage, currency } });
                      }}
                    />
                    <TextInput
                      label={`Field ${i + 1} currency storage identity`}
                      value={f.storage.currencyStorageId}
                      disabled={
                        !!saved?.fields.some(
                          (v) => v.field === f.field && v.storage.kind === "money",
                        )
                      }
                      onChange={(e) => {
                        if (f.storage.kind === "money")
                          change({
                            storage: { ...f.storage, currencyStorageId: e.currentTarget.value },
                          });
                      }}
                    />
                  </>
                ) : null}
                <NativeSelect
                  label={`Field ${i + 1} server source`}
                  value={f.serverOwned ?? ""}
                  data={[
                    { value: "", label: "Client writable" },
                    ...["id", "clock", "principal", "scope", "version"].map((value) => ({
                      value,
                      label: value,
                    })),
                  ]}
                  onChange={(e) =>
                    change({
                      serverOwned: (e.currentTarget.value || undefined) as typeof f.serverOwned,
                    })
                  }
                />
              </Stack>
            </details>
          );
        })}
      </section>
      <DataRows<BackendEntity["relations"][number]>
        label="Relation"
        rows={entity.relations}
        max={30}
        create={() => ({
          id: dataId("relation"),
          target: exact(entity),
          fields: [
            {
              source: entity.primaryKey[0] ?? "unselected",
              target: entity.primaryKey[0] ?? "unselected",
            },
          ],
          cardinality: "many-to-one",
          ownership: "reference",
          scope: "same-scope",
          onDelete: "restrict",
        })}
        onChange={(relations) => update({ relations })}
      >
        {(r, i, change) => {
          const target = draft.backend?.entities.find(
            (e) => contractKey(e) === contractKey(r.target),
          );
          return (
            <>
              <Pick
                label={`Relation ${i + 1} target entity`}
                value={contractKey(r.target)}
                options={namedOptions(draft.backend?.entities ?? [])}
                onChange={(v) => {
                  const e = draft.backend?.entities.find((e) => contractKey(e) === v);
                  if (e) change({ ...r, target: exact(e) });
                }}
                onOpen={() => navigate("entities", contractKey(r.target))}
              />
              <DataRows
                label={`Relation ${i + 1} mapping`}
                rows={r.fields}
                max={10}
                create={() => ({ source: "unselected", target: "unselected" })}
                onChange={(fields) => change({ ...r, fields })}
              >
                {(m, j, set) => (
                  <div className="architecture-form-pair">
                    <Pick
                      label={`Mapping ${j + 1} source field`}
                      value={m.source}
                      options={options}
                      onChange={(source) => set({ ...m, source })}
                    />
                    <Pick
                      label={`Mapping ${j + 1} target field`}
                      value={m.target}
                      options={fieldOptions(target)}
                      onChange={(target) => set({ ...m, target })}
                    />
                  </div>
                )}
              </DataRows>
              {(
                [
                  ["cardinality", ["many-to-one", "one-to-one"]],
                  ["ownership", ["reference", "owned"]],
                  ["scope", ["same-scope", "global-target"]],
                  ["onDelete", ["restrict", "cascade", "set-null"]],
                ] as const
              ).map(([key, choices]) => (
                <NativeSelect
                  key={key}
                  label={`Relation ${i + 1} ${key}`}
                  value={r[key]}
                  data={[...choices]}
                  onChange={(e) => change({ ...r, [key]: e.currentTarget.value })}
                />
              ))}
              <Text size="xs">Stable relation identity: {r.id}</Text>
            </>
          );
        }}
      </DataRows>
      <DataRows<BackendEntity["uniqueKeys"][number]>
        label="Unique key"
        rows={entity.uniqueKeys}
        max={30}
        create={() => ({
          id: dataId("unique"),
          fields: [...entity.primaryKey],
          scope: "global",
          nulls: "forbidden",
        })}
        onChange={(uniqueKeys) => update({ uniqueKeys })}
      >
        {(k, i, change) => (
          <>
            <Many
              label={`Unique key ${i + 1} fields`}
              value={k.fields}
              options={options}
              max={10}
              onChange={(fields) => change({ ...k, fields })}
            />
            <NativeSelect
              label={`Unique key ${i + 1} scope`}
              value={k.scope}
              data={["global", "entity-scope"]}
              onChange={(e) => change({ ...k, scope: e.currentTarget.value as typeof k.scope })}
            />
            <NativeSelect
              label={`Unique key ${i + 1} nulls`}
              value={k.nulls}
              data={["distinct", "not-distinct", "forbidden"]}
              onChange={(e) => change({ ...k, nulls: e.currentTarget.value as typeof k.nulls })}
            />
          </>
        )}
      </DataRows>
      <DataRows<BackendEntity["indexes"][number]>
        label="Index"
        rows={entity.indexes}
        max={30}
        create={() => ({
          id: dataId("index"),
          fields: entity.primaryKey.map((field) => ({ field, direction: "asc" })),
        })}
        onChange={(indexes) => update({ indexes })}
      >
        {(idx, i, change) => (
          <DataRows<BackendEntity["indexes"][number]["fields"][number]>
            label={`Index ${i + 1} field`}
            rows={idx.fields}
            max={10}
            create={() => ({ field: "unselected", direction: "asc" })}
            onChange={(fields) => change({ ...idx, fields })}
          >
            {(f, j, set) => (
              <div className="architecture-form-pair">
                <Pick
                  label={`Index field ${j + 1}`}
                  value={f.field}
                  options={options}
                  onChange={(field) => set({ ...f, field })}
                />
                <NativeSelect
                  label={`Index direction ${j + 1}`}
                  value={f.direction}
                  data={["asc", "desc"]}
                  onChange={(e) =>
                    set({ ...f, direction: e.currentTarget.value as typeof f.direction })
                  }
                />
              </div>
            )}
          </DataRows>
        )}
      </DataRows>
    </Stack>
  );
}

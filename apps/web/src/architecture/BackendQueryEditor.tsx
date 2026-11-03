import {
  type Architecture,
  type BackendQuery,
  type BackendReference,
  backendEntityFields,
  backendQuerySources,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import { NativeSelect, Stack, Text } from "@mantine/core";
import {
  Count,
  type DataNavigation,
  DataRows,
  dataId,
  exact,
  Many,
  namedOptions,
  Pick,
} from "./BackendFields.tsx";
export function BackendQueryEditor({
  design,
  draft,
  query: q,
  onChange,
  navigate,
}: {
  design: DesignDocument;
  draft: Architecture;
  query: BackendQuery;
  onChange: (value: BackendQuery) => void;
  navigate: DataNavigation;
}) {
  const document = { ...design, architecture: draft };
  const entities = draft.backend?.entities ?? [];
  const sources = backendQuerySources(document, q);
  const fields = [...sources].flatMap(([source, { entity }]) =>
    backendEntityFields(document, entity).map((f) => ({
      value: `${source}/${f.id}`,
      label: `${source === "root" ? entity.name : source} · ${f.name}`,
      ref: { source, field: f.id },
    })),
  );
  const rootFields = fields.filter((f) => f.ref.source === "root");
  const update = (patch: Partial<BackendQuery>) => onChange({ ...q, ...patch });
  const fieldKey = (f: { source: string; field: string }) => `${f.source}/${f.field}`;
  const first = () => fields[0]?.ref ?? { source: "root", field: "unselected" };
  const policy = (
    label: string,
    resource: BackendReference,
    selected: BackendQuery["accessPolicy"],
    projection: string | undefined,
    change: (selection: BackendQuery["accessPolicy"], projection?: string) => void,
  ) => {
    const definitions = (draft.backend?.accessPolicies ?? []).filter(
      (p) => contractKey(p.resource) === contractKey(resource),
    );
    const current = definitions.find(
      (p) => selected.reference && contractKey(p) === contractKey(selected.reference),
    );
    return (
      <>
        <Pick
          label={label}
          value={selected.reference ? contractKey(selected.reference) : ""}
          options={namedOptions(definitions)}
          onChange={(key) => {
            const p = definitions.find((p) => contractKey(p) === key);
            change(p ? { kind: "policy", reference: exact(p) } : { kind: "unresolved" });
          }}
          onOpen={
            selected.reference
              ? () => {
                  if (selected.reference) navigate("policies", contractKey(selected.reference));
                }
              : undefined
          }
        />
        <Pick
          label={`${label} field projection`}
          value={projection ?? ""}
          options={(current?.projections ?? []).map((p) => ({ value: p.id, label: p.id }))}
          onChange={(id) => change(selected, id || undefined)}
        />
      </>
    );
  };
  return (
    <Stack gap="sm">
      <Pick
        label="Query root entity"
        value={contractKey(q.root)}
        options={namedOptions(entities)}
        onChange={(v) => {
          const e = entities.find((e) => contractKey(e) === v);
          if (e) update({ root: exact(e) });
        }}
        onOpen={() => navigate("entities", contractKey(q.root))}
      />
      <DataRows<BackendQuery["joins"][number]>
        label="Join"
        rows={q.joins}
        max={3}
        create={() => ({
          id: dataId("join"),
          from: "root",
          relation: sources.get("root")?.entity.relations[0]?.id ?? "unselected",
          kind: "inner",
        })}
        onChange={(joins) => update({ joins })}
      >
        {(j, i, change) => (
          <>
            <Pick
              label={`Join ${i + 1} source`}
              value={j.from}
              options={[
                { value: "root", label: "Root" },
                ...q.joins.slice(0, i).map((v) => ({ value: v.id, label: v.id })),
              ]}
              onChange={(from) => change({ ...j, from })}
            />
            <Pick
              label={`Join ${i + 1} relation`}
              value={j.relation}
              options={(sources.get(j.from)?.entity.relations ?? []).map((r) => ({
                value: r.id,
                label: `${r.id} → ${contractKey(r.target)}`,
              }))}
              onChange={(relation) => change({ ...j, relation })}
            />
            <NativeSelect
              label={`Join ${i + 1} kind`}
              data={["inner", "left"]}
              value={j.kind}
              onChange={(e) => change({ ...j, kind: e.currentTarget.value as typeof j.kind })}
            />
            {sources.get(j.id)
              ? policy(
                  `Join ${i + 1} access policy`,
                  sources.get(j.id)?.entity ?? q.root,
                  q.sourcePolicies?.find((s) => s.source === j.id)?.policy ?? {
                    kind: "unresolved",
                  },
                  q.sourcePolicies?.find((s) => s.source === j.id)?.projection,
                  (policy, projection) =>
                    update({
                      sourcePolicies: [
                        ...(q.sourcePolicies ?? []).filter((p) => p.source !== j.id),
                        { source: j.id, policy, ...(projection ? { projection } : {}) },
                      ],
                    }),
                )
              : null}
          </>
        )}
      </DataRows>
      <DataRows<BackendQuery["filters"][number]>
        label="Filter"
        rows={q.filters}
        max={20}
        create={() => ({ id: dataId("filter"), field: first(), comparisons: ["eq"] })}
        onChange={(filters) => update({ filters })}
      >
        {(f, i, change) => (
          <>
            <Pick
              label={`Filter ${i + 1} field`}
              value={fieldKey(f.field)}
              options={fields}
              onChange={(key) => {
                const found = fields.find((f) => f.value === key);
                if (found) change({ ...f, field: found.ref });
              }}
            />
            <Many
              label={`Filter ${i + 1} allowed comparisons`}
              value={f.comparisons}
              options={["eq", "ne", "lt", "lte", "gt", "gte", "in", "is-null", "prefix"].map(
                (value) => ({ value, label: value }),
              )}
              max={9}
              onChange={(values) =>
                change({
                  ...f,
                  comparisons: values as typeof f.comparisons,
                  maxValues: values.includes("in") ? (f.maxValues ?? 25) : undefined,
                })
              }
            />
            {f.comparisons.includes("in") ? (
              <Count
                label={`Filter ${i + 1} maximum values`}
                value={f.maxValues ?? 25}
                min={1}
                max={100}
                onChange={(maxValues) => change({ ...f, maxValues })}
              />
            ) : null}
          </>
        )}
      </DataRows>
      <Many
        label="Query output fields"
        value={q.projection.map((p) => fieldKey(p.field))}
        options={fields}
        onChange={(values) =>
          update({
            projection: values.flatMap((key) => {
              const field = fields.find((f) => f.value === key)?.ref;
              return field
                ? [
                    q.projection.find((p) => fieldKey(p.field) === key) ?? {
                      id: dataId("output"),
                      field,
                    },
                  ]
                : [];
            }),
          })
        }
      />
      <DataRows<BackendQuery["order"][number]>
        label="Sort key"
        rows={q.order}
        max={10}
        create={() => ({ field: rootFields[0]?.ref ?? first(), direction: "asc" })}
        onChange={(order) =>
          update({ order, cursor: { kind: "keyset", fields: order.map((o) => o.field) } })
        }
      >
        {(o, i, change) => (
          <>
            <Pick
              label={`Sort key ${i + 1} field`}
              value={fieldKey(o.field)}
              options={rootFields}
              onChange={(key) => {
                const f = rootFields.find((f) => f.value === key);
                if (f) change({ ...o, field: f.ref });
              }}
            />
            <NativeSelect
              label={`Sort key ${i + 1} direction`}
              data={["asc", "desc"]}
              value={o.direction}
              onChange={(e) =>
                change({ ...o, direction: e.currentTarget.value as typeof o.direction })
              }
            />
          </>
        )}
      </DataRows>
      <Text size="sm">
        Keyset cursor follows the full sort order automatically. End with a complete required
        primary/unique key. Access checks apply before pagination, counts and output.
      </Text>
      <div className="architecture-form-pair">
        <Count
          label="Default page limit"
          value={q.limit.default}
          min={1}
          max={100}
          onChange={(value) => update({ limit: { ...q.limit, default: value } })}
        />
        <Count
          label="Maximum page limit"
          value={q.limit.maximum}
          min={1}
          max={100}
          onChange={(maximum) => update({ limit: { ...q.limit, maximum } })}
        />
      </div>
      {policy(
        "Query access policy",
        q.root,
        q.accessPolicy,
        q.accessProjection,
        (accessPolicy, accessProjection) => update({ accessPolicy, accessProjection }),
      )}
      <NativeSelect
        label="Query observation site"
        data={["read", "search", "export"]}
        value={q.accessSite ?? "read"}
        onChange={(e) =>
          update({ accessSite: e.currentTarget.value as BackendQuery["accessSite"] })
        }
      />
      {q.accessPolicy.kind === "unresolved" ? (
        <Text size="sm">
          Access policy is unresolved. The design can be saved; compilation remains blocked. Reuse
          an exact policy here, or open the component Access tab to author one.
        </Text>
      ) : null}
      <NativeSelect
        label="Read freshness"
        value={q.freshness.kind}
        data={["authoritative", "bounded-staleness"]}
        onChange={(e) =>
          update({
            freshness:
              e.currentTarget.value === "authoritative"
                ? { kind: "authoritative" }
                : { kind: "bounded-staleness", binding: "unselected", maxAgeSeconds: 60 },
          })
        }
      />
      {q.freshness.kind === "bounded-staleness" ? (
        <>
          <Pick
            label="Read freshness binding"
            value={q.freshness.binding}
            options={(draft.bindings ?? [])
              .filter((b) => b.role === "read")
              .map((b) => ({ value: b.id, label: b.name }))}
            onChange={(binding) => {
              if (q.freshness.kind === "bounded-staleness")
                update({ freshness: { ...q.freshness, binding } });
            }}
          />
          <Count
            label="Maximum read age (seconds)"
            value={q.freshness.maxAgeSeconds}
            min={1}
            max={31536000}
            onChange={(maxAgeSeconds) => {
              if (q.freshness.kind === "bounded-staleness")
                update({ freshness: { ...q.freshness, maxAgeSeconds } });
            }}
          />
        </>
      ) : null}
    </Stack>
  );
}

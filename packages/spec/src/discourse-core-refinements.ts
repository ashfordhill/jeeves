/** Exact read aliases, immutable adjudication history and composition-only data grants. */
import type { Architecture } from "./architecture.ts";
import type { ContractField } from "./architecture-contracts.ts";
import type { BackendEntity, BackendQuery } from "./backend-model.ts";
import { dcRef as ref } from "./discourse-core-data.ts";
export function discourseCoreReadRefinements(a: Architecture) {
  const m = a.backend!;
  const cloneQuery = (from: string, id: string) => {
    const q = structuredClone(m.queries!.find((q) => q.id === from)!);
    q.id = id;
    m.queries!.push(q);
    return q;
  };
  const detail = cloneQuery("dc-topics-query", "dc-topic-detail-query");
  detail.name = "Exact current readable topic";
  detail.limit = { default: 1, maximum: 1 };
  detail.filters.push({
    id: "topic-id",
    field: { source: "root", field: "id" },
    comparisons: ["eq"],
  });
  const history = cloneQuery("dc-history-query", "dc-current-history-query");
  history.name = "Wire version is immutable post-version";
  history.projection = history.projection.map((p) =>
    p.id === "post-version" ? { ...p, id: "version" } : p,
  );
  const inbox = cloneQuery("dc-inbox-query", "dc-current-inbox-query");
  inbox.name = "Current inbox topic/title projection";
  inbox.joins = [
    { id: "post", from: "root", relation: "post", kind: "inner" },
    { id: "topic", from: "post", relation: "topic", kind: "inner" },
  ];
  inbox.projection = [
    ...inbox.projection.filter((p) => ["id", "event-id", "created-at"].includes(p.id)),
    { id: "topic-id", field: { source: "topic", field: "id" } },
    { id: "title", field: { source: "topic", field: "title" } },
  ];
  inbox.sourcePolicies = [
    {
      source: "post",
      policy: { kind: "policy", reference: ref("dc-post-entity-policy") },
      projection: "read",
    },
    {
      source: "topic",
      policy: { kind: "policy", reference: ref("dc-topic-entity-policy") },
      projection: "read",
    },
  ];
  const search = cloneQuery("dc-search-query", "dc-current-search-query");
  search.name = "Exact scoped search wire projection";
  search.projection = [
    { id: "post-id", field: { source: "root", field: "id" } },
    { id: "topic-id", field: { source: "root", field: "topic-id" } },
    { id: "snippet", field: { source: "root", field: "text" } },
    { id: "title", field: { source: "topic", field: "title" } },
  ];
  const activity = m.entities.find((e) => e.id === "dc-activity-entity")!;
  const bounded = (entity: BackendEntity, id: string, maximum = 100): BackendQuery => ({
    id,
    version: "v1",
    name: id,
    root: ref(entity.id),
    joins: [],
    filters: [],
    projection: entity.fields.map((f) => ({
      id: f.field,
      field: { source: "root", field: f.field },
    })),
    order: [
      { field: { source: "root", field: "created-at" }, direction: "asc" },
      { field: { source: "root", field: "id" }, direction: "asc" },
    ],
    limit: { default: Math.min(25, maximum), maximum },
    cursor: {
      kind: "keyset",
      fields: [
        { source: "root", field: "created-at" },
        { source: "root", field: "id" },
      ],
    },
    accessPolicy: { kind: "policy", reference: ref(`${entity.id}-policy`) },
    accessProjection: "read",
    freshness: { kind: "authoritative" },
  });
  const q = bounded(activity, "dc-recorded-activity-query");
  q.filters = [
    { id: "subject", field: { source: "root", field: "principal-id" }, comparisons: ["eq"] },
    { id: "window", field: { source: "root", field: "at" }, comparisons: ["gte", "lt"] },
    { id: "kind", field: { source: "root", field: "kind" }, comparisons: ["eq"] },
  ];
  m.queries!.push(q);
  // Immutable decision snapshots supply the bounded pure H14 history without overwriting it.
  const old = m.entities.find((e) => e.id === "dc-adjudication-entity")!,
    c = structuredClone(a.contracts!.find((c) => c.id === old.contract.id)!);
  c.id = "dc-adjudication-history-data";
  c.name = "Immutable adjudication decisions";
  c.description =
    "One append per accepted adjudication; no post text. Unique case/version, source-authorized same SQL transaction.";
  const add = (id: string, value: Partial<ContractField>): ContractField => ({
    id,
    name: id.replace(/-([a-z])/g, (_, x: string) => x.toUpperCase()),
    description: "",
    required: true,
    type: "uuid",
    ...value,
  });
  c.shape!.payload = [
    ...c.shape!.payload,
    add("adjudication-id", {}),
    add("decision-version", { type: "integer", minimum: 1, maximum: 2147483647 }),
    add("actor-id", {}),
  ];
  a.contracts!.push(c);
  const d = structuredClone(a.datasets!.find((d) => d.id === old.dataset)!);
  d.id = "dc-adjudication-history-dataset";
  d.name = c.name;
  d.contract = ref(c.id);
  d.deletion = "Retain";
  a.datasets!.push(d);
  const e: BackendEntity = {
    ...structuredClone(old),
    id: "dc-adjudication-history-entity",
    name: c.name,
    dataset: d.id,
    contract: ref(c.id),
    storageId: "dc-adjudication-history-table",
    fields: [
      ...old.fields,
      {
        field: "adjudication-id",
        storageId: "adjudication-id-column",
        required: true,
        nullable: false,
        storage: { kind: "scalar" },
      },
      {
        field: "decision-version",
        storageId: "decision-version-column",
        required: true,
        nullable: false,
        storage: { kind: "scalar" },
      },
      {
        field: "actor-id",
        storageId: "actor-id-column",
        required: true,
        nullable: false,
        storage: { kind: "scalar" },
        serverOwned: "principal",
      },
    ],
    uniqueKeys: [
      ...old.uniqueKeys,
      {
        id: "accepted-case-version",
        fields: ["adjudication-id", "decision-version"],
        scope: "entity-scope",
        nulls: "forbidden",
      },
    ],
  };
  e.relations.push({
    id: "adjudication",
    target: ref(old.id),
    fields: [
      { source: "scope-id", target: "scope-id" },
      { source: "adjudication-id", target: "id" },
    ],
    cardinality: "many-to-one",
    ownership: "owned",
    scope: "same-scope",
    onDelete: "restrict",
  });
  m.entities.push(e);
  const aggregate = m.aggregates.find((g) => g.root.id === old.id && g.version === "v2")!;
  aggregate.children.push(ref(e.id));
  if (aggregate.concurrency.kind === "row-lock") aggregate.concurrency.entities.push(ref(e.id));
  const policy = structuredClone(m.accessPolicies!.find((p) => p.id === `${old.id}-policy`)!);
  policy.id = `${e.id}-policy`;
  policy.name = c.name;
  policy.resource = ref(e.id);
  for (const p of policy.projections)
    p.fields = [
      ...p.fields,
      "adjudication-id",
      "decision-version",
      ...(p.mode === "read" ? ["actor-id"] : []),
    ];
  m.accessPolicies!.push(policy);
  const decisions = bounded(e, "dc-adjudication-history-query", 20);
  decisions.filters = [
    { id: "post", field: { source: "root", field: "post-id" }, comparisons: ["eq"] },
  ];
  m.queries!.push(decisions);
  const file = structuredClone(
    m.accessPolicies!.find((p) => p.id === "dc-attachment-entity-policy")!,
  );
  file.id = "dc-attached-file-read-policy";
  file.name = "Attached metadata under parent-authorized byte operation";
  file.clauses.push({ id: "attached", kind: "visibility", field: "state", value: "attached" });
  file.rules = [
    {
      id: "attached-metadata",
      effect: "allow",
      actions: ["read", "bytes", "idempotent-replay"],
      when: { operator: "all", clauses: ["authenticated", "attached"] },
    },
  ];
  file.projections = file.projections
    .filter((p) => p.mode === "read")
    .map((p) => ({ ...p, when: { operator: "all", clauses: ["authenticated", "attached"] } }));
  m.accessPolicies!.push(file);
}

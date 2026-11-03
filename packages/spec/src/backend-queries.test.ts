import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { contractCanonical, resolveContractSource } from "./architecture-contracts.ts";
import {
  buildArchitectureHandoff,
  handoffFingerprint,
  handoffJson,
  handoffMarkdown,
} from "./architecture-handoff.ts";
import {
  type ArchitectureLibraryEntry,
  extractArchitectureTemplate,
  previewArchitectureTemplate,
} from "./architecture-library.ts";
import { fragmentIds, mappedArchitecture } from "./architecture-patterns.ts";
import { reviewArchitecture } from "./architecture-review.ts";
import { targetChanges } from "./architecture-targets.ts";
import { backendDataRemovalFindings, validateBackendData } from "./backend-data.ts";
import { readLegacyBackendResources } from "./backend-legacy.ts";
import { type BackendQuery, backendModelSchema, backendQuerySchema } from "./backend-model.ts";
import { backendQuerySources, validateBackendQueries } from "./backend-queries.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { blocksGenerate, isStructural } from "./findings.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

function need<T>(value: T | undefined | null): T {
  if (value == null) throw new Error("Missing fixture value");
  return value;
}
const ref = (id: string, version = "v1") => ({ id, version });
const field = (field: string, source = "root") => ({ source, field });
const model = (d: DesignDocument) => need(need(d.architecture).backend);
const query = (d: DesignDocument) => need(model(d).queries?.[0]);
const root = (d: DesignDocument) => need(model(d).entities[1]);
function fixture(): DesignDocument {
  const payload = [
    { id: "id", name: "id", type: "uuid", required: true },
    { id: "created", name: "created", type: "timestamp", required: true },
    { id: "count", name: "count", type: "integer", minimum: 0, maximum: 1000, required: true },
    { id: "title", name: "title", type: "text", maxLength: 120, nullable: true, required: false },
    { id: "parent", name: "parent", type: "uuid", required: true },
    {
      id: "metadata",
      name: "metadata",
      type: "map",
      keys: { maxLength: 32 },
      maxEntries: 5,
      values: { type: "text", maxLength: 100 },
      required: true,
    },
  ];
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      { id: "api", name: "API", planned: "application-api", template: null },
      { id: "store", name: "Authority", planned: "relational-store", template: null },
    ],
    architecture: {
      system: { name: "Synthetic bounded reads", description: "No benchmark application/runtime." },
      contracts: ["topic", "post"].map((id) => ({
        id: `${id}-data`,
        version: "v1",
        name: id,
        kind: "data",
        coverage: "Complete",
        shape: { payload, operations: [] },
      })),
      datasets: ["topic", "post"].map((id) => ({
        id: `${id}-dataset`,
        name: id,
        contract: ref(`${id}-data`),
        owners: [{ kind: "element", id: "api" }],
        readers: [],
        writers: [],
        ownershipDecision: "",
        store: "store",
        tenant: "Resource scoped",
        deletion: "Retain",
        exportAccess: "Authorized staff",
      })),
      backend: {
        schemaVersion: 1,
        entities: ["topic", "post"].map((id) => ({
          id: `${id}-entity`,
          version: "v1",
          name: id,
          dataset: `${id}-dataset`,
          contract: ref(`${id}-data`),
          storageId: `${id}-table`,
          fields: payload.map((f) => ({
            field: f.id,
            storageId: `${f.id}-column`,
            required: f.required,
            nullable: !!f.nullable,
            storage: f.id === "metadata" ? { kind: "json", query: "opaque" } : { kind: "scalar" },
          })),
          primaryKey: ["id"],
          scope: { kind: "global" },
          relations:
            id === "post"
              ? [
                  {
                    id: "topic-link",
                    target: ref("topic-entity"),
                    fields: [{ source: "parent", target: "id" }],
                    cardinality: "many-to-one",
                    ownership: "owned",
                    scope: "same-scope",
                    onDelete: "cascade",
                  },
                ]
              : [],
        })),
        aggregates: [
          {
            id: "topic-aggregate",
            version: "v1",
            name: "Topic and posts",
            root: ref("topic-entity"),
            children: [ref("post-entity")],
            owner: { kind: "element", id: "api" },
            store: "store",
            concurrency: {
              kind: "row-lock",
              entities: [ref("post-entity"), ref("topic-entity")],
              order: "entity-id-primary-key",
            },
            invariants: [],
          },
        ],
        queries: [
          {
            id: "post-feed",
            version: "v1",
            name: "Post feed",
            root: ref("post-entity"),
            joins: [{ id: "topic", from: "root", relation: "topic-link", kind: "left" }],
            filters: [
              {
                id: "by-count",
                field: field("count"),
                comparisons: ["eq", "gte", "in"],
                maxValues: 10,
              },
              {
                id: "title-prefix",
                field: field("title", "topic"),
                comparisons: ["prefix", "is-null"],
              },
            ],
            projection: [
              { id: "id", field: field("id") },
              { id: "topic-title", field: field("title", "topic") },
              { id: "metadata", field: field("metadata") },
            ],
            order: [
              { field: field("created"), direction: "desc" },
              { field: field("id"), direction: "desc" },
            ],
            limit: { maximum: 100 },
            cursor: { kind: "keyset", fields: [field("created"), field("id")] },
            accessPolicy: { kind: "unresolved", reference: ref("post-read-policy") },
            freshness: { kind: "authoritative" },
          },
        ],
      },
    },
  });
}
function save(before: DesignDocument, after: DesignDocument) {
  return applyOperations(
    before,
    [{ op: "setArchitecture", architecture: after.architecture ?? null }],
    testLookup,
  );
}
const errors = (d: DesignDocument) => validateDesign(d, testLookup).filter(isStructural);

function withFreshness(): DesignDocument {
  const d = fixture();
  const architecture = need(d.architecture);
  Object.assign(architecture, {
    components: ["data", "reader"].map((id) => ({
      id,
      element: "api",
      name: id,
      capability: "domain-module",
      config: {},
      members: [],
      usesResources: [],
      usesConnections: [],
      responsibility: "",
    })),
    componentRelationships: [
      {
        id: "read",
        from: "reader",
        to: "data",
        description: "Reads bounded post data",
        protocol: "In process",
        interaction: "Request / response",
      },
    ],
    interfaces: ["provided", "required"].map((direction) => ({
      id: direction,
      name: direction,
      owner: { kind: "component", id: direction === "provided" ? "data" : "reader" },
      direction,
      contract: ref("post-data"),
      necessity: "required",
    })),
    bindings: [
      {
        id: "read-freshness",
        name: "Bounded source read",
        provided: "provided",
        required: "required",
        relationship: { kind: "component-relationship", id: "read" },
        contract: ref("post-data"),
        role: "read",
        businessSynchrony: "Synchronous",
        policies: {
          freshness: {
            invalidation: "On write",
            maxAgeSeconds: 5,
            detail: "Declared bound, no execution evidence.",
          },
        },
      },
    ],
  });
  query(d).freshness = { kind: "bounded-staleness", binding: "read-freshness", maxAgeSeconds: 10 };
  return designSchema.parse(d);
}

it("saves bounded reads with exact references and unresolved policy while blocking compilation", () => {
  const d = fixture(),
    before = structuredClone(d);
  delete model(before).queries;
  const saved = save(before, d);
  expect(saved.ok).toBe(true);
  expect(errors(d)).toEqual([]);
  expect(query(d).limit).toEqual({ default: 25, maximum: 100 });
  expect(validateBackendQueries(d)).toEqual([
    expect.objectContaining({
      code: "CONFIG_REQUIRED",
      target: { path: ["architecture", "backend", "queries", "post-feed@v1", "accessPolicy"] },
    }),
  ]);
  expect(blocksGenerate(validateDesign(d, testLookup))).toBe(true);
  expect(backendQuerySources(d, query(d)).get("topic")?.entity.id).toBe("topic-entity");
  expect(backendQuerySources(d, query(d)).get("topic")?.nullable).toBe(true);
  const empty = backendModelSchema.parse({ schemaVersion: 1 });
  expect(empty).toEqual({ schemaVersion: 1, entities: [], aggregates: [] });
});

it("rejects malformed, unsafe or unbounded query vocabulary without partial saves", () => {
  const q = query(fixture());
  const bad = [
    { ...q, sql: "SELECT *" },
    { ...q, order: [] },
    { ...q, projection: [] },
    { ...q, limit: { default: 0, maximum: 100 } },
    { ...q, limit: { default: 25, maximum: 101 } },
    { ...q, cursor: { kind: "offset", offset: 0 } },
    { ...q, accessPolicy: undefined },
    { ...q, freshness: undefined },
    { ...q, filters: [{ id: "bad", field: field("title"), comparisons: ["raw-sql"] }] },
    {
      ...q,
      joins: Array.from({ length: 4 }, (_, i) => ({
        id: `join-${i}`,
        from: "root",
        relation: "topic-link",
        kind: "left",
      })),
    },
    { ...q, filters: [{ id: "many", field: field("id"), comparisons: ["in"], maxValues: 101 }] },
  ];
  for (const candidate of bad) {
    expect(backendQuerySchema.safeParse(candidate).success).toBe(false);
    const d = fixture();
    const result = applyOperations(
      d,
      [
        {
          op: "setArchitecture",
          architecture: { ...d.architecture, backend: { ...model(d), queries: [candidate] } },
        },
      ] as unknown as Parameters<typeof applyOperations>[1],
      testLookup,
    );
    expect(result.ok).toBe(false);
    expect(query(d)).toEqual(q);
  }
  expect(
    backendModelSchema.safeParse({
      ...model(fixture()),
      queries: Array.from({ length: 101 }, () => q),
    }).success,
  ).toBe(false);
});

it("rejects stale fields, unsafe comparisons, duplicate identities and unordered relation paths atomically", () => {
  const mutations: ((q: BackendQuery) => void)[] = [
    (q) => {
      q.root.version = "stale";
    },
    (q) => {
      need(q.projection[0]).field.field = "missing";
    },
    (q) => {
      need(q.projection[0]).field.source = "missing";
    },
    (q) => {
      q.projection.push({ ...need(q.projection[0]) });
    },
    (q) => {
      need(q.filters[0]).comparisons = ["eq", "eq"];
    },
    (q) => {
      need(q.filters[0]).comparisons = ["in"];
      delete need(q.filters[0]).maxValues;
    },
    (q) => {
      need(q.filters[0]).field = field("metadata");
    },
    (q) => {
      need(q.filters[0]).comparisons = ["is-null"];
      delete need(q.filters[0]).maxValues;
    },
    (q) => {
      need(q.filters[1]).comparisons = ["gt"];
    },
    (q) => {
      need(q.filters[1]).field = field("id");
      need(q.filters[1]).comparisons = ["prefix"];
    },
    (q) => {
      q.filters.push({ ...need(q.filters[0]) });
    },
    (q) => {
      need(q.joins[0]).from = "topic";
    },
    (q) => {
      need(q.joins[0]).relation = "missing";
    },
    (q) => {
      need(q.joins[0]).id = "root";
    },
    (q) => {
      q.joins.push({ ...need(q.joins[0]), id: "again" });
    },
    (q) => {
      q.id = "api";
    },
    (q) => {
      q.accessPolicy = { kind: "policy", reference: ref("missing-policy", "v2") };
    },
  ];
  for (const mutate of mutations) {
    const base = fixture(),
      candidate = structuredClone(base);
    mutate(query(candidate));
    expect(save(base, candidate).ok, contractCanonical(query(candidate))).toBe(false);
    expect(errors(candidate).length).toBeGreaterThan(0);
    expect(query(base)).toEqual(query(fixture()));
  }
  const duplicated = fixture();
  need(model(duplicated).queries).push(structuredClone(query(duplicated)));
  expect(save(fixture(), duplicated).ok).toBe(false);
});

it("requires full stable nonnullable root keyset order, bounded defaults and exact cursor fields", () => {
  const mutations: ((q: BackendQuery) => void)[] = [
    (q) => {
      q.order.pop();
    },
    (q) => {
      q.cursor.fields.reverse();
    },
    (q) => {
      q.order.reverse();
      q.cursor.fields.reverse();
    },
    (q) => {
      q.limit.default = 30;
      q.limit.maximum = 20;
    },
    (q) => {
      q.order.unshift({ field: field("title"), direction: "asc" });
      q.cursor.fields.unshift(field("title"));
    },
    (q) => {
      q.order.unshift({ field: field("id", "topic"), direction: "asc" });
      q.cursor.fields.unshift(field("id", "topic"));
    },
    (q) => {
      q.order.unshift({ field: field("metadata"), direction: "asc" });
      q.cursor.fields.unshift(field("metadata"));
    },
    (q) => {
      q.order.push({ ...need(q.order[1]) });
      q.cursor.fields.push(field("id"));
    },
  ];
  for (const mutate of mutations) {
    const candidate = fixture();
    mutate(query(candidate));
    expect(save(fixture(), candidate).ok).toBe(false);
  }
  const valid = fixture();
  root(valid).uniqueKeys.push({
    id: "count-unique",
    fields: ["count"],
    scope: "global",
    nulls: "forbidden",
  });
  query(valid).order = [{ field: field("count"), direction: "asc" }];
  query(valid).cursor.fields = [field("count")];
  expect(errors(valid)).toEqual([]);
  root(valid).uniqueKeys[0] = {
    id: "nullable-key",
    fields: ["title"],
    scope: "global",
    nulls: "distinct",
  };
  expect(errors(valid).length).toBeGreaterThan(0);
});

it("includes persisted scope in composite cursor identity and resolves local reusable field types", () => {
  const d = fixture();
  model(d).aggregates = [];
  const entity = root(d),
    c = need(d.architecture?.contracts?.find((c) => c.id === entity.contract.id));
  need(c.shape).types = [
    {
      id: "quantity",
      version: "v1",
      name: "Quantity",
      description: "",
      value: { type: "integer", minimum: 0, maximum: 1000 },
    },
  ];
  Object.assign(need(c.shape?.payload.find((f) => f.id === "count")), {
    type: "ref",
    ref: ref("quantity"),
    minimum: undefined,
    maximum: undefined,
  });
  delete need(c.shape?.payload.find((f) => f.id === "count")).minimum;
  delete need(c.shape?.payload.find((f) => f.id === "count")).maximum;
  need(c.shape).payload.push({
    id: "scope",
    name: "scope",
    type: "uuid",
    required: true,
    description: "",
  });
  entity.fields.push({
    field: "scope",
    storageId: "scope-column",
    storage: { kind: "scalar" },
    required: true,
    nullable: false,
    serverOwned: "scope",
  });
  entity.scope = { kind: "field", field: "scope" };
  entity.primaryKey = ["scope", "id"];
  need(entity.relations[0]).scope = "global-target";
  expect(errors(d).some((f) => f.target.path?.includes("order"))).toBe(true);
  query(d).order.splice(1, 0, { field: field("scope"), direction: "desc" });
  query(d).cursor.fields.splice(1, 0, field("scope"));
  expect(errors(d)).toEqual([]);
});

it("carries bounded freshness references through extraction and keeps joined dataset inputs in review", () => {
  const d = withFreshness();
  expect(errors(d)).toEqual([]);
  const { fragment } = extractArchitectureTemplate(
    d,
    { elements: ["api", "store"] },
    { id: "fresh-query", version: "1.0.0", name: "Fresh query", purpose: "Exact freshness refs" },
    testLookup,
  );
  const q = need(fragment.architecture.backend?.queries?.[0]);
  expect(q.freshness.kind).toBe("bounded-staleness");
  if (q.freshness.kind !== "bounded-staleness") return;
  const b = need(
    fragment.architecture.bindings?.find(
      (b) => b.id === (q.freshness.kind === "bounded-staleness" ? q.freshness.binding : ""),
    ),
  );
  const entity = need(fragment.architecture.backend?.entities.find((e) => e.id === q.root.id));
  expect(b.contract).toEqual(entity.contract);
  const mapped = mappedArchitecture(fragment, { [b.id]: "copy-binding" });
  expect(mapped.backend?.queries?.[0]?.freshness).toEqual({
    ...q.freshness,
    binding: "copy-binding",
  });
  const before = need(
    reviewArchitecture(d).findings.find((f) => f.code === "BACKEND_STRATEGY_UNIMPLEMENTED"),
  );
  need(need(need(d.architecture?.bindings?.[0]).policies).freshness).maxAgeSeconds = 4;
  expect(reviewArchitecture(d).findings.find((f) => f.id === before.id)?.fingerprint).not.toBe(
    before.fingerprint,
  );
});

it("reports removed relation targets, contracts and fields at their query declaration", () => {
  for (const mutate of [
    (d: DesignDocument) => {
      model(d).entities.shift();
    },
    (d: DesignDocument) => {
      need(d.architecture).contracts = [];
    },
    (d: DesignDocument) => {
      root(d).fields = root(d).fields.filter((f) => f.field !== "id");
    },
    (d: DesignDocument) => {
      root(d).relations = [];
    },
  ]) {
    const candidate = fixture();
    mutate(candidate);
    expect(
      backendDataRemovalFindings(candidate).some(
        (f) => f.code === "UNKNOWN_REFERENCE" && f.target.path?.includes("post-feed@v1"),
      ),
    ).toBe(true);
    expect(save(fixture(), candidate).ok).toBe(false);
  }
  const crossStore = fixture();
  crossStore.elements.push({ ...need(crossStore.elements[1]), id: "other-store" });
  need(need(crossStore.architecture).datasets?.[0]).store = "other-store";
  expect(save(fixture(), crossStore).ok).toBe(false);
});

it("reuses a named read freshness binding with the root exact contract and rejects stale/unbounded references", () => {
  const d = fixture();
  need(d.architecture).bindings = [
    {
      id: "read-freshness",
      name: "Bounded source read",
      provided: "provided",
      required: "required",
      relationship: { kind: "connection", id: "read" },
      contract: root(d).contract,
      role: "read",
      businessSynchrony: "Synchronous",
      policies: {
        freshness: {
          invalidation: "On write",
          maxAgeSeconds: 5,
          detail: "Declared bound, no execution evidence.",
        },
      },
    },
  ];
  query(d).freshness = { kind: "bounded-staleness", binding: "read-freshness", maxAgeSeconds: 10 };
  expect(validateBackendQueries(d).filter(isStructural)).toEqual([]);
  const binding = (d: DesignDocument) => need(need(d.architecture).bindings?.[0]);
  for (const mutate of [
    (d: DesignDocument) => {
      binding(d).contract.version = "v2";
    },
    (d: DesignDocument) => {
      binding(d).role = "write";
    },
    (d: DesignDocument) => {
      need(need(binding(d).policies).freshness).maxAgeSeconds = 11;
    },
    (d: DesignDocument) => {
      need(need(binding(d).policies).freshness).invalidation = "No cache";
    },
    (d: DesignDocument) => {
      need(d.architecture).bindings = [];
    },
  ]) {
    const candidate = structuredClone(d);
    mutate(candidate);
    expect(validateBackendQueries(candidate).filter(isStructural).length).toBeGreaterThan(0);
  }
  delete need(binding(d).policies).freshness;
  expect(validateBackendQueries(d).filter((f) => f.code === "CONFIG_REQUIRED")).toHaveLength(2);
});

it("carries queries through extraction/remapping, exact reuse, target diffs, schemas and deterministic handoff", async () => {
  const source = withFreshness();
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api", "store"] },
    {
      id: "bounded-reads",
      version: "1.0.0",
      name: "Bounded reads",
      purpose: "Portable read declarations",
    },
    testLookup,
  );
  const local = need(fragment.architecture.backend?.queries?.[0]);
  expect(local.projection).toEqual(query(source).projection);
  expect(local.accessPolicy).toEqual(query(source).accessPolicy);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `mapped-${id}`]));
  ids.root = "wrong-root";
  ids.topic = "wrong-alias";
  ids["topic-link"] = "wrong-relation";
  ids.created = "wrong-field";
  ids["post-read-policy"] = "mapped-post-read-policy";
  const mapped = need(mappedArchitecture(fragment, ids).backend).queries?.[0];
  expect(mapped?.root).toEqual(ref(`mapped-${local.root.id}`));
  expect(mapped?.accessPolicy.reference).toEqual(ref("mapped-post-read-policy"));
  expect(mapped?.projection).toEqual(query(source).projection);
  expect(mapped?.joins).toEqual(query(source).joins);
  expect(mapped?.cursor).toEqual(query(source).cursor);
  const entry: ArchitectureLibraryEntry = {
    id: fragment.id,
    version: fragment.version,
    fragment,
    metadata,
    state: "published",
    draftRevision: 1,
    contentHash: "a".repeat(64),
    availability: "architecture only",
  };
  const empty = designSchema.parse({ schemaVersion: 2, revision: 0 });
  const preview = previewArchitectureTemplate(
    empty,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "copy",
      name: "Copy",
      baseRevision: 0,
    },
    testLookup,
  );
  expect(preview.errors).toEqual([]);
  const applied = applyOperations(empty, preview.ops, testLookup);
  expect(applied.ok).toBe(true);
  if (!applied.ok) return;
  expect(errors(applied.design)).toEqual([]);
  expect(model(applied.design).queries).toHaveLength(1);
  const pinned = need(applied.design.architecture?.patternInstances?.[0]);
  const reuse = previewArchitectureTemplate(
    applied.design,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "reuse",
      name: "Reuse",
      baseRevision: applied.design.revision,
      roles: Object.fromEntries(
        fragment.roles.map((r) => [
          r.id,
          { mode: "reuse" as const, id: need(pinned.identities[r.id]) },
        ]),
      ),
    },
    testLookup,
  );
  expect(reuse.errors).toEqual([]);
  const reused = applyOperations(applied.design, reuse.ops, testLookup);
  expect(reused.ok).toBe(true);
  if (reused.ok) expect(model(reused.design)).toEqual(model(applied.design));
  const handoff = await buildArchitectureHandoff({
    design: applied.design,
    project: { id: "queries", name: "Queries" },
    lookup: testLookup,
  });
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(model(applied.design));
  expect(handoffMarkdown(handoff)).toContain("- Query ");
  expect(
    handoffJson(
      await buildArchitectureHandoff({
        design: applied.design,
        project: { id: "queries", name: "Queries" },
        lookup: testLookup,
      }),
    ),
  ).toBe(handoffJson(handoff));
  const changed = structuredClone(applied.design);
  query(changed).limit.maximum = 50;
  expect(targetChanges(applied.design, changed)).toContainEqual(
    expect.objectContaining({
      path: expect.stringMatching(/architecture\/backend\/queries\/.*@v1/),
    }),
  );
  expect(await handoffFingerprint(changed, { id: "queries", name: "Queries" })).not.toBe(
    await handoffFingerprint(applied.design, { id: "queries", name: "Queries" }),
  );
  expect(JSON.stringify(operationBatchJsonSchema())).toContain('"keyset"');
  expect(JSON.stringify(operationBatchJsonSchema())).toContain('"bounded-staleness"');
});

it("invalidates relevant dataset review fingerprints after read projection/policy/freshness changes", () => {
  const before = fixture();
  const initial = need(
    reviewArchitecture(before).findings.find((f) => f.code === "BACKEND_STRATEGY_UNIMPLEMENTED"),
  );
  const changed = structuredClone(before);
  query(changed).limit.maximum = 50;
  const next = need(reviewArchitecture(changed).findings.find((f) => f.id === initial.id));
  expect(next.fingerprint).not.toBe(initial.fingerprint);
});

function legacy() {
  return designSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
    ),
  );
}
it("derives detached deeply read-only legacy resources from their sole saved authority", () => {
  const d = legacy(),
    snapshot = contractCanonical(d);
  const first = need(readLegacyBackendResources(d).resources[0]);
  const source = first.source;
  d.architecture = {
    system: { name: "Legacy", description: "" },
    nodes: [],
    relationships: [],
    contracts: [
      {
        id: "legacy-data",
        version: "v1",
        name: "Legacy data",
        kind: "data",
        description: "",
        source,
        sourceSnapshot: contractCanonical(resolveContractSource(d, source)),
        sourceDesignRevision: d.revision,
      },
    ],
  };
  const before = contractCanonical(d),
    adapted = readLegacyBackendResources(d);
  expect(adapted.findings).toEqual([]);
  expect(adapted.resources).toHaveLength(2);
  const item = need(adapted.resources[0]);
  expect(item.contracts).toEqual([ref("legacy-data")]);
  expect(item.descriptor.id).toBe(source.resource);
  expect(item.access).toBe("legacy-owner");
  expect(item.systemFields).toEqual(["id", "ownerId", "createdAt"]);
  expect(Object.isFrozen(item.descriptor.fields[0])).toBe(true);
  expect(Reflect.set(item.descriptor, "name", "tampered")).toBe(false);
  expect(contractCanonical(d)).toBe(before);
  expect(d.architecture.backend).toBeUndefined();
  expect(contractCanonical(legacy())).toBe(snapshot);
  expect(readLegacyBackendResources(d)).toEqual(adapted);
  const duplicate = structuredClone(d);
  need(duplicate.architecture).datasets = [
    {
      id: "legacy-authority",
      name: "Legacy authority",
      contract: ref("legacy-data"),
      owners: [{ kind: "element", id: source.element }],
      readers: [],
      writers: [],
      ownershipDecision: "",
      store: need(item.store),
      tenant: "Resource scoped",
      deletion: "Retain",
      exportAccess: "Authorized staff",
    },
  ];
  need(duplicate.architecture).backend = backendModelSchema.parse({
    schemaVersion: 1,
    entities: [
      {
        id: "editable-legacy-copy",
        version: "v1",
        name: "Forbidden copy",
        dataset: "legacy-authority",
        contract: ref("legacy-data"),
        storageId: "duplicate-table",
        fields: [
          {
            field: "id",
            storageId: "id-column",
            required: true,
            nullable: false,
            storage: { kind: "scalar" },
          },
        ],
        primaryKey: ["id"],
        scope: { kind: "global" },
      },
    ],
  });
  expect(save(d, duplicate).ok).toBe(false);
  expect(validateBackendData(duplicate)).toContainEqual(
    expect.objectContaining({
      code: "CONFIG_INVALID",
      message: expect.stringContaining("not an editable entity copy"),
    }),
  );
  const attachment = need(
    need(d.elements.find((e) => e.id === source.element)).attachments.find(
      (a) => a.id === source.attachment,
    ),
  );
  const raw = attachment.config.model as {
    resources: { name: string; fields: { name: string }[] }[];
  };
  need(raw.resources[0]).name = "renamed";
  need(need(raw.resources[0]).fields[0]).name = "newLabel";
  const renamed = need(readLegacyBackendResources(d).resources[0]);
  expect(renamed.source).toEqual(item.source);
  expect(renamed.descriptor.fields.map((f) => f.id)).toEqual(
    item.descriptor.fields.map((f) => f.id),
  );
  expect(item.descriptor.name).not.toBe("renamed");
});

it("preserves legacy internal/relation/optional semantics and reports malformed/missing sources without fabricating entities", () => {
  const d = legacy();
  const a = need(d.elements[0]?.attachments[0]);
  const raw = a.config.model as {
    storeConnection?: string;
    resources: {
      id: string;
      access: string;
      operations: string[];
      fields: unknown[];
      belongsTo: unknown[];
    }[];
  };
  const parent = need(raw.resources[0]);
  raw.resources.push({
    id: "internal-history",
    access: "internal",
    operations: [],
    fields: [],
    belongsTo: [{ id: "parent-link", resource: parent.id, required: true }],
    ...{ name: "history" },
  });
  const adapted = readLegacyBackendResources(d);
  expect(adapted.findings).toEqual([]);
  const internal = need(adapted.resources.find((r) => r.descriptor.id === "internal-history"));
  expect(internal.access).toBe("legacy-internal");
  expect(internal.descriptor.operations).toEqual([]);
  expect(internal.systemFields).toEqual(["id"]);
  expect(internal.descriptor.belongsTo).toEqual([
    { id: "parent-link", resource: parent.id, required: true },
  ]);
  delete raw.storeConnection;
  expect(readLegacyBackendResources(d).findings[0]?.code).toBe("CONFIG_REQUIRED");
  parent.access = "unsafe";
  expect(readLegacyBackendResources(d).resources).toEqual([]);
  expect(readLegacyBackendResources(d).findings[0]?.code).toBe("CONFIG_INVALID");
  expect(d.architecture?.backend).toBeUndefined();
  for (const file of ["link-shortener.json", "qrwty.json", "resources.json"]) {
    const old = designSchema.parse(
      JSON.parse(
        readFileSync(new URL(`../../../fixtures/designs/${file}`, import.meta.url), "utf8"),
      ),
    );
    readLegacyBackendResources(old);
    expect(old.architecture?.backend).toBeUndefined();
    expect(validateBackendData(old)).toEqual([]);
  }
});

import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import type { Architecture } from "./architecture.ts";
import {
  type ContractField,
  type ContractValue,
  contractCanonical,
} from "./architecture-contracts.ts";
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
import {
  backendDataRemovalFindings,
  backendEntityFields,
  validateBackendData,
} from "./backend-data.ts";
import { type BackendEntity, type BackendModel, backendModelSchema } from "./backend-model.ts";
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
const logical = (id: string, value: ContractValue, required = true): ContractField => ({
  id,
  name: id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
  required,
  description: "",
  ...value,
});
const int: ContractValue = { type: "integer", minimum: 0, maximum: 1000000 };
const backend = (d: DesignDocument) => need(need(d.architecture).backend);
const architecture = (d: DesignDocument) => need(d.architecture);
const root = (d: DesignDocument) => need(backend(d).entities[0]);
const child = (d: DesignDocument) => need(backend(d).entities[1]);
const aggregate = (d: DesignDocument) => need(backend(d).aggregates[0]);
const contract = (d: DesignDocument, index = 0) => need(architecture(d).contracts?.[index]);
const errors = (d: DesignDocument) => validateDesign(d, testLookup).filter(isStructural);
function save(before: DesignDocument, after: DesignDocument) {
  return applyOperations(
    before,
    [{ op: "setArchitecture", architecture: after.architecture ?? null }],
    testLookup,
  );
}
function fixture(domain: "discussion" | "inventory" | "helpdesk" = "discussion"): DesignDocument {
  const [parent, dependent] =
    domain === "discussion"
      ? ["topic", "first-post"]
      : domain === "inventory"
        ? ["stock", "reservation"]
        : ["ticket", "article"];
  const data = [parent, dependent].map((id, index) => {
    const payload = [
      logical("id", { type: "uuid" }),
      logical("scope", { type: "uuid" }),
      logical("revision", int),
      logical("author", { type: "uuid" }),
      logical("created", { type: "timestamp" }),
      ...(index ? [logical("parent", { type: "uuid" })] : []),
      logical("quantity", { type: "ref", ref: ref("count") }),
      logical("text", { type: "text", maxLength: 20000, nullable: true }, false),
    ];
    return {
      id: `${id}-data`,
      version: "v1",
      name: `${id} data`,
      kind: "data",
      coverage: "Complete",
      shape: {
        payload,
        operations: [],
        types: [{ id: "count", version: "v1", name: "Bounded quantity", value: int }],
      },
    };
  });
  const entities: BackendEntity[] = data.map((c, index) => ({
    id: `${index ? dependent : parent}-entity`,
    version: "v1",
    name: index ? dependent : parent,
    dataset: `${index ? dependent : parent}-dataset`,
    contract: ref(c.id),
    storageId: `${index ? dependent : parent}-table`,
    fields: c.shape.payload.map((f) => ({
      field: f.id,
      storageId: `${f.id}-column`,
      required: f.required,
      nullable: !!f.nullable,
      storage: { kind: "scalar" },
      ...(f.id === "id"
        ? { serverOwned: "id" as const }
        : f.id === "scope"
          ? { serverOwned: "scope" as const }
          : f.id === "revision"
            ? { serverOwned: "version" as const }
            : f.id === "created"
              ? { serverOwned: "clock" as const }
              : f.id === "author"
                ? { serverOwned: "principal" as const }
                : {}),
    })),
    primaryKey: ["scope", "id"],
    scope: { kind: "field", field: "scope" },
    relations: index
      ? [
          {
            id: "parent-link",
            target: ref(`${parent}-entity`),
            fields: [
              { source: "scope", target: "scope" },
              { source: "parent", target: "id" },
            ],
            cardinality: "many-to-one",
            ownership: "owned",
            scope: "same-scope",
            onDelete: "cascade",
          },
        ]
      : [],
    uniqueKeys: [],
    indexes: [
      {
        id: "created-order",
        fields: [
          { field: "created", direction: "desc" },
          { field: "id", direction: "asc" },
        ],
      },
    ],
  }));
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      { id: "api", name: "API", planned: "application-api", template: null },
      { id: "store", name: "Authority", planned: "relational-store", template: null },
    ],
    architecture: {
      system: {
        name: "Synthetic aggregate",
        description: "Offline declaration fixture, no benchmark application/runtime.",
      },
      components: [
        {
          id: "domain",
          element: "api",
          name: "Domain responsibility",
          capability: "domain-module",
        },
      ],
      contracts: data,
      datasets: entities.map((e) => ({
        id: e.dataset,
        name: e.dataset,
        contract: e.contract,
        owners: [{ kind: "component", id: "domain" }],
        readers: [{ kind: "component", id: "domain" }],
        writers: [{ kind: "component", id: "domain" }],
        ownershipDecision: "",
        store: "store",
        tenant: "Resource scoped",
        deletion: "Retain",
        exportAccess: "Authorized staff",
        retentionDays: 30,
      })),
      backend: {
        schemaVersion: 1,
        entities,
        aggregates: [
          {
            id: `${parent}-aggregate`,
            version: "v1",
            name: `${parent} and ${dependent}`,
            root: ref(need(entities[0]).id),
            children: [ref(need(entities[1]).id)],
            owner: { kind: "component", id: "domain" },
            store: "store",
            concurrency:
              domain === "inventory"
                ? {
                    kind: "row-lock",
                    entities: entities
                      .map((e) => ref(e.id))
                      .sort((a, b) => a.id.localeCompare(b.id)),
                    order: "entity-id-primary-key",
                  }
                : {
                    kind: "optimistic",
                    version: { entity: ref(need(entities[0]).id), field: "revision" },
                  },
            invariants:
              domain === "inventory"
                ? [
                    {
                      id: "no-oversell",
                      strategy: "inventory-balance",
                      stock: { entity: ref(need(entities[0]).id), field: "quantity" },
                      reserved: { entity: ref(need(entities[1]).id), field: "quantity" },
                      relation: "parent-link",
                    },
                  ]
                : [
                    {
                      id: "initial-content",
                      strategy: "required-child",
                      child: ref(need(entities[1]).id),
                      relation: "parent-link",
                      minimum: 1,
                      maximum: 1000,
                    },
                  ],
          },
        ],
      },
    },
  });
}
it.each(["discussion", "inventory", "helpdesk"] as const)(
  "models the %s root/child boundary with exact authority and no implementation claim",
  (domain) => {
    const d = fixture(domain);
    expect(errors(d)).toEqual([]);
    expect(backendEntityFields(d, root(d)).find((f) => f.id === "quantity")).toMatchObject(int);
    expect(validateBackendData(d)).toContainEqual(
      expect.objectContaining({
        code: "NEEDS_TEMPLATE",
        target: { path: ["architecture", "backend"] },
      }),
    );
    expect(blocksGenerate(validateBackendData(d))).toBe(true);
    const empty = structuredClone(d);
    delete architecture(empty).backend;
    expect(save(empty, d).ok).toBe(true);
  },
);

it("rejects conflicting stores, authorities, dataset contracts and duplicate persistence without mutating a batch", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      d.elements.push({ ...need(d.elements[1]), id: "other-store" });
      need(architecture(d).datasets?.[1]).store = "other-store";
    },
    (d) => {
      aggregate(d).store = "missing";
    },
    (d) => {
      d.elements.push({ ...need(d.elements[0]), id: "other-api" });
      need(architecture(d).datasets?.[1]).owners = [{ kind: "element", id: "other-api" }];
    },
    (d) => {
      need(architecture(d).datasets?.[0]).owners.push({ kind: "element", id: "api" });
    },
    (d) => {
      root(d).contract.version = "v99";
    },
    (d) => {
      root(d).contract = child(d).contract;
    },
    (d) => {
      child(d).dataset = root(d).dataset;
    },
    (d) => {
      child(d).storageId = root(d).storageId;
    },
    (d) => {
      need(architecture(d).datasets?.[0]).store = "api";
    },
    (d) => {
      backend(d).entities.push(structuredClone(root(d)));
    },
    (d) => {
      root(d).id = "api";
    },
    (d) => {
      backend(d).aggregates.push({ ...aggregate(d), id: "second-boundary" });
    },
    (d) => {
      aggregate(d).owner = { kind: "element", id: "store" };
    },
  ];
  for (const mutate of mutations) {
    const base = fixture(),
      candidate = structuredClone(base);
    mutate(candidate);
    const snapshot = structuredClone(base),
      result = save(base, candidate);
    expect(result.ok, contractCanonical(candidate.architecture?.backend)).toBe(false);
    expect(base).toEqual(snapshot);
    expect(errors(candidate).length).toBeGreaterThan(0);
  }
});

it("checks stable field annotations, keys, optional/null semantics and server authority", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      need(root(d).fields[0]).field = "missing";
    },
    (d) => {
      root(d).fields.push({ ...need(root(d).fields[0]) });
    },
    (d) => {
      root(d).fields.pop();
    },
    (d) => {
      need(root(d).fields[1]).storageId = need(root(d).fields[0]).storageId;
    },
    (d) => {
      need(root(d).fields.find((f) => f.field === "text")).nullable = false;
    },
    (d) => {
      need(root(d).fields.find((f) => f.field === "text")).required = true;
    },
    (d) => {
      root(d).primaryKey.push("missing");
    },
    (d) => {
      root(d).primaryKey.push("id");
    },
    (d) => {
      root(d).primaryKey = ["text"];
    },
    (d) => {
      root(d).uniqueKeys = [
        { id: "text-key", fields: ["text"], scope: "global", nulls: "forbidden" },
      ];
    },
    (d) => {
      root(d).indexes.push({ id: "bad", fields: [{ field: "missing", direction: "asc" }] });
    },
    (d) => {
      need(root(d).fields.find((f) => f.field === "author")).serverOwned = "clock";
    },
    (d) => {
      need(root(d).fields.find((f) => f.field === "quantity")).serverOwned = "id";
    },
    (d) => {
      delete need(root(d).fields.find((f) => f.field === "scope")).serverOwned;
    },
    (d) => {
      root(d).scope = { kind: "global" };
      need(architecture(d).datasets?.[0]).tenant = "Tenant scoped";
    },
    (d) => {
      need(architecture(d).datasets?.[0]).tenant = "Public";
    },
  ];
  for (const mutate of mutations) {
    const base = fixture(),
      d = structuredClone(base);
    mutate(d);
    expect(save(base, d).ok).toBe(false);
  }
  const valid = fixture();
  root(valid).uniqueKeys = [
    { id: "text-key", fields: ["text"], scope: "entity-scope", nulls: "distinct" },
  ];
  expect(errors(valid)).toEqual([]);
});

it("enforces relation type, scope, ownership, cardinality and deletion constraints", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      need(child(d).relations[0]).target.version = "old";
    },
    (d) => {
      need(child(d).relations[0]).fields = [{ source: "parent", target: "id" }];
    },
    (d) => {
      need(need(child(d).relations[0]).fields[1]).target = "quantity";
    },
    (d) => {
      need(need(child(d).relations[0]).fields[1]).source = "quantity";
    },
    (d) => {
      need(child(d).relations[0]).onDelete = "set-null";
    },
    (d) => {
      need(child(d).relations[0]).ownership = "reference";
    },
    (d) => {
      need(child(d).relations[0]).scope = "global-target";
    },
    (d) => {
      need(child(d).relations[0]).cardinality = "one-to-one";
    },
    (d) => {
      child(d).relations = [];
    },
  ];
  for (const mutate of mutations) {
    const base = fixture(),
      d = structuredClone(base);
    mutate(d);
    expect(save(base, d).ok).toBe(false);
  }
  const valid = fixture();
  child(valid).uniqueKeys = [
    { id: "one-parent", fields: ["parent"], scope: "entity-scope", nulls: "forbidden" },
  ];
  need(child(valid).relations[0]).cardinality = "one-to-one";
  expect(errors(valid)).toEqual([]);
});

it("validates optimistic revisions, stable complete row locks and finite invariants", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      aggregate(d).concurrency = {
        kind: "optimistic",
        version: { entity: ref(child(d).id), field: "revision" },
      };
    },
    (d) => {
      aggregate(d).concurrency = {
        kind: "optimistic",
        version: { entity: ref(root(d).id), field: "quantity" },
      };
    },
    (d) => {
      aggregate(d).concurrency = {
        kind: "row-lock",
        entities: [ref(root(d).id)],
        order: "entity-id-primary-key",
      };
    },
    (d) => {
      aggregate(d).concurrency = {
        kind: "row-lock",
        entities: [ref(root(d).id), ref(child(d).id)],
        order: "entity-id-primary-key",
      };
    },
    (d) => {
      aggregate(d).invariants = [
        {
          id: "initial",
          strategy: "required-child",
          child: ref(child(d).id),
          relation: "missing",
          minimum: 1,
          maximum: 1,
        },
      ];
    },
    (d) => {
      aggregate(d).invariants = [
        {
          id: "initial",
          strategy: "required-child",
          child: ref(root(d).id),
          relation: "parent-link",
          minimum: 2,
          maximum: 1,
        },
      ];
    },
    (d) => {
      aggregate(d).invariants = [
        { id: "count", strategy: "nonnegative", value: { entity: ref(root(d).id), field: "text" } },
      ];
    },
    (d) => {
      aggregate(d).invariants = [
        {
          id: "compare",
          strategy: "field-comparison",
          left: { entity: ref(root(d).id), field: "quantity" },
          operator: "lte",
          right: { entity: ref(child(d).id), field: "id" },
        },
      ];
    },
    (d) => {
      aggregate(d).invariants = [
        {
          id: "inventory",
          strategy: "inventory-balance",
          stock: { entity: ref(root(d).id), field: "quantity" },
          reserved: { entity: ref(child(d).id, "missing"), field: "quantity" },
          relation: "parent-link",
        },
      ];
    },
  ];
  for (const mutate of mutations) {
    const base = fixture(),
      d = structuredClone(base);
    mutate(d);
    expect(save(base, d).ok).toBe(false);
  }
  const valid = fixture();
  aggregate(valid).invariants.push(
    {
      id: "positive",
      strategy: "nonnegative",
      value: { entity: ref(root(valid).id), field: "quantity" },
    },
    {
      id: "compare",
      strategy: "field-comparison",
      left: { entity: ref(root(valid).id), field: "quantity" },
      operator: "gte",
      right: { entity: ref(child(valid).id), field: "quantity" },
    },
  );
  expect(errors(valid)).toEqual([]);
});

it("keeps bounded JSON explicit and exact money in integer minor units, resolving reused contract types", () => {
  const d = fixture();
  const c = contract(d),
    payload = need(c.shape).payload;
  const money = logical("price", {
    type: "object",
    fields: [
      logical("amount", { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
      logical("currency", { type: "text", enumValues: ["USD"] }),
    ],
  });
  payload.push(
    money,
    logical("metadata", {
      type: "map",
      keys: { maxLength: 32 },
      maxEntries: 10,
      values: { type: "text", maxLength: 120 },
    }),
  );
  root(d).fields.push(
    {
      field: "price",
      storageId: "price-minor",
      required: true,
      nullable: false,
      storage: {
        kind: "money",
        minorUnits: "amount",
        currency: "currency",
        currencyStorageId: "price-currency",
      },
    },
    {
      field: "metadata",
      storageId: "metadata-column",
      required: true,
      nullable: false,
      storage: { kind: "json", query: "opaque" },
    },
  );
  expect(errors(d)).toEqual([]);
  for (const mutate of [
    (x: DesignDocument) => {
      need(root(x).fields.find((f) => f.field === "metadata")).storage = { kind: "scalar" };
    },
    (x: DesignDocument) => {
      need(need(contract(x).shape).payload.find((f) => f.id === "metadata")).maxEntries = undefined;
    },
    (x: DesignDocument) => {
      need(
        need(need(need(contract(x).shape).payload.find((f) => f.id === "price")).fields)[0],
      ).type = "number";
    },
    (x: DesignDocument) => {
      need(
        need(need(need(contract(x).shape).payload.find((f) => f.id === "price")).fields)[1],
      ).enumValues = ["US"];
    },
    (x: DesignDocument) => {
      const currency = need(
        need(need(need(contract(x).shape).payload.find((f) => f.id === "price")).fields)[1],
      );
      delete currency.enumValues;
      currency.minLength = 3;
      currency.maxLength = 3;
    },
  ]) {
    const bad = structuredClone(d);
    mutate(bad);
    expect(
      validateBackendData(bad).some(
        (f) => f.code === "CONFIG_INVALID" || f.code === "CONFIG_REQUIRED",
      ),
    ).toBe(true);
  }
});

it("saves unresolved logical storage as an explicit readiness gap and rejects unsupported schema vocabulary/bounds", () => {
  const d = fixture();
  need(need(contract(d).shape).payload.find((f) => f.id === "text")).type = "unresolved";
  need(need(contract(d).shape).payload.find((f) => f.id === "text")).maxLength = undefined;
  expect(errors(d)).toEqual([]);
  expect(validateBackendData(d).some((f) => f.code === "CONFIG_REQUIRED")).toBe(true);
  const before = structuredClone(d);
  delete architecture(before).backend;
  expect(save(before, d).ok).toBe(true);
  for (const value of [
    { ...backend(d), schemaVersion: 2 },
    { ...backend(d), queries: [{ sql: "SELECT *" }] },
    { ...backend(d), entities: Array.from({ length: 101 }, () => root(d)) },
  ])
    expect(backendModelSchema.safeParse(value).success).toBe(false);
  expect(backendModelSchema.safeParse({ schemaVersion: 1 }).success).toBe(true);
});

it("protects exact data contracts even while consumers migrate/remove in the same batch; display renames retain storage IDs", () => {
  const before = fixture();
  const renamed = structuredClone(before);
  root(renamed).name = "Conversations";
  aggregate(renamed).name = "Conversation aggregate";
  need(architecture(renamed).datasets?.[0]).name = "Conversation authority";
  contract(renamed).name = "Conversation data";
  expect(save(before, renamed).ok).toBe(true);
  expect(root(renamed).storageId).toBe(root(before).storageId);
  expect(root(renamed).fields).toEqual(root(before).fields);
  for (const mutate of [
    (d: DesignDocument) => {
      root(d).storageId = "renamed-table";
    },
    (d: DesignDocument) => {
      need(root(d).fields[0]).storageId = "renamed-column";
    },
    (d: DesignDocument) => {
      need(contract(d).shape).payload.pop();
      delete architecture(d).backend;
      architecture(d).datasets = [];
    },
    (d: DesignDocument) => {
      architecture(d).contracts = [];
      architecture(d).datasets = [];
      delete architecture(d).backend;
    },
  ]) {
    const bad = structuredClone(before);
    mutate(bad);
    expect(save(before, bad).ok).toBe(false);
  }
  const successor = structuredClone(before),
    c = structuredClone(contract(before));
  c.version = "v2";
  need(architecture(successor).contracts).push(c);
  root(successor).contract.version = "v2";
  need(architecture(successor).datasets?.[0]).contract.version = "v2";
  expect(save(before, successor).ok).toBe(true);
});

it("reports missing references at their declaration and prevents deletion through ordinary operations", () => {
  const before = fixture();
  for (const op of [
    { op: "removeElement" as const, id: "store" },
    { op: "removeElement" as const, id: "api" },
  ])
    expect(applyOperations(before, [op], testLookup).ok).toBe(false);
  const missing = structuredClone(before);
  architecture(missing).datasets = [];
  expect(backendDataRemovalFindings(missing)).toContainEqual(
    expect.objectContaining({
      code: "UNKNOWN_REFERENCE",
      target: { path: ["architecture", "backend", "entities", "topic-entity@v1", "dataset"] },
    }),
  );
  const gone = structuredClone(before);
  backend(gone).entities.pop();
  expect(save(before, gone).ok).toBe(false);
});

it("round trips complete extraction, outer remapping, insertion, target diffs, chat schemas and deterministic portable handoff", async () => {
  const source = fixture("inventory");
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api", "store"] },
    {
      id: "aggregate-template",
      version: "1.0.0",
      name: "Aggregate",
      purpose: "Portable data boundary",
    },
    testLookup,
  );
  expect(need(fragment.architecture.backend).entities).toHaveLength(2);
  const local = need(fragment.architecture.backend);
  expect(local.entities.map((e) => e.storageId)).toEqual(
    backend(source).entities.map((e) => e.storageId),
  );
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `mapped-${id}`]));
  ids.scope = "wrong-scope";
  ids.quantity = "wrong-quantity";
  ids[need(local.entities[0]).storageId] = "wrong-table";
  const mapped = need(mappedArchitecture(fragment, ids).backend);
  expect(need(mapped.entities[0]).fields).toEqual(need(local.entities[0]).fields);
  expect(need(mapped.entities[0]).storageId).toBe(need(local.entities[0]).storageId);
  expect(need(mapped.aggregates[0]).invariants).toEqual(
    need(local.aggregates[0]).invariants.map((i) =>
      i.strategy === "inventory-balance"
        ? {
            ...i,
            stock: { ...i.stock, entity: { ...i.stock.entity, id: ids[i.stock.entity.id] } },
            reserved: {
              ...i.reserved,
              entity: { ...i.reserved.entity, id: ids[i.reserved.entity.id] },
            },
          }
        : i,
    ),
  );
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
      baseRevision: 0,
      name: "Copy",
    },
    testLookup,
  );
  expect(preview.errors).toEqual([]);
  expect(preview.ok).toBe(true);
  const applied = applyOperations(empty, preview.ops, testLookup);
  expect(applied.ok).toBe(true);
  if (!applied.ok) return;
  expect(errors(applied.design)).toEqual([]);
  expect(backend(applied.design).entities).toHaveLength(2);
  const pinned = need(architecture(applied.design).patternInstances?.[0]);
  const reuse = previewArchitectureTemplate(
    applied.design,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "reuse",
      baseRevision: applied.design.revision,
      name: "Reuse",
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
  expect(reuse.ok).toBe(true);
  const reused = applyOperations(applied.design, reuse.ops, testLookup);
  expect(reused.ok).toBe(true);
  if (reused.ok) expect(backend(reused.design)).toEqual(backend(applied.design));
  const handoff = await buildArchitectureHandoff({
    design: applied.design,
    project: { id: "data", name: "Data" },
    lookup: testLookup,
  });
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(backend(applied.design));
  expect(handoffMarkdown(handoff)).toContain("Backend data and consistency intent");
  expect(
    handoffJson(
      await buildArchitectureHandoff({
        design: applied.design,
        project: { id: "data", name: "Data" },
        lookup: testLookup,
      }),
    ),
  ).toBe(handoffJson(handoff));
  const changed = structuredClone(applied.design);
  need(backend(changed).aggregates[0]).invariants = [];
  expect(
    targetChanges(applied.design, changed).some(
      (c) => c.path.startsWith("architecture/backend/aggregates/") && c.path.endsWith("@v1"),
    ),
  ).toBe(true);
  expect(await handoffFingerprint(changed, { id: "data", name: "Data" })).not.toBe(
    await handoffFingerprint(applied.design, { id: "data", name: "Data" }),
  );
  expect(JSON.stringify(operationBatchJsonSchema())).toContain('"backend"');
  expect(JSON.stringify(operationBatchJsonSchema())).toContain('"inventory-balance"');
});

it("invalidates dataset review fingerprints when a referenced consistency rule changes", () => {
  const before = fixture(),
    after = structuredClone(before);
  const current = reviewArchitecture(before).findings.find(
    (f) => f.code === "BACKEND_STRATEGY_UNIMPLEMENTED",
  );
  expect(current).toBeDefined();
  const invariant = need(aggregate(after).invariants[0]);
  if (invariant.strategy === "required-child") invariant.maximum = 999;
  const changed = reviewArchitecture(after).findings.find(
    (f) => f.code === "BACKEND_STRATEGY_UNIMPLEMENTED",
  );
  expect(changed?.id).toBe(current?.id);
  expect(changed?.fingerprint).not.toBe(current?.fingerprint);
});

it("preserves legacy saved designs byte for byte and never adds backend declarations during upgrade", () => {
  for (const file of ["link-shortener.json", "qrwty.json"]) {
    // Historical fixture IDs/shapes remain owned by their existing resource descriptors.
    const raw = JSON.parse(
      readFileSync(new URL(`../../../fixtures/designs/${file}`, import.meta.url), "utf8"),
    );
    const parsed = designSchema.parse(raw);
    expect(parsed.architecture?.backend).toBeUndefined();
  }
  const old: Architecture = {
    system: { name: "Old", description: "" },
    nodes: [],
    relationships: [],
  };
  expect(old).not.toHaveProperty("backend");
  const empty: BackendModel = { schemaVersion: 1, entities: [], aggregates: [] };
  expect(
    validateBackendData(
      designSchema.parse({
        schemaVersion: 2,
        revision: 0,
        architecture: { ...old, backend: empty },
      }),
    ),
  ).toEqual([]);
});

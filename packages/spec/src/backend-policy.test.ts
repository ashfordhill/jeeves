import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { contractKey } from "./architecture-contracts.ts";
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
import { backendDataRemovalFindings } from "./backend-data.ts";
import { backendModelSchema, mapBackendModel } from "./backend-model.ts";
import { backendPolicyIntentConflicts, validateBackendPolicies } from "./backend-policy.ts";
import {
  type BackendAccessPolicy,
  backendAccessPolicySchema,
  backendRecheckSiteSchema,
} from "./backend-policy-model.ts";
import { validateBackendQueries } from "./backend-queries.ts";
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
const model = (d: DesignDocument) => need(d.architecture?.backend);
const policy = (d: DesignDocument, i = 0) => need(model(d).accessPolicies?.[i]);
const query = (d: DesignDocument) => need(model(d).queries?.[0]);
const binding = (d: DesignDocument, i = 0) => need(model(d).accessBindings?.[i]);
const when = (...clauses: string[]) => ({ operator: "all" as const, clauses });
const errors = (d: DesignDocument) => validateDesign(d, testLookup).filter(isStructural);
function save(before: DesignDocument, after: DesignDocument) {
  return applyOperations(
    before,
    [{ op: "setArchitecture", architecture: after.architecture ?? null }],
    testLookup,
  );
}
function fixture(): DesignDocument {
  const definitions = ["article", "group", "membership", "roles"].map((id) => {
    const values = [
      { id: "id", type: "uuid" },
      { id: "scope", type: "uuid" },
      ...(id === "article"
        ? [
            { id: "author", type: "uuid" },
            { id: "group", type: "uuid" },
            { id: "internal", type: "boolean" },
            { id: "body", type: "text", maxLength: 16000 },
          ]
        : []),
      ...(id === "membership"
        ? [
            { id: "principal", type: "uuid" },
            { id: "group", type: "uuid" },
            { id: "active", type: "boolean" },
          ]
        : []),
      ...(id === "roles"
        ? [
            { id: "principal", type: "uuid" },
            {
              id: "role",
              type: "text",
              enumValues: ["agent", "shop-admin", "customer", "suspended"],
            },
          ]
        : []),
    ];
    return {
      id: `${id}-data`,
      version: "v1",
      name: id,
      kind: "data",
      coverage: "Complete",
      shape: { operations: [], payload: values.map((f) => ({ ...f, name: f.id, required: true })) },
    };
  });
  const groupRelation = {
    id: "group-link",
    target: ref("group-entity"),
    fields: [
      { source: "scope", target: "scope" },
      { source: "group", target: "id" },
    ],
    cardinality: "many-to-one",
    ownership: "reference",
    scope: "same-scope",
    onDelete: "restrict",
  };
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      { id: "api", name: "API", template: null, planned: "application-api" },
      { id: "store", name: "Authority", template: null, planned: "relational-store" },
    ],
    architecture: {
      system: {
        name: "Synthetic access semantics",
        description: "No runtime or benchmark application",
      },
      components: ["content", "consumer"].map((id) => ({
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
          id: "request",
          from: "consumer",
          to: "content",
          description: "Reads articles",
          protocol: "In process",
          interaction: "Request / response",
        },
      ],
      contracts: [
        ...definitions,
        {
          id: "article-api",
          version: "v1",
          name: "Article API",
          kind: "api",
          coverage: "Complete",
          shape: {
            operations: [
              {
                id: "read",
                name: "Read article",
                input: [],
                output: [
                  { id: "body", name: "body", type: "text", maxLength: 16000, required: true },
                ],
              },
            ],
            payload: [],
          },
        },
      ],
      interfaces: ["provided", "required"].map((direction) => ({
        id: direction,
        name: direction,
        owner: { kind: "component", id: direction === "provided" ? "content" : "consumer" },
        direction,
        contract: ref("article-api"),
        necessity: "required",
      })),
      bindings: [
        {
          id: "article-request",
          name: "Read article intent",
          relationship: { kind: "component-relationship", id: "request" },
          provided: "provided",
          required: "required",
          contract: ref("article-api"),
          operation: "read",
          role: "request",
          businessSynchrony: "Synchronous",
          policies: { access: { identity: "User", tenant: "Tenant scoped", network: "Private" } },
        },
      ],
      datasets: definitions.map((c) => ({
        id: `${c.name}-dataset`,
        name: c.name,
        contract: ref(c.id),
        owners: [{ kind: "element", id: "api" }],
        readers: [],
        writers: [],
        ownershipDecision: "",
        store: "store",
        tenant: "Tenant scoped",
        deletion: "Retain",
        exportAccess: "Authorized staff",
      })),
      backend: {
        schemaVersion: 1,
        entities: definitions.map((c) => ({
          id: `${c.name}-entity`,
          version: "v1",
          name: c.name,
          dataset: `${c.name}-dataset`,
          contract: ref(c.id),
          storageId: `${c.name}-table`,
          fields: c.shape.payload.map((f) => ({
            field: f.id,
            storageId: `${f.id}-column`,
            required: true,
            nullable: false,
            storage: { kind: "scalar" },
            ...(f.id === "scope"
              ? { serverOwned: "scope" }
              : f.id === "author"
                ? { serverOwned: "principal" }
                : {}),
          })),
          primaryKey: ["scope", "id"],
          scope: { kind: "field", field: "scope" },
          relations: ["article", "membership"].includes(c.name) ? [groupRelation] : [],
        })),
        queries: [
          {
            id: "articles",
            version: "v1",
            name: "Article list",
            root: ref("article-entity"),
            filters: [],
            projection: ["id", "body"].map((id) => ({ id, field: { source: "root", field: id } })),
            order: ["scope", "id"].map((field) => ({
              field: { source: "root", field },
              direction: "asc",
            })),
            cursor: {
              kind: "keyset",
              fields: ["scope", "id"].map((field) => ({ source: "root", field })),
            },
            limit: { maximum: 100 },
            accessPolicy: { kind: "policy", reference: ref("private-article") },
            accessProjection: "article-read",
            freshness: { kind: "authoritative" },
          },
        ],
        accessPolicies: [
          {
            id: "private-article",
            version: "v1",
            name: "Private article/category/group",
            resource: ref("article-entity"),
            context: {
              identity: "session-principal",
              authentication: "server-established",
              scope: "authorized-scope",
              correlation: "server-established",
            },
            default: "deny",
            conflict: "deny-wins",
            clauses: [
              { id: "authenticated", kind: "authenticated" },
              {
                id: "member",
                kind: "membership",
                scope: "group",
                entity: ref("membership-entity"),
                principal: "principal",
                relation: "group-link",
                via: "group-link",
                active: { field: "active", value: true },
              },
              {
                id: "agent",
                kind: "role",
                authority: "persisted-role-store",
                entity: ref("roles-entity"),
                principal: "principal",
                field: "role",
                values: ["agent"],
              },
              {
                id: "suspended",
                kind: "role",
                authority: "persisted-role-store",
                entity: ref("roles-entity"),
                principal: "principal",
                field: "role",
                values: ["suspended"],
              },
            ],
            rules: [
              {
                id: "agents",
                effect: "allow",
                actions: [
                  "read",
                  "list",
                  "search",
                  "bytes",
                  "materialization",
                  "delivery",
                  "export",
                  "idempotent-replay",
                ],
                when: when("authenticated", "member", "agent"),
              },
              {
                id: "deny-suspended",
                effect: "deny",
                actions: [
                  "read",
                  "list",
                  "search",
                  "bytes",
                  "materialization",
                  "delivery",
                  "export",
                  "idempotent-replay",
                ],
                when: when("suspended"),
              },
            ],
            projections: [
              {
                id: "article-read",
                mode: "read",
                fields: ["scope", "id", "body", "internal", "group", "author"],
                when: when("authenticated", "member", "agent"),
                unknownFields: "reject",
              },
            ],
            revocation: {
              strategy: "current-state",
              cache: "none",
              recheck: backendRecheckSiteSchema.options,
            },
          },
        ],
        accessBindings: [
          {
            id: "article-read-binding",
            version: "v1",
            name: "Read article access",
            target: {
              kind: "operation",
              contract: ref("article-api"),
              operation: "read",
              owner: { kind: "component", id: "content" },
            },
            resource: ref("article-entity"),
            policy: { kind: "policy", reference: ref("private-article") },
            action: "read",
            site: "read",
            projection: "article-read",
            relationshipBinding: "article-request",
          },
          ...["search", "bytes", "materialization", "delivery", "export", "idempotent-replay"].map(
            (site) => ({
              id: `${site}-access`,
              version: "v1",
              name: `${site} access`,
              target: { kind: "projection", entity: ref("article-entity"), fields: ["body", "id"] },
              resource: ref("article-entity"),
              policy: { kind: "policy", reference: ref("private-article") },
              action: site,
              site,
              projection: "article-read",
            }),
          ),
        ],
      },
    },
  });
}

it("represents private category/group membership and internal agent articles with default deny and explicit deny precedence", () => {
  const d = fixture();
  expect(errors(d)).toEqual([]);
  expect(validateBackendPolicies(d)).toEqual([]);
  expect(validateBackendQueries(d)).toEqual([]);
  expect(policy(d).rules[0]?.when).toEqual(when("authenticated", "member", "agent"));
  expect(policy(d).rules[1]?.effect).toBe("deny");
  expect(policy(d).conflict).toBe("deny-wins");
  expect(blocksGenerate(validateDesign(d, testLookup))).toBe(true);
  expect(backendPolicyIntentConflicts(d)).toEqual([]);
  const before = structuredClone(d);
  delete need(before.architecture).backend;
  expect(save(before, d).ok).toBe(true);
});

it("represents shop-admin and customer owner/visibility policies with independent write projections", () => {
  const d = fixture();
  const base = policy(d);
  const admin: BackendAccessPolicy = {
    ...structuredClone(base),
    id: "shop-admin",
    name: "Shop administrator",
    clauses: [
      {
        id: "admin",
        kind: "role",
        authority: "persisted-role-store",
        entity: ref("roles-entity"),
        principal: "principal",
        field: "role",
        values: ["shop-admin"],
      },
    ],
    rules: [{ id: "admin", effect: "allow", actions: ["write", "list"], when: when("admin") }],
    projections: [
      {
        id: "safe-write",
        mode: "write",
        fields: ["body", "internal"],
        when: when("admin"),
        unknownFields: "reject",
      },
    ],
  };
  const customer: BackendAccessPolicy = {
    ...structuredClone(base),
    id: "customer",
    name: "Customer",
    clauses: [
      { id: "owner", kind: "owner", field: "author" },
      { id: "public-article", kind: "visibility", field: "internal", value: false },
      { id: "read-action", kind: "action", actions: ["read", "list"] },
    ],
    rules: [
      {
        id: "own-public",
        effect: "allow",
        actions: ["read", "list"],
        when: when("owner", "public-article", "read-action"),
      },
    ],
    projections: [
      {
        id: "customer-read",
        mode: "read",
        fields: ["id", "body", "scope"],
        when: when("owner", "public-article"),
        unknownFields: "reject",
      },
    ],
  };
  model(d).accessPolicies?.push(admin, customer);
  model(d).accessBindings?.push({
    ...structuredClone(binding(d)),
    id: "admin-write",
    site: "write",
    action: "write",
    policy: { kind: "policy", reference: ref(admin.id) },
    projection: "safe-write",
    relationshipBinding: undefined,
  });
  query(d).accessPolicy = { kind: "policy", reference: ref(customer.id) };
  query(d).accessProjection = "customer-read";
  expect(validateBackendPolicies(d)).toEqual([]);
  expect(validateBackendQueries(d)).toEqual([]);
  expect(customer.clauses).toContainEqual({
    id: "public-article",
    kind: "visibility",
    field: "internal",
    value: false,
  });
  admin.projections[0]?.fields.push("scope");
  expect(validateBackendPolicies(d)).toContainEqual(
    expect.objectContaining({
      code: "CONFIG_INVALID",
      message: expect.stringContaining("server-owned"),
    }),
  );
});

it("requires explicit service purpose and bounded current scope with provenance-only actor", () => {
  const d = fixture();
  const service = structuredClone(policy(d));
  service.id = "notification-purpose";
  service.context.identity = "verified-service";
  service.context.service = {
    purpose: "notification-materializer",
    authority: "server-service-identity",
    scope: "authorized-scope",
    initiatingActor: "provenance-only",
  };
  service.clauses = [
    { id: "purpose", kind: "service-purpose", purpose: "notification-materializer" },
  ];
  service.rules = [{ id: "bounded-job", effect: "allow", actions: ["job"], when: when("purpose") }];
  service.projections = [{ ...need(service.projections[0]), when: when("purpose") }];
  model(d).accessPolicies?.push(service);
  model(d).accessBindings?.push({
    ...structuredClone(binding(d, 1)),
    id: "job-access",
    site: "job",
    action: "job",
    policy: { kind: "policy", reference: ref(service.id) },
  });
  expect(validateBackendPolicies(d)).toEqual([]);
  service.context.service.initiatingActor = "permanent-authority" as "provenance-only";
  expect(backendAccessPolicySchema.safeParse(service).success).toBe(false);
  service.context.service.initiatingActor = "provenance-only";
  delete service.context.service;
  expect(validateBackendPolicies(d).some((f) => isStructural(f))).toBe(true);
});

it("rejects body/header/queue role authority, recursive rules, unbounded policies and permissive defaults", () => {
  const p = policy(fixture());
  for (const candidate of [
    { ...p, default: "allow" },
    { ...p, conflict: "allow-wins" },
    { ...p, context: { ...p.context, authentication: "request-body" } },
    ...["request-body", "raw-header", "queue-payload", "client-role"].map((authority) => ({
      ...p,
      clauses: [
        {
          id: "role",
          kind: "role",
          authority,
          entity: ref("roles-entity"),
          principal: "principal",
          field: "role",
          values: ["agent"],
        },
      ],
    })),
    { ...p, clauses: [{ id: "expression", kind: "expression", sql: "role = admin" }] },
    {
      ...p,
      rules: [
        {
          id: "recursive",
          effect: "allow",
          actions: ["read"],
          when: { operator: "all", rules: ["recursive"] },
        },
      ],
    },
    { ...p, clauses: Array.from({ length: 21 }, () => p.clauses[0]) },
    { ...p, rules: Array.from({ length: 21 }, () => p.rules[0]) },
    {
      ...p,
      rules: [
        {
          ...p.rules[0],
          when: { operator: "all", clauses: Array.from({ length: 21 }, () => "authenticated") },
        },
      ],
    },
    { ...p, revocation: { ...p.revocation, cache: "forever" } },
  ])
    expect(backendAccessPolicySchema.safeParse(candidate).success).toBe(false);
  expect(
    backendModelSchema.safeParse({
      ...model(fixture()),
      accessPolicies: Array.from({ length: 161 }, () => p),
    }).success,
  ).toBe(false);
});

it("supports explicit public visibility, bounded disjunction and organization/resource membership without inferring roles", () => {
  const d = fixture();
  const publicPolicy = structuredClone(policy(d));
  publicPolicy.id = "explicit-public";
  publicPolicy.context.identity = "public";
  publicPolicy.clauses = [{ id: "public", kind: "visibility", field: "internal", value: false }];
  publicPolicy.rules = [
    {
      id: "public-read",
      effect: "allow",
      actions: ["read"],
      when: { operator: "any", clauses: ["public"] },
    },
  ];
  publicPolicy.projections = [{ ...need(publicPolicy.projections[0]), when: when("public") }];
  model(d).accessPolicies?.push(publicPolicy);
  expect(validateBackendPolicies(d)).toEqual([]);
  for (const scope of ["organization", "resource"] as const) {
    const member = need(policy(d).clauses.find((c) => c.kind === "membership"));
    if (member.kind === "membership") member.scope = scope;
    expect(validateBackendPolicies(d)).toEqual([]);
  }
  publicPolicy.clauses = [{ id: "public", kind: "visibility", field: "body", value: "public" }];
  expect(
    validateBackendPolicies(d).some(
      (f) => f.code === "CONFIG_INVALID" && f.message.includes("visibility"),
    ),
  ).toBe(true);
});

it("rejects stale entity/field/membership/scope/operation references atomically and previews removals", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      policy(d).resource.version = "stale";
    },
    (d) => {
      const c = need(policy(d).clauses.find((c) => c.kind === "membership"));
      if (c.kind === "membership") c.relation = "missing";
    },
    (d) => {
      const c = need(policy(d).clauses.find((c) => c.kind === "membership"));
      if (c.kind === "membership") c.via = "group-link.group-link";
    },
    (d) => {
      const c = need(policy(d).clauses.find((c) => c.kind === "membership"));
      if (c.kind === "membership") c.principal = "active";
    },
    (d) => {
      const c = need(policy(d).clauses.find((c) => c.kind === "membership"));
      if (c.kind === "membership") delete c.via;
    },
    (d) => {
      const c = need(policy(d).clauses.find((c) => c.kind === "role"));
      if (c.kind === "role") c.values = ["invented-admin"];
    },
    (d) => {
      policy(d).context.scope = "global";
    },
    (d) => {
      policy(d).context.identity = "public";
    },
    (d) => {
      need(policy(d).projections[0]).fields.push("missing");
    },
    (d) => {
      need(policy(d).rules[0]).when.clauses.push("missing");
    },
    (d) => {
      policy(d).clauses.push(need(policy(d).clauses[0]));
    },
    (d) => {
      binding(d).resource = ref("group-entity");
    },
    (d) => {
      const t = binding(d).target;
      if (t.kind === "operation") t.operation = "missing";
    },
    (d) => {
      const t = binding(d).target;
      if (t.kind === "operation") t.owner.id = "consumer";
    },
    (d) => {
      binding(d).projection = "missing";
    },
    (d) => {
      binding(d).projection = "article-read";
      binding(d).site = "write";
    },
    (d) => {
      binding(d).site = "job";
    },
    (d) => {
      binding(d).relationshipBinding = "missing";
    },
    (d) => {
      model(d).entities = model(d).entities.filter((e) => e.id !== "membership-entity");
    },
    (d) => {
      need(d.architecture).datasets = need(d.architecture).datasets?.map((v) =>
        v.id === "membership-dataset" ? { ...v, store: "other-store" } : v,
      );
    },
  ];
  for (const mutate of mutations) {
    const before = fixture();
    const candidate = structuredClone(before);
    // Isolate structural validation from exact-version immutability to catch malformed drafts too.
    mutate(candidate);
    expect(backendDataRemovalFindings(candidate).filter(isStructural).length).toBeGreaterThan(0);
    expect(save(before, candidate).ok).toBe(false);
    expect(before).toEqual(fixture());
  }
});

it("keeps unfinished selection/rules/projection/recheck drafts editable and reports actionable gaps", () => {
  const before = fixture();
  delete model(before).accessPolicies;
  delete model(before).accessBindings;
  query(before).accessPolicy = { kind: "unresolved", reference: ref("private-article") };
  delete query(before).accessProjection;
  const draft = structuredClone(before);
  const p = structuredClone(policy(fixture()));
  p.rules = [];
  p.projections = [];
  p.revocation.recheck = [];
  model(draft).accessPolicies = [p];
  query(draft).accessPolicy = { kind: "policy", reference: ref(p.id) };
  const result = save(before, draft);
  expect(result.ok).toBe(true);
  expect(errors(draft)).toEqual([]);
  expect(
    [...validateBackendPolicies(draft), ...validateBackendQueries(draft)].filter(
      (f) => f.code === "CONFIG_REQUIRED",
    ).length,
  ).toBeGreaterThanOrEqual(5);
  expect(
    reviewArchitecture(draft)
      .findings.filter((f) => f.code === "BACKEND_ACCESS_GAP")
      .some((f) => f.message.includes("read") && f.message.includes("projection")),
  ).toBe(true);
  query(draft).accessSite = "search";
  expect(validateBackendQueries(draft).some((f) => f.message.includes("search"))).toBe(true);
  const textOnly = structuredClone(before);
  query(textOnly).accessPolicy = { kind: "policy", reference: ref("description-only") };
  expect(save(before, textOnly).ok).toBe(false);
  expect(blocksGenerate(validateDesign(draft, testLookup))).toBe(true);
});

it("requires current revocation at each sensitive observation/effect/replay site", () => {
  const d = fixture();
  for (const site of [
    "read",
    "search",
    "bytes",
    "materialization",
    "delivery",
    "export",
    "idempotent-replay",
  ] as const) {
    const candidate = structuredClone(d);
    policy(candidate).revocation.recheck = policy(candidate).revocation.recheck.filter(
      (s) => s !== site,
    );
    expect(
      validateBackendPolicies(candidate).some(
        (f) => f.code === "CONFIG_REQUIRED" && f.message.includes(`${site} current-state`),
      ),
    ).toBe(true);
  }
  const excess = structuredClone(d);
  need(policy(excess).projections[0]).fields = ["id"];
  expect(
    validateBackendQueries(excess).some(
      (f) => f.code === "CONFIG_INVALID" && f.message.includes("exceed"),
    ),
  ).toBe(true);
  const detail = structuredClone(d);
  binding(detail).projection = undefined;
  expect(
    validateBackendPolicies(detail).some(
      (f) => f.code === "CONFIG_REQUIRED" && f.message.includes("detail/list/search"),
    ),
  ).toBe(true);
});

it("requires an independent policy for each joined query source and covers hidden filtering/count paths", () => {
  const d = fixture();
  query(d).joins = [{ id: "group", from: "root", relation: "group-link", kind: "left" }];
  expect(
    validateBackendQueries(d).some(
      (f) => f.code === "CONFIG_REQUIRED" && f.target.path?.includes("sourcePolicies"),
    ),
  ).toBe(true);
  const group = structuredClone(policy(d));
  group.id = "group-policy";
  group.resource = ref("group-entity");
  group.clauses = [
    {
      id: "member",
      kind: "membership",
      scope: "group",
      entity: ref("membership-entity"),
      principal: "principal",
      relation: "group-link",
      active: { field: "active", value: true },
    },
  ];
  group.rules = [{ id: "members", effect: "allow", actions: ["list"], when: when("member") }];
  group.projections = [
    {
      id: "group-read",
      mode: "read",
      fields: ["id", "scope"],
      when: when("member"),
      unknownFields: "reject",
    },
  ];
  model(d).accessPolicies?.push(group);
  query(d).sourcePolicies = [
    {
      source: "group",
      policy: { kind: "policy", reference: ref(group.id) },
      projection: "group-read",
    },
  ];
  expect(errors(d)).toEqual([]);
  expect(validateBackendQueries(d)).toEqual([]);
  const copied = mapBackendModel(model(d), { "group-policy": "copy-group-policy" });
  expect(copied.queries?.[0]?.sourcePolicies?.[0]?.policy.reference).toEqual(
    ref("copy-group-policy"),
  );
  query(d).sourcePolicies?.push(need(query(d).sourcePolicies?.[0]));
  expect(validateBackendQueries(d).filter(isStructural).length).toBeGreaterThan(0);
});

it("keeps relationship access intent and selected policy conflicts actionable with changing fingerprints", () => {
  const d = fixture();
  const access = need(need(d.architecture?.bindings?.[0]).policies?.access);
  access.identity = "Public";
  const review = reviewArchitecture(d);
  const conflict = need(review.findings.find((f) => f.code === "BACKEND_ACCESS_CONFLICT"));
  expect(conflict).toMatchObject({
    severity: "conflict",
    concern: "Access and authority",
    editor: "binding",
  });
  expect(conflict.message).toContain("article-request");
  expect(errors(d)).toEqual([]);
  const changed = structuredClone(d);
  policy(changed).revocation.recheck = ["read"];
  expect(
    reviewArchitecture(changed).findings.find((f) => f.id === conflict.id)?.fingerprint,
  ).not.toBe(conflict.fingerprint);
});

it("protects referenced exact policies across simultaneous consumer migration but permits explicit successor versions and display renames", () => {
  const before = fixture();
  const changed = structuredClone(before);
  policy(changed).rules = [];
  expect(save(before, changed).ok).toBe(false);
  model(changed).queries = [];
  model(changed).accessBindings = [];
  expect(save(before, changed).ok).toBe(false);
  const renamed = structuredClone(before);
  policy(renamed).name = "Renamed policy";
  expect(save(before, renamed).ok).toBe(true);
  const successor = structuredClone(before);
  const next = structuredClone(policy(before));
  next.version = "v2";
  next.name = "Successor";
  model(successor).accessPolicies?.push(next);
  query(successor).accessPolicy = { kind: "policy", reference: ref(next.id, "v2") };
  expect(save(before, successor).ok).toBe(true);
  const removed = structuredClone(before);
  model(removed).accessPolicies = [];
  model(removed).queries = [];
  model(removed).accessBindings = [];
  expect(save(before, removed).ok).toBe(false);
  const removedOperation = structuredClone(before);
  model(removedOperation).accessBindings = [];
  need(removedOperation.architecture).interfaces = [];
  need(removedOperation.architecture).bindings = [];
  need(removedOperation.architecture).contracts = need(
    removedOperation.architecture,
  ).contracts?.filter((c) => c.id !== "article-api");
  expect(save(before, removedOperation).ok).toBe(false);
});

it("preserves exact policies through extraction/copy/reuse, target diffs, schema export and deterministic handoff", async () => {
  const source = fixture();
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api", "store"] },
    {
      id: "finite-access",
      version: "1.0.0",
      name: "Finite access",
      purpose: "Portable policy intent",
    },
    testLookup,
  );
  expect(fragment.architecture.backend?.accessPolicies).toHaveLength(1);
  expect(fragment.architecture.backend?.accessBindings).toHaveLength(7);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `copy-${id}`]));
  for (const id of ["principal", "role", "agent", "group-link", "article-read", "scope", "read"])
    ids[id] = `wrong-${id}`;
  const mapped = need(mappedArchitecture(fragment, ids).backend);
  const p = need(mapped.accessPolicies?.[0]);
  expect(p.resource.id).toBe(
    `copy-${fragment.architecture.backend?.accessPolicies?.[0]?.resource.id}`,
  );
  expect(p.clauses).toEqual(
    need(fragment.architecture.backend?.accessPolicies?.[0]).clauses.map((c) =>
      "entity" in c ? { ...c, entity: { ...c.entity, id: `copy-${c.entity.id}` } } : c,
    ),
  );
  expect(p.projections).toEqual(policy(source).projections);
  expect(need(mapped.accessBindings?.[0]).projection).toBe("article-read");
  const entry: ArchitectureLibraryEntry = {
    id: fragment.id,
    version: fragment.version,
    fragment,
    metadata,
    state: "published",
    draftRevision: 1,
    contentHash: "b".repeat(64),
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
  const copied = applyOperations(empty, preview.ops, testLookup);
  expect(copied.ok).toBe(true);
  if (!copied.ok) return;
  expect(errors(copied.design)).toEqual([]);
  const pinned = need(copied.design.architecture?.patternInstances?.[0]);
  const reuse = previewArchitectureTemplate(
    copied.design,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "reuse",
      name: "Reuse",
      baseRevision: copied.design.revision,
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
  const reused = applyOperations(copied.design, reuse.ops, testLookup);
  expect(reused.ok).toBe(true);
  if (reused.ok) expect(model(reused.design)).toEqual(model(copied.design));
  const input = {
    design: copied.design,
    project: { id: "finite-access", name: "Finite access" },
    lookup: testLookup,
  };
  const handoff = await buildArchitectureHandoff(input);
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(model(copied.design));
  expect(handoffJson(await buildArchitectureHandoff(input))).toBe(handoffJson(handoff));
  expect(handoffMarkdown(handoff)).toContain("- Access policy ");
  expect(handoffMarkdown(handoff)).toContain("- Access binding ");
  const changed = structuredClone(copied.design);
  policy(changed).revocation.recheck = ["read"];
  expect(
    targetChanges(copied.design, changed).some((c) =>
      c.path.startsWith("architecture/backend/accessPolicies/"),
    ),
  ).toBe(true);
  expect(await handoffFingerprint(changed, input.project)).not.toBe(
    await handoffFingerprint(copied.design, input.project),
  );
  const schema = JSON.stringify(operationBatchJsonSchema());
  for (const word of [
    "persisted-role-store",
    "deny-wins",
    "provenance-only",
    "sourcePolicies",
    "idempotent-replay",
  ])
    expect(schema).toContain(word);
});

it("preserves legacy saved shapes and owner-resource authority without introducing policy defaults", () => {
  const empty = { schemaVersion: 1, entities: [], aggregates: [] };
  expect(backendModelSchema.parse(empty)).toEqual(empty);
  expect(mapBackendModel(backendModelSchema.parse(empty), {})).toEqual(empty);
  const legacy = designSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
    ),
  );
  expect(legacy.architecture?.backend).toBeUndefined();
  expect(validateBackendPolicies(legacy)).toEqual([]);
  expect(validateBackendQueries(legacy)).toEqual([]);
  expect(backendAccessPolicySchema.safeParse({ name: "Only a description" }).success).toBe(false);
  expect(contractKey(policy(fixture()))).toBe("private-article@v1");
});

import { blocksGenerate, type DesignDocument, isStructural, validateDesign } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import type { BackendDataPlan } from "./backend-ir.ts";
import { backendIdentity, backendName, lowerBackendData } from "./backend-plan.ts";
import {
  backendPlanFixture,
  backendPlanLookup,
  irModel,
  irRef,
  requiredIR,
} from "./backend-plan-fixture.ts";
import { templateSet } from "./modules.ts";
import { GenerationError, planProject } from "./plan.ts";
import { fixtureDesign } from "./test-support.ts";

const data = (plan: BackendDataPlan) => requiredIR(plan.ir);
const entity = (plan: BackendDataPlan, id = "post-entity") =>
  requiredIR(data(plan).entities.find((e) => e.reference.id === id));
const query = (d: DesignDocument) => requiredIR(irModel(d).queries?.[0]);
const codes = (plan: BackendDataPlan) => plan.diagnostics.map((d) => d.code);
function fixture() {
  const design = backendPlanFixture(),
    lookup = backendPlanLookup(design);
  return { design, lookup, plan: lowerBackendData(design, lookup) };
}

describe("P70a pure backend data IR", () => {
  it("lowers host/entity/aggregate/query/policy responsibilities with exact source identities", () => {
    const { design, lookup, plan } = fixture();
    expect(validateDesign(design, lookup).filter(isStructural)).toEqual([]);
    expect(plan.diagnostics).toEqual([]);
    expect(plan.support.fullReady).toBe(true);
    expect(plan).toMatchObject({ schemaVersion: 1, enabled: true, stage: "data" });
    expect(data(plan).hosts.map((h) => h.element)).toEqual(["api", "store"]);
    expect(entity(plan)).toMatchObject({
      reference: irRef("post-entity"),
      dataset: "post-dataset",
      contract: irRef("post-data"),
      host: backendIdentity("host", "api"),
      store: backendIdentity("host", "store"),
      storageId: "post-table",
      owner: { kind: "component", id: "domain" },
      primaryKey: ["id"],
      scope: { kind: "global" },
      source: {
        kind: "entities",
        id: "post-entity",
        version: "v1",
        path: ["architecture", "backend", "entities", "post-entity@v1"],
      },
    });
    expect(entity(plan).relations[0]).toMatchObject({
      relation: "topic-link",
      target: {
        reference: irRef("topic-entity"),
        entity: backendIdentity("entity", "topic-entity", "v1"),
      },
    });
    expect(data(plan).aggregates[0]).toMatchObject({
      root: { entity: backendIdentity("entity", "topic-entity", "v1") },
      children: [{ entity: backendIdentity("entity", "post-entity", "v1") }],
      concurrency: { kind: "row-lock", order: "entity-id-primary-key" },
      invariants: [{ id: "first-post", strategy: "required-child" }],
    });
    expect(data(plan).accessBindings[0]).toMatchObject({
      access: { policy: backendIdentity("policy", "post-policy", "v1"), projection: "visible" },
      intent: { site: "read", action: "read" },
    });
    expect(data(plan)).not.toHaveProperty("operationAdapters");
    expect(plan).not.toHaveProperty("files");
  });

  it("retains bounded scalar, nullable/optional, opaque JSON and exact money semantics", () => {
    const { plan } = fixture();
    const fields = entity(plan).fields;
    expect(fields.find((f) => f.field === "revision")).toMatchObject({
      serverOwned: "version",
      value: { type: "integer", minimum: 0, maximum: 1000000 },
    });
    expect(fields.find((f) => f.field === "title")).toMatchObject({
      required: false,
      nullable: true,
      value: { type: "text", maxLength: 400, nullable: true },
    });
    expect(fields.find((f) => f.field === "metadata")).toMatchObject({
      storage: { kind: "json", query: "opaque" },
      value: { type: "map", keys: { maxLength: 20 }, maxEntries: 4, values: { type: "boolean" } },
    });
    expect(fields.find((f) => f.field === "price")).toMatchObject({
      storage: {
        kind: "money",
        currencyStorageId: "currency-column",
        minorUnits: "amount",
        currency: "currency",
      },
      value: {
        type: "object",
        fields: [
          {
            id: "amount",
            required: true,
            value: { type: "integer", minimum: 0, maximum: 1000000 },
          },
          { id: "currency", required: true, value: { type: "text", enumValues: ["GBP", "USD"] } },
        ],
      },
    });
    expect(JSON.stringify(fields)).not.toContain('"description"');
    expect(entity(plan).uniqueKeys[0]).toMatchObject({
      fields: ["parent", "title"],
      scope: "global",
      nulls: "distinct",
    });
    expect(entity(plan).indexes[0]?.fields.map((f) => f.field)).toEqual(["revision", "id"]);
  });

  it("resolves joins and policy links without losing query bounds, freshness or security ordering", () => {
    const { plan } = fixture(),
      q = requiredIR(data(plan).queries[0]);
    expect(q.sources).toMatchObject([
      {
        alias: "root",
        nullable: false,
        access: { policy: backendIdentity("policy", "post-policy", "v1") },
      },
      {
        alias: "topic",
        nullable: true,
        join: { from: "root", relation: "topic-link", kind: "left" },
        access: { policy: backendIdentity("policy", "topic-policy", "v1") },
      },
    ]);
    expect(q).toMatchObject({
      limit: { default: 25, maximum: 100 },
      freshness: { kind: "authoritative" },
      accessSite: "read",
      accessBefore: ["filter", "pagination", "count", "projection"],
    });
    expect(q.order.map((o) => o.field.field)).toEqual(["revision", "id"]);
    expect(q.cursor.fields.map((f) => f.field)).toEqual(["revision", "id"]);
    const p = requiredIR(data(plan).policies[0]);
    expect(p).toMatchObject({
      default: "deny",
      conflict: "deny-wins",
      context: { authentication: "server-established", correlation: "server-established" },
      revocation: { cache: "none", strategy: "current-state" },
    });
    expect(p.rules[0]?.rule.when.clauses).toEqual(["read-action", "signed-in"]);
  });

  it("returns identical semantic IR and source maps after irrelevant collection permutations", () => {
    const { design, lookup, plan } = fixture();
    const changed = structuredClone(design),
      a = requiredIR(changed.architecture),
      b = irModel(changed);
    changed.elements.reverse();
    a.contracts?.reverse();
    a.datasets?.reverse();
    a.components?.reverse();
    b.entities.reverse();
    b.aggregates.reverse();
    b.queries?.reverse();
    b.accessPolicies?.reverse();
    b.accessBindings?.reverse();
    b.implementations?.reverse();
    for (const c of a.contracts ?? []) {
      c.shape?.payload.reverse();
      c.shape?.types?.reverse();
    }
    for (const e of b.entities) {
      e.fields.reverse();
      e.relations.reverse();
      e.uniqueKeys.reverse();
      e.indexes.reverse();
    }
    for (const p of b.accessPolicies ?? []) {
      p.clauses.reverse();
      p.rules.reverse();
      p.projections.reverse();
      p.revocation.recheck.reverse();
      for (const r of p.rules) {
        r.actions.reverse();
        r.when.clauses.reverse();
      }
      for (const v of p.projections) v.fields.reverse();
    }
    for (const q of b.queries ?? []) {
      q.filters.reverse();
      q.projection.reverse();
      q.sourcePolicies?.reverse();
      for (const f of q.filters) f.comparisons.reverse();
    }
    const reordered = lowerBackendData(changed, lookup);
    expect(reordered.diagnostics).toEqual([]);
    expect(JSON.stringify(reordered.ir)).toBe(JSON.stringify(plan.ir));
    expect(reordered.sourceMap).toEqual(plan.sourceMap);
    expect(reordered.sourceSnapshot).toEqual(changed);
  });

  it("preserves storage and compiler identities after presentation renames", () => {
    const { design, lookup, plan } = fixture();
    const changed = structuredClone(design);
    for (const e of changed.elements) e.name = `Renamed ${e.name}`;
    const a = requiredIR(changed.architecture);
    a.system.name = "Renamed system";
    for (const v of [
      ...(a.components ?? []),
      ...(a.datasets ?? []),
      ...(a.contracts ?? []),
      ...Object.values(irModel(changed)).flatMap((v): { name: string }[] =>
        Array.isArray(v) ? (v as { name: string }[]) : [],
      ),
    ])
      if ("name" in v) v.name = `Renamed ${v.name}`;
    for (const c of a.contracts ?? [])
      for (const f of c.shape?.payload ?? []) {
        f.name = `renamed${f.name}`;
        f.description = "Presentation only";
        for (const nested of f.fields ?? []) nested.name = `new${nested.name}`;
      }
    const renamed = lowerBackendData(changed, lookup);
    expect(renamed.diagnostics).toEqual([]);
    expect(renamed.ir).toEqual(plan.ir);
    expect(renamed.sourceMap).toEqual(plan.sourceMap);
    expect(renamed.sourceSnapshot.elements[0]?.name).toBe("Renamed Application");
  });

  it("maps every emitted responsibility once to a stable source path", () => {
    const { plan } = fixture();
    const responsibilities: { id: string; source: unknown }[] = [];
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) {
        for (const child of v) walk(child);
        return;
      }
      if (!v || typeof v !== "object") return;
      if ("source" in v && "id" in v && "name" in v)
        responsibilities.push(v as { id: string; source: unknown });
      for (const child of Object.values(v)) walk(child);
    };
    walk(plan.ir);
    expect(plan.sourceMap).toHaveLength(responsibilities.length);
    for (const r of responsibilities)
      expect(plan.sourceMap.find((m) => m.output === r.id)?.source).toEqual(r.source);
    expect(new Set(plan.sourceMap.map((m) => m.output)).size).toBe(plan.sourceMap.length);
    expect(
      plan.sourceMap.every((m) => m.source.path.every((part) => typeof part === "string")),
    ).toBe(true);
  });

  it("lowers nested bounded union values without depending on variant presentation order", () => {
    const design = backendPlanFixture();
    for (const c of requiredIR(design.architecture).contracts ?? []) {
      const metadata = requiredIR(c.shape?.payload.find((f) => f.id === "metadata"));
      metadata.values = {
        type: "tagged-union",
        discriminator: "tag",
        variants: ["present", "absent"].map((tag) => ({
          type: "object",
          fields: [
            {
              id: "tag",
              name: "tag",
              description: "",
              required: true,
              type: "text",
              enumValues: [tag],
            },
            ...(tag === "present"
              ? [
                  {
                    id: "items",
                    name: "items",
                    description: "",
                    required: true,
                    type: "array" as const,
                    maxItems: 3,
                    items: { type: "boolean" as const },
                  },
                ]
              : []),
          ],
        })),
      };
    }
    const lookup = backendPlanLookup(design),
      original = lowerBackendData(design, lookup);
    expect(original.diagnostics).toEqual([]);
    expect(
      entity(original).fields.find((f) => f.field === "metadata")?.value?.values,
    ).toMatchObject({
      type: "tagged-union",
      discriminator: "tag",
      variants: expect.arrayContaining([
        {
          type: "object",
          fields: expect.arrayContaining([
            {
              id: "items",
              required: true,
              value: { type: "array", maxItems: 3, items: { type: "boolean" } },
            },
          ]),
        },
      ]),
    });
    for (const c of requiredIR(design.architecture).contracts ?? [])
      requiredIR(c.shape?.payload.find((f) => f.id === "metadata")?.values?.variants).reverse();
    const reordered = lowerBackendData(design, lookup);
    expect(reordered.diagnostics).toEqual([]);
    expect(reordered.ir).toEqual(original.ir);
  });

  it("is detached and deeply immutable without freezing designs or registry claims", () => {
    const { design, lookup, plan } = fixture();
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(entity(plan).fields)).toBe(true);
    expect(() => Object.assign(entity(plan), { storageId: "changed" })).toThrow(TypeError);
    const manifest = requiredIR(lookup.get(irRef("ir-module", "1.0.0")));
    expect(Object.isFrozen(manifest.capabilities?.[0]?.evidencePackIds)).toBe(false);
    requiredIR(manifest.capabilities?.[0]).evidencePackIds.push("still-mutable");
    irModel(design).entities.length = 0;
    expect(data(plan).entities).toHaveLength(2);
    expect(plan.sourceSnapshot).not.toEqual(design);
  });

  it("retains the original planned graph and every raw finding even with complete synthetic support", () => {
    const { design, lookup, plan } = fixture();
    expect(plan.rawFindings).toEqual(validateDesign(design, lookup));
    expect(plan.sourceSnapshot).toEqual(design);
    expect(plan.rawFindings.some((f) => f.code === "NEEDS_TEMPLATE")).toBe(true);
    expect(blocksGenerate(validateDesign(design, lookup))).toBe(true);
    expect(() => planProject(design, templateSet(), { projectName: "No runtime" })).toThrow(
      GenerationError,
    );
    expect(plan.sourceSnapshot.elements.every((e) => !!e.planned && !e.template)).toBe(true);
  });

  it("keeps unresolved policy intent inspectable and does not manufacture a resolved policy", () => {
    const { design, lookup } = fixture();
    query(design).accessPolicy = { kind: "unresolved", reference: irRef("post-policy") };
    const plan = lowerBackendData(design, lookup);
    expect(codes(plan)).toContain("CONFIG_REQUIRED");
    expect(data(plan).queries[0]?.sources[0]?.access).toEqual({
      selection: query(design).accessPolicy,
      projection: "visible",
    });
    expect(plan.rawFindings.some((f) => f.code === "CONFIG_REQUIRED")).toBe(true);
  });

  it("reports an unsupported option without discharging a supported sibling", () => {
    const { design, lookup } = fixture();
    query(design).limit.maximum = 99;
    const plan = lowerBackendData(design, lookup);
    expect(codes(plan)).toContain("SUPPORT_OPTION");
    expect(plan.support.obligations.find((o) => o.obligation.kind === "queries")?.status).toBe(
      "unsupported",
    );
    expect(
      plan.support.obligations.find(
        (o) => o.obligation.kind === "container" && o.obligation.id === "store",
      )?.status,
    ).toBe("supported");
    expect(plan.support.fullReady).toBe(false);
    expect(data(plan).queries[0]?.limit.maximum).toBe(99);
    expect(plan.diagnostics.find((d) => d.code === "SUPPORT_OPTION")?.source).toMatchObject({
      kind: "queries",
      id: "post-feed",
      version: "v1",
      path: ["architecture", "backend", "queries", "post-feed@v1", "limit.maximum"],
    });
  });

  it("retains exact version failures, unresolved types and structural findings", () => {
    const { design, lookup } = fixture();
    requiredIR(irModel(design).entities[0]).contract.version = "missing";
    query(design).root.version = "missing";
    const plan = lowerBackendData(design, lookup);
    expect(codes(plan)).toContain("UNKNOWN_REFERENCE");
    expect(codes(plan)).toContain("TYPE_UNRESOLVED");
    expect(data(plan).queries[0]?.root).toEqual({ reference: irRef("post-entity", "missing") });
    expect(validateDesign(design, lookup).filter(isStructural)).not.toHaveLength(0);
  });

  it("rejects conflicting aggregate ownership and stores while preserving original intent", () => {
    const { design, lookup } = fixture();
    design.elements.push(
      { ...requiredIR(design.elements[0]), id: "other-api" },
      { ...requiredIR(design.elements[1]), id: "other-store" },
    );
    const dataset = requiredIR(design.architecture?.datasets?.find((d) => d.id === "post-dataset"));
    dataset.owners = [{ kind: "element", id: "other-api" }];
    dataset.store = "other-store";
    const plan = lowerBackendData(design, lookup);
    expect(codes(plan)).toContain("AGGREGATE_BOUNDARY");
    expect(codes(plan)).toContain("QUERY_STORE_BOUNDARY");
    expect(plan.support.fullReady).toBe(false);
    expect(entity(plan)).toMatchObject({
      host: backendIdentity("host", "other-api"),
      store: backendIdentity("host", "other-store"),
    });
    expect(plan.sourceSnapshot).toEqual(design);
  });

  it("diagnoses table, symbol and exact responsibility collisions rather than overwriting", () => {
    const { design, lookup } = fixture(),
      b = irModel(design);
    requiredIR(b.entities[1]).storageId = requiredIR(b.entities[0]).storageId;
    b.entities.push(structuredClone(requiredIR(b.entities[0])));
    const plan = lowerBackendData(design, lookup);
    expect(codes(plan)).toEqual(
      expect.arrayContaining([
        "STORAGE_COLLISION",
        "IDENTITY_COLLISION",
        "NAME_COLLISION",
        "DUPLICATE_ID",
      ]),
    );
    expect(data(plan).entities).toHaveLength(3);
    expect(plan.rawFindings.some((f) => f.code === "DUPLICATE_ID")).toBe(true);
  });

  it("escapes symbols injectively and includes exact versions in compiler identities", () => {
    expect(backendIdentity("entity", "a", "v1")).not.toBe(backendIdentity("entity", "a", "v2"));
    const versions = ["v1.0", "v1-0", "v1_0", "v1_2e_0", "V1", "v1"];
    expect(new Set(versions.map((v) => backendName("entity", "topic", v))).size).toBe(
      versions.length,
    );
    expect(backendIdentity("entity", "ab", "c")).not.toBe(backendIdentity("entity", "a", "bc"));
    expect(backendName("query-source", "post-feed", "v1.0")).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
  });

  it("keeps unresolved and cyclic joins in analysis with exact diagnostics", () => {
    const { design, lookup } = fixture();
    requiredIR(query(design).joins[0]).from = "topic";
    const plan = lowerBackendData(design, lookup);
    expect(codes(plan)).toContain("QUERY_SOURCE_UNRESOLVED");
    expect(data(plan).queries[0]?.sources.find((s) => s.alias === "topic")).toMatchObject({
      alias: "topic",
      join: { id: "topic", from: "topic", relation: "topic-link" },
    });
    expect(data(plan).queries[0]?.sources.find((s) => s.alias === "topic")?.target).toBeUndefined();
    expect(plan.diagnostics.find((d) => d.code === "UNKNOWN_REFERENCE")?.source).toMatchObject({
      kind: "queries",
      id: "post-feed",
      version: "v1",
    });
    expect(plan.sourceSnapshot).toEqual(design);
  });

  it("retains optimistic expected-version intent and rejects ambiguous authority", () => {
    const { design, lookup } = fixture();
    requiredIR(irModel(design).aggregates[0]).concurrency = {
      kind: "optimistic",
      version: { entity: irRef("topic-entity"), field: "revision" },
    };
    requiredIR(design.architecture?.datasets?.[0]).owners.push({ kind: "element", id: "api" });
    const plan = lowerBackendData(design, lookup);
    expect(codes(plan)).toContain("AUTHORITY_UNRESOLVED");
    expect(data(plan).aggregates[0]?.concurrency).toEqual({
      kind: "optimistic",
      version: { entity: irRef("topic-entity"), field: "revision" },
    });
    expect(entity(plan, "topic-entity").host).toBeUndefined();
  });

  it("gives successive entity versions distinct IR identities while retaining physical storage", () => {
    const { design, lookup } = fixture();
    const successor = structuredClone(requiredIR(irModel(design).entities[0]));
    successor.version = "v2";
    irModel(design).entities.push(successor);
    const plan = lowerBackendData(design, lookup);
    const versions = data(plan).entities.filter((e) => e.reference.id === successor.id);
    expect(versions.map((e) => e.reference.version)).toEqual(["v1", "v2"]);
    expect(new Set(versions.map((e) => e.id)).size).toBe(2);
    expect(new Set(versions.map((e) => e.name)).size).toBe(2);
    expect(new Set(versions.map((e) => e.storageId)).size).toBe(1);
    expect(codes(plan)).not.toContain("STORAGE_COLLISION");
    expect(codes(plan)).not.toContain("IDENTITY_COLLISION");
  });

  it("preserves semantic tuple ordering and canonicalizes configuration object keys", () => {
    const { design, lookup } = fixture();
    requiredIR(design.elements[0]).config = { label: "same", count: 1 };
    const original = lowerBackendData(design, lookup);
    requiredIR(design.elements[0]).config = { count: 1, label: "same" };
    expect(JSON.stringify(lowerBackendData(design, lookup).ir)).toBe(JSON.stringify(original.ir));
    query(design).order.reverse();
    query(design).cursor.fields.reverse();
    requiredIR(irModel(design).entities[0]).primaryKey.reverse();
    const changed = lowerBackendData(design, lookup);
    expect(data(changed).queries[0]?.order.map((o) => o.field.field)).toEqual(["id", "revision"]);
    expect(changed.ir).not.toEqual(original.ir);
  });

  it("does not silently enable backend compilation or rewrite old designs", () => {
    const templates = templateSet();
    for (const name of ["link-shortener", "resource-workspace", "resources", "qrwty"]) {
      const design = fixtureDesign(name);
      const before = JSON.stringify(design),
        plan = lowerBackendData(design, templates.lookup);
      expect(plan.enabled).toBe(false);
      expect(plan.ir).toBeUndefined();
      expect(plan.sourceMap).toEqual([]);
      expect(plan.rawFindings).toEqual(validateDesign(design, templates.lookup));
      expect(JSON.stringify(design)).toBe(before);
    }
  });

  it("leaves existing resource and contract project plans byte-identical after analysis", () => {
    const templates = templateSet();
    for (const name of ["link-shortener", "resources", "resource-workspace", "event-orders"]) {
      const design = fixtureDesign(name),
        options = { projectName: "Compatibility" };
      const before = planProject(design, templates, options);
      expect(lowerBackendData(design, templates.lookup).enabled).toBe(false);
      const after = planProject(design, templates, options);
      expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    }
  });
});

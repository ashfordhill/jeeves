import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureSchema } from "./architecture.ts";
import { contractCanonical, contractKey } from "./architecture-contracts.ts";
import { buildArchitectureHandoff, handoffJson } from "./architecture-handoff.ts";
import {
  type ArchitectureLibraryEntry,
  extractArchitectureTemplate,
  previewArchitectureTemplate,
} from "./architecture-library.ts";
import { fragmentIds, mappedArchitecture } from "./architecture-patterns.ts";
import { validateBackendBehavior } from "./backend-behavior.ts";
import { backendModelSchema } from "./backend-model.ts";
import { exportContractJsonSchema } from "./contract-json-schema.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { isStructural } from "./findings.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";
import { vendureCoreExampleComplete } from "./vendure-core-complete.ts";
import { vendureCoreExample } from "./vendure-core-example.ts";
import { vendureCoreDesignTrace, vendureCoreTrace } from "./vendure-core-trace.ts";

function need<T>(v: T | undefined): T {
  if (v === undefined) throw Error("Missing declaration");
  return v;
}
const fixture = () => designSchema.parse(vendureCoreExampleComplete().design);
const frozen = (name: string) =>
  JSON.parse(readFileSync(`benchmarks/vendure-core/v1/${name}.json`, "utf8"));
const op = (d: DesignDocument, id: string) =>
  d.architecture!.backend!.operations!.find((o) => o.target.operation === id)!;
it("completes Vendure design while preserving every P72a protected definition and absent runtime evidence", () => {
  const d = fixture(),
    a = d.architecture!,
    m = a.backend!,
    before = designSchema.parse(vendureCoreExample().design).architecture!;
  expect(validateDesign(d, testLookup).filter((f) => f.code !== "NEEDS_TEMPLATE")).toEqual([]);
  for (const collection of ["contracts", "interfaces", "bindings"] as const)
    for (const x of before[collection] ?? [])
      expect(
        a[collection]?.find(
          (v) =>
            ("version" in v ? contractKey(v as any) : v.id) ===
            ("version" in x ? contractKey(x as any) : x.id),
        ),
      ).toEqual(x);
  for (const collection of [
    "entities",
    "aggregates",
    "accessPolicies",
    "accessBindings",
    "queries",
  ] as const)
    for (const x of before.backend![collection] ?? [])
      expect(m[collection]?.find((v) => contractKey(v) === contractKey(x))).toEqual(x);
  for (const ds of before.datasets!) {
    const next = a.datasets!.find((d) => d.id === ds.id)!;
    expect({ ...next, writers: ds.writers }).toEqual(ds);
    for (const writer of ds.writers) expect(next.writers).toContainEqual(writer);
  }
  expect(m.operations).toHaveLength(47);
  expect(m.hooks).toHaveLength(8);
  expect(a.scenarios).toHaveLength(5);
  expect(m.implementations).toBeUndefined();
  expect(m.entities.some((e) => /session|app-user/.test(e.storageId))).toBe(false);
  expect(
    a
      .contracts!.filter((c) => c.kind === "api" && c.version === "v2")
      .flatMap((c) => c.shape!.operations),
  ).toHaveLength(42);
  expect(
    a.deployments!.map((d) => d.instances.find((i) => i.element === "vc-api")!.replicas),
  ).toEqual([1, 2]);
  expect(Object.keys(vendureCoreExampleComplete().layout.architecture!)).toHaveLength(3);
  for (const c of a.contracts!) expect(exportContractJsonSchema(c).ok, contractKey(c)).toBe(true);
  expect(fixture()).toEqual(d);
});
it("traces every exact frozen observation, source decision and fixture scenario step with zero observed points", () => {
  const d = fixture(),
    r = frozen("requirements"),
    f = frozen("fixtures"),
    source = frozen("source-map");
  expect(vendureCoreTrace.map((r) => [r.id, r.weight, r.target])).toEqual(
    frozen("manifest").capabilities.map((r: any) => [r.id, r.weight, r.targetOrigin]),
  );
  expect(
    vendureCoreTrace.flatMap((r) => r.observations).map(({ operations, scenarios, ...ob }) => ob),
  ).toEqual(r.observations);
  expect(vendureCoreDesignTrace(d)).toHaveLength(20);
  for (const row of vendureCoreDesignTrace(d)) {
    expect(row.wire.length).toBeGreaterThan(0);
    expect(row.observedPoints).toBe(0);
    expect(row.runtime).toBe("unsupported");
    if (row.id !== "V01") expect(row.data.length).toBeGreaterThan(0);
    if (row.target === "H") expect(row.hooks).toHaveLength(1);
  }
  for (const row of vendureCoreTrace) {
    const src = source.rows.find((s: any) => s.caseId === row.id);
    expect([row.source, row.adaptation, row.decisions]).toEqual([
      src.primary.id,
      src.adaptation,
      src.decisions,
    ]);
    for (const ob of row.observations) {
      expect(ob.operations).toEqual(f.observations.find((x: any) => x.id === ob.id).operationIds);
      for (const sc of ob.scenarios) {
        expect(sc.steps).toEqual(
          f.scenarios
            .find((s: any) => s.id === sc.id)
            .steps.filter((s: any) => s.observationIds?.includes(ob.id))
            .map((s: any) => s.id),
        );
        expect(
          d
            .architecture!.scenarios!.find((s) => s.id === sc.id.toLowerCase())!
            .outcomes!.find((o) => o.id === ob.id.toLowerCase())!.text,
        ).toBe(ob.expected);
      }
    }
  }
});
it("preserves all eight strict H input/result schemas and finite settings, with effectful provider recovery", () => {
  const d = fixture(),
    a = d.architecture!,
    fixed = frozen("hooks.contracts");
  for (const h of a.backend!.hooks!) {
    const name = h.id.replace("vc-jh-", "");
    expect(h.timeoutSeconds).toBe(5);
    expect(h.unavailable).toEqual({ outcome: "status-503", status: 503, writes: "none" });
    expect(h.seam.file).toBe(`src/hooks/${name}.ts`);
    expect(h.allowedWrites).toEqual([]);
    expect(
      op(d, h.operation.id.replace(/^vc-|-operation$/g, "")).protocol!.hookSettings!.kind,
    ).toBe(name);
    for (const part of ["input", "output"] as const) {
      const c = a.contracts!.find((c) => contractKey(c) === contractKey(h.contracts[part]))!,
        ex = exportContractJsonSchema(c);
      expect(ex.ok).toBe(true);
      expect(c.shape!.payload.map((f) => f.name)).toEqual(
        Object.keys(fixed[`JH-${name}`][part === "output" ? "result" : "input"].properties),
      );
    }
  }
  const h = a.backend!.hooks!.find((h) => h.id === "vc-jh-provider")!;
  expect(h.kind).toBe("effectful");
  expect(h.boundary).toBe("after-commit");
  expect(h.failure.scope).toBe("separate-delivery-attempt");
  expect(op(d, "stripe-payment").protocol!.hook).toBeUndefined();
  expect(
    a.backend!.effects!.find((e) => e.id === "vc-stripe-provider-effect")!.delivery.acknowledgement,
  ).toBe("unknown-is-reconcile");
  for (const name of ["promotions", "tax-quote", "shipping-rates", "convert-currency"]) {
    expect(op(d, name).kind).toBe("query");
    expect(op(d, name).writes).toEqual([]);
  }
});
it("rejects missing locks/rules, unsafe settlement/expiry, changed snapshots and fictional network atomicity", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => op(d, "checkout").protocol!.commerce!.rules.pop(),
    (d) => op(d, "checkout").transaction.participants.pop(),
    (d) => (op(d, "start-payment").protocol!.externalIO = "committed-intent-provider-call"),
    (d) => op(d, "reference-callback").protocol!.commerce!.rules.splice(2, 1),
    (d) => {
      op(d, "expire-reservations").protocol!.transitions[0]!.transition = "consume";
    },
    (d) => {
      const o = op(d, "create-shipment");
      o.protocol!.records.find((r) => r.entity.id === "vc-order-entity")!.writes.push({
        field: "total",
        source: { kind: "derived", rule: "commerce-validated-plan" },
      });
      o.writes.push({ entity: { id: "vc-order-entity", version: "v1" }, field: "total" });
    },
    (d) => {
      op(d, "checkout").protocol!.records.find(
        (r) => r.entity.id === "vc-order-line-entity",
      )!.selection = "bounded-plan";
    },
    (d) => {
      op(d, "transition-order").protocol!.transitions[0]!.transition = "settle-awaiting";
    },
  ];
  for (const mutate of mutations) {
    const d = fixture();
    mutate(d);
    expect(validateBackendBehavior(d).some(isStructural)).toBe(true);
  }
  const d = fixture();
  expect(
    op(d, "remove-line").protocol!.records.find((r) => r.entity.id === "vc-cart-line-entity")!
      .delete,
  ).toBe(true);
  const s = operationBatchJsonSchema();
  expect(JSON.stringify(s)).toContain("original-byte-auth-before-parse");
  expect(JSON.stringify(s)).toContain("after-inspection");
});
it("exports, remaps, inserts and exactly reuses the entire two-copy graph without changing protected snapshots", async () => {
  const d = fixture(),
    m = d.architecture!.backend!,
    before = structuredClone(d),
    handoff = await buildArchitectureHandoff({
      design: d,
      project: { id: "vendure", name: "Complete Vendure" },
      lookup: testLookup,
    });
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(m);
  expect(d).toEqual(before);
  const { fragment, metadata } = extractArchitectureTemplate(
    d,
    { elements: d.elements.map((e) => e.id) },
    {
      id: "vc-complete",
      version: "1.0.0",
      name: "Complete commerce",
      purpose: "Exact finite commerce composition",
    },
    testLookup,
  );
  expect(fragment.roles.length).toBeLessThanOrEqual(32);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `copy-${id}`]));
  expect(
    mappedArchitecture(fragment, ids).backend!.operations!.find(
      (o) => o.target.operation === "checkout",
    )!.protocol!.commerce,
  ).toEqual(op(d, "checkout").protocol!.commerce);
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
  const preview = previewArchitectureTemplate(
    d,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "copy",
      baseRevision: 0,
      name: "Copy",
      roles: Object.fromEntries(
        fragment.roles
          .filter((r) => r.required)
          .map((r) => [
            r.id,
            {
              mode: "reuse" as const,
              id: [...d.elements, ...d.architecture!.nodes, ...d.architecture!.components!].find(
                (e) => e.name === r.name,
              )!.id,
            },
          ]),
      ),
    },
    testLookup,
  );
  expect(preview.errors).toEqual([]);
  const applied = applyOperations(d, preview.ops, testLookup);
  expect(applied.ok, JSON.stringify(applied)).toBe(true);
  if (!applied.ok) return;
  expect(validateDesign(applied.design, testLookup).filter(isStructural)).toEqual([]);
  expect(applied.design.architecture!.backend!.entities).toHaveLength(60);
  const instance = applied.design.architecture!.patternInstances![0]!,
    reuse = previewArchitectureTemplate(
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
            { mode: "reuse" as const, id: instance.identities[r.id]! },
          ]),
        ),
      },
      testLookup,
    );
  expect(reuse.errors).toEqual([]);
  const result = applyOperations(applied.design, reuse.ops, testLookup);
  expect(result.ok).toBe(true);
  if (result.ok)
    expect(contractCanonical(result.design.architecture!.backend)).toBe(
      contractCanonical(applied.design.architecture!.backend),
    );
  const bad = structuredClone(d.architecture!.backend!);
  bad.accessPolicies = Array.from({ length: 161 }, () => bad.accessPolicies![0]!);
  expect(backendModelSchema.safeParse(bad).success).toBe(false);
}, 30000);

function schemaShape(value: any, doc: any): any {
  if (value?.$ref) {
    let x = doc;
    for (const part of value.$ref.slice(2).split("/"))
      x = x[part.replaceAll("~1", "/").replaceAll("~0", "~")];
    return schemaShape(x, doc);
  }
  if (Array.isArray(value)) return value.map((v) => schemaShape(v, doc));
  if (!value || typeof value !== "object") return value;
  const result: any = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["$schema", "$defs", "description", "x-jeeves"].includes(key))
      .map(([key, v]) => [key, schemaShape(v, doc)]),
  );
  if ("const" in result) {
    result.enum = [result.const];
    delete result.const;
  }
  for (const key of ["required", "enum"]) if (result[key]) result[key].sort();
  for (const key of ["minItems", "minLength"]) if (result[key] === 0) delete result[key];
  return result;
}
it("exports all sixteen H signature schemas exactly against the independent frozen contract", () => {
  const d = fixture(),
    fixed = frozen("hooks.contracts");
  for (const h of d.architecture?.backend?.hooks ?? [])
    for (const part of ["input", "output"] as const) {
      const c = need(
          d.architecture?.contracts?.find((c) => contractKey(c) === contractKey(h.contracts[part])),
        ),
        result = exportContractJsonSchema(c);
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(schemaShape(result.schema, result.schema), `${h.name}/${part}`).toEqual(
          schemaShape(
            fixed["JH-" + h.id.replace("vc-jh-", "")][part === "output" ? "result" : "input"],
            fixed,
          ),
        );
    }
});

it("keeps explicit composition budgets finite at their new exact edges", () => {
  const d = fixture(),
    a = d.architecture!,
    m = a.backend!;
  for (const [collection, maximum] of [
    ["accessPolicies", 160],
    ["effects", 128],
  ] as const) {
    expect(
      backendModelSchema.safeParse({
        ...m,
        [collection]: Array.from({ length: maximum }, () => m[collection]![0]),
      }).success,
    ).toBe(true);
    expect(
      backendModelSchema.safeParse({
        ...m,
        [collection]: Array.from({ length: maximum + 1 }, () => m[collection]![0]),
      }).success,
    ).toBe(false);
  }
  expect(
    architectureSchema.safeParse({
      ...a,
      contracts: Array.from({ length: 200 }, () => a.contracts![0]),
    }).success,
  ).toBe(true);
  expect(
    architectureSchema.safeParse({
      ...a,
      contracts: Array.from({ length: 201 }, () => a.contracts![0]),
    }).success,
  ).toBe(false);
});

it("rejects deletion hidden in a read-only protocol even without scalar writers", () => {
  const d = fixture(),
    o = op(d, "remove-line");
  for (const r of o.protocol!.records) r.writes = [];
  o.writes = [];
  o.kind = "query";
  o.idempotency = { kind: "read-only" };
  o.transaction.kind = "read-only";
  o.protocol!.receipt = "none";
  o.protocol!.replay = "read-current-policy";
  expect(
    validateBackendBehavior(d).some(
      (f) =>
        f.message === "Pure read strategies cannot mutate, publish work or store command receipts.",
    ),
  ).toBe(true);
});

it("isolates raw factory results from future calls and the preserved partial model", () => {
  const first = vendureCoreExampleComplete(),
    before = structuredClone(vendureCoreExampleComplete()),
    old = structuredClone(vendureCoreExample()),
    o = first.design.architecture!.backend!.operations![0]!;
  o.protocol!.preconditions[0] = "Changed raw draft";
  Object.assign(o.protocol!.commerce!.callbacks, { toleranceSeconds: 1 });
  first.design
    .architecture!.contracts!.find((c) => c.id === "vc-quote-data")!
    .shape!.payload.find((f) => f.id === "address")!.fields![0]!.name = "changedRawAddress";
  expect(vendureCoreExampleComplete()).toEqual(before);
  expect(vendureCoreExample()).toEqual(old);
});

it("binds frozen read DTO aliases and bounded asset/order/shipment children without exposing extra query columns", () => {
  const d = fixture(),
    catalog = op(d, "list-catalog").protocol!,
    search = op(d, "search").protocol!;
  expect(catalog.outputs.find((o) => o.path[0] === "items")).toMatchObject({
    source: "owner-result",
    derivation: "catalog-assets-page",
    fields: ["product-id", "id", "name", "price"],
    renames: [{ field: "variant-id", source: "id" }],
  });
  for (const p of [catalog, search]) {
    expect(p.queries).toContainEqual({ id: "vc-public-assets-query", version: "v1" });
    expect(p.records.some((r) => r.entity.id === "vc-asset-entity")).toBe(true);
  }
  expect(search.outputs.find((o) => o.path[0] === "items")!.fields).not.toContain("text");
  expect(
    op(d, "list-orders").protocol!.outputs.find((o) => o.path[0] === "items")!.derivation,
  ).toBe("order-snapshot-page");
  expect(
    op(d, "list-shipments").protocol!.outputs.find((o) => o.path[0] === "items")!.derivation,
  ).toBe("shipment-quantity-page");
  expect(op(d, "inbox").protocol!.outputs.find((o) => o.path[0] === "items")!.fields).toEqual([
    "id",
    "order-id",
    "recipient-id",
    "action",
  ]);
  catalog.outputs.find((o) => o.path[0] === "items")!.renames![0]!.source = "price";
  expect(
    validateBackendBehavior(d).some((f) => f.message.includes("Output alias source type")),
  ).toBe(true);
  catalog.outputs.find((o) => o.path[0] === "items")!.renames![0]!.source = "object-key";
  expect(validateBackendBehavior(d).some((f) => f.message.includes("Output alias"))).toBe(true);
});

it("fences seller settlement against seller v1 independently of shipped/returned order versions", () => {
  const d = fixture(),
    fixed = frozen("fixtures"),
    request = fixed.requests.find((r: any) => r.id === "seller-plan");
  expect(request.input.body.expectedVersion).toBe(1);
  expect(op(d, "seller-settlement").protocol!.versionChecks).toEqual([
    {
      entity: { id: "vc-seller-entity", version: "v1" },
      field: "version",
      input: ["expected-version"],
    },
  ]);
});

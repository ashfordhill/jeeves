import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { contractCanonical } from "./architecture-contracts.ts";
import { architectureExample, architectureExamples } from "./architecture-examples.ts";
import {
  buildArchitectureHandoff,
  handoffFingerprint,
  handoffJson,
} from "./architecture-handoff.ts";
import {
  type ArchitectureLibraryEntry,
  extractArchitectureTemplate,
  previewArchitectureTemplate,
} from "./architecture-library.ts";
import { fragmentIds, mappedArchitecture } from "./architecture-patterns.ts";
import { validateBackendData } from "./backend-data.ts";
import { validateBackendPolicies } from "./backend-policy.ts";
import { validateBackendQueries } from "./backend-queries.ts";
import { exportContractJsonSchema } from "./contract-json-schema.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { isStructural } from "./findings.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";
import { vendureCoreExample } from "./vendure-core-example.ts";

function need<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("Missing test definition");
  return v;
}
const fixture = () => designSchema.parse(vendureCoreExample().design);
const model = (d: DesignDocument) => need(d.architecture?.backend);
const policy = (d: DesignDocument, id = "vc-asset-policy") =>
  need(model(d).accessPolicies?.find((p) => p.id === id));
const structural = (d: DesignDocument) => validateDesign(d, testLookup).filter(isStructural);
const openapi = JSON.parse(
  readFileSync("benchmarks/vendure-core/v1/contracts.openapi.yaml", "utf8"),
);
function resolve(v: any, doc: any): any {
  if (v?.$ref) {
    let x = doc;
    for (const p of v.$ref.slice(2).split("/")) x = x[p.replace(/~1/g, "/").replace(/~0/g, "~")];
    return resolve(x, doc);
  }
  if (Array.isArray(v)) return v.map((x) => resolve(x, doc));
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !["description", "$schema", "default"].includes(k))
        .map(([k, c]) => [k, resolve(c, doc)]),
    );
  return v;
}
function normalize(v: any): any {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") {
    const n: any = Object.fromEntries(Object.entries(v).map(([k, c]) => [k, normalize(c)]));
    if (n.type === "integer" && "exclusiveMinimum" in n) {
      n.minimum = Math.floor(n.exclusiveMinimum) + 1;
      delete n.exclusiveMinimum;
    }
    if ("const" in n) {
      n.enum = [n.const];
      delete n.const;
    }
    for (const k of ["required", "enum"])
      if (Array.isArray(n[k])) {
        n[k].sort();
        if (!n[k].length) delete n[k];
      }
    return n;
  }
  return v;
}
it("registers an independent explicitly partial study without changing Mattermost or Discourse", () => {
  const d = fixture();
  expect(architectureExamples[0]?.id).toBe("mattermost-reference");
  expect(architectureExample("discourse-core").name).toContain("complete");
  expect(architectureExample("vendure-core").name).toContain("complete");
  expect(structural(d)).toEqual([]);
  expect(model(d).entities).toHaveLength(28);
  expect(model(d).queries).toHaveLength(10);
  expect(d.elements).toHaveLength(8);
  expect(d.elements.every((e) => e.template === null && e.planned)).toBe(true);
  expect(d.architecture?.scenarios).toEqual([]);
  for (const c of [
    "operations",
    "effects",
    "lifecycles",
    "hooks",
    "capabilityConfigs",
    "implementations",
  ] as const)
    expect(model(d)[c]).toBeUndefined();
  expect(model(d).entities.some((e) => /session|app-user/.test(e.storageId))).toBe(false);
  const changed = fixture();
  need(changed.architecture?.contracts?.[0]?.shape?.operations[0]).name = "Local edit";
  expect(fixture()).toEqual(d);
});
it("preserves every frozen method/path, input location, body, output and error schema", () => {
  const d = fixture();
  let count = 0;
  for (const contract of d.architecture?.contracts ?? []) {
    if (contract.kind !== "api") continue;
    const result = exportContractJsonSchema(contract);
    expect(result.ok, result.ok ? "" : JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) continue;
    const doc: any = result.schema;
    const ops = doc["x-jeeves"].operations;
    for (const operation of ops) {
      const t = operation.transport;
      const original = openapi.paths[t.path][t.method.toLowerCase()];
      expect(original).toBeDefined();
      expect(operation.id).toBe(
        original.operationId.replace(/[A-Z]/g, (s: string) => "-" + s.toLowerCase()),
      );
      count++;
      expect(
        t.parameters.map((p: any) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          schema: normalize(resolve(p.schema, doc)),
        })),
      ).toEqual(
        (original.parameters ?? [])
          .map((p: any) => resolve(p, openapi))
          .map((p: any) => ({
            name: p.name,
            in: p.in,
            required: p.required ?? false,
            schema: normalize(p.schema),
          })),
      );
      if (original.requestBody)
        expect(normalize(resolve(t.request.schema, doc))).toEqual(
          normalize(resolve(original.requestBody.content["application/json"].schema, openapi)),
        );
      expect(t.responses.map((r: any) => String(r.status))).toEqual(
        Object.keys(original.responses),
      );
      for (const r of t.responses) {
        const expected = original.responses[r.status];
        if (expected.content?.["application/json"])
          expect(normalize(resolve(r.body.schema, doc))).toEqual(
            normalize(resolve(expected.content["application/json"].schema, openapi)),
          );
        else if (expected.content)
          expect(r.body).toEqual({ kind: "binary", contentType: "text/plain", maxBytes: 10485760 });
        else expect(r.body).toBeUndefined();
        for (const h of r.headers)
          expect(normalize(resolve(h.schema, doc))).toEqual(
            normalize(resolve(resolve(expected.headers[h.name], openapi).schema, openapi)),
          );
      }
    }
  }
  expect(count).toBe(42);
});
it("preserves exact money storage, immutable snapshot identity and distinct stock/attempt quantities", () => {
  const d = fixture(),
    b = model(d),
    entity = (id: string) => need(b.entities.find((e) => e.id === `vc-${id}-entity`));
  expect(validateBackendData(d).filter(isStructural)).toEqual([]);
  for (const id of ["quote", "order"]) {
    const e = entity(id);
    for (const f of ["subtotal", "tax", "shipping", "total"]) {
      expect(e.fields.find((x) => x.field === f)?.storage).toEqual({
        kind: "money",
        minorUnits: "minor",
        currency: "currency",
        currencyStorageId: `${f}-currency-column`,
      });
      const c = need(d.architecture?.contracts?.find((c) => c.id === e.contract.id));
      expect(c.shape?.payload.find((x) => x.id === f)?.fields).toMatchObject([
        { id: "minor", type: "integer", minimum: 0, maximum: 9007199254740991 },
        { id: "currency", enumValues: ["USD"] },
      ]);
    }
    expect(
      policy(d, `vc-${id}-policy`).projections.find((p) => p.mode === "write")?.fields ?? [],
    ).not.toContain("total");
    expect(entity(id).fields.some((f) => f.field === "address" && f.storage.kind === "json")).toBe(
      true,
    );
  }
  for (const [id, root] of [
    ["quote-line", "quote-id"],
    ["order-line", "order-id"],
  ]) {
    expect(entity(id!).primaryKey).toEqual([root, "id"]);
    expect(entity(id!).fields.find((f) => f.field === "unit-price")?.storage.kind).toBe("money");
    expect(policy(d, `vc-${id}-policy`).rules.some((r) => r.actions.includes("write"))).toBe(false);
  }
  expect(
    entity("cart-line").fields.some((f) => f.field === "price" || f.field === "unit-price"),
  ).toBe(false);
  expect(entity("stock").fields.map((f) => f.field)).toEqual(
    expect.arrayContaining(["on-hand", "allocated"]),
  );
  expect(entity("reservation").fields.map((f) => f.field)).toContain("quantity");
  expect(entity("payment").uniqueKeys).toContainEqual(
    expect.objectContaining({ fields: ["provider", "request-key"] }),
  );
  expect(entity("provider-event").uniqueKeys).toContainEqual(
    expect.objectContaining({ fields: ["provider", "event-id"] }),
  );
  const quoteWire = need(
    d.architecture?.contracts
      ?.find((c) => c.id === "vc-carts-api")
      ?.shape?.operations.find((o) => o.id === "quote")
      ?.input.find((f) => f.id === "address"),
  );
  const quoteData = need(
    d.architecture?.contracts
      ?.find((c) => c.id === "vc-quote-data")
      ?.shape?.payload.find((f) => f.id === "address"),
  );
  expect(quoteData).toEqual(quoteWire);
  const malformed = fixture(),
    e = need(model(malformed).entities.find((e) => e.id === "vc-order-entity"));
  need(e.fields.find((f) => f.field === "total")).storage = {
    kind: "money",
    minorUnits: "total",
    currency: "scope-id",
    currencyStorageId: "broken-column",
  };
  expect(validateBackendData(malformed).some(isStructural)).toBe(true);
});
it("requires current shop membership and exact owner/staff/seller/publication context", () => {
  const d = fixture();
  expect(validateBackendPolicies(d)).toEqual([]);
  expect(validateBackendQueries(d)).toEqual([]);
  const cart = policy(d, "vc-cart-policy");
  expect(cart.rules.filter((r) => r.actions.includes("write")).map((r) => r.when.clauses)).toEqual([
    ["member", "owner"],
  ]);
  expect(cart.clauses.find((c) => c.kind === "membership")).toMatchObject({
    entity: { id: "vc-membership-entity" },
    via: "shop",
    active: { field: "active", value: true },
  });
  const asset = policy(d);
  expect(asset.context.identity).toBe("public");
  expect(asset.rules.filter((r) => r.actions.includes("bytes")).map((r) => r.when.clauses)).toEqual(
    [
      ["product-published", "product-asset"],
      ["product-published", "variant-published"],
    ],
  );
  const seller = policy(d, "vc-seller-line-policy");
  expect(seller.rules[0]?.when.clauses).toEqual(["member", "owner", "seller-active"]);
  expect(seller.clauses.find((c) => c.kind === "owner")).toMatchObject({
    via: "seller",
    field: "principal-id",
  });
  expect(seller.projections[0]?.fields).not.toContain("address");
  const service = policy(d, "vc-notification-service-policy");
  expect(service.context.service?.initiatingActor).toBe("provenance-only");
  expect(service.clauses.find((c) => c.kind === "visibility")).toMatchObject({
    via: "recipient-membership",
    field: "active",
    value: true,
  });
  expect(
    model(d)
      .entities.find((e) => e.id === "vc-notification-entity")
      ?.relations.find((r) => r.id === "order")?.fields,
  ).toContainEqual({ source: "recipient-id", target: "owner-id" });
  const p = policy(d, "vc-payment-admin-policy");
  expect(p.rules[0]?.when.clauses).toEqual(["member", "admin"]);
  for (const id of ["reference-callback", "stripe-callback", "sync-inventory"]) {
    expect(policy(d, `vc-${id}-policy`).context.identity).toBe("verified-service");
    expect(
      model(d).accessBindings?.find((b) => b.id === `vc-${id}-access-use`)?.relationshipBinding,
    ).toBe(`vc-${id}-source-binding`);
  }
  expect(model(d).accessBindings).toHaveLength(38);
  for (const p of model(d).accessPolicies ?? []) expect(p.revocation.recheck).toHaveLength(9);
  const projection = model(d).entities.find((e) => e.id === "vc-search-projection-entity");
  expect(projection?.fields.map((f) => f.field)).not.toEqual(
    expect.arrayContaining(["cost", "allocated", "on-hand"]),
  );
});
it("rejects mismatched body-owned Content-Type and arbitrary Content-Length while retaining frozen literals", () => {
  for (const header of ["content-type", "content-length"]) {
    const bad = fixture(),
      op = need(
        bad.architecture?.contracts?.find((c) => c.id === "vc-sessions-api")?.shape?.operations[0],
      ),
      t = need(op.transport);
    const h = need(t.responses[0]?.headers.find((h) => h.name.toLowerCase() === "content-type"));
    if (header === "content-length") h.name = header;
    else {
      const f = need(op.output.find((f) => f.id === h.field));
      f.enumValues = ["text/plain"];
    }
    expect(structural(bad).some((f) => f.message.includes("body descriptor"))).toBe(true);
  }
});
it("keeps policy-before-page order and complete root tie-breaks with current joined publication", () => {
  const d = fixture(),
    q = need(model(d).queries?.find((q) => q.id === "vc-search-query"));
  expect(q.order.map((o) => `${o.field.source}/${o.field.field}`)).toEqual([
    "product/created-at",
    "product/id",
    "root/variant-id",
  ]);
  expect(q.sourcePolicies).toHaveLength(2);
  expect(q.limit).toEqual({ default: 25, maximum: 100 });
  q.order[2]!.field = { source: "variant", field: "id" };
  q.cursor.fields = q.order.map((o) => o.field);
  expect(validateBackendQueries(d).some((f) => f.message.includes("complete required"))).toBe(true);
});
it("protects exact definitions and retains money, scope, optional predicates and source IDs under composition", async () => {
  const d = fixture(),
    changed = fixture();
  need(policy(changed).rules[0]).when.operator = "any";
  expect(structural(changed)).toEqual([]);
  expect(
    applyOperations(
      d,
      [{ op: "setArchitecture", architecture: changed.architecture ?? null }],
      testLookup,
    ).ok,
  ).toBe(false);
  const { fragment, metadata } = extractArchitectureTemplate(
    d,
    { elements: d.elements.map((e) => e.id) },
    {
      id: "vc-study",
      version: "1.0.0",
      name: "Commerce",
      purpose: "Exact money and current authority",
    },
    testLookup,
  );
  expect(fragment.roles.length).toBeLessThanOrEqual(32);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `mapped-${id}`]));
  const mapped = mappedArchitecture(fragment, ids);
  expect(mapped.backend?.entities[0]?.storageId).toBe(model(d).entities[0]?.storageId);
  expect(
    mapped.backend?.accessPolicies
      ?.find((p) => p.name === policy(d).name)
      ?.clauses.find((c) => c.id === "product-asset"),
  ).toMatchObject({ kind: "visibility", value: null });
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
            { mode: "reuse" as const, id: need(d.elements.find((e) => e.name === r.name)).id },
          ]),
      ),
    },
    testLookup,
  );
  expect(preview.errors).toEqual([]);
  const applied = applyOperations(d, preview.ops, testLookup);
  expect(applied.ok).toBe(true);
  if (!applied.ok) return;
  expect(structural(applied.design)).toEqual([]);
  expect(model(applied.design).entities).toHaveLength(56);
  const instance = need(applied.design.architecture?.patternInstances?.[0]);
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
          { mode: "reuse" as const, id: need(instance.identities[r.id]) },
        ]),
      ),
    },
    testLookup,
  );
  expect(reuse.errors).toEqual([]);
  const result = applyOperations(applied.design, reuse.ops, testLookup);
  expect(result.ok).toBe(true);
  if (result.ok) expect(model(result.design)).toEqual(model(applied.design));
  const handoff = await buildArchitectureHandoff({
    design: d,
    project: { id: "vendure", name: "Partial Vendure" },
    lookup: testLookup,
  });
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(model(d));
  expect(contractCanonical(model(fixture()))).toBe(contractCanonical(model(d)));
  expect(await handoffFingerprint(fixture(), { id: "vendure", name: "Partial Vendure" })).toBe(
    await handoffFingerprint(d, { id: "vendure", name: "Partial Vendure" }),
  );
  expect(JSON.stringify(operationBatchJsonSchema())).toContain('"null"');
}, 30000);
it("preserves fixed boolean literals and finite fragment extension-point limits", async () => {
  const { contractFieldSchema } = await import("./contract-shapes.ts");
  const { backendValueFits } = await import("./backend-behavior.ts");
  const { architectureFragmentSchema } = await import("./architecture-patterns.ts");
  expect(
    contractFieldSchema.safeParse({
      id: "mode",
      name: "mode",
      required: true,
      type: "text",
      booleanValue: false,
    }).success,
  ).toBe(false);
  expect(backendValueFits({ type: "boolean" }, { type: "boolean", booleanValue: false })).toBe(
    false,
  );
  expect(
    backendValueFits(
      { type: "boolean", booleanValue: true },
      { type: "boolean", booleanValue: false },
    ),
  ).toBe(false);
  expect(
    backendValueFits(
      { type: "boolean", booleanValue: false },
      { type: "boolean", booleanValue: false },
    ),
  ).toBe(true);
  expect(backendValueFits({ type: "boolean", booleanValue: false }, { type: "boolean" })).toBe(
    true,
  );
  const d = fixture(),
    { fragment } = extractArchitectureTemplate(
      d,
      { elements: d.elements.map((e) => e.id) },
      {
        id: "vc-bounds",
        version: "1.0.0",
        name: "Commerce bounds",
        purpose: "Keep one extension per optional role",
      },
      testLookup,
    );
  expect(fragment.extensionPoints).toHaveLength(23);
  const bad = {
    ...fragment,
    extensionPoints: Array.from({ length: 33 }, () => fragment.extensionPoints[0]),
  };
  expect(architectureFragmentSchema.safeParse(bad).success).toBe(false);
});

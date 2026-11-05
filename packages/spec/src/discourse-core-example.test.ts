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
import { validateBackendPolicies } from "./backend-policy.ts";
import { backendAccessPolicySchema } from "./backend-policy-model.ts";
import { validateBackendQueries } from "./backend-queries.ts";
import { exportContractJsonSchema } from "./contract-json-schema.ts";
import { contractFieldSchema } from "./contract-shapes.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { discourseCorePartialExample as discourseCoreExample } from "./discourse-core-example.ts";
import { isStructural } from "./findings.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

function need<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("Missing test definition");
  return v;
}
const fixture = () => designSchema.parse(discourseCoreExample().design);
const model = (d: DesignDocument) => need(d.architecture?.backend);
const policy = (d: DesignDocument, id = "dc-post-entity-policy") =>
  need(model(d).accessPolicies?.find((p) => p.id === id));
const structural = (d: DesignDocument) => validateDesign(d, testLookup).filter(isStructural);
const openapi = JSON.parse(
  readFileSync("benchmarks/discourse-core/v1/contracts.openapi.yaml", "utf8"),
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
it("registers an independent explicitly partial planned design and preserves default Mattermost", () => {
  expect(architectureExamples[0]?.id).toBe("mattermost-reference");
  expect(architectureExample("discourse-core").name).toContain("complete");
  expect(discourseCoreExample().name).toContain("partial");
  const d = fixture();
  expect(structural(d)).toEqual([]);
  expect(model(d).entities).toHaveLength(23);
  expect(model(d).queries).toHaveLength(8);
  expect(
    policy(d, "dc-activity-entity-policy")
      .rules.filter((r) => r.actions.includes("write"))
      .map((r) => r.when.clauses),
  ).toEqual([["admin"]]);
  expect(d.elements).toHaveLength(6);
  expect(d.elements.every((e) => e.template === null && e.planned)).toBe(true);
  expect(d.elements.find((e) => e.id === "dc-client")?.planned).toBe("third-party-service");
  expect(d.architecture?.scenarios).toEqual([]);
  for (const c of ["operations", "effects", "hooks", "implementations"] as const)
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
  expect(count).toBe(35);
});
it("checks exact live grant/membership authority, bounded nonrecursive paths and recipient service identity", () => {
  const d = fixture();
  expect(validateBackendPolicies(d)).toEqual([]);
  const p = policy(d),
    g = need(p.clauses.find((c) => c.kind === "group-grant"));
  if (g.kind !== "group-grant") throw new Error("grant");
  expect(g.resourcePath).toEqual(["topic", "category"]);
  expect(g.workspaceMembership.active).toEqual({ field: "state", value: "active" });
  expect(
    backendAccessPolicySchema.safeParse({
      ...p,
      clauses: [{ ...g, resourcePath: ["a", "b", "c", "d"] }],
    }).success,
  ).toBe(false);
  for (const change of [
    (c: typeof g) => {
      c.membership.groupRelation = "workspace";
    },
    (c: typeof g) => {
      c.membership.principal = "state";
    },
    (c: typeof g) => {
      c.membership.active.value = "invented";
    },
    (c: typeof g) => {
      c.grant.access.values = ["owner"];
    },
    (c: typeof g) => {
      c.resourcePath = ["topic", "post"];
    },
  ]) {
    const bad = fixture(),
      clause = need(policy(bad).clauses.find((c) => c.kind === "group-grant"));
    if (clause.kind !== "group-grant") throw new Error("grant");
    change(clause);
    expect(validateBackendPolicies(bad).some((f) => f.code === "CONFIG_INVALID")).toBe(true);
  }
  const service = policy(d, "dc-notification-entity-service-policy");
  expect(service.context.service?.initiatingActor).toBe("provenance-only");
  const clause = need(service.clauses.find((c) => c.kind === "group-grant"));
  if (clause.kind !== "group-grant") throw new Error("grant");
  expect(clause.subject).toEqual({ kind: "resource-field", field: "principal-id" });
  clause.subject = { kind: "session-principal" };
  expect(validateBackendPolicies(d).some((f) => f.message.includes("cannot borrow"))).toBe(true);
});
it("rejects redactions that contradict required/nonnullable logical fields, invalid conditions and parent fields", () => {
  for (const change of [
    (p: ReturnType<typeof policy>) => {
      need(p.projections[0]?.conditional?.[0]).field = "id";
    },
    (p: ReturnType<typeof policy>) => {
      need(p.projections[0]?.conditional?.[0]).otherwise = "omit";
    },
    (p: ReturnType<typeof policy>) => {
      need(p.projections[0]?.conditional?.[0]?.allow[0]).clauses = ["unknown"];
    },
    (p: ReturnType<typeof policy>) => {
      need(p.projections[0]).mode = "write";
    },
  ]) {
    const d = fixture();
    change(policy(d));
    expect(validateBackendPolicies(d).some((f) => isStructural(f))).toBe(true);
  }
  const d = fixture();
  const history = policy(d, "dc-revision-entity-policy");
  const visible = need(history.clauses.find((c) => c.kind === "visibility"));
  if (visible.kind !== "visibility") throw new Error("visible");
  visible.via = "missing";
  expect(validateBackendPolicies(d).some((f) => isStructural(f))).toBe(true);
});
it("allows nonnullable joined search order with a complete root tie-breaker and rejects a joined impostor", () => {
  const d = fixture();
  expect(validateBackendQueries(d)).toEqual([]);
  const q = need(model(d).queries?.find((q) => q.id === "dc-search-query"));
  expect(q.order.map((o) => `${o.field.source}/${o.field.field}`)).toEqual([
    "topic/created-at",
    "topic/id",
    "root/id",
  ]);
  q.order[2]!.field = { source: "topic", field: "version" };
  q.cursor.fields = q.order.map((o) => o.field);
  expect(validateBackendQueries(d).some((f) => f.message.includes("complete required"))).toBe(true);
  const left = fixture();
  const l = need(model(left).queries?.find((q) => q.id === "dc-search-query"));
  need(l.joins[0]).kind = "left";
  expect(validateBackendQueries(left).some((f) => f.message.includes("nonnullable"))).toBe(true);
});
it("protects exact referenced access semantics and preserves local IDs/storage under remapping", () => {
  const d = fixture(),
    bad = fixture();
  need(policy(bad).projections[0]?.conditional?.[0]).allow = [];
  expect(
    applyOperations(
      d,
      [{ op: "setArchitecture", architecture: bad.architecture ?? null }],
      testLookup,
    ).ok,
  ).toBe(false);
  const { fragment } = extractArchitectureTemplate(
    d,
    { elements: d.elements.map((e) => e.id) },
    { id: "dc-study", version: "1.0.0", name: "Discussion", purpose: "Current access authority" },
    testLookup,
  );
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `mapped-${id}`]));
  const mapped = mappedArchitecture(fragment, ids),
    p = need(mapped.backend?.accessPolicies?.find((p) => p.name === "Post current access")),
    g = need(p.clauses.find((c) => c.kind === "group-grant"));
  if (g.kind !== "group-grant") throw new Error("grant");
  expect(g.membership.entity.id).toBe(
    `mapped-${need(fragment.architecture.backend?.entities.find((e) => e.name === "Group membership")).id}`,
  );
  expect(g.grant.entity.id).toBe(
    `mapped-${need(fragment.architecture.backend?.entities.find((e) => e.name === "Category group grant")).id}`,
  );
  expect(g.workspaceMembership.entity.id).toBe(
    `mapped-${need(fragment.architecture.backend?.entities.find((e) => e.name === "Workspace membership")).id}`,
  );
  expect(g.resourcePath).toEqual(["topic", "category"]);
  expect(p.projections[0]?.conditional).toEqual(policy(d).projections[0]?.conditional);
  expect(mapped.backend?.entities[0]?.storageId).toBe(model(d).entities[0]?.storageId);
});
it("preserves complete extraction, insertion, reuse, handoff, fingerprints and chat schemas", async () => {
  const d = fixture();
  const { fragment, metadata } = extractArchitectureTemplate(
    d,
    { elements: d.elements.map((e) => e.id) },
    { id: "dc-study", version: "1.0.0", name: "Discussion", purpose: "Current access authority" },
    testLookup,
  );
  expect(fragmentIds(fragment)).toContain(
    need(fragment.architecture.backend?.entities.find((e) => e.name === "Category group grant")).id,
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
  const empty = fixture();
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
      roles: Object.fromEntries(
        fragment.roles
          .filter((r) => r.required)
          .map((r) => [
            r.id,
            { mode: "reuse" as const, id: need(empty.elements.find((e) => e.name === r.name)).id },
          ]),
      ),
    },
    testLookup,
  );
  expect(preview.errors).toEqual([]);
  const applied = applyOperations(empty, preview.ops, testLookup);
  expect(applied.ok).toBe(true);
  if (!applied.ok) return;
  expect(structural(applied.design)).toEqual([]);
  const instance = need(applied.design.architecture?.patternInstances?.[0]);
  const reused = previewArchitectureTemplate(
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
        fragment.roles.map((r) => [r.id, { mode: "reuse", id: need(instance.identities[r.id]) }]),
      ),
    },
    testLookup,
  );
  expect(reused.errors).toEqual([]);
  const result = applyOperations(applied.design, reused.ops, testLookup);
  expect(result.ok).toBe(true);
  if (result.ok) expect(model(result.design)).toEqual(model(applied.design));
  const handoff = await buildArchitectureHandoff({
    design: d,
    project: { id: "discourse", name: "Partial Discourse" },
    lookup: testLookup,
  });
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(model(d));
  const changed = fixture();
  need(policy(changed).projections[0]?.conditional?.[0]).allow = [
    { operator: "all", clauses: ["visible"] },
  ];
  expect(
    await handoffFingerprint(changed, { id: "discourse", name: "Partial Discourse" }),
  ).not.toBe(await handoffFingerprint(d, { id: "discourse", name: "Partial Discourse" }));
  const schema = JSON.stringify(operationBatchJsonSchema());
  for (const word of ["group-grant", "workspaceMembership", "conditional", "textConstraint"])
    expect(schema).toContain(word);
  expect(contractCanonical(model(d))).toBe(contractCanonical(model(fixture())));
});
it("accepts only named text constraints and keeps omitted constraints lossless", () => {
  for (const preset of [
    "email",
    "sha256",
    "error-code",
    "correlation-id",
    "base64url",
    "base64",
    "uri",
  ])
    expect(
      contractFieldSchema.safeParse({
        id: "value",
        name: "value",
        type: "text",
        required: true,
        textConstraint: preset,
      }).success,
    ).toBe(true);
  expect(
    contractFieldSchema.safeParse({
      id: "value",
      name: "value",
      type: "text",
      required: true,
      pattern: "anything",
    }).success,
  ).toBe(false);
  expect(
    contractFieldSchema.safeParse({
      id: "value",
      name: "value",
      type: "integer",
      required: true,
      textConstraint: "sha256",
    }).success,
  ).toBe(false);
  expect(
    contractFieldSchema.parse({ id: "value", name: "value", type: "text", required: true }),
  ).not.toHaveProperty("textConstraint");
});

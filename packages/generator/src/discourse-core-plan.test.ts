import {
  contractCanonical,
  discourseCorePartialExample as discourseCoreExample,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { lowerBackendData } from "./backend-plan.ts";
import { templateSet } from "./modules.ts";

function need<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("Missing lowered declaration");
  return v;
}
it("retains the partial Discourse authority/access/string constraints and all unsupported availability", () => {
  const d = discourseCoreExample().design,
    before = structuredClone(d),
    p = lowerBackendData(d, templateSet().lookup),
    ir = need(p.ir);
  expect(d).toEqual(before);
  expect(p.support.fullReady).toBe(false);
  expect(p.support.foundationReady).toBe(false);
  expect(ir.entities).toHaveLength(23);
  expect(ir.queries).toHaveLength(8);
  const policy = need(ir.policies.find((p) => p.reference.id === "dc-post-entity-policy"));
  expect(policy.clauses.find((c) => c.clause.kind === "group-grant")?.clause).toMatchObject({
    resourcePath: ["topic", "category"],
    workspaceMembership: { entity: { id: "dc-workspace-member-entity" } },
  });
  expect(
    policy.projections.find((p) => p.projection.id === "read")?.projection.conditional,
  ).toEqual([
    {
      field: "text",
      allow: [
        { operator: "all", clauses: ["hidden", "moderator"] },
        { operator: "all", clauses: ["visible"] },
      ],
      otherwise: "null",
    },
  ]);
  const file = need(ir.entities.find((e) => e.reference.id === "dc-attachment-entity"));
  expect(file.fields.find((f) => f.field === "sha256")?.value).toMatchObject({
    type: "text",
    textConstraint: "sha256",
  });
  const search = need(ir.queries.find((q) => q.reference.id === "dc-search-query"));
  expect(search.order.map((o) => o.field)).toHaveLength(3);
  expect(Object.isFrozen(ir)).toBe(true);
  expect(JSON.parse(JSON.stringify(p)).ir).toEqual(ir);
});
it("normalizes grant access sets and reveal groups while retaining meaningful parent/order paths", () => {
  const d = discourseCoreExample().design,
    a = lowerBackendData(d, templateSet().lookup),
    changed = structuredClone(d);
  for (const p of changed.architecture?.backend?.accessPolicies ?? []) {
    p.clauses.reverse();
    for (const c of p.clauses) if (c.kind === "group-grant") c.grant.access.values.reverse();
    for (const projection of p.projections) {
      projection.conditional?.reverse();
      for (const c of projection.conditional ?? []) {
        c.allow.reverse();
        for (const w of c.allow) w.clauses.reverse();
      }
    }
  }
  const b = lowerBackendData(changed, templateSet().lookup);
  expect(contractCanonical(a.ir)).toBe(contractCanonical(b.ir));
});

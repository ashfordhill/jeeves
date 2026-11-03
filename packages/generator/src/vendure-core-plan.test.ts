import { contractCanonical, vendureCoreExample } from "@jeeves/spec";
import { expect, it } from "vitest";
import { lowerBackendData } from "./backend-plan.ts";
import { templateSet } from "./modules.ts";

it("retains exact Vendure money/storage/snapshot/access intent without supplying implementations", () => {
  const d = vendureCoreExample().design,
    before = structuredClone(d),
    p = lowerBackendData(d, templateSet().lookup),
    ir = p.ir;
  expect(ir).toBeDefined();
  if (!ir) return;
  expect(d).toEqual(before);
  expect(p.support.fullReady).toBe(false);
  expect(p.support.foundationReady).toBe(false);
  expect(ir.entities).toHaveLength(28);
  expect(ir.queries).toHaveLength(10);
  expect(
    ir.entities
      .find((e) => e.reference.id === "vc-order-entity")
      ?.fields.find((f) => f.field === "total"),
  ).toMatchObject({
    storage: { kind: "money", minorUnits: "minor", currency: "currency" },
    value: {
      type: "object",
      fields: [
        { id: "currency", value: { enumValues: ["USD"] } },
        { id: "minor", value: { maximum: 9007199254740991 } },
      ],
    },
  });
  expect(
    ir.policies
      .find((p) => p.reference.id === "vc-asset-policy")
      ?.clauses.find((c) => c.clause.id === "product-asset")?.clause,
  ).toMatchObject({ value: null });
  expect(Object.isFrozen(ir)).toBe(true);
  expect(JSON.parse(JSON.stringify(p)).ir).toEqual(ir);
});
it("canonicalizes declaration permutations while retaining exact root keys and current authority", () => {
  const d = vendureCoreExample().design,
    a = lowerBackendData(d, templateSet().lookup),
    changed = structuredClone(d);
  changed.architecture?.backend?.entities.reverse();
  changed.architecture?.backend?.aggregates.reverse();
  changed.architecture?.backend?.accessPolicies?.reverse();
  for (const p of changed.architecture?.backend?.accessPolicies ?? []) p.clauses.reverse();
  const b = lowerBackendData(changed, templateSet().lookup);
  expect(contractCanonical(a.ir)).toBe(contractCanonical(b.ir));
});

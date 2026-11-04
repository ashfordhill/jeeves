import { contractCanonical, type DesignDocument, vendureCoreExampleComplete } from "@jeeves/spec";
import { expect, it } from "vitest";
import { planBackend } from "./backend-compile.ts";
import { templateSet } from "./modules.ts";

const plan = (d: DesignDocument) => planBackend(d, templateSet().lookup, { mode: "analysis" });
it("retains every complete Vendure operation/protocol/hook/effect in immutable pure IR with source maps", () => {
  const d = vendureCoreExampleComplete().design,
    before = structuredClone(d),
    p = plan(d),
    m = d.architecture!.backend!;
  expect(
    p.diagnostics.filter((d) =>
      [
        "OPERATION_BOUNDARY",
        "TRANSACTION_BOUNDARY",
        "ROUTE_COLLISION",
        "UNACCOUNTED_INTENT",
      ].includes(d.code),
    ),
  ).toEqual([]);
  expect(p.ir?.operationAdapters).toHaveLength(m.operations?.length ?? 0);
  expect(p.ir?.effects).toHaveLength(m.effects?.length ?? 0);
  expect(p.ir?.hookObligations).toHaveLength(8);
  expect(p.support.foundationReady).toBe(false);
  expect(p.support.fullReady).toBe(false);
  for (const op of p.ir?.operationAdapters ?? []) {
    expect(op.intent).toHaveProperty("protocol");
    expect(
      p.sourceMap.some((s) => s.output === op.id && s.source.path.includes("operations")),
    ).toBe(true);
  }
  expect(JSON.stringify(p.ir)).toContain("source-scope-message");
  expect(JSON.stringify(p.ir)).toContain("outcomeAliases");
  expect(Object.isFrozen(p.ir)).toBe(true);
  expect(d).toEqual(before);
  expect(plan(d)).toEqual(p);
});
it("canonicalizes protocol sets while preserving ordered selector tuples and semantic input paths", () => {
  const d = vendureCoreExampleComplete().design,
    a = plan(d),
    other = structuredClone(d);
  for (const o of other.architecture?.backend?.operations ?? []) {
    o.protocol?.records.reverse();
    o.protocol?.inputs.reverse();
    o.protocol?.outputs.reverse();
    o.protocol?.queries.reverse();
    o.protocol?.hookInputs.reverse();
    o.protocol?.versionChecks.reverse();
  }
  expect(contractCanonical(plan(other).ir)).toBe(contractCanonical(a.ir));
  const changed = structuredClone(d),
    r = changed.architecture!.backend!.operations!.find((o) => o.target.operation === "checkout")!
      .protocol!.records[0]!;
  r.keys.push({ field: "id", input: ["cart-id"] });
  expect(contractCanonical(plan(changed).ir)).not.toBe(contractCanonical(a.ir));
});

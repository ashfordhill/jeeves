/** Combined P61 reference/identity gate. Contract validation is never runtime verification. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { discourseFixtures } from "../../../benchmarks/discourse-core/v1/fixtures.ts";
import { vendureFixtures } from "../../../benchmarks/vendure-core/v1/fixtures.ts";
import { zammadFixtures } from "../../../benchmarks/zammad-core/v1/fixtures.ts";
import { parseBenchmarkLedger } from "./benchmark.ts";
import {
  backendAcceptanceCatalog,
  backendBehaviorRequirements,
  benchmarkFixtureUnavailable,
} from "./benchmark-fixtures.ts";
import { discourseFixtureContract, discourseHookContracts } from "./discourse-benchmark.ts";
import { vendureFixtureContract, vendureHookContracts } from "./vendure-benchmark.ts";
import { zammadFixtureContract, zammadHookContracts } from "./zammad-benchmark.ts";

const root = new URL("../../../benchmarks/", import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const packs = [
  {
    profile: "discourse-core",
    load: discourseFixtures,
    contract: discourseFixtureContract,
    hooks: discourseHookContracts,
  },
  {
    profile: "vendure-core",
    load: vendureFixtures,
    contract: vendureFixtureContract,
    hooks: vendureHookContracts,
  },
  {
    profile: "zammad-core",
    load: zammadFixtures,
    contract: zammadFixtureContract,
    hooks: zammadHookContracts,
  },
];

const referenceDocuments = new Map<string, unknown>();
const checkedReferences = new Set<string>();
function validateRefs(value: unknown, file: URL): void {
  if (!value || typeof value !== "object") return;
  if ("$ref" in value && typeof value.$ref === "string") {
    const [relative, pointer] = value.$ref.split("#");
    const target = new URL(relative || file.href, file);
    const referenceKey = `${target.href}#${pointer || ""}`;
    if (!checkedReferences.has(referenceKey)) {
      if (!referenceDocuments.has(target.href))
        referenceDocuments.set(target.href, JSON.parse(readFileSync(target, "utf8")));
      let resolved: unknown = referenceDocuments.get(target.href);
      for (const part of (pointer || "").split("/").slice(1)) {
        expect(resolved).toBeTypeOf("object");
        const key = decodeURIComponent(part).replaceAll("~1", "/").replaceAll("~0", "~");
        expect(Object.hasOwn(resolved as object, key), value.$ref).toBe(true);
        resolved = (resolved as Record<string, unknown>)[key];
      }
      expect(resolved).toBeDefined();
      checkedReferences.add(referenceKey);
    }
  }
  for (const item of Object.values(value)) validateRefs(item, file);
}

describe("P61 combined independent contract foundation", () => {
  it("closes 60 rows / 195 mandatory observations / 24 H seams / 15 scenarios with valid source and wire references", async () => {
    let rows = 0,
      observations = 0,
      hooks = 0,
      scenarios = 0;
    const allObservations: string[] = [];
    const allBehaviors: string[] = [];
    const cookies: string[] = [];
    for (const app of packs) {
      const readApp = (p: string) => read(`${app.profile}/v1/${p}`);
      const ledger = await parseBenchmarkLedger(
        readApp("manifest.json"),
        readApp("requirements.json"),
        readApp("integrity.json"),
      );
      const fixture = await app.load(ledger);
      const map = readApp("source-map.json");
      expect(map.ledgerIntegrity.manifest).toBe(ledger.integrity.manifest);
      expect(map.ledgerIntegrity.requirements).toBe(ledger.integrity.requirements);
      expect(map.rows.map((r: { caseId: string }) => r.caseId)).toEqual(
        ledger.manifest.capabilities.map((r) => r.id),
      );
      const sourceIds = new Set(map.sources.map((s: { id: string }) => s.id));
      const decisionIds = new Set(map.decisions.map((s: { id: string }) => s.id));
      for (const row of ledger.manifest.capabilities) {
        const reference = map.rows.find((r: { caseId: string }) => r.caseId === row.id);
        expect(reference.requiredObservationIds).toEqual(row.requiredObservationIds);
        expect(reference.targetOrigin).toBe(row.targetOrigin);
        expect(
          reference.primary.kind === "source"
            ? sourceIds.has(reference.primary.id)
            : decisionIds.has(reference.primary.id),
        ).toBe(true);
        for (const source of reference.supportingSources) expect(sourceIds.has(source)).toBe(true);
        for (const decision of reference.decisions) expect(decisionIds.has(decision)).toBe(true);
        for (const id of row.requiredObservationIds)
          expect(
            fixture.observations.find((o) => o.id === id)?.operationIds.length,
          ).toBeGreaterThan(0);
        if (row.targetOrigin === "H")
          expect(Object.keys(app.hooks)).toContain(reference.primary.id);
      }
      const behaviors = backendBehaviorRequirements(backendAcceptanceCatalog(fixture));
      expect(behaviors).toHaveLength(app.contract.operations.length);
      allBehaviors.push(...behaviors.map((b) => b.id));
      allObservations.push(...fixture.observations.map((o) => o.id));
      const document = readApp("contracts.openapi.yaml");
      validateRefs(document, new URL(`${app.profile}/v1/contracts.openapi.yaml`, root));
      validateRefs(
        readApp("hooks.contracts.json"),
        new URL(`${app.profile}/v1/hooks.contracts.json`, root),
      );
      const operations = Object.values(document.paths).flatMap((path) =>
        Object.values(path as Record<string, { operationId: string }>).map((o) => o.operationId),
      );
      expect(new Set(operations).size).toBe(app.contract.operations.length);
      expect(operations.sort()).toEqual(app.contract.operations.map((o) => o.id).sort());
      cookies.push(document.components.securitySchemes.Session.name);
      const missing = benchmarkFixtureUnavailable(
        fixture,
        "not-run",
        "No generated application or hook implementation exists",
      );
      expect(missing.observations.every((o) => o.status === "not-run")).toBe(true);
      expect(missing).not.toHaveProperty("points");
      rows += ledger.manifest.capabilities.length;
      observations += fixture.observations.length;
      hooks += Object.keys(app.hooks).length;
      scenarios += fixture.scenarios.length;
    }
    expect({ rows, observations, hooks, scenarios }).toEqual({
      rows: 60,
      observations: 195,
      hooks: 24,
      scenarios: 15,
    });
    expect(new Set(allObservations).size).toBe(195);
    expect(new Set(allBehaviors).size).toBe(allBehaviors.length);
    expect(new Set(cookies).size).toBe(3);
  });
});

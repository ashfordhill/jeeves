import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureReview } from "./architecture-bindings.ts";
import {
  architecturePatterns,
  describeArchitecturePattern,
  type PatternRequestInput,
  patternRequestSchema,
  previewArchitecturePattern,
} from "./architecture-patterns.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { blocksGenerate } from "./findings.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

const registry = testLookup;
export function patternFixture(): DesignDocument {
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      {
        id: "api",
        name: "Selected API",
        template: null,
        planned: "application-api",
        config: { interface: "REST" },
        notes: "Keep my custom brief",
      },
      { id: "worker", name: "Selected worker", template: null, planned: "background-worker" },
      { id: "store", name: "Selected store", template: null, planned: "relational-store" },
    ],
    architecture: { system: { name: "Three containers", businessTenancy: "Personal workspaces" } },
  });
}
export const patternRequest = (
  design: DesignDocument,
  pattern = "tenant-workspace-access",
  instanceId = "tenant",
  variant = "standard",
): PatternRequestInput => ({
  pattern,
  version: "1.0.0",
  instanceId,
  baseRevision: design.revision,
  variant: variant as "standard",
  config: { name: instanceId, channel: instanceId === "billing" ? "Billing jobs" : "Visit events" },
  roles: {
    api: { mode: "reuse", id: "api" },
    store: { mode: "reuse", id: "store" },
    ...(pattern === "asynchronous-work-delivery"
      ? { worker: { mode: "reuse" as const, id: "worker" } }
      : {}),
  },
});
function apply(design: DesignDocument, req: PatternRequestInput) {
  const preview = previewArchitecturePattern(design, req, registry);
  expect(preview.errors).toEqual([]);
  expect(preview.unfilled).toEqual([]);
  const result = applyOperations(design, preview.ops, registry, { baseRevision: req.baseRevision });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
describe("contract-aware architecture patterns", () => {
  it("expands the four patterns into editable exact-version intent and preserves the selected three hosts", () => {
    let design = patternFixture();
    const original = structuredClone(design.elements);
    for (const p of architecturePatterns)
      design = apply(
        design,
        patternRequest(
          design,
          p.id,
          p.id === "asynchronous-work-delivery" ? "visits" : p.id.slice(0, 20),
          p.variants[0],
        ),
      );
    for (const e of original) expect(design.elements.find((v) => v.id === e.id)).toEqual(e);
    expect(design.architecture!.patternInstances).toHaveLength(4);
    expect(design.architecture!.components!.length).toBeGreaterThan(7);
    expect(design.elements.every((e) => !e.template && !e.attachments.length)).toBe(true);
    expect(
      architectureReview(design).filter(
        (f) =>
          f.code.endsWith("CONFLICT") ||
          f.code === "CONTRACT_MISMATCH" ||
          f.code === "UNBOUND_REQUIRED" ||
          f.code === "DATA_ACCESS_MISSING",
      ),
    ).toEqual([]);
    expect(blocksGenerate(validateDesign(design, registry))).toBe(true);
    expect(designSchema.parse(design)).toEqual(design);
  });
  it("keeps visit and billing channels separate and requires an explicit store choice", () => {
    let design = patternFixture();
    design.elements.push({ ...design.elements[2]!, id: "other-store" });
    const incomplete = previewArchitecturePattern(
      design,
      { ...patternRequest(design), roles: {} },
      registry,
    );
    expect(incomplete.ok).toBe(false);
    expect(incomplete.roles.find((r) => r.id === "store")!.candidates).toHaveLength(2);
    expect(incomplete.unfilled).toContain("Authoritative store: choose a compatible role binding.");
    expect(incomplete.ops).toEqual([]);
    design = apply(
      design,
      patternRequest(design, "asynchronous-work-delivery", "visits", "best-effort"),
    );
    const billing = patternRequest(
      design,
      "asynchronous-work-delivery",
      "billing",
      "transactional-outbox",
    );
    const refused = previewArchitecturePattern(
      design,
      { ...billing, roles: { ...billing.roles, channel: { mode: "reuse", id: "visits-channel" } } },
      registry,
    );
    expect(refused.errors.join(" ")).toContain("guarantee mismatch");
    design = apply(design, billing);
    expect(design.elements.filter((e) => e.planned === "job-queue").map((e) => e.id)).toEqual([
      "visits-channel",
      "billing-channel",
    ]);
    expect(
      architectureReview(design).filter(
        (f) => !["UNRESOLVED_CONTRACT", "UNDECIDED_DATA", "UNDECIDED_POLICY"].includes(f.code),
      ),
    ).toEqual([]);
    const instance = design.architecture!.patternInstances!.at(-1)!;
    expect(instance.invariants.join(" ")).toContain("one atomic transaction");
    expect(
      design.architecture!.contracts!.find((c) => c.id === "billing-atomic-commit")!.shape!
        .operations[0]!.id,
    ).toBe("commit-domain-event");
    const datasets = design.architecture!.datasets!.filter((d) =>
      ["billing-domain-state", "billing-event-intent"].includes(d.id),
    );
    expect(datasets).toHaveLength(2);
    expect(datasets.map((d) => [d.store, d.writers[0]!.id])).toEqual([
      ["store", "billing-atomic-writer"],
      ["store", "billing-atomic-writer"],
    ]);
    expect(design.architecture!.components!.some((c) => c.id === "billing-delivery")).toBe(true);
  });
  it("reuses only explicit compatible roles, retains customizations, and refuses wrong ownership, tenant, exact contracts and policies", () => {
    const original = patternFixture();
    const design = apply(original, patternRequest(original));
    design.architecture!.components![0]!.name = "My workspace policy";
    design.architecture!.components![0]!.responsibility = "Custom scope detail";
    const req = patternRequestSchema.parse(
      patternRequest(design, "tenant-workspace-access", "second"),
    );
    req.roles.workspace = { mode: "reuse", id: "tenant-workspace" };
    const preview = previewArchitecturePattern(design, req, registry);
    expect(preview.errors).toEqual([]);
    const reused = apply(design, req);
    expect(
      reused.architecture!.components!.filter((c) => c.id === "tenant-workspace"),
    ).toHaveLength(1);
    expect(reused.architecture!.components!.find((c) => c.id === "tenant-workspace")!.name).toBe(
      "My workspace policy",
    );
    expect(reused.architecture!.contracts).toHaveLength(design.architecture!.contracts!.length);
    expect(
      previewArchitecturePattern(
        design,
        { ...req, config: { ...req.config, tenant: "Public" } },
        registry,
      ).errors.join(),
    ).toContain("mismatch");
    for (const mutate of [
      (d: DesignDocument) => {
        d.elements[0]!.classification = { ownership: "External responsibility" };
      },
      (d: DesignDocument) => {
        d.architecture!.contracts![0]!.shape!.operations[0]!.input[0]!.name = "wrongTenant";
      },
      (d: DesignDocument) => {
        d.architecture!.interfaces![0]!.contract.version = "v2";
      },
      (d: DesignDocument) => {
        d.architecture!.bindings![0]!.policies!.access!.tenant = "Public";
      },
      (d: DesignDocument) => {
        d.architecture!.patternInstances![0]!.invariants = [];
      },
    ]) {
      const changed = structuredClone(design);
      mutate(changed);
      expect(previewArchitecturePattern(changed, req, registry).ok).toBe(false);
    }
  });
  it("pins provenance while retaining editable customizations and refusing cache/channel authority matches", () => {
    const original = patternFixture();
    const design = apply(original, patternRequest(original));
    const changed = structuredClone(design.architecture!);
    changed.components![0]!.responsibility = "My customized workspace responsibility";
    expect(
      applyOperations(design, [{ op: "setArchitecture", architecture: changed }], registry).ok,
    ).toBe(true);
    changed.patternInstances![0]!.version = "2.0.0";
    expect(
      applyOperations(design, [{ op: "setArchitecture", architecture: changed }], registry).ok,
    ).toBe(false);
    const cache = { ...design.elements[2]!, id: "cache", planned: "distributed-cache" };
    const next = { ...design, elements: [...design.elements, cache] };
    const req = patternRequest(next, "tenant-workspace-access", "another");
    expect(
      previewArchitecturePattern(
        next,
        { ...req, roles: { ...req.roles, store: { mode: "reuse", id: "cache" } } },
        registry,
      ).ok,
    ).toBe(false);
  });
  it("offers existing C2 relationships explicitly, rejects stale/colliding drafts and never mutates preview inputs", () => {
    const design = patternFixture();
    design.connections.push({
      id: "original-store-use",
      kind: "depends-on",
      from: { element: "api" },
      to: { element: "store" },
      planned: {
        label: "Uses records",
        protocol: "SQL",
        interaction: "Request / response",
        security: "Private network",
      },
    });
    const snapshot = structuredClone(design);
    const req = patternRequest(design);
    const preview = previewArchitecturePattern(design, req, registry);
    expect(preview.relationships.find((r) => r.id === "save-membership")!.candidates[0]!.id).toBe(
      "original-store-use",
    );
    const saved = apply(design, {
      ...req,
      relationships: { "save-membership": "original-store-use" },
    });
    expect(saved.connections).toEqual(design.connections);
    expect(saved.architecture!.bindings!.find((b) => b.role === "write")!.relationship.id).toBe(
      "original-store-use",
    );
    expect(design).toEqual(snapshot);
    expect(previewArchitecturePattern(saved, req, registry).ops).toEqual([]);
    expect(previewArchitecturePattern(design, { ...req, instanceId: "api" }, registry).ok).toBe(
      false,
    );
    expect(
      previewArchitecturePattern(design, { ...req, version: "2.0.0" as "1.0.0" }, registry).ok,
    ).toBe(false);
    expect(() =>
      describeArchitecturePattern("asynchronous-work-delivery", "standard", { name: "Work" }),
    ).toThrow("explicit");
  });
});

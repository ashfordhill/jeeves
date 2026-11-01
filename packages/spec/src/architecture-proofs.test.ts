import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { validateArchitecture } from "./architecture.ts";
import { contractKey } from "./architecture-contracts.ts";
import {
  architectureProof,
  architectureProofOperations,
  proofSteps,
} from "./architecture-proofs.ts";
import { reviewArchitecture } from "./architecture-review.ts";
import { designSchema } from "./design.ts";
import { blocksGenerate } from "./findings.ts";
import { scenarioReview } from "./scenarios.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

describe("P56 architecture proof", () => {
  it("keeps unrelated authored context, scenarios and lifecycle choices when specializing a composition", () => {
    let d = designSchema.parse({ schemaVersion: 2, revision: 0 });
    for (const stage of proofSteps("qrwty").filter((s) => s.id !== "behavior")) {
      const result = applyOperations(
        d,
        architectureProofOperations(d, "qrwty", stage.id),
        testLookup,
      );
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      d = result.design;
    }
    d.architecture!.nodes.push({
      id: "reviewer",
      kind: "person",
      name: "Reviewer",
      description: "Authored context survives study specialization.",
    });
    d.architecture!.datasets![0]!.deletion = "Retain";
    d.architecture!.scenarios!.push({
      id: "custom-journey",
      name: "Custom journey",
      scope: { level: "containers" },
      steps: [
        {
          id: "custom-step",
          relationship: { kind: "connection", id: "delivery-publish-work" },
          text: "Retain independently authored planning context.",
        },
      ],
    });
    const result = applyOperations(
      d,
      architectureProofOperations(d, "qrwty", "behavior"),
      testLookup,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.design.architecture!.nodes.some((n) => n.id === "reviewer")).toBe(true);
      expect(result.design.architecture!.scenarios!.some((s) => s.id === "custom-journey")).toBe(
        true,
      );
      expect(result.design.architecture!.datasets![0]!.deletion).toBe("Retain");
    }
  });
  it.each(["qrwty", "inventory"] as const)(
    "%s assembles in validated stages with exact references, explicit open objectives and no runtime passes",
    (product) => {
      let d = designSchema.parse({ schemaVersion: 2, revision: 0 });
      for (const stage of proofSteps(product)) {
        const result = applyOperations(
          d,
          architectureProofOperations(d, product, stage.id, testLookup),
          testLookup,
        );
        expect(result.ok, JSON.stringify(result)).toBe(true);
        if (result.ok) d = result.design;
      }
      expect(validateArchitecture(d).filter((f) => f.code !== "NEEDS_TEMPLATE")).toEqual([]);
      expect(designSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
      expect(d.elements.every((e) => e.planned && e.template === null)).toBe(true);
      expect(blocksGenerate(validateDesign(d, testLookup))).toBe(true);
      const review = reviewArchitecture(d);
      expect(review.complete).toBe(false);
      expect(review.structuralFindings).toEqual([]);
      expect(review.findings.map((f) => f.code)).toEqual(["UNDECIDED_OBJECTIVE"]);
      expect(review.unresolvedDecisions).toEqual(["production-objectives"]);
      expect(d.architecture!.objectives![0]).not.toHaveProperty("value");
      expect(
        d.architecture!.decisions!.find((r) => r.id === "production-objectives")!.consequence,
      ).toContain("Owner: product owner");
      for (const scenario of d.architecture!.scenarios!) {
        expect(scenarioReview(d, scenario).status).toBe("Needs review");
        expect(scenario.actor).toBeTruthy();
        expect(scenario.outcomes!.every((o) => o.decisions.length)).toBe(true);
        expect(scenario.alternatives!.length).toBeGreaterThan(0);
        expect(scenario).not.toHaveProperty("review");
      }
      const keys = new Set(d.architecture!.contracts!.map(contractKey));
      for (const b of d.architecture!.bindings!)
        expect(keys.has(contractKey(b.contract))).toBe(true);
      expect(
        d.architecture!.contracts!.some((c) => JSON.stringify(c).includes('"unresolved"')),
      ).toBe(false);
      expect(d.architecture!.system.deliveryModel).toBe("Hosted");
      expect(d).not.toHaveProperty("verification");
    },
  );

  it("covers all six QR families with separate lookup outcomes, durable duplicate acceptance and domain lifecycle branches", () => {
    const d = architectureProof("qrwty").design;
    const m = d.architecture!;
    expect(m.scenarios!.map((s) => s.id).sort()).toEqual([
      "analytics-lifecycle",
      "billing-webhook",
      "create-edit",
      "domain-abuse",
      "follow-qr",
      "membership",
    ]);
    expect(
      m.scenarios!.find((s) => s.id === "follow-qr")!.alternatives!.map((a) => a.name),
    ).toEqual([
      "Cache miss or unavailable",
      "Visit channel unavailable",
      "Authority unavailable or disabled",
    ]);
    expect(
      m.bindings!.find((b) => b.id === "delivery-publish-work-binding")!.policies,
    ).toMatchObject({
      delivery: { acknowledgement: "None", lossWindowSeconds: 60 },
      failure: { outcome: "Bounded loss" },
    });
    expect(
      m.bindings!.find((b) => b.id === "billing-receive-callback-binding")!.policies,
    ).toMatchObject({
      retry: { idempotency: "Required" },
      delivery: { acknowledgement: "Persisted" },
    });
    expect(
      m.scenarios!.find((s) => s.id === "domain-abuse")!.alternatives!.map((a) => a.id),
    ).toEqual(["failure-path", "transfer", "remove", "shutdown"]);
    expect(
      m.scenarios!.find((s) => s.id === "analytics-lifecycle")!.alternatives!.map((a) => a.id),
    ).toContain("recovery");
    expect(
      m.components!.filter((c) => ["records", "payloads", "content", "artwork"].includes(c.id)),
    ).toHaveLength(4);
    expect(d.connections.some((c) => c.to.element === "destination")).toBe(false);
    expect(m.relationships.find((r) => r.to === "destination")!.from).toBe("visitor");
  });

  it.each(["tenant", "loss", "cache"])(
    "%s policy contradiction fails review even when a decision accepts the finding",
    (kind) => {
      const d = architectureProof("qrwty").design;
      const m = d.architecture!;
      const id =
        kind === "tenant"
          ? "worker-access"
          : kind === "loss"
            ? "delivery-publish-work-binding"
            : "lookup-read-cache-binding";
      const b = m.bindings!.find((b) => b.id === id)!;
      if (kind === "tenant") b.policies!.access!.tenant = "Public";
      else b.policies!.failure!.outcome = "Fail request";
      const f = reviewArchitecture(d).findings.find((f) => f.severity === "conflict")!;
      expect(f).toBeDefined();
      m.decisions!.push({
        id: "cannot-waive",
        name: "Attempted waiver",
        context: f.message,
        decision: "Accept contradiction",
        consequence: "Still contradictory",
        status: "Accepted",
        links: f.inputs,
        acknowledgements: [{ finding: f.id, fingerprint: f.fingerprint }],
      });
      expect(reviewArchitecture(d).findings.find((r) => r.id === f.id)!.acceptedBy).toBeUndefined();
      expect(reviewArchitecture(d).complete).toBe(false);
    },
  );

  it("refuses missing critical contracts atomically and makes reviewed expectations stale after relevant edits", () => {
    const d = architectureProof("qrwty").design;
    const before = structuredClone(d);
    const m = structuredClone(d.architecture!);
    m.contracts = m.contracts!.filter((c) => c.id !== "manage-records");
    expect(applyOperations(d, [{ op: "setArchitecture", architecture: m }], testLookup).ok).toBe(
      false,
    );
    expect(d).toEqual(before);
    const scenario = d.architecture!.scenarios!.find((s) => s.id === "follow-qr")!;
    scenario.review = { fingerprint: scenarioReview(d, scenario).fingerprint };
    expect(scenarioReview(d, scenario).status).toBe("Reviewed");
    d.architecture!.bindings!.find((b) => b.id === "lookup-read-cache-binding")!.policies!
      .freshness!.maxAgeSeconds = 30;
    expect(scenarioReview(d, scenario).status).toBe("Stale");
  });

  it("reuses the tenant contract in a non-QR product with atomic delivery instead of visit-loss policy", () => {
    const qr = architectureProof("qrwty").design;
    const inventory = architectureProof("inventory").design;
    expect(
      inventory.architecture!.contracts!.find((c) => c.id === "tenant-access-contract"),
    ).toEqual(qr.architecture!.contracts!.find((c) => c.id === "tenant-access-contract"));
    expect(inventory.architecture!.patternInstances!.map((p) => [p.pattern, p.variant])).toEqual([
      ["tenant-workspace-access", "standard"],
      ["asynchronous-work-delivery", "transactional-outbox"],
    ]);
    expect(
      inventory.architecture!.bindings!.find((b) => b.id === "delivery-publish-work-binding")!
        .policies,
    ).toMatchObject({
      delivery: { acknowledgement: "Persisted" },
      failure: { outcome: "Buffer" },
      retry: { idempotency: "Required" },
    });
    expect(inventory.elements.some((e) => e.id === "redirect" || e.id === "billing-provider")).toBe(
      false,
    );
    expect(inventory.elements).toHaveLength(5);
    inventory.architecture!.components![0]!.responsibility = "Independent customization";
    expect(architectureProof("qrwty").design).toEqual(qr);
  });
});

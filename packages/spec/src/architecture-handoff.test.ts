import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { architectureSchema } from "./architecture.ts";
import { contractCanonical, resolveContractSource } from "./architecture-contracts.ts";
import {
  architectureHandoffSchema,
  buildArchitectureHandoff,
  handoffFingerprint,
  handoffJson,
  handoffMarkdown,
} from "./architecture-handoff.ts";
import type { HandoffScope } from "./architecture-handoff-model.ts";
import { architectureProof } from "./architecture-proofs.ts";
import { reviewArchitecture } from "./architecture-review.ts";
import { designSchema } from "./design.ts";
import { testLookup } from "./test-support.ts";

const project = { id: "review-project", name: "Architecture study" };
const capture = (design: ReturnType<typeof architectureProof>["design"]) =>
  buildArchitectureHandoff({ design, project, lookup: testLookup });
async function scoped(product: "qrwty" | "inventory") {
  const { design } = architectureProof(product);
  const first = await capture(design);
  const assignments = first.openItems
    .filter(
      (i) =>
        ["objective", "decision"].includes(i.kind) ||
        (i.kind === "finding" && /OBJECTIVE/.test(i.message)),
    )
    .map((i) => ({
      kind: i.kind as HandoffScope["assignments"][number]["kind"],
      id: i.id,
      owner: "Product owner and operations",
      blocks: "Production workload, recovery and commercial acceptance",
    }));
  design.architecture!.implementationHandoff = {
    description: "Contract implementation and functional acceptance",
    partial: true,
    excludedScope: "Production capacity, SLO, recovery and commercial acceptance",
    assignments,
  };
  return design;
}
describe("P57 portable implementation review", () => {
  it.each(["qrwty", "inventory"] as const)(
    "%s exports exact portable definitions and bounded obligations",
    async (product) => {
      const design = await scoped(product);
      const snapshot = await capture(design);
      expect(snapshot.status).toBe("Needs review");
      expect(snapshot.openItems.filter((i) => i.critical)).toEqual([]);
      expect(snapshot.contracts.length).toBeGreaterThan(5);
      expect(snapshot.contracts.every((c) => c.definition && c.status === "resolved")).toBe(true);
      expect(snapshot.manifests.every((m) => m.status === "resolved" && m.definition)).toBe(true);
      expect(new Set(snapshot.obligations.map((o) => o.id)).size).toBe(snapshot.obligations.length);
      expect(snapshot.obligations.some((o) => o.contracts.length && o.expectations.length)).toBe(
        true,
      );
      expect(snapshot.coverage.some((c) => c.category === "planned" && !c.available)).toBe(true);
      expect(snapshot.evidence.generation).toBeNull();
      const output = handoffJson(snapshot);
      expect(architectureHandoffSchema.parse(JSON.parse(output))).toEqual(snapshot);
      expect(handoffJson(await capture(design))).toBe(output);
      expect(handoffMarkdown(await capture(design))).toBe(handoffMarkdown(snapshot));
      expect(handoffMarkdown(snapshot)).toContain("UNVERIFIED TARGET");
      for (const link of handoffMarkdown(snapshot).matchAll(/\]\(([^)]+)\)/g))
        expect(link[1]).toBe("./architecture-handoff.json");
    },
  );
  it("binds approval to semantic names/contracts/policies and scope; revision/layout do not stale decisions", async () => {
    const d = await scoped("qrwty");
    const fingerprint = await handoffFingerprint(d, project);
    d.architecture!.implementationHandoff!.review = {
      fingerprint,
      approval: "Approve functional scope only with listed production exclusions.",
    };
    expect((await capture(d)).status).toBe("Ready for implementation review");
    d.revision += 12;
    expect((await capture(d)).status).toBe("Ready for implementation review");
    const clone = await buildArchitectureHandoff({
      design: structuredClone(d),
      project: { ...project, id: "different-project-same-name" },
      lookup: testLookup,
    });
    expect(clone.status).toBe("Stale");
    expect(clone.evidence.generation).toBeNull();
    const original = structuredClone(d);
    d.elements[0]!.name += " renamed";
    expect((await capture(d)).status).toBe("Stale");
    expect((await capture(original)).status).toBe("Ready for implementation review");
    original.architecture!.implementationHandoff!.excludedScope += " changed";
    expect((await capture(original)).status).toBe("Stale");
  });
  it("never waives an unbound critical interface, unknown payload, contradictory policy or dangling reference", async () => {
    const d = await scoped("inventory");
    const use = d.architecture!.interfaces!.find(
      (i) => i.direction === "required" && i.necessity === "required",
    )!;
    d.architecture!.bindings = d.architecture!.bindings!.filter((b) => b.required !== use.id);
    let snapshot = await capture(d);
    const critical = snapshot.openItems.find((i) => /UNBOUND_REQUIRED/.test(i.message));
    expect(critical?.critical).toBe(true);
    d.architecture!.implementationHandoff!.assignments.push({
      kind: "finding",
      id: critical!.id,
      owner: "Engineer",
      blocks: "Later",
    });
    snapshot = await capture(d);
    expect(snapshot.status).toBe("Blocked");
    expect(snapshot.openItems.find((i) => i.id === critical!.id)?.critical).toBe(true);
    const forged = { ...snapshot, status: "Ready for implementation review" };
    expect(architectureHandoffSchema.safeParse(forged).success).toBe(false);
    use.contract.id = "missing-definition";
    expect((await capture(d)).openItems.some((i) => i.kind === "structure" && i.critical)).toBe(
      true,
    );
  });
  it("keeps missing pinned manifests explicit and never resolves a different version/hash", async () => {
    const d = await scoped("inventory");
    const instance = d.architecture!.patternInstances![0]!;
    instance.version = "99.0.0";
    expect((await capture(d)).manifests[0]!.status).toBe("unavailable");
    instance.version = "1.0.0";
    instance.libraryContentHash = "a".repeat(64);
    expect((await capture(d)).manifests[0]!.status).toBe("unavailable");
  });
  it("omits private runtime config and local paths while retaining check project/revision/environment", async () => {
    const d = await scoped("inventory");
    d.elements[0]!.config = {
      apiKey: "private-key",
      dbUrl: "postgres://password",
      path: "/home/private/output",
    };
    d.elements[0]!.notes = "private runtime notes";
    const s = await buildArchitectureHandoff({
      design: d,
      project,
      lookup: testLookup,
      evidence: {
        projectId: "historical-project",
        revision: 8,
        outputDir: "/home/private/old-output",
        generation: {
          id: 12,
          revision: 7,
          outputDir: "/home/private/evidence",
          baseline: true,
          status: "succeeded",
          createdAt: "2026-11-01T00:00:00Z",
          finishedAt: null,
          checks: [
            {
              subject: "api",
              template: "http-service",
              id: "old-check",
              title: "Old pass",
              layer: "infrastructure",
              status: "passed",
            },
          ],
          stages: [],
          omittedChecks: 2,
          omittedStages: 0,
        },
        run: null,
      },
    });
    const content = handoffJson(s);
    for (const secret of [
      "private-key",
      "postgres://password",
      "/home/private",
      "private runtime notes",
      "outputDir",
    ])
      expect(content).not.toContain(secret);
    expect(s.evidence.projectId).toBe("historical-project");
    expect(s.evidence.revision).toBe(8);
    expect(s.evidence.generation).toMatchObject({
      revision: 7,
      checks: [{ id: "old-check", layer: "infrastructure", status: "passed" }],
    });
    expect(s.evidence.environmentFingerprint).toHaveLength(64);
  });
  it("resolves authoritative source shapes without leaking source snapshots or examples", async () => {
    const d = designSchema.parse({
      schemaVersion: 2,
      revision: 2,
      elements: [
        { id: "api", name: "API", template: { id: "svc", version: "1.0.0" }, attachments: [] },
      ],
      architecture: {
        system: { name: "Source", description: "Source-backed contracts" },
        contracts: [
          {
            id: "unavailable",
            version: "v1",
            name: "Unavailable definition",
            kind: "api",
            source: {
              kind: "rest-operation",
              element: "api",
              attachment: "missing",
              member: { kind: "session", operation: "login" },
            },
            sourceSnapshot: '{"password":"never-export"}',
            sourceDesignRevision: 1,
          },
        ],
      },
    });
    const s = await capture(d);
    expect(s.contracts[0]!.status).toBe("unavailable");
    expect(handoffJson(s)).not.toContain("never-export");
    expect(s.status).toBe("Blocked");
  });
  it("keeps critical contract gaps blocking even when P51 accepts a scoped tradeoff", async () => {
    const design = await scoped("inventory");
    const use = design.architecture!.interfaces!.find((i) => i.direction === "required")!;
    design.architecture!.bindings = design.architecture!.bindings!.filter(
      (b) => b.required !== use.id,
    );
    const finding = reviewArchitecture(design).findings.find((f) => f.code === "UNBOUND_REQUIRED")!;
    design.architecture!.decisions!.push({
      id: "accept-contract-gap",
      name: "Tradeoff",
      context: "Exploration only",
      decision: "Accept temporarily",
      consequence: "Must bind before implementation",
      status: "Accepted",
      links: finding.inputs,
      acknowledgements: [{ finding: finding.id, fingerprint: finding.fingerprint }],
    });
    expect(reviewArchitecture(design).findings.find((f) => f.id === finding.id)?.acceptedBy).toBe(
      "accept-contract-gap",
    );
    expect(
      (await capture(design)).openItems.some(
        (i) => i.critical && i.message.includes("UNBOUND_REQUIRED"),
      ),
    ).toBe(true);
  });
  it("resolves an existing authoritative data shape and marks later source edits stale", async () => {
    const design = designSchema.parse(
      JSON.parse(
        readFileSync(new URL("../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
      ),
    );
    const source = {
      kind: "resource" as const,
      element: "links",
      attachment: "links-api",
      resource: "qr",
    };
    const definition = resolveContractSource(design, source);
    design.architecture = architectureSchema.parse({
      system: { name: "Authoritative source", description: "Existing resource boundary" },
      contracts: [
        {
          id: "resource-contract",
          version: "v1",
          name: "QR records",
          kind: "data",
          source,
          sourceSnapshot: contractCanonical(definition),
          sourceDesignRevision: design.revision,
        },
      ],
    });
    const snapshot = await capture(design);
    expect(snapshot.contracts[0]).toMatchObject({
      status: "resolved",
      source,
      sourceRevision: design.revision,
    });
    expect(snapshot.contracts[0]!.definition).toMatchObject({
      resources: [
        {
          id: "qr",
          fields: expect.arrayContaining([
            expect.objectContaining({ name: "destination", type: "http-url" }),
          ]),
        },
      ],
    });
    design.elements[0]!.attachments[0]!.config.basePath = "/v2";
    expect((await capture(design)).contracts[0]!.status).toBe("stale");
  });
});

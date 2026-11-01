import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { validateArchitecture } from "./architecture.ts";
import {
  contractCanonical,
  contractSources,
  resolveContractSource,
} from "./architecture-contracts.ts";
import { architectureExample } from "./architecture-examples.ts";
import { designSchema } from "./design.ts";
import {
  type ArchitectureScenario,
  architectureScenarioSchema,
  scenarioRelationships,
  scenarioReview,
  validateScenarios,
} from "./scenarios.ts";
import { testLookup } from "./test-support.ts";

const target = () => architectureExample("qrwty-target").design;
const componentScenario = (): ArchitectureScenario => ({
  id: "member-access",
  name: "Resolves member access",
  scope: { level: "components", container: "api" },
  steps: [
    {
      id: "resolve",
      relationship: { kind: "componentRelationship", id: "organizations-accounts" },
      text: "Resolve the member's session before applying an organization role.",
    },
  ],
});

const journeys = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/architecture-scenarios.json", import.meta.url),
        "utf8",
      ),
    ),
  );

describe("scenario expectations and alternatives", () => {
  it("models redirect hit/miss and channel failure, duplicate billing, and visible owner success/denial", () => {
    const d = journeys();
    expect(validateArchitecture(d).filter((f) => f.code !== "NEEDS_TEMPLATE")).toEqual([]);
    expect(validateScenarios(d)).toEqual([]);
    for (const s of d.architecture!.scenarios!)
      expect(scenarioReview(d, s).status).toBe("Needs review");
    const redirect = d.architecture!.scenarios![0]!;
    expect(redirect.steps.map((s) => s.phase)).toEqual([
      "request",
      "request",
      "continuation",
      "response",
    ]);
    expect(redirect.alternatives!.map((p) => p.name)).toEqual([
      "Cache miss or unavailable",
      "Visit channel unavailable",
    ]);
    expect(d.architecture!.scenarios![2]!.alternatives![0]!.steps[0]!.client?.state).toBe("denied");
    const before = structuredClone(d);
    expect(
      applyOperations(d, [{ op: "setArchitecture", architecture: d.architecture! }], testLookup).ok,
    ).toBe(true);
    expect(d).toEqual(before);
  });

  it.each([
    [
      "actor",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.actor = "missing";
      },
    ],
    [
      "alternative relationship",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.alternatives![0]!.steps[0]!.relationship.id = "missing";
      },
    ],
    [
      "alternative branch",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.alternatives![0]!.afterStep = "source-read";
      },
    ],
    [
      "duplicate step",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.alternatives![0]!.steps[0]!.id = "scan";
      },
    ],
    [
      "reserved path identity",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.alternatives![0]!.id = "main";
      },
    ],
    [
      "missing outcome",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.mainOutcomes = ["missing"];
      },
    ],
    [
      "outcome requirement",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.outcomes![0]!.requirements = ["missing"];
      },
    ],
    [
      "outcome decision",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.outcomes![0]!.decisions = ["missing"];
      },
    ],
    [
      "binding relationship",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.steps[1]!.binding = "lookup-store-binding";
      },
    ],
    [
      "client coupling",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![2]!.steps[1]!.client!.component = "lookup";
      },
    ],
    [
      "missing client binding",
      (d: ReturnType<typeof journeys>) => {
        delete d.architecture!.scenarios![2]!.steps[1]!.binding;
      },
    ],
    [
      "missing client operation",
      (d: ReturnType<typeof journeys>) => {
        delete d.architecture!.bindings!.find((b) => b.id === "owner-update-binding")!.operation;
      },
    ],
    [
      "context scope",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.scope = { level: "components", container: "management" };
      },
    ],
  ])("rejects invalid %s atomically", (_name, mutate) => {
    const d = journeys();
    const original = structuredClone(d);
    const changed = structuredClone(d);
    mutate(changed);
    expect(validateScenarios(changed).length).toBeGreaterThan(0);
    expect(
      applyOperations(
        d,
        [{ op: "setArchitecture", architecture: changed.architecture! }],
        testLookup,
      ).ok,
    ).toBe(false);
    expect(d).toEqual(original);
  });

  it("keeps legacy scenarios lossless and explicitly incomplete without generation findings", () => {
    const d = target();
    const s = d.architecture!.scenarios![0]!;
    expect(scenarioReview(d, s).status).toBe("Incomplete");
    expect(architectureScenarioSchema.parse(s)).toEqual(s);
    expect(validateScenarios(d)).toEqual([]);
    expect(s).not.toHaveProperty("actor");
    expect(
      architectureScenarioSchema.safeParse({ ...s, alternatives: Array(13).fill({}) }).success,
    ).toBe(false);
  });

  it.each([
    [
      "contract shape",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.contracts!.find((c) => c.id === "link-records")!.shape!
          .payload[0]!.required = false;
      },
    ],
    [
      "binding policy",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.bindings![0]!.policies!.failure!.timeoutMs = 50;
      },
    ],
    [
      "linked decision",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.decisions![0]!.consequence = "Changed analytics consequence";
      },
    ],
    [
      "expectation",
      (d: ReturnType<typeof journeys>) => {
        d.architecture!.scenarios![0]!.outcomes![0]!.text = "Changed expectation";
      },
    ],
  ])("expires review for a relevant %s", (_name, mutate) => {
    const d = journeys();
    const s = d.architecture!.scenarios![0]!;
    s.review = { fingerprint: scenarioReview(d, s).fingerprint };
    expect(scenarioReview(d, s).status).toBe("Reviewed");
    mutate(d);
    expect(scenarioReview(d, s).status).toBe("Stale");
  });

  it("ignores unrelated revisions, notes and contracts; rename keeps reference identities; removal is protected", () => {
    const d = journeys();
    const s = d.architecture!.scenarios![0]!;
    s.review = { fingerprint: scenarioReview(d, s).fingerprint };
    d.revision += 20;
    d.elements[0]!.notes = "Unrelated notes";
    d.architecture!.contracts!.find((c) => c.id === "billing-callback")!.name =
      "Renamed unrelated callback";
    expect(scenarioReview(d, s).status).toBe("Reviewed");
    d.architecture!.nodes.find((n) => n.id === "visitor")!.name = "Renamed visitor";
    expect(validateScenarios(d)).toEqual([]);
    expect(s.steps[0]!.relationship.id).toBe("visitor-entry");
    d.architecture!.relationships = d.architecture!.relationships.filter(
      (r) => r.id !== "visitor-exit",
    );
    expect(validateScenarios(d).length).toBeGreaterThan(0);
    d.architecture!.scenarios = d.architecture!.scenarios!.filter((v) => v.id !== s.id);
    expect(validateScenarios(d)).toEqual([]);
  });
});

describe("dynamic architecture scenarios", () => {
  it("keeps old documents unchanged and the QRWTY flows ordered, bounded and independent", () => {
    const old = architectureExample("community").design;
    expect(designSchema.parse(old)).toEqual(old);
    expect(old.architecture).not.toHaveProperty("scenarios");
    const design = target();
    expect(
      validateArchitecture(design).filter((finding) => finding.target.path?.includes("scenarios")),
    ).toEqual([]);
    expect(designSchema.parse(design)).toEqual(design);
    expect(design.architecture!.scenarios!.map((scenario) => scenario.name)).toEqual([
      "Visitor follows a QR",
      "Owner creates a link",
    ]);
    const owner = design.architecture!.scenarios![1]!;
    expect(owner.steps.map((step) => step.relationship.id)).toEqual([
      "web-api",
      "api-db",
      "web-api",
    ]);
    owner.steps.reverse();
    expect(target().architecture!.scenarios![1]!.steps[0]!.id).toBe("qr-step-6");
    for (const patch of [
      { name: " " },
      { steps: [] },
      { steps: Array(51).fill(owner.steps[0]) },
      { scope: { level: "context" } },
    ])
      expect(architectureScenarioSchema.safeParse({ ...owner, ...patch }).success).toBe(false);
  });

  it("rejects missing, cross-scope and duplicate step/scenario references atomically", () => {
    for (const mutate of [
      (scenario: ArchitectureScenario) => {
        scenario.steps[0]!.relationship.id = "missing";
      },
      (scenario: ArchitectureScenario) => {
        scenario.steps[0]!.relationship.kind = "connection";
      },
      (scenario: ArchitectureScenario) => {
        scenario.scope = { level: "containers" };
      },
      (scenario: ArchitectureScenario) => {
        scenario.scope = { level: "components", container: "worker" };
      },
      (scenario: ArchitectureScenario) => {
        scenario.scope = { level: "components", container: "missing" };
      },
      (scenario: ArchitectureScenario) => {
        scenario.id = "accounts";
      },
      (scenario: ArchitectureScenario) => {
        scenario.steps.push(structuredClone(scenario.steps[0]!));
      },
    ]) {
      const design = target();
      const before = structuredClone(design);
      const scenario = componentScenario();
      mutate(scenario);
      const result = applyOperations(
        design,
        [
          {
            op: "setArchitecture",
            architecture: { ...design.architecture!, scenarios: [scenario] },
          },
        ],
        testLookup,
      );
      expect(result.ok).toBe(false);
      expect(design).toEqual(before);
    }
    const design = target();
    const scenario = componentScenario();
    expect(
      applyOperations(
        design,
        [
          {
            op: "setArchitecture",
            architecture: { ...design.architecture!, scenarios: [scenario, scenario] },
          },
        ],
        testLookup,
      ).ok,
    ).toBe(false);
  });

  it("allows C3 authored dependencies only within their application", () => {
    const design = target();
    const choices = scenarioRelationships(design, { level: "components", container: "api" });
    expect(choices.some((choice) => choice.relationship.id === "api-db")).toBe(true);
    expect(choices.some((choice) => choice.relationship.id === "redirect-db")).toBe(false);
    const scenario = componentScenario();
    scenario.steps.push({
      id: "save",
      relationship: { kind: "connection", id: "api-db" },
      text: "Save the resolved access.",
    });
    expect(
      applyOperations(
        design,
        [
          {
            op: "setArchitecture",
            architecture: { ...design.architecture!, scenarios: [scenario] },
          },
        ],
        testLookup,
      ).ok,
    ).toBe(true);
    scenario.steps[1]!.relationship.id = "redirect-db";
    expect(
      applyOperations(
        design,
        [
          {
            op: "setArchitecture",
            architecture: { ...design.architecture!, scenarios: [scenario] },
          },
        ],
        testLookup,
      ).ok,
    ).toBe(false);
  });

  it("protects referenced wiring until its steps are removed in the same atomic batch", () => {
    const design = target();
    const before = structuredClone(design);
    expect(applyOperations(design, [{ op: "disconnect", id: "web-api" }], testLookup).ok).toBe(
      false,
    );
    expect(applyOperations(design, [{ op: "removeElement", id: "web" }], testLookup).ok).toBe(
      false,
    );
    expect(design).toEqual(before);
    const architecture = structuredClone(design.architecture!);
    architecture.scenarios = architecture.scenarios!.filter(
      (scenario) => scenario.id !== "owner-link",
    );
    for (const component of architecture.components ?? [])
      component.usesConnections = component.usesConnections.filter((id) => id !== "web-api");
    const result = applyOperations(
      design,
      [
        { op: "disconnect", id: "web-api" },
        { op: "setArchitecture", architecture },
      ],
      testLookup,
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.design.connections.some((connection) => connection.id === "web-api")).toBe(
        false,
      );
    architecture.scenarios = [componentScenario()];
    architecture.componentRelationships = architecture.componentRelationships!.filter(
      (relationship) => relationship.id !== "organizations-accounts",
    );
    expect(applyOperations(design, [{ op: "setArchitecture", architecture }], testLookup).ok).toBe(
      false,
    );
  });
});

it("couples a client state to an authoritative REST operation and expires review on live source edits", () => {
  const d = journeys();
  const sourceDesign = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/generated-workspace.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const source = contractSources(sourceDesign).find(
    (s) => s.source.kind === "rest-operation",
  )!.source;
  d.elements.push(...sourceDesign.elements);
  const c = d.architecture!.contracts!.find((c) => c.id === "update-link")!;
  delete c.shape;
  c.source = source;
  c.sourceDesignRevision = d.revision;
  c.sourceSnapshot = contractCanonical(resolveContractSource(d, source));
  delete d.architecture!.bindings!.find((b) => b.id === "owner-update-binding")!.operation;
  expect(validateScenarios(d)).toEqual([]);
  const scenario = d.architecture!.scenarios![2]!;
  scenario.review = { fingerprint: scenarioReview(d, scenario).fingerprint };
  expect(scenarioReview(d, scenario).status).toBe("Reviewed");
  if (source.kind !== "rest-operation") throw new Error("Expected an operation source");
  d.elements
    .find((e) => e.id === source.element)!
    .attachments.find((a) => a.id === source.attachment)!.config.basePath = "/changed-api";
  expect(scenarioReview(d, scenario).status).toBe("Stale");
});

it("preserves a legacy P45 step named main while reserving main only for new path identities", () => {
  const d = target();
  d.architecture!.scenarios![0]!.steps[0]!.id = "main";
  expect(validateScenarios(d)).toEqual([]);
  expect(designSchema.parse(d)).toEqual(d);
  expect(
    applyOperations(d, [{ op: "setArchitecture", architecture: d.architecture! }], testLookup).ok,
  ).toBe(true);
});

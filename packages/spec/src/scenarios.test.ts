import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { validateArchitecture } from "./architecture.ts";
import { architectureExample } from "./architecture-examples.ts";
import { designSchema } from "./design.ts";
import {
  type ArchitectureScenario,
  architectureScenarioSchema,
  scenarioRelationships,
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

import { expect, it } from "vitest";
import {
  type ArchitectureEvidence,
  acceptanceEvidence,
  type RecordedGeneration,
  summarizeArchitectureEvidence,
} from "./evidence.ts";

const generation = (): RecordedGeneration => ({
  id: 4,
  revision: 2,
  outputDir: "/tmp/project",
  baseline: true,
  status: "succeeded",
  createdAt: "2026-10-31T08:00:00Z",
  finishedAt: "2026-10-31T08:00:01Z",
  stages: [
    "generate",
    "env",
    "install",
    "typecheck",
    "compose-up",
    "test-packs",
    "behavior",
    "compose-down",
  ].map((id) => ({ id, title: id, status: "passed" })),
  checks: [
    {
      subject: "inventory",
      template: "rest-api-server@0.1.0",
      id: "contracts",
      title: "Contracts",
      status: "passed",
    },
  ],
  omittedChecks: 0,
  omittedStages: 0,
});
const evidence = (): ArchitectureEvidence => ({
  projectId: "one",
  revision: 2,
  outputDir: "/tmp/project",
  generation: generation(),
  run: null,
});
it("keeps recorded status separate from revision/output identity and refuses incomplete or deferred application evidence", () => {
  const input = evidence();
  expect(summarizeArchitectureEvidence(input)).toMatchObject({
    state: "passed",
    current: true,
    layers: { template: { passed: 1, failed: 0, skipped: 0 } },
  });
  input.revision = 3;
  expect(summarizeArchitectureEvidence(input)).toMatchObject({
    state: "passed",
    current: false,
    revisionMatches: false,
  });
  input.revision = 2;
  input.outputDir = "/tmp/other";
  expect(summarizeArchitectureEvidence(input)).toMatchObject({
    current: false,
    outputMatches: false,
  });
  input.generation!.omittedChecks = 1;
  expect(summarizeArchitectureEvidence(input).state).toBe("incomplete");
  input.generation = generation();
  input.generation.checks.push({
    subject: "inventory",
    template: "acceptance",
    id: "inventory-command",
    title: "Reserve",
    layer: "application",
    status: "skipped",
    acceptanceIds: ["INV-01"],
  });
  expect(summarizeArchitectureEvidence(input)).toMatchObject({
    state: "incomplete",
    layers: { application: { passed: 0, failed: 0, skipped: 1 } },
  });
  input.generation.checks[1]!.status = "failed";
  expect(summarizeArchitectureEvidence(input).state).toBe("failed");
  input.generation = generation();
  input.generation.stages = [];
  expect(summarizeArchitectureEvidence(input).state).toBe("incomplete");
  input.generation = generation();
  input.generation.baseline = false;
  expect(summarizeArchitectureEvidence(input).state).toBe("written");
  for (const status of ["running", "failed", "blocked", "cancelled", "interrupted"] as const) {
    input.generation.status = status;
    expect(summarizeArchitectureEvidence(input).state).toBe(status);
  }
  input.generation = null;
  expect(summarizeArchitectureEvidence(input)).toMatchObject({ state: "none", current: false });
});
it("matches named acceptance in its real service scope and keeps failures/deferred/unrecorded references visible", () => {
  const pass = {
    subject: "inventory",
    template: "acceptance",
    id: "suite",
    title: "Inventory",
    layer: "application" as const,
    status: "passed" as const,
    acceptanceIds: ["INV-01", "INV-02"],
  };
  expect(acceptanceEvidence(["INV-01", "INV-03"], [pass], "other")).toEqual([
    { id: "INV-01", status: "unrecorded" },
    { id: "INV-03", status: "unrecorded" },
  ]);
  expect(
    acceptanceEvidence(
      ["INV-01", "INV-02", "INV-03"],
      [pass, { ...pass, subject: "inventory/api", status: "skipped", acceptanceIds: ["INV-02"] }],
      "inventory",
    ),
  ).toEqual([
    { id: "INV-01", status: "passed" },
    { id: "INV-02", status: "skipped" },
    { id: "INV-03", status: "unrecorded" },
  ]);
  expect(
    acceptanceEvidence(["INV-01"], [pass, { ...pass, status: "failed" }], "inventory")[0]?.status,
  ).toBe("failed");
  expect(
    acceptanceEvidence(["INV-01"], [{ ...pass, layer: "template" }], "inventory")[0]?.status,
  ).toBe("unrecorded");
});

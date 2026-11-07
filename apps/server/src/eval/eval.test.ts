import { createFakeProvider } from "@jeeves/providers";
import { type DesignDocument, studioPatterns, validateDesign } from "@jeeves/spec";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openTestDb } from "../test-support.ts";
import { cases, commands } from "./cases.ts";
import { runCase } from "./harness.ts";
import { syntheticProvider } from "./offline.ts";
import { liveBlocker } from "./policy.ts";
import { compact, type Report } from "./runner.ts";
import { type Outcome, score, stable } from "./score.ts";

let database: Awaited<ReturnType<typeof openTestDb>>;
beforeAll(async () => {
  database = await openTestDb();
});
afterAll(async () => {
  await database.close();
});
const testCase = (id: string) => {
  const found = cases.find((c) => c.id === id);
  if (!found) throw new Error(id);
  return found;
};
const outcome = (design: DesignDocument, reply = ""): Outcome => ({
  design,
  reply,
  obligationText: [],
  error: null,
});
const failed = (id: string, value: Outcome) =>
  score(testCase(id), testCase(id).seed(), value)
    .filter((c) => !c.pass && c.critical)
    .map((c) => c.id);

describe("RF06 deterministic external rubric", () => {
  it("does not display seed quality failures as evaluated outcomes after an access rejection", () => {
    const markdown = compact({
      model: "blocked",
      reasoning: "none",
      version: "1.0.0",
      patternVersion: "1.0.0",
      sourceCommit: "test",
      results: [
        {
          id: "blocked",
          arm: "current",
          rounds: [{ error: "No credits", latencyMs: 1, requestHash: "test" }],
          checks: [
            { id: "invented-quality-failure", pass: false, critical: true, evidence: "seed only" },
          ],
          error: "No credits",
          question: null,
          refusals: 0,
          repairBatches: 0,
          latencyMs: 1,
        },
      ],
    } as Report);
    expect(markdown).toContain("not evaluated");
    expect(markdown).toContain("No model response; design quality not evaluated.");
    expect(markdown).not.toContain("invented-quality-failure");
  });
  it("counts response batches containing both command and scope attempts after received review", async () => {
    const test = testCase("tinyurl-unsupported-edit");
    const provider = createFakeProvider([
      { toolCalls: [{ name: "reviewDesign", arguments: {} }] },
      {
        toolCalls: [
          {
            name: "applyStudioCommands",
            arguments: {
              baseRevision: 1,
              commands: [{ type: "editSystem", name: "Metering fixture" }],
            },
          },
          {
            name: "applyStudioCommands",
            arguments: {
              baseRevision: 1,
              commands: [{ type: "editSystem", description: "Synthetic metering only." }],
            },
          },
          {
            name: "declareReviewScope",
            arguments: { patterns: [], assumptions: ["Synthetic metering only"], obligations: [] },
          },
        ],
      },
      { text: "Review before saving." },
      { text: "Done." },
    ]);
    const result = await runCase(database.db, test, "current", provider);
    expect(result.error).toBeNull();
    expect(result.repairBatches).toBe(1);
    expect(result.activity.filter((a) => a.tool === "applyStudioCommands" && a.ok)).toHaveLength(2);
  });
  it("stops on the demonstrated no-credits rejection without treating ordinary validation as access failure", () => {
    expect(
      liveBlocker("You have no credits remaining. Add credits to continue using the API."),
    ).toBe(true);
    expect(liveBlocker("OpenAI quota exhausted")).toBe(true);
    expect(liveBlocker("Command 3 violates a lane rule")).toBe(false);
    expect(liveBlocker(null)).toBe(false);
  });
  it("refuses undeclared baseline tools and continues without executing review or mutation", async () => {
    const test = testCase("tinyurl-unsupported-edit");
    const provider = createFakeProvider([
      {
        toolCalls: [
          {
            name: "declareReviewScope",
            arguments: { patterns: [], assumptions: [], obligations: [] },
          },
        ],
      },
      { text: "Unsupported; no changes." },
    ]);
    const result = await runCase(database.db, test, "rf00-ablation", provider);
    expect(result.error).toBeNull();
    expect(result.refusals).toBe(1);
    expect(result.toolResults[0]?.output).toContain("no tool named");
    expect(result.activity.some((a) => a.tool === "reviewDesign")).toBe(false);
    expect(result.design).toEqual(result.before);
    expect(provider.requests).toHaveLength(2);
  });
  it.each(cases)(
    "replays $id deterministically through both real loops without a network",
    async (test) => {
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("Offline replay must never use network"));
      try {
        for (const arm of ["rf00-ablation", "current"] as const) {
          const provider = syntheticProvider(test, arm);
          const first = await runCase(database.db, test, arm, provider);
          expect(first.error).toBeNull();
          expect(first.checks.filter((c) => !c.pass)).toEqual([]);
          const second = await runCase(database.db, test, arm, syntheticProvider(test, arm));
          expect(stable(second)).toBe(stable(first));
          if (arm === "current" && test.task !== "edit") {
            expect(first.toolResults.some((r) => r.callId.startsWith("jeeves-review-"))).toBe(true);
            expect(
              provider.requests
                .at(-1)
                ?.items.some((i) => i.type === "tool-call" && i.name === "reviewDesign"),
            ).toBe(true);
          }
          if (arm === "rf00-ablation")
            expect(first.activity.some((a) => a.tool === "reviewDesign")).toBe(false);
        }
        expect(fetch).not.toHaveBeenCalled();
      } finally {
        fetch.mockRestore();
      }
    },
    30_000,
  );

  it("catches durable-original deletion, search bypass and unrelated destructive edits", () => {
    const test = testCase("video-publication-repair");
    const bad = structuredClone(test.seed());
    bad.elements = bad.elements.filter((e) => e.id !== "originals");
    const failures = failed(test.id, outcome(bad));
    expect(failures).toContain("preserve-originals");
    expect(failures).toContain("structurally-valid");
    expect(failures).toContain("publication-owner-feed");
    const changed = structuredClone(test.seed());
    const bucket = changed.elements.find((e) => e.id === "outputs");
    if (bucket) bucket.description = "silently overwritten";
    expect(failed(test.id, outcome(changed))).toContain("preserve-outputs");
  });
  it("never grades a module or optimistic prose as implemented domain behavior", () => {
    const checkout = testCase("checkout-late-notification-edit");
    const bad = outcome(
      checkout.seed(),
      "Stock reservations and duplicate notifications are now guaranteed by the module.",
    );
    expect(failed(checkout.id, bad)).toContain("obligation-finite-stock");
    expect(failed(checkout.id, bad)).toContain("obligation-checkout-contract");
    const unsupported = testCase("tinyurl-unsupported-edit");
    expect(
      failed(
        unsupported.id,
        outcome(
          unsupported.seed(),
          "We have implemented exactly-once global analytics and successfully deployed it.",
        ),
      ),
    ).toContain("claim-scan");
  });
  it("catches response caching that bypasses analytics and missing pending/failed/duplicate requirements", () => {
    const tiny = testCase("tinyurl-response-cache-repair");
    expect(failed(tiny.id, outcome(tiny.seed()))).toContain("redirect-response-cache-safe");
    const example = studioPatterns["durable-background-job"].example;
    if (example.kind !== "commands") throw new Error("No example");
    const design = commands(testCase("video-build").seed(), example.commands);
    expect(validateDesign(design).some((f) => f.severity === "error")).toBe(false);
    expect(failed("video-build", outcome(design, "Processing is complete and safe."))).toEqual(
      expect.arrayContaining(["obligation-durable-attempt", "obligation-duplicate-delivery"]),
    );
  });
  it("accepts plain-language unresolved obligations and reasonable renamed build roles", () => {
    const test = testCase("video-build");
    const example = studioPatterns["durable-background-job"].example;
    if (example.kind !== "commands") throw new Error("No example");
    let design = commands(test.seed(), example.commands);
    design = commands(design, [{ type: "edit", element: "processor", name: "Encoding runner" }]);
    const result = score(
      test,
      test.seed(),
      outcome(
        design,
        "Unresolved implementation obligations: pending/failed status with attempt correlation and duplicate jobs with safe retries.",
      ),
    );
    expect(result.every((c) => c.pass)).toBe(true);
  });
});

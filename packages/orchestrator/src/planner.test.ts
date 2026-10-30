import { createFakeProvider, ProviderError } from "@jeeves/providers";
import { describe, expect, it } from "vitest";
import {
  checkSubmittedPlan,
  MAX_PLANNER_ROUNDS,
  plannerMessage,
  refinePlan,
  SUBMIT_PLAN,
  type SubmittedPlan,
} from "./planner.ts";
import { seedPlan } from "./seed.ts";
import { fixtureDesign, lockOf, templates } from "./test-support.ts";

const design = fixtureDesign();
const seed = seedPlan({ design, lock: lockOf(design), templates: templates.lookup });
const input = { projectName: "Shorty", seed, briefs: { links: "# Links brief", web: "# Web" } };

const acceptance = ["a test"];
const valid: SubmittedPlan = {
  summary: "Split the service.",
  tasks: [
    { element: "web", title: "Build the page", description: "Form and list", acceptance },
    { element: "links", title: "Redirect codes", description: "302", acceptance },
    {
      element: "links",
      attachment: "links-api",
      title: "Links API",
      description: "CRUD",
      acceptance,
    },
    { element: "links", title: "Count clicks", description: "Clicks", acceptance },
  ],
};

it("does not call a planner for structured extension tasks", async () => {
  const design = fixtureDesign("resources");
  const seed = seedPlan({ design, lock: lockOf(design), templates: templates.lookup });
  const provider = createFakeProvider([]);
  const result = await refinePlan(provider, "fake", { projectName: "Resources", seed, briefs: {} });
  expect(provider.requests).toHaveLength(0);
  expect(result).toMatchObject({ ok: true, tasks: seed, rounds: 0 });
});

describe("checkSubmittedPlan", () => {
  it("puts tasks back in seed order, keeps splits in the model's order, and keeps seed paths", () => {
    const checked = checkSubmittedPlan(seed, valid);
    if (!checked.ok) throw new Error(checked.errors.join());
    expect(checked.tasks.map((t) => [t.key, t.title])).toEqual([
      ["links.links-api", "Links API"],
      ["links", "Redirect codes"],
      ["links-2", "Count clicks"],
      ["web", "Build the page"],
    ]);
    expect(checked.tasks[2]).toMatchObject({
      ownedPaths: ["contracts/links.openapi.yaml", "services/links/"],
      dependsOn: ["links-db"],
      acceptance,
      source: "planner",
    });
  });

  it("rejects unknown targets and uncovered seed tasks", () => {
    const checked = checkSubmittedPlan(seed, {
      tasks: [
        { element: "links-db", title: "Tables", description: "x", acceptance },
        { element: "links", title: "All", description: "x", acceptance },
      ],
    });
    expect(checked).toEqual({
      ok: false,
      errors: [
        expect.stringMatching(
          /element "links-db", which has no seed task.*"links.links-api", "links", "web"/,
        ),
        'The seed task for "links.links-api" isn\'t covered by any task.',
        'The seed task for "web" isn\'t covered by any task.',
      ],
    });
  });
});

describe("refinePlan", () => {
  it("returns the checked plan and the usage", async () => {
    const provider = createFakeProvider([
      {
        toolCalls: [{ name: SUBMIT_PLAN, arguments: valid }],
        usage: { inputTokens: 50, outputTokens: 9 },
      },
    ]);
    const result = await refinePlan(provider, "planner-model", input);
    expect(result).toMatchObject({
      ok: true,
      summary: "Split the service.",
      usage: { inputTokens: 50, outputTokens: 9, known: true },
      rounds: 1,
    });
    const request = provider.requests[0];
    expect(request?.model).toBe("planner-model");
    expect(request?.tools.map((t) => t.name)).toEqual([SUBMIT_PLAN]);
    const message = JSON.stringify(request?.items[0]);
    expect(message).toContain("Refine the seed plan");
    expect(message).toContain("# Links brief");
  });

  it("sends errors back and accepts a corrected plan", async () => {
    const provider = createFakeProvider([
      { text: "Here is my plan in prose." },
      { toolCalls: [{ name: SUBMIT_PLAN, arguments: "{not json" }] },
      { toolCalls: [{ name: SUBMIT_PLAN, arguments: valid }], usage: null },
    ]);
    const result = await refinePlan(provider, "m", input);
    expect(result).toMatchObject({ ok: true, rounds: 3, usage: { known: false } });
    const last = provider.requests[2]?.items.at(-1);
    expect(last).toMatchObject({
      type: "tool-result",
      output: expect.stringContaining("valid JSON"),
    });
  });

  it("gives up after the round limit with the last problem", async () => {
    const bad = { tasks: [{ element: "nope", title: "t", description: "d", acceptance }] };
    const provider = createFakeProvider(() => ({
      toolCalls: [{ name: SUBMIT_PLAN, arguments: bad }],
    }));
    const result = await refinePlan(provider, "m", input);
    expect(result).toMatchObject({ ok: false, rounds: MAX_PLANNER_ROUNDS });
    expect(result.ok || result.reason).toMatch(/element "nope"/);
    expect(provider.requests).toHaveLength(MAX_PLANNER_ROUNDS);
  });

  it("rejects a task without acceptance tests", async () => {
    const noTests = { tasks: valid.tasks.map((t) => ({ ...t, acceptance: [] })) };
    const provider = createFakeProvider([
      { toolCalls: [{ name: SUBMIT_PLAN, arguments: noTests }] },
      { toolCalls: [{ name: SUBMIT_PLAN, arguments: valid }] },
    ]);
    const result = await refinePlan(provider, "m", input);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(provider.requests[1]?.items.at(-1))).toContain("tasks.0.acceptance");
  });

  it("throws provider errors to the caller", async () => {
    const provider = createFakeProvider([{ error: "quota" }]);
    await expect(refinePlan(provider, "m", input)).rejects.toBeInstanceOf(ProviderError);
  });

  it("truncates long briefs", () => {
    const message = plannerMessage({ ...input, briefs: { links: "x".repeat(20_000) } });
    expect(message).toContain("[brief truncated]");
    expect(message).toContain("(no brief)");
  });
});

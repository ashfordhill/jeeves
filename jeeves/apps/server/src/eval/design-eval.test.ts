import { designReview } from "@jeeves/spec";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { V3_MODULES, V3_TILES } from "../../../../packages/spec/src/fixtures/v3-modules.ts";
import { installedGenerationSupport } from "../generation/support.ts";
import { openTestDb } from "../test-support.ts";
import { buildCase, reviewCases, V3_BRIEF } from "./design-cases.ts";
import type { CapabilityScore } from "./design-rubric.ts";
import {
  checkScripted,
  type DesignReport,
  designMarkdown,
  liveProvider,
  parseModels,
  replayDesignReport,
  runScripted,
  usage,
} from "./design-runner.ts";
import type { BuildScore, ReviewScore } from "./design-score.ts";
import { scriptedArms } from "./design-scripts.ts";

const quiet = () => {};
let database: Awaited<ReturnType<typeof openTestDb>>;
let report: DesignReport;
const fetch = vi.spyOn(globalThis, "fetch");
beforeAll(async () => {
  fetch.mockRejectedValue(new Error("Offline design evals must never use a network"));
  database = await openTestDb();
  // Every arm runs twice and must repeat itself exactly.
  report = await runScripted(database.db, scriptedArms);
}, 120_000);
afterAll(async () => {
  fetch.mockRestore();
  await database.close();
});
const run = (label: string) => {
  const found = report.runs.find((item) => item.label === label);
  if (!found) throw new Error(label);
  return found;
};
const build = (label: string, id = "v3-build") =>
  run(label).results.find((item) => item.id === id)?.score as BuildScore;
const capability = (label: string, id: string) =>
  run(label).results.find((item) => item.id === id)?.score as CapabilityScore;
const reviews = (label: string) =>
  run(label)
    .results.filter((item) => item.kind === "review")
    .map((item) => [item.id, (item.score as ReviewScore).score]);

describe("the chat design evals, offline (V3-10)", () => {
  it("discriminate: the good scripted run scores high, the patterns run in between, the bad one low", () => {
    expect(() => checkScripted(report)).not.toThrow();
    expect(build("scripted-good").total).toBe(100);
    expect(reviews("scripted-good").every(([, score]) => score === 100)).toBe(true);
    const patterns = build("scripted-patterns");
    expect(patterns.total).toBeGreaterThan(80);
    expect(patterns.total).toBeLessThan(95);
    // The patterns build every tile, but leave the brief's names, values and processes.
    expect(patterns.areas.tiles.score).toBe(100);
    expect(patterns.areas.templates.score).toBeLessThan(80);
    expect(build("scripted-bad").total).toBeLessThan(5);
    // The product briefs: the patterns carry the capabilities whatever the names (V3-19); the
    // good run also turns Runnable processes on; the generic site has few of them.
    for (const id of ["video-build", "podcast-build"]) {
      expect(capability("scripted-good", id).total).toBe(100);
      const placeholders = capability("scripted-patterns", id);
      expect(placeholders.total).toBeGreaterThan(95);
      expect(placeholders.capabilities.templates.items).toContainEqual(
        expect.objectContaining({ key: "Runnable processes on", credit: 0 }),
      );
      expect(capability("scripted-bad", id).total).toBeLessThan(30);
    }
    // Saying "looks fine" earns only the advice case's no-change, unnamed.
    expect(reviews("scripted-bad")).toEqual(
      reviewCases.map((item) => [item.id, item.expect === "keep" ? 50 : 0]),
    );
    for (const item of report.runs.flatMap((entry) => entry.results)) expect(item.error).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("runs each case through the production chat loop, saving one turn", () => {
    const good = run("scripted-good").results;
    const v3 = good.find((item) => item.id === "v3-build");
    expect(v3?.tools).toEqual({ listStudioPatterns: 1, applyPattern: 6, applyStudioCommands: 1 });
    // The service's pre-save review is the fifth request; the turn saved one revision.
    expect(v3?.rounds).toHaveLength(5);
    expect(v3?.design.revision).toBe(1);
    expect(v3?.reply).toContain("Left in the design: 0 to fix and 2 to check");
    for (const item of good.filter((entry) => entry.kind === "review"))
      expect(item.tools.reviewDesign).toBe(1);
  });

  it("replays a recorded report offline and refuses drift", async () => {
    await expect(replayDesignReport(database.db, report, quiet)).resolves.toBeUndefined();
    const drifted = structuredClone(report);
    const round = drifted.runs[0]?.results[1]?.rounds[0];
    if (!round) throw new Error("A review round was recorded");
    round.requestHash = "0".repeat(64);
    await expect(replayDesignReport(database.db, drifted, quiet)).rejects.toThrow(/context drift/);
    const rescored = structuredClone(report);
    const first = rescored.runs[0]?.results[0];
    if (!first) throw new Error("The build was recorded");
    (first.score as BuildScore).total = 42;
    await expect(replayDesignReport(database.db, rescored, quiet)).rejects.toThrow(
      /Replay mismatch/,
    );
    expect(fetch).not.toHaveBeenCalled();
  }, 120_000);

  it("measures each run's requests and bytes for the cost estimate", () => {
    const measured = usage(run("scripted-good").results);
    expect(measured.requests).toBe(53);
    // Every request repeats the instructions and tools: still most of what a run sends, though
    // less since V3-19 shrank the tools (84% before, 69% now).
    expect(measured.promptBytes / measured.requestBytes).toBeGreaterThan(0.5);
    expect(measured.promptBytes / measured.requestBytes).toBeLessThan(0.75);
    expect(measured.tokens).toBeNull();
    const markdown = designMarkdown(report);
    expect(markdown).toContain("| scripted-good | 100 | 100 | 100 | 100 | 53 |");
    expect(markdown).toContain("not model quality");
  });

  it("seeds each review case with its one defect, one per review finding class", () => {
    const installed = installedGenerationSupport();
    expect(reviewCases.map((item) => item.check)).toEqual([
      "module-status",
      "unconnected-slot",
      "generation",
      "store-without-writer",
      "unrelated-store",
      "user-reaches-store",
      "long-line",
      "line-style",
      "generation",
      "warning",
    ]);
    for (const item of reviewCases) {
      const seed = item.seed();
      const findings = designReview(seed, installed).findings;
      expect(findings.map((finding) => finding.check)).toContain(item.check);
      // Besides the defect, only advice (and, for a dashed store line, its generation echo).
      const others = findings.filter(
        (finding) =>
          finding.check !== item.check &&
          finding.severity === "fix" &&
          !(item.check === "line-style" && finding.check === "generation"),
      );
      expect([item.id, others]).toEqual([item.id, []]);
    }
  });

  it("gives the brief in prose: every tile and module named, no IDs or command syntax", () => {
    for (const step of V3_TILES) if ("tile" in step) expect(V3_BRIEF).toContain(step.tile);
    for (const modules of Object.values(V3_MODULES))
      for (const item of modules) expect(V3_BRIEF).toContain(item.name);
    const reference = buildCase.reference(installedGenerationSupport());
    const ids = [
      ...reference.elements.map((item) => item.id),
      ...(reference.architecture?.studio?.components ?? []).map((item) => item.id),
    ].filter((id) => id.includes("-") && id !== "sign-in");
    for (const id of ids) expect(V3_BRIEF).not.toContain(id);
    expect(V3_BRIEF).not.toMatch(
      /addTile|linkTiles|addModule|connectModule|editComponent|applyPattern|setRunnableProcesses|baseRevision|[{}]/,
    );
  });
});

describe("the live comparison's configuration", () => {
  it("takes provider:model pairs from the provider catalog, one provider per command", () => {
    expect(parseModels("openai:gpt-5.4-mini-2026-03-17,openai:gpt-5.5")).toEqual([
      { provider: "openai", model: "gpt-5.4-mini-2026-03-17" },
      { provider: "openai", model: "gpt-5.5" },
    ]);
    expect(parseModels("codex:gpt-6.1-sol,codex:")).toEqual([
      { provider: "codex", model: "gpt-6.1-sol" },
      { provider: "codex", model: "" },
    ]);
    expect(() => parseModels(undefined)).toThrow("--models=");
    expect(() => parseModels("acme:big")).toThrow('Unknown provider "acme"');
    expect(() => parseModels("openai:")).toThrow("Enter a model name");
    expect(() => parseModels("openai:gpt-5.5,codex:gpt-6.1-sol")).toThrow(
      "one provider per command",
    );
  });

  it("builds no provider without its credentials from the environment", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("CODEX_API_KEY", "");
    try {
      expect(() => liveProvider({ provider: "openai", model: "gpt-5.5" })).toThrow(
        "OPENAI_API_KEY is absent; no requests sent",
      );
      vi.stubEnv("OPENAI_API_KEY", "set-for-this-test-only");
      expect(() => liveProvider({ provider: "codex", model: "" })).toThrow(
        "Run Codex with OPENAI_API_KEY and CODEX_API_KEY unset",
      );
    } finally {
      vi.unstubAllEnvs();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

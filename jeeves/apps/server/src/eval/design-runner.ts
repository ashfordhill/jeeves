/**
 * The design eval runs (V3-10): scripted offline arms, a live comparison of configured models,
 * replay of a recorded report, and the report's summary with its measured size and cost. No
 * network or credentials are used unless the runner's `--live --allow-paid-api` are both given.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createCodexModelProvider,
  createOpenAIProvider,
  type ModelProvider,
  type ProviderId,
  providerCatalog,
  type RoleModel,
  roleModelProblem,
} from "@jeeves/providers";
import { INSTRUCTIONS, toolDefinitions } from "../chat/tools.ts";
import type { Db } from "../db/client.ts";
import { installedGenerationSupport } from "../generation/support.ts";
import {
  DESIGN_EVAL_VERSION,
  DESIGN_LIMITS,
  type DesignCase,
  designCases,
  V3_BRIEF,
} from "./design-cases.ts";
import {
  type DesignCaseResult,
  type DesignRound,
  recording,
  replaying,
  runDesignCase,
} from "./design-harness.ts";
import { type BuildScore, type DesignArea, designAreas, type ReviewScore } from "./design-score.ts";
import { armCases, type ScriptedArm, scriptedProvider } from "./design-scripts.ts";
import { liveBlocker } from "./policy.ts";
import { stable } from "./score.ts";

export type DesignRun = {
  /** `scripted-good`, or `<provider>:<model>` for a live run. */
  label: string;
  provider: string;
  model: string;
  results: DesignCaseResult[];
};
export type DesignReport = {
  suite: "design";
  version: string;
  mode: "live" | "scripted";
  generatedAt: string;
  sourceCommit: string;
  limits: typeof DESIGN_LIMITS;
  hashes: Record<string, string>;
  runs: DesignRun[];
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
/** What a run reproduces exactly: everything but timings. */
const semantics = (result: Omit<DesignCaseResult, "rounds" | "latencyMs">) =>
  stable({
    id: result.id,
    modelText: result.modelText,
    reply: result.reply,
    error: result.error,
    tools: result.tools,
    refusals: result.refusals,
    design: result.design,
    score: result.score,
  });

export function reportHashes(): Record<string, string> {
  return {
    prompt: sha(INSTRUCTIONS),
    tools: sha(stable(toolDefinitions())),
    brief: sha(V3_BRIEF),
    cases: sha(stable(designCases.map((item) => ({ ...item, seed: item.seed() })))),
  };
}
function sourceCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
const newReport = (mode: DesignReport["mode"]): DesignReport => ({
  suite: "design",
  version: DESIGN_EVAL_VERSION,
  mode,
  generatedAt: new Date().toISOString(),
  sourceCommit: sourceCommit(),
  limits: DESIGN_LIMITS,
  hashes: reportHashes(),
  runs: [],
});

/** One case with a recording provider. */
async function recorded(
  db: Db,
  test: DesignCase,
  provider: ModelProvider,
  model: string,
): Promise<DesignCaseResult> {
  const rounds: DesignRound[] = [];
  const started = performance.now();
  const signal = AbortSignal.timeout(DESIGN_LIMITS.caseTimeoutMs);
  const result = await runDesignCase(
    db,
    test,
    recording(provider, rounds, signal),
    model,
    installedGenerationSupport(),
  );
  return { ...result, rounds, latencyMs: performance.now() - started };
}

/** The scripted arms, each run twice to prove it is deterministic. */
export async function runScripted(
  db: Db,
  arms: readonly ScriptedArm[],
  cases: readonly DesignCase[] = designCases,
): Promise<DesignReport> {
  const report = newReport("scripted");
  for (const arm of arms) {
    const run: DesignRun = {
      label: `scripted-${arm}`,
      provider: "fake",
      model: `scripted-${arm}`,
      results: [],
    };
    for (const test of armCases(arm, cases)) {
      const first = await recorded(db, test, scriptedProvider(test, arm), run.model);
      const second = await recorded(db, test, scriptedProvider(test, arm), run.model);
      const hashes = (result: DesignCaseResult) => result.rounds.map((item) => item.requestHash);
      if (
        semantics(first) !== semantics(second) ||
        stable(hashes(first)) !== stable(hashes(second))
      )
        throw new Error(`Scripted ${arm} run of ${test.id} is not deterministic`);
      run.results.push(first);
    }
    report.runs.push(run);
  }
  return report;
}

/** `openai:gpt-5.4-mini,openai:gpt-5.5` as role choices, checked against the provider catalog. */
export function parseModels(value: string | undefined): RoleModel[] {
  if (!value) throw new Error("Name the models to compare: --models=<provider>:<model>,…");
  const choices = value.split(",").map((item): RoleModel => {
    const at = item.indexOf(":");
    const provider = (at < 0 ? item : item.slice(0, at)).trim();
    const model = at < 0 ? "" : item.slice(at + 1).trim();
    if (!providerCatalog.some((info) => info.id === provider))
      throw new Error(
        `Unknown provider "${provider}"; the providers are ${providerCatalog.map((info) => info.id).join(", ")}.`,
      );
    const choice = { provider: provider as ProviderId, model };
    const problem = roleModelProblem("designChat", choice);
    if (problem) throw new Error(`${item}: ${problem}`);
    return choice;
  });
  if (new Set(choices.map((item) => item.provider)).size > 1)
    throw new Error(
      "Compare models of one provider per command: the OpenAI API needs OPENAI_API_KEY set and Codex needs it unset.",
    );
  return choices;
}

/** The live provider for a choice, with its key from the environment only. */
export function liveProvider(choice: RoleModel): ModelProvider {
  if (choice.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is absent; no requests sent");
    return createOpenAIProvider({ apiKey, maxRetries: 0 });
  }
  if (process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY)
    throw new Error("Run Codex with OPENAI_API_KEY and CODEX_API_KEY unset in this subprocess");
  return createCodexModelProvider(
    process.env.JEEVES_CODEX_PATH ? { codexPath: process.env.JEEVES_CODEX_PATH } : {},
  );
}

/**
 * The live comparison: every case once per model, the report written after each case. Every
 * provider is built (and its credentials checked) before the first request; an access or schema
 * failure stops the run before another request.
 */
export async function runLive(db: Db, models: readonly RoleModel[], path: string) {
  const providers = models.map((choice) => ({ choice, provider: liveProvider(choice) }));
  const report = newReport("live");
  await mkdir(dirname(path), { recursive: true });
  const save = async () => {
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(path.replace(/\.json$/, ".md"), designMarkdown(report));
  };
  for (const { choice, provider } of providers) {
    const run: DesignRun = {
      label: `${choice.provider}:${choice.model || "default"}`,
      provider: choice.provider,
      model: choice.model,
      results: [],
    };
    report.runs.push(run);
    for (const test of designCases) {
      const result = await recorded(db, test, provider, choice.model);
      run.results.push(result);
      await save();
      console.log(`${run.label} ${test.id}: ${scoreText(result)}; ${result.error ?? "completed"}`);
      if (liveBlocker(result.error))
        throw new Error(`Live access/schema blocker recorded in ${path}`);
    }
  }
  return report;
}

/** Replays a recorded report offline: the same requests, then the same design and scores. */
export async function replayDesignReport(
  db: Db,
  report: DesignReport,
  log: (line: string) => void = console.log,
) {
  for (const run of report.runs)
    for (const recordedResult of run.results) {
      const test = designCases.find((item) => item.id === recordedResult.id);
      if (!test) throw new Error(`Unknown recorded case ${recordedResult.id}`);
      const label = `${run.label}/${test.id}`;
      const replay = replaying(recordedResult.rounds, label);
      const replayed = await runDesignCase(
        db,
        test,
        replay.provider,
        run.model,
        installedGenerationSupport(),
      );
      if (replay.problem) throw new Error(replay.problem);
      if (replay.left) throw new Error(`Replay of ${label} left ${replay.left} recorded rounds`);
      if (semantics(replayed) !== semantics(recordedResult))
        throw new Error(`Replay mismatch ${label}`);
      log(`replayed ${label}: identical design and scores`);
    }
}

export async function readDesignReport(path: string): Promise<DesignReport | undefined> {
  const report = JSON.parse(await readFile(path, "utf8")) as { suite?: string };
  return report.suite === "design" ? (report as DesignReport) : undefined;
}

const isBuild = (score: BuildScore | ReviewScore): score is BuildScore => "areas" in score;
function scoreText(result: DesignCaseResult) {
  const score = result.score;
  return isBuild(score)
    ? `total ${score.total} (${designAreas.map((key) => `${key} ${score.areas[key].score}`).join(", ")})`
    : `${score.score} (named ${score.named}, fixed ${score.fixed})`;
}

/** What one run sent and received, measured: requests, bytes and the provider's own tokens. */
export function usage(results: readonly DesignCaseResult[]) {
  const rounds = results.flatMap((item) => item.rounds);
  const responses = rounds.flatMap((item) => (item.response ? [item.response] : []));
  const known = responses.length === rounds.length && responses.every((item) => item.usage);
  const sum = (pick: (value: DesignRound) => number) =>
    rounds.reduce((total, item) => total + pick(item), 0);
  return {
    requests: rounds.length,
    requestBytes: sum((item) => item.requestBytes),
    promptBytes: sum((item) => item.promptBytes),
    largestRequestBytes: Math.max(0, ...rounds.map((item) => item.requestBytes)),
    outputBytes: responses.reduce(
      (total, item) => total + Buffer.byteLength(JSON.stringify(item.items)),
      0,
    ),
    tokens: known
      ? {
          input: responses.reduce((total, item) => total + (item.usage?.inputTokens ?? 0), 0),
          cached: responses.reduce(
            (total, item) => total + (item.usage?.cachedInputTokens ?? 0),
            0,
          ),
          output: responses.reduce((total, item) => total + (item.usage?.outputTokens ?? 0), 0),
        }
      : null,
  };
}
/**
 * Bytes as tokens, roughly: about four bytes a token for English, nearer three for JSON with many
 * short keys, so a range.
 */
export const estimatedTokens = (bytes: number) =>
  `${Math.round(bytes / 4).toLocaleString("en-US")}–${Math.round(bytes / 3).toLocaleString("en-US")}`;
/** List prices known to this runner (RF06's, checked 2026-11-07); other models' cost is unknown. */
const pricing: Readonly<Record<string, { input: number; cached: number; output: number }>> = {
  "gpt-5.4-mini": { input: 0.75, cached: 0.075, output: 4.5 },
  "gpt-5.4-mini-2026-03-17": { input: 0.75, cached: 0.075, output: 4.5 },
};
function estimateUsd(run: DesignRun) {
  const price = run.provider === "openai" ? pricing[run.model] : undefined;
  const measured = usage(run.results);
  if (!price || !measured.tokens) return undefined;
  const { input, cached, output } = measured.tokens;
  return (
    ((input - cached) * price.input + cached * price.cached + output * price.output) / 1_000_000
  );
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const mean = (values: readonly number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
const areaLabel: Record<DesignArea, string> = {
  tiles: "Tiles",
  links: "Links",
  modules: "Modules",
  moduleLinks: "Module links",
  templates: "Templates",
};

/** The report in Markdown: the scores side by side, then each run's cases and its measured size. */
export function designMarkdown(report: DesignReport): string {
  const lines = [
    `# Chat design evals (${report.mode})`,
    "",
    `Eval ${report.version}; source ${report.sourceCommit}; ${report.generatedAt}. Limits: ${report.limits.rounds} responses and ${report.limits.maxOutputTokens} output tokens per response, ${report.limits.caseTimeoutMs / 1000} s per case. ${report.mode === "scripted" ? "Scripted models: they prove the scorers and the loop, not model quality." : "One sample per case per model: a small suite, with substantial uncertainty."}`,
    "",
    "## Scores",
    "",
    `| Run | Build total | ${designAreas.map((key) => areaLabel[key]).join(" | ")} | Review | Requests | Input | Output | Est. USD |`,
    `| --- | ---: | ${designAreas.map(() => "---:").join(" | ")} | ---: | ---: | ---: | ---: | ---: |`,
  ];
  for (const run of report.runs) {
    const build = run.results.find((item) => item.kind === "build");
    const reviews = run.results.filter((item) => item.kind === "review");
    const measured = usage(run.results);
    const cost = estimateUsd(run);
    const score = build && isBuild(build.score) ? build.score : undefined;
    lines.push(
      `| ${run.label} | ${score?.total ?? "–"} | ${designAreas.map((key) => score?.areas[key].score ?? "–").join(" | ")} | ${reviews.length ? mean(reviews.map((item) => (item.score as ReviewScore).score)) : "–"} | ${measured.requests} | ${measured.tokens ? `${measured.tokens.input} tokens (${measured.tokens.cached} cached)` : `${kb(measured.requestBytes)} ≈ ${estimatedTokens(measured.requestBytes)} tokens`} | ${measured.tokens ? `${measured.tokens.output} tokens` : `${kb(measured.outputBytes)} ≈ ${estimatedTokens(measured.outputBytes)} tokens`} | ${cost === undefined ? "unknown" : cost.toFixed(4)} |`,
    );
  }
  lines.push(
    "",
    "Build: each area is 100 × credit ÷ the larger of the reference's and the candidate's count; the total is their mean. Review: each case is 50 × named + 50 × fixed; Review is their mean. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses a known list price only (RF06's gpt-5.4-mini, checked 2026-11-07); it is an estimate, not billing.",
    "",
  );
  for (const run of report.runs) {
    const measured = usage(run.results);
    lines.push(
      `## ${run.label}`,
      "",
      `${measured.requests} requests, ${kb(measured.requestBytes)} sent (${kb(measured.promptBytes)} of it the repeated instructions and tools; the largest request ${kb(measured.largestRequestBytes)}), ${kb(measured.outputBytes)} received.`,
      "",
      "| Case | Score | Requests | Sent | Notes |",
      "| --- | ---: | ---: | ---: | --- |",
    );
    for (const result of run.results) {
      const notes = isBuild(result.score)
        ? designAreas
            .flatMap((key) =>
              (result.score as BuildScore).areas[key].items
                .filter((item) => item.credit < 1)
                .slice(0, 3)
                .map((item) => `${item.key}${item.note ? ` (${item.note})` : ""}`),
            )
            .slice(0, 8)
            .join("; ")
        : result.score.notes.join("; ");
      const sent = result.rounds.reduce((total, item) => total + item.requestBytes, 0);
      lines.push(
        `| ${result.id} | ${isBuild(result.score) ? result.score.total : result.score.score} | ${result.rounds.length} | ${kb(sent)} | ${result.error ? `error: ${result.error}; ` : ""}${notes || "none"} |`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * The scripted arms must discriminate: the good build and reviews score high, the patterns-only
 * build in between, the bad ones low. Returns the summary lines; throws when they don't.
 */
export function checkScripted(report: DesignReport): string[] {
  const lines: string[] = [];
  const problems: string[] = [];
  for (const run of report.runs) {
    const build = run.results.find((item) => item.kind === "build");
    const reviews = run.results.filter((item) => item.kind === "review");
    const total = build && isBuild(build.score) ? build.score.total : undefined;
    const review = reviews.length
      ? mean(reviews.map((item) => (item.score as ReviewScore).score))
      : undefined;
    const usageNow = usage(run.results);
    lines.push(
      `design ${run.label}: build ${total ?? "–"}, review ${review ?? "–"}; ${usageNow.requests} requests, ${kb(usageNow.requestBytes)} sent (≈ ${estimatedTokens(usageNow.requestBytes)} tokens), ${kb(usageNow.outputBytes)} received; deterministic; not model-quality evidence`,
    );
    const expect = (ok: boolean, what: string) => ok || problems.push(`${run.label}: ${what}`);
    for (const result of run.results)
      expect(result.error === null, `${result.id} failed: ${result.error}`);
    if (run.label === "scripted-good") {
      expect((total ?? 0) >= 95, `build ${total} < 95`);
      expect((review ?? 0) >= 90, `review ${review} < 90`);
    } else if (run.label === "scripted-patterns") {
      expect((total ?? 0) > 50 && (total ?? 100) < 95, `build ${total} not between 50 and 95`);
    } else if (run.label === "scripted-bad") {
      expect((total ?? 100) <= 20, `build ${total} > 20`);
      expect((review ?? 100) <= 20, `review ${review} > 20`);
    }
  }
  if (problems.length) throw new Error(`Scripted design evals: ${problems.join("; ")}`);
  return lines;
}

export { scoreText };

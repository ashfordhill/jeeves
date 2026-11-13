/**
 * The design eval runs (V3-10, V3-19): scripted offline arms, a live comparison of configured
 * models (each case run `repeat` times), replay of a recorded report, merging reports run side by
 * side, and the report's summary with each score's mean and spread and the measured size and
 * cost. No network or credentials are used unless the runner's `--live --allow-paid-api` are both
 * given.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  ANTHROPIC_DEFAULT_EFFORT,
  createAnthropicProvider,
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
  PODCAST_BRIEF,
  V3_BRIEF,
  VIDEO_BRIEF,
} from "./design-cases.ts";
import {
  type DesignCaseResult,
  type DesignRound,
  recording,
  replaying,
  runDesignCase,
} from "./design-harness.ts";
import { type CapabilityScore, capabilityAreas } from "./design-rubric.ts";
import { type BuildScore, designAreas, type ReviewScore } from "./design-score.ts";
import { armCases, type ScriptedArm, scriptedProvider } from "./design-scripts.ts";
import { liveBlocker } from "./policy.ts";
import { stable } from "./score.ts";

export type DesignRun = {
  /** `scripted-good`, or `<provider>:<model>` for a live run. */
  label: string;
  provider: string;
  model: string;
  /** How each live provider was configured (effort, retries), for the report. */
  settings?: Record<string, unknown>;
  /** Every case's samples, in order; a case run three times has three results. */
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
type Score = DesignCaseResult["score"];

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
    videoBrief: sha(VIDEO_BRIEF),
    podcastBrief: sha(PODCAST_BRIEF),
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

/** Retries a live provider is allowed: none for OpenAI (RF06's rule), the SDK's 2 for Anthropic. */
const liveRetries: Partial<Record<ProviderId, number>> = { openai: 0, anthropic: 2 };

/** The live provider for a choice, with its key from the environment only. */
export function liveProvider(choice: RoleModel): ModelProvider {
  if (choice.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is absent; no requests sent");
    return createOpenAIProvider({ apiKey, maxRetries: liveRetries.openai ?? 0 });
  }
  if (choice.provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is absent; no requests sent");
    return createAnthropicProvider({ apiKey, maxRetries: liveRetries.anthropic ?? 2 });
  }
  // Its key lives only in the config file, which the runner never reads.
  if (choice.provider === "custom")
    throw new Error("The eval runner doesn't run the custom endpoint; no requests sent");
  if (process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY)
    throw new Error("Run Codex with OPENAI_API_KEY and CODEX_API_KEY unset in this subprocess");
  return createCodexModelProvider(
    process.env.JEEVES_CODEX_PATH ? { codexPath: process.env.JEEVES_CODEX_PATH } : {},
  );
}

/** How a live provider runs, as the report records it. */
function liveSettings(choice: RoleModel): Record<string, unknown> {
  switch (choice.provider) {
    case "anthropic":
      return {
        api: "Messages API, streamed; adaptive thinking; prompt caching on",
        effort: ANTHROPIC_DEFAULT_EFFORT,
        maxRetries: liveRetries.anthropic,
      };
    case "codex":
      return { api: "Codex SDK, ChatGPT login, structured answer", effort: "medium" };
    default:
      return { api: "Responses API, strict tools", maxRetries: liveRetries.openai };
  }
}

export type LiveOptions = {
  /** Samples per case per model. */
  repeat?: number;
  /** Only these case IDs. */
  cases?: readonly string[];
  /** Continue a report at `path` from where it stopped (same version and hashes). */
  resume?: boolean;
};

/**
 * The live comparison: every case `repeat` times per model, the report written after each case.
 * Every provider is built (and its credentials checked) before the first request; an access or
 * schema failure stops the run before another request.
 */
export async function runLive(
  db: Db,
  models: readonly RoleModel[],
  path: string,
  options: LiveOptions = {},
) {
  const repeat = options.repeat ?? 1;
  const cases = options.cases?.length
    ? designCases.filter((item) => options.cases?.includes(item.id))
    : designCases;
  if (options.cases?.length && cases.length !== options.cases.length)
    throw new Error(
      `Unknown case in --cases; the cases are ${designCases.map((item) => item.id).join(", ")}.`,
    );
  const providers = models.map((choice) => ({ choice, provider: liveProvider(choice) }));
  let report = newReport("live");
  if (options.resume) {
    const earlier = await readDesignReport(path).catch(() => undefined);
    if (earlier) {
      if (earlier.version !== report.version || stable(earlier.hashes) !== stable(report.hashes))
        throw new Error(`${path} is another eval version or its prompt, tools or cases changed`);
      report = earlier;
    }
  }
  await mkdir(dirname(path), { recursive: true });
  const save = async () => {
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(path.replace(/\.json$/, ".md"), designMarkdown(report));
  };
  for (const { choice, provider } of providers) {
    const label = `${choice.provider}:${choice.model || "default"}`;
    let run = report.runs.find((item) => item.label === label);
    if (!run) {
      run = {
        label,
        provider: choice.provider,
        model: choice.model,
        settings: liveSettings(choice),
        results: [],
      };
      report.runs.push(run);
    }
    for (let sample = 1; sample <= repeat; sample++)
      for (const test of cases) {
        const done = run.results.filter((item) => item.id === test.id).length;
        if (done >= sample) continue;
        const result = await recorded(db, test, provider, choice.model);
        run.results.push(result);
        await save();
        console.log(
          `${run.label} ${test.id} #${sample}: ${scoreText(result)}; ${result.error ?? "completed"}`,
        );
        if (liveBlocker(result.error))
          throw new Error(`Live access/schema blocker recorded in ${path}`);
      }
  }
  await save();
  return report;
}

/**
 * Reports run side by side (one per provider, or per model) as one: the same eval version and
 * hashes, each run once.
 */
export function mergeReports(reports: readonly DesignReport[]): DesignReport {
  const [first] = reports;
  if (!first) throw new Error("Nothing to merge");
  for (const other of reports)
    if (other.version !== first.version || stable(other.hashes) !== stable(first.hashes))
      throw new Error("Only reports of one eval version, prompt, tools and cases merge");
  const runs = reports.flatMap((item) => item.runs);
  if (new Set(runs.map((item) => item.label)).size !== runs.length)
    throw new Error("A run appears in two reports");
  return {
    ...first,
    generatedAt: new Date().toISOString(),
    sourceCommit: [...new Set(reports.map((item) => item.sourceCommit))].join(", "),
    runs,
  };
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

/** A recorded report's JSON, gzipped (`.json.gz`, how large live reports are kept) or not. */
export async function readReportJson(path: string): Promise<unknown> {
  const bytes = await readFile(path);
  return JSON.parse((path.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8"));
}

export async function readDesignReport(path: string): Promise<DesignReport | undefined> {
  const report = (await readReportJson(path)) as { suite?: string };
  return report.suite === "design" ? (report as DesignReport) : undefined;
}

const isBuild = (score: Score): score is BuildScore => "areas" in score;
const isCapability = (score: Score): score is CapabilityScore => "capabilities" in score;
const isReview = (score: Score): score is ReviewScore => "named" in score;
/** A case's score: a build's total, a review's 0–100. */
export const caseScore = (score: Score) => (isReview(score) ? score.score : score.total);
function scoreText(result: DesignCaseResult) {
  const score = result.score;
  if (isBuild(score))
    return `total ${score.total} (${designAreas.map((key) => `${key} ${score.areas[key].score}`).join(", ")})`;
  if (isCapability(score))
    return `total ${score.total} (${capabilityAreas.map((key) => `${key} ${score.capabilities[key].score}`).join(", ")})`;
  return `${score.score} (named ${score.named}, fixed ${score.fixed})`;
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
/**
 * List prices known to this runner, per million tokens: RF06's gpt-5.4-mini (checked 2026-11-07)
 * and Anthropic's (the Claude API's published rates, checked 2026-11-11). Haiku 5.5 has a second
 * rate card for prompts over 100,000 tokens. Other models' cost is unknown.
 */
type Price = { input: number; cached: number; write?: number; output: number };
const pricing: Readonly<Record<string, Price & { long?: Price & { above: number } }>> = {
  "gpt-5.4-mini": { input: 0.75, cached: 0.075, output: 4.5 },
  "gpt-5.4-mini-2026-03-17": { input: 0.75, cached: 0.075, output: 4.5 },
  "claude-haiku-5-5": {
    input: 0.1,
    cached: 0.01,
    write: 0.125,
    output: 0.5,
    long: { above: 100_000, input: 0.5, cached: 0.05, write: 0.625, output: 2.5 },
  },
  "claude-sonnet-5-5": { input: 2, cached: 0.2, write: 2.5, output: 10 },
};
/** A run's list-price cost, per round (a rate card can depend on the round's prompt). */
export function estimateUsd(run: Pick<DesignRun, "provider" | "model" | "results">) {
  const known = run.provider === "openai" || run.provider === "anthropic";
  const card = known ? pricing[run.model] : undefined;
  const rounds = run.results.flatMap((item) => item.rounds);
  if (!card || !rounds.every((item) => item.response?.usage)) return undefined;
  let total = 0;
  for (const round of rounds) {
    const usage = round.response?.usage;
    if (!usage) continue;
    const price = card.long && usage.inputTokens > card.long.above ? card.long : card;
    const cached = usage.cachedInputTokens ?? 0;
    const write = usage.cacheWriteInputTokens ?? 0;
    total +=
      ((usage.inputTokens - cached - write) * price.input +
        cached * price.cached +
        write * (price.write ?? price.input) +
        usage.outputTokens * price.output) /
      1_000_000;
  }
  return total;
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const mean = (values: readonly number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
/** Mean, then the spread: "84.2 (71–96, n=3)", or the value alone for one sample. */
export function spread(values: readonly number[]): string {
  if (!values.length) return "–";
  if (values.length === 1) return String(values[0]);
  return `${mean(values)} (${Math.min(...values)}–${Math.max(...values)}, n=${values.length})`;
}
/** Each sample's review score: the mean of the review cases in that sample. */
function reviewSamples(run: DesignRun): number[] {
  const reviews = run.results.filter((item) => item.kind === "review");
  const ids = [...new Set(reviews.map((item) => item.id))];
  const samples = Math.max(0, ...ids.map((id) => reviews.filter((item) => item.id === id).length));
  return Array.from({ length: samples }, (_, sample) =>
    mean(
      ids.flatMap((id) => {
        const result = reviews.filter((item) => item.id === id)[sample];
        return result ? [caseScore(result.score)] : [];
      }),
    ),
  );
}
const caseSamples = (run: DesignRun, id: string) =>
  run.results.filter((item) => item.id === id).map((item) => caseScore(item.score));
const buildIds = () =>
  designCases.filter((item) => item.kind === "build").map((item) => item.id) as string[];
const reviewIds = () =>
  designCases.filter((item) => item.kind === "review").map((item) => item.id) as string[];
const buildLabel: Record<string, string> = {
  "v3-build": "Spec build",
  "video-build": "Video brief",
  "podcast-build": "Podcast brief",
};
const areaLabel: Record<string, string> = {
  tiles: "tiles",
  links: "links",
  modules: "modules",
  moduleLinks: "module links",
  templates: "templates",
  kinds: "kinds",
  wiring: "wiring",
  async: "async",
  guards: "guards",
};

/** One result's notes: what lost credit, or the review's notes. */
function notesOf(result: DesignCaseResult): string {
  const score = result.score;
  const lost = (
    areas: Record<string, { items: { key: string; credit: number; note?: string }[] }>,
  ) =>
    Object.values(areas)
      .flatMap((area) =>
        area.items
          .filter((item) => item.credit < 1)
          .map((item) => `${item.key}${item.note ? ` (${item.note})` : ""}`),
      )
      .slice(0, 8)
      .join("; ");
  const notes = isBuild(score)
    ? lost(score.areas)
    : isCapability(score)
      ? lost(score.capabilities)
      : score.notes.join("; ");
  return `${result.error ? `error: ${result.error.replaceAll("\n", " ")}; ` : ""}${notes || "none"}`;
}

/**
 * The report in Markdown: each model's scores (mean and spread over its samples) side by side,
 * every case's per model, then each run's samples and its measured size.
 */
export function designMarkdown(report: DesignReport): string {
  const samples = Math.max(
    0,
    ...report.runs.flatMap((run) => designCases.map((test) => caseSamples(run, test.id).length)),
  );
  const builds = buildIds().filter((id) => report.runs.some((run) => caseSamples(run, id).length));
  const lines = [
    `# Chat design evals (${report.mode})`,
    "",
    `Eval ${report.version}; source ${report.sourceCommit}; ${report.generatedAt}. Limits: ${report.limits.rounds} responses and ${report.limits.maxOutputTokens} output tokens per response, ${report.limits.caseTimeoutMs / 1000} s per case. ${report.mode === "scripted" ? "Scripted models: they prove the scorers and the loop, not model quality." : `Up to ${samples} sample${samples === 1 ? "" : "s"} per case per model; each cell is the mean, then the lowest and highest sample.`}`,
    "",
    "## Scores",
    "",
    `| Run | ${builds.map((id) => buildLabel[id] ?? id).join(" | ")} | Review | Requests | Input | Output | Est. USD |`,
    `| --- | ${builds.map(() => "---:").join(" | ")} | ---: | ---: | ---: | ---: | ---: |`,
  ];
  for (const run of report.runs) {
    const measured = usage(run.results);
    const cost = estimateUsd(run);
    lines.push(
      `| ${run.label} | ${builds.map((id) => spread(caseSamples(run, id))).join(" | ")} | ${spread(reviewSamples(run))} | ${measured.requests} | ${measured.tokens ? `${measured.tokens.input} tokens (${measured.tokens.cached} cached)` : `${kb(measured.requestBytes)} ≈ ${estimatedTokens(measured.requestBytes)} tokens`} | ${measured.tokens ? `${measured.tokens.output} tokens` : `${kb(measured.outputBytes)} ≈ ${estimatedTokens(measured.outputBytes)} tokens`} | ${cost === undefined ? "unknown" : cost.toFixed(2)} |`,
    );
  }
  lines.push(
    "",
    "Spec build: 0–100 against the v3 reference by name (tiles, links, modules, module links, templates). Video and podcast briefs: 0–100 by the capability rubric (kinds, wiring, async, guards, templates), names aside. Review: each sample's mean over the review cases, each 50 × named + 50 × fixed. Input and output are the provider's reported tokens, or, where it reports none, the measured bytes, at about 3 to 4 bytes a token. Est. USD uses known list prices only (gpt-5.4-mini, Claude Haiku 5.5 and Sonnet 5.5); it is an estimate, not billing.",
    "",
    "## Every case",
    "",
    `| Case | ${report.runs.map((run) => run.label).join(" | ")} |`,
    `| --- | ${report.runs.map(() => "---:").join(" | ")} |`,
  );
  for (const id of [...buildIds(), ...reviewIds()])
    if (report.runs.some((run) => caseSamples(run, id).length))
      lines.push(
        `| ${id} | ${report.runs.map((run) => spread(caseSamples(run, id))).join(" | ")} |`,
      );
  lines.push("");
  const areaRows = (run: DesignRun, id: string) => {
    const scores = run.results.filter((item) => item.id === id).map((item) => item.score);
    const areas = scores.map((score) =>
      isBuild(score) ? score.areas : isCapability(score) ? score.capabilities : undefined,
    );
    const keys = areas[0] ? Object.keys(areas[0]) : [];
    return keys
      .map(
        (key) =>
          `${areaLabel[key] ?? key} ${spread(areas.map((item) => (item as Record<string, { score: number }>)[key]?.score ?? 0))}`,
      )
      .join(", ");
  };
  for (const run of report.runs) {
    const measured = usage(run.results);
    lines.push(
      `## ${run.label}`,
      "",
      `${measured.requests} requests, ${kb(measured.requestBytes)} sent (${kb(measured.promptBytes)} of it the repeated instructions and tools; the largest request ${kb(measured.largestRequestBytes)}), ${kb(measured.outputBytes)} received.${
        run.settings
          ? ` Settings: ${Object.entries(run.settings)
              .map(([key, value]) => `${key} ${String(value)}`)
              .join("; ")}.`
          : ""
      }`,
      "",
    );
    for (const id of builds)
      if (caseSamples(run, id).length)
        lines.push(`- ${buildLabel[id] ?? id}: ${areaRows(run, id)}.`);
    lines.push(
      "",
      "| Case | # | Score | Requests | Sent | Notes |",
      "| --- | ---: | ---: | ---: | ---: | --- |",
    );
    const seen = new Map<string, number>();
    for (const result of run.results) {
      const sample = (seen.get(result.id) ?? 0) + 1;
      seen.set(result.id, sample);
      const sent = result.rounds.reduce((total, item) => total + item.requestBytes, 0);
      lines.push(
        `| ${result.id} | ${sample} | ${caseScore(result.score)} | ${result.rounds.length} | ${kb(sent)} | ${notesOf(result)} |`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * The scripted arms must discriminate: the good builds and reviews score high, the patterns-only
 * spec build in between and its product builds high (the patterns carry the capabilities, not
 * the names), the bad ones low. Returns the summary lines; throws when they don't.
 */
export function checkScripted(report: DesignReport): string[] {
  const lines: string[] = [];
  const problems: string[] = [];
  for (const run of report.runs) {
    const builds = Object.fromEntries(
      run.results
        .filter((item) => item.kind === "build")
        .map((item) => [item.id, caseScore(item.score)]),
    );
    const reviews = run.results.filter((item) => item.kind === "review");
    const review = reviews.length ? mean(reviews.map((item) => caseScore(item.score))) : undefined;
    const usageNow = usage(run.results);
    lines.push(
      `design ${run.label}: ${Object.entries(builds)
        .map(([id, total]) => `${id} ${total}`)
        .join(
          ", ",
        )}, review ${review ?? "–"}; ${usageNow.requests} requests, ${kb(usageNow.requestBytes)} sent (≈ ${estimatedTokens(usageNow.requestBytes)} tokens), ${kb(usageNow.outputBytes)} received; deterministic; not model-quality evidence`,
    );
    const expect = (ok: boolean, what: string) => ok || problems.push(`${run.label}: ${what}`);
    for (const result of run.results)
      expect(result.error === null, `${result.id} failed: ${result.error}`);
    const spec = builds["v3-build"];
    const products = ["video-build", "podcast-build"].map((id) => builds[id] ?? 0);
    if (run.label === "scripted-good") {
      for (const [id, total] of Object.entries(builds)) expect(total >= 95, `${id} ${total} < 95`);
      expect((review ?? 0) >= 90, `review ${review} < 90`);
    } else if (run.label === "scripted-patterns") {
      expect((spec ?? 0) > 50 && (spec ?? 100) < 95, `v3-build ${spec} not between 50 and 95`);
      for (const total of products) expect(total >= 80, `a product build ${total} < 80`);
    } else if (run.label === "scripted-bad") {
      for (const [id, total] of Object.entries(builds)) expect(total <= 30, `${id} ${total} > 30`);
      expect((review ?? 100) <= 20, `review ${review} > 20`);
    }
  }
  if (problems.length) throw new Error(`Scripted design evals: ${problems.join("; ")}`);
  return lines;
}

export { scoreText };

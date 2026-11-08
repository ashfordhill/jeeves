/** No network or credentials are used unless --live and --allow-paid-api are both supplied. */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCodexModelProvider,
  createOpenAIProvider,
  type ModelProvider,
  ProviderError,
} from "@jeeves/providers";
import { studioPatternCatalogVersion } from "@jeeves/spec";
import { INSTRUCTIONS, toolDefinitions } from "../chat/tools.ts";
import { openTestDb } from "../test-support.ts";
import { cases, EVAL_VERSION, LIMITS, MODEL } from "./cases.ts";
import {
  baselineInstructions,
  baselineTools,
  type CaseResult,
  cleanResponse,
  type Round,
  requestContent,
  runCase,
} from "./harness.ts";
import { syntheticProvider } from "./offline.ts";
import { liveBlocker } from "./policy.ts";
import { stable } from "./score.ts";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const defaultReport = fileURLToPath(
  new URL("../../../../../docs/evals/rf06/live.json", import.meta.url),
);
export type Report = {
  version: string;
  generatedAt: string;
  mode: "live";
  sourceCommit: string;
  model: string;
  provider?: string;
  transport?: string;
  outputTokenCapEnforced?: boolean;
  sdk?: string;
  cli?: string;
  notes?: string[];
  reasoning: string;
  patternVersion: string;
  limits: typeof LIMITS;
  hashes: Record<string, string>;
  baseline: string;
  pricing: {
    source: string;
    checked: string;
    inputPerMillion: number;
    cachedPerMillion: number;
    outputPerMillion: number;
  } | null;
  results: CaseResult[];
};
function usage(result: CaseResult, provider = "openai") {
  const known = result.rounds.every((r) => r.response?.usage);
  const input = result.rounds.reduce((n, r) => n + (r.response?.usage?.inputTokens ?? 0), 0);
  const output = result.rounds.reduce((n, r) => n + (r.response?.usage?.outputTokens ?? 0), 0);
  const cachedKnown =
    known && result.rounds.every((r) => r.response?.usage?.cachedInputTokens !== undefined);
  const cached = cachedKnown
    ? result.rounds.reduce((n, r) => n + (r.response?.usage?.cachedInputTokens ?? 0), 0)
    : null;
  return {
    known,
    input,
    output,
    cached,
    estimate:
      provider === "openai" && known && cached !== null
        ? ((input - cached) * 0.75 + cached * 0.075 + output * 4.5) / 1_000_000
        : null,
  };
}
export function compact(report: Report) {
  const lines = [
    "# RF06 bounded paired live comparison",
    "",
    `Model: \`${report.model}\`; reasoning: ${report.reasoning}. Eval ${report.version}; patterns ${report.patternVersion}; source ${report.sourceCommit}.`,
    "",
    "Baseline is an RF00 guidance/six-tool/no-review **ablation**, sharing current context, command engine, provider transport and atomic save. Current uses production ChatService. This does not reconstruct full legacy execution or isolate individual improvements.",
    "",
    `Same synthetic prompts/seeds and limits: ${LIMITS.rounds} responses, ${LIMITS.caseTimeoutMs / 1000}s/case. Output cap: ${report.outputTokenCapEnforced === false ? "unsupported by Codex adapter (4,096 requested but not forwarded)" : "4,096 per response"}. ${report.provider === "codex" ? "SDK/CLI retry behavior is not controlled by this harness." : "OpenAI maxRetries: 0."} No tuning or selection by result.`,
    "",
    ...(report.notes ?? []).flatMap((note) => [note, ""]),
    "Candidate rubric flags need [independent adjudication](reviewer-notes.md); the table is not a quality score.",
    "",
    "| Case | Arm | Checks | Candidate rubric flags | Refusals / mutation batches after review | Seconds | Input / cached / output | Est. USD |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of report.results) {
    const u = usage(r, report.provider);
    const noResponse = !r.rounds.some((round) => round.response);
    const deterministic = r.checks.filter((c) => c.assessment !== "needs-review");
    const critical =
      deterministic
        .filter((c) => c.critical && !c.pass)
        .map((c) => c.id)
        .join(", ") || "none detected";
    lines.push(
      `| ${r.id} | ${r.arm} | ${noResponse ? "not evaluated" : `${deterministic.filter((c) => c.pass).length}/${deterministic.length} deterministic; prose assessed separately`} | ${noResponse ? "access blocked" : critical} | ${r.refusals} / ${r.repairBatches} | ${(r.latencyMs / 1000).toFixed(1)} | ${u.known ? `${u.input} / ${u.cached ?? "unknown"} / ${u.output}` : "unknown (failed request)"} | ${u.estimate?.toFixed(4) ?? "unknown"} |`,
    );
  }

  lines.push(
    "",
    report.provider === "codex"
      ? "Codex monetary cost and reported billing are unknown; API list prices are not applied to the ChatGPT login. Token usage is CLI-reported, including its own prompt overhead. This fallback supplies no Mini-model evidence or strict OpenAI API schema acceptance."
      : "All USD values are list-price **estimates**, not reported billing; reported billing is unknown. Failed requests may incur unknown usage. Source: [official model pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini), checked 2026-11-07: input $0.75, cached $0.075, output $4.50 per million tokens.",
    "",
    "Each arm has one sample per case. This small fixed suite cannot establish a population improvement or runtime correctness. Deterministic checks inspect represented topology/preservation and emitted unresolved obligations. They never credit domain behavior as implemented. A phrase scanner is a review aid only. See reviewer-notes.md for independent AGENT adjudication, alternatives, readability and release blockers. Human/owner review is pending.",
    "",
  );
  for (const r of report.results) {
    lines.push(
      `## ${r.id} / ${r.arm}`,
      "",
      `Error: ${r.error ?? "none"}. Question: ${r.question ? stable(r.question) : "none"}.`,
      "",
      ...(!r.rounds.some((round) => round.response)
        ? ["No model response; design quality not evaluated."]
        : r.checks
            .filter((c) => !c.pass)
            .map(
              (c) => `- ${c.id}${c.assessment ? " (needs independent review)" : ""}: ${c.evidence}`,
            )),
      "",
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
async function main() {
  const args = process.argv.slice(2);
  const path = resolve(args.find((a) => a.startsWith("--report="))?.slice(9) ?? defaultReport);
  if (args.includes("--live")) {
    if (!args.includes("--allow-paid-api"))
      throw new Error(
        "Live run requires --allow-paid-api (paid external API with synthetic data only)",
      );
    const codex = args.includes("--provider=codex");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!codex && !apiKey) throw new Error("OPENAI_API_KEY is absent; no requests sent");
    if (codex && (process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY))
      throw new Error("Run Codex with OPENAI_API_KEY and CODEX_API_KEY unset in this subprocess");
    const model = codex ? "gpt-6.1-sol" : MODEL;
    const report: Report = {
      version: EVAL_VERSION,
      mode: "live",
      generatedAt: new Date().toISOString(),
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      model,
      provider: codex ? "codex" : "openai",
      transport: codex
        ? "Existing Codex SDK adapter; outer answer constrained, inner tool arguments unconstrained; ChatGPT login"
        : "OpenAI Responses strict function tools",
      reasoning: codex
        ? "medium (existing adapter)"
        : "omitted by production adapter; documented default none",
      outputTokenCapEnforced: !codex,
      ...(codex
        ? {
            sdk: "@openai/codex-sdk 0.162.1",
            cli: process.env.JEEVES_CODEX_PATH
              ? execFileSync(process.env.JEEVES_CODEX_PATH, ["--version"], {
                  encoding: "utf8",
                }).trim()
              : "SDK bundled CLI (version unreported)",
          }
        : {}),
      patternVersion: studioPatternCatalogVersion,
      limits: LIMITS,
      hashes: {
        currentPrompt: hash(INSTRUCTIONS),
        currentTools: hash(stable(toolDefinitions())),
        baselinePrompt: hash(baselineInstructions),
        baselineTools: hash(stable(baselineTools)),
        fixtures: hash(stable(cases.map((c) => ({ ...c, seed: c.seed() })))),
      },
      baseline:
        "RF00 4e2cd15 prompt and six tools, captured at 30f1c9b; tools.ts unchanged. Current context/Workspace/shared provider adapter/atomic commit; no pattern tools or review gate. Ablation, not faithful legacy execution.",
      pricing: codex
        ? null
        : {
            source: "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
            checked: "2026-11-07",
            inputPerMillion: 0.75,
            cachedPerMillion: 0.075,
            outputPerMillion: 4.5,
          },
      results: [],
    };
    for (const name of ["cases.ts", "score.ts", "harness.ts", "runner.ts"])
      report.hashes[name] = hash(await readFile(new URL(name, import.meta.url), "utf8"));
    const live = codex
      ? createCodexModelProvider(
          process.env.JEEVES_CODEX_PATH ? { codexPath: process.env.JEEVES_CODEX_PATH } : {},
        )
      : createOpenAIProvider({ apiKey: apiKey as string, maxRetries: 0 });
    const { db, close } = await openTestDb();
    try {
      await mkdir(resolve(path, ".."), { recursive: true });
      for (const test of cases)
        for (const arm of ["rf00-ablation", "current"] as const) {
          const rounds: Round[] = [];
          const started = performance.now();
          const signal = AbortSignal.timeout(LIMITS.caseTimeoutMs);
          const provider: ModelProvider = {
            ...live,
            async respond(request, options) {
              if (rounds.length >= LIMITS.rounds)
                throw new Error("Evaluation response limit exhausted");
              const start = performance.now();
              const requestHash = hash(requestContent(request));
              try {
                const response = await live.respond(
                  { ...request, maxOutputTokens: LIMITS.maxOutputTokens },
                  { ...options, signal },
                );
                rounds.push({
                  response: cleanResponse(response),
                  latencyMs: performance.now() - start,
                  requestHash,
                });
                return response;
              } catch (error) {
                rounds.push({
                  error: error instanceof Error ? error.message : String(error),
                  latencyMs: performance.now() - start,
                  requestHash,
                });
                throw error;
              }
            },
          };
          const result: CaseResult = {
            ...(await runCase(db, test, arm, provider, model)),
            rounds,
            latencyMs: performance.now() - started,
          };
          report.results.push(result);
          await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
          await writeFile(path.replace(/\.json$/, ".md"), compact(report));
          console.log(
            `${test.id} ${arm}: ${result.checks.filter((c) => c.pass).length}/${result.checks.length}; ${result.error ?? "completed"}`,
          );
          // Access/schema failure cannot become a fabricated quality comparison or waste more paid calls.
          if (liveBlocker(result.error))
            throw new Error(`Live access/schema blocker recorded in ${path}`);
        }
    } finally {
      await close();
    }
  } else if (!args.some((arg) => arg.startsWith("--report="))) {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network is forbidden in offline eval replay");
    };
    const { db, close } = await openTestDb();
    try {
      for (const test of cases)
        for (const arm of ["rf00-ablation", "current"] as const) {
          const first = await runCase(db, test, arm, syntheticProvider(test, arm));
          const second = await runCase(db, test, arm, syntheticProvider(test, arm));
          if (stable(first) !== stable(second) || first.checks.some((c) => !c.pass))
            throw new Error(`Synthetic fixture replay failed ${test.id}/${arm}`);
          console.log(
            `synthetic replay ${test.id}/${arm}: deterministic; not model-quality evidence`,
          );
        }
    } finally {
      globalThis.fetch = oldFetch;
      await close();
    }
  } else {
    // No OpenAI provider is constructed in this branch. A throwing global fetch also enforces it.
    const report = JSON.parse(await readFile(path, "utf8")) as Report;
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network is forbidden in offline eval replay");
    };
    const { db, close } = await openTestDb();
    try {
      for (const recorded of report.results) {
        const test = cases.find((c) => c.id === recorded.id);
        if (!test) throw new Error(`Unknown recorded fixture ${recorded.id}`);
        let index = 0;
        const provider: ModelProvider = {
          id: "offline",
          capabilities: { tools: true, imageInput: false, streaming: false, usage: true },
          async respond(request) {
            const round = recorded.rounds[index++];
            if (!round) throw new Error("Replay requested an unrecorded response");
            if (hash(requestContent(request)) !== round.requestHash)
              throw new Error(`Replay context drift in ${test.id}/${recorded.arm} round ${index}`);
            if (round.error)
              throw new ProviderError(report.provider ?? "openai", "other", round.error);
            if (!round.response) throw new Error("Missing replay response");
            return round.response;
          },
        };
        const replayed = await runCase(db, test, recorded.arm, provider, report.model);
        for (const field of [
          "design",
          "before",
          "question",
          "activity",
          "checks",
          "reply",
          "obligationText",
          "error",
          "toolResults",
          "refusals",
          "repairBatches",
        ] as const) {
          if (stable(replayed[field]) !== stable(recorded[field]))
            throw new Error(`Replay mismatch ${test.id}/${recorded.arm}: ${field}`);
        }
        if (index !== recorded.rounds.length)
          throw new Error("Replay did not consume all recorded responses");
        console.log(
          `replayed ${test.id}/${recorded.arm}: identical semantics, obligations, tool results and checks`,
        );
      }
    } finally {
      globalThis.fetch = oldFetch;
      await close();
    }
  }
}
if (process.argv[1]?.endsWith("/eval/runner.ts")) await main();

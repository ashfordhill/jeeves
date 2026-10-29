/**
 * Scripted fake coding agent (PLAN §11): each session applies scripted file edits in the working
 * folder, so orchestration tests exercise real git, real diffs and Jeeves's own checks without a
 * model.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { z } from "zod";
import type {
  CodingAgentEvent,
  CodingAgentProvider,
  CodingSessionRequest,
  CodingSessionResult,
} from "./coding.ts";
import { ProviderError, type ProviderErrorKind } from "./errors.ts";
import { FAKE } from "./fake.ts";

const codingStepSchema = z.strictObject({
  /** Files to write (path relative to the working folder → contents). */
  write: z.record(z.string(), z.string()).optional(),
  /** Text appended to files (created when missing). */
  append: z.record(z.string(), z.string()).optional(),
  remove: z.array(z.string()).optional(),
  /** Write the prompt itself to this file (lets a test's task text decide what the checks see). */
  writePrompt: z.string().optional(),
  message: z.string().optional(),
  usage: z
    .strictObject({ inputTokens: z.number(), outputTokens: z.number() })
    .nullable()
    .optional(),
  /** Throw a `ProviderError` of this kind (after applying any edits). */
  error: z
    .enum(["auth", "quota", "rate-limit", "unavailable", "bad-request", "unsupported", "other"])
    .optional(),
  /** Wait this long before finishing (so progress is visible in the UI). */
  delayMs: z.number().int().nonnegative().optional(),
  /** Apply the edits, then never finish until interrupted (a hung or killed agent). */
  hang: z.boolean().optional(),
});
export type CodingScriptStep = z.infer<typeof codingStepSchema>;

/** Picks the step for a session; `call` counts sessions on this agent, from 0. */
export type CodingScript =
  | readonly CodingScriptStep[]
  | ((request: CodingSessionRequest, call: number) => CodingScriptStep);

export type FakeCodingAgent = CodingAgentProvider & {
  readonly requests: CodingSessionRequest[];
};

/** The line every orchestrator prompt carries, so a stateless script can pick a step. */
export const TASK_MARKER = /Jeeves task: (\S+), attempt (\d+)/;

export function createFakeCodingAgent(script: CodingScript): FakeCodingAgent {
  const requests: CodingSessionRequest[] = [];
  return {
    id: FAKE,
    capabilities: { resume: true, usage: true, streaming: true },
    requests,
    async run(request, { signal, onEvent } = {}): Promise<CodingSessionResult> {
      const call = requests.length;
      requests.push({ ...request });
      const step = typeof script === "function" ? script(request, call) : script[call];
      if (!step) {
        throw new ProviderError(FAKE, "other", `The fake agent has no step for session ${call}.`);
      }
      const emit = onEvent ?? (() => {});
      const sessionId = request.resumeSessionId ?? `fake-session-${call}`;
      emit({ type: "session", sessionId });
      if (signal?.aborted) throw interrupted();

      const changes: Extract<CodingAgentEvent, { type: "files" }>["changes"] = [];
      for (const [path, content] of Object.entries(step.write ?? {})) {
        const file = inside(request.workingDirectory, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
        changes.push({ path, kind: "update" });
      }
      for (const [path, content] of Object.entries(step.append ?? {})) {
        const file = inside(request.workingDirectory, path);
        mkdirSync(dirname(file), { recursive: true });
        let existing = "";
        try {
          existing = readFileSync(file, "utf8");
        } catch {}
        writeFileSync(file, existing + content);
        changes.push({ path, kind: "update" });
      }
      if (step.writePrompt) {
        const file = inside(request.workingDirectory, step.writePrompt);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `/*\n${request.prompt.replaceAll("*/", "* /")}\n*/\nexport {};\n`);
        changes.push({ path: step.writePrompt, kind: "update" });
      }
      for (const path of step.remove ?? []) {
        rmSync(inside(request.workingDirectory, path), { force: true, recursive: true });
        changes.push({ path, kind: "delete" });
      }
      if (changes.length > 0) emit({ type: "files", changes });

      if (step.hang) {
        await new Promise<void>((_, reject) => {
          if (signal?.aborted) return reject(interrupted());
          signal?.addEventListener("abort", () => reject(interrupted()), { once: true });
        });
      }
      if (step.delayMs) await sleep(step.delayMs, signal);
      if (step.error) {
        throw new ProviderError(FAKE, step.error as ProviderErrorKind, "Scripted agent failure.");
      }
      const finalMessage = step.message ?? "Done.";
      emit({ type: "message", text: finalMessage });
      return {
        sessionId,
        finalMessage,
        usage: step.usage === undefined ? { inputTokens: 1000, outputTokens: 200 } : step.usage,
      };
    },
  };
}

const byTaskSchema = z.strictObject({
  tasks: z.array(
    z.strictObject({
      /** The task key (`links`, `links.links-api`, …). */
      task: z.string().min(1),
      /** One step per attempt; the last one repeats. */
      attempts: z.array(codingStepSchema).min(1),
    }),
  ),
  /** For tasks the script doesn't list. */
  default: codingStepSchema.optional(),
});

/**
 * A stateless script keyed by task and attempt number (from the prompt's `TASK_MARKER` line).
 * The e2e server uses it, since many projects share one process.
 */
export function codingScriptByTask(input: unknown): CodingScript {
  const { tasks, default: fallback } = byTaskSchema.parse(input);
  return (request) => {
    const [, key = "", n = "1"] = TASK_MARKER.exec(request.prompt) ?? [];
    const entry = tasks.find((t) => t.task === key);
    if (!entry) return fallback ?? { message: `The fake script has no task "${key}".` };
    return entry.attempts[Number(n) - 1] ?? entry.attempts.at(-1) ?? {};
  };
}

function inside(root: string, path: string): string {
  const file = resolve(root, path);
  if (!file.startsWith(resolve(root) + sep)) throw new Error(`${path} is outside ${root}`);
  return join(file);
}

function interrupted(): ProviderError {
  return new ProviderError(FAKE, "other", "The session was interrupted.");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(interrupted());
      },
      { once: true },
    );
  });
}

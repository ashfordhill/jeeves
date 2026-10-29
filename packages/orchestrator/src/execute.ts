/**
 * The task-execution seam. S11 runs a stub that marks each task done; S12 replaces it with the
 * coding-agent session and Jeeves-run checks (PLAN §10, Execute).
 */
import type { PlannedTask } from "./seed.ts";

export type AttemptUsage = { inputTokens: number; outputTokens: number; known: boolean };

export type AttemptInput = {
  runId: number;
  /** The generated project's folder. */
  dir: string;
  task: PlannedTask & { id: number };
  /** 1 for the first attempt at this task. */
  attempt: number;
  /** Aborted when the run is cancelled. */
  signal: AbortSignal;
};

export type AttemptOutcome = {
  status: "succeeded" | "failed";
  summary: string;
  usage: AttemptUsage | null;
  error?: string;
};

export interface TaskExecutor {
  execute(input: AttemptInput): Promise<AttemptOutcome>;
}

export const STUB_SUMMARY =
  "Stub execution: marked done without running a coding agent (real execution arrives in S12).";

/** Waits `delayMs` (so progress is visible), then reports success. Stops early on abort. */
export function stubExecutor(delayMs = 0): TaskExecutor {
  return {
    execute: ({ signal }) =>
      new Promise((resolve, reject) => {
        const done = () => resolve({ status: "succeeded", summary: STUB_SUMMARY, usage: null });
        if (signal.aborted) return reject(new Error("cancelled"));
        const timer = setTimeout(done, delayMs);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new Error("cancelled"));
          },
          { once: true },
        );
      }),
  };
}

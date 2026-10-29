/**
 * The task-execution seam (PLAN §10, Execute). The run service calls `TaskExecutor.execute` once
 * per attempt; `createAgentExecutor` (agent.ts) is the real one, and `stubExecutor` marks tasks
 * done without an agent.
 */
import type { PlannedTask } from "./seed.ts";

export type AttemptUsage = {
  inputTokens: number;
  outputTokens: number;
  known: boolean;
  /** Only when the provider reports a price; unknown otherwise. */
  costUsd?: number;
};

export const gitStrategies = ["direct", "branch-per-task"] as const;
export type GitStrategy = (typeof gitStrategies)[number];

/** Where a task's work happens. Saved before the agent starts, so a resume finds it again. */
export type TaskWorkspace = {
  /** The run branch, `jeeves/run-<id>`. */
  runBranch: string;
  /** The branch the agent works on: the run branch (`direct`) or the task branch. */
  branch: string;
  /** The commit the task started from; the task's diff is against it. */
  baseCommit: string;
};

/** How the previous attempt at this task ended, so the next one can follow up on it. */
export type PreviousAttempt = {
  status: "failed" | "interrupted" | "cancelled" | "succeeded" | "running";
  error: string | null;
  /** What to tell the agent about the failure (check output, rejected paths). */
  feedback: string | null;
  sessionId: string | null;
};

export type AttemptEventKind =
  | "message"
  | "reasoning"
  | "command"
  | "files"
  | "todo"
  | "warning"
  | "step"
  | "check"
  | "log"
  | "git";

/** One line of an attempt's live log: what the agent did and what Jeeves checked. */
export type AttemptEvent = {
  /** Milliseconds since the attempt started. */
  t: number;
  kind: AttemptEventKind;
  text: string;
  status?: "running" | "passed" | "failed" | "skipped";
};

export type CheckStepRecord = {
  step: string;
  title: string;
  status: "running" | "passed" | "failed" | "skipped";
  durationMs: number;
  message?: string;
};

export type CheckRecord = {
  subject: string;
  id: string;
  title: string;
  status: "passed" | "failed";
  durationMs: number;
  error?: string;
};

/** What Jeeves checked after the agent stopped. */
export type AttemptChecks = {
  ok: boolean;
  /** Changed files outside the task's owned paths, or generated-owned files; reverted. */
  rejectedPaths: string[];
  steps: CheckStepRecord[];
  checks: CheckRecord[];
};

export type FileChange = { path: string; status: "added" | "modified" | "deleted" | "renamed" };

export type AttemptInput = {
  runId: number;
  /** The generated project's folder. */
  dir: string;
  task: PlannedTask & { id: number; workspace: TaskWorkspace | null };
  /** 1 for the first attempt at this task. */
  attempt: number;
  strategy: GitStrategy;
  previous: PreviousAttempt | null;
  /** Aborted when the run is cancelled. */
  signal: AbortSignal;
  /** Persists where the task's work happens (before the agent starts). */
  saveWorkspace?: (workspace: TaskWorkspace) => Promise<void>;
  /** Persists the agent session's ID as soon as it's known. */
  saveSession?: (sessionId: string) => Promise<void>;
  onEvent?: (event: AttemptEvent) => void;
};

export type AttemptOutcome = {
  status: "succeeded" | "failed";
  summary: string;
  usage: AttemptUsage | null;
  error?: string;
  /** For a failed attempt: what to send the agent on the next attempt. */
  feedback?: string;
  sessionId?: string | null;
  checks?: AttemptChecks;
  changes?: FileChange[];
  /** The task's diff against its base commit when the attempt ended (capped). */
  diff?: string;
  /** The commit (or merge commit) made for a succeeded task. */
  commit?: string;
};

export interface TaskExecutor {
  execute(input: AttemptInput): Promise<AttemptOutcome>;
}

export const STUB_SUMMARY = "Stub execution: marked done without running a coding agent.";

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

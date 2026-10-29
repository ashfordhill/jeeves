/**
 * Run, task, and attempt states (PLAN §10) and which actions each run state allows. The server
 * enforces these; the Runs view uses the same table to decide which buttons to show.
 */

/**
 * `planning` is not in PLAN §10's list: planning calls the planner model, which takes a while, so
 * the run exists (and shows progress) before its plan does.
 */
export const runStatuses = [
  "planning",
  "planned",
  "running",
  "paused",
  "needs-attention",
  "waiting_for_provider",
  "cancelled",
  "failed",
  "succeeded",
] as const;
export type RunStatus = (typeof runStatuses)[number];

export const taskStatuses = ["pending", "running", "done", "needs-attention", "cancelled"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const attemptStatuses = [
  "running",
  "succeeded",
  "failed",
  "interrupted",
  "cancelled",
] as const;
export type AttemptStatus = (typeof attemptStatuses)[number];

export const terminalRunStatuses: readonly RunStatus[] = ["cancelled", "failed", "succeeded"];

export function isTerminal(status: RunStatus): boolean {
  return terminalRunStatuses.includes(status);
}

export type RunAction = "start" | "pause" | "resume" | "cancel" | "replan" | "edit";

/** Run states that are stopped and waiting for the person; Resume continues them. */
const stopped: readonly RunStatus[] = ["paused", "needs-attention", "waiting_for_provider"];

/** Whether `action` is allowed while the run is in `status`. */
export function allows(status: RunStatus, action: RunAction): boolean {
  switch (action) {
    case "start":
    case "replan":
      return status === "planned";
    case "pause":
      return status === "running";
    case "resume":
      return stopped.includes(status);
    case "cancel":
      return !isTerminal(status);
    case "edit":
      return status === "planned" || stopped.includes(status);
  }
}

/** The actions a run in `status` offers, in button order. */
export function runActions(status: RunStatus): RunAction[] {
  const order: RunAction[] = ["start", "resume", "pause", "replan", "cancel"];
  return order.filter((action) => allows(status, action));
}

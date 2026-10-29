/**
 * Runs (PLAN §10): planning a generated template project into tasks, the person's edits to the
 * plan, and executing it one task at a time. Planning and each step are background jobs
 * (`JobQueue`), and all state is in Postgres, so a run survives a restart (`recoverRuns`).
 *
 * Execution goes through a `TaskExecutor`: the coding-agent executor in the app, a stub or a
 * scripted executor in tests.
 */
import { readLock } from "@jeeves/generator";
import {
  type AttemptEvent,
  type AttemptOutcome,
  type AttemptUsage,
  allows,
  type GitStrategy,
  orderProblems,
  type PlannedTask,
  type PreviousAttempt,
  type RunAction,
  type RunStatus,
  readGeneratedProject,
  refinePlan,
  runActions,
  seedPlan,
  type TaskExecutor,
  type TaskWorkspace,
} from "@jeeves/orchestrator";
import { ProviderError } from "@jeeves/providers";
import type { TemplateLookup } from "@jeeves/spec";
import { and, asc, desc, eq, getTableColumns, inArray, notInArray, sql } from "drizzle-orm";
import type { ModelSource } from "../chat/service.ts";
import type { Db } from "../db/client.ts";
import {
  attempts,
  generations,
  projects,
  type RunPlanner,
  type RunUsage,
  runs,
  tasks,
} from "../db/schema.ts";
import type { DesignService } from "../design/service.ts";
import type { JobQueue } from "./jobs.ts";

export const PLAN_JOB = "jeeves-run-plan";
export const STEP_JOB = "jeeves-run-step";

export type Run = typeof runs.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
/** An attempt without its log and diff, as listed in a run's detail. */
export type AttemptSummary = Omit<Attempt, "events" | "diff" | "feedback">;

export type RunSettings = { gitStrategy: GitStrategy; maxRetries: number };

/** Live log lines kept per attempt (in memory and in the database). */
const EVENT_CAP = 3000;
const EVENT_TEXT_CAP = 4000;
const FLUSH_MS = 1000;

export type RunSummary = Run & { taskCount: number; doneCount: number };

export type RunDetail = {
  run: Run;
  tasks: (Task & { attempts: AttemptSummary[] })[];
  /** Buttons the run offers now (Start, Pause, …). */
  actions: RunAction[];
  /** Whether pending tasks can be edited, removed, and reordered now. */
  editable: boolean;
  /** Pending tasks placed before tasks they depend on. */
  orderProblems: { taskId: number; message: string }[];
  usage: { planner: RunUsage | null; attempts: RunUsage; total: RunUsage };
};

/** Whether the project can be planned, and what it was generated from. */
export type Readiness = {
  outputDir: string | null;
  ready: boolean;
  /** Why it can't be planned yet. */
  reason: string | null;
};

export type Failure = { ok: false; status: 404 | 409 | 422; code: string; message: string };
export type Result<T> = ({ ok: true } & T) | Failure;

const notFound = (what = "Run"): Failure => ({
  ok: false,
  status: 404,
  code: "NOT_FOUND",
  message: `${what} not found.`,
});

const actionNames: Record<RunAction, string> = {
  start: "started",
  pause: "paused",
  resume: "resumed",
  cancel: "cancelled",
  replan: "planned again",
  edit: "edited",
};

const wrongState = (run: Run, action: RunAction): Failure => ({
  ok: false,
  status: 409,
  code: "RUN_STATE",
  message: `A ${run.status} run can't be ${actionNames[action]}.`,
});

export type TaskPatch = { title?: string; description?: string; acceptance?: string[] };

export class RunService {
  /** Abort controllers for planning and steps in progress, by run ID. */
  private readonly live = new Map<number, AbortController>();
  /** Runs with a plan or step job being handled, so a duplicate job is a no-op. */
  private readonly busy = new Set<number>();
  /** The live log of attempts in progress, by attempt ID (saved every second). */
  private readonly events = new Map<number, AttemptEvent[]>();

  constructor(
    private readonly db: Db,
    private readonly design: DesignService,
    private readonly models: ModelSource,
    private readonly templates: TemplateLookup,
    private readonly jobs: JobQueue,
    private readonly executor: TaskExecutor,
  ) {}

  /** Starts the job handlers. */
  async init(): Promise<void> {
    await this.jobs.work(PLAN_JOB, ({ runId }) => this.plan(runId));
    await this.jobs.work(STEP_JOB, ({ runId }) => this.step(runId));
  }

  async readiness(projectId: string): Promise<Readiness | undefined> {
    const project = await this.design.getProject(projectId);
    if (!project) return undefined;
    const { outputDir } = project;
    if (!outputDir) {
      return {
        outputDir,
        ready: false,
        reason: "Generate the project first (Draw view, Generate button).",
      };
    }
    try {
      if (!readLock(outputDir)) {
        return {
          outputDir,
          ready: false,
          reason: `${outputDir} hasn't been generated yet. Generate the project first.`,
        };
      }
    } catch (error) {
      return { outputDir, ready: false, reason: (error as Error).message };
    }
    return { outputDir, ready: true, reason: null };
  }

  async list(projectId: string): Promise<RunSummary[]> {
    const rows = await this.db
      .select()
      .from(runs)
      .where(eq(runs.projectId, projectId))
      .orderBy(desc(runs.id));
    if (rows.length === 0) return [];
    const counts = await this.db
      .select({
        runId: tasks.runId,
        taskCount: sql<number>`count(*)::int`,
        doneCount: sql<number>`(count(*) filter (where ${tasks.status} = 'done'))::int`,
      })
      .from(tasks)
      .where(
        inArray(
          tasks.runId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(tasks.runId);
    const byRun = new Map(counts.map((c) => [c.runId, c]));
    return rows.map((run) => ({
      ...run,
      taskCount: byRun.get(run.id)?.taskCount ?? 0,
      doneCount: byRun.get(run.id)?.doneCount ?? 0,
    }));
  }

  async get(projectId: string, runId: number): Promise<RunDetail | undefined> {
    const run = await this.findRun(projectId, runId);
    if (!run) return undefined;
    const taskRows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.runId, runId))
      .orderBy(asc(tasks.position));
    const { events: _e, diff: _d, feedback: _f, ...summaryColumns } = getTableColumns(attempts);
    const attemptRows = await this.db
      .select(summaryColumns)
      .from(attempts)
      .where(eq(attempts.runId, runId))
      .orderBy(asc(attempts.number));
    const pending = taskRows.filter((t) => t.status === "pending");
    const ids = new Map(pending.map((t) => [t.key, t.id]));
    const attemptUsage = sumUsage(
      attemptRows.filter((a) => a.status !== "running").map((a) => a.usage),
    );
    // A planner that was never called (no notes, no key) used nothing; one that was may be unknown.
    const plannerUsage = run.planner?.model ? run.planner.usage : null;
    return {
      run,
      tasks: taskRows.map((task) => ({
        ...task,
        attempts: attemptRows.filter((a) => a.taskId === task.id),
      })),
      actions: runActions(run.status),
      editable: allows(run.status, "edit"),
      orderProblems: orderProblems(pending).map((p) => ({
        taskId: ids.get(p.key) as number,
        message: p.message,
      })),
      usage: {
        planner: plannerUsage,
        attempts: attemptUsage,
        total: run.planner?.model ? sumUsage([plannerUsage, attemptUsage]) : attemptUsage,
      },
    };
  }

  /** Creates a run and queues its planning. One active run per project. */
  async create(projectId: string): Promise<Result<{ run: Run }>> {
    const readiness = await this.readiness(projectId);
    if (!readiness) return notFound("Project");
    if (!readiness.ready || !readiness.outputDir) {
      return {
        ok: false,
        status: 422,
        code: "PROJECT_NOT_GENERATED",
        message: readiness.reason ?? "Generate first.",
      };
    }
    const [active] = await this.db
      .select({ id: runs.id, status: runs.status })
      .from(runs)
      .where(
        and(
          eq(runs.projectId, projectId),
          notInArray(runs.status, ["cancelled", "failed", "succeeded"]),
        ),
      )
      .limit(1);
    if (active) {
      return {
        ok: false,
        status: 409,
        code: "RUN_ACTIVE",
        message: `Run ${active.id} is still ${active.status}. Finish or cancel it before planning another.`,
      };
    }
    const settings = await this.settings(projectId);
    const [run] = await this.db
      .insert(runs)
      .values({
        projectId,
        status: "planning",
        outputDir: readiness.outputDir,
        gitStrategy: settings?.gitStrategy ?? "branch-per-task",
        maxRetries: settings?.maxRetries ?? 2,
      })
      .returning();
    if (!run) throw new Error("insert returned no run");
    await this.jobs.send(PLAN_JOB, { runId: run.id });
    return { ok: true, run };
  }

  /**
   * The plan job: seed from the generated project, then refine with the planner model. Problems
   * with the planner leave the seed as the plan, with the reason shown; problems reading the
   * project fail the run.
   */
  async plan(runId: number): Promise<void> {
    if (this.busy.has(runId)) return;
    this.busy.add(runId);
    const abort = new AbortController();
    this.live.set(runId, abort);
    try {
      const [run] = await this.db.select().from(runs).where(eq(runs.id, runId));
      if (run?.status !== "planning") return;
      let planned: Awaited<ReturnType<RunService["makePlan"]>>;
      try {
        planned = await this.makePlan(run, abort.signal);
      } catch (error) {
        await this.db
          .update(runs)
          .set({
            status: "failed",
            statusReason: `Couldn't plan: ${(error as Error).message}`,
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(runs.id, runId), eq(runs.status, "planning")));
        return;
      }
      await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(runs)
          .set({
            status: "planned",
            statusReason: null,
            designRevision: planned.designRevision,
            planner: planned.planner,
            warnings: planned.warnings,
            updatedAt: new Date(),
          })
          .where(and(eq(runs.id, runId), eq(runs.status, "planning")))
          .returning({ id: runs.id });
        // Cancelled while the planner was thinking: keep it cancelled, with no tasks.
        if (!updated) return;
        await tx.delete(tasks).where(eq(tasks.runId, runId));
        if (planned.tasks.length > 0) {
          await tx.insert(tasks).values(
            planned.tasks.map((task, position) => ({
              runId,
              position,
              key: task.key,
              element: task.element,
              attachment: task.attachment,
              title: task.title,
              description: task.description,
              acceptance: task.acceptance,
              ownedPaths: task.ownedPaths,
              dependsOn: task.dependsOn,
              source: task.source,
              status: "pending" as const,
            })),
          );
        }
      });
    } finally {
      this.live.delete(runId);
      this.busy.delete(runId);
    }
  }

  private async makePlan(run: Run, signal: AbortSignal) {
    const project = readGeneratedProject(run.outputDir);
    const current = await this.design.getProject(run.projectId);
    const warnings: string[] = [];
    const generatedFrom = project.lock.designRevision;
    if (current && current.revision !== generatedFrom) {
      warnings.push(
        `The design changed after the project was generated (revision ${generatedFrom}, now ${current.revision}). This plan follows the generated project; generate again to include the changes.`,
      );
    }
    const [generation] = await this.db
      .select({ status: generations.status, baseline: generations.baseline })
      .from(generations)
      .where(
        and(eq(generations.projectId, run.projectId), eq(generations.outputDir, run.outputDir)),
      )
      .orderBy(desc(generations.id))
      .limit(1);
    if (!(generation?.status === "succeeded" && generation.baseline)) {
      warnings.push(
        "The baseline check hasn't passed for this project's latest generation. Orchestration expects a green template project: generate with the baseline check first.",
      );
    }

    const seed = seedPlan({
      design: project.design,
      lock: project.lock,
      templates: this.templates,
    });
    const base = { designRevision: generatedFrom, warnings };
    const seedOnly = (
      message: string,
      model: string | null = null,
      usage: RunUsage | null = null,
    ) => ({
      ...base,
      tasks: seed,
      planner: { mode: "seed", model, message, usage } satisfies RunPlanner,
    });
    if (seed.length === 0) {
      return seedOnly(
        "No element or attachment has implementation notes, so there's nothing to implement. Add notes in the Draw view and generate again.",
      );
    }
    const source = this.models("planner");
    if ("error" in source) return seedOnly(`The planner model wasn't used: ${source.error}`);
    const projectName = current?.name ?? "project";
    try {
      const refined = await refinePlan(
        source.provider,
        source.model,
        { projectName, seed, briefs: project.briefs },
        signal,
      );
      if (!refined.ok) {
        return seedOnly(
          `The planner didn't produce a valid plan, so this is the seed plan. ${refined.reason}`,
          source.model,
          refined.usage,
        );
      }
      return {
        ...base,
        tasks: refined.tasks,
        planner: {
          mode: "refined",
          model: source.model,
          message: refined.summary,
          usage: refined.usage,
        } satisfies RunPlanner,
      };
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      const hint = error.blocksProvider
        ? " Fix the provider in Settings, then press Plan again."
        : "";
      return seedOnly(
        `The planner model failed (${error.kind}): ${error.message} This is the seed plan.${hint}`,
        source.model,
      );
    }
  }

  async editTask(
    projectId: string,
    runId: number,
    taskId: number,
    patch: TaskPatch,
  ): Promise<Result<{ task: Task }>> {
    const found = await this.editable(projectId, runId, taskId);
    if (!found.ok) return found;
    const [task] = await this.db
      .update(tasks)
      .set({ ...patch, edited: true })
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "pending")))
      .returning();
    return task ? { ok: true, task } : this.taskNotPending();
  }

  async removeTask(projectId: string, runId: number, taskId: number): Promise<Result<object>> {
    const found = await this.editable(projectId, runId, taskId);
    if (!found.ok) return found;
    const [removed] = await this.db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.status, "pending")))
      .returning({ id: tasks.id });
    return removed ? { ok: true } : this.taskNotPending();
  }

  /** Reorders the pending tasks; `taskIds` must be exactly the run's pending task IDs. */
  async reorder(projectId: string, runId: number, taskIds: number[]): Promise<Result<object>> {
    const run = await this.findRun(projectId, runId);
    if (!run) return notFound();
    if (!allows(run.status, "edit")) return wrongState(run, "edit");
    const rows = await this.db
      .select({ id: tasks.id, status: tasks.status })
      .from(tasks)
      .where(eq(tasks.runId, runId))
      .orderBy(asc(tasks.position));
    const pending = rows.filter((t) => t.status === "pending").map((t) => t.id);
    const same =
      taskIds.length === pending.length &&
      new Set(taskIds).size === taskIds.length &&
      taskIds.every((id) => pending.includes(id));
    if (!same) {
      return {
        ok: false,
        status: 422,
        code: "INVALID_ORDER",
        message: "The new order must list every pending task exactly once.",
      };
    }
    const order = [...rows.filter((t) => t.status !== "pending").map((t) => t.id), ...taskIds];
    await this.db.transaction(async (tx) => {
      for (const [position, id] of order.entries()) {
        await tx.update(tasks).set({ position }).where(eq(tasks.id, id));
      }
    });
    return { ok: true };
  }

  /** Start, Pause, Resume, Cancel, or Plan again. */
  async act(projectId: string, runId: number, action: RunAction): Promise<Result<{ run: Run }>> {
    const run = await this.findRun(projectId, runId);
    if (!run) return notFound();
    if (action === "edit" || !allows(run.status, action)) return wrongState(run, action);
    const now = new Date();
    const transition = (status: RunStatus, set: Partial<Run> = {}) =>
      this.db
        .update(runs)
        .set({ status, statusReason: null, updatedAt: now, ...set })
        .where(and(eq(runs.id, runId), eq(runs.status, run.status)))
        .returning();

    switch (action) {
      case "start":
      case "resume": {
        // Resuming tries the task that needed attention again, from where its work stands.
        if (action === "resume") {
          await this.db
            .update(tasks)
            .set({ status: "pending" })
            .where(and(eq(tasks.runId, runId), eq(tasks.status, "needs-attention")));
        }
        if (!(await this.hasPending(runId))) {
          return {
            ok: false,
            status: 422,
            code: "PLAN_EMPTY",
            message: "There are no tasks left to run.",
          };
        }
        const [updated] = await transition("running", action === "start" ? { startedAt: now } : {});
        if (!updated) return wrongState(run, action);
        await this.jobs.send(STEP_JOB, { runId });
        return { ok: true, run: updated };
      }
      case "pause": {
        const [updated] = await transition("paused", {
          statusReason: "Paused. A task in progress finishes first.",
        });
        return updated ? { ok: true, run: updated } : wrongState(run, action);
      }
      case "replan": {
        const [updated] = await transition("planning", { planner: null, warnings: [] });
        if (!updated) return wrongState(run, action);
        await this.db.delete(tasks).where(eq(tasks.runId, runId));
        await this.jobs.send(PLAN_JOB, { runId });
        return { ok: true, run: updated };
      }
      case "cancel": {
        const [updated] = await transition("cancelled", { finishedAt: now });
        if (!updated) return wrongState(run, action);
        await this.db
          .update(tasks)
          .set({ status: "cancelled", finishedAt: now })
          .where(and(eq(tasks.runId, runId), eq(tasks.status, "pending")));
        this.live.get(runId)?.abort();
        return { ok: true, run: updated };
      }
    }
  }

  /**
   * The step job: runs the next pending task, then queues the next step while the run is still
   * running. Pause and Cancel take effect between tasks; Cancel also aborts the task in progress.
   */
  async step(runId: number): Promise<void> {
    if (this.busy.has(runId)) return;
    this.busy.add(runId);
    const abort = new AbortController();
    this.live.set(runId, abort);
    try {
      const [run] = await this.db.select().from(runs).where(eq(runs.id, runId));
      if (run?.status !== "running") return;
      const [task] = await this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.runId, runId), eq(tasks.status, "pending")))
        .orderBy(asc(tasks.position))
        .limit(1);
      if (!task) {
        await this.db
          .update(runs)
          .set({ status: "succeeded", finishedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(runs.id, runId), eq(runs.status, "running")));
        return;
      }
      await this.runTask(run, task, abort.signal);
      const [after] = await this.db
        .select({ status: runs.status })
        .from(runs)
        .where(eq(runs.id, runId));
      if (after?.status === "running") await this.jobs.send(STEP_JOB, { runId });
    } catch (error) {
      await this.db
        .update(runs)
        .set({
          status: "failed",
          statusReason: `Jeeves hit an error running this plan: ${(error as Error).message}`,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(runs.id, runId), eq(runs.status, "running")));
    } finally {
      this.live.delete(runId);
      this.busy.delete(runId);
    }
  }

  /**
   * Runs a task: attempts until one succeeds, retrying failed attempts (with the failure sent
   * back to the agent) up to the run's retry limit. Then the task needs attention and the run
   * stops. A provider that needs the person (credentials, quota) moves the run to
   * `waiting_for_provider` instead, with the task back to pending.
   */
  private async runTask(run: Run, task: Task, signal: AbortSignal) {
    const [claimed] = await this.db
      .update(tasks)
      .set({ status: "running", startedAt: task.startedAt ?? new Date() })
      .where(and(eq(tasks.id, task.id), eq(tasks.status, "pending")))
      .returning();
    if (!claimed) return;
    let current = claimed;
    for (let retry = 0; ; retry++) {
      const result = await this.attempt(run, current, signal);
      if (result.kind !== "failed") return;
      if (retry < run.maxRetries && !signal.aborted) {
        const [fresh] = await this.db.select().from(tasks).where(eq(tasks.id, task.id));
        if (!fresh) return;
        current = fresh;
        continue;
      }
      const tries = retry + 1;
      await this.db.update(tasks).set({ status: "needs-attention" }).where(eq(tasks.id, task.id));
      await this.stop(
        run.id,
        "needs-attention",
        `"${task.title}" failed${tries > 1 ? ` after ${tries} attempts` : ""}: ${firstLine(result.error)}`,
      );
      return;
    }
  }

  /** One attempt at a task: insert it, run the executor with a live log, record the outcome. */
  private async attempt(
    run: Run,
    task: Task,
    signal: AbortSignal,
  ): Promise<{ kind: "succeeded" | "stopped" } | { kind: "failed"; error: string }> {
    const [last] = await this.db
      .select()
      .from(attempts)
      .where(eq(attempts.taskId, task.id))
      .orderBy(desc(attempts.number))
      .limit(1);
    const number = (last?.number ?? 0) + 1;
    const previous: PreviousAttempt | null = last
      ? {
          status: last.status,
          error: last.error,
          feedback: last.feedback,
          sessionId: last.sessionId,
        }
      : null;
    const [attempt] = await this.db
      .insert(attempts)
      .values({ taskId: task.id, runId: run.id, number, status: "running" })
      .returning();
    if (!attempt) throw new Error("insert returned no attempt");

    const log: AttemptEvent[] = [];
    this.events.set(attempt.id, log);
    let added = 0;
    let saved = 0;
    const flush = async () => {
      if (added === saved) return;
      saved = added;
      await this.db
        .update(attempts)
        .set({ events: [...log] })
        .where(eq(attempts.id, attempt.id));
    };
    const timer = setInterval(() => void flush().catch(() => {}), FLUSH_MS);

    let outcome: AttemptOutcome | undefined;
    let thrown: unknown;
    try {
      outcome = await this.executor.execute({
        runId: run.id,
        dir: run.outputDir,
        task: { ...toPlannedTask(task), id: task.id, workspace: task.workspace },
        attempt: number,
        strategy: run.gitStrategy,
        previous,
        signal,
        saveWorkspace: (workspace: TaskWorkspace) =>
          this.db
            .update(tasks)
            .set({ workspace })
            .where(eq(tasks.id, task.id))
            .then(() => {}),
        saveSession: (sessionId: string) =>
          this.db
            .update(attempts)
            .set({ sessionId })
            .where(eq(attempts.id, attempt.id))
            .then(() => {}),
        onEvent: (event) => {
          if (log.length >= EVENT_CAP) log.shift();
          log.push(
            event.text.length > EVENT_TEXT_CAP
              ? { ...event, text: `${event.text.slice(0, EVENT_TEXT_CAP)}…` }
              : event,
          );
          added++;
        },
      });
    } catch (error) {
      thrown = error;
    } finally {
      clearInterval(timer);
      this.events.delete(attempt.id);
    }

    const finishedAt = new Date();
    const record = {
      events: log,
      usage: outcome?.usage ?? null,
      summary: outcome?.summary ?? null,
      ...(outcome?.sessionId ? { sessionId: outcome.sessionId } : {}),
      feedback: outcome?.feedback ?? null,
      checks: outcome?.checks ?? null,
      changes: outcome?.changes ?? null,
      diff: outcome?.diff ?? null,
      commit: outcome?.commit ?? null,
      finishedAt,
    };
    if (signal.aborted) {
      await this.db
        .update(attempts)
        .set({ ...record, status: "cancelled" })
        .where(eq(attempts.id, attempt.id));
      await this.db
        .update(tasks)
        .set({ status: "cancelled", finishedAt })
        .where(eq(tasks.id, task.id));
      return { kind: "stopped" };
    }
    if (outcome?.status === "succeeded") {
      await this.db
        .update(attempts)
        .set({ ...record, status: "succeeded" })
        .where(eq(attempts.id, attempt.id));
      await this.db
        .update(tasks)
        .set({ status: "done", finishedAt, commit: outcome.commit ?? null })
        .where(eq(tasks.id, task.id));
      return { kind: "succeeded" };
    }
    const error = outcome?.error ?? (thrown as Error | undefined)?.message ?? "The attempt failed.";
    await this.db
      .update(attempts)
      .set({ ...record, status: "failed", error })
      .where(eq(attempts.id, attempt.id));
    if (thrown instanceof ProviderError && thrown.blocksProvider) {
      await this.db.update(tasks).set({ status: "pending" }).where(eq(tasks.id, task.id));
      await this.stop(
        run.id,
        "waiting_for_provider",
        `The coding agent can't continue (${thrown.kind}): ${thrown.message} Fix it (Settings, or \`codex login\`), then press Resume.`,
      );
      return { kind: "stopped" };
    }
    if (thrown) {
      // Not the agent's work failing (git, an unreadable project): no point retrying.
      await this.db.update(tasks).set({ status: "needs-attention" }).where(eq(tasks.id, task.id));
      await this.stop(run.id, "needs-attention", `"${task.title}" couldn't run: ${error}`);
      return { kind: "stopped" };
    }
    return { kind: "failed", error };
  }

  /** Moves a running (or paused) run to a stopped state with a reason. */
  private async stop(runId: number, status: RunStatus, reason: string) {
    await this.db
      .update(runs)
      .set({ status, statusReason: reason, updatedAt: new Date() })
      .where(and(eq(runs.id, runId), inArray(runs.status, ["running", "paused"])));
  }

  /** One attempt with its log, checks, changed files, and diff. */
  async attemptDetail(
    projectId: string,
    runId: number,
    attemptId: number,
  ): Promise<Attempt | undefined> {
    const run = await this.findRun(projectId, runId);
    if (!run) return undefined;
    const [row] = await this.db
      .select()
      .from(attempts)
      .where(and(eq(attempts.runId, runId), eq(attempts.id, attemptId)));
    if (!row) return undefined;
    const live = this.events.get(attemptId);
    return live ? { ...row, events: [...live] } : row;
  }

  async settings(projectId: string): Promise<RunSettings | undefined> {
    const [row] = await this.db
      .select({ gitStrategy: projects.gitStrategy, maxRetries: projects.maxRetries })
      .from(projects)
      .where(eq(projects.id, projectId));
    return row;
  }

  /** Changes the git strategy and retry limit for runs planned from now on. */
  async saveSettings(projectId: string, patch: Partial<RunSettings>) {
    const [row] = await this.db
      .update(projects)
      .set(patch)
      .where(eq(projects.id, projectId))
      .returning({ gitStrategy: projects.gitStrategy, maxRetries: projects.maxRetries });
    return row;
  }

  private async findRun(projectId: string, runId: number): Promise<Run | undefined> {
    const [run] = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.projectId, projectId), eq(runs.id, runId)));
    return run;
  }

  private async hasPending(runId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.runId, runId), eq(tasks.status, "pending")))
      .limit(1);
    return !!row;
  }

  private async editable(
    projectId: string,
    runId: number,
    taskId: number,
  ): Promise<Result<object>> {
    const run = await this.findRun(projectId, runId);
    if (!run) return notFound();
    if (!allows(run.status, "edit")) return wrongState(run, "edit");
    const [task] = await this.db
      .select({ status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.runId, runId), eq(tasks.id, taskId)));
    if (!task) return notFound("Task");
    return task.status === "pending" ? { ok: true } : this.taskNotPending();
  }

  private taskNotPending(): Failure {
    return {
      ok: false,
      status: 409,
      code: "TASK_STATE",
      message: "Only tasks that haven't started can be changed.",
    };
  }
}

const firstLine = (text: string) => text.split("\n")[0] ?? text;

function toPlannedTask(task: Task): PlannedTask {
  return {
    key: task.key,
    element: task.element,
    attachment: task.attachment,
    title: task.title,
    description: task.description,
    acceptance: task.acceptance,
    ownedPaths: task.ownedPaths,
    dependsOn: task.dependsOn,
    source: task.source,
  };
}

/** Adds usage up; anything unknown (`null`) makes the total's `known` false. */
export function sumUsage(parts: (AttemptUsage | RunUsage | null)[]): RunUsage {
  const total: RunUsage = { inputTokens: 0, outputTokens: 0, known: true };
  for (const part of parts) {
    if (!part) {
      total.known = false;
      continue;
    }
    total.inputTokens += part.inputTokens;
    total.outputTokens += part.outputTokens;
    total.known &&= part.known;
  }
  return total;
}

/**
 * After a restart: the attempt that was running is `interrupted` and its task goes back to
 * pending (its workspace is kept), and running runs are paused until the person resumes them.
 * Planning is re-queued by `requeuePlanning` once the job handlers are running.
 */
export async function recoverRuns(db: Db): Promise<void> {
  const now = new Date();
  await db
    .update(attempts)
    .set({ status: "interrupted", error: "Jeeves restarted during this attempt.", finishedAt: now })
    .where(eq(attempts.status, "running"));
  await db.update(tasks).set({ status: "pending" }).where(eq(tasks.status, "running"));
  await db
    .update(runs)
    .set({
      status: "paused",
      statusReason: "Jeeves restarted while this run was running. Press Resume to continue.",
      updatedAt: now,
    })
    .where(eq(runs.status, "running"));
}

/** Queues planning again for runs a restart left in `planning`. */
export async function requeuePlanning(db: Db, jobs: JobQueue): Promise<void> {
  const planning = await db.select({ id: runs.id }).from(runs).where(eq(runs.status, "planning"));
  for (const { id } of planning) await jobs.send(PLAN_JOB, { runId: id });
}

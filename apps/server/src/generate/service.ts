import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import {
  type GenerateProjectOptions,
  type GenerateProjectResult,
  generateProject,
  packageName,
} from "@jeeves/generator";
import {
  type BaselineEvent,
  type BaselineOptions,
  type BaselineResult,
  baselineSteps,
  runBaseline,
} from "@jeeves/generator/baseline";
import { blocksGenerate, type DesignDocument } from "@jeeves/spec";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
  type GenerationCheck,
  type GenerationLogLine,
  type GenerationReport,
  type GenerationStatus,
  type GenerationStep,
  type GenerationStepId,
  generations,
  projects,
  runs,
} from "../db/schema.ts";
import type { DesignService } from "../design/service.ts";

export type Generation = typeof generations.$inferSelect;

/** Streamed to the Generate drawer, one JSON object per line. */
export type GenerationEvent =
  | { type: "snapshot"; generation: Generation }
  | { type: "step"; step: GenerationStep }
  | { type: "log"; line: GenerationLogLine }
  | { type: "check"; check: GenerationCheck }
  | { type: "done"; generation: Generation };

/** The generator itself, swappable so API tests don't write projects or start Docker. */
export interface GeneratorRunner {
  generate(options: GenerateProjectOptions): Promise<GenerateProjectResult>;
  baseline(options: BaselineOptions): Promise<BaselineResult>;
}

export const realGenerator: GeneratorRunner = {
  generate: generateProject,
  baseline: runBaseline,
};

/** Lines of output kept per generation, in memory and in the database. */
const LOG_CAP = 3000;
const FLUSH_MS = 1000;

export type StartResult =
  | { ok: true; generation: Generation }
  | { ok: false; status: 404 | 409 | 422; code: string; message: string };

type Live = {
  generation: Generation;
  listeners: Set<(event: GenerationEvent) => void>;
  abort: AbortController;
};

/**
 * Generate (PLAN §9) as a background job per project: write the template project, then run the
 * baseline check. One generation runs per project at a time. Progress is kept in memory while it
 * runs (for live streams) and saved to `generations` as it goes, so the drawer can show the last
 * result after a reload. A restart marks a running generation `interrupted`.
 */
export class GenerationService {
  private readonly live = new Map<number, Live>();
  /** Projects with a generation starting or running. */
  private readonly busy = new Set<string>();

  constructor(
    private readonly db: Db,
    private readonly design: DesignService,
    private readonly runner: GeneratorRunner = realGenerator,
    private readonly projectsDir = defaultProjectsDir(),
  ) {}

  /** The project's output folder, a suggested default, and its latest generation. */
  async overview(projectId: string) {
    const project = await this.design.getProject(projectId);
    if (!project) return undefined;
    const [latest] = await this.db
      .select()
      .from(generations)
      .where(eq(generations.projectId, projectId))
      .orderBy(desc(generations.id))
      .limit(1);
    return {
      outputDir: project.outputDir,
      defaultOutputDir: join(this.projectsDir, packageName(project.name)),
      latest: latest ? (this.live.get(latest.id)?.generation ?? latest) : null,
    };
  }

  async get(projectId: string, id: number): Promise<Generation | undefined> {
    const live = this.live.get(id);
    if (live?.generation.projectId === projectId) return live.generation;
    const [row] = await this.db
      .select()
      .from(generations)
      .where(and(eq(generations.projectId, projectId), eq(generations.id, id)));
    return row;
  }

  async start(
    projectId: string,
    input: { outputDir?: string; baseline: boolean },
  ): Promise<StartResult> {
    const state = await this.design.getDesign(projectId);
    const project = await this.design.getProject(projectId);
    if (!state || !project) {
      return { ok: false, status: 404, code: "NOT_FOUND", message: "Project not found." };
    }
    if (this.busy.has(projectId)) {
      return {
        ok: false,
        status: 409,
        code: "GENERATE_BUSY",
        message: "This project is already generating. Wait for it to finish or cancel it.",
      };
    }
    // Regenerating under a run would change files while an agent works on them (S12).
    const [executing] = await this.db
      .select({ id: runs.id, status: runs.status })
      .from(runs)
      .where(
        and(
          eq(runs.projectId, projectId),
          inArray(runs.status, ["running", "paused", "needs-attention", "waiting_for_provider"]),
        ),
      )
      .limit(1);
    if (executing) {
      return {
        ok: false,
        status: 409,
        code: "RUN_ACTIVE",
        message: `Run ${executing.id} is ${executing.status.replaceAll("_", " ")}. Finish or cancel it before generating again.`,
      };
    }
    if (state.design.elements.length === 0) {
      return {
        ok: false,
        status: 422,
        code: "DESIGN_EMPTY",
        message: "Add at least one element to the design before generating.",
      };
    }
    if (blocksGenerate(state.findings)) {
      const errors = state.findings.filter((f) => f.severity === "error").length;
      return {
        ok: false,
        status: 422,
        code: "DESIGN_NOT_READY",
        message: `Fix the design's ${errors} error${errors === 1 ? "" : "s"} (see Findings) before generating.`,
      };
    }
    const outputDir = expandHome(
      input.outputDir?.trim() ||
        project.outputDir ||
        join(this.projectsDir, packageName(project.name)),
    );
    if (!isAbsolute(outputDir)) {
      return {
        ok: false,
        status: 422,
        code: "INVALID_OUTPUT_DIR",
        message: "The output folder must be an absolute path, such as /home/you/projects/shorty.",
      };
    }
    const dir = resolve(outputDir);

    this.busy.add(projectId);
    try {
      return await this.launch(projectId, project.name, state.design, dir, input.baseline);
    } catch (error) {
      this.busy.delete(projectId);
      throw error;
    }
  }

  private async launch(
    projectId: string,
    projectName: string,
    design: DesignDocument,
    dir: string,
    baseline: boolean,
  ): Promise<StartResult> {
    await this.db.update(projects).set({ outputDir: dir }).where(eq(projects.id, projectId));
    const steps: GenerationStep[] = [
      { id: "generate", title: "Write the template project", status: "pending" },
      ...baselineSteps.map((s) => ({
        id: s.id,
        title: s.title,
        status: baseline ? ("pending" as const) : ("skipped" as const),
      })),
    ];
    const [generation] = await this.db
      .insert(generations)
      .values({
        projectId,
        revision: design.revision,
        outputDir: dir,
        baseline,
        status: "running",
        steps,
      })
      .returning();
    if (!generation) throw new Error("insert returned no generation");

    const live: Live = { generation, listeners: new Set(), abort: new AbortController() };
    this.live.set(generation.id, live);
    void this.run(live, projectName, design).catch((error: unknown) =>
      this.finish(live, "failed", (error as Error).message ?? String(error)).catch(() => {}),
    );
    return { ok: true, generation };
  }

  /**
   * Sends the generation's current state, then live events until it finishes. Resolves when the
   * stream is complete (immediately for a finished generation).
   */
  async follow(
    projectId: string,
    id: number,
    send: (event: GenerationEvent) => void,
  ): Promise<boolean> {
    const live = this.live.get(id);
    if (!live || live.generation.projectId !== projectId) {
      const generation = await this.get(projectId, id);
      if (!generation) return false;
      send({ type: "snapshot", generation });
      send({ type: "done", generation });
      return true;
    }
    send({ type: "snapshot", generation: live.generation });
    await new Promise<void>((done) => {
      const listener = (event: GenerationEvent) => {
        send(event);
        if (event.type === "done") {
          live.listeners.delete(listener);
          done();
        }
      };
      live.listeners.add(listener);
    });
    return true;
  }

  /** Stops a running generation; the baseline's containers are still taken down. */
  cancel(projectId: string, id: number): boolean {
    const live = this.live.get(id);
    if (!live || live.generation.projectId !== projectId) return false;
    live.abort.abort();
    return true;
  }

  private emit(live: Live, event: GenerationEvent) {
    for (const listener of live.listeners) listener(event);
  }

  private setStep(live: Live, id: GenerationStepId, patch: Partial<GenerationStep>) {
    const steps = live.generation.steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
    live.generation = { ...live.generation, steps };
    const step = steps.find((s) => s.id === id);
    if (step) this.emit(live, { type: "step", step });
  }

  private log(live: Live, step: GenerationStepId, text: string) {
    const line = { step, line: text };
    const log = [...live.generation.log, line];
    live.generation = { ...live.generation, log: log.length > LOG_CAP ? log.slice(-LOG_CAP) : log };
    this.emit(live, { type: "log", line });
  }

  private async save(live: Live) {
    const { steps, checks, log, report, status, error, finishedAt } = live.generation;
    await this.db
      .update(generations)
      .set({ steps, checks, log, report, status, error, finishedAt })
      .where(eq(generations.id, live.generation.id));
  }

  private async run(live: Live, projectName: string, design: DesignDocument) {
    const { outputDir: dir } = live.generation;
    const signal = live.abort.signal;
    const timer = setInterval(() => void this.save(live).catch(() => {}), FLUSH_MS);
    try {
      const started = Date.now();
      this.setStep(live, "generate", { status: "running" });
      this.log(live, "generate", `Generating design revision ${design.revision} into ${dir}`);
      let generated: GenerateProjectResult;
      try {
        generated = await this.runner.generate({
          dir,
          design,
          projectName,
          log: (line) => this.log(live, "generate", line),
        });
      } catch (error) {
        const message = (error as Error).message ?? String(error);
        this.setStep(live, "generate", {
          status: "failed",
          durationMs: Date.now() - started,
          message,
        });
        this.skipRemaining(live);
        return await this.finish(live, "failed", message);
      }
      if (!generated.ok) {
        const message = `Stopped: ${generated.problems.length} file(s) Jeeves owns were changed outside Jeeves. Nothing was written.`;
        live.generation = { ...live.generation, report: blockedReport(generated.problems) };
        for (const problem of generated.problems) this.log(live, "generate", problem.message);
        this.setStep(live, "generate", {
          status: "failed",
          durationMs: Date.now() - started,
          message,
        });
        this.skipRemaining(live);
        return await this.finish(live, "blocked", message);
      }
      live.generation = { ...live.generation, report: reportOf(generated) };
      this.setStep(live, "generate", {
        status: "passed",
        durationMs: Date.now() - started,
        message: summary(generated),
      });
      if (!live.generation.baseline) return await this.finish(live, "succeeded");
      if (signal.aborted) {
        this.skipRemaining(live);
        return await this.finish(live, "cancelled");
      }

      const baseline = await this.runner.baseline({
        dir,
        design,
        subjects: generated.plan.subjects,
        signal,
        onEvent: (event) => this.onBaselineEvent(live, event),
      });
      if (signal.aborted) return await this.finish(live, "cancelled");
      const failed = baseline.steps.find((s) => s.status === "failed");
      return await this.finish(
        live,
        baseline.ok ? "succeeded" : "failed",
        baseline.ok
          ? undefined
          : `The baseline isn't green (${failed?.step ?? "a step"} failed). This is a template bug, not something for agents to fix.`,
      );
    } finally {
      clearInterval(timer);
    }
  }

  private onBaselineEvent(live: Live, event: BaselineEvent) {
    // Generation doesn't run the project's tests; that step only exists in task checks.
    if (event.type !== "check" && event.step === "unit-tests") return;
    switch (event.type) {
      case "step":
        this.setStep(live, event.step as GenerationStepId, {
          status: event.status,
          ...(event.durationMs !== undefined && { durationMs: event.durationMs }),
          ...(event.message && { message: event.message }),
        });
        break;
      case "log":
        this.log(live, event.step as GenerationStepId, event.line);
        break;
      case "check":
        live.generation = { ...live.generation, checks: [...live.generation.checks, event.check] };
        this.emit(live, { type: "check", check: event.check });
        break;
    }
  }

  private skipRemaining(live: Live) {
    for (const step of live.generation.steps) {
      if (step.status === "pending") this.setStep(live, step.id, { status: "skipped" });
    }
  }

  private async finish(live: Live, status: GenerationStatus, error?: string) {
    this.skipRemaining(live);
    live.generation = {
      ...live.generation,
      status,
      error: error ?? null,
      finishedAt: new Date(),
    };
    await this.save(live);
    this.live.delete(live.generation.id);
    this.busy.delete(live.generation.projectId);
    this.emit(live, { type: "done", generation: live.generation });
  }
}

/** Marks generations that were running when Jeeves stopped. */
export async function failInterruptedGenerations(db: Db): Promise<void> {
  await db
    .update(generations)
    .set({
      status: "interrupted",
      error: "Jeeves restarted during this generation. Generate again.",
      finishedAt: new Date(),
    })
    .where(eq(generations.status, "running"));
}

export function defaultProjectsDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.JEEVES_PROJECTS_DIR || join(homedir(), "jeeves-projects");
}

function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : path;
}

function reportOf(result: Extract<GenerateProjectResult, { ok: true }>): GenerationReport {
  return {
    written: result.written,
    scaffolded: result.scaffolded,
    kept: result.kept,
    packages: result.packages,
    vendored: result.vendored,
    removedElements: result.removedElements.map(({ id, dir }) => ({ id, dir })),
    orphaned: result.orphaned,
    git: result.git,
    problems: [],
  };
}

function blockedReport(problems: GenerationReport["problems"]): GenerationReport {
  return {
    written: [],
    scaffolded: [],
    kept: [],
    packages: [],
    vendored: [],
    removedElements: [],
    orphaned: [],
    git: "disabled",
    problems,
  };
}

function summary(result: Extract<GenerateProjectResult, { ok: true }>): string {
  const parts = [
    `${result.written.length} generated file(s) updated`,
    `${result.scaffolded.length} scaffolded`,
    `${result.kept.length} project-owned kept`,
  ];
  if (result.removedElements.length > 0) {
    parts.push(`${result.removedElements.length} removed element(s) left in place`);
  }
  return parts.join(", ");
}

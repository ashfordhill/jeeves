import { designApiPreview, recipeFindings, recipeForDesign } from "@jeeves/generator";
import type { Registry } from "@jeeves/registry";
import {
  type ArchitectureEvidence,
  type ArchitectureProvision,
  applyOperations,
  architectureViews,
  type CreateTarget,
  createTargetSchema,
  type DesignDocument,
  designBlueprint,
  designSchema,
  emptyDesign,
  emptyLayout,
  type Finding,
  isStructural,
  type LayoutDocument,
  type OperationInput,
  reviewArchitecture,
  type TargetOrigin,
  targetChanges,
  upgradeDesign,
  validateDesign,
} from "@jeeves/spec";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
  designRevisions,
  generations,
  layouts,
  type OperationSource,
  operations,
  projects,
  runs,
  tasks,
} from "../db/schema.ts";

export type Project = typeof projects.$inferSelect;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** `latestEdit` is the operation ID that undo would revert next, if any. */
export type History = { canUndo: boolean; canRedo: boolean; latestEdit: number | null };

/** What the canvas needs after loading or changing a design. */
export type DesignState = {
  projectId: string;
  design: DesignDocument;
  findings: Finding[];
  history: History;
};

export type ChangeResult =
  | { ok: true; state: DesignState; operationId: number }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "conflict"; message: string; state: DesignState }
  | { ok: false; reason: "invalid"; errors: Finding[] }
  | { ok: false; reason: "nothing-to-undo" | "nothing-to-redo"; message: string };

export type EditInput = {
  baseRevision: number;
  /** Parsed by `applyOperations`, so malformed ops come back as `INVALID_OPERATION` findings. */
  ops: unknown[];
  source: OperationSource;
};

/**
 * Projects, designs, history, and layout in Postgres. Each change runs in one transaction that
 * locks the project row, so concurrent edits to a project apply one at a time.
 */
export class DesignService {
  constructor(
    private readonly db: Db,
    private readonly registry: Registry,
  ) {}

  listProjects(): Promise<Project[]> {
    return this.db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  createProject(
    name: string,
    initial?: { design: DesignDocument; layout: LayoutDocument },
  ): Promise<Project> {
    const design = initial ? { ...upgradeDesign(initial.design), revision: 0 } : emptyDesign();
    const findings = this.findings(design);
    if (initial && findings.some((item) => item.severity === "error"))
      throw new Error(findings.map((item) => item.message).join("\n"));
    return this.db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({ name }).returning();
      if (!project) throw new Error("insert returned no project");
      await tx.insert(designRevisions).values({
        projectId: project.id,
        revision: design.revision,
        document: design,
        findings,
      });
      await tx
        .insert(layouts)
        .values({ projectId: project.id, document: initial?.layout ?? emptyLayout() });
      return project;
    });
  }

  /** A locked source read and all target rows commit together. No output/history is copied. */
  createTarget(sourceId: string, input: CreateTarget) {
    const parsed = createTargetSchema.parse(input);
    return this.db.transaction(async (tx) => {
      const source = await lockProject(tx, sourceId);
      if (!source) return { ok: false as const, reason: "not-found" as const };
      const current = await this.current(tx, source);
      if (source.revision !== parsed.baseRevision)
        return this.conflict(tx, source, parsed.baseRevision, current);
      const [snapshot] = await tx
        .select({ document: designRevisions.document })
        .from(designRevisions)
        .where(
          and(
            eq(designRevisions.projectId, source.id),
            eq(designRevisions.revision, source.revision),
          ),
        );
      if (!snapshot) throw new Error("Source revision snapshot is missing");
      const baseline = designSchema.parse(snapshot.document);
      const design = { ...upgradeDesign(baseline), revision: 0 };
      if (parsed.recipeMode === "conceptual-replacement") delete design.recipe;
      const findings = this.findings(design);
      const errors = findings.filter(isStructural);
      // Faithful recipe copies still require the original protected contract to be sound.
      if (parsed.recipeMode === "protected-copy")
        errors.push(...recipeFindings(design, this.registry));
      if (errors.length) return { ok: false as const, reason: "invalid" as const, errors };
      const target: TargetOrigin = {
        schemaVersion: 1,
        sourceProjectId: source.id,
        sourceProjectName: source.name,
        sourceRevision: source.revision,
        capturedAt: new Date().toISOString(),
        baseline,
        recipeMode: parsed.recipeMode,
        ...(parsed.reason && { reason: parsed.reason }),
      };
      const [project] = await tx.insert(projects).values({ name: parsed.name, target }).returning();
      if (!project) throw new Error("insert returned no target project");
      await tx
        .insert(designRevisions)
        .values({ projectId: project.id, revision: 0, document: design, findings });
      const [layout] = await tx.select().from(layouts).where(eq(layouts.projectId, source.id));
      await tx
        .insert(layouts)
        .values({ projectId: project.id, document: layout?.document ?? emptyLayout() });
      return { ok: true as const, project };
    });
  }

  async targetComparison(projectId: string) {
    // Lock target while reading its revision; source drift is a separately labeled observation.
    return this.db.transaction(async (tx) => {
      const project = await lockProject(tx, projectId);
      if (!project?.target) return undefined;
      const current = await this.current(tx, project);
      // Read identity/revision/snapshot together: concurrent source deletion can only
      // produce a retained observation or an unavailable source, never a torn read.
      const [source] = await tx
        .select({
          id: projects.id,
          name: projects.name,
          revision: projects.revision,
          document: designRevisions.document,
        })
        .from(projects)
        .innerJoin(
          designRevisions,
          and(
            eq(designRevisions.projectId, projects.id),
            eq(designRevisions.revision, projects.revision),
          ),
        )
        .where(eq(projects.id, project.target.sourceProjectId));
      return {
        origin: project.target,
        revision: project.revision,
        proposed: current.document,
        changes: targetChanges(project.target.baseline, current.document),
        source: source
          ? {
              id: source.id,
              name: source.name,
              revision: source.revision,
              drift: targetChanges(project.target.baseline, source.document),
              revisionChanged: source.revision !== project.target.sourceRevision,
            }
          : null,
      };
    });
  }

  async apiPreview(projectId: string) {
    const state = await this.getDesign(projectId);
    return state ? designApiPreview(state.design, this.registry) : undefined;
  }

  /** SG03 code-generation boundary: read-only, derived on request, never stored. */
  async blueprint(projectId: string) {
    const project = await this.getProject(projectId);
    if (!project) return undefined;
    return designBlueprint((await this.current(this.db, project)).document, project.name);
  }

  async architecture(projectId: string) {
    const state = await this.getDesign(projectId);
    const project = await this.getProject(projectId);
    if (!state || !project) return undefined;
    let provision: ArchitectureProvision | undefined;
    try {
      const recipe = recipeForDesign(state.design, this.registry);
      if (recipe)
        provision = {
          id: recipe.manifest.id,
          version: recipe.manifest.version,
          ...recipe.manifest.provided,
          frontendNotes: Object.fromEntries(
            recipe.design.elements
              .filter((element) => recipe.manifest.provided.frontends.includes(element.id))
              .map((element) => [element.id, element.notes]),
          ),
        };
    } catch {
      /* Invalid bindings remain visible as findings; do not claim supplied behavior. */
    }
    return {
      revision: state.design.revision,
      views: architectureViews(state.design, this.registry, project.name, provision),
      review: reviewArchitecture(state.design),
      evidence: await this.architectureEvidence(project, state.design.revision),
    };
  }

  private async architectureEvidence(
    project: Project,
    revision: number,
  ): Promise<ArchitectureEvidence> {
    const [generation] = await this.db
      .select({
        id: generations.id,
        revision: generations.revision,
        outputDir: generations.outputDir,
        baseline: generations.baseline,
        status: generations.status,
        createdAt: generations.createdAt,
        finishedAt: generations.finishedAt,
        stages: generations.steps,
        checks: generations.checks,
      })
      .from(generations)
      .where(eq(generations.projectId, project.id))
      .orderBy(desc(generations.id))
      .limit(1);
    const [run] = await this.db
      .select({
        id: runs.id,
        revision: runs.designRevision,
        outputDir: runs.outputDir,
        status: runs.status,
        updatedAt: runs.updatedAt,
      })
      .from(runs)
      .where(eq(runs.projectId, project.id))
      .orderBy(desc(runs.id))
      .limit(1);
    const counts = run
      ? await this.db
          .select({ status: tasks.status, count: count() })
          .from(tasks)
          .where(eq(tasks.runId, run.id))
          .groupBy(tasks.status)
      : [];
    return {
      projectId: project.id,
      revision,
      outputDir: project.outputDir,
      generation: generation
        ? {
            id: generation.id,
            revision: generation.revision,
            outputDir: generation.outputDir,
            baseline: generation.baseline,
            status: generation.status,
            createdAt: generation.createdAt.toISOString(),
            finishedAt: generation.finishedAt?.toISOString() ?? null,
            stages: generation.stages
              .slice(0, 32)
              .map(({ id, title, status }) => ({ id, title: title.slice(0, 200), status })),
            checks: generation.checks
              .slice(0, 200)
              .map(
                ({
                  subject,
                  template,
                  id,
                  title,
                  status,
                  layer,
                  acceptanceIds,
                  reason,
                  error,
                }) => ({
                  subject,
                  template,
                  id,
                  title: title.slice(0, 300),
                  status,
                  ...(layer && { layer }),
                  ...(acceptanceIds && { acceptanceIds }),
                  ...((reason || error) && { reason: (reason || error)!.slice(0, 600) }),
                }),
              ),
            omittedChecks: Math.max(0, generation.checks.length - 200),
            omittedStages: Math.max(0, generation.stages.length - 32),
          }
        : null,
      run: run
        ? {
            ...run,
            updatedAt: run.updatedAt.toISOString(),
            tasks: Object.fromEntries(counts.map((item) => [item.status, item.count])),
          }
        : null,
    };
  }

  async renameProject(id: string, name: string): Promise<Project | undefined> {
    const [project] = await this.db
      .update(projects)
      .set({ name, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  /** Partial update for the project menu and the qrwty bootstrap (name and output folder). */
  async updateProject(
    id: string,
    patch: { name?: string; outputDir?: string },
  ): Promise<Project | undefined> {
    const current = await this.getProject(id);
    if (current?.target && patch.outputDir !== undefined) throw new PlanningWorkspaceError();
    if (Object.keys(patch).length === 0) return current;
    const [project] = await this.db
      .update(projects)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  /** Deletes the project with its revisions, history, and layout. */
  async deleteProject(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    return deleted.length > 0;
  }

  async getDesign(projectId: string): Promise<DesignState | undefined> {
    const project = await this.getProject(projectId);
    return project && this.state(this.db, project);
  }

  /** Applies an operation batch all-or-nothing as one new revision and one undo step. */
  edit(projectId: string, input: EditInput): Promise<ChangeResult> {
    return this.db.transaction(async (tx) => {
      const project = await lockProject(tx, projectId);
      if (!project) return { ok: false, reason: "not-found" };
      const current = await this.current(tx, project);
      if (input.baseRevision !== project.revision) {
        return this.conflict(tx, project, input.baseRevision, current);
      }
      const result = applyOperations(
        current.document,
        input.ops as OperationInput[],
        this.registry,
        { baseRevision: input.baseRevision, allowSubtypeConfirmation: input.source !== "chat" },
      );
      if (!result.ok) return { ok: false, reason: "invalid", errors: result.errors };

      if (
        project.target?.recipeMode === "protected-copy" &&
        current.document.recipe &&
        (!result.design.recipe ||
          result.design.recipe.id !== current.document.recipe.id ||
          result.design.recipe.version !== current.document.recipe.version)
      )
        return {
          ok: false,
          reason: "invalid",
          errors: [
            {
              code: "CONFIG_INVALID",
              severity: "error",
              message:
                "Protected target recipe binding cannot be removed or replaced. Create an explicit conceptual replacement target instead.",
              target: {},
            },
          ],
        };
      // Protected recipe contracts are also guarded at the shared mutation boundary.
      // Allow repair of historical invalid designs, but never break a valid recipe binding.
      if (current.document.recipe && !recipeFindings(current.document, this.registry).length) {
        const errors = recipeFindings(result.design, this.registry);
        if (errors.length) return { ok: false, reason: "invalid", errors };
      }

      // A new edit ends the redo chain.
      await tx
        .update(operations)
        .set({ state: "discarded" })
        .where(and(eq(operations.projectId, project.id), eq(operations.state, "undone")));
      const operationId = await this.record(
        tx,
        project,
        result.design,
        this.findings(result.design),
        {
          kind: "edit",
          source: input.source,
          ops: input.ops as OperationInput[],
          state: "applied",
          before: current.document,
        },
      );
      return { ok: true, operationId, state: await this.state(tx, project) };
    });
  }

  /** Restores the design from before the latest applied edit, as a new revision. */
  undo(projectId: string, baseRevision: number, source: OperationSource): Promise<ChangeResult> {
    return this.restore(projectId, baseRevision, source, "undo");
  }

  /** Re-applies the most recently undone edit, as a new revision. */
  redo(projectId: string, baseRevision: number, source: OperationSource): Promise<ChangeResult> {
    return this.restore(projectId, baseRevision, source, "redo");
  }

  async getLayout(projectId: string): Promise<LayoutDocument | undefined> {
    const [row] = await this.db
      .select({ document: layouts.document })
      .from(layouts)
      .where(eq(layouts.projectId, projectId));
    return row?.document;
  }

  /** Replaces the layout. Never touches the semantic revision. */
  putLayout(projectId: string, layout: LayoutDocument): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [project] = await tx
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(eq(projects.id, projectId))
        .returning({ id: projects.id });
      if (!project) return false;
      await tx
        .insert(layouts)
        .values({ projectId, document: layout })
        .onConflictDoUpdate({
          target: layouts.projectId,
          set: { document: layout, updatedAt: new Date() },
        });
      return true;
    });
  }

  private restore(
    projectId: string,
    baseRevision: number,
    source: OperationSource,
    kind: "undo" | "redo",
  ): Promise<ChangeResult> {
    return this.db.transaction(async (tx) => {
      const project = await lockProject(tx, projectId);
      if (!project) return { ok: false, reason: "not-found" };
      const current = await this.current(tx, project);
      if (baseRevision !== project.revision) {
        return this.conflict(tx, project, baseRevision, current);
      }
      // Undone edits are always the newest ones, so undo takes the latest applied edit and redo
      // the earliest undone one.
      const [target] = await tx
        .select({ id: operations.id, before: operations.before, after: operations.after })
        .from(operations)
        .where(
          and(
            eq(operations.projectId, project.id),
            eq(operations.state, kind === "undo" ? "applied" : "undone"),
          ),
        )
        .orderBy(kind === "undo" ? desc(operations.id) : asc(operations.id))
        .limit(1);
      if (!target) {
        return {
          ok: false,
          reason: kind === "undo" ? "nothing-to-undo" : "nothing-to-redo",
          message: `There is nothing to ${kind}.`,
        };
      }

      const snapshot = kind === "undo" ? target.before : target.after;
      const design: DesignDocument = { ...upgradeDesign(snapshot), revision: project.revision + 1 };
      // Findings are recomputed: the registry may have changed since the snapshot was taken.
      const findings = this.findings(design);
      await tx
        .update(operations)
        .set({ state: kind === "undo" ? "undone" : "applied" })
        .where(eq(operations.id, target.id));
      const operationId = await this.record(tx, project, design, findings, {
        kind,
        source,
        targetId: target.id,
        before: current.document,
      });
      return { ok: true, operationId, state: await this.state(tx, project) };
    });
  }

  /** Saves a new revision and its history row, and moves the project to it. */
  private async record(
    tx: Tx,
    project: Project,
    design: DesignDocument,
    findings: Finding[],
    row: Pick<typeof operations.$inferInsert, "kind" | "source" | "ops" | "targetId" | "state"> & {
      before: DesignDocument;
    },
  ): Promise<number> {
    await tx.insert(designRevisions).values({
      projectId: project.id,
      revision: design.revision,
      document: design,
      findings,
    });
    const [inserted] = await tx
      .insert(operations)
      .values({
        ...row,
        projectId: project.id,
        baseRevision: project.revision,
        revision: design.revision,
        after: design,
      })
      .returning({ id: operations.id });
    await tx
      .update(projects)
      .set({ revision: design.revision, updatedAt: new Date() })
      .where(eq(projects.id, project.id));
    project.revision = design.revision;
    if (!inserted) throw new Error("insert returned no operation");
    return inserted.id;
  }

  private async conflict(
    tx: Tx,
    project: Project,
    baseRevision: number,
    current: { document: DesignDocument; findings: Finding[] },
  ): Promise<Extract<ChangeResult, { reason: "conflict" }>> {
    return {
      ok: false,
      reason: "conflict",
      message: `The design changed (now revision ${project.revision}, edits were based on ${baseRevision}). Reload and try again.`,
      state: {
        projectId: project.id,
        design: current.document,
        findings: current.findings,
        history: await history(tx, project.id),
      },
    };
  }

  private async current(db: Db | Tx, project: Project) {
    const [row] = await db
      .select({ document: designRevisions.document, findings: designRevisions.findings })
      .from(designRevisions)
      .where(
        and(
          eq(designRevisions.projectId, project.id),
          eq(designRevisions.revision, project.revision),
        ),
      );
    if (!row) throw new Error(`project ${project.id} has no revision ${project.revision}`);
    const document = upgradeDesign(row.document);
    return { document, findings: this.findings(document) };
  }

  private findings(design: DesignDocument): Finding[] {
    return [...validateDesign(design, this.registry), ...recipeFindings(design, this.registry)];
  }

  private async state(db: Db | Tx, project: Project): Promise<DesignState> {
    const current = await this.current(db, project);
    return {
      projectId: project.id,
      design: current.document,
      findings: current.findings,
      history: await history(db, project.id),
    };
  }
}

async function lockProject(tx: Tx, id: string): Promise<Project | undefined> {
  const [project] = await tx.select().from(projects).where(eq(projects.id, id)).for("update");
  return project;
}

async function history(db: Db | Tx, projectId: string): Promise<History> {
  const newest = async (state: "applied" | "undone") => {
    const [row] = await db
      .select({ id: operations.id })
      .from(operations)
      .where(and(eq(operations.projectId, projectId), eq(operations.state, state)))
      .orderBy(desc(operations.id))
      .limit(1);
    return row?.id ?? null;
  };
  const latestEdit = await newest("applied");
  return { canUndo: latestEdit !== null, canRedo: (await newest("undone")) !== null, latestEdit };
}

export class PlanningWorkspaceError extends Error {
  readonly statusCode = 422;
  readonly code = "PLANNING_WORKSPACE";
  constructor() {
    super(
      "Target workspaces are planning only. Output ownership, generation and runs are unavailable.",
    );
  }
}

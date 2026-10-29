import type { Registry } from "@jeeves/registry";
import {
  applyOperations,
  type DesignDocument,
  emptyDesign,
  emptyLayout,
  type Finding,
  type LayoutDocument,
  type OperationInput,
  validateDesign,
} from "@jeeves/spec";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
  designRevisions,
  layouts,
  type OperationSource,
  operations,
  projects,
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

  createProject(name: string): Promise<Project> {
    return this.db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({ name }).returning();
      if (!project) throw new Error("insert returned no project");
      const design = emptyDesign();
      await tx.insert(designRevisions).values({
        projectId: project.id,
        revision: design.revision,
        document: design,
        findings: validateDesign(design, this.registry),
      });
      await tx.insert(layouts).values({ projectId: project.id, document: emptyLayout() });
      return project;
    });
  }

  async renameProject(id: string, name: string): Promise<Project | undefined> {
    const [project] = await this.db
      .update(projects)
      .set({ name, updatedAt: new Date() })
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
        { baseRevision: input.baseRevision },
      );
      if (!result.ok) return { ok: false, reason: "invalid", errors: result.errors };

      // A new edit ends the redo chain.
      await tx
        .update(operations)
        .set({ state: "discarded" })
        .where(and(eq(operations.projectId, project.id), eq(operations.state, "undone")));
      const operationId = await this.record(tx, project, result.design, result.findings, {
        kind: "edit",
        source: input.source,
        ops: input.ops as OperationInput[],
        state: "applied",
        before: current.document,
      });
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
      const design: DesignDocument = { ...snapshot, revision: project.revision + 1 };
      // Findings are recomputed: the registry may have changed since the snapshot was taken.
      const findings = validateDesign(design, this.registry);
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
  ): Promise<ChangeResult> {
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
    return row;
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

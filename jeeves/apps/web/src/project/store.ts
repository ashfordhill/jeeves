/**
 * Project state. The server owns the design: every change is posted as an operation batch and the
 * store adopts whatever design the server answers with. Undo and redo run on the server's design
 * history. All writes share one request chain, so each runs against the revision the previous one
 * produced.
 */
import type { DesignDocument, Finding, OperationInput, Rekey } from "@jeeves/spec";
import { create } from "zustand";
import { ApiError, api, type DesignState, type EditResult, type Project } from "./api.ts";
import { createExampleProject, DEFAULT_EXAMPLE_ID } from "./create-example.ts";
import { type DraftIntent, type DraftResult, formDrafts } from "./form-drafts.ts";

export type Notice = { tone: "error" | "info"; message: string };

const PROJECT_KEY = "jeeves.project";

type Loaded = {
  project: Project;
  design: DesignDocument;
  findings: Finding[];
  history: DesignState["history"];
  /** The IDs the change that produced this design re-keyed, for the selection to follow. */
  renamed?: Rekey[];
};

type ProjectState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  loaded?: Loaded;
  notice?: Notice;
  /** The selected element, connection or entry IDs, sent with chat messages. */
  architectureSelection?: string[];
  historyBusy: boolean;

  open(projectId?: string): Promise<void>;
  edit(ops: OperationInput[]): Promise<boolean>;
  /** Builds the batch from the design current when it runs, after every queued write. */
  commit(
    projectId: string,
    rebuild: (design: DesignDocument) => OperationInput[],
  ): Promise<boolean>;
  editIntent(intent: DraftIntent): Promise<DraftResult>;
  /** Flush valid inspector input and wait for the existing serialized design queue. */
  flushEdits(): Promise<boolean>;
  setNotice(notice: Notice | undefined): void;
  undo(): Promise<void>;
  redo(): Promise<void>;
  /** Adopts a design changed elsewhere in this app (a chat turn). */
  adoptChange(state: DesignState): void;
  /** Undoes that server edit, if it's still the newest one. Returns whether it did. */
  undoEdit(operationId: number): Promise<boolean>;
};

/** Whether the undo / redo buttons have anything to do. */
export function canUndo(s: ProjectState): boolean {
  return !!s.loaded?.history.canUndo;
}

export function canRedo(s: ProjectState): boolean {
  return !!s.loaded?.history.canRedo;
}

let editChain: Promise<unknown> = Promise.resolve();

const CONFLICT_MESSAGE =
  "The design changed somewhere else, so the studio was reloaded with the latest version. Try that again.";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Project from the URL, else the last one opened here, else the newest, else a new one. */
async function resolveProject(requested: string | undefined): Promise<Project> {
  const remembered = (() => {
    try {
      return localStorage.getItem(PROJECT_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  for (const id of [requested, remembered]) {
    if (!id) continue;
    try {
      return await api.getProject(id);
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 400))
        throw error;
    }
  }
  const [newest] = await api.listProjects();
  if (newest) return newest;
  // A fresh installation opens on the default architecture study instead of an empty board.
  return createExampleProject(DEFAULT_EXAMPLE_ID);
}

function rememberProject(id: string) {
  try {
    localStorage.setItem(PROJECT_KEY, id);
  } catch {
    // Storage can be unavailable; the URL still carries the project.
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get("project") !== id) {
    url.searchParams.set("project", id);
    window.history.replaceState(window.history.state, "", url);
  }
}

export function projectFromUrl(): string | undefined {
  return new URL(window.location.href).searchParams.get("project") ?? undefined;
}

export const useProject = create<ProjectState>()((set, get) => {
  const accepted = new Map<string, DesignState>();
  let opening = 0;
  const adopt = (state: DesignState) => {
    const previous = accepted.get(state.projectId);
    if (previous && previous.design.revision > state.design.revision) return;
    accepted.set(state.projectId, state);
    // Drafts of re-keyed tiles and modules move to their new IDs before anything renders them.
    if (state.renamed) formDrafts.follow(state.projectId, state.renamed, state.design);
    const loaded = get().loaded;
    if (
      !loaded ||
      loaded.project.id !== state.projectId ||
      loaded.design.revision > state.design.revision
    )
      return;
    set({
      loaded: {
        ...loaded,
        project: { ...loaded.project, revision: state.design.revision },
        design: state.design,
        findings: state.findings,
        history: state.history,
        renamed: state.renamed,
      },
    });
  };

  /** Adopts a change result. Returns whether it applied; conflicts and refusals set the notice. */
  const settle = (result: EditResult): boolean => {
    if (result.ok) {
      adopt(result.state);
      return true;
    }
    if (result.reason === "conflict") {
      adopt(result.state);
      if (get().loaded?.project.id === result.state.projectId)
        set({ notice: { tone: "info", message: CONFLICT_MESSAGE } });
      return false;
    }
    set({ notice: { tone: "error", message: result.errors[0]?.message ?? result.message } });
    return false;
  };

  /** Runs design requests one at a time, each against the revision the previous one produced. */
  const chain = (run: () => Promise<boolean>): Promise<boolean> => {
    const projectId = get().loaded?.project.id;
    const guarded = async () => {
      try {
        return await run();
      } catch (error) {
        if (get().loaded?.project.id === projectId)
          set({ notice: { tone: "error", message: `Change not saved: ${message(error)}` } });
        return false;
      }
    };
    const next = editChain.then(guarded, guarded);
    editChain = next;
    return next;
  };

  const historyStep = async (direction: "undo" | "redo", operationId?: number) => {
    const projectId = get().loaded?.project.id;
    if (!projectId || get().historyBusy) return false;
    set({ historyBusy: true });
    try {
      if (!(await get().flushEdits()) || get().loaded?.project.id !== projectId) return false;
      return await chain(async () => {
        const loaded = get().loaded;
        if (!loaded || loaded.project.id !== projectId) return false;
        if (operationId !== undefined && loaded.history.latestEdit !== operationId) return false;
        if (!loaded.history[direction === "undo" ? "canUndo" : "canRedo"]) return false;
        if (!settle(await api[direction](projectId, loaded.design.revision))) return false;
        if (get().loaded?.project.id === projectId) set({ notice: undefined });
        return true;
      });
    } finally {
      set({ historyBusy: false });
    }
  };

  return {
    status: "idle",
    historyBusy: false,

    async open(projectId) {
      const previousProject = get().loaded?.project.id;
      if (previousProject) void formDrafts.flushProject(previousProject, true);
      const request = ++opening;
      set({ status: "loading", error: undefined, notice: undefined });
      try {
        const project = await resolveProject(projectId);
        const received = await api.getDesign(project.id);
        if (request !== opening) return;
        const known = accepted.get(project.id);
        const state = known && known.design.revision > received.design.revision ? known : received;
        accepted.set(project.id, state);
        rememberProject(project.id);
        set({
          status: "ready",
          loaded: {
            project,
            design: state.design,
            findings: state.findings,
            history: state.history,
          },
        });
      } catch (error) {
        if (request === opening) set({ status: "error", error: message(error) });
      }
    },

    async editIntent(intent) {
      let outcome: DraftResult = { status: "failed", message: "Change not saved" };
      await chain(async () => {
        try {
          const loaded = get().loaded;
          const current =
            loaded?.project.id === intent.projectId
              ? { design: loaded.design }
              : await api.getDesign(intent.projectId);
          const known = accepted.get(intent.projectId);
          const design =
            known && known.design.revision > current.design.revision
              ? known.design
              : current.design;
          const ops = intent.rebuild(design);
          if (!ops) {
            outcome = { status: "conflict", design };
            return false;
          }
          if (!ops.length) {
            outcome = { status: "saved", design };
            return true;
          }
          const result = await api.edit(intent.projectId, design.revision, ops);
          if (result.ok || result.reason === "conflict") {
            adopt(result.state);
            const latest = accepted.get(intent.projectId) ?? result.state;
            outcome = result.ok
              ? {
                  status: "saved",
                  design: latest.design,
                  written: result.state.design,
                  ...(result.state.renamed && { renamed: result.state.renamed }),
                }
              : { status: "conflict", design: latest.design };
            return result.ok;
          }
          outcome = { status: "failed", message: result.errors[0]?.message ?? result.message };
        } catch (error) {
          outcome = { status: "failed", message: `Change not saved: ${message(error)}` };
        }
        return false;
      });
      return outcome;
    },

    async flushEdits() {
      const projectId = get().loaded?.project.id;
      if (!projectId) return true;
      await formDrafts.flushProject(projectId, true);
      await editChain;
      return !formDrafts.hasProblems(projectId);
    },

    async edit(ops) {
      const projectId = get().loaded?.project.id;
      if (!(await get().flushEdits())) return false;
      return chain(async () => {
        const loaded = get().loaded;
        if (!loaded || loaded.project.id !== projectId) return false;
        return settle(await api.edit(loaded.project.id, loaded.design.revision, ops));
      });
    },

    async commit(projectId, rebuild) {
      if (!(await get().flushEdits())) return false;
      return chain(async () => {
        const loaded = get().loaded;
        if (!loaded || loaded.project.id !== projectId) return false;
        return settle(await api.edit(projectId, loaded.design.revision, rebuild(loaded.design)));
      });
    },

    async undo() {
      await historyStep("undo");
    },

    async redo() {
      await historyStep("redo");
    },

    adoptChange(state) {
      const loaded = get().loaded;
      // An older state (a studio edit landed after the turn) must not replace a newer one.
      if (loaded?.project.id === state.projectId && state.design.revision <= loaded.design.revision)
        return;
      adopt(state);
    },

    async undoEdit(operationId) {
      return historyStep("undo", operationId);
    },

    setNotice(notice) {
      set({ notice });
    },
  };
});

formDrafts.configure((intent) => useProject.getState().editIntent(intent));

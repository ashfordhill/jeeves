/**
 * Studio project state. The server owns the design: every semantic change is posted as an
 * operation batch and the store adopts whatever design the server answers with. Studio row-order
 * hints enter history after their separate layout PUT is acknowledged.
 *
 * One chronological stack orders server design history and studio view snapshots. All
 * persistence shares the request chain, and layout never changes semantic revision.
 */
import type {
  DesignDocument,
  Finding,
  LayoutDocument,
  OperationInput,
  StudioLayoutView,
} from "@jeeves/spec";
import { pruneLayout } from "@jeeves/spec";
import { create } from "zustand";
import { createExampleProject, DEFAULT_EXAMPLE_ID } from "../architecture/create-example.ts";
import { ApiError, api, type DesignState, type EditResult, type Project } from "./api.ts";
import { type DraftIntent, type DraftResult, formDrafts } from "./form-drafts.ts";

export type Notice = { tone: "error" | "info"; message: string };

/**
 * One undoable step. `design` marks a server-side edit made here; the server's history holds the
 * actual snapshots. `architecture` holds a studio view snapshot.
 */
type Step =
  | { kind: "design" }
  | { kind: "architecture"; key: string; before?: StudioLayoutView; after?: StudioLayoutView };

type LocalHistory = { undoSteps: Step[]; redoSteps: Step[]; redoBlocked: boolean };
const emptyHistory = (): LocalHistory => ({ undoSteps: [], redoSteps: [], redoBlocked: false });
/** JSON object key order is not an edit (Postgres can reorder saved layout keys). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const entries = Object.entries(a).filter(([, value]) => value !== undefined);
  return (
    entries.length === Object.values(b).filter((value) => value !== undefined).length &&
    entries.every(([key, value]) => same(value, (b as Record<string, unknown>)[key]))
  );
}

export const LAYOUT_SAVE_DELAY_MS = 400;
const PROJECT_KEY = "jeeves.project";

type Loaded = {
  project: Project;
  design: DesignDocument;
  findings: Finding[];
  history: DesignState["history"];
  layout: LayoutDocument;
};

type DrawState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  loaded?: Loaded;
  notice?: Notice;
  /** Layout changes not yet saved. */
  layoutDirty: boolean;
  /** Semantic identities selected in the active studio view, sent with chat messages. */
  architectureSelection?: string[];
  undoSteps: Step[];
  redoSteps: Step[];
  /** A new local edit also retires a server redo branch, without a semantic write. */
  redoBlocked: boolean;
  historyBusy: boolean;
  setArchitectureView(
    key: string,
    view: StudioLayoutView | undefined,
    undoable?: boolean,
    baselineCamera?: StudioLayoutView["viewport"],
  ): Promise<boolean>;

  open(projectId?: string): Promise<void>;
  edit(ops: OperationInput[]): Promise<boolean>;
  /** Rebuild creation against the serialized revision; publish its placement only after acceptance. */
  createPlaced(
    projectId: string,
    rebuild: (design: DesignDocument) => OperationInput[],
  ): Promise<boolean>;
  editIntent(intent: DraftIntent): Promise<DraftResult>;
  /** Flush valid inspector input and wait for the existing serialized design queue. */
  flushEdits(): Promise<boolean>;
  flushLayout(): Promise<void>;
  setNotice(notice: Notice | undefined): void;
  undo(): Promise<void>;
  redo(): Promise<void>;
  /** Adopts a design changed elsewhere in this app (a chat turn) as one design undo step. */
  adoptChange(state: DesignState): void;
  /** Undoes that server edit, if it's still the newest one. Returns whether it did. */
  undoEdit(operationId: number): Promise<boolean>;
};

/** Whether the undo / redo buttons have anything to do. */
export function canUndo(s: DrawState): boolean {
  return s.undoSteps.some((step) => step.kind !== "design") || !!s.loaded?.history.canUndo;
}

export function canRedo(s: DrawState): boolean {
  return (
    s.redoSteps.some((step) => step.kind !== "design" || !!s.loaded?.history.canRedo) ||
    (!s.redoBlocked && !!s.loaded?.history.canRedo)
  );
}

let editChain: Promise<unknown> = Promise.resolve();
let layoutTimer: ReturnType<typeof setTimeout> | undefined;

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

export const useDraw = create<DrawState>()((set, get) => {
  const accepted = new Map<string, DesignState>();
  // In-app project switches retain local order, including writes acknowledged after leaving.
  // A browser reload starts fresh; the server still owns durable semantic history.
  const histories = new Map<string, LocalHistory>();
  const history = (projectId: string) => histories.get(projectId) ?? emptyHistory();
  const setHistory = (projectId: string, next: LocalHistory) => {
    histories.set(projectId, next);
    if (get().loaded?.project.id === projectId) set(next);
  };
  const record = (projectId: string, step: Step) => {
    setHistory(projectId, {
      undoSteps: [...history(projectId).undoSteps, structuredClone(step)],
      redoSteps: [],
      redoBlocked: true,
    });
  };
  let opening = 0;
  const adopt = (state: DesignState) => {
    const previous = accepted.get(state.projectId);
    if (previous && previous.design.revision > state.design.revision) return;
    accepted.set(state.projectId, state);
    const loaded = get().loaded;
    if (
      !loaded ||
      loaded.project.id !== state.projectId ||
      loaded.design.revision > state.design.revision
    )
      return;
    const layout = pruneLayout(loaded.layout, state.design);
    const layoutChanged = JSON.stringify(layout) !== JSON.stringify(loaded.layout);
    set({
      loaded: {
        ...loaded,
        project: { ...loaded.project, revision: state.design.revision },
        design: state.design,
        layout,
        findings: state.findings,
        history: state.history,
      },
    });
    if (layoutChanged) scheduleLayoutSave();
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

  /** Every layout PUT shares the design request chain; a late camera save cannot overtake a move. */
  const saveLayout = async () => {
    const projectId = get().loaded?.project.id;
    if (!projectId || !get().layoutDirty) return;
    await chain(async () => {
      const loaded = get().loaded;
      if (!loaded || loaded.project.id !== projectId || !get().layoutDirty) return true;
      set({ layoutDirty: false });
      try {
        await api.putLayout(projectId, loaded.layout);
        return true;
      } catch (error) {
        if (get().loaded?.project.id === projectId)
          set({
            layoutDirty: true,
            notice: { tone: "error", message: `Layout not saved: ${message(error)}` },
          });
        return false;
      }
    });
  };

  const scheduleLayoutSave = () => {
    set({ layoutDirty: true });
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => void saveLayout(), LAYOUT_SAVE_DELAY_MS);
  };

  const viewAt = (layout: LayoutDocument, key: string, view?: StudioLayoutView) => {
    const architecture = { ...layout.architecture };
    if (view) architecture[key] = view;
    else delete architecture[key];
    return { ...layout, architecture };
  };
  const liveView = (loaded: Loaded, key: string, view?: StudioLayoutView) => {
    const pruned = pruneLayout(viewAt(loaded.layout, key, view), loaded.design).architecture?.[key];
    // An empty view has the same effect as no override.
    return pruned && Object.keys(pruned).length ? pruned : undefined;
  };
  const restoreLayout = async (
    loaded: Loaded,
    step: Extract<Step, { kind: "architecture" }>,
    direction: "undo" | "redo",
  ) => {
    const before = liveView(loaded, step.key, step.before);
    const after = liveView(loaded, step.key, step.after);
    if (same(before, after)) return false;
    const target = direction === "undo" ? before : after;
    const viewport = loaded.layout.architecture?.[step.key]?.viewport;
    // Only an action that changed its camera restores one. Row moves leave later pan/zoom alone.
    const restored =
      same(step.before?.viewport, step.after?.viewport) && viewport
        ? { ...target, viewport }
        : target;
    let layout = viewAt(loaded.layout, step.key, restored);
    if (same(layout, loaded.layout)) return false;
    await api.putLayout(loaded.project.id, layout);
    const current = get().loaded;
    if (current?.project.id === loaded.project.id) {
      let view = layout.architecture?.[step.key];
      const latest = current.layout.architecture?.[step.key];
      if (view && latest?.viewport !== loaded.layout.architecture?.[step.key]?.viewport)
        view = { ...view, viewport: latest?.viewport };
      layout = viewAt(current.layout, step.key, view);
      set({ loaded: { ...current, layout: pruneLayout(layout, current.design) } });
    }
    return true;
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
        const local = history(projectId);
        const source = direction === "undo" ? "undoSteps" : "redoSteps";
        const destination = direction === "undo" ? "redoSteps" : "undoSteps";
        const steps = [...local[source]];
        if (
          operationId !== undefined &&
          (loaded.history.latestEdit !== operationId ||
            (steps.length > 0 && steps.at(-1)?.kind !== "design"))
        )
          return false;
        while (steps.length) {
          const top = steps.at(-1) as Step;
          if (top.kind === "design") {
            if (loaded.history[direction === "undo" ? "canUndo" : "canRedo"]) break;
            steps.pop();
          } else {
            // Dead/no-op targets are retired without a request or a phantom undo step.
            const restored = await restoreLayout(loaded, top, direction);
            steps.pop();
            setHistory(projectId, {
              ...local,
              [source]: steps,
              [destination]: restored ? [...local[destination], top] : local[destination],
            });
            if (restored) return true;
          }
        }
        if (
          !loaded.history[direction === "undo" ? "canUndo" : "canRedo"] ||
          (direction === "redo" && !steps.length && local.redoBlocked)
        ) {
          setHistory(projectId, { ...history(projectId), [source]: steps });
          return false;
        }
        const result = await api[direction](projectId, loaded.design.revision);
        if (!settle(result)) return false;
        const step = steps.at(-1)?.kind === "design" ? steps.pop() : undefined;
        setHistory(projectId, {
          ...history(projectId),
          [source]: steps,
          [destination]: [...history(projectId)[destination], step ?? { kind: "design" }],
        });
        if (get().loaded?.project.id === projectId) set({ notice: undefined });
        return true;
      });
    } finally {
      set({ historyBusy: false });
    }
  };

  return {
    status: "idle",
    layoutDirty: false,
    undoSteps: [],
    redoSteps: [],
    redoBlocked: false,
    historyBusy: false,

    async open(projectId) {
      const previousProject = get().loaded?.project.id;
      if (previousProject) void formDrafts.flushProject(previousProject, true);
      const request = ++opening;
      await get().flushLayout();
      // A superseded open must not create a fresh-install example before the later fetch guard.
      if (request !== opening) return;
      set({
        status: "loading",
        error: undefined,
        notice: undefined,
        undoSteps: [],
        redoSteps: [],
      });
      try {
        const project = await resolveProject(projectId);
        const [received, layout] = await Promise.all([
          api.getDesign(project.id),
          api.getLayout(project.id),
        ]);
        if (request !== opening) return;
        const known = accepted.get(project.id);
        const state = known && known.design.revision > received.design.revision ? known : received;
        accepted.set(project.id, state);
        rememberProject(project.id);
        set({
          status: "ready",
          layoutDirty: false,
          ...history(project.id),
          loaded: {
            project,
            design: state.design,
            findings: state.findings,
            history: state.history,
            layout: pruneLayout(layout, state.design),
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
              ? { status: "saved", design: latest.design, written: result.state.design }
              : { status: "conflict", design: latest.design };
            if (result.ok) record(intent.projectId, { kind: "design" });
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
        const ok = settle(await api.edit(loaded.project.id, loaded.design.revision, ops));
        // The server drops its redo chain on a new edit; local layout redo goes with it.
        if (ok) record(loaded.project.id, { kind: "design" });
        return ok;
      });
    },

    async createPlaced(projectId, rebuild) {
      if (!(await get().flushEdits())) return false;
      return chain(async () => {
        const loaded = get().loaded;
        if (!loaded || loaded.project.id !== projectId) return false;
        const result = await api.edit(projectId, loaded.design.revision, rebuild(loaded.design));
        if (!settle(result) || !result.ok) return false;
        record(projectId, { kind: "design" });
        return true;
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
      if (!loaded || loaded.project.id !== state.projectId) {
        const previous = accepted.get(state.projectId);
        if (!previous || state.design.revision > previous.design.revision) {
          adopt(state);
          record(state.projectId, { kind: "design" });
        }
        return;
      }
      // An older state (a studio edit landed after the turn) must not replace a newer one.
      if (state.design.revision <= loaded.design.revision) return;
      adopt(state);
      record(state.projectId, { kind: "design" });
    },

    async undoEdit(operationId) {
      return historyStep("undo", operationId);
    },

    setArchitectureView(key, view, undoable = false, baselineCamera) {
      const source = get().loaded;
      if (!source) return Promise.resolve(false);
      if (!undoable) {
        const layout = pruneLayout(viewAt(source.layout, key, view), source.design);
        if (same(layout, source.layout)) return Promise.resolve(true);
        set({ loaded: { ...source, layout } });
        scheduleLayoutSave();
        return Promise.resolve(true);
      }
      // Flush synchronously into the shared chain before queuing this gesture. A failed form
      // cannot consume a history entry or make a later move overtake its successful retry.
      const flushed = get().flushEdits();
      return flushed.then((ok) => {
        if (!ok) return false;
        return chain(async () => {
          const current = get().loaded;
          const design = accepted.get(source.project.id)?.design ?? source.design;
          const layout =
            current?.project.id === source.project.id
              ? current.layout
              : await api.getLayout(source.project.id);
          const before = layout.architecture?.[key];
          const next = pruneLayout(viewAt(layout, key, view), design);
          if (same(layout, next)) return true;
          try {
            await api.putLayout(source.project.id, next);
          } catch (error) {
            if (get().loaded?.project.id === source.project.id)
              set({ notice: { tone: "error", message: `Layout not saved: ${message(error)}` } });
            return false;
          }
          const latest = get().loaded;
          if (latest?.project.id === source.project.id) {
            // Non-history camera writes may have happened while the server was acknowledging.
            const camera = latest.layout.architecture?.[key]?.viewport;
            const savedCamera = layout.architecture?.[key]?.viewport;
            const committed = next.architecture?.[key];
            const saved = viewAt(
              latest.layout,
              key,
              camera !== savedCamera && committed ? { ...committed, viewport: camera } : committed,
            );
            set({ loaded: { ...latest, layout: pruneLayout(saved, latest.design) } });
          }
          record(source.project.id, {
            kind: "architecture",
            key,
            before: baselineCamera ? { ...before, viewport: baselineCamera } : before,
            after: next.architecture?.[key],
          });
          return true;
        });
      });
    },
    async flushLayout() {
      clearTimeout(layoutTimer);
      await saveLayout();
    },

    setNotice(notice) {
      set({ notice });
    },
  };
});

formDrafts.configure((intent) => useDraw.getState().editIntent(intent));

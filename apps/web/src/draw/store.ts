/**
 * Draw view state. The server owns the design: every semantic change is posted as an operation
 * batch and the store adopts whatever design the server answers with. Layout is local-first and
 * saved with a debounced PUT, so dragging never touches the semantic revision.
 *
 * Undo and redo cover both: design steps go to the server's history (`POST /undo`, `/redo`), and
 * moves and resizes are undone locally (PLAN §6). One local stack orders them, so Ctrl+Z undoes
 * whichever happened last.
 */
import type { TemplateDescription } from "@jeeves/registry";
import type {
  DesignDocument,
  Finding,
  LayoutDocument,
  LayoutItem,
  OperationInput,
} from "@jeeves/spec";
import { create } from "zustand";
import {
  ApiError,
  api,
  type DesignState,
  type EditResult,
  type Project,
  type TemplateCatalog,
} from "./api.ts";
import type { CanvasEnd, ConnectAction } from "./connect.ts";
import { type FindingIndex, indexFindings } from "./findings.ts";
import { templateKey } from "./flow.ts";

export type Tool =
  | { kind: "planned"; capability: string }
  | { kind: "service" }
  | { kind: "select" }
  | { kind: "hand" }
  | { kind: "connect" }
  | { kind: "text" }
  | { kind: "note" }
  | { kind: "frame" }
  | { kind: "element"; template: { id: string; version: string } }
  | { kind: "attachment"; template: { id: string; version: string } };

export type Notice = { tone: "error" | "info"; message: string; actions?: ConnectAction[] };

export type Selection = { nodes: string[]; edges: string[] };

/** A request for the canvas to select these items and bring them into view. */
export type FocusRequest = Selection & { seq: number; zoom: boolean };

export type RailTab = "inspector" | "findings" | "chat";

/**
 * One undoable step. `design` marks a server-side edit made here; the server's history holds the
 * actual snapshots. `layout` holds the items a move or resize changed, before and after.
 */
type Step =
  | { kind: "design" }
  | {
      kind: "layout";
      before: Record<string, LayoutItem | undefined>;
      after: Record<string, LayoutItem>;
    };

export const LAYOUT_SAVE_DELAY_MS = 400;
const PROJECT_KEY = "jeeves.project";

type Loaded = {
  project: Project;
  design: DesignDocument;
  findings: Finding[];
  findingIndex: FindingIndex;
  history: DesignState["history"];
  layout: LayoutDocument;
  catalog: TemplateCatalog;
  templates: ReadonlyMap<string, TemplateDescription>;
};

type DrawState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  loaded?: Loaded;
  tool: Tool;
  /** First end picked with the connector tool, waiting for the second click. */
  pendingEnd?: CanvasEnd;
  notice?: Notice;
  /** Annotation whose text is being edited in place. */
  editing?: string;
  /** Layout changes not yet saved. */
  layoutDirty: boolean;
  /** Mirrors React Flow's selection, so the inspector can follow it. */
  selection: Selection;
  focusRequest?: FocusRequest;
  railTab: RailTab;
  /** Selection in the active C4 scope; undefined means use the editable board selection. */
  architectureSelection?: string[];
  undoSteps: Step[];
  redoSteps: Step[];

  open(projectId?: string): Promise<void>;
  edit(ops: OperationInput[]): Promise<boolean>;
  /** `undoable` records the change as a local undo step (moves and resizes). */
  setLayoutItems(items: Record<string, LayoutItem>, options?: { undoable?: boolean }): void;
  setViewport(viewport: NonNullable<LayoutDocument["viewport"]>): void;
  flushLayout(): Promise<void>;
  setTool(tool: Tool): void;
  setPendingEnd(end: CanvasEnd | undefined): void;
  setNotice(notice: Notice | undefined): void;
  setEditing(id: string | undefined): void;
  setSelection(selection: Selection): void;
  /** Selects the given items on the board and, with `zoom`, fits the camera to them. */
  focus(selection: Partial<Selection>, options?: { zoom?: boolean }): void;
  setRailTab(tab: RailTab): void;
  undo(): Promise<void>;
  redo(): Promise<void>;
  /**
   * Adopts a design changed elsewhere in this app (a chat turn) as one design undo step. Layout
   * items the server placed are added; local positions win for items already here. `changed`
   * items are selected and brought into view.
   */
  adoptChange(state: DesignState, layout: LayoutDocument, changed: readonly string[]): void;
  /** Undoes that server edit, if it's still the newest one. Returns whether it did. */
  undoEdit(operationId: number): Promise<boolean>;
};

/** Whether the undo / redo buttons have anything to do. */
export function canUndo(s: DrawState): boolean {
  return s.undoSteps.at(-1)?.kind === "layout" || !!s.loaded?.history.canUndo;
}

export function canRedo(s: DrawState): boolean {
  return s.redoSteps.at(-1)?.kind === "layout" || !!s.loaded?.history.canRedo;
}

let editChain: Promise<unknown> = Promise.resolve();
let layoutTimer: ReturnType<typeof setTimeout> | undefined;
let focusSeq = 0;

const CONFLICT_MESSAGE =
  "The design changed somewhere else, so the board was reloaded with the latest version. Try that again.";

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
  return newest ?? (await api.createProject("Untitled design"));
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
  const adopt = (state: DesignState) => {
    const loaded = get().loaded;
    if (!loaded || loaded.project.id !== state.projectId) return;
    set({
      loaded: {
        ...loaded,
        project: { ...loaded.project, revision: state.design.revision },
        design: state.design,
        findings: state.findings,
        findingIndex: indexFindings(state.design, state.findings),
        history: state.history,
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
      set({ notice: { tone: "info", message: CONFLICT_MESSAGE } });
      return false;
    }
    set({ notice: { tone: "error", message: result.errors[0]?.message ?? result.message } });
    return false;
  };

  /** Runs design requests one at a time, each against the revision the previous one produced. */
  const chain = (run: () => Promise<boolean>): Promise<boolean> => {
    const guarded = async () => {
      try {
        return await run();
      } catch (error) {
        set({ notice: { tone: "error", message: `Change not saved: ${message(error)}` } });
        return false;
      }
    };
    const next = editChain.then(guarded, guarded);
    editChain = next;
    return next;
  };

  const applyLayout = (items: Record<string, LayoutItem | undefined>) => {
    const loaded = get().loaded;
    if (!loaded) return;
    const next = { ...loaded.layout.items };
    for (const [id, item] of Object.entries(items)) {
      if (item) next[id] = item;
      else delete next[id];
    }
    set({ loaded: { ...loaded, layout: { ...loaded.layout, items: next } } });
    scheduleLayoutSave();
  };

  /** Server undo or redo; on success the opposite stack gets a design step. */
  const serverStep = (direction: "undo" | "redo") =>
    chain(async () => {
      const loaded = get().loaded;
      if (!loaded) return false;
      const result = await api[direction](loaded.project.id, loaded.design.revision);
      const ok = settle(result);
      if (ok) {
        const step: Step = { kind: "design" };
        if (direction === "undo") set({ redoSteps: [...get().redoSteps, step] });
        else set({ undoSteps: [...get().undoSteps, step] });
        set({ notice: undefined });
      }
      return ok;
    });

  const saveLayout = async () => {
    const loaded = get().loaded;
    if (!loaded || !get().layoutDirty) return;
    set({ layoutDirty: false });
    try {
      await api.putLayout(loaded.project.id, loaded.layout);
    } catch (error) {
      set({
        layoutDirty: true,
        notice: { tone: "error", message: `Layout not saved: ${message(error)}` },
      });
    }
  };

  const scheduleLayoutSave = () => {
    set({ layoutDirty: true });
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => void saveLayout(), LAYOUT_SAVE_DELAY_MS);
  };

  return {
    status: "idle",
    tool: { kind: "select" },
    layoutDirty: false,
    selection: { nodes: [], edges: [] },
    railTab: "inspector",
    undoSteps: [],
    redoSteps: [],

    async open(projectId) {
      await get().flushLayout();
      set({
        status: "loading",
        error: undefined,
        notice: undefined,
        pendingEnd: undefined,
        selection: { nodes: [], edges: [] },
        focusRequest: undefined,
        undoSteps: [],
        redoSteps: [],
      });
      try {
        const project = await resolveProject(projectId);
        const [state, layout, catalog] = await Promise.all([
          api.getDesign(project.id),
          api.getLayout(project.id),
          api.templates(),
        ]);
        rememberProject(project.id);
        set({
          status: "ready",
          layoutDirty: false,
          loaded: {
            project,
            design: state.design,
            findings: state.findings,
            findingIndex: indexFindings(state.design, state.findings),
            history: state.history,
            layout,
            catalog,
            templates: new Map(catalog.templates.map((t) => [templateKey(t), t])),
          },
        });
      } catch (error) {
        set({ status: "error", error: message(error) });
      }
    },

    edit(ops) {
      return chain(async () => {
        const loaded = get().loaded;
        if (!loaded) return false;
        const ok = settle(await api.edit(loaded.project.id, loaded.design.revision, ops));
        // The server drops its redo chain on a new edit; local layout redo goes with it.
        if (ok) set({ undoSteps: [...get().undoSteps, { kind: "design" }], redoSteps: [] });
        return ok;
      });
    },

    async undo() {
      const steps = [...get().undoSteps];
      // Design steps the server can no longer undo (e.g. undone in another tab) are stale.
      while (steps.at(-1)?.kind === "design" && !get().loaded?.history.canUndo) steps.pop();
      const top = steps.at(-1);
      if (top?.kind === "layout") {
        steps.pop();
        set({ undoSteps: steps, redoSteps: [...get().redoSteps, top] });
        applyLayout(top.before);
        return;
      }
      if (top) steps.pop();
      set({ undoSteps: steps });
      if (get().loaded?.history.canUndo) await serverStep("undo");
    },

    async redo() {
      const steps = [...get().redoSteps];
      while (steps.at(-1)?.kind === "design" && !get().loaded?.history.canRedo) steps.pop();
      const top = steps.at(-1);
      if (top?.kind === "layout") {
        steps.pop();
        set({ redoSteps: steps, undoSteps: [...get().undoSteps, top] });
        applyLayout(top.after);
        return;
      }
      if (top) steps.pop();
      set({ redoSteps: steps });
      if (get().loaded?.history.canRedo) await serverStep("redo");
    },

    adoptChange(state, layout, changed) {
      const loaded = get().loaded;
      if (!loaded || loaded.project.id !== state.projectId) return;
      // An older state (a canvas edit landed after the turn) must not replace a newer one.
      const newer = state.design.revision > loaded.design.revision;
      if (newer) adopt(state);
      const missing = Object.entries(layout.items).filter(([id]) => !loaded.layout.items[id]);
      if (missing.length > 0) {
        const current = get().loaded as Loaded;
        set({
          loaded: {
            ...current,
            layout: {
              ...current.layout,
              items: { ...current.layout.items, ...Object.fromEntries(missing) },
            },
          },
        });
      }
      if (newer) set({ undoSteps: [...get().undoSteps, { kind: "design" }], redoSteps: [] });
      const connections = new Set(state.design.connections.map((c) => c.id));
      if (changed.length > 0) {
        get().focus(
          {
            nodes: changed.filter((id) => !connections.has(id)),
            edges: changed.filter((id) => connections.has(id)),
          },
          { zoom: true },
        );
      }
    },

    async undoEdit(operationId) {
      if (get().loaded?.history.latestEdit !== operationId) return false;
      const steps = [...get().undoSteps];
      const marker = steps.findLastIndex((step) => step.kind === "design");
      if (marker >= 0) steps.splice(marker, 1);
      set({ undoSteps: steps });
      return serverStep("undo");
    },

    setLayoutItems(items, options) {
      const loaded = get().loaded;
      if (!loaded) return;
      if (options?.undoable) {
        const before = Object.fromEntries(
          Object.keys(items).map((id) => [id, loaded.layout.items[id]]),
        );
        set({
          undoSteps: [...get().undoSteps, { kind: "layout", before, after: items }],
          redoSteps: [],
        });
      }
      set({
        loaded: {
          ...loaded,
          layout: { ...loaded.layout, items: { ...loaded.layout.items, ...items } },
        },
      });
      scheduleLayoutSave();
    },

    setViewport(viewport) {
      const loaded = get().loaded;
      if (!loaded) return;
      set({ loaded: { ...loaded, layout: { ...loaded.layout, viewport } } });
      scheduleLayoutSave();
    },

    async flushLayout() {
      clearTimeout(layoutTimer);
      await saveLayout();
    },

    setTool(tool) {
      set({ tool, pendingEnd: undefined });
    },

    setPendingEnd(pendingEnd) {
      set({ pendingEnd });
    },

    setNotice(notice) {
      set({ notice });
    },

    setEditing(editing) {
      set({ editing });
    },

    setSelection(selection) {
      const current = get().selection;
      const same = (a: string[], b: string[]) =>
        a.length === b.length && a.every((id, i) => id === b[i]);
      if (same(current.nodes, selection.nodes) && same(current.edges, selection.edges)) return;
      set({ selection });
    },

    focus(selection, options) {
      const next = { nodes: selection.nodes ?? [], edges: selection.edges ?? [] };
      set({
        selection: next,
        focusRequest: { ...next, seq: ++focusSeq, zoom: options?.zoom ?? false },
      });
    },

    setRailTab(railTab) {
      set({ railTab });
    },
  };
});

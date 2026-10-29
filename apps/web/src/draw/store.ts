/**
 * Draw view state. The server owns the design: every semantic change is posted as an operation
 * batch and the store adopts whatever design the server answers with. Layout is local-first and
 * saved with a debounced PUT, so dragging never touches the semantic revision.
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
import { ApiError, api, type DesignState, type Project, type TemplateCatalog } from "./api.ts";
import type { CanvasEnd, ConnectAction } from "./connect.ts";
import { templateKey } from "./flow.ts";

export type Tool =
  | { kind: "select" }
  | { kind: "hand" }
  | { kind: "connect" }
  | { kind: "text" }
  | { kind: "note" }
  | { kind: "frame" }
  | { kind: "element"; template: { id: string; version: string } }
  | { kind: "attachment"; template: { id: string; version: string } };

export type Notice = { tone: "error" | "info"; message: string; actions?: ConnectAction[] };

export const LAYOUT_SAVE_DELAY_MS = 400;
const PROJECT_KEY = "jeeves.project";

type Loaded = {
  project: Project;
  design: DesignDocument;
  findings: Finding[];
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

  open(projectId?: string): Promise<void>;
  edit(ops: OperationInput[]): Promise<boolean>;
  setLayoutItems(items: Record<string, LayoutItem>): void;
  setViewport(viewport: NonNullable<LayoutDocument["viewport"]>): void;
  flushLayout(): Promise<void>;
  setTool(tool: Tool): void;
  setPendingEnd(end: CanvasEnd | undefined): void;
  setNotice(notice: Notice | undefined): void;
  setEditing(id: string | undefined): void;
};

let editChain: Promise<unknown> = Promise.resolve();
let layoutTimer: ReturnType<typeof setTimeout> | undefined;

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
        history: state.history,
      },
    });
  };

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

    async open(projectId) {
      await get().flushLayout();
      set({ status: "loading", error: undefined, notice: undefined, pendingEnd: undefined });
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
      const run = async () => {
        const loaded = get().loaded;
        if (!loaded) return false;
        try {
          const result = await api.edit(loaded.project.id, loaded.design.revision, ops);
          if (result.ok) {
            adopt(result.state);
            return true;
          }
          if (result.reason === "conflict") {
            adopt(result.state);
            set({
              notice: {
                tone: "info",
                message:
                  "The design changed somewhere else, so the board was reloaded. Try that again.",
              },
            });
            return false;
          }
          set({ notice: { tone: "error", message: result.errors[0]?.message ?? result.message } });
          return false;
        } catch (error) {
          set({ notice: { tone: "error", message: `Change not saved: ${message(error)}` } });
          return false;
        }
      };
      const next = editChain.then(run, run);
      editChain = next;
      return next;
    },

    setLayoutItems(items) {
      const loaded = get().loaded;
      if (!loaded) return;
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
  };
});

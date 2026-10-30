/**
 * Runs view state: the project's runs, the selected run's plan, and the actions on it. While a
 * run is planning or running, the view polls `refresh` so progress shows without a reload.
 */
import { create } from "zustand";
import {
  ApiError,
  api,
  type ExecutionMode,
  type RunAction,
  type RunDetail,
  type RunsOverview,
  type TaskPatch,
} from "../draw/api.ts";

type RunsState = {
  projectId?: string;
  overview?: RunsOverview;
  selectedId?: number;
  detail?: RunDetail;
  /** An action or edit in flight; buttons are disabled meanwhile. */
  busy: boolean;
  error?: string;
  load: (projectId: string) => Promise<void>;
  select: (runId: number) => Promise<void>;
  refresh: () => Promise<void>;
  plan: () => Promise<void>;
  act: (action: RunAction) => Promise<void>;
  mode: (mode: ExecutionMode) => Promise<void>;
  note: (note: string) => Promise<boolean>;
  editTask: (taskId: number, patch: TaskPatch) => Promise<boolean>;
  removeTask: (taskId: number) => Promise<void>;
  moveTask: (taskId: number, delta: -1 | 1) => Promise<void>;
  clearError: () => void;
};

const message = (error: unknown) =>
  error instanceof ApiError || error instanceof Error ? error.message : String(error);

/** Whether the run may change without the person doing anything. */
export function isLive(detail: RunDetail | undefined): boolean {
  if (!detail) return false;
  return (
    detail.run.status === "planning" ||
    detail.run.status === "running" ||
    detail.tasks.some((t) => t.status === "running")
  );
}

/** The pending tasks' IDs after moving one of them up or down; `undefined` if it can't move. */
export function movedOrder(detail: RunDetail, taskId: number, delta: -1 | 1): number[] | undefined {
  const pending = detail.tasks.filter((t) => t.status === "pending").map((t) => t.id);
  const from = pending.indexOf(taskId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= pending.length) return undefined;
  const order = [...pending];
  [order[from], order[to]] = [order[to] as number, order[from] as number];
  return order;
}

export const useRuns = create<RunsState>((set, get) => {
  /** Runs `fn` as the one action in flight, then refreshes; errors are shown, not thrown. */
  const perform = async (fn: (projectId: string, runId: number) => Promise<unknown>) => {
    const { projectId, selectedId } = get();
    if (!projectId || selectedId === undefined) return false;
    set({ busy: true, error: undefined });
    try {
      await fn(projectId, selectedId);
      return true;
    } catch (error) {
      set({ error: message(error) });
      return false;
    } finally {
      await get().refresh();
      set({ busy: false });
    }
  };

  return {
    busy: false,

    load: async (projectId) => {
      set({
        projectId,
        overview: undefined,
        selectedId: undefined,
        detail: undefined,
        error: undefined,
      });
      try {
        const overview = await api.runs(projectId);
        if (get().projectId !== projectId) return;
        set({ overview });
        const latest = overview.runs[0];
        if (latest) await get().select(latest.id);
      } catch (error) {
        set({ error: message(error) });
      }
    },

    select: async (runId) => {
      const { projectId } = get();
      if (!projectId) return;
      set({ selectedId: runId, detail: undefined });
      try {
        const detail = await api.run(projectId, runId);
        if (get().selectedId === runId) set({ detail });
      } catch (error) {
        set({ error: message(error) });
      }
    },

    refresh: async () => {
      const { projectId, selectedId } = get();
      if (!projectId) return;
      try {
        const [overview, detail] = await Promise.all([
          api.runs(projectId),
          selectedId === undefined ? undefined : api.run(projectId, selectedId),
        ]);
        if (get().projectId !== projectId) return;
        set({ overview, ...(detail && get().selectedId === selectedId && { detail }) });
      } catch (error) {
        set({ error: message(error) });
      }
    },

    plan: async () => {
      const { projectId } = get();
      if (!projectId) return;
      set({ busy: true, error: undefined });
      try {
        const run = await api.planRun(projectId);
        set({ selectedId: run.id });
        await get().refresh();
      } catch (error) {
        set({ error: message(error) });
      } finally {
        set({ busy: false });
      }
    },

    mode: async (mode) => {
      await perform((id, run) => api.runMode(id, run, mode));
    },
    note: (note) => perform((id, run) => api.runNote(id, run, note)),

    act: async (action) => {
      await perform((projectId, runId) => api.runAction(projectId, runId, action));
    },

    editTask: (taskId, patch) =>
      perform((projectId, runId) => api.editTask(projectId, runId, taskId, patch)),

    removeTask: async (taskId) => {
      await perform((projectId, runId) => api.removeTask(projectId, runId, taskId));
    },

    moveTask: async (taskId, delta) => {
      const { detail } = get();
      const order = detail && movedOrder(detail, taskId, delta);
      if (!order) return;
      await perform((projectId, runId) => api.reorderTasks(projectId, runId, order));
    },

    clearError: () => set({ error: undefined }),
  };
});

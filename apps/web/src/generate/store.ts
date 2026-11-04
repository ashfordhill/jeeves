/**
 * Generate drawer state: the output folder, the baseline toggle, and the latest generation,
 * kept up to date from the server's event stream while one runs.
 */
import { handoffFingerprint } from "@jeeves/spec";
import { create } from "zustand";
import {
  type AcceptancePack,
  ApiError,
  api,
  type Generation,
  type GenerationEvent,
} from "../draw/api.ts";
import { useDraw } from "../draw/store.ts";

/** Lines kept in the browser; the server keeps the same number. */
const LOG_CAP = 3000;

type GenerateState = {
  projectId?: string;
  open: boolean;
  outputDir: string;
  defaultOutputDir: string;
  baseline: boolean;
  acceptancePack: string;
  packs: AcceptancePack[];
  generation: Generation | null;
  starting: boolean;
  error?: string;
  load: (projectId: string) => Promise<void>;
  setOpen: (open: boolean) => void;
  setOutputDir: (dir: string) => void;
  setBaseline: (baseline: boolean) => void;
  setAcceptancePack: (pack: string) => void;
  start: (expectedRevision?: number, expectedFingerprint?: string) => Promise<void>;
  cancel: () => Promise<void>;
};

let following: AbortController | undefined;

export const useGenerate = create<GenerateState>((set, get) => {
  /** Streams a generation's events into the store until it finishes or the project changes. */
  const follow = async (projectId: string, generationId: number) => {
    following?.abort();
    const controller = new AbortController();
    following = controller;
    try {
      await api.followGeneration(
        projectId,
        generationId,
        (event) => {
          if (get().projectId !== projectId) return;
          set((s) => ({ generation: applyEvent(s.generation, event) }));
        },
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (get().projectId === projectId)
        set({ error: `Lost the generation's progress: ${(error as Error).message}` });
    } finally {
      if (following === controller) following = undefined;
    }
  };

  return {
    open: false,
    outputDir: "",
    defaultOutputDir: "",
    baseline: true,
    acceptancePack: "",
    packs: [],
    generation: null,
    starting: false,

    load: async (projectId) => {
      following?.abort();
      set({
        projectId,
        generation: null,
        starting: false,
        outputDir: "",
        defaultOutputDir: "",
        error: undefined,
        packs: [],
        acceptancePack: "",
      });
      try {
        const [overview, packs] = await Promise.all([
          api.generation(projectId),
          api.acceptancePacks().catch(() => []),
        ]);
        if (get().projectId !== projectId) return;
        set({
          outputDir: overview.outputDir ?? overview.defaultOutputDir,
          defaultOutputDir: overview.defaultOutputDir,
          generation: overview.latest,
          packs,
        });
        if (overview.latest?.status === "running") void follow(projectId, overview.latest.id);
      } catch (error) {
        if (get().projectId === projectId) set({ error: (error as Error).message });
      }
    },

    setOpen: (open) => set({ open }),
    setOutputDir: (outputDir) => set({ outputDir }),
    setBaseline: (baseline) => set({ baseline }),
    setAcceptancePack: (acceptancePack) => set({ acceptancePack }),

    start: async (expectedRevision, expectedFingerprint) => {
      const { projectId, outputDir, baseline, acceptancePack } = get();
      if (!projectId) return;
      set({ starting: true, error: undefined });
      try {
        if (!(await useDraw.getState().flushEdits()))
          throw new Error("Resolve the unsaved change before generating.");
        await useDraw.getState().flushLayout();
        if (get().projectId !== projectId || useDraw.getState().loaded?.project.id !== projectId)
          return;
        if (
          expectedRevision !== undefined &&
          useDraw.getState().loaded?.design.revision !== expectedRevision
        )
          throw new Error("The design changed. Refresh the review before generating.");
        const current = useDraw.getState().loaded;
        if (
          expectedFingerprint &&
          current &&
          (await handoffFingerprint(current.design, current.project)) !== expectedFingerprint
        )
          throw new Error("The design changed. Refresh the review before generating.");
        const generation = await api.startGeneration(projectId, {
          outputDir: outputDir.trim(),
          baseline,
          ...(acceptancePack ? { acceptancePack } : {}),
        });
        if (get().projectId !== projectId) return;
        set({ generation, starting: false, outputDir: generation.outputDir });
        void follow(projectId, generation.id);
      } catch (error) {
        if (get().projectId !== projectId) return;
        set({
          starting: false,
          error: error instanceof ApiError ? error.message : `Couldn't start: ${String(error)}`,
        });
      }
    },

    cancel: async () => {
      const { projectId, generation } = get();
      if (!projectId || generation?.status !== "running") return;
      try {
        await api.cancelGeneration(projectId, generation.id);
      } catch (error) {
        if (get().projectId === projectId) set({ error: (error as Error).message });
      }
    },
  };
});

/** Folds one streamed event into the generation the drawer shows. */
export function applyEvent(
  generation: Generation | null,
  event: GenerationEvent,
): Generation | null {
  if (event.type === "snapshot" || event.type === "done") return event.generation;
  if (!generation) return generation;
  switch (event.type) {
    case "step":
      return {
        ...generation,
        steps: generation.steps.map((s) => (s.id === event.step.id ? event.step : s)),
      };
    case "log": {
      const log = [...generation.log, event.line];
      return { ...generation, log: log.length > LOG_CAP ? log.slice(-LOG_CAP) : log };
    }
    case "check":
      return { ...generation, checks: [...generation.checks, event.check] };
  }
}

import { useEffect, useMemo, useState } from "react";
import type { StudioLayout, StudioLayoutInput, StudioLayoutNode } from "./layout.ts";
import { layoutStudioInWorker } from "./layout-client.ts";
import { type StudioPath, studioPathLabels } from "./routing.ts";

/**
 * Automatic layout of one scope. The last valid layout stays mounted while newer work runs,
 * fails or is cancelled; nothing here is ever saved.
 */
export function useStudioLayout(
  scope: string,
  nodes: StudioLayoutNode[],
  paths: StudioPath[],
  order: string[],
) {
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) setFontReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  const input = useMemo((): StudioLayoutInput | undefined => {
    if (!fontReady) return undefined;
    const context = document.createElement("canvas").getContext("2d");
    if (context) context.font = '12px "Nunito Variable", Nunito, system-ui, sans-serif';
    const measure = (text: string) =>
      context?.measureText(text).width ?? Array.from(text).length * 8;
    return {
      scope,
      version: 2,
      nodes,
      paths,
      labels: Object.fromEntries(
        Object.entries(studioPathLabels(paths)).map(([id, label]) => [
          id,
          { ...label, shortWidth: measure(label.short), detailWidth: measure(label.detail) },
        ]),
      ),
      order,
    };
  }, [scope, nodes, paths, order, fontReady]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ input: StudioLayoutInput; layout: StudioLayout }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    setError(undefined);
    if (!input || attempt < 0) return;
    const abort = new AbortController();
    void layoutStudioInWorker(input, abort.signal).then(
      (layout) => {
        if (!abort.signal.aborted) setResult({ input, layout });
      },
      () => {
        if (!abort.signal.aborted) setError("Diagram layout failed. The last layout is kept.");
      },
    );
    return () => {
      abort.abort();
    };
  }, [input, attempt]);
  return {
    layout: result?.layout,
    /** The shown layout belongs to the current input (not a retained older one). */
    current: !!input && result?.input === input,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}

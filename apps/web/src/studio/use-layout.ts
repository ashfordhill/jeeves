import { useEffect, useMemo, useState } from "react";
import type { StudioLayout, StudioLayoutInput, StudioLayoutNode } from "./layout.ts";
import { layoutStudioInWorker } from "./layout-client.ts";
import { type StudioPath, studioPathLabels } from "./routing.ts";

/** One-line labels wider than this (px at the studio font) stack onto two lines. */
const STUDIO_STACK_WIDTH = 96;

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
    const font = '12px "Nunito Variable", Nunito, system-ui, sans-serif';
    // Merged-line count labels are drawn bold (studio.css), so ELK reserves their bold width.
    const measure = (text: string, bold = false) => {
      if (!context) return Array.from(text).length * 8;
      context.font = bold ? `700 ${font}` : font;
      return context.measureText(text).width;
    };
    // A long one-line label stacks: its verb phrase above the line and its protocol below, so
    // ELK reserves about half the width between columns.
    const stack = (text: string, bold: boolean) => {
      const width = measure(text, bold);
      const cut = text.lastIndexOf(" · ");
      if (width <= STUDIO_STACK_WIDTH || cut < 0) return { text, width };
      const lines = [text.slice(0, cut), text.slice(cut + 3)];
      return {
        text: lines.join("\n"),
        width: Math.max(...lines.map((line) => measure(line, bold))),
      };
    };
    return {
      scope,
      version: 2,
      nodes,
      paths,
      labels: Object.fromEntries(
        Object.entries(studioPathLabels(paths)).map(([id, { merged, ...label }]) => {
          const short = stack(label.short, merged),
            detail = stack(label.detail, merged);
          return [
            id,
            {
              short: short.text,
              detail: detail.text,
              shortWidth: short.width,
              detailWidth: detail.width,
            },
          ];
        }),
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

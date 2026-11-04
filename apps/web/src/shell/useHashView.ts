import { useCallback, useEffect, useState } from "react";
import { useDraw } from "../draw/store.ts";
import { captureStudioDiagram } from "../studio/diagram-export.ts";
import { isNextStudio } from "../studio/route.ts";
import { type ViewId, viewFromHash } from "./views.ts";

export function useHashView(): [ViewId, (next: ViewId) => void] {
  const [view, setView] = useState<ViewId>(() => viewFromHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setView(viewFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const select = useCallback((next: ViewId) => {
    void useDraw
      .getState()
      .flushEdits()
      .then(async (saved) => {
        if (saved && next === "runs" && isNextStudio()) await captureStudioDiagram();
        window.location.hash = `/${next}`;
        setView(next);
      });
  }, []);

  return [view, select];
}

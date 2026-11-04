import { useCallback, useEffect, useState } from "react";
import { useDraw } from "../draw/store.ts";
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
      .then(() => {
        window.location.hash = `/${next}`;
        setView(next);
      });
  }, []);

  return [view, select];
}

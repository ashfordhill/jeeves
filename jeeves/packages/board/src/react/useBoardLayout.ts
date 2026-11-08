// Ported from automation-illustrator src/board/layout/useLaneLayout.ts (0803c4a).
// Asks the layout engine for the board's ELK layout. A cache hit renders synchronously, so
// nothing flashes. Otherwise the previous layout stays on screen with phase "updating", or
// "initial" when nothing has been laid out yet.
//
// Changes from automation-illustrator: no store and no lanes or orientation. The stability
// hints are the previously shown positions plus the caller's `hints` for tiles that have no
// shown position yet (a shown position wins); a tile with neither is docked by `buildElkGraph`.
import { useEffect, useRef, useState } from "react";
import type { LayoutInput, PositionMap } from "../layout/elkGraph.ts";
import type { BoardLayout, LayoutPhase } from "../layout/elkLayout.ts";
import { type LayoutEngine, LayoutSuperseded } from "../layout/engine.ts";

export type BoardLayoutState = {
  /** The layout to show: the current one, or the previous one while ELK runs. */
  layout: BoardLayout | null;
  phase: LayoutPhase;
  /** ELK rejected the latest request; the previous layout (if any) is still shown. */
  error: boolean;
};

export function useBoardLayout(
  engine: LayoutEngine,
  input: LayoutInput,
  hints?: PositionMap,
): BoardLayoutState {
  const key = engine.keyFor(input);
  const cached = engine.get(key);
  const [state, setState] = useState<{ layout: BoardLayout | null; error: boolean }>({
    layout: cached ?? null,
    error: false,
  });
  const inputs = useRef({ input, hints });
  inputs.current = { input, hints };

  const layout = cached ?? state.layout;
  const shownRef = useRef(layout);
  shownRef.current = layout;
  const phase: LayoutPhase = !layout ? "initial" : layout.key === key ? "ready" : "updating";

  useEffect(() => {
    const hit = engine.get(key);
    if (hit) {
      setState((s) => (s.layout === hit && !s.error ? s : { layout: hit, error: false }));
      return;
    }
    let live = true;
    const { input: next, hints: extra } = inputs.current;
    const shown = shownRef.current;
    const previous = shown ? { ...extra, ...shown.positions } : undefined;
    engine.request(next, previous).then(
      (laidOut) => {
        if (live) setState({ layout: laidOut, error: false });
      },
      (error: unknown) => {
        if (!live || error instanceof LayoutSuperseded) return;
        setState((s) => ({ layout: s.layout, error: true }));
      },
    );
    return () => {
      live = false;
    };
  }, [engine, key]);

  return { layout, phase, error: state.error && phase !== "ready" };
}

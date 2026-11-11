// Ported from automation-illustrator src/board/layout/useLaneLayout.ts (0803c4a).
// Asks the layout engine for the board's ELK layout. A cache hit renders synchronously, so
// nothing flashes. Otherwise the previous layout stays on screen with phase "updating", or
// "initial" when nothing has been laid out yet.
//
// Changes from automation-illustrator: no store and no lanes or orientation. The stability
// hints are the previously shown positions plus the caller's `hints` for tiles that have no
// shown position yet (a shown position wins); a tile with neither is docked by `buildElkGraph`.
//
// Views: a board can show several views of one graph (`view`, such as a simple and a detailed
// one). Each view keeps its own previously shown positions, so a layout is never hinted by
// another view's positions: switching away and back finds a view as it was, and an edit made in
// one view lays the other out from its own last positions. With one view (the default) this is
// exactly the single shown layout.
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
  /**
   * The view `layout` was laid out for: the current `view`, or the previous one while a switch
   * is being laid out.
   */
  view: string;
};

export function useBoardLayout(
  engine: LayoutEngine,
  input: LayoutInput,
  hints?: PositionMap,
  view = "",
): BoardLayoutState {
  const key = engine.keyFor(input);
  const cached = engine.get(key);
  const [state, setState] = useState<{
    layout: BoardLayout | null;
    error: boolean;
    view: string;
  }>({ layout: cached ?? null, error: false, view });
  const inputs = useRef({ input, hints, view });
  inputs.current = { input, hints, view };

  const layout = cached ?? state.layout;
  const layoutView = cached ? view : state.view;
  // Each view's last shown layout, whose positions hint its next one.
  const shownRef = useRef(new Map<string, BoardLayout>());
  if (layout) shownRef.current.set(layoutView, layout);
  const phase: LayoutPhase = !layout ? "initial" : layout.key === key ? "ready" : "updating";

  useEffect(() => {
    const hit = engine.get(key);
    const own = inputs.current.view;
    if (hit) {
      setState((s) =>
        s.layout === hit && !s.error && s.view === own
          ? s
          : { layout: hit, error: false, view: own },
      );
      return;
    }
    let live = true;
    const { input: next, hints: extra } = inputs.current;
    const shown = shownRef.current.get(own);
    const previous = shown ? { ...extra, ...shown.positions } : undefined;
    engine.request(next, previous).then(
      (laidOut) => {
        // Still this key, so it is the current view's layout even if the view changed meanwhile.
        if (live) setState({ layout: laidOut, error: false, view: inputs.current.view });
      },
      (error: unknown) => {
        if (!live || error instanceof LayoutSuperseded) return;
        setState((s) => ({ ...s, error: true }));
      },
    );
    return () => {
      live = false;
    };
  }, [engine, key]);

  return { layout, phase, error: state.error && phase !== "ready", view: layoutView };
}

// Ported from automation-illustrator src/board/layout/useAnimatedLayout.ts (0803c4a).
// Animates modest layout changes: tile positions, line routes and chip rects move together for
// ANIMATE_MS, so line ends stay glued to their tiles. Large jumps, the first layout and reduced
// motion snap. Ids new to the target appear in place; removed ids drop.
//
// A switch to another view of the board (`view`, the view the target was laid out for) animates
// however far tiles move, so the reader can follow each tile into the new view. A line that only
// the new view draws has no route to move from: until the move ends it has no route in the frame,
// so the board draws its fallback between its moving ends.
import { useEffect, useRef, useState } from "react";
import { ANIMATE_MS, layoutDelta, lerpLayouts, MODEST_MAX_PX, SNAP_PX } from "../layout/animate.ts";
import type { BoardLayout } from "../layout/elkLayout.ts";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `frame` without the routes `from` doesn't have. */
function withoutNewRoutes(frame: BoardLayout, from: BoardLayout): BoardLayout {
  const routes: BoardLayout["routes"] = {};
  for (const [id, route] of Object.entries(frame.routes)) if (from.routes[id]) routes[id] = route;
  return { ...frame, routes };
}

export function useAnimatedLayout(target: BoardLayout | null, view = ""): BoardLayout | null {
  const [current, setCurrent] = useState<BoardLayout | null>(target);
  const shownRef = useRef<BoardLayout | null>(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  /* The view of the layout shown last. */
  const shownView = useRef(view);
  const key = target?.key ?? "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new layout key or view starts a move; the target is read through its ref
  useEffect(() => {
    const next = targetRef.current;
    const from = shownRef.current;
    const switched = shownView.current !== view;
    shownView.current = view;
    const snap = () => {
      shownRef.current = next;
      setCurrent(next);
    };
    if (!next || !from || prefersReducedMotion()) {
      snap();
      return;
    }
    const delta = layoutDelta(from, next);
    if (delta < SNAP_PX || (delta > MODEST_MAX_PX && !switched)) {
      snap();
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATE_MS);
      const eased = 1 - (1 - t) ** 2;
      const moved = lerpLayouts(from, next, eased);
      const frame = switched && t < 1 ? withoutNewRoutes(moved, from) : moved;
      shownRef.current = frame;
      setCurrent(frame);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, view]);

  // The very first layout is shown in the same render it arrives.
  return current ?? target;
}

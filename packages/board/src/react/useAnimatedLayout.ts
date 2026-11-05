// Ported from automation-illustrator src/board/layout/useAnimatedLayout.ts (0803c4a).
// Animates modest layout changes: tile positions, line routes and chip rects move together for
// ANIMATE_MS, so line ends stay glued to their tiles. Large jumps, the first layout and reduced
// motion snap. Ids new to the target appear in place; removed ids drop.
import { useEffect, useRef, useState } from "react";
import { ANIMATE_MS, layoutDelta, lerpLayouts, MODEST_MAX_PX, SNAP_PX } from "../layout/animate.ts";
import type { BoardLayout } from "../layout/elkLayout.ts";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useAnimatedLayout(target: BoardLayout | null): BoardLayout | null {
  const [current, setCurrent] = useState<BoardLayout | null>(target);
  const shownRef = useRef<BoardLayout | null>(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const key = target?.key ?? "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new layout key starts a move; the target is read through its ref
  useEffect(() => {
    const next = targetRef.current;
    const from = shownRef.current;
    const snap = () => {
      shownRef.current = next;
      setCurrent(next);
    };
    if (!next || !from || prefersReducedMotion()) {
      snap();
      return;
    }
    const delta = layoutDelta(from, next);
    if (delta < SNAP_PX || delta > MODEST_MAX_PX) {
      snap();
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATE_MS);
      const eased = 1 - (1 - t) ** 2;
      const frame = lerpLayouts(from, next, eased);
      shownRef.current = frame;
      setCurrent(frame);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key]);

  // The very first layout is shown in the same render it arrives.
  return current ?? target;
}

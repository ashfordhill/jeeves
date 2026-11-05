// Ported from automation-illustrator src/board/layout/useAnimatedLayout.ts (0803c4a).
// The pure half of layout motion: tile positions, line routes and chip rects move together, so
// line ends stay glued to their tiles. The React hook that drives it lives in `react/`.
// Ids new to the target appear in place; removed ids drop.
import type { BoardLayout } from "./elkLayout.ts";
import type { Point, Rect } from "./metrics.ts";
import { lerpPolylines } from "./polyline.ts";

/** A change smaller than this snaps. */
export const SNAP_PX = 1;
/** A change larger than this (a different design, say) snaps instead of animating. */
export const MODEST_MAX_PX = 280;
export const ANIMATE_MS = 200;

/** The furthest any tile present in both layouts moves. */
export function layoutDelta(from: BoardLayout, to: BoardLayout): number {
  let max = 0;
  for (const [id, b] of Object.entries(to.positions)) {
    const a = from.positions[id];
    if (a) max = Math.max(max, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return max;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { ...lerpPoint(a, b, t), w: b.w, h: b.h };
}

/** A frame between two layouts; it carries the target's key and bounds. */
export function lerpLayouts(from: BoardLayout, to: BoardLayout, t: number): BoardLayout {
  if (t >= 1) return to;
  const positions: BoardLayout["positions"] = {};
  for (const [id, b] of Object.entries(to.positions)) {
    const a = from.positions[id];
    positions[id] = a ? lerpPoint(a, b, t) : b;
  }
  const routes: BoardLayout["routes"] = {};
  for (const [id, b] of Object.entries(to.routes)) {
    const a = from.routes[id];
    routes[id] = a && a.length >= 2 && b.length >= 2 ? lerpPolylines(a, b, t) : b;
  }
  const chips: BoardLayout["chips"] = {};
  for (const [id, b] of Object.entries(to.chips)) {
    const a = from.chips[id];
    chips[id] = a ? lerpRect(a, b, t) : b;
  }
  return { key: to.key, positions, routes, chips, bounds: to.bounds };
}

// Ported from automation-illustrator src/board/controls/plusPreviewLayout.ts (0803c4a).
// Screen-space placement of the fan a pulled tab opens: N items on a short arc around the tab's
// resting place, fanning right from an "after" tab and left from a "before" tab.
//
// Changes from automation-illustrator: N items instead of the fixed Step and Data pair, and
// horizontal only. Two items keep automation-illustrator's arc (radius 104, 56°); every item
// beyond two adds 24px of radius and the spread widens with the count, up to 150°. `placeFan`
// keeps the items on the board (automation-illustrator's previews never reach a rail).
import type { Point } from "../layout/metrics.ts";

export const FAN_RADIUS = 104;
/** Extra radius for every item beyond two, so neighbours keep their distance. */
export const FAN_RADIUS_STEP = 24;
/** The spread between two neighbours' angles (automation-illustrator's two-item spread). */
export const FAN_ITEM_SPREAD = 56;
export const FAN_MAX_SPREAD = 150;
/** A fan item's box (board.css `.board-fan-item`). */
export const FAN_ITEM_SIZE = 60;
/** Room a fan item keeps from the board's edges. */
export const FAN_EDGE_MARGIN = 16;
/** Room between a nudged item and the tile it was moved off, or another item. */
const FAN_GAP = 6;

/** A screen rectangle. */
export type ScreenBox = { x: number; y: number; w: number; h: number };

/** Centres of `count` items, first at the top, around the rest point (restX, restY). */
export function fanCenters(restX: number, restY: number, count: number, before = false): Point[] {
  const dir = before ? -1 : 1;
  const radius = FAN_RADIUS + FAN_RADIUS_STEP * Math.max(0, count - 2);
  const spread = Math.min(FAN_MAX_SPREAD, FAN_ITEM_SPREAD * Math.max(0, count - 1));
  const out: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = count === 1 ? 0 : -spread / 2 + (i * spread) / (count - 1);
    const rad = (angle * Math.PI) / 180;
    out.push({ x: restX + dir * Math.cos(rad) * radius, y: restY + Math.sin(rad) * radius });
  }
  return out;
}

/**
 * Keeps the fan inside the board: every item is clamped into `board` with a 16px margin, so it
 * never covers a rail or the header, and items the clamp moved are pushed apart where they would
 * stack. An item on top of a tile that accepts a drop (`avoid`, its centre on it) is nudged just
 * off it, so both the item and the tile stay in reach.
 */
export function placeFan(
  centers: readonly Point[],
  board: ScreenBox | undefined,
  avoid: readonly ScreenBox[] = [],
  size = FAN_ITEM_SIZE,
): Point[] {
  if (!board) return [...centers];
  const half = size / 2;
  const range = (start: number, length: number) => {
    const lo = start + FAN_EDGE_MARGIN + half;
    const hi = start + length - FAN_EDGE_MARGIN - half;
    return lo <= hi ? [lo, hi] : [(lo + hi) / 2, (lo + hi) / 2];
  };
  const [minX, maxX] = range(board.x, board.w) as [number, number];
  const [minY, maxY] = range(board.y, board.h) as [number, number];
  const clamp = (p: Point): Point => ({
    x: Math.min(maxX, Math.max(minX, p.x)),
    y: Math.min(maxY, Math.max(minY, p.y)),
  });
  const out = centers.map(clamp);
  const moved = out.map((p, i) => {
    const from = centers[i] as Point;
    return Math.abs(p.x - from.x) > 0.5 || Math.abs(p.y - from.y) > 0.5;
  });

  // Clamped items share an edge: push overlapping ones apart, moving only clamped items.
  const apart = size + FAN_GAP;
  for (let round = 0; moved.some(Boolean) && round < 12; round += 1) {
    let overlaps = false;
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        if (!moved[i] && !moved[j]) continue;
        const a = out[i] as Point;
        const b = out[j] as Point;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = apart - Math.abs(dx);
        const oy = apart - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        overlaps = true;
        const share = moved[i] && moved[j] ? 0.5 : 1;
        const along = (d: number) => (d === 0 ? 1 : Math.sign(d));
        const push =
          oy <= ox ? { x: 0, y: along(dy) * oy * share } : { x: along(dx) * ox * share, y: 0 };
        if (moved[i]) out[i] = clamp({ x: a.x - push.x, y: a.y - push.y });
        if (moved[j]) out[j] = clamp({ x: b.x + push.x, y: b.y + push.y });
      }
    }
    if (!overlaps) break;
  }

  // An item on top of a drop target moves just off it, inside the board: preferably clear of
  // every target and every other item, at least with its centre off every target.
  const covers = (p: Point, box: ScreenBox) =>
    p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;
  const touches = (p: Point, box: ScreenBox) =>
    p.x + half > box.x &&
    p.x - half < box.x + box.w &&
    p.y + half > box.y &&
    p.y - half < box.y + box.h;
  const onItem = (p: Point, skip: number) =>
    out.some((q, k) => k !== skip && Math.abs(q.x - p.x) < apart && Math.abs(q.y - p.y) < apart);
  out.forEach((p, i) => {
    const box = avoid.find((target) => covers(p, target));
    if (!box) return;
    const cost = (c: Point) =>
      Number(avoid.some((target) => touches(c, target))) * 2 + Number(onItem(c, i));
    const candidates = [
      { x: box.x - FAN_GAP - half, y: p.y },
      { x: box.x + box.w + FAN_GAP + half, y: p.y },
      { x: p.x, y: box.y - FAN_GAP - half },
      { x: p.x, y: box.y + box.h + FAN_GAP + half },
    ]
      .map(clamp)
      .filter((c) => !avoid.some((target) => covers(c, target)))
      .sort(
        (c, d) =>
          cost(c) - cost(d) || Math.hypot(c.x - p.x, c.y - p.y) - Math.hypot(d.x - p.x, d.y - p.y),
      );
    if (candidates[0]) out[i] = candidates[0];
  });
  return out;
}

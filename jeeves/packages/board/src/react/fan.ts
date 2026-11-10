// Ported from automation-illustrator src/board/controls/plusPreviewLayout.ts (0803c4a).
// Screen-space placement of the fan a pulled tab opens: N items on a short arc around the tab's
// resting place, fanning right from an "after" tab and left from a "before" tab.
//
// Changes from automation-illustrator: N items instead of the fixed Step and Data pair, and
// horizontal only. Two items keep automation-illustrator's arc (radius 104, 56°); every item
// beyond two adds 24px of radius and the spread widens with the count, up to 150°. An item's slot
// depends only on its index and the count, so a caller that always passes the same items (some
// disabled) gets the same slots. `placeFan` keeps the items on the board
// (automation-illustrator's previews never reach a rail). A long list can be a grid instead
// (`fanGrid`): one row per group beside the tab, each item captioned, on one panel kept on the
// board as a block (`placeGrid`).
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
/** Room between two items pushed apart along a board edge. */
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
 * stack.
 */
export function placeFan(
  centers: readonly Point[],
  board: ScreenBox | undefined,
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
  return out;
}

/** A grid fan's cell: an item with its caption under it (board.css `.board-fan-caption`). */
export const FAN_CELL = { w: 104, h: 92 } as const;
/** A grid item's caption line, under its 60px box. */
export const FAN_CAPTION_H = 18;
/** From the tab's resting centre to the grid's near edge. */
export const FAN_GRID_OFFSET = 40;

/**
 * Centres of a grid fan's items, in their order: one row per group (in the order the groups first
 * appear), its items left to right, so a slot depends only on the item's group and its place in
 * it. The grid starts right of an "after" tab and ends left of a "before" tab, and is centred on
 * the tab's height.
 */
export function fanGrid(
  restX: number,
  restY: number,
  groups: readonly (string | undefined)[],
  before = false,
): Point[] {
  const rows = [...new Set(groups)];
  // An item's column is its place among the earlier items of its group.
  const slots = groups.map((group, i) => ({
    row: rows.indexOf(group),
    col: groups.slice(0, i).filter((other) => other === group).length,
  }));
  const cols = Math.max(1, ...slots.map((slot) => slot.col + 1));
  const width = cols * FAN_CELL.w;
  const left = before ? restX - FAN_GRID_OFFSET - width : restX + FAN_GRID_OFFSET;
  const top = restY - (rows.length * FAN_CELL.h) / 2;
  return slots.map(({ row, col }) => ({
    x: left + (col + 0.5) * FAN_CELL.w,
    y: top + (row + 0.5) * FAN_CELL.h - FAN_CAPTION_H / 2,
  }));
}

/** The box around a grid fan's cells (each item with its caption). */
export function gridBounds(centers: readonly Point[]): ScreenBox {
  const top = (p: Point) => p.y + FAN_CAPTION_H / 2 - FAN_CELL.h / 2;
  const x = Math.min(...centers.map((p) => p.x)) - FAN_CELL.w / 2;
  const y = Math.min(...centers.map(top));
  return {
    x,
    y,
    w: Math.max(...centers.map((p) => p.x)) + FAN_CELL.w / 2 - x,
    h: Math.max(...centers.map(top)) + FAN_CELL.h - y,
  };
}

/**
 * Keeps a grid fan on the board as one block: its cells move together, 16px inside the board's
 * edges, so the rows stay rows. A grid larger than the board keeps its top-left corner in.
 */
export function placeGrid(centers: readonly Point[], board: ScreenBox | undefined): Point[] {
  if (!board || !centers.length) return [...centers];
  const box = gridBounds(centers);
  const shift = (lo: number, size: number, start: number, length: number) => {
    const from = start + FAN_EDGE_MARGIN;
    const to = start + length - FAN_EDGE_MARGIN;
    if (lo < from || size > to - from) return from - lo;
    return lo + size > to ? to - (lo + size) : 0;
  };
  const dx = shift(box.x, box.w, board.x, board.w);
  const dy = shift(box.y, box.h, board.y, board.h);
  return centers.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

// Ported from automation-illustrator src/board/controls/plusPreviewLayout.ts (0803c4a).
// Screen-space placement of the fan a tab opens: N items on a short arc right of the tab's resting
// place.
//
// Changes from automation-illustrator: N items instead of the fixed Step and Data pair, and
// horizontal only. Two items keep automation-illustrator's arc (radius 104, 56°); every item
// beyond two adds 24px of radius and the spread widens with the count, up to 150°. An item's slot
// depends only on its index and the count, so a caller that always passes the same items (some
// disabled) gets the same slots. `placeFan` keeps the items on the board
// (automation-illustrator's previews never reach a rail). A long list can be a grid instead
// (`fanGrid`): one row per group right of the tab, each item captioned with its name, on one panel
// kept on the board as a block (`placeGrid`), beside its own tile when the board is too narrow
// for it beside the tab. `placeBeside` is that rule for any box, such as a caller's menu.
import type { Point, Size } from "../layout/metrics.ts";

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

/** Centres of `count` items, first at the top, on an arc right of the rest point (restX, restY). */
export function fanCenters(restX: number, restY: number, count: number): Point[] {
  const radius = FAN_RADIUS + FAN_RADIUS_STEP * Math.max(0, count - 2);
  const spread = Math.min(FAN_MAX_SPREAD, FAN_ITEM_SPREAD * Math.max(0, count - 1));
  const out: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = count === 1 ? 0 : -spread / 2 + (i * spread) / (count - 1);
    const rad = (angle * Math.PI) / 180;
    out.push({ x: restX + Math.cos(rad) * radius, y: restY + Math.sin(rad) * radius });
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

/** A grid fan's cell: an item with its caption (board.css `.board-fan-caption`) under it. */
export const FAN_CELL = { w: 104, h: 92 } as const;
/** A grid item's one-line caption, under its 60px box. */
export const FAN_CAPTION_H = 18;
/** From the tab's resting centre to the grid's near edge. */
export const FAN_GRID_OFFSET = 40;
/** How far a grid placed beside its tile, rather than beside the tab, keeps its cells from it. */
export const FAN_TILE_GAP = 28;
/** A grid fan's panel reaches this far past its cells (6px of the board's 16px margin). */
export const FAN_PANEL_PAD = 6;
/** The least room between a grid's cells and its tile: its panel never touches the tile. */
const FAN_TILE_CLEAR = FAN_PANEL_PAD + 2;

/**
 * Centres of a grid fan's items, in their order: one row per group (in the order the groups first
 * appear), its items left to right, so a slot depends only on the item's group and its place in
 * it. The grid starts right of the tab and is centred on the tab's height.
 */
export function fanGrid(restX: number, restY: number, groups: readonly (string | undefined)[]) {
  const order = [...new Set(groups)];
  // An item's place is its index among the earlier items of its group.
  const slots = groups.map((group, i) => ({
    row: order.indexOf(group),
    col: groups.slice(0, i).filter((other) => other === group).length,
  }));
  const top = restY - (order.length * FAN_CELL.h) / 2;
  const left = restX + FAN_GRID_OFFSET;
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

const overlap = (a: ScreenBox, b: ScreenBox) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Slides a span of `size` starting at `lo` into [start + margin, start + length - margin]. */
function slide(lo: number, size: number, start: number, length: number) {
  const from = start + FAN_EDGE_MARGIN;
  const to = start + length - FAN_EDGE_MARGIN;
  if (lo < from || size > to - from) return from;
  return lo + size > to ? to - size : lo;
}

/** A side of a box another box can sit on. */
export type Beside = "right" | "left" | "below" | "above";

/**
 * Where a box of `size` sits beside `avoid` on the board: on the first of `sides` where it fits
 * wholly inside `board` (16px margins) without covering `avoid`, `gap` px from it, centred on
 * `align` (default: `avoid`'s middle) and slid along that side to stay in. When no side has room,
 * the one that covers least of `avoid`, kept inside the board. Returns its top-left corner.
 */
export function placeBeside(
  size: Size,
  avoid: ScreenBox,
  board: ScreenBox,
  {
    sides = ["right", "left", "below", "above"],
    gap = FAN_TILE_GAP,
    align = { x: avoid.x + avoid.w / 2, y: avoid.y + avoid.h / 2 },
  }: { sides?: readonly Beside[]; gap?: number; align?: Point } = {},
): Point {
  const inside = (box: ScreenBox) =>
    box.x >= board.x + FAN_EDGE_MARGIN - 0.5 &&
    box.y >= board.y + FAN_EDGE_MARGIN - 0.5 &&
    box.x + box.w <= board.x + board.w - FAN_EDGE_MARGIN + 0.5 &&
    box.y + box.h <= board.y + board.h - FAN_EDGE_MARGIN + 0.5;
  const candidates = sides.map((side): ScreenBox => {
    const across =
      side === "right" || side === "left"
        ? slide(align.y - size.h / 2, size.h, board.y, board.h)
        : slide(align.x - size.w / 2, size.w, board.x, board.w);
    const at =
      side === "right"
        ? { x: avoid.x + avoid.w + gap, y: across }
        : side === "left"
          ? { x: avoid.x - gap - size.w, y: across }
          : side === "below"
            ? { x: across, y: avoid.y + avoid.h + gap }
            : { x: across, y: avoid.y - gap - size.h };
    return { ...at, w: size.w, h: size.h };
  });
  const fits = candidates.find((box) => inside(box) && overlap(box, avoid) === 0);
  if (fits) return { x: fits.x, y: fits.y };
  // No side has room: keep each inside the board and take the one that covers least.
  const kept = candidates.map((box) => ({
    ...box,
    x: slide(box.x, box.w, board.x, board.w),
    y: slide(box.y, box.h, board.y, board.h),
  }));
  const best = kept.reduce((a, b) => (overlap(b, avoid) < overlap(a, avoid) ? b : a));
  return { x: best.x, y: best.y };
}

/**
 * Keeps a grid fan on the board as one block: its cells move together, 16px inside the board's
 * edges, so the rows stay rows. A grid larger than the board keeps its top-left corner in. When
 * that would cover `avoid` (the tile the fan is for, on a narrow board), the block goes beside
 * the tile instead: on its left at the tab's height, or below or above it, centred on it
 * (`placeBeside`); with no room on any side, wherever covers least of it, often just beside it.
 */
export function placeGrid(
  centers: readonly Point[],
  board: ScreenBox | undefined,
  avoid?: ScreenBox,
): Point[] {
  if (!board || !centers.length) return [...centers];
  const box = gridBounds(centers);
  const kept = {
    x: slide(box.x, box.w, board.x, board.w),
    y: slide(box.y, box.h, board.y, board.h),
  };
  // Measured from the tile grown by the panel's reach, so not even the panel covers it.
  const clear = avoid && {
    x: avoid.x - FAN_TILE_CLEAR,
    y: avoid.y - FAN_TILE_CLEAR,
    w: avoid.w + 2 * FAN_TILE_CLEAR,
    h: avoid.h + 2 * FAN_TILE_CLEAR,
  };
  const at =
    clear && overlap({ ...box, ...kept }, clear) > 0
      ? placeBeside(box, clear, board, {
          gap: FAN_TILE_GAP - FAN_TILE_CLEAR,
          align: { x: clear.x + clear.w / 2, y: box.y + box.h / 2 },
        })
      : kept;
  return centers.map((p) => ({ x: p.x + at.x - box.x, y: p.y + at.y - box.y }));
}

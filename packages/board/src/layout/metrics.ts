// Ported from automation-illustrator src/board/layout/tileMetrics.ts (0803c4a).
// The board grid and where a new tile docks beside its source.
//
// Changes from automation-illustrator: tile sizes are passed in (there are no Step or Data
// kinds), the board is horizontal only, and the sides are "after" (out) and "before" (in).

export type Point = { x: number; y: number };
export type Size = { w: number; h: number };
export type Rect = Point & Size;

/** Every position the board shows sits on this grid. */
export const GRID = 32;
/** Space between layers (columns). */
export const TILE_GAP = 64;
/** Space between siblings in one layer (rows). */
export const BRANCH_GAP = 32;

/** Snaps a coordinate onto the 32px board grid. */
export function snapToGrid(n: number): number {
  return Math.round(n / GRID) * GRID;
}

/** True when two tiles would collide, including a one-grid gutter. */
export function rectsOverlap(a: Rect, b: Rect, pad = GRID): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function overlapsAny(pos: Point, size: Size, others: readonly Rect[]): boolean {
  const r = { ...pos, ...size };
  return others.some((o) => rectsOverlap(r, o));
}

/** "after" docks to the right of the source (a new successor), "before" to its left. */
export type DockSide = "after" | "before";

/**
 * The `portIndex`-th slot beside `source`, counted down from its own row. The stride uses the
 * taller of source and new tile, so a tall tile never sits on a sibling.
 */
function dockSlot(source: Rect, size: Size, portIndex: number, side: DockSide): Point {
  const stride = Math.max(source.h, size.h) + BRANCH_GAP;
  const x =
    side === "before"
      ? snapToGrid(source.x - TILE_GAP - size.w)
      : snapToGrid(source.x + source.w + TILE_GAP);
  return { x, y: snapToGrid(source.y + source.h / 2 + portIndex * stride - size.h / 2) };
}

/**
 * Where a new tile linked to `source` should first appear (a layout hint, never stored): on the
 * source's row in the next free column; if that row is full, stacked below from `portIndex`; as a
 * last resort below everything. `others` are the displayed tiles. (`clearDockPosition`.)
 */
export function dockHint(
  source: Rect,
  size: Size,
  portIndex: number,
  others: readonly Rect[],
  side: DockSide = "after",
): Point {
  const sameY = snapToGrid(source.y + source.h / 2 - size.h / 2);
  const strideX = size.w + TILE_GAP;
  const baseX = dockSlot(source, size, 0, side).x;
  const dir = side === "before" ? -1 : 1;
  for (let col = 0; col < 40; col++) {
    const pos = { x: snapToGrid(baseX + dir * col * strideX), y: sameY };
    if (!overlapsAny(pos, size, others)) return pos;
  }
  const start = Math.max(1, portIndex);
  for (let i = start; i < start + 40; i++) {
    const pos = dockSlot(source, size, i, side);
    if (!overlapsAny(pos, size, others)) return pos;
  }
  const maxY = Math.max(0, ...others.map((o) => o.y + o.h));
  return { x: baseX, y: snapToGrid(maxY + TILE_GAP) };
}

/** The row a new tile takes among the tiles it sits beside: just below or just above one. */
export type SlotOrder = { after: string } | { before: string };

/**
 * A new tile's layout hint and whether to show it there until ELK lands. Without `neighbour` it
 * docks beside its source (`dockHint`). With one, it takes the slot right below (`after`) or
 * above (`before`) that tile, so the stability ordering puts it next to it; when that slot is
 * taken, the hint only orders the tile (half a pixel past the neighbour) and the tile waits for
 * ELK unseen, rather than covering another. (Jeeves addition: a lane keeps its rows.)
 */
export function newTileHint(
  source: Rect,
  size: Size,
  portIndex: number,
  others: readonly Rect[],
  side: DockSide,
  neighbour?: { rect: Rect; place: "after" | "before" },
): { at: Point; show: boolean } {
  if (!neighbour) return { at: dockHint(source, size, portIndex, others, side), show: true };
  const { rect, place } = neighbour;
  const after = place === "after";
  const slot = {
    x: rect.x,
    y: after ? rect.y + rect.h + BRANCH_GAP : rect.y - size.h - BRANCH_GAP,
  };
  if (!overlapsAny(slot, size, others)) return { at: slot, show: true };
  return { at: { x: rect.x, y: rect.y + (after ? 0.5 : -0.5) }, show: false };
}

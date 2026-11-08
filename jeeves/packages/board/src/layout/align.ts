// Puts an ELK layout on the 32px grid, so every port sits on a grid line and near-straight lines
// become straight. ELK's balanced placement centres a merge between its predecessors, which
// leaves tile tops 8, 16 or 24px off the grid and small jogs in the lines. Pure: the engine runs
// it on every ELK result before caching, so shown positions (the next stability hints) are
// already aligned.
//
// Jeeves addition; automation-illustrator has the same gap.
//
// 1. Ports on grid lines: every tile's centre (its ports' y) is on the grid, so a tile whose
//    half-height is a multiple of 32 also has its top-left on it. x snaps to the grid too.
// 2. Near-straight lines become straight: a tile whose input port is within 16px of a
//    predecessor's output port takes that predecessor's row. Several qualify: a line ELK already
//    drew straight first, then input order.
// 3. Columns keep their order and gaps: tiles in one column keep their top-to-bottom order with
//    at least `BRANCH_GAP` between them; a tile that would come closer is pushed down, which
//    pushes the tiles below it. When the tile above only snapped to its nearest grid line (it
//    follows no predecessor) and the line above is still within 16px of ELK's row, that tile
//    moves up instead.
// 4. Routes follow the tiles: a route's first horizontal run takes its source port's y, its last
//    run its target port's y; vertical segments keep their x. A straight route whose ends now
//    differ gets a bend on a grid column between the tiles. Chips move with their run. Bounds grow
//    if needed.
import type { LayoutInput, LayoutTile } from "./elkGraph.ts";
import type { BoardLayout } from "./elkLayout.ts";
import { BRANCH_GAP, GRID, type Point, type Rect, snapToGrid } from "./metrics.ts";

/** Lines whose ports are at most this far apart share a row. */
export const STRAIGHTEN_PX = 16;

const ceilToGrid = (n: number) => Math.ceil(n / GRID) * GRID;

/** Tiles grouped into columns (overlapping x spans), left to right. */
function columns(tiles: LayoutTile[], positions: Record<string, Point>): LayoutTile[][] {
  const placed = tiles.filter((t) => positions[t.id]);
  const x = (t: LayoutTile) => positions[t.id]?.x ?? 0;
  const sorted = [...placed].sort((a, b) => x(a) - x(b) || (a.id < b.id ? -1 : 1));
  const out: LayoutTile[][] = [];
  let right = Number.NEGATIVE_INFINITY;
  for (const t of sorted) {
    const column = out[out.length - 1];
    if (column && x(t) < right) {
      column.push(t);
      right = Math.max(right, x(t) + t.w);
    } else {
      out.push([t]);
      right = x(t) + t.w;
    }
  }
  return out;
}

function isStraight(route: readonly Point[] | undefined): boolean {
  return !!route && route.every((p) => p.y === route[0]?.y);
}

/** Drops repeated points and the middle of three collinear ones. */
function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    const before = out[out.length - 2];
    if (
      before &&
      last &&
      ((before.x === last.x && last.x === p.x) || (before.y === last.y && last.y === p.y))
    ) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/** A grid column strictly between `from` and `to`, clear of `avoid`, nearest the middle. */
function bendColumn(from: number, to: number, avoid: readonly Rect[]): number {
  const mid = (from + to) / 2;
  let best: number | undefined;
  for (let g = ceilToGrid(from + 1); g < to; g += GRID) {
    if (avoid.some((r) => g >= r.x && g <= r.x + r.w)) continue;
    if (best === undefined || Math.abs(g - mid) < Math.abs(best - mid)) best = g;
  }
  return best ?? Math.round(mid);
}

export function alignLayout(layout: BoardLayout, input: LayoutInput): BoardLayout {
  const raw = layout.positions;
  const sizes = new Map(input.tiles.map((t) => [t.id, t]));
  const rawCentre = (id: string) => (raw[id]?.y ?? 0) + (sizes.get(id)?.h ?? 0) / 2;
  const incoming = new Map<string, LayoutInput["lines"]>();
  for (const line of input.lines) {
    incoming.set(line.target, [...(incoming.get(line.target) ?? []), line]);
  }

  // Tiles: column by column, so every predecessor is placed before the tiles it links to.
  const centres = new Map<string, number>();
  const positions: Record<string, Point> = { ...raw };
  for (const column of columns(input.tiles, raw)) {
    column.sort((a, b) => (raw[a.id]?.y ?? 0) - (raw[b.id]?.y ?? 0) || (a.id < b.id ? -1 : 1));
    /* Placed tiles of this column, top to bottom. A `free` tile only snapped to the nearest grid
       line (it follows no predecessor), so it may move one step either way within 16px. */
    const placed: { tile: LayoutTile; centre: number; free: boolean }[] = [];
    const floorAbove = (i: number) => {
      const above = placed[i - 1];
      return above ? above.centre + above.tile.h / 2 + BRANCH_GAP : layout.bounds.y + GRID;
    };
    for (const tile of column) {
      const at = rawCentre(tile.id);
      const near = (incoming.get(tile.id) ?? [])
        .filter((l) => centres.has(l.source) && Math.abs(rawCentre(l.source) - at) <= STRAIGHTEN_PX)
        .sort(
          (a, b) =>
            Number(isStraight(layout.routes[b.id])) - Number(isStraight(layout.routes[a.id])),
        );
      let centre = near[0] ? (centres.get(near[0].source) as number) : snapToGrid(at);
      const floor = floorAbove(placed.length);
      if (centre - tile.h / 2 < floor) {
        // Lift a free tile above (rounded the other way) rather than push this one off its row.
        const above = placed[placed.length - 1];
        const lift = ceilToGrid(floor - (centre - tile.h / 2));
        if (
          above?.free &&
          rawCentre(above.tile.id) - (above.centre - lift) <= STRAIGHTEN_PX &&
          above.centre - lift - above.tile.h / 2 >= floorAbove(placed.length - 1)
        ) {
          above.centre -= lift;
        } else {
          centre = ceilToGrid(floor + tile.h / 2);
        }
      }
      placed.push({ tile, centre, free: !near[0] });
    }
    for (const { tile, centre } of placed) {
      centres.set(tile.id, centre);
      positions[tile.id] = { x: snapToGrid(raw[tile.id]?.x ?? 0), y: centre - tile.h / 2 };
    }
  }

  // Routes and chips.
  const routes: Record<string, Point[]> = {};
  const chips: Record<string, Rect> = { ...layout.chips };
  for (const line of input.lines) {
    const route = layout.routes[line.id];
    const source = positions[line.source];
    const target = positions[line.target];
    const sourceTile = sizes.get(line.source);
    const placed = centres.has(line.source) && centres.has(line.target);
    if (!route || route.length < 2 || !source || !target || !sourceTile || !placed) {
      if (route) routes[line.id] = route;
      continue;
    }
    const sy = centres.get(line.source) as number;
    const ty = centres.get(line.target) as number;
    const sx = source.x + sourceTile.w;
    const tx = target.x;
    const last = route.length - 1;
    // Index of the last point on the first horizontal run, and of the first on the last run.
    let a = 0;
    while (a < last && route[a + 1]?.y === route[0]?.y) a++;
    let b = last;
    while (b > 0 && route[b - 1]?.y === route[last]?.y) b--;
    const chip = layout.chips[line.id];
    const chipCentre = chip && { x: chip.x + chip.w / 2, y: chip.y + chip.h / 2 };

    let next: Point[];
    let runY: (x: number, segment: number) => number;
    if (a >= b) {
      // One straight run.
      if (sy === ty) {
        next = [
          { x: sx, y: sy },
          { x: tx, y: ty },
        ];
        runY = () => sy;
      } else {
        const bx = bendColumn(sx, tx, chip ? [chip] : []);
        next = [
          { x: sx, y: sy },
          { x: bx, y: sy },
          { x: bx, y: ty },
          { x: tx, y: ty },
        ];
        runY = (x) => (x < bx ? sy : ty);
      }
    } else {
      next = route.map((p, i) => ({ x: p.x, y: i <= a ? sy : i >= b ? ty : p.y }));
      next[0] = { x: sx, y: sy };
      next[last] = { x: tx, y: ty };
      runY = (_x, segment) => (segment < a ? sy : segment >= b ? ty : (route[segment]?.y ?? 0));
    }
    routes[line.id] = simplify(next);

    if (chip && chipCentre) {
      // The segment the chip sits on: the nearest one.
      let segment = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < last; i++) {
        const p = route[i] as Point;
        const q = route[i + 1] as Point;
        const cx = Math.max(Math.min(p.x, q.x), Math.min(Math.max(p.x, q.x), chipCentre.x));
        const cy = Math.max(Math.min(p.y, q.y), Math.min(Math.max(p.y, q.y), chipCentre.y));
        const d = Math.hypot(chipCentre.x - cx, chipCentre.y - cy);
        if (d < best) [best, segment] = [d, i];
      }
      const p = route[segment] as Point;
      const q = route[segment + 1] as Point;
      if (p.y === q.y) {
        const dy = runY(chipCentre.x, segment) - p.y;
        chips[line.id] = { ...chip, y: chip.y + dy };
      }
    }
  }

  // Bounds grow to hold everything (with the padding ELK used).
  let right = layout.bounds.x + layout.bounds.w - GRID;
  let bottom = layout.bounds.y + layout.bounds.h - GRID;
  for (const tile of input.tiles) {
    const at = positions[tile.id];
    if (!at) continue;
    right = Math.max(right, at.x + tile.w);
    bottom = Math.max(bottom, at.y + tile.h);
  }
  for (const route of Object.values(routes)) {
    for (const p of route) [right, bottom] = [Math.max(right, p.x), Math.max(bottom, p.y)];
  }
  for (const c of Object.values(chips)) {
    [right, bottom] = [Math.max(right, c.x + c.w), Math.max(bottom, c.y + c.h)];
  }
  return {
    ...layout,
    positions,
    routes,
    chips,
    bounds: {
      ...layout.bounds,
      w: right + GRID - layout.bounds.x,
      h: bottom + GRID - layout.bounds.y,
    },
  };
}

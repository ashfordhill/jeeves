// Lines that come back: a line whose target sits in its source's column or before it. In a banded
// layout an end tile (lines in, none out) that several tiles use sits beside an early user
// (`endColumns`), so a later user's line comes back to it. ELK routes the other lines; each line
// that comes back is routed here afterwards, as a U: out of its source's east port, along a free
// row back past the columns between, and into its target's west port.
//
// Jeeves addition.
//
// - The U's two upright runs take free slots, on the grid, in the gap after the source's column
//   and the gap before the target's. When a gap has no free slot, it is widened by a grid step,
//   moving every tile and line right of it.
// - Its level run takes a free row: at least 16px from every tile in the columns it passes, on the
//   grid when it can be.
// - It shares no run with another line, except its source's own lines where they leave the source
//   and lines into its target for the last stretch: the whole stretch for a line of its own band,
//   the 32px next to the port for another band's. It touches no other line anywhere else.
// - Of the routes that keep those rules, the one with the fewest crossings, then the shortest
//   (counting what a widening adds to the lines it stretches), then on the grid.
import type { LayoutInput, LayoutLine } from "./elkGraph.ts";
import type { BoardLayout } from "./elkLayout.ts";
import { JUNCTION_PX } from "./junctions.ts";
import { GRID, type Point } from "./metrics.ts";

/** How far a line coming back stays from the tiles it passes. */
const CLEARANCE = 16;
/** At most this many grid steps added to either gap for one line. */
const MAX_WIDEN = 2;

/** Whether `line`'s target is in its source's column or before it. */
export const comesBack = (line: LayoutLine, column: Map<string, number>) =>
  (column.get(line.target) ?? 0) <= (column.get(line.source) ?? 0);

type Segment = { a: Point; b: Point };

function segments(route: readonly Point[]): Segment[] {
  return route.slice(0, -1).map((a, i) => ({ a, b: route[i + 1] as Point }));
}

function length(route: readonly Point[]): number {
  return segments(route).reduce((n, s) => n + Math.abs(s.b.x - s.a.x) + Math.abs(s.b.y - s.a.y), 0);
}

const level = (s: Segment) => s.a.y === s.b.y;
const lo = (s: Segment) => (level(s) ? Math.min(s.a.x, s.b.x) : Math.min(s.a.y, s.b.y));
const hi = (s: Segment) => (level(s) ? Math.max(s.a.x, s.b.x) : Math.max(s.a.y, s.b.y));
/** The coordinate a segment lies on: its y when level, its x when upright. */
const axis = (s: Segment) => (level(s) ? s.a.y : s.a.x);

/** Every tile and route point at or right of `cut` moves right by `dx`. */
export function widenAt(layout: BoardLayout, cut: number, dx: number): BoardLayout {
  const move = (p: Point) => (p.x >= cut ? { ...p, x: p.x + dx } : p);
  return {
    ...layout,
    positions: Object.fromEntries(Object.entries(layout.positions).map(([id, p]) => [id, move(p)])),
    routes: Object.fromEntries(
      Object.entries(layout.routes).map(([id, route]) => [id, route.map(move)]),
    ),
    chips: Object.fromEntries(
      Object.entries(layout.chips).map(([id, r]) => [id, r.x >= cut ? { ...r, x: r.x + dx } : r]),
    ),
    bounds: { ...layout.bounds, w: layout.bounds.w + dx },
  };
}

type Candidate = { route: Point[]; crossings: number; cost: number };

/**
 * The best U for `line` in `layout`, or undefined when every slot or row breaks a rule. `extra` is
 * what widening has already added to other lines. Not `strict`, a broken rule counts as many
 * crossings instead, so some U is always found.
 */
function bestU(
  layout: BoardLayout,
  input: LayoutInput,
  column: Map<string, number>,
  line: LayoutLine,
  placed: ReadonlySet<string>,
  extra: number,
  strict = true,
): Candidate | undefined {
  const size = new Map(input.tiles.map((t) => [t.id, t]));
  const col = (id: string) => column.get(id) ?? 0;
  const box = (id: string) => {
    const at = layout.positions[id] ?? { x: 0, y: 0 };
    const t = size.get(id);
    return { x: at.x, y: at.y, w: t?.w ?? 0, h: t?.h ?? 0 };
  };
  const edges = (c: number) => {
    const boxes = input.tiles.filter((t) => col(t.id) === c).map((t) => box(t.id));
    if (!boxes.length) return undefined;
    return {
      left: Math.min(...boxes.map((b) => b.x)),
      right: Math.max(...boxes.map((b) => b.x + b.w)),
    };
  };
  const [cs, ct] = [col(line.source), col(line.target)];
  const [s, t] = [box(line.source), box(line.target)];
  const [sx, ys, tx, yt] = [s.x + s.w, s.y + s.h / 2, t.x, t.y + t.h / 2];
  const after = edges(cs + 1)?.left ?? Number.POSITIVE_INFINITY;
  const before = edges(ct - 1)?.right ?? Number.NEGATIVE_INFINITY;
  const right = edges(cs)?.right ?? sx;
  const left = edges(ct)?.left ?? tx;

  const outs: number[] = [];
  for (let x = right + GRID; x <= after - GRID && outs.length < 6; x += GRID) outs.push(x);
  const ins: number[] = [];
  for (let x = left - GRID; x >= before + GRID && ins.length < 6; x -= GRID) ins.push(x);

  // Free rows: clear of every tile in the columns the level run passes.
  const blocks = input.tiles
    .filter((x) => col(x.id) >= ct && col(x.id) <= cs)
    .map((x) => box(x.id))
    .map((b) => [b.y - CLEARANCE, b.y + b.h + CLEARANCE] as const)
    .sort((a, b) => a[0] - b[0]);
  const free: [number, number][] = [];
  let top = Number.NEGATIVE_INFINITY;
  for (const [from, to] of blocks) {
    if (from >= top) free.push([top, from]);
    top = Math.max(top, to);
  }
  free.push([top, Number.POSITIVE_INFINITY]);
  const rows = new Set<number>();
  const [near, far] = [Math.min(ys, yt), Math.max(ys, yt)];
  for (const [from, to] of free) {
    const a = Number.isFinite(from) ? from : Math.min(to, near) - 2 * GRID;
    const b = Number.isFinite(to) ? to : Math.max(from, far) + 2 * GRID;
    if (b < a) continue;
    let grid = false;
    for (let y = Math.ceil(a / GRID) * GRID; y <= b; y += GRID) {
      if (y < near - 2 * GRID || y > far + 2 * GRID) continue;
      rows.add(y);
      grid = true;
    }
    if (!grid || Number.isFinite(from)) rows.add(a);
    if (!grid || Number.isFinite(to)) rows.add(b);
    if (!grid) rows.add((a + b) / 2);
  }

  // Everything already drawn, but this line.
  const others = input.lines
    .filter((l) => l.id !== line.id && (layout.routes[l.id] ?? []).length > 1)
    .filter((l) => !comesBack(l, column) || placed.has(l.id))
    .map((l) => ({ line: l, segs: segments(layout.routes[l.id] ?? []) }));

  let best: Candidate | undefined;
  for (const x1 of outs) {
    for (const x2 of ins) {
      if (x2 >= x1 && cs === ct) continue;
      for (const yc of rows) {
        if (Math.abs(yc - ys) < GRID || Math.abs(yc - yt) < GRID) continue;
        const route = [
          { x: sx, y: ys },
          { x: x1, y: ys },
          { x: x1, y: yc },
          { x: x2, y: yc },
          { x: x2, y: yt },
          { x: tx, y: yt },
        ];
        const crossings = judge(route, line, others, tx, strict);
        if (crossings === undefined) continue;
        const cost = length(route) + extra + (yc % GRID === 0 ? 0 : GRID / 4);
        if (
          !best ||
          crossings < best.crossings ||
          (crossings === best.crossings && cost < best.cost)
        ) {
          best = { route, crossings, cost };
        }
      }
    }
  }
  return best;
}

/** What a broken rule counts for when a U must be found anyway. */
const BROKEN = 1000;

/**
 * Crossings of `route` (a U for `line`) with the other lines, or undefined when it shares a run
 * or touches one where the rules don't allow it (see the top of this file); not `strict`, each
 * such place counts as `BROKEN` crossings.
 */
function judge(
  route: Point[],
  line: LayoutLine,
  others: { line: LayoutLine; segs: Segment[] }[],
  port: number,
  strict: boolean,
): number | undefined {
  const mine = segments(route);
  const last = mine.length - 1;
  let crossings = 0;
  for (const other of others) {
    const fromSource = other.line.source === line.source;
    const intoTarget = other.line.target === line.target;
    const sameBand = other.line.band === line.band;
    for (const [i, m] of mine.entries()) {
      for (const o of other.segs) {
        if (level(m) === level(o)) {
          if (axis(m) !== axis(o)) continue;
          const from = Math.max(lo(m), lo(o));
          const to = Math.min(hi(m), hi(o));
          if (to < from) continue;
          // Shared or touching runs: only the source's own lines where they leave it, and lines
          // into the target on the last stretch (another band's only next to the port).
          if (fromSource && i <= 1) continue;
          if (
            intoTarget &&
            i >= last - 1 &&
            (sameBand || (i === last && from >= port - JUNCTION_PX))
          )
            continue;
          if (strict) return undefined;
          crossings += BROKEN;
          continue;
        }
        const [h, v] = level(m) ? [m, o] : [o, m];
        const inH = v.a.x >= lo(h) && v.a.x <= hi(h);
        const inV = h.a.y >= lo(v) && h.a.y <= hi(v);
        if (!inH || !inV) continue;
        const strictH = v.a.x > lo(h) && v.a.x < hi(h);
        const strictV = h.a.y > lo(v) && h.a.y < hi(v);
        if (strictH && strictV) {
          crossings++;
          continue;
        }
        // A touch: an end or bend of one on the other.
        if (fromSource && i <= 1) continue;
        if (intoTarget && i >= last - 1) continue;
        if (strict) return undefined;
        crossings += BROKEN;
      }
    }
  }
  return crossings;
}

/**
 * Routes every line that comes back (`comesBack`) as a U, in input order, widening a gap when it
 * has no free slot. `layout` has routes for every other line.
 */
export function routeReturns(
  layout: BoardLayout,
  input: LayoutInput,
  column: Map<string, number>,
): BoardLayout {
  const col = (id: string) => column.get(id) ?? 0;
  const size = new Map(input.tiles.map((t) => [t.id, t]));
  const placed = new Set<string>();
  let current = layout;
  for (const line of input.lines.filter((l) => comesBack(l, column))) {
    const edge = (c: number, side: "left" | "right") => {
      const xs = input.tiles
        .filter((t) => col(t.id) === c)
        .map((t) => {
          const x = current.positions[t.id]?.x ?? 0;
          return side === "left" ? x : x + (size.get(t.id)?.w ?? 0);
        });
      return side === "left" ? Math.min(...xs) : Math.max(...xs);
    };
    const total = (l: BoardLayout) =>
      input.lines.reduce((n, x) => n + (x.id === line.id ? 0 : length(l.routes[x.id] ?? [])), 0);
    const base = total(current);
    let choice: { layout: BoardLayout; candidate: Candidate } | undefined;
    for (let before = 0; before <= MAX_WIDEN; before++) {
      for (let after = 0; after <= MAX_WIDEN; after++) {
        let next = current;
        // Before the target: a new slot next to it. After the source: a new slot next to it.
        if (before) next = widenAt(next, edge(col(line.target), "left"), before * GRID);
        if (after) {
          const cut =
            input.tiles
              .filter((t) => col(t.id) === col(line.source))
              .map((t) => (next.positions[t.id]?.x ?? 0) + (size.get(t.id)?.w ?? 0))
              .reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY) + 1;
          next = widenAt(next, cut, after * GRID);
        }
        const extra = total(next) - base;
        // No U is shorter than 32px out, back past both tiles and 32px in, plus the rise.
        const s = next.positions[line.source];
        const t = next.positions[line.target];
        const shortest =
          (s?.x ?? 0) +
          (size.get(line.source)?.w ?? 0) -
          (t?.x ?? 0) +
          4 * GRID +
          Math.abs(
            (s?.y ?? 0) +
              (size.get(line.source)?.h ?? 0) / 2 -
              (t?.y ?? 0) -
              (size.get(line.target)?.h ?? 0) / 2,
          );
        if (choice?.candidate.crossings === 0 && choice.candidate.cost <= extra + shortest)
          continue;
        const candidate = bestU(next, input, column, line, placed, extra);
        if (!candidate) continue;
        const better =
          !choice ||
          candidate.crossings < choice.candidate.crossings ||
          (candidate.crossings === choice.candidate.crossings &&
            candidate.cost < choice.candidate.cost);
        if (better) choice = { layout: next, candidate };
      }
    }
    if (!choice) {
      const candidate = bestU(current, input, column, line, placed, 0, false);
      if (candidate) choice = { layout: current, candidate };
    }
    if (!choice) continue;
    current = {
      ...choice.layout,
      routes: { ...choice.layout.routes, [line.id]: choice.candidate.route },
    };
    placed.add(line.id);
  }
  // Bounds hold every route.
  let [right, bottom] = [
    current.bounds.x + current.bounds.w - GRID,
    current.bounds.y + current.bounds.h - GRID,
  ];
  let [leftmost, topmost] = [current.bounds.x + GRID, current.bounds.y + GRID];
  for (const route of Object.values(current.routes)) {
    for (const p of route) {
      [right, bottom] = [Math.max(right, p.x), Math.max(bottom, p.y)];
      [leftmost, topmost] = [Math.min(leftmost, p.x), Math.min(topmost, p.y)];
    }
  }
  const x = Math.min(current.bounds.x, leftmost - GRID);
  const y = Math.min(current.bounds.y, topmost - GRID);
  return { ...current, bounds: { x, y, w: right + GRID - x, h: bottom + GRID - y } };
}

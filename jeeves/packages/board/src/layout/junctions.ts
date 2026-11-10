// Where lines of different bands meet. `layoutBands` gives each band its own port on a tile that
// several bands enter, so ELK never bundles them into one bus; but in the gap before that tile
// they still run side by side from the nearer of their buses to the port, which is more than
// `JUNCTION_PX` when a bus of another tile takes the slot next to the column. `meetAtPorts` moves
// buses in that gap (onto the slot next to the column, or swapping with the bus there) until the
// lines of different bands meet only within `JUNCTION_PX` of the port, when a move can do it
// without more crossings.
//
// Named ports. A port here is the one a line actually uses (`lineSourcePortId`,
// `lineTargetPortId`): a named port, or its tile's default one at mid-height (one point, however
// many ELK ports `layoutBands` gives it). Lines meet at a port only when they use the same one, so
// two lines into different named ports of one tile have no window to share, and a junction is a
// port, not a tile. The rule stays per band: lines of one band from different named ports may
// share a run, as lines of one band from different tiles do. (Into a default port, `layoutBands`
// gives each named source port its own ELK port, so ELK draws such lines apart where the gap
// has room.)
//
// Jeeves addition.
import {
  type LayoutInput,
  type LayoutLine,
  type LayoutTile,
  lineSourcePortId,
  lineTargetPortId,
  portOffset,
} from "./elkGraph.ts";
import type { BoardLayout } from "./elkLayout.ts";
import { GRID, type Point } from "./metrics.ts";

/** Lines of different bands may share this much of a run, next to a port they both use. */
export const JUNCTION_PX = 32;

type Segment = [Point, Point];

function segments(route: readonly Point[]): Segment[] {
  return route.slice(0, -1).map((a, i) => [a, route[i + 1] as Point]);
}

/** A port two lines both use: the window next to it where they may run together. */
function sharedPort(
  a: LayoutLine,
  b: LayoutLine,
  layout: BoardLayout,
  tiles: Map<string, LayoutTile>,
): { x: number; y: number; dir: 1 | -1 }[] {
  const out: { x: number; y: number; dir: 1 | -1 }[] = [];
  const at = (id: string) => layout.positions[id];
  const y = (id: string, port: string | undefined) =>
    (at(id)?.y ?? 0) + portOffset(tiles.get(id), port);
  if (lineTargetPortId(a) === lineTargetPortId(b) && at(a.target)) {
    out.push({ x: at(a.target)?.x ?? 0, y: y(a.target, a.targetPort), dir: -1 });
  }
  if (lineSourcePortId(a) === lineSourcePortId(b) && at(a.source)) {
    const route = layout.routes[a.id];
    out.push({ x: route?.[0]?.x ?? 0, y: y(a.source, a.sourcePort), dir: 1 });
  }
  return out;
}

/**
 * How well `layout` keeps its bands apart: `clashes` counts pairs of runs, from lines of
 * different bands, that lie on one line and overlap or meet end to end (so they read as one
 * line), outside `JUNCTION_PX` of a port both lines use; `crossings` counts lines crossing.
 */
type Score = { clashes: number; crossings: number };

export function bandClashes(layout: BoardLayout, input: LayoutInput): Score {
  const tiles = new Map(input.tiles.map((t) => [t.id, t]));
  let clashes = 0;
  let crossings = 0;
  for (const [i, a] of input.lines.entries()) {
    for (const b of input.lines.slice(i + 1)) {
      const ports = a.band !== b.band ? sharedPort(a, b, layout, tiles) : [];
      for (const [a1, a2] of segments(layout.routes[a.id] ?? [])) {
        for (const [b1, b2] of segments(layout.routes[b.id] ?? [])) {
          const aLevel = a1.y === a2.y;
          const bLevel = b1.y === b2.y;
          if (aLevel !== bLevel) {
            const [h1, h2, v1, v2] = aLevel ? [a1, a2, b1, b2] : [b1, b2, a1, a2];
            const inH = v1.x > Math.min(h1.x, h2.x) && v1.x < Math.max(h1.x, h2.x);
            const inV = h1.y > Math.min(v1.y, v2.y) && h1.y < Math.max(v1.y, v2.y);
            if (inH && inV) crossings++;
            continue;
          }
          if (a.band === b.band) continue;
          if (aLevel ? a1.y !== b1.y : a1.x !== b1.x) continue;
          const along = (p: Point) => (aLevel ? p.x : p.y);
          let lo = Math.max(Math.min(along(a1), along(a2)), Math.min(along(b1), along(b2)));
          let hi = Math.min(Math.max(along(a1), along(a2)), Math.max(along(b1), along(b2)));
          if (hi < lo) continue;
          for (const port of aLevel ? ports.filter((p) => p.y === a1.y) : []) {
            const [from, to] =
              port.dir < 0 ? [port.x - JUNCTION_PX, port.x] : [port.x, port.x + JUNCTION_PX];
            if (lo >= from && hi <= to) [lo, hi] = [0, -1];
            else if (lo >= from && lo <= to) lo = to;
            else if (hi >= from && hi <= to) hi = from;
          }
          if (hi >= lo) clashes++;
        }
      }
    }
  }
  return { clashes, crossings };
}

/** A bus: one vertical run in a gap, shared by the lines of one band that turn there. */
type Bus = {
  x: number;
  lo: number;
  hi: number;
  band?: number;
  runs: { line: string; i: number }[];
};

function busesIn(routes: BoardLayout["routes"], input: LayoutInput, left: number, right: number) {
  const runs: (Omit<Bus, "runs"> & { line: string; i: number })[] = [];
  for (const line of input.lines) {
    for (const [i, [a, b]] of segments(routes[line.id] ?? []).entries()) {
      if (a.x !== b.x || a.y === b.y || a.x <= left || a.x >= right) continue;
      runs.push({
        x: a.x,
        lo: Math.min(a.y, b.y),
        hi: Math.max(a.y, b.y),
        band: line.band,
        line: line.id,
        i,
      });
    }
  }
  runs.sort((p, q) => p.x - q.x || p.lo - q.lo);
  const buses: Bus[] = [];
  for (const run of runs) {
    const bus = buses.find(
      (b) => b.x === run.x && b.band === run.band && run.lo <= b.hi && b.lo <= run.hi,
    );
    if (bus) {
      [bus.lo, bus.hi] = [Math.min(bus.lo, run.lo), Math.max(bus.hi, run.hi)];
      bus.runs.push({ line: run.line, i: run.i });
    } else {
      buses.push({
        x: run.x,
        lo: run.lo,
        hi: run.hi,
        band: run.band,
        runs: [{ line: run.line, i: run.i }],
      });
    }
  }
  return buses;
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

/** `routes` with `bus` moved to `x`; undefined when a line would then run backwards. */
function moveBus(routes: BoardLayout["routes"], bus: Bus, x: number) {
  const next = { ...routes };
  for (const { line, i } of bus.runs) {
    const route = [...(next[line] ?? [])];
    route[i] = { ...(route[i] as Point), x };
    route[i + 1] = { ...(route[i + 1] as Point), x };
    next[line] = route;
  }
  for (const { line } of bus.runs) {
    const route = simplify(next[line] ?? []);
    if (route.some((p, i) => i > 0 && p.x < (route[i - 1] as Point).x)) return undefined;
    next[line] = route;
  }
  return next;
}

/** Collinear buses closer than this read as one line. */
const BUS_CLEARANCE = GRID / 2;
const near = (a: Bus, b: Bus) => a.lo < b.hi + BUS_CLEARANCE && b.lo < a.hi + BUS_CLEARANCE;

/**
 * Moves buses so lines of different bands meet only within `JUNCTION_PX` of a port they both
 * enter: for each port entered by several bands, a bus of a line into it may move onto the slot
 * `JUNCTION_PX` left of its tile, or swap with the one bus there. A move is kept when it leaves
 * fewer clashes, or as many and fewer crossings (`bandClashes`).
 */
export function meetAtPorts(
  layout: BoardLayout,
  input: LayoutInput,
  column: Map<string, number>,
): BoardLayout {
  // Ports entered by several bands, in tile order and, on a tile, in the order lines reach them.
  const entering = new Map<string, { tile: LayoutTile; bands: Set<number | undefined> }>();
  for (const tile of input.tiles) {
    for (const line of input.lines.filter((l) => l.target === tile.id)) {
      const port = lineTargetPortId(line);
      const entry = entering.get(port) ?? { tile, bands: new Set() };
      entry.bands.add(line.band);
      entering.set(port, entry);
    }
  }
  const junctions = [...entering]
    .filter(([, e]) => e.bands.size > 1)
    .map(([port, e]) => ({ port, tile: e.tile }));
  if (!junctions.length) return layout;
  const targets = new Map(input.lines.map((l) => [l.id, lineTargetPortId(l)]));
  const better = (a: Score, b: Score) =>
    a.clashes < b.clashes || (a.clashes === b.clashes && a.crossings < b.crossings);
  const edges = (c: number) => {
    const xs = input.tiles
      .filter((t) => column.get(t.id) === c)
      .map((t) => ({
        left: layout.positions[t.id]?.x ?? 0,
        right: (layout.positions[t.id]?.x ?? 0) + t.w,
      }));
    return { left: Math.min(...xs.map((e) => e.left)), right: Math.max(...xs.map((e) => e.right)) };
  };

  let best = layout;
  let score = bandClashes(layout, input);
  for (let round = 0; round < input.lines.length && score.clashes > 0; round++) {
    let found: { layout: BoardLayout; score: Score } | undefined;
    for (const { port, tile } of junctions) {
      const c = column.get(tile.id) ?? 0;
      const left = edges(c - 1).right;
      const right = edges(c).left;
      const slot = (best.positions[tile.id]?.x ?? 0) - JUNCTION_PX;
      const buses = busesIn(best.routes, input, left, right);
      const into = buses.filter((b) => b.runs.some((r) => targets.get(r.line) === port));
      for (const bus of into.filter((b) => b.x !== slot)) {
        const there = buses.filter((b) => b !== bus && b.x === slot && near(b, bus));
        let routes: BoardLayout["routes"] | undefined;
        if (!there.length) routes = moveBus(best.routes, bus, slot);
        else if (there.length === 1) {
          const other = there[0] as Bus;
          const clash = buses.some(
            (b) => b !== bus && b !== other && b.x === bus.x && near(b, other),
          );
          const moved = clash ? undefined : moveBus(best.routes, bus, slot);
          // The other bus's lines are untouched by the first move, so its run indices still hold.
          routes = moved && moveBus(moved, other, bus.x);
        }
        if (!routes) continue;
        const next = { ...best, routes };
        const s = bandClashes(next, input);
        if (better(s, found?.score ?? score)) found = { layout: next, score: s };
      }
    }
    if (!found) break;
    [best, score] = [found.layout, found.score];
  }
  return best;
}

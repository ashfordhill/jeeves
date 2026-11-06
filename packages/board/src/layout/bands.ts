// Bands: a layout in horizontal strips. A tile may carry a band (an integer); every tile of a
// lower band sits above every tile of a higher one, and lines of different bands share no run
// except the 32px next to a port they both use (`junctions.ts`). A tile without a band (one with
// no lines in, such as a lane canvas's user) sits beside the strips, centred on the tiles it links
// to.
//
// Jeeves addition; automation-illustrator has no bands. Chosen by measurement (LA03): one ELK
// pass with the bands in model order kept them in order within each column only, and shifting its
// result apart left lines routed for the old rows. So:
//
// 1. Columns: each tile one column right of its furthest predecessor (ELK's LONGEST_PATH_SOURCE),
//    except an end tile several tiles use, which sits beside one of them (`endColumns`). A line
//    whose target is then in its source's column or before it comes back.
// 2. Each band is laid out alone by ELK with those columns (forks centred, chains straight, rows in
//    model order or the shown order) and put on the grid (`alignLayout`). A long line that leaves
//    its band ends at a stub in its target's column, so the band keeps a track for it.
// 3. The bands are stacked on the grid, `BAND_GAP` apart, and each long line's track is kept clear
//    of the tiles in the columns it passes.
// 4. One more ELK pass routes every line that runs forward with the tiles and tracks fixed
//    (interactive crossing minimisation and node placement; a track goes in as bend points). A
//    tile entered by lines of several bands gets one input port per band, so ELK never bundles
//    different bands into one bus; the same for a tile whose lines out have several bands.
// 5. `alignLayout` as for any layout, then `meetAtPorts`, then the lines that come back are routed
//    as U's (`routeReturns`). ELK draws a line that comes back as a staircase through the columns
//    it passes, and longer (measured on the studies, SD03).
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api.js";
import { alignLayout } from "./align.ts";
import {
  byHint,
  elkTile,
  inPortId,
  type LayoutInput,
  type LayoutLine,
  type LayoutTile,
  outPortId,
  type PositionMap,
  ROOT_OPTIONS,
  stabilityHints,
} from "./elkGraph.ts";
import { type BoardLayout, toBoardLayout } from "./elkLayout.ts";
import type { ElkLike } from "./engine.ts";
import { meetAtPorts } from "./junctions.ts";
import { BRANCH_GAP, GRID, type Point, snapToGrid } from "./metrics.ts";
import { comesBack, routeReturns } from "./returns.ts";

/** Space between two bands' strips. */
export const BAND_GAP = GRID;
/** How far a line passing a column stays from its tiles (ELK's edge-node spacing). */
const TRACK_CLEARANCE = 16;
/** A column's x in the hints ELK reads: wider than any column, so each column is one ELK layer. */
const COLUMN_HINT = 4096;

/** One band laid out alone: the columns come from the x hints, the rows from model order. */
export const BAND_OPTIONS: Record<string, string> = {
  ...ROOT_OPTIONS,
  "elk.layered.layering.strategy": "INTERACTIVE",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
};

/**
 * The whole board routed with every tile and track where the bands put them. No vertical spacing,
 * so ELK keeps every position as given.
 */
export const ROUTE_OPTIONS: Record<string, string> = {
  ...ROOT_OPTIONS,
  "elk.layered.layering.strategy": "INTERACTIVE",
  "elk.layered.crossingMinimization.strategy": "INTERACTIVE",
  "elk.layered.nodePlacement.strategy": "INTERACTIVE",
  "elk.spacing.nodeNode": "0",
  "elk.spacing.edgeNode": "0",
  "elk.spacing.edgeEdge": "0",
};

/**
 * Each tile's column: one right of its furthest predecessor, so a tile with no lines in is in
 * column 0. Undefined when the lines form a loop or name a tile that doesn't exist.
 */
export function bandColumns(input: LayoutInput): Map<string, number> | undefined {
  const tiles = new Set(input.tiles.map((t) => t.id));
  const before = new Map<string, string[]>();
  for (const line of input.lines) {
    if (!tiles.has(line.source) || !tiles.has(line.target)) return undefined;
    before.set(line.target, [...(before.get(line.target) ?? []), line.source]);
  }
  const column = new Map<string, number>();
  const open = new Set<string>();
  const visit = (id: string): number | undefined => {
    const known = column.get(id);
    if (known !== undefined) return known;
    if (open.has(id)) return undefined;
    open.add(id);
    let at = 0;
    for (const source of before.get(id) ?? []) {
      const c = visit(source);
      if (c === undefined) return undefined;
      at = Math.max(at, c + 1);
    }
    open.delete(id);
    column.set(id, at);
    return at;
  };
  for (const tile of input.tiles) if (visit(tile.id) === undefined) return undefined;
  return column;
}

/**
 * `column` with each end tile (lines in, none out) that several tiles use moved beside them, so a
 * fork is short branches rather than a long line to a far column. Its column is the first, from
 * right after its earliest user (the first line into it), that doesn't make its band taller:
 * where its band already has fewer tiles than in its tallest column. It sits no more than one
 * column before its last user, whose line comes back to it as a U (`returns.ts`): a U back past
 * more columns is longer than the line it saves. If every column up to the one right after its
 * last user would make the band taller, the one with the fewest tiles. Every other tile keeps its
 * column, so a store with one user sits right after it.
 *
 * Chosen by measurement on the three studies (SD03): right after the earliest user every time
 * made every study's lines longer than with the stores in the last column (YouTube 10,656px
 * against 9,120px, its Search indexer's line coming back across four columns, 1,536px) and the
 * shared band taller; with these two limits every study's lines are shorter.
 */
export function endColumns(input: LayoutInput, column: Map<string, number>): Map<string, number> {
  const out = new Map(column);
  const sources = new Set(input.lines.map((l) => l.source));
  const users = new Map<string, string[]>();
  for (const line of input.lines) {
    if (sources.has(line.target)) continue;
    const list = users.get(line.target) ?? [];
    if (!list.includes(line.source)) list.push(line.source);
    users.set(line.target, list);
  }
  // The columns an end tile may take: from right after its earliest user (or one before its last
  // user, if later) to right after its last user.
  const range = (id: string) => {
    const at = (users.get(id) ?? []).map((u) => column.get(u) ?? 0);
    if (at.length < 2) return undefined;
    const last = Math.max(...at);
    const first = Math.max((at[0] as number) + 1, last - 1);
    return first <= last ? { first, last: last + 1 } : undefined;
  };
  const shared = (id: string) => range(id) !== undefined;
  const band = new Map(input.tiles.map((t) => [t.id, t.band]));
  const count = new Map<string, number>();
  const slot = (b: number | undefined, c: number) => `${b ?? "-"}:${c}`;
  const add = (id: string, c: number) => {
    const key = slot(band.get(id), c);
    count.set(key, (count.get(key) ?? 0) + 1);
  };
  for (const t of input.tiles) if (!shared(t.id)) add(t.id, column.get(t.id) ?? 0);
  const tallest = (b: number | undefined) => {
    let n = 1;
    for (const [key, k] of count) if (key.startsWith(`${b ?? "-"}:`)) n = Math.max(n, k);
    return n;
  };
  for (const t of input.tiles) {
    const span = range(t.id);
    if (!span) continue;
    let best = span.first;
    let fewest = Number.POSITIVE_INFINITY;
    for (let k = span.first; k <= span.last; k++) {
      const n = count.get(slot(t.band, k)) ?? 0;
      if (n + 1 <= tallest(t.band)) {
        best = k;
        break;
      }
      if (n < fewest) [best, fewest] = [k, n];
    }
    out.set(t.id, best);
    add(t.id, best);
  }
  return out;
}

/**
 * Whether `input` is laid out in bands: some tile has a band, every tile without one has no lines
 * in, no line has a chip, and the lines form no loop. Otherwise it is laid out as one graph.
 */
export function usesBands(input: LayoutInput): boolean {
  if (!input.tiles.some((t) => t.band !== undefined)) return false;
  if (input.lines.some((l) => l.chip)) return false;
  const loose = new Set(input.tiles.filter((t) => t.band === undefined).map((t) => t.id));
  if (input.lines.some((l) => loose.has(l.target))) return false;
  return bandColumns(input) !== undefined;
}

/** The y of `route`'s horizontal run over `x`, if it has one there. */
function runAt(route: readonly Point[], x: number): number | undefined {
  for (const [i, a] of route.slice(0, -1).entries()) {
    const b = route[i + 1] as Point;
    if (a.y === b.y && Math.min(a.x, b.x) <= x && x <= Math.max(a.x, b.x)) return a.y;
  }
  return undefined;
}

type Band = {
  /** Tile id → top, on the grid. */
  tops: Map<string, number>;
  /** Line id → column → the y it passes that column at. */
  tracks: Map<string, Map<number, number>>;
  top: number;
  bottom: number;
};

/** Places tracks between `lo` and `hi`, in order, at least `TRACK_CLEARANCE` apart. */
function spread(wants: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (const [i, want] of wants.entries()) {
    out.push(Math.max(want, i ? (out[i - 1] as number) + TRACK_CLEARANCE : lo));
  }
  for (let i = out.length - 1; i >= 0; i--) {
    const next = i < out.length - 1 ? (out[i + 1] as number) - TRACK_CLEARANCE : hi;
    out[i] = Math.min(out[i] as number, next);
  }
  return out;
}

/** One band laid out alone and put on the grid, with a track for each long line leaving a tile. */
async function layoutBand(
  elk: ElkLike,
  input: LayoutInput,
  band: number,
  column: Map<string, number>,
  hints: Map<string, Point> | null,
): Promise<Band> {
  const col = (id: string) => column.get(id) ?? 0;
  const own = input.tiles.filter((t) => t.band === band);
  const ids = new Set(own.map((t) => t.id));
  const long = (l: LayoutLine) => col(l.target) - col(l.source) >= 2;
  let lines = input.lines.filter(
    (l) => !comesBack(l, column) && ids.has(l.source) && (ids.has(l.target) || long(l)),
  );
  let tiles = own;
  if (hints) {
    tiles = [...own].sort((a, b) => byHint(a.id, b.id, hints));
    lines = [...lines].sort(
      (a, b) => byHint(a.target, b.target, hints) || byHint(a.source, b.source, hints),
    );
  }
  // A line leaving the band ends at a stub in its target's column. NUL never starts a tile id.
  const stub = (l: LayoutLine) => `\u0000${l.id}`;
  const end = (l: LayoutLine) => (ids.has(l.target) ? l.target : stub(l));
  const children: ElkNode[] = [
    ...tiles.map((t) => ({ ...elkTile(t), x: col(t.id) * COLUMN_HINT })),
    ...lines
      .filter((l) => !ids.has(l.target))
      .map((l) => ({
        ...elkTile({ id: stub(l), w: 0, h: 0 }),
        x: col(l.target) * COLUMN_HINT + 1,
      })),
  ];
  const edges: ElkExtendedEdge[] = lines.map((l) => ({
    id: l.id,
    sources: [outPortId(l.source)],
    targets: [inPortId(end(l))],
  }));
  const raw = toBoardLayout(
    "band",
    await elk.layout({ id: "root", layoutOptions: { ...BAND_OPTIONS }, children, edges }),
  );
  const aligned = alignLayout(raw, { tiles: own, lines: lines.filter((l) => ids.has(l.target)) });

  const size = new Map(own.map((t) => [t.id, t]));
  const port = (layout: BoardLayout, id: string) =>
    (layout.positions[id]?.y ?? 0) + (size.get(id)?.h ?? 0) / 2;
  const centreX = new Map<number, number>();
  for (const t of own) centreX.set(col(t.id), (raw.positions[t.id]?.x ?? 0) + t.w / 2);

  // Tracks where ELK left them, following their source (or target) onto the grid when level.
  type Track = { line: string; raw: number; want: number };
  const passing = new Map<number, Track[]>();
  for (const l of lines.filter(long)) {
    const route = raw.routes[l.id] ?? [];
    const from = { raw: port(raw, l.source), aligned: port(aligned, l.source) };
    const to = ids.has(l.target)
      ? { raw: port(raw, l.target), aligned: port(aligned, l.target) }
      : null;
    let y = from.raw;
    for (let c = col(l.source) + 1; c < col(l.target); c++) {
      const x = centreX.get(c);
      y = (x === undefined ? undefined : runAt(route, x)) ?? y;
      const want = y === from.raw ? from.aligned : y === to?.raw ? to.aligned : y;
      passing.set(c, [...(passing.get(c) ?? []), { line: l.id, raw: y, want }]);
    }
  }

  // Each column's tracks stay clear of its tiles, in ELK's order; tracks ELK merged stay merged.
  const tracks = new Map<string, Map<number, number>>();
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const t of own) {
    const y = aligned.positions[t.id]?.y ?? 0;
    [top, bottom] = [Math.min(top, y), Math.max(bottom, y + t.h)];
  }
  for (const [c, list] of passing) {
    type Item = { key: number; tile: LayoutTile } | { key: number; track: number };
    const items: Item[] = [
      ...own.filter((t) => col(t.id) === c).map((t) => ({ key: port(raw, t.id), tile: t })),
      ...[...new Set(list.map((t) => t.raw))].map((y) => ({ key: y, track: y })),
    ].sort((a, b) => a.key - b.key);
    let lo = Number.NEGATIVE_INFINITY;
    let run: number[] = [];
    const place = (hi: number) => {
      const wants = run.map((y) => list.find((t) => t.raw === y)?.want ?? y);
      const ys = spread(wants, lo, hi);
      for (const [i, y] of run.entries()) {
        const at = ys[i] as number;
        [top, bottom] = [
          Math.min(top, at - TRACK_CLEARANCE),
          Math.max(bottom, at + TRACK_CLEARANCE),
        ];
        for (const t of list.filter((t) => t.raw === y)) {
          tracks.set(t.line, (tracks.get(t.line) ?? new Map()).set(c, at));
        }
      }
      run = [];
    };
    for (const item of items) {
      if ("track" in item) {
        run.push(item.track);
        continue;
      }
      const y = aligned.positions[item.tile.id]?.y ?? 0;
      place(y - TRACK_CLEARANCE);
      lo = y + item.tile.h + TRACK_CLEARANCE;
    }
    place(Number.POSITIVE_INFINITY);
  }

  const tops = new Map(own.map((t) => [t.id, aligned.positions[t.id]?.y ?? 0]));
  return { tops, tracks, top, bottom };
}

/**
 * Where a tile without a band goes: centred on the tiles it links to (or at the top), on the grid,
 * and below any tile already in its column that it would touch.
 */
function placeLoose(
  input: LayoutInput,
  tops: Map<string, number>,
  column: Map<string, number>,
): void {
  const size = new Map(input.tiles.map((t) => [t.id, t]));
  const centre = (id: string) => (tops.get(id) ?? 0) + (size.get(id)?.h ?? 0) / 2;
  for (const tile of input.tiles.filter((t) => t.band === undefined)) {
    const targets = input.lines.filter((l) => l.source === tile.id && tops.has(l.target));
    const ys = targets.map((l) => centre(l.target));
    let y = snapToGrid(ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : GRID + tile.h / 2);
    y -= tile.h / 2;
    const taken = [...tops.keys()]
      .filter((id) => column.get(id) === column.get(tile.id))
      .map((id) => ({
        top: tops.get(id) ?? 0,
        bottom: (tops.get(id) ?? 0) + (size.get(id)?.h ?? 0),
      }))
      .sort((a, b) => a.top - b.top);
    for (const box of taken) {
      if (y < box.bottom + BRANCH_GAP && y + tile.h + BRANCH_GAP > box.top) {
        y = Math.ceil((box.bottom + BRANCH_GAP + tile.h / 2) / GRID) * GRID - tile.h / 2;
      }
    }
    tops.set(tile.id, y);
  }
}

/** Port ids per tile and side: one per band when lines of several bands use that side. */
function portIds(lines: readonly LayoutLine[], end: "source" | "target") {
  const bands = new Map<string, (number | undefined)[]>();
  for (const line of lines) {
    const list = bands.get(line[end]) ?? [];
    if (!list.includes(line.band)) list.push(line.band);
    bands.set(line[end], list);
  }
  const base = end === "target" ? inPortId : outPortId;
  const id = (tile: string, band: number | undefined) =>
    (bands.get(tile)?.length ?? 0) > 1 ? `${base(tile)}:${band ?? "-"}` : base(tile);
  const all = (tile: string) => (bands.get(tile) ?? [undefined]).map((band) => id(tile, band));
  return { id, all };
}

/** The board laid out in bands (see the top of this file). `usesBands(input)` must hold. */
export async function layoutBands(
  elk: ElkLike,
  key: string,
  input: LayoutInput,
  previous?: PositionMap,
): Promise<BoardLayout> {
  const column = endColumns(input, bandColumns(input) ?? new Map<string, number>());
  const col = (id: string) => column.get(id) ?? 0;
  const hints = stabilityHints(input, previous);
  // ELK routes the lines that run forward; the ones that come back are routed last.
  const forward: LayoutInput = {
    tiles: input.tiles,
    lines: input.lines.filter((l) => !comesBack(l, column)),
  };
  const bands = [...new Set(input.tiles.flatMap((t) => (t.band === undefined ? [] : [t.band])))];
  bands.sort((a, b) => a - b);

  const tops = new Map<string, number>();
  const tracks = new Map<string, Map<number, number>>();
  let floor: number | undefined;
  for (const band of bands) {
    const laid = await layoutBand(elk, input, band, column, hints);
    const want = floor === undefined ? GRID : floor + BAND_GAP;
    const shift = Math.ceil((want - laid.top) / GRID) * GRID;
    for (const [id, y] of laid.tops) tops.set(id, y + shift);
    for (const [line, at] of laid.tracks) {
      tracks.set(line, new Map([...at].map(([c, y]) => [c, y + shift])));
    }
    floor = laid.bottom + shift;
  }
  placeLoose(input, tops, column);

  // Route everything with the tiles and tracks fixed.
  const size = new Map(input.tiles.map((t) => [t.id, t]));
  const widths = new Map<number, number[]>();
  for (const t of input.tiles) widths.set(col(t.id), [...(widths.get(col(t.id)) ?? []), t.w]);
  /* Where ELK's interactive ordering samples a column: the mean of its tiles' centres. */
  const sampleX = (c: number) => {
    const w = widths.get(c) ?? [0];
    return c * COLUMN_HINT + w.reduce((sum, n) => sum + n, 0) / w.length / 2;
  };
  const ins = portIds(forward.lines, "target");
  const outs = portIds(forward.lines, "source");
  const children: ElkNode[] = input.tiles.map((t: LayoutTile) => ({
    ...elkTile(t, ins.all(t.id), outs.all(t.id)),
    x: col(t.id) * COLUMN_HINT,
    y: tops.get(t.id) ?? 0,
  }));
  const portY = (id: string) => (tops.get(id) ?? 0) + (size.get(id)?.h ?? 0) / 2;
  const edges: ElkExtendedEdge[] = forward.lines.map((l) => {
    const edge: ElkExtendedEdge = {
      id: l.id,
      sources: [outs.id(l.source, l.band)],
      targets: [ins.id(l.target, l.band)],
    };
    const track = tracks.get(l.id);
    if (track?.size) {
      edge.sections = [
        {
          id: `${l.id}:track`,
          startPoint: {
            x: col(l.source) * COLUMN_HINT + (size.get(l.source)?.w ?? 0),
            y: portY(l.source),
          },
          endPoint: { x: col(l.target) * COLUMN_HINT, y: portY(l.target) },
          bendPoints: [...track].map(([c, y]) => ({ x: sampleX(c), y })),
        },
      ];
    }
    return edge;
  });
  const laidOut = await elk.layout({
    id: "root",
    layoutOptions: { ...ROUTE_OPTIONS },
    children,
    edges,
  });
  const routed = meetAtPorts(alignLayout(toBoardLayout(key, laidOut), forward), forward, column);
  return routeReturns(routed, input, column);
}

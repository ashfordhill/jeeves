// Ported from automation-illustrator src/board/layout/elkLayout.test.ts, layoutEngine.test.ts,
// layoutStability.test.ts and tileMetrics.test.ts (0803c4a). Real ELK (the bundled build) on
// the main thread, except where the engine's call count matters.
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it, vi } from "vitest";
import { alignLayout } from "./align.ts";
import { BAND_OPTIONS, bandColumns, endColumns, ROUTE_OPTIONS, usesBands } from "./bands.ts";
import noPortsGolden from "./elkGraph.golden.json" with { type: "json" };
import {
  buildElkGraph,
  graphKey,
  type LayoutInput,
  type LayoutLine,
  portOffset,
  usedOptionIds,
} from "./elkGraph.ts";
import { type BoardLayout, toBoardLayout } from "./elkLayout.ts";
import { createLayoutEngine, LayoutSuperseded } from "./engine.ts";
import { bandClashes, JUNCTION_PX, meetAtPorts } from "./junctions.ts";
import { dockHint, GRID, newTileHint, type Point, type Rect } from "./metrics.ts";

const elk = new ELK();
const ENTRY_CHIP = { w: 32, h: 32 };

/** Tiles as `id` (128×128) or `id:WxH`; lines as `source>target`, with `*` for a chip. */
function board(tiles: string[], lines: string[]): LayoutInput {
  return {
    tiles: tiles.map((spec) => {
      const [id = "", size] = spec.split(":");
      const [w, h] = size ? size.split("x").map(Number) : [128, 128];
      return { id, w: w ?? 128, h: h ?? 128 };
    }),
    lines: lines.map((spec) => {
      const chip = spec.endsWith("*");
      const [source = "", target = ""] = spec.replace("*", "").split(">");
      return { id: `${source}-${target}`, source, target, ...(chip && { chip: ENTRY_CHIP }) };
    }),
  };
}

/** What the engine caches: ELK's layout, put on the grid. */
async function layoutOf(input: LayoutInput, previous?: Record<string, Point>) {
  const laidOut = toBoardLayout(graphKey(input), await elk.layout(buildElkGraph(input, previous)));
  return alignLayout(laidOut, input);
}

function rect(input: LayoutInput, layout: BoardLayout, id: string): Rect {
  const tile = input.tiles.find((t) => t.id === id);
  const at = layout.positions[id];
  if (!tile || !at) throw new Error(`no tile ${id}`);
  return { ...at, w: tile.w, h: tile.h };
}
const centreY = (r: Rect) => r.y + r.h / 2;
const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function distanceToRoute(route: Point[], p: Point): number {
  let best = Number.POSITIVE_INFINITY;
  for (const [i, a] of route.slice(0, -1).entries()) {
    const b = route[i + 1] as Point;
    const [dx, dy] = [b.x - a.x, b.y - a.y];
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

/** Tiles do not overlap and their ports sit on grid lines (the top-left too, unless the
 * half-height is off the grid); routes are orthogonal, start and end at the mid-height ports;
 * chips sit on their own line and clear every tile. */
function expectClean(input: LayoutInput, layout: BoardLayout) {
  const rects = input.tiles.map((t) => rect(input, layout, t.id));
  for (const [i, a] of rects.entries()) {
    expect(Number.isInteger(a.x) && Number.isInteger(a.y)).toBe(true);
    expect(a.x % GRID, `${input.tiles[i]?.id} x`).toBe(0);
    expect(centreY(a) % GRID, `${input.tiles[i]?.id} port`).toBe(0);
    if ((a.h / 2) % GRID === 0) expect(a.y % GRID, `${input.tiles[i]?.id} top`).toBe(0);
    for (const b of rects.slice(i + 1)) expect(intersects(a, b)).toBe(false);
  }
  for (const line of input.lines) {
    const route = layout.routes[line.id] ?? [];
    const s = rect(input, layout, line.source);
    const t = rect(input, layout, line.target);
    expect(route.at(0)).toEqual({ x: s.x + s.w, y: centreY(s) });
    expect(route.at(-1)).toEqual({ x: t.x, y: centreY(t) });
    for (const [i, a] of route.slice(0, -1).entries()) {
      const b = route[i + 1] as Point;
      expect(a.x === b.x || a.y === b.y, `${line.id} has a diagonal`).toBe(true);
    }
    const chip = layout.chips[line.id];
    expect(chip !== undefined).toBe(line.chip !== undefined);
    if (!chip) continue;
    const centre = { x: chip.x + chip.w / 2, y: chip.y + chip.h / 2 };
    expect(distanceToRoute(route, centre), `${line.id} chip is off its line`).toBeLessThanOrEqual(
      1,
    );
    for (const r of rects) expect(intersects(chip, r)).toBe(false);
  }
}

/**
 * TinyURL v3 in lanes, in the canvas's order: 9 tiles, 10 lines, entry chips on the actor's three
 * lines. Two merges: the URL database (Redirect and Shorten) and the Analytics store (Stats API
 * and worker).
 */
const tinyUrl = board(
  ["actor:128x160", "stats", "redirect", "store", "cache", "db", "events", "worker", "shorten"],
  [
    "actor>stats*",
    "actor>redirect*",
    "actor>shorten*",
    "stats>store",
    "redirect>cache",
    "redirect>db",
    "redirect>events",
    "events>worker",
    "worker>store",
    "shorten>db",
  ],
);

describe("ELK layout", () => {
  it("gives identical output for the same input, using only options ELK knows", async () => {
    const known = new Set(
      (await elk.knownLayoutOptions()).map((o) =>
        (o.id ?? "").replace(/^org\.eclipse\.elk\./, "elk."),
      ),
    );
    const ids = [...usedOptionIds(), ...Object.keys(BAND_OPTIONS), ...Object.keys(ROUTE_OPTIONS)];
    for (const id of ids) expect(known.has(id), id).toBe(true);

    const a = await layoutOf(tinyUrl);
    const b = await layoutOf(structuredClone(tinyUrl));
    expect(b).toEqual(a);
    expectClean(tinyUrl, a);
    // Download is the actor's first line, so its tiles sit above the upload lane's.
    expect(a.positions.stats?.y).toBeLessThan(a.positions.redirect?.y ?? 0);
    expect(a.positions.redirect?.y).toBeLessThan(a.positions.shorten?.y ?? 0);
  });

  it("keeps a chain on one row", async () => {
    const chain = board(["actor:128x160", "a", "b", "c"], ["actor>a*", "a>b", "b>c"]);
    const layout = await layoutOf(chain);
    expectClean(chain, layout);
    const rows = new Set(chain.tiles.map((t) => centreY(rect(chain, layout, t.id))));
    expect(rows.size).toBe(1);
    for (const route of Object.values(layout.routes)) {
      expect(new Set(route.map((p) => p.y)).size).toBe(1);
    }
  });

  it("centres a two-way fork on its parent and keeps the rows it was shown in", async () => {
    const fork = board(["actor:128x160", "p", "a", "b"], ["actor>p*", "p>a", "p>b"]);
    const first = await layoutOf(fork);
    expectClean(fork, first);
    const [p, a, b] = ["p", "a", "b"].map((id) => centreY(rect(fork, first, id)));
    // Within half a grid step: ports sit on grid lines, and the fork's middle may not.
    expect(Math.abs((p ?? 0) - ((a ?? 0) + (b ?? 0)) / 2)).toBeLessThanOrEqual(16);
    expect(a).toBeLessThan(b ?? 0);

    // Shown the other way round (say, after a drop), the fork keeps that order.
    const swapped = { ...first.positions };
    [swapped.a, swapped.b] = [first.positions.b as Point, first.positions.a as Point];
    const again = await layoutOf(fork, swapped);
    expect(again.positions.b?.y).toBeLessThan(again.positions.a?.y ?? 0);
    expect(centreY(rect(fork, again, "p"))).toBe(p);
  });

  it("puts TinyURL on the grid with no small jogs", async () => {
    const layout = await layoutOf(tinyUrl);
    expectClean(tinyUrl, layout);
    // The user is 160 tall: its centre is on the grid, its top half a step off.
    expect((layout.positions.actor?.y ?? 0) % GRID).toBe(16);
    for (const [id, route] of Object.entries(layout.routes)) {
      for (const [i, a] of route.slice(0, -1).entries()) {
        const b = route[i + 1] as Point;
        if (a.x === b.x) expect(Math.abs(b.y - a.y), `${id} jogs`).toBeGreaterThanOrEqual(GRID);
      }
    }
    // The user's line into Redirect, the click path and the Shorten service's write are straight.
    for (const id of ["actor-redirect", "redirect-events", "events-worker", "shorten-db"]) {
      const route = layout.routes[id] ?? [];
      expect(route, id).toHaveLength(2);
      expect(route[0]?.y, id).toBe(route[1]?.y);
    }
  });

  it("moves only what an edit changes, and lays itself out again unchanged", async () => {
    const first = await layoutOf(tinyUrl);
    expect(await layoutOf(tinyUrl, first.positions)).toEqual(first);
    const longer = board(
      tinyUrl.tiles.map((t) => `${t.id}:${t.w}x${t.h}`).concat("report"),
      tinyUrl.lines
        .map((l) => `${l.source}>${l.target}${l.chip ? "*" : ""}`)
        .concat("store>report"),
    );
    const next = await layoutOf(longer, first.positions);
    expectClean(longer, next);
    for (const [id, at] of Object.entries(first.positions))
      expect(next.positions[id], id).toEqual(at);
    expect(next.positions.report?.y).toBe(first.positions.store?.y);
  });

  it("keeps straight lines straight after a fork moves the board", async () => {
    // Forking the Analytics worker moves tiles; the straight lines stay straight.
    const first = await layoutOf(tinyUrl);
    const forked = board(
      tinyUrl.tiles.map((t) => `${t.id}:${t.w}x${t.h}`).concat("report"),
      tinyUrl.lines
        .map((l) => `${l.source}>${l.target}${l.chip ? "*" : ""}`)
        .concat("worker>report"),
    );
    const next = await layoutOf(forked, first.positions);
    expectClean(forked, next);
    for (const id of ["actor-redirect", "redirect-events", "events-worker", "shorten-db"])
      expect(next.routes[id], id).toHaveLength(2);
  });

  it("pushes a column's lower tiles down to keep the gap, and bends a line that was straight", () => {
    // Hand-made ELK output. `e` is 160 tall, so its centre goes onto the grid and its bottom ends
    // half a step lower; `c`, level with `b` on a straight line, must then make room below it.
    const input = board(["b", "e:128x160", "c"], ["b>c"]);
    const raw: BoardLayout = {
      key: "k",
      positions: { b: { x: 32, y: 224 }, e: { x: 224, y: 32 }, c: { x: 224, y: 224 } },
      routes: {
        "b-c": [
          { x: 160, y: 288 },
          { x: 224, y: 288 },
        ],
      },
      chips: {},
      bounds: { x: 0, y: 0, w: 384, h: 384 },
    };
    const layout = alignLayout(raw, input);
    expect(layout.positions).toEqual({
      b: { x: 32, y: 224 },
      e: { x: 224, y: 48 },
      c: { x: 224, y: 256 },
    });
    expect(layout.routes["b-c"]).toEqual([
      { x: 160, y: 288 },
      { x: 192, y: 288 },
      { x: 192, y: 320 },
      { x: 224, y: 320 },
    ]);
    expect(layout.bounds).toEqual({ x: 0, y: 0, w: 384, h: 416 });
  });

  it("puts a merge one layer after its deepest source", async () => {
    const layout = await layoutOf(tinyUrl);
    const columns = [...new Set(Object.values(layout.positions).map((p) => p.x))].sort(
      (x, y) => x - y,
    );
    const column = (id: string) => columns.indexOf(layout.positions[id]?.x ?? -1);
    // The URL database is reached from Redirect and Shorten; the Analytics store from the Stats
    // API and, three layers on, the Analytics worker.
    expect(column("redirect")).toBe(1);
    expect(column("shorten")).toBe(1);
    expect(column("db")).toBe(2);
    expect(column("worker")).toBe(3);
    expect(column("store")).toBe(4);
  });
});

/**
 * Tiles as `id@band` (128×128; no `@` for none, `!` for the 128×160 user); lines as
 * `source>target`, each in its source's band.
 */
function banded(tiles: string[], lines: string[]): LayoutInput {
  const parsed = tiles.map((spec) => {
    const [id = "", band] = spec.replace("!", "").split("@");
    return { id, w: 128, h: spec.startsWith("!") ? 160 : 128, ...(band && { band: Number(band) }) };
  });
  const bandOf = new Map(parsed.map((t) => [t.id, t.band]));
  return {
    tiles: parsed,
    lines: lines.map((spec) => {
      const [source = "", target = ""] = spec.split(">");
      const band = bandOf.get(source);
      return { id: `${source}-${target}`, source, target, ...(band !== undefined && { band }) };
    }),
  };
}

/** What the engine caches for a board with bands. */
async function bandsOf(input: LayoutInput, previous?: Record<string, Point>) {
  return createLayoutEngine(elk, { debounceMs: 0 }).request(input, previous);
}

/**
 * Pairs of runs from lines of different bands that lie on one line and overlap or meet end to
 * end, other than within 32px before a tile both lines enter.
 */
function sharedRuns(input: LayoutInput, layout: BoardLayout): string[] {
  const out: string[] = [];
  const runs = (id: string) => {
    const route = layout.routes[id] ?? [];
    return route.slice(0, -1).map((a, i) => [a, route[i + 1] as Point] as const);
  };
  for (const [i, a] of input.lines.entries()) {
    for (const b of input.lines.slice(i + 1)) {
      if (a.band === b.band) continue;
      const port = a.target === b.target ? rect(input, layout, a.target) : undefined;
      for (const [a1, a2] of runs(a.id)) {
        for (const [b1, b2] of runs(b.id)) {
          const level = a1.y === a2.y;
          if (level !== (b1.y === b2.y) || (level ? a1.y !== b1.y : a1.x !== b1.x)) continue;
          const at = (p: Point) => (level ? p.x : p.y);
          const lo = Math.max(Math.min(at(a1), at(a2)), Math.min(at(b1), at(b2)));
          const hi = Math.min(Math.max(at(a1), at(a2)), Math.max(at(b1), at(b2)));
          const allowed =
            port && level && a1.y === centreY(port) && lo >= port.x - JUNCTION_PX && hi <= port.x;
          if (hi >= lo && !allowed) out.push(`${a.id} and ${b.id} at ${level ? "y" : "x"} ${lo}`);
        }
      }
    }
  }
  return out;
}

describe("bands", () => {
  /* The user starts two lanes. The top lane's chain runs to `n`; the bottom lane's `r` writes
     three stores, two of which (`m`, `x`) the top lane reads too, so they are shared. */
  const lanes = banded(
    ["!u", "d@0", "p@2", "w@0", "v@0", "e@0", "k@0", "n@0", "m@1", "x@1", "q@2", "r@2", "o@2"],
    [
      "u>d",
      "u>p",
      "d>w",
      "d>v",
      "w>e",
      "e>k",
      "k>n",
      "w>m",
      "v>x",
      "p>q",
      "q>r",
      "r>m",
      "r>x",
      "r>o",
    ],
  );

  it("are used when some tile has one, every tile without one has no lines in, and nothing loops", () => {
    expect(usesBands(lanes)).toBe(true);
    expect(usesBands(tinyUrl)).toBe(false);
    expect(usesBands(banded(["a@0", "b"], ["a>b"]))).toBe(false);
    expect(usesBands(banded(["a@0", "b@0"], ["a>b", "b>a"]))).toBe(false);
    const chipped = banded(["a", "b@0"], ["a>b"]);
    expect(
      usesBands({
        ...chipped,
        lines: [{ ...(chipped.lines[0] as LayoutInput["lines"][0]), chip: ENTRY_CHIP }],
      }),
    ).toBe(false);
  });

  it("stack each band in its own rows, keep different bands' lines apart and stay on the grid", async () => {
    const layout = await bandsOf(lanes);
    expectClean(lanes, layout);
    const banded = lanes.tiles.filter((t) => t.band !== undefined);
    for (const a of banded) {
      for (const b of banded.filter((t) => (t.band ?? 0) > (a.band ?? 0))) {
        const [ra, rb] = [rect(lanes, layout, a.id), rect(lanes, layout, b.id)];
        expect(ra.y + ra.h, `${a.id} above ${b.id}`).toBeLessThanOrEqual(rb.y);
      }
    }
    expect(sharedRuns(lanes, layout)).toEqual([]);
    expect(bandClashes(layout, lanes).clashes).toBe(0);
    // Each shared tile's two lines meet within 32px of its port.
    for (const store of ["m", "x"]) {
      const into = lanes.lines.filter((l) => l.target === store);
      const starts = into.map((l) => layout.routes[l.id]?.at(-2)?.x ?? 0);
      const port = rect(lanes, layout, store).x;
      expect(Math.max(...starts), store).toBe(port - JUNCTION_PX);
    }
    // The user sits between its two lines' tiles, on the grid.
    const [u, d, p] = ["u", "d", "p"].map((id) => centreY(rect(lanes, layout, id)));
    expect(Math.abs((u ?? 0) - ((d ?? 0) + (p ?? 0)) / 2)).toBeLessThanOrEqual(16);
    expect(d).toBeLessThan(u ?? 0);
    expect(p).toBeGreaterThan(u ?? 0);
  });

  it("move only what an edit changes, and lay themselves out again unchanged", async () => {
    const first = await bandsOf(lanes);
    expect(await bandsOf(lanes, first.positions)).toEqual(first);
    const longer = {
      tiles: [...lanes.tiles, { id: "z", w: 128, h: 128, band: 0 }],
      lines: [...lanes.lines, { id: "n-z", source: "n", target: "z", band: 0 }],
    };
    const next = await bandsOf(longer, first.positions);
    expectClean(longer, next);
    for (const [id, at] of Object.entries(first.positions))
      expect(next.positions[id], id).toEqual(at);
    expect(next.positions.z?.y).toBe(first.positions.n?.y);
  });

  /* As `lanes`, but the bottom lane's worker `w` (column 3) also uses two end tiles that sit
     right after an earlier user: `o` after `p`, which writes it, and the shared `s` after `d`,
     which reads it. So `w`'s lines to them come back. */
  const back = banded(
    ["!u", "d@0", "p@2", "i@2", "c@0", "s@1", "o@2", "q@2", "w@2", "e@2", "h@2"],
    ["u>d", "u>p", "u>i", "d>c", "d>s", "p>o", "p>q", "q>w", "w>o", "w>s", "w>e", "e>h"],
  );

  it("put an end tile several tiles use next to the earliest, unless its band would grow", () => {
    const at = (input: LayoutInput) => endColumns(input, bandColumns(input) ?? new Map());
    // One user: right after it. Two users: right after the earliest (`o` after `p`, `s` after
    // `d`), the later one coming back one column.
    expect(Object.fromEntries(at(back))).toMatchObject({ c: 2, o: 2, s: 2, q: 2, w: 3, e: 4 });
    // With a second tile beside `q`, `o` there would make the bottom band taller (three rows
    // where its tallest column has two): it goes to the first column that doesn't, `w`'s own.
    const crowded = {
      tiles: [...back.tiles, { id: "r", w: 128, h: 128, band: 2 }],
      lines: [...back.lines, { id: "p-r", source: "p", target: "r", band: 2 }],
    };
    expect(at(crowded).get("o")).toBe(3);
    // A user three columns later: never more than one column before it, so `s` waits until 3.
    const far = banded(
      ["!u", "d@0", "p@2", "a@2", "b@2", "w@2", "s@1"],
      ["u>d", "u>p", "p>a", "a>b", "b>w", "d>s", "w>s"],
    );
    expect(at(far).get("w")).toBe(4);
    expect(at(far).get("s")).toBe(3);
  });

  it("route a line that comes back as a U, out of its source and into its target", async () => {
    const layout = await bandsOf(back);
    expectClean(back, layout);
    expect(sharedRuns(back, layout)).toEqual([]);
    expect(bandClashes(layout, back)).toEqual({ clashes: 0, crossings: 0 });
    for (const id of ["w-o", "w-s"]) {
      const route = layout.routes[id] ?? [];
      const [s, t] = [rect(back, layout, "w"), rect(back, layout, id.slice(2))];
      // Right 32px, up, back past both columns, and the last 32px into the target.
      expect(route).toHaveLength(6);
      expect(route[1]).toEqual({ x: s.x + s.w + GRID, y: centreY(s) });
      expect(route[4]?.x).toBe(t.x - GRID);
      expect(route[2]?.y).toBe(route[3]?.y);
      // Its level run passes between the tiles, 16px or more from each.
      const y = route[2]?.y ?? 0;
      for (const tile of back.tiles) {
        const r = rect(back, layout, tile.id);
        if (r.x + r.w < (route[4]?.x ?? 0) || r.x > (route[1]?.x ?? 0)) continue;
        expect(y <= r.y - 16 || y >= r.y + r.h + 16, `${id} by ${tile.id}`).toBe(true);
      }
    }
    // The store's two lines meet only in the 32px before it.
    expect(layout.routes["d-s"]?.at(-2)?.x).toBe(rect(back, layout, "s").x - 2 * GRID);
    expect(await bandsOf(back, layout.positions)).toEqual(layout);
  });

  it("widen a gap for a line that comes back only where the bands stay apart", async () => {
    // The shared store `s` is read by `r` (top lane) and written by `w` (bottom lane), whose lines
    // meet in the 32px before it; the worker `k`, after `w`'s queue, comes back to it. Widening
    // the gap before `s` for `k`'s U would stretch that meeting to 64px.
    const input = banded(
      ["!u", "d@0", "p@2", "r@0", "w@2", "q@2", "k@2", "s@1"],
      ["u>d", "u>p", "d>r", "p>w", "r>s", "w>s", "w>q", "q>k", "k>s"],
    );
    const layout = await bandsOf(input);
    expectClean(input, layout);
    expect(sharedRuns(input, layout)).toEqual([]);
    expect(bandClashes(layout, input).clashes).toBe(0);
    const route = layout.routes["k-s"] ?? [];
    expect(route.some((p, i) => i > 0 && p.x < (route[i - 1] as Point).x)).toBe(true);
    expect(await bandsOf(input, layout.positions)).toEqual(layout);
  });

  it("move a bus next to a shared tile so different bands meet only by its port", () => {
    // `a` (band 0, above) and `b` (band 2, below) both enter `s`; ELK left both buses more than
    // 32px from it, so their last runs share 64px.
    const input = banded(["a@0", "b@2", "s@1"], ["a>s", "b>s"]);
    const layout: BoardLayout = {
      key: "k",
      positions: { a: { x: 32, y: 32 }, b: { x: 32, y: 352 }, s: { x: 448, y: 192 } },
      routes: {
        "a-s": [
          { x: 160, y: 96 },
          { x: 384, y: 96 },
          { x: 384, y: 256 },
          { x: 448, y: 256 },
        ],
        "b-s": [
          { x: 160, y: 416 },
          { x: 352, y: 416 },
          { x: 352, y: 256 },
          { x: 448, y: 256 },
        ],
      },
      chips: {},
      bounds: { x: 0, y: 0, w: 608, h: 512 },
    };
    expect(bandClashes(layout, input).clashes).toBe(1);
    const column = new Map([
      ["a", 0],
      ["b", 0],
      ["s", 1],
    ]);
    const met = meetAtPorts(layout, input, column);
    expect(bandClashes(met, input)).toEqual({ clashes: 0, crossings: 0 });
    expect(met.routes["b-s"]?.[1]).toEqual({ x: 416, y: 416 });
    expect(met.routes["a-s"]).toEqual(layout.routes["a-s"]);
  });
});

describe("layout engine", () => {
  it("serves a cached layout synchronously and rejects a superseded request", async () => {
    const layout = vi.fn((graph: Parameters<typeof elk.layout>[0]) => elk.layout(graph));
    const engine = createLayoutEngine({ layout }, { debounceMs: 10 });
    const chain = board(["actor:128x160", "a"], ["actor>a*"]);

    const first = await engine.request(chain);
    expect(engine.get(engine.keyFor(chain))).toBe(first);
    expect(await engine.request(chain)).toBe(first);
    expect(layout).toHaveBeenCalledTimes(1);

    const longer = board(["actor:128x160", "a", "b"], ["actor>a*", "a>b"]);
    const superseded = engine.request(longer);
    const latest = engine.request(tinyUrl, first.positions);
    await expect(superseded).rejects.toBeInstanceOf(LayoutSuperseded);
    expect((await latest).key).toBe(engine.keyFor(tinyUrl));
    expect(layout).toHaveBeenCalledTimes(2);
  });
});

/**
 * Named ports: the 256×160 hub's three out ports at 64/96/128 go to three tiles, and the sink
 * takes two of them at named in ports (32 and 160) and the third at its default port (96). The
 * start's line into the hub enters at the hub's named port 32. Half of 160 is off the grid, so
 * only the hub's top on the grid puts its ports on grid lines.
 */
const ported: LayoutInput = {
  tiles: [
    { id: "start", w: 128, h: 128 },
    {
      id: "hub",
      w: 256,
      h: 160,
      ports: [
        { id: "head", side: "in", y: 32 },
        { id: "first", side: "out", y: 64 },
        { id: "second", side: "out", y: 96 },
        { id: "third", side: "out", y: 128 },
      ],
    },
    { id: "a", w: 128, h: 128 },
    { id: "b", w: 128, h: 128 },
    { id: "c", w: 128, h: 128 },
    {
      id: "sink",
      w: 128,
      h: 192,
      ports: [
        { id: "top", side: "in", y: 32 },
        { id: "bottom", side: "in", y: 160 },
      ],
    },
  ],
  lines: [
    { id: "start-hub", source: "start", target: "hub", targetPort: "head" },
    { id: "hub-a", source: "hub", target: "a", sourcePort: "first" },
    { id: "hub-b", source: "hub", target: "b", sourcePort: "second" },
    { id: "hub-c", source: "hub", target: "c", sourcePort: "third" },
    { id: "a-sink", source: "a", target: "sink", targetPort: "top" },
    { id: "b-sink", source: "b", target: "sink" },
    { id: "c-sink", source: "c", target: "sink", targetPort: "bottom" },
  ],
};

/** A line's two ends where its ports are: named, or mid-height. */
function ends(input: LayoutInput, layout: BoardLayout, line: LayoutLine): [Point, Point] {
  const [s, t] = [rect(input, layout, line.source), rect(input, layout, line.target)];
  const tile = (id: string) => input.tiles.find((x) => x.id === id);
  return [
    { x: s.x + s.w, y: s.y + portOffset(tile(line.source), line.sourcePort) },
    { x: t.x, y: t.y + portOffset(tile(line.target), line.targetPort) },
  ];
}

describe("named ports", () => {
  it("give a board without them the ELK graph and key it had before ports", () => {
    // Golden from the commit before ports: a user with a chip, a fork, a merge, bands, and the
    // same board with shown positions (one new tile hinted beside its source).
    const input: LayoutInput = {
      tiles: [
        { id: "user", w: 128, h: 160 },
        { id: "api", w: 128, h: 128, band: 0 },
        { id: "db", w: 128, h: 128, band: 0 },
        { id: "events", w: 128, h: 96, band: 1 },
        { id: "worker", w: 128, h: 128, band: 1 },
      ],
      lines: [
        { id: "user-api", source: "user", target: "api", chip: { w: 32, h: 32 } },
        { id: "api-db", source: "api", target: "db", band: 0 },
        { id: "api-events", source: "api", target: "events", band: 1 },
        { id: "events-worker", source: "events", target: "worker", band: 1 },
        { id: "worker-db", source: "worker", target: "db", band: 1 },
      ],
    };
    const shown = {
      user: { x: 32, y: 48 },
      api: { x: 224, y: 64 },
      db: { x: 416, y: 64 },
      events: { x: 416, y: 224 },
    };
    expect(
      JSON.stringify({
        key: graphKey(input),
        first: buildElkGraph(input),
        shown: buildElkGraph(input, shown),
      }),
    ).toBe(JSON.stringify(noPortsGolden));
    // An empty port list is no ports; a port's height is part of the key.
    const empty = { ...input, tiles: input.tiles.map((t) => ({ ...t, ports: [] })) };
    expect(graphKey(empty)).toBe(graphKey(input));
    const moved = structuredClone(ported);
    const first = moved.tiles[1]?.ports?.[1];
    if (first) first.y = 32;
    expect(graphKey(moved)).not.toBe(graphKey(ported));
  });

  it("start and end each line at its port, on the grid, orthogonal and clear of every tile", async () => {
    const layout = await createLayoutEngine(elk, { debounceMs: 0 }).request(ported);
    const rects = ported.tiles.map((t) => rect(ported, layout, t.id));
    for (const [i, a] of rects.entries()) {
      expect(a.x % GRID, `${ported.tiles[i]?.id} x`).toBe(0);
      for (const b of rects.slice(i + 1)) expect(intersects(a, b)).toBe(false);
    }
    for (const line of ported.lines) {
      const route = layout.routes[line.id] ?? [];
      const [from, to] = ends(ported, layout, line);
      expect(route.at(0), `${line.id} start`).toEqual(from);
      expect(route.at(-1), `${line.id} end`).toEqual(to);
      expect(from.y % GRID, `${line.id} source port`).toBe(0);
      expect(to.y % GRID, `${line.id} target port`).toBe(0);
      // The last run enters the port level from the left, so the arrowhead sits on it.
      const before = route.at(-2) as Point;
      expect(before.y === to.y && before.x < to.x, `${line.id} arrives level`).toBe(true);
      for (const [j, a] of route.slice(0, -1).entries()) {
        const b = route[j + 1] as Point;
        expect(a.x === b.x || a.y === b.y, `${line.id} has a diagonal`).toBe(true);
        const run = {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          w: Math.abs(b.x - a.x),
          h: Math.abs(b.y - a.y),
        };
        for (const r of rects) {
          const through =
            run.x < r.x + r.w && run.x + run.w > r.x && run.y < r.y + r.h && run.y + run.h > r.y;
          expect(through, `${line.id} through a tile at ${r.x},${r.y}`).toBe(false);
        }
      }
    }
    // The hub follows the start's default port with its named one, so that line is straight.
    expect(layout.routes["start-hub"]).toHaveLength(2);
    // Laid out again from what was shown, nothing moves.
    expect(
      await createLayoutEngine(elk, { debounceMs: 0 }).request(ported, layout.positions),
    ).toEqual(layout);
  });

  it("reject a port name that is unknown or on the wrong side, and a port off the grid", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const request = (input: LayoutInput) =>
      createLayoutEngine(elk, { debounceMs: 0 }).request(input);
    const withLine = (line: Partial<LayoutLine>) => ({
      ...ported,
      lines: ported.lines.map((l) => (l.id === "hub-a" ? { ...l, ...line } : l)),
    });
    await expect(request(withLine({ sourcePort: "missing" }))).rejects.toThrow(
      "Line hub-a names port missing, which is not an out port of hub.",
    );
    await expect(request(withLine({ sourcePort: "head" }))).rejects.toThrow(
      "not an out port of hub",
    );
    await expect(request(withLine({ targetPort: "first" }))).rejects.toThrow("not an in port of a");
    const offGrid = structuredClone(ported);
    offGrid.tiles[5] = { id: "sink", w: 128, h: 192, ports: [{ id: "top", side: "in", y: 48 }] };
    await expect(request(offGrid)).rejects.toThrow("must be a multiple of 32");
    // In bands too.
    const banded = withLine({ sourcePort: "missing" });
    banded.tiles = banded.tiles.map((t) => ({ ...t, band: 0 }));
    banded.lines = banded.lines.map((l) => ({ ...l, band: 0 }));
    expect(usesBands(banded)).toBe(true);
    await expect(request(banded)).rejects.toThrow("Line hub-a names port missing");
    vi.restoreAllMocks();
  });
});

/**
 * Named ports in bands, shaped like a detailed view: the upload band's `hub` (256×160) has a
 * header row (in and out ports at 32) and module rows at 64 (in), 96 and 128 (out). Its writer
 * and outbox rows both write `meta`, a store only it uses; the outbox also feeds `pub`; its
 * header writes `db`, the shared store `watch` reads, which sits right after `watch` so the hub's
 * line comes back. `watch` (download band) enters the hub's header from another band, and
 * `events` enters its consumer row.
 */
const detailed: LayoutInput = {
  tiles: [
    { id: "u", w: 128, h: 160 },
    { id: "watch", w: 128, h: 128, band: 0 },
    { id: "upload", w: 128, h: 128, band: 2 },
    { id: "db", w: 128, h: 128, band: 1 },
    { id: "events", w: 128, h: 128, band: 2 },
    {
      id: "hub",
      w: 256,
      h: 160,
      band: 2,
      ports: [
        { id: "header-in", side: "in", y: 32 },
        { id: "consumer", side: "in", y: 64 },
        { id: "header-out", side: "out", y: 32 },
        { id: "writer", side: "out", y: 96 },
        { id: "outbox", side: "out", y: 128 },
      ],
    },
    { id: "meta", w: 128, h: 128, band: 2 },
    { id: "pub", w: 128, h: 128, band: 2 },
    { id: "indexer", w: 128, h: 128, band: 2 },
  ],
  lines: [
    { id: "u-watch", source: "u", target: "watch" },
    { id: "u-upload", source: "u", target: "upload" },
    { id: "watch-db", source: "watch", target: "db", band: 0 },
    { id: "watch-hub", source: "watch", target: "hub", band: 0, targetPort: "header-in" },
    { id: "upload-events", source: "upload", target: "events", band: 2 },
    { id: "events-hub", source: "events", target: "hub", band: 2, targetPort: "consumer" },
    { id: "hub-db", source: "hub", target: "db", band: 2, sourcePort: "header-out" },
    { id: "hub-meta-w", source: "hub", target: "meta", band: 2, sourcePort: "writer" },
    { id: "hub-meta-o", source: "hub", target: "meta", band: 2, sourcePort: "outbox" },
    { id: "hub-pub", source: "hub", target: "pub", band: 2, sourcePort: "outbox" },
    { id: "pub-indexer", source: "pub", target: "indexer", band: 2 },
  ],
};

type Run = [Point, Point];
const runsOf = (layout: BoardLayout, id: string): Run[] => {
  const route = layout.routes[id] ?? [];
  return route.slice(0, -1).map((a, i) => [a, route[i + 1] as Point]);
};
const portKey = (tile: string, port: string | undefined) => `${tile}:${port ?? ""}`;

/**
 * Where two lines meet (share a run, touch, or cross) outside the last `JUNCTION_PX` before their
 * shared target port, as text. `[]` when they meet only there.
 */
function meetingsAway(input: LayoutInput, layout: BoardLayout, a: LayoutLine, b: LayoutLine) {
  const [, port] = ends(input, layout, a);
  const inWindow = (p: Point) => p.y === port.y && p.x >= port.x - JUNCTION_PX && p.x <= port.x;
  const out: string[] = [];
  for (const [a1, a2] of runsOf(layout, a.id)) {
    for (const [b1, b2] of runsOf(layout, b.id)) {
      const [aLevel, bLevel] = [a1.y === a2.y, b1.y === b2.y];
      if (aLevel === bLevel) {
        if (aLevel ? a1.y !== b1.y : a1.x !== b1.x) continue;
        const at = (p: Point) => (aLevel ? p.x : p.y);
        const lo = Math.max(Math.min(at(a1), at(a2)), Math.min(at(b1), at(b2)));
        const hi = Math.min(Math.max(at(a1), at(a2)), Math.max(at(b1), at(b2)));
        if (hi < lo) continue;
        const [from, to] = aLevel
          ? [
              { x: lo, y: a1.y },
              { x: hi, y: a1.y },
            ]
          : [
              { x: a1.x, y: lo },
              { x: a1.x, y: hi },
            ];
        if (!inWindow(from) || !inWindow(to)) out.push(`run ${from.x},${from.y}–${to.x},${to.y}`);
        continue;
      }
      const [h1, h2, v1, v2] = aLevel ? [a1, a2, b1, b2] : [b1, b2, a1, a2];
      const p = { x: v1.x, y: h1.y };
      const onH = p.x >= Math.min(h1.x, h2.x) && p.x <= Math.max(h1.x, h2.x);
      const onV = p.y >= Math.min(v1.y, v2.y) && p.y <= Math.max(v1.y, v2.y);
      if (onH && onV && !inWindow(p)) out.push(`point ${p.x},${p.y}`);
    }
  }
  return out;
}

/** Every line starts and ends at its port, is orthogonal and passes through no tile. */
function expectPorted(input: LayoutInput, layout: BoardLayout) {
  const rects = input.tiles.map((t) => rect(input, layout, t.id));
  for (const [i, a] of rects.entries()) {
    expect(a.x % GRID, `${input.tiles[i]?.id} x`).toBe(0);
    for (const b of rects.slice(i + 1)) expect(intersects(a, b)).toBe(false);
  }
  for (const line of input.lines) {
    const route = layout.routes[line.id] ?? [];
    const [from, to] = ends(input, layout, line);
    expect(route.at(0), `${line.id} start`).toEqual(from);
    expect(route.at(-1), `${line.id} end`).toEqual(to);
    expect(from.y % GRID, `${line.id} source port`).toBe(0);
    expect(to.y % GRID, `${line.id} target port`).toBe(0);
    for (const [a, b] of runsOf(layout, line.id)) {
      expect(a.x === b.x || a.y === b.y, `${line.id} has a diagonal`).toBe(true);
      const run = {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x),
        h: Math.abs(b.y - a.y),
      };
      for (const r of rects) {
        const through =
          run.x < r.x + r.w && run.x + run.w > r.x && run.y < r.y + r.h && run.y + run.h > r.y;
        expect(through, `${line.id} through a tile at ${r.x},${r.y}`).toBe(false);
      }
    }
  }
}

/**
 * Bends off the grid. A level run that passes between two tiles 32px apart in a column keeps
 * 16px from both, half a grid step off (the rule `bands.ts` and `returns.ts` already follow, as
 * the studies show); any other bend off the grid is listed.
 */
function bendsOffGrid(input: LayoutInput, layout: BoardLayout): string[] {
  const rects = input.tiles.map((t) => rect(input, layout, t.id));
  const halfStep = (a: Point, b: Point) =>
    a.y === b.y &&
    rects.some(
      (r) => r.y + r.h === a.y - 16 && r.x < Math.max(a.x, b.x) && r.x + r.w > Math.min(a.x, b.x),
    ) &&
    rects.some(
      (r) => r.y === a.y + 16 && r.x < Math.max(a.x, b.x) && r.x + r.w > Math.min(a.x, b.x),
    );
  const out: string[] = [];
  for (const line of input.lines) {
    const route = layout.routes[line.id] ?? [];
    for (const [i, p] of route.slice(1, -1).entries()) {
      const [before, after] = [route[i] as Point, route[i + 2] as Point];
      const levelHalf = halfStep(before, p) || halfStep(p, after);
      if (p.x % GRID !== 0 || (p.y % GRID !== 0 && !levelHalf))
        out.push(`${line.id}@${p.x},${p.y}`);
    }
  }
  return out;
}

/** Pairs of lines into one port from different ports that meet before its last 32px. */
function earlyMeetings(input: LayoutInput, layout: BoardLayout): string[] {
  const out: string[] = [];
  for (const [i, a] of input.lines.entries()) {
    for (const b of input.lines.slice(i + 1)) {
      if (portKey(a.target, a.targetPort) !== portKey(b.target, b.targetPort)) continue;
      if (portKey(a.source, a.sourcePort) === portKey(b.source, b.sourcePort)) continue;
      for (const m of meetingsAway(input, layout, a, b)) out.push(`${a.id} and ${b.id}: ${m}`);
    }
  }
  return out;
}

describe("named ports in bands", () => {
  it("route a detailed board from port to port, on the grid and clear of every tile", async () => {
    expect(usesBands(detailed)).toBe(true);
    const layout = await bandsOf(detailed);
    expectPorted(detailed, layout);
    expect(bendsOffGrid(detailed, layout)).toEqual([]);
    expect(bandClashes(layout, detailed).clashes).toBe(0);
    // Every band in its own rows.
    const [db, hub] = [rect(detailed, layout, "db"), rect(detailed, layout, "hub")];
    expect(rect(detailed, layout, "watch").y + 128).toBeLessThanOrEqual(db.y);
    expect(db.y + db.h).toBeLessThanOrEqual(hub.y);
    // The hub's top is on the grid, so its rows are; half its height is not.
    expect(hub.y % GRID).toBe(0);
    // The writer's and the outbox's lines into `meta`, and the download and upload lines into
    // `db`, meet only in the last 32px before the port they share.
    expect(earlyMeetings(detailed, layout)).toEqual([]);
    expect(layout.routes["hub-meta-o"]?.at(-2)?.x).toBe(rect(detailed, layout, "meta").x - GRID);
    // The header's line comes back to `db` as a U that leaves at the header's height.
    const back = layout.routes["hub-db"] ?? [];
    expect(back).toHaveLength(6);
    expect(back[0]).toEqual({ x: hub.x + hub.w, y: hub.y + 32 });
    expect(back[1]).toEqual({ x: hub.x + hub.w + GRID, y: hub.y + 32 });
    expect(back[4]?.x).toBe(db.x - GRID);
    // Its level run is the one bend off the grid: halfway across the 32px between the bands.
    expect(back[2]?.y).toBe(db.y + db.h + 16);
    expect(hub.y - (db.y + db.h)).toBe(GRID);
    // The other band's line enters the header, its own band's the consumer row: no junction.
    expect(layout.routes["watch-hub"]?.at(-1)).toEqual({ x: hub.x, y: hub.y + 32 });
    expect(layout.routes["events-hub"]?.at(-1)).toEqual({ x: hub.x, y: hub.y + 64 });
    // The user sits between the ports its lines enter.
    const u = rect(detailed, layout, "u");
    const watch = rect(detailed, layout, "watch");
    const upload = rect(detailed, layout, "upload");
    expect(u.y + u.h / 2).toBe((watch.y + watch.h / 2 + upload.y + upload.h / 2) / 2);
    // Laid out again from what was shown, nothing moves.
    expect(await bandsOf(detailed, layout.positions)).toEqual(layout);
  });

  it("meet two bands at one named port, and two rows below their store, only by the port", async () => {
    // A named port is not split per band: the upload band's line into the header meets the
    // download band's only in the last 32px before it. The hub now sits a row lower, so `meta`'s
    // port is above both the writer's and the outbox's rows: their lines turn in two slots (ELK
    // gets one port into `meta` for each) rather than sharing one stem.
    const header: LayoutInput = {
      ...detailed,
      lines: [
        ...detailed.lines,
        { id: "upload-hub", source: "upload", target: "hub", band: 2, targetPort: "header-in" },
      ],
    };
    const shared = await bandsOf(header);
    expectPorted(header, shared);
    expect(bandClashes(shared, header).clashes).toBe(0);
    expect(earlyMeetings(header, shared)).toEqual([]);
    const [hub, meta] = [rect(header, shared, "hub"), rect(header, shared, "meta")];
    expect(meta.y + meta.h / 2).toBeLessThan(hub.y + 96);
    const turns = ["hub-meta-w", "hub-meta-o"].map((id) => shared.routes[id]?.at(-2)?.x);
    expect(turns).toEqual([meta.x - 2 * GRID, meta.x - GRID]);
    expect(await bandsOf(header, shared.positions)).toEqual(shared);
  });

  it("route two returns from different ports of one tile from their own rows", async () => {
    // The writer's row comes back to `db` too (as two rows of v2's completion handler do).
    const returns: LayoutInput = {
      ...detailed,
      lines: [
        ...detailed.lines,
        { id: "hub-db-w", source: "hub", target: "db", band: 2, sourcePort: "writer" },
      ],
    };
    const both = await bandsOf(returns);
    expectPorted(returns, both);
    expect(bandClashes(both, returns).clashes).toBe(0);
    const hub = rect(returns, both, "hub");
    for (const [id, y] of [
      ["hub-db", 32],
      ["hub-db-w", 96],
    ] as const) {
      const route = both.routes[id] ?? [];
      expect(route[0], id).toEqual({ x: hub.x + hub.w, y: hub.y + y });
      expect(route[1]?.y, id).toBe(hub.y + y);
    }
    // Known limit: the two U's share no run, but cross twice. `routeReturns` routes them one at a
    // time: the header's takes the gap's one slot and the row between the bands, and the
    // widening for the writer's puts the new slot on the hub's side, so the writer's goes up
    // through the header's. Nesting them would need another widening rule.
    const early = earlyMeetings(returns, both);
    expect(early).toHaveLength(2);
    for (const m of early) expect(m).toMatch(/^hub-db and hub-db-w: point /);
    expect(await bandsOf(returns, both.positions)).toEqual(both);
  });
});

describe("dockHint", () => {
  it("takes the next free column on the source's row", () => {
    const source = { x: 32, y: 32, w: 128, h: 128 };
    const size = { w: 128, h: 128 };
    expect(dockHint(source, size, 0, [source])).toEqual({ x: 224, y: 32 });
    const taken = { x: 224, y: 32, w: 128, h: 128 };
    expect(dockHint(source, size, 1, [source, taken])).toEqual({ x: 416, y: 32 });
    expect(dockHint(source, size, 0, [source], "before")).toEqual({ x: -160, y: 32 });
  });
});

describe("newTileHint", () => {
  // The user with a download entry above an upload entry, as ELK lays them out.
  const actor = { x: 32, y: 80, w: 128, h: 160 };
  const download = { x: 224, y: 0, w: 128, h: 128 };
  const upload = { x: 224, y: 160, w: 128, h: 128 };
  const size = { w: 128, h: 128 };

  it("puts a new lane tile next to its lane's last tile, so the lanes keep their order", () => {
    // Below the last upload tile the slot is free: the tile shows there straight away.
    expect(
      newTileHint(actor, size, 2, [actor, download, upload], "after", {
        rect: upload,
        place: "after",
      }),
    ).toEqual({ at: { x: 224, y: 320 }, show: true });
    // Below the last download tile sits the upload lane: the hint only orders the new tile
    // between them, and it waits for ELK unseen.
    const between = newTileHint(actor, size, 2, [actor, download, upload], "after", {
      rect: download,
      place: "after",
    });
    expect(between.show).toBe(false);
    expect(between.at.y).toBeGreaterThan(download.y);
    expect(between.at.y).toBeLessThan(upload.y);
    // Without a neighbour it docks beside its source (`dockHint`).
    expect(newTileHint(download, size, 0, [actor, download, upload], "after")).toEqual({
      at: dockHint(download, size, 0, [actor, download, upload]),
      show: true,
    });
  });
});

// Ported from automation-illustrator src/board/layout/elkLayout.test.ts, layoutEngine.test.ts,
// layoutStability.test.ts and tileMetrics.test.ts (0803c4a). Real ELK (the bundled build) on
// the main thread, except where the engine's call count matters.
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it, vi } from "vitest";
import { alignLayout } from "./align.ts";
import { BAND_OPTIONS, bandColumns, endColumns, ROUTE_OPTIONS, usesBands } from "./bands.ts";
import { buildElkGraph, graphKey, type LayoutInput, usedOptionIds } from "./elkGraph.ts";
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

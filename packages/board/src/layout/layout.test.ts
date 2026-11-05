// Ported from automation-illustrator src/board/layout/elkLayout.test.ts, layoutEngine.test.ts,
// layoutStability.test.ts and tileMetrics.test.ts (0803c4a). Real ELK (the bundled build) on
// the main thread, except where the engine's call count matters.
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it, vi } from "vitest";
import { buildElkGraph, graphKey, type LayoutInput, usedOptionIds } from "./elkGraph.ts";
import { type BoardLayout, toBoardLayout } from "./elkLayout.ts";
import { createLayoutEngine, LayoutSuperseded } from "./engine.ts";
import { dockHint, newTileHint, type Point, type Rect } from "./metrics.ts";

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

async function layoutOf(input: LayoutInput, previous?: Record<string, Point>) {
  return toBoardLayout(graphKey(input), await elk.layout(buildElkGraph(input, previous)));
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

/** Tiles do not overlap; routes are orthogonal, start and end at the mid-height ports; chips sit
 * on their own line and clear every tile. */
function expectClean(input: LayoutInput, layout: BoardLayout) {
  const rects = input.tiles.map((t) => rect(input, layout, t.id));
  for (const [i, a] of rects.entries()) {
    expect(Number.isInteger(a.x) && Number.isInteger(a.y)).toBe(true);
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

/** TinyURL in lanes (plan §4): 10 tiles, 11 lines, entry chips on the actor's two lines. */
const tinyUrl = board(
  [
    "actor:128x160",
    "cdn",
    "redirect",
    "cache",
    "db",
    "events",
    "worker",
    "store",
    "shorten",
    "rep",
  ],
  [
    "actor>cdn*",
    "actor>shorten*",
    "cdn>redirect",
    "redirect>cache",
    "redirect>db",
    "redirect>events",
    "events>worker",
    "worker>store",
    "shorten>db",
    "shorten>cache",
    "shorten>rep",
  ],
);

describe("ELK layout", () => {
  it("gives identical output for the same input, using only options ELK knows", async () => {
    const known = new Set(
      (await elk.knownLayoutOptions()).map((o) =>
        (o.id ?? "").replace(/^org\.eclipse\.elk\./, "elk."),
      ),
    );
    for (const id of usedOptionIds()) expect(known.has(id), id).toBe(true);

    const a = await layoutOf(tinyUrl);
    const b = await layoutOf(structuredClone(tinyUrl));
    expect(b).toEqual(a);
    expectClean(tinyUrl, a);
    // Download is the actor's first line, so its tiles sit above the upload lane's.
    expect(a.positions.cdn?.y).toBeLessThan(a.positions.shorten?.y ?? 0);
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
    expect(Math.abs((p ?? 0) - ((a ?? 0) + (b ?? 0)) / 2)).toBeLessThanOrEqual(1);
    expect(a).toBeLessThan(b ?? 0);

    // Shown the other way round (say, after a drop), the fork keeps that order.
    const swapped = { ...first.positions };
    [swapped.a, swapped.b] = [first.positions.b as Point, first.positions.a as Point];
    const again = await layoutOf(fork, swapped);
    expect(again.positions.b?.y).toBeLessThan(again.positions.a?.y ?? 0);
    expect(centreY(rect(fork, again, "p"))).toBe(p);
  });

  it("puts a merge one layer after its deepest source", async () => {
    const layout = await layoutOf(tinyUrl);
    const columns = [...new Set(Object.values(layout.positions).map((p) => p.x))].sort(
      (x, y) => x - y,
    );
    const column = (id: string) => columns.indexOf(layout.positions[id]?.x ?? -1);
    // Cache and Links database are reached from Redirect (after CDN) and from Shorten API.
    expect(column("redirect")).toBe(2);
    expect(column("shorten")).toBeLessThanOrEqual(column("redirect"));
    expect(column("cache")).toBe(3);
    expect(column("db")).toBe(3);
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

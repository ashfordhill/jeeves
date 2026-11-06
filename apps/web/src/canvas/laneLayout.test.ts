// The lane bands on the three studies, with real ELK (the bundled build) through the board's
// layout engine and the canvas's own layout input.
import {
  type BoardLayout,
  createLayoutEngine,
  GRID,
  type LayoutInput,
  type Point,
} from "@jeeves/board";
import {
  type DesignDocument,
  LANE_ACTOR,
  laneActionNode,
  laneGraph,
  studioArchitectureExample,
} from "@jeeves/spec";
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import { laneLayoutInput } from "./laneLayout.ts";

const elk = new ELK();
const layoutOf = (input: LayoutInput, previous?: Record<string, Point>) =>
  createLayoutEngine(elk, { debounceMs: 0 }).request(input, previous);

type Box = { x: number; y: number; w: number; h: number };
function box(input: LayoutInput, layout: BoardLayout, id: string): Box {
  const tile = input.tiles.find((t) => t.id === id);
  const at = layout.positions[id];
  if (!tile || !at) throw new Error(`no tile ${id}`);
  return { ...at, w: tile.w, h: tile.h };
}
const mid = (b: Box) => b.y + b.h / 2;

function runs(layout: BoardLayout, line: string): [Point, Point][] {
  const route = layout.routes[line] ?? [];
  return route.slice(0, -1).map((a, i) => [a, route[i + 1] as Point]);
}

/**
 * Where two lines lie on one line and overlap or meet end to end, as `[from, to]` along it, less
 * the 32px before a tile both enter (`allowance`).
 */
function overlaps(
  input: LayoutInput,
  layout: BoardLayout,
  a: string,
  b: string,
  allowance: number,
): string[] {
  const [la, lb] = [a, b].map((id) => input.lines.find((l) => l.id === id));
  const port = la && lb && la.target === lb.target ? box(input, layout, la.target) : undefined;
  const out: string[] = [];
  for (const [a1, a2] of runs(layout, a)) {
    for (const [b1, b2] of runs(layout, b)) {
      const level = a1.y === a2.y;
      if (level !== (b1.y === b2.y) || (level ? a1.y !== b1.y : a1.x !== b1.x)) continue;
      const at = (p: Point) => (level ? p.x : p.y);
      const lo = Math.max(Math.min(at(a1), at(a2)), Math.min(at(b1), at(b2)));
      const hi = Math.min(Math.max(at(a1), at(a2)), Math.max(at(b1), at(b2)));
      if (hi < lo) continue;
      const nearPort = port && level && a1.y === mid(port) && lo >= port.x - allowance;
      if (!(nearPort && hi <= port.x))
        out.push(`${a} and ${b} at ${level ? "y" : "x"} ${lo}–${hi}`);
    }
  }
  return out;
}

/** Proper crossings: a level run and an upright run crossing inside both. */
function crossings(input: LayoutInput, layout: BoardLayout): number {
  let n = 0;
  for (const [i, a] of input.lines.entries()) {
    for (const b of input.lines.slice(i + 1)) {
      for (const [a1, a2] of runs(layout, a.id)) {
        for (const [b1, b2] of runs(layout, b.id)) {
          if ((a1.y === a2.y) === (b1.y === b2.y)) continue;
          const [h1, h2, v1, v2] = a1.y === a2.y ? [a1, a2, b1, b2] : [b1, b2, a1, a2];
          const inH = v1.x > Math.min(h1.x, h2.x) && v1.x < Math.max(h1.x, h2.x);
          if (inH && h1.y > Math.min(v1.y, v2.y) && h1.y < Math.max(v1.y, v2.y)) n++;
        }
      }
    }
  }
  return n;
}

const studies: [string, number][] = [
  ["studio-tinyurl", 0],
  ["studio-marketplace", 1],
  ["studio-youtube", 3],
];

describe("lane bands on the studies", () => {
  for (const [id, crossed] of studies) {
    it(`${id}: every tile in its band's rows, the lanes' lines apart, on the grid`, async () => {
      const design: DesignDocument = studioArchitectureExample(id).design;
      const input = laneLayoutInput(laneGraph(design));
      const layout = await layoutOf(input);

      // Bands: download (0) above shared (1) above upload (2), tile by tile.
      const banded = input.tiles.filter((t) => t.band !== undefined);
      for (const a of banded) {
        for (const b of banded.filter((t) => (t.band ?? 0) > (a.band ?? 0))) {
          const [ra, rb] = [box(input, layout, a.id), box(input, layout, b.id)];
          expect(ra.y + ra.h, `${a.id} above ${b.id}`).toBeLessThanOrEqual(rb.y);
        }
      }
      // The user at the left, Consume above its centre and Produce below.
      const user = box(input, layout, LANE_ACTOR);
      const consume = box(input, layout, laneActionNode("download"));
      const produce = box(input, layout, laneActionNode("upload"));
      for (const t of input.tiles) expect(layout.positions[t.id]?.x).toBeGreaterThanOrEqual(user.x);
      expect(consume.y + consume.h).toBeLessThanOrEqual(mid(user));
      expect(produce.y).toBeGreaterThanOrEqual(mid(user));

      // No two lines of different bands share a run, except the 32px before a shared tile.
      const shared: string[] = [];
      for (const [i, a] of input.lines.entries()) {
        for (const b of input.lines.slice(i + 1)) {
          if (a.band !== b.band) shared.push(...overlaps(input, layout, a.id, b.id, 32));
        }
      }
      expect(shared).toEqual([]);

      // DP01's grid: tiles and ports on grid lines, routes orthogonal from port to port, no bend
      // shorter than a grid step, and no line through a tile.
      for (const t of input.tiles) {
        const b = box(input, layout, t.id);
        expect(b.x % GRID, `${t.id} x`).toBe(0);
        expect(mid(b) % GRID, `${t.id} port`).toBe(0);
      }
      for (const line of input.lines) {
        const route = layout.routes[line.id] ?? [];
        const [s, t] = [box(input, layout, line.source), box(input, layout, line.target)];
        expect(route.at(0)).toEqual({ x: s.x + s.w, y: mid(s) });
        expect(route.at(-1)).toEqual({ x: t.x, y: mid(t) });
        for (const [a, b] of runs(layout, line.id)) {
          expect(a.x === b.x || a.y === b.y, `${line.id} has a diagonal`).toBe(true);
          if (a.x === b.x)
            expect(Math.abs(b.y - a.y), `${line.id} jogs`).toBeGreaterThanOrEqual(GRID);
          for (const tile of input.tiles.filter(
            (x) => x.id !== line.source && x.id !== line.target,
          )) {
            const r = box(input, layout, tile.id);
            const [x0, x1, y0, y1] = [
              Math.min(a.x, b.x),
              Math.max(a.x, b.x),
              Math.min(a.y, b.y),
              Math.max(a.y, b.y),
            ];
            const through = x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y;
            expect(through, `${line.id} through ${tile.id}`).toBe(false);
          }
        }
      }

      // The orders chosen for the bands (see each study's entries).
      expect(crossings(input, layout)).toBe(crossed);
    });
  }

  it("keep the Video CDN's read clear of the Upload service's lines (YouTube)", async () => {
    const input = laneLayoutInput(laneGraph(studioArchitectureExample("studio-youtube").design));
    const layout = await layoutOf(input);
    const upload = input.lines.filter((l) => l.source === "upload").map((l) => l.id);
    expect(upload.length).toBe(2);
    for (const line of upload) expect(overlaps(input, layout, "cdn-encoded", line, 0)).toEqual([]);
    // It meets the Video processor's write only in the last 32px before Encoded videos.
    expect(overlaps(input, layout, "cdn-encoded", "processor-write", 32)).toEqual([]);
    expect(overlaps(input, layout, "cdn-encoded", "processor-write", 0)).not.toEqual([]);
  });

  it("move only what an edit changes, and lay out again unchanged", async () => {
    const input = laneLayoutInput(laneGraph(studioArchitectureExample("studio-youtube").design));
    const first = await layoutOf(input);
    expect(await layoutOf(input, first.positions)).toEqual(first);
    // A tile after View counts (a download store) takes its row; nothing else moves.
    const longer: LayoutInput = {
      tiles: [...input.tiles, { id: "report", w: 128, h: 128, band: 0 }],
      lines: [
        ...input.lines,
        { id: "counts-report", source: "view-counts", target: "report", band: 0 },
      ],
    };
    const next = await layoutOf(longer, first.positions);
    for (const [id, at] of Object.entries(first.positions))
      expect(next.positions[id], id).toEqual(at);
    expect(next.positions.report?.y).toBe(first.positions["view-counts"]?.y);
  });
});

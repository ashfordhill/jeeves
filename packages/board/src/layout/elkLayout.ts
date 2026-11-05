// Ported from automation-illustrator src/board/layout/elkLayout.ts and laneLayout.ts (0803c4a).
// Maps an ELK result back onto a board layout. The root is flat, so child x/y, edge sections and
// label x/y are already absolute; everything is rounded to integer pixels. A layout is derived,
// never stored.
import type { ElkNode } from "elkjs/lib/elk-api.js";
import type { Point, Rect } from "./metrics.ts";

/** Every displayed tile position, line route and chip rect for one board. */
export type BoardLayout = {
  /** The `graphKey` the layout was computed for. */
  key: string;
  /** Tile id → top-left. */
  positions: Record<string, Point>;
  /** Line id → [start, ...bends, end]. */
  routes: Record<string, Point[]>;
  /** Line id → chip rect (lines with a chip only). */
  chips: Record<string, Rect>;
  /** Root box including padding. */
  bounds: Rect;
};

/** `initial` = nothing to draw yet; `updating` = previous layout shown while ELK runs. */
export type LayoutPhase = "initial" | "updating" | "ready";

function r(n: number | undefined): number {
  return Math.round(n ?? 0);
}

export function emptyLayout(key: string): BoardLayout {
  return { key, positions: {}, routes: {}, chips: {}, bounds: { x: 0, y: 0, w: 0, h: 0 } };
}

/** Throws when ELK returned something other than one section per edge. */
export function toBoardLayout(key: string, laidOut: ElkNode): BoardLayout {
  const positions: Record<string, Point> = {};
  const routes: Record<string, Point[]> = {};
  const chips: Record<string, Rect> = {};

  for (const child of laidOut.children ?? []) {
    positions[child.id] = { x: r(child.x), y: r(child.y) };
  }

  for (const edge of laidOut.edges ?? []) {
    const sections = edge.sections ?? [];
    const s = sections[0];
    if (!s || sections.length !== 1) {
      throw new Error(`ELK returned ${sections.length} sections for line ${edge.id}; expected 1.`);
    }
    const points: Point[] = [
      { x: r(s.startPoint.x), y: r(s.startPoint.y) },
      ...(s.bendPoints ?? []).map((p) => ({ x: r(p.x), y: r(p.y) })),
      { x: r(s.endPoint.x), y: r(s.endPoint.y) },
    ];
    routes[edge.id] = dedupe(points);
    const chip = edge.labels?.[0];
    if (chip?.width && chip.height) {
      chips[edge.id] = { x: r(chip.x), y: r(chip.y), w: r(chip.width), h: r(chip.height) };
    }
  }

  return {
    key,
    positions,
    routes,
    chips,
    bounds: { x: r(laidOut.x), y: r(laidOut.y), w: r(laidOut.width), h: r(laidOut.height) },
  };
}

function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push(p);
  }
  return out.length >= 2 ? out : points;
}

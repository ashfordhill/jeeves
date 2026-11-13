// Ported from automation-illustrator src/board/routing/polyline.ts (0803c4a).
// Line polylines: SVG output, the right-angle fallback for a line ELK has not routed yet,
// interpolation for layout motion, and dash segments whose phase is locked to the world.
//
// Changes from automation-illustrator: horizontal only, no restitch-preview dash, no route keys
// or SVG dash phase helper, and the "dotted" choice dash is the board's dashed (asynchronous) line.
import { GRID, type Point } from "./metrics.ts";

/** Right-angle fallback for a line that has no ELK route yet. */
export function orthogonalPolyline(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): Point[] {
  const sx = Math.round(sourceX);
  const sy = Math.round(sourceY);
  const tx = Math.round(targetX);
  const ty = Math.round(targetY);
  if (Math.abs(sy - ty) < GRID) {
    const y = Math.round((sy + ty) / 2);
    return [
      { x: sx, y },
      { x: tx, y },
    ];
  }
  const midX = sx + Math.max(GRID, Math.round((tx - sx) / 2));
  return [
    { x: sx, y: sy },
    { x: midX, y: sy },
    { x: midX, y: ty },
    { x: tx, y: ty },
  ];
}

export function polylineToSvg(points: readonly Point[]): string {
  const first = points[0];
  if (!first) return "";
  let d = `M ${round(first.x)} ${round(first.y)}`;
  for (const p of points.slice(1)) d += ` L ${round(p.x)} ${round(p.y)}`;
  return d;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Consecutive point pairs. */
function segments(points: readonly Point[]): [Point, Point][] {
  const out: [Point, Point][] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    out.push([points[i] as Point, points[i + 1] as Point]);
  }
  return out;
}

export function pathLength(points: readonly Point[]): number {
  let n = 0;
  for (const [a, b] of segments(points)) n += Math.hypot(b.x - a.x, b.y - a.y);
  return n;
}

export function pointAtLength(points: readonly Point[], dist: number): Point {
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  if (points.length === 1 || dist <= 0) return first;
  let left = dist;
  for (const [a, b] of segments(points)) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len) {
      const t = len === 0 ? 0 : left / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= len;
  }
  return points[points.length - 1] as Point;
}

export function resamplePolyline(points: readonly Point[], count: number): Point[] {
  const n = Math.max(2, count);
  const total = pathLength(points);
  if (total <= 0) return Array.from({ length: n }, () => points[0] ?? { x: 0, y: 0 });
  const out: Point[] = [];
  for (let i = 0; i < n; i++) out.push(pointAtLength(points, (total * i) / (n - 1)));
  return out;
}

export function lerpPolylines(from: readonly Point[], to: readonly Point[], t: number): Point[] {
  const samples = Math.max(from.length, to.length, 8);
  const a = resamplePolyline(from, samples);
  const b = resamplePolyline(to, samples);
  return a.map((p, i) => {
    const q = b[i] as Point;
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  });
}

/** Dashed (asynchronous) line pattern: 8px dash, 7px gap. */
export const DASH_LENGTH = 8;
export const DASH_GAP = 7;
export const DASH_PERIOD = DASH_LENGTH + DASH_GAP;

export type DrawSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashOffset: number;
};

function mod(n: number, period: number): number {
  return ((n % period) + period) % period;
}

/**
 * Splits an orthogonal polyline into axis-aligned segments whose dash phase is locked to world X
 * (horizontal runs) or Y (vertical runs). Shared trunks then keep the same gaps instead of
 * stacking out of phase into a fake solid stroke.
 */
export function polylineDrawSegments(points: readonly Point[], period: number): DrawSegment[] {
  const out: DrawSegment[] = [];
  for (const [a, b] of segments(points)) {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) continue;
    if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
      const [left, right] = a.x <= b.x ? [a, b] : [b, a];
      out.push({
        x1: left.x,
        y1: left.y,
        x2: right.x,
        y2: right.y,
        dashOffset: -mod(left.x, period),
      });
    } else {
      const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
      out.push({
        x1: top.x,
        y1: top.y,
        x2: bottom.x,
        y2: bottom.y,
        dashOffset: -mod(top.y, period),
      });
    }
  }
  return out;
}

/** Shorter free runs than this don't count as a line's own stretch. */
const OWN_STRETCH_MIN = 8;

/**
 * The middle of the longest straight run of `points` that no polyline in `others` runs along
 * (crossings don't count, only shared runs), or undefined when every run of at least 8px is
 * shared: on a shared bus, a place on a stretch that is the line's alone.
 */
export function ownStretchMidpoint(
  points: readonly Point[],
  others: readonly (readonly Point[])[],
): Point | undefined {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  let best: { length: number; at: Point } | undefined;
  for (const [a, b] of segments(points)) {
    const horizontal = near(a.y, b.y);
    if (!horizontal && !near(a.x, b.x)) continue;
    // Along the run: its span on the moving axis and its fixed coordinate on the other.
    const along = (p: Point) => (horizontal ? p.x : p.y);
    const across = (p: Point) => (horizontal ? p.y : p.x);
    const lo = Math.min(along(a), along(b));
    const hi = Math.max(along(a), along(b));
    const shared: [number, number][] = [];
    for (const other of others) {
      for (const [c, d] of segments(other)) {
        if (!near(across(c), across(d)) || !near(across(c), across(a))) continue;
        const start = Math.max(lo, Math.min(along(c), along(d)));
        const end = Math.min(hi, Math.max(along(c), along(d)));
        if (end - start > 0.5) shared.push([start, end]);
      }
    }
    shared.sort((p, q) => p[0] - q[0]);
    const free: [number, number][] = [];
    let cursor = lo;
    for (const [start, end] of shared) {
      if (start > cursor) free.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (hi > cursor) free.push([cursor, hi]);
    for (const [start, end] of free) {
      const length = end - start;
      if (length < OWN_STRETCH_MIN || (best && length <= best.length)) continue;
      const mid = (start + end) / 2;
      best = {
        length,
        at: horizontal ? { x: mid, y: across(a) } : { x: across(a), y: mid },
      };
    }
  }
  return best?.at;
}

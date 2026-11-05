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

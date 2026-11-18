import type { Point } from "../layout/metrics.ts";
import { distanceToRoute } from "./lineGeometry.ts";

/**
 * Flatten the actual absolute M/L/C/Q artwork emitted by wireArt. Straight runs need only their
 * ends; de Casteljau subdivision bounds each curve's error to a quarter board pixel. This keeps
 * picking on the drawn fans/corners without thousands of native SVG arc-length queries per click.
 */
export function wirePolyline(d: string): Point[] {
  const points: Point[] = [];
  const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  function curve(control: Point[], depth = 0) {
    const a = control[0] as Point;
    const b = control[control.length - 1] as Point;
    if (depth >= 12 || control.slice(1, -1).every((p) => distanceToRoute(p, [a, b]) <= 0.25)) {
      points.push(b);
      return;
    }
    const left = [a],
      right = [b];
    let row = control;
    while (row.length > 1) {
      row = row.slice(1).map((p, i) => midpoint(row[i] as Point, p));
      left.push(row[0] as Point);
      right.unshift(row[row.length - 1] as Point);
    }
    curve(left, depth + 1);
    curve(right, depth + 1);
  }
  for (const match of d.matchAll(/([MLCQ])([^MLCQ]*)/g)) {
    const numbers =
      match[2]
        ?.trim()
        .split(/[\s,]+/)
        .map(Number) ?? [];
    if (!numbers.every(Number.isFinite)) return [];
    const pairs = Array.from({ length: numbers.length / 2 }, (_, i) => ({
      x: numbers[2 * i] as number,
      y: numbers[2 * i + 1] as number,
    }));
    if (match[1] === "M" || match[1] === "L") points.push(...pairs);
    else if (points.length) curve([points[points.length - 1] as Point, ...pairs]);
  }
  return points;
}

import type { Point } from "../layout/metrics.ts";

/** Distance to the drawn centreline, independent of SVG stacking and the wide hit bands. */
export function distanceToRoute(point: Point, route: readonly Point[]): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1] as Point;
    const b = route[i] as Point;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    distance = Math.min(distance, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
  }
  return distance;
}

/** Equally close lines must be chosen explicitly, including identical/shared routes. */
export function nearestLines(
  point: Point,
  routes: Record<string, readonly Point[]>,
  tolerance: number,
  maxDistance: number,
): string[] {
  const distances = Object.entries(routes).map(([id, route]) => ({
    id,
    distance: distanceToRoute(point, route),
  }));
  const nearest = Math.min(...distances.map((item) => item.distance));
  return distances
    .filter((item) => item.distance <= maxDistance && item.distance <= nearest + tolerance)
    .map((item) => item.id);
}

/** A short paper-coloured under-stroke at proper crossings; shared runs/ports are junctions. */
export function crossingBridges(route: readonly Point[], earlier: readonly (readonly Point[])[]) {
  const bridges: Point[][] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1] as Point;
    const b = route[i] as Point;
    const horizontal = a.y === b.y;
    for (const other of earlier) {
      for (let j = 1; j < other.length; j++) {
        const c = other[j - 1] as Point;
        const d = other[j] as Point;
        if (horizontal === (c.y === d.y)) continue;
        const [h1, h2, v1, v2] = horizontal ? [a, b, c, d] : [c, d, a, b];
        if (
          v1.x <= Math.min(h1.x, h2.x) ||
          v1.x >= Math.max(h1.x, h2.x) ||
          h1.y <= Math.min(v1.y, v2.y) ||
          h1.y >= Math.max(v1.y, v2.y)
        )
          continue;
        const radius = Math.min(
          7,
          Math.abs((horizontal ? a.x : a.y) - (horizontal ? v1.x : h1.y)),
          Math.abs((horizontal ? b.x : b.y) - (horizontal ? v1.x : h1.y)),
        );
        bridges.push(
          horizontal
            ? [
                { x: v1.x - radius, y: h1.y },
                { x: v1.x + radius, y: h1.y },
              ]
            : [
                { x: v1.x, y: h1.y - radius },
                { x: v1.x, y: h1.y + radius },
              ],
        );
      }
    }
  }
  // Several earlier routes can share the same crossing stem.
  return [...new Map(bridges.map((points) => [JSON.stringify(points), points])).values()];
}

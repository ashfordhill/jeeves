import type { Point } from "../layout/metrics.ts";
import { polylineToSvg } from "../layout/polyline.ts";

/** An open arrowhead at the target port, including routes that approach from above or below. */
export function directionArrow(points: readonly Point[]): string | undefined {
  const tip = points.at(-1);
  if (!tip) return;
  const before = points.findLast((point) => point.x !== tip.x || point.y !== tip.y);
  if (!before) return;
  const length = Math.hypot(tip.x - before.x, tip.y - before.y);
  const dx = (tip.x - before.x) / length;
  const dy = (tip.y - before.y) / length;
  // Keep even a short animated segment's arrow inside that segment.
  const depth = Math.min(14, length);
  const halfWidth = depth / 2;
  const base = { x: tip.x - dx * depth, y: tip.y - dy * depth };
  return polylineToSvg([
    { x: base.x - dy * halfWidth, y: base.y + dx * halfWidth },
    tip,
    { x: base.x + dy * halfWidth, y: base.y - dx * halfWidth },
  ]);
}

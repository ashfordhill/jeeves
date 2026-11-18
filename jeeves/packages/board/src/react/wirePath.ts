// A wire's drawn shape, from its route and its two ports. The route starts and ends on the line's
// own lane (`lanes.ts`); the wire leaves its port and fans out to that lane, rounds each corner,
// and gathers in to an arrowhead that sits closer to its neighbours than the lanes do.
import type { Point } from "../layout/metrics.ts";

export const WIRE_WIDTH = 3.5;
export const WIRE_EDGE_WIDTH = 6.4;
/** The pointer band of a wire: narrower than a line's, because lanes are 11px apart. */
export const WIRE_HIT_WIDTH = 12;
/** An async wire: beads. */
export const WIRE_BEADS = "0.01 12";
/** Widths of the arrowhead's two strokes. */
export const WIRE_HEAD_EDGE = 5.1;
export const WIRE_HEAD_FILL = 2.2;

const FAN = 36;
const GATHER = 28;
const STUB = 18;
const RADIUS = 9;
/** Arrowheads at one port sit this much closer together than their lanes. */
const HEAD_RATIO = 0.75;
/** The soft triangle, measured back from the line's end. `body` is where the wire's stroke stops. */
const HEAD = { tip: 3.6, base: 10.6, half: 3.4, body: 9 };

const n = (v: number) => Math.round(v * 10) / 10;
const at = (p: Point) => `${n(p.x)} ${n(p.y)}`;

export type WireArt = { body: string; head?: string };

/**
 * `route` is the line's lane route; `port` and `entry` are the ports it leaves and enters. The
 * fan and the gather are drawn only on a level first or last run (a route in motion has neither).
 */
export function wireArt(
  route: readonly Point[],
  port: Point,
  entry: Point,
  directed: boolean,
): WireArt {
  const [first, second] = [route[0], route[1]];
  const [before, last] = [route[route.length - 2], route[route.length - 1]];
  if (!first || !second || !before || !last) return { body: "" };
  const out = second.y === first.y && second.x > first.x;
  const fan = out ? Math.min(FAN, (second.x - first.x) / 2) : 0;
  const into = before.y === last.y && before.x < last.x;
  const reach = into ? Math.min(GATHER + STUB, (last.x - before.x) / 2) : 0;
  const stub = Math.min(STUB, reach);
  const headY = reach > stub ? entry.y + (last.y - entry.y) * HEAD_RATIO : last.y;
  const points: Point[] = [
    { x: first.x + fan, y: first.y },
    ...route.slice(1, -1),
    { x: last.x - reach, y: last.y },
  ];

  const start = points[0] as Point;
  let d = `M ${at(out ? port : first)}`;
  if (out) {
    d +=
      Math.abs(port.y - start.y) < 0.5
        ? ` L ${at(start)}`
        : ` C ${n(port.x + fan * 0.55)} ${n(port.y)} ${n(port.x + fan * 0.45)} ${n(start.y)} ${at(start)}`;
  }
  for (let i = 1; i < points.length; i++) {
    const [p, q, r] = [points[i - 1] as Point, points[i] as Point, points[i + 1]];
    if (!r) {
      d += ` L ${at(q)}`;
      break;
    }
    const [l1, l2] = [Math.hypot(q.x - p.x, q.y - p.y), Math.hypot(r.x - q.x, r.y - q.y)];
    const radius = Math.min(RADIUS, l1 / 2, l2 / 2);
    if (radius < 0.5) {
      d += ` L ${at(q)}`;
      continue;
    }
    const a = { x: q.x - ((q.x - p.x) / l1) * radius, y: q.y - ((q.y - p.y) / l1) * radius };
    const b = { x: q.x + ((r.x - q.x) / l2) * radius, y: q.y + ((r.y - q.y) / l2) * radius };
    d += ` L ${at(a)} Q ${at(q)} ${at(b)}`;
  }
  const gather = points[points.length - 1] as Point;
  const level = { x: last.x - stub, y: headY };
  if (reach > stub && Math.abs(headY - gather.y) >= 0.5) {
    const mid = (gather.x + level.x) / 2;
    d += ` C ${n(mid)} ${n(gather.y)} ${n(mid)} ${n(headY)} ${at(level)}`;
  } else if (reach > 0) d += ` L ${at(level)}`;

  // The arrowhead points along the last run: level after a gather, else as the route arrives.
  const length = Math.hypot(last.x - before.x, last.y - before.y);
  const dir = into
    ? { x: 1, y: 0 }
    : { x: (last.x - before.x) / length, y: (last.y - before.y) / length };
  const end = { x: last.x, y: into ? headY : last.y };
  const room = into ? stub : length;
  if (!directed || !(room >= HEAD.base)) return { body: `${d} L ${at(end)}` };
  const back = (by: number, side = 0) => ({
    x: end.x - dir.x * by - dir.y * side,
    y: end.y - dir.y * by + dir.x * side,
  });
  return {
    body: `${d} L ${at(back(HEAD.body))}`,
    head: `M ${at(back(HEAD.tip))} L ${at(back(HEAD.base, HEAD.half))} L ${at(back(HEAD.base, -HEAD.half))} Z`,
  };
}

// A wire's drawn shape, from its route and the port it leaves. The route starts and ends on the
// line's own lane (`lanes.ts`); the wire leaves its port and fans out to that lane, rounds each
// corner, and runs straight in to its arrowhead.
import type { Point } from "../layout/metrics.ts";

export const WIRE_WIDTH = 4.6;
export const WIRE_EDGE_WIDTH = 7.3;
/** The pointer band of a wire: narrower than a line's, because lanes are 11px apart. */
export const WIRE_HIT_WIDTH = 12;
/** An async wire: beads. */
export const WIRE_BEADS = "0.01 12";
/** Widths of the arrowhead's two strokes. */
export const WIRE_HEAD_EDGE = 5.6;
export const WIRE_HEAD_FILL = 2.9;

const FAN = 36;
/** The level run an arrowhead needs after the last corner. */
const STUB = 18;
const RADIUS = 9;
/** The soft triangle, measured back from the line's end. `body` is where the wire's stroke stops. */
const HEAD = { tip: 4.7, base: 13.9, half: 4.5, body: 11.8 };

const n = (v: number) => Math.round(v * 10) / 10;
const at = (p: Point) => `${n(p.x)} ${n(p.y)}`;

export type WireArt = { body: string; head?: string };

/**
 * `route` is the line's lane route; `port` is the port it leaves. The fan is drawn only on a
 * level first run (a route in motion has none).
 */
export function wireArt(route: readonly Point[], port: Point, directed: boolean): WireArt {
  const [first, second] = [route[0], route[1]];
  const [before, last] = [route[route.length - 2], route[route.length - 1]];
  if (!first || !second || !before || !last) return { body: "" };
  const out = second.y === first.y && second.x > first.x;
  const fan = out ? Math.min(FAN, (second.x - first.x) / 2) : 0;
  const into = before.y === last.y && before.x < last.x;
  const points: Point[] = [{ x: first.x + fan, y: first.y }, ...route.slice(1)];

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
    if (!r) break;
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

  // The arrowhead points along the last run. After a corner into a level run it needs half that
  // run, so it never meets the corner.
  const length = Math.hypot(last.x - before.x, last.y - before.y);
  const dir = { x: (last.x - before.x) / length, y: (last.y - before.y) / length };
  const room = into ? Math.min(STUB, length / 2) : length;
  if (!directed || !(room >= HEAD.base)) return { body: `${d} L ${at(last)}` };
  const back = (by: number, side = 0) => ({
    x: last.x - dir.x * by - dir.y * side,
    y: last.y - dir.y * by + dir.x * side,
  });
  return {
    body: `${d} L ${at(back(HEAD.body))}`,
    head: `M ${at(back(HEAD.tip))} L ${at(back(HEAD.base, HEAD.half))} L ${at(back(HEAD.base, -HEAD.half))} Z`,
  };
}

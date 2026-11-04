import { useLayoutEffect, useRef, useState } from "react";
import type { Point } from "./creation.ts";
import type { RouteBox, StudioGeometry, StudioRoute } from "./routing.ts";

type Frame = { nodes: Record<string, RouteBox>; routes: StudioGeometry };
const point = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
// Repeat vertices rather than cross-fading SVG paths. Endpoints remain attached to the cards.
function route(a: StudioRoute, b: StudioRoute, t: number): StudioRoute {
  const count = Math.max(a.points.length, b.points.length);
  const points = Array.from({ length: count }, (_, i) =>
    point(
      a.points[Math.round((i * (a.points.length - 1)) / (count - 1))] as Point,
      b.points[Math.round((i * (b.points.length - 1)) / (count - 1))] as Point,
      t,
    ),
  );
  return {
    ...b,
    points,
    path: points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
    ...(a.label && b.label && { label: { ...b.label, ...point(a.label, b.label, t) } }),
  };
}

/** Only modest final changes animate, for 180ms. Active gestures and large/reduced motion snap. */
export function useStudioSettle(target: Frame, moving: boolean): Frame {
  const shown = useRef(target);
  const latest = useRef(target);
  latest.current = target;
  const key = JSON.stringify(target);
  const [animation, setAnimation] = useState<{ key: string; frame: Frame }>();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useLayoutEffect(() => {
    const target = latest.current;
    const from = shown.current;
    const deltas = [
      ...Object.entries(target.nodes).flatMap(([id, b]) => {
        const a = from.nodes[id];
        return a ? [Math.hypot(b.x - a.x, b.y - a.y)] : [Infinity];
      }),
      ...Object.entries(target.routes).flatMap(([id, b]) => {
        const a = from.routes[id];
        if (!a) return [Infinity];
        const count = Math.max(a.points.length, b.points.length);
        return Array.from({ length: count }, (_, i) => {
          const p = a.points[Math.round((i * (a.points.length - 1)) / (count - 1))] as Point;
          const q = b.points[Math.round((i * (b.points.length - 1)) / (count - 1))] as Point;
          return Math.hypot(p.x - q.x, p.y - q.y);
        });
      }),
    ];
    if (moving || reduced || Math.max(0, ...deltas) > 280 || Math.max(0, ...deltas) < 1) {
      shown.current = target;
      setAnimation(undefined);
      return;
    }
    let raf = 0;
    setAnimation({ key, frame: from });
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 180),
        eased = 1 - (1 - t) ** 2;
      const frame =
        t === 1
          ? target
          : {
              nodes: Object.fromEntries(
                Object.entries(target.nodes).map(([id, b]) => [
                  id,
                  from.nodes[id] ? { ...b, ...point(from.nodes[id], b, eased) } : b,
                ]),
              ),
              routes: Object.fromEntries(
                Object.entries(target.routes).map(([id, b]) => [
                  id,
                  from.routes[id] ? route(from.routes[id], b, eased) : b,
                ]),
              ),
            };
      shown.current = frame;
      setAnimation({ key, frame });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, moving, reduced]);
  if (moving) shown.current = target;
  return !moving && animation?.key === key ? animation.frame : target;
}

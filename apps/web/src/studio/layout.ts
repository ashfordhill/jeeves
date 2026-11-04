import type { StudioScopeProjection } from "@jeeves/spec";
import type { Viewport } from "@xyflow/react";
import { studioCardSize } from "./card-appearance.tsx";
import type { Point } from "./creation.ts";
import type { RouteBox, StudioGeometry } from "./routing.ts";

const GRID = 24;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const gridPoint = (p: Point): Point => ({
  x: Math.round(p.x / GRID) * GRID,
  y: Math.round(p.y / GRID) * GRID,
});
const overlaps = (a: RouteBox, b: RouteBox) =>
  a.x < b.x + b.width + 16 &&
  a.x + a.width + 16 > b.x &&
  a.y < b.y + b.height + 16 &&
  a.y + a.height + 16 > b.y;

/** Search the unbounded grid by actual distance, with a stable canonical-ID anchor/tie order.
 * A group translates rigidly, including older off-grid relative offsets. */
export function studioLanding(
  boxes: Record<string, RouteBox>,
  moving: Record<string, Point>,
): Record<string, Point> {
  const ids = Object.keys(moving)
    .filter((id) => boxes[id])
    .sort(compare);
  const anchor = ids[0];
  if (!anchor) return {};
  const point = moving[anchor] as Point;
  const origin = gridPoint(point);
  const obstacles = Object.entries(boxes).filter(([id]) => !ids.includes(id));
  const distance = (p: Point) => (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
  let best: Point | undefined;
  for (let radius = 0; ; radius++) {
    for (let x = -radius; x <= radius; x++)
      for (let y = -radius; y <= radius; y++) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
        const candidate = { x: origin.x + x * GRID, y: origin.y + y * GRID };
        if (
          best &&
          (distance(candidate) > distance(best) ||
            (distance(candidate) === distance(best) &&
              (candidate.x > best.x || (candidate.x === best.x && candidate.y >= best.y))))
        )
          continue;
        if (
          ids.every((id) => {
            const at = moving[id] as Point;
            const box = boxes[id] as RouteBox;
            return obstacles.every(
              ([, obstacle]) =>
                !overlaps(
                  { ...box, x: at.x + candidate.x - point.x, y: at.y + candidate.y - point.y },
                  obstacle,
                ),
            );
          })
        )
          best = candidate;
      }
    if (best && distance(best) <= ((radius + 1) * GRID - GRID / 2) ** 2) {
      const destination = best;
      return Object.fromEntries(
        ids.map((id) => {
          const at = moving[id] as Point;
          return [id, { x: at.x + destination.x - point.x, y: at.y + destination.y - point.y }];
        }),
      );
    }
  }
}

/** Stable SCC layers preserve left-to-right dependencies without pretending cycles are a DAG. */
export function arrangeStudio(scope: StudioScopeProjection): Record<string, RouteBox> {
  const ids = scope.nodes.map((node) => node.id).sort(compare);
  const adjacent = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const edge of scope.edges)
    if (edge.from !== edge.to && adjacent.has(edge.to)) adjacent.get(edge.from)?.add(edge.to);
  const index = new Map<string, number>(),
    low = new Map<string, number>();
  const stack: string[] = [],
    active = new Set<string>(),
    groups: string[][] = [];
  const visit = (id: string) => {
    index.set(id, index.size);
    low.set(id, index.get(id) as number);
    stack.push(id);
    active.add(id);
    for (const next of [...(adjacent.get(id) ?? [])].sort(compare)) {
      if (!index.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id) as number, low.get(next) as number));
      } else if (active.has(next))
        low.set(id, Math.min(low.get(id) as number, index.get(next) as number));
    }
    if (low.get(id) !== index.get(id)) return;
    const group: string[] = [];
    let next: string;
    do {
      next = stack.pop() as string;
      active.delete(next);
      group.push(next);
    } while (next !== id);
    groups.push(group.sort(compare));
  };
  ids.forEach((id) => {
    if (!index.has(id)) visit(id);
  });
  const groupOf = new Map(groups.flatMap((group, i) => group.map((id) => [id, i] as const)));
  const ranks = new Map<number, number>();
  const rank = (i: number): number => {
    if (ranks.has(i)) return ranks.get(i) as number;
    const parents = scope.edges.filter(
      (edge) => groupOf.get(edge.to) === i && groupOf.get(edge.from) !== i,
    );
    const value = Math.max(0, ...parents.map((edge) => rank(groupOf.get(edge.from) as number) + 1));
    ranks.set(i, value);
    return value;
  };
  groups.forEach((_, i) => {
    rank(i);
  });
  const result: Record<string, RouteBox> = {};
  let x = 0;
  for (let layer = 0; layer <= Math.max(0, ...ranks.values()); layer++) {
    const members = ids.filter((id) => ranks.get(groupOf.get(id) as number) === layer);
    let y = 0,
      width = 0;
    for (const id of members) {
      const node = scope.nodes.find((node) => node.id === id);
      if (!node) continue;
      const size = studioCardSize(node);
      result[id] = { ...gridPoint({ x, y }), ...size };
      y += size.height + 48;
      width = Math.max(width, size.width);
    }
    // Reserve bounded high-detail relationship text, rather than a legacy fixed report panel.
    const labels = scope.edges.filter((edge) => members.includes(edge.from));
    const labelWidth = Math.max(
      0,
      ...labels.map(
        (edge) =>
          Math.min(56, edge.actions.join(" / ").length + edge.protocols.join(" / ").length + 3) * 8,
      ),
    );
    x = Math.ceil((x + width + Math.max(48, labelWidth + 24)) / GRID) * GRID;
  }
  return result;
}

/** Pixel padding, including routed bends and labels; never zoom past actual size. */
export function studioFit(
  nodes: Record<string, RouteBox>,
  routes: StudioGeometry,
  width: number,
  height: number,
): Viewport {
  const boxes = [
    ...Object.values(nodes),
    ...Object.values(routes).flatMap((route) => [
      ...(route.label ? [route.label] : []),
      ...route.points.map((point) => ({ ...point, width: 0, height: 0 })),
    ]),
  ];
  if (!boxes.length) return { x: width / 2, y: height / 2, zoom: 1 };
  const x = Math.min(...boxes.map((box) => box.x)),
    y = Math.min(...boxes.map((box) => box.y));
  const w = Math.max(1, ...boxes.map((box) => box.x + box.width - x));
  const h = Math.max(1, ...boxes.map((box) => box.y + box.height - y));
  const zoom = Math.min(1, Math.max(0.1, Math.min((width - 96) / w, (height - 96) / h)));
  return { x: (width - w * zoom) / 2 - x * zoom, y: (height - h * zoom) / 2 - y * zoom, zoom };
}

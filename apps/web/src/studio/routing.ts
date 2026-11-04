/** Derived paths only: no saved connections, positions, or invented trunk settings. */
import type {
  StudioRelationship,
  StudioRelationshipMember,
  StudioScopeProjection,
} from "@jeeves/spec";
import { boundedStudioText } from "./card-appearance.tsx";
import type { Point } from "./creation.ts";

export interface StudioPath {
  id: string;
  item: StudioRelationship;
  edgeIds: string[];
  trunk?: string;
  branchIds?: string[];
}
export interface RouteBox extends Point {
  width: number;
  height: number;
}
export interface StudioRoute {
  points: Point[];
  path: string;
  junction?: Point;
  label?: RouteBox & { short: string; detail: string };
}
const compare = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, "en");
const unique = <T extends string>(values: T[]) => [...new Set(values)].sort();

function relationship(
  id: string,
  edges: StudioRelationship[],
  memberIds: string[],
): StudioRelationship {
  const members = [...new Map(edges.flatMap((e) => e.members).map((m) => [m.id, m])).values()]
    .filter((m) => memberIds.includes(m.id))
    .sort(compare);
  const first = edges[0];
  if (!first) throw new Error("A visible path requires its original relationship.");
  const item = { ...first, id, members };
  // Retain every provenance field, including queued legs and exact contract/binding refs.
  const fields = [
    "sourceRefs",
    "targetRefs",
    "connectionIds",
    "queueIds",
    "contextRelationshipIds",
    "componentRelationshipIds",
    "componentIds",
    "bindingIds",
    "interfaceIds",
    "contractRefs",
    "capabilityRefs",
  ] as const;
  for (const key of fields) {
    const values = members.flatMap((m) => m[key] as unknown[]);
    Object.assign(item, {
      [key]: [...new Map(values.map((v) => [JSON.stringify(v), v])).values()],
    });
  }
  item.actions = unique(members.map((m) => m.action));
  item.protocols = unique(members.flatMap((m) => m.protocols));
  item.interactions = unique(members.flatMap((m) => m.interactions));
  return item;
}

/** Consume UX04b's exact protocol/interaction groups, including subsets of mixed aggregates. */
export function studioPaths(scope: StudioScopeProjection): StudioPath[] {
  const paths: StudioPath[] = [];
  const used = new Map<string, Set<string>>();
  for (const trunk of [...scope.trunks].sort(compare)) {
    const edges = scope.edges
      .filter((e) => trunk.branches.some((b) => b.edgeId === e.id))
      .sort(compare);
    const memberIds = trunk.branches.flatMap((b) => b.memberIds);
    const branchIds: string[] = [];
    for (const branch of [...trunk.branches].sort((a, b) =>
      a.edgeId.localeCompare(b.edgeId, "en"),
    )) {
      const edge = edges.find((e) => e.id === branch.edgeId);
      if (!edge) continue;
      const id = `${edge.id}:branch:${branch.memberIds.join("|")}`;
      branchIds.push(id);
      paths.push({
        id,
        item: relationship(id, [edge], branch.memberIds),
        edgeIds: [edge.id],
        trunk: trunk.id,
      });
      const ids = used.get(edge.id) ?? new Set<string>();
      for (const memberId of branch.memberIds) ids.add(memberId);
      used.set(edge.id, ids);
    }
    paths.push({
      id: trunk.id,
      item: relationship(trunk.id, edges, memberIds),
      edgeIds: edges.map((e) => e.id),
      branchIds,
    });
  }
  for (const edge of [...scope.edges].sort(compare)) {
    const remaining = edge.members.filter((m) => !used.get(edge.id)?.has(m.id));
    if (!remaining.length) continue;
    const id = used.has(edge.id)
      ? `${edge.id}:branch:${remaining.map((m) => m.id).join("|")}`
      : edge.id;
    paths.push({
      id,
      item: relationship(
        id,
        [edge],
        remaining.map((m) => m.id),
      ),
      edgeIds: [edge.id],
    });
  }
  return paths.sort(compare);
}

export function studioRelationshipLabel(item: StudioRelationship, detailed: boolean): string {
  const action = item.actions.join(" / ");
  const protocol = boundedStudioText(
    item.protocols.filter((p) => p !== "In process" && p !== "Unspecified").join(" / "),
    18,
  );
  return detailed && protocol
    ? `${boundedStudioText(action, 53 - Array.from(protocol).length)} · ${protocol}`
    : boundedStudioText(action, detailed ? 56 : 36);
}

const overlaps = (a: RouteBox, b: RouteBox) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const inflate = (b: RouteBox, gap: number): RouteBox => ({
  x: b.x - gap,
  y: b.y - gap,
  width: b.width + gap * 2,
  height: b.height + gap * 2,
});
const simplify = (points: Point[]) => {
  const distinct = points.filter(
    (p, i) => !i || p.x !== points[i - 1]?.x || p.y !== points[i - 1]?.y,
  );
  return distinct.filter((p, i) => {
    const before = distinct[i - 1],
      after = distinct[i + 1];
    return (
      !before ||
      !after ||
      !((before.x === p.x && p.x === after.x) || (before.y === p.y && p.y === after.y))
    );
  });
};
const segments = (points: Point[]) =>
  points.slice(1).map((p, i) => [points[i] as Point, p] as const);
const between = (n: number, a: number, b: number) => n > Math.min(a, b) && n < Math.max(a, b);
const blocked = (a: Point, b: Point, boxes: RouteBox[]) =>
  boxes.some((box) =>
    a.y === b.y
      ? between(a.y, box.y, box.y + box.height) &&
        Math.max(a.x, b.x) > box.x &&
        Math.min(a.x, b.x) < box.x + box.width
      : between(a.x, box.x, box.x + box.width) &&
        Math.max(a.y, b.y) > box.y &&
        Math.min(a.y, b.y) < box.y + box.height,
  );

/** A small binary heap keeps dense rectilinear searches bounded by the visible coordinate grid. */
class Queue {
  items: { key: number; score: number }[] = [];
  push(value: { key: number; score: number }) {
    let i = this.items.length;
    this.items.push(value);
    while (i) {
      const parent = (i - 1) >> 1;
      const entry = this.items[parent];
      if (!entry || entry.score <= value.score) break;
      this.items[i] = entry;
      i = parent;
    }
    this.items[i] = value;
  }
  pop() {
    const first = this.items[0],
      last = this.items.pop();
    if (!first || !last || !this.items.length) return first;
    let i = 0;
    while (i * 2 + 1 < this.items.length) {
      let child = i * 2 + 1;
      if ((this.items[child + 1]?.score ?? Infinity) < (this.items[child]?.score ?? Infinity))
        child++;
      const entry = this.items[child];
      if (!entry || entry.score >= last.score) break;
      this.items[i] = entry;
      i = child;
    }
    this.items[i] = last;
    return first;
  }
}

/** Obstacle-aware Manhattan routing on a compressed grid, with bend/overlap penalties. */
function orthogonal(
  start: Point,
  end: Point,
  boxes: RouteBox[],
  occupied: Point[][],
  lane?: number,
): Point[] {
  const xs = [...new Set([start.x, end.x, ...boxes.flatMap((b) => [b.x, b.x + b.width])])].sort(
    (a, b) => a - b,
  );
  const ys = [
    ...new Set([
      start.y,
      end.y,
      ...(lane === undefined ? [] : [lane]),
      ...boxes.flatMap((b) => [b.y, b.y + b.height]),
    ]),
  ].sort((a, b) => a - b);
  const width = xs.length;
  const encode = (x: number, y: number, d: number) => (y * width + x) * 3 + d;
  const decode = (key: number) => ({
    x: Math.floor(key / 3) % width,
    y: Math.floor(key / 3 / width),
    d: key % 3,
  });
  const point = (x: number, y: number): Point => ({ x: xs[x] ?? 0, y: ys[y] ?? 0 });
  const initial = encode(xs.indexOf(start.x), ys.indexOf(start.y), 0);
  const queue = new Queue();
  const costs = new Map([[initial, 0]]),
    previous = new Map<number, number>();
  const used = occupied.flatMap(segments);
  const visibility = new Map<string, boolean>();
  queue.push({ key: initial, score: 0 });
  while (queue.items.length) {
    const entry = queue.pop();
    if (!entry) break;
    const { x, y, d } = decode(entry.key),
      a = point(x, y);
    if (a.x === end.x && a.y === end.y) {
      const result: Point[] = [a];
      let key = entry.key;
      while (previous.has(key)) {
        key = previous.get(key) as number;
        const at = decode(key);
        result.push(point(at.x, at.y));
      }
      return simplify(result.reverse());
    }
    for (const [nx, ny, direction] of [
      [x + 1, y, 1],
      [x - 1, y, 1],
      [x, y + 1, 2],
      [x, y - 1, 2],
    ]) {
      if (
        nx === undefined ||
        ny === undefined ||
        direction === undefined ||
        nx < 0 ||
        ny < 0 ||
        nx >= xs.length ||
        ny >= ys.length
      )
        continue;
      const b = point(nx, ny),
        key = encode(nx, ny, direction);
      const visibilityKey = `${Math.min(entry.key - d, key - direction)}:${Math.max(entry.key - d, key - direction)}`;
      let clear = visibility.get(visibilityKey);
      if (clear === undefined) {
        clear = !blocked(a, b, boxes);
        visibility.set(visibilityKey, clear);
      }
      if (!clear) continue;
      const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      const overlap = used.some(([c, e]) =>
        a.y === b.y && c.y === e.y && a.y === c.y
          ? Math.min(Math.max(a.x, b.x), Math.max(c.x, e.x)) >
            Math.max(Math.min(a.x, b.x), Math.min(c.x, e.x))
          : a.x === b.x &&
            c.x === e.x &&
            a.x === c.x &&
            Math.min(Math.max(a.y, b.y), Math.max(c.y, e.y)) >
              Math.max(Math.min(a.y, b.y), Math.min(c.y, e.y)),
      );
      const cost =
        (costs.get(entry.key) ?? 0) + length * (overlap ? 4 : 1) + (d && d !== direction ? 16 : 0);
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost);
      previous.set(key, entry.key);
      queue.push({ key, score: cost + Math.abs(b.x - end.x) + Math.abs(b.y - end.y) });
    }
  }
  // Overlapping user-placed cards can enclose a port. Retain its directed, selectable path.
  return [start, { x: end.x, y: start.y }, end];
}

export function studioRouteGeometry(
  paths: StudioPath[],
  nodes: Record<string, RouteBox>,
  measure: (text: string) => number,
): Record<string, StudioRoute> {
  const result: Record<string, StudioRoute> = {},
    occupied: Point[][] = [];
  const boxes = Object.values(nodes).map((b) => inflate(b, 12));
  const top = Math.min(0, ...boxes.map((b) => b.y)) - 24;
  const starts = paths.filter((p) => !p.trunk),
    ends = paths.filter((p) => !p.branchIds);
  const port = (id: string, path: StudioPath, source: boolean): Point => {
    const box = nodes[id];
    if (!box) throw new Error(`Missing route endpoint ${id}`);
    const list = (source ? starts : ends).filter((p) => (source ? p.item.from : p.item.to) === id);
    return {
      x: box.x + (source ? box.width : 0),
      y: box.y + 14 + ((box.height - 28) * (list.indexOf(path) + 1)) / (list.length + 1),
    };
  };
  const junctions = new Map<string, Point>();
  const save = (id: string, points: Point[], junction?: Point) => {
    result[id] = {
      points,
      path: points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
      junction,
    };
    occupied.push(points);
  };
  for (const path of paths.filter((p) => p.branchIds)) {
    const source = port(path.item.from, path, true);
    const branches = paths.filter((p) => p.trunk === path.id);
    const targets = branches.map((p) => port(p.item.to, p, false));
    const min = Math.min(source.y, ...targets.map((p) => p.y)),
      max = Math.max(source.y, ...targets.map((p) => p.y));
    const bus = {
      x: source.x + 24 + starts.filter((p) => p.item.from === path.item.from).indexOf(path) * 12,
      y: source.y,
    };
    const busClear =
      targets.every((t) => t.x > bus.x + 12) &&
      !blocked(bus, { x: bus.x, y: min }, boxes) &&
      !blocked(bus, { x: bus.x, y: max }, boxes);
    if (busClear) {
      save(path.id, [source, bus, { x: bus.x, y: min }, { x: bus.x, y: max }]);
      branches.forEach((branch, i) => {
        junctions.set(branch.id, { x: bus.x, y: targets[i]?.y ?? source.y });
      });
    } else {
      const root = { x: source.x + 12, y: source.y };
      save(path.id, [source, root]);
      branches.forEach((branch) => {
        junctions.set(branch.id, root);
      });
    }
  }
  let feedback = 0;
  for (const path of ends) {
    const junction = junctions.get(path.id),
      source = junction ?? port(path.item.from, path, true),
      target = port(path.item.to, path, false);
    const start = junction ?? { x: source.x + 12, y: source.y },
      end = { x: target.x - 12, y: target.y };
    let points: Point[];
    if (target.x <= source.x) {
      const y = top - feedback++ * 12,
        a = { x: start.x, y },
        b = { x: end.x, y };
      points = [
        ...orthogonal(start, a, boxes, occupied, y),
        b,
        ...orthogonal(b, end, boxes, occupied, y),
      ];
    } else points = orthogonal(start, end, boxes, occupied);
    save(path.id, simplify([source, ...points, target]), junction);
  }
  // Reserve the actual bounded high-detail text (and the medium variant) once, independent of zoom.
  const reserved: RouteBox[] = Object.values(nodes).map((b) => inflate(b, 6));
  const labeled = new Set<string>();
  for (const path of ends) {
    const edgeId = path.edgeIds[0],
      route = result[path.id];
    if (!route || !edgeId || labeled.has(edgeId)) continue;
    const siblings = ends.filter((p) => p.edgeIds.includes(edgeId));
    const item = relationship(
      edgeId,
      siblings.map((p) => p.item),
      siblings.flatMap((p) => p.item.members.map((m: StudioRelationshipMember) => m.id)),
    );
    const width =
      Math.ceil(
        Math.max(
          measure(studioRelationshipLabel(item, true)),
          measure(studioRelationshipLabel(item, false)),
        ),
      ) + 6;
    const candidates = segments(route.points)
      .filter(([a, b]) => a.y === b.y && Math.abs(a.x - b.x) >= width + 12)
      .sort(([a, b], [c, d]) => Math.abs(d.x - c.x) - Math.abs(b.x - a.x));
    for (const [a, b] of candidates) {
      const left = Math.min(a.x, b.x) + 6,
        right = Math.max(a.x, b.x) - width - 6;
      const choices = [(left + right) / 2, left, right].map((x) => ({
        x,
        y: a.y - 19,
        width,
        height: 18,
      }));
      const box = choices.find(
        (candidate) =>
          !reserved.some((r) => overlaps(candidate, r)) &&
          !occupied.some((points) => segments(points).some(([c, d]) => blocked(c, d, [candidate]))),
      );
      if (!box) continue;
      route.label = {
        ...box,
        short: studioRelationshipLabel(item, false),
        detail: studioRelationshipLabel(item, true),
      };
      reserved.push(box);
      labeled.add(edgeId);
      break;
    }
  }
  return result;
}

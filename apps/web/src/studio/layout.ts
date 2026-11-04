/**
 * Derived studio geometry (SG06). ELK `layered` on a 32px grid, like automation-illustrator:
 * coordinates are never stored. The only stored input is an optional row order (`order`), which
 * keeps boxes in the rows the user chose inside their column. Pure: runs inside the studio worker.
 */
import type { Viewport } from "@xyflow/react";
import type { ELK, ElkExtendedEdge, ElkNode, LayoutOptions } from "elkjs/lib/elk-api.js";
import type { Point } from "./creation.ts";
import type { RouteBox, StudioGeometry, StudioPath, StudioRoute } from "./routing.ts";

export const STUDIO_GRID = 32;
/** Frame padding: sides/bottom, and the header strip that holds the frame's name. */
export const STUDIO_FRAME_PAD = 32;
export const STUDIO_FRAME_HEADER = 64;
const LABEL_HEIGHT = 18;
const ISLAND_GAP = 64;

export interface StudioLayoutNode {
  id: string;
  width: number;
  height: number;
  /** The frame node this node is drawn inside. */
  parent?: string;
  frame?: true;
}
export interface StudioLayoutLabel {
  short: string;
  detail: string;
  /** Measured pixel widths of both texts at the studio font. */
  shortWidth: number;
  detailWidth: number;
}
export interface StudioLayoutInput {
  scope: string;
  version: 2;
  nodes: StudioLayoutNode[];
  paths: StudioPath[];
  /** Path ID → the one label drawn for its relationship. */
  labels: Record<string, StudioLayoutLabel>;
  /** Optional row-order hint: node IDs in their preferred top-to-bottom order. */
  order: string[];
}
export interface StudioLayout {
  nodes: Record<string, RouteBox>;
  routes: StudioGeometry;
  /** Node IDs sharing one column (same island, same frame, overlapping x), top to bottom. */
  columns: string[][];
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const snap = (n: number) => Math.round(n / STUDIO_GRID) * STUDIO_GRID;
const half = (n: number) => Math.round(n / 16) * 16;
const floorGrid = (n: number) => Math.floor(n / STUDIO_GRID) * STUDIO_GRID;
const ceilGrid = (n: number) => Math.ceil(n / STUDIO_GRID) * STUDIO_GRID;
const routePath = (points: Point[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

const LAYERED: LayoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.randomSeed": "1",
  "elk.spacing.nodeNode": "32",
  // Every labelled relationship adds a label layer, so ELK's between-layer gap applies twice:
  // 32 + label + 32 matches the reference's 64px visible gap between boxes (plan §4).
  "elk.layered.spacing.nodeNodeBetweenLayers": "32",
  "elk.layered.spacing.edgeNodeBetweenLayers": "16",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "16",
  // Wider than the reference's 16: snapping may move a card up to 16px towards a passing line.
  "elk.spacing.edgeNode": "24",
  "elk.spacing.edgeEdge": "16",
  "elk.spacing.edgeLabel": "4",
  "elk.edgeLabels.placement": "CENTER",
  "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.thoroughness": "10",
  "elk.layered.mergeEdges": "true",
  "elk.separateConnectedComponents": "false",
  "elk.layered.wrapping.strategy": "OFF",
};
const ROOT: LayoutOptions = {
  ...LAYERED,
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.json.shapeCoords": "ROOT",
  "elk.json.edgeCoords": "ROOT",
  "elk.padding": "[top=0,left=0,bottom=0,right=0]",
  "elk.aspectRatio": "1.6",
};
const FRAME: LayoutOptions = {
  ...LAYERED,
  "elk.padding": `[top=${STUDIO_FRAME_HEADER},left=${STUDIO_FRAME_PAD},bottom=${STUDIO_FRAME_PAD},right=${STUDIO_FRAME_PAD}]`,
};
/**
 * A user row order keeps its rows. ELK 0.12's model-order options crash on compound graphs, so
 * the hint is given as semi-interactive positions: hinted nodes keep their across-flow order.
 */
const ORDERED: LayoutOptions = { "elk.layered.crossingMinimization.semiInteractive": "true" };

/** Connected islands of top-level boxes; a frame's children belong to their frame's island. */
function islands(input: StudioLayoutInput, rank: (id: string) => number) {
  const parents = new Map(input.nodes.map((node) => [node.id, node.parent]));
  const top = (id: string) => {
    let current = id;
    for (let depth = 0; depth < 8; depth++) {
      const parent = parents.get(current);
      if (!parent || !parents.has(parent)) return current;
      current = parent;
    }
    return current;
  };
  const root = new Map<string, string>();
  const find = (id: string): string => {
    const parent = root.get(id) ?? id;
    if (parent === id) return id;
    const found = find(parent);
    root.set(id, found);
    return found;
  };
  for (const node of input.nodes) if (top(node.id) === node.id) root.set(node.id, node.id);
  for (const path of input.paths) {
    const a = find(top(path.item.from)),
      b = find(top(path.item.to));
    if (a !== b) root.set(rank(a) <= rank(b) ? b : a, rank(a) <= rank(b) ? a : b);
  }
  const groups = new Map<string, string[]>();
  for (const node of input.nodes) {
    const key = find(top(node.id));
    groups.set(key, [...(groups.get(key) ?? []), node.id]);
  }
  return { groups: [...groups.values()], top };
}

/** Restore exact port ends after snapping; interior bends land on a 16px half grid. */
function orthogonal(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last && last.x !== point.x && last.y !== point.y) result.push({ x: last.x, y: point.y });
    result.push(point);
  }
  const distinct = result.filter(
    (p, i) => !i || p.x !== result[i - 1]?.x || p.y !== result[i - 1]?.y,
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
}

type Shape = { x: number; y: number; width: number; height: number };
const bounds = (boxes: Shape[]) => {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
};

/** One island through ELK, then snapped to the grid with its routes re-attached to the ports. */
async function layoutIsland(
  input: StudioLayoutInput,
  ids: string[],
  rank: (id: string) => number,
  elk: ELK,
): Promise<{ nodes: Record<string, RouteBox>; routes: StudioGeometry; columns: string[][] }> {
  const members = new Set(ids);
  const nodes = input.nodes.filter((node) => members.has(node.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ordered = (list: StudioLayoutNode[]) =>
    [...list].sort((a, b) => rank(a.id) - rank(b.id) || compare(a.id, b.id));
  const hinted = input.order.some((id) => members.has(id));
  const options = (base: LayoutOptions) => (hinted ? { ...base, ...ORDERED } : base);
  // Semi-interactive crossing minimisation keeps hinted nodes in their across-flow order.
  const hint = (id: string): LayoutOptions =>
    hinted ? { "elk.position": `(0,${rank(id) * 64})` } : {};
  const elkNode = (node: StudioLayoutNode): ElkNode => {
    const children = ordered(nodes.filter((child) => child.parent === node.id));
    return {
      id: node.id,
      ...(children.length || node.frame
        ? {
            layoutOptions: { ...options(FRAME), ...hint(node.id) },
            children: children.map(elkNode),
          }
        : {
            width: node.width,
            height: node.height,
            layoutOptions: { "elk.portConstraints": "FIXED_POS", ...hint(node.id) },
            ports: [
              {
                id: `${node.id}__in`,
                x: 0,
                y: node.height / 2,
                width: 0,
                height: 0,
                layoutOptions: { "elk.port.side": "WEST" },
              },
              {
                id: `${node.id}__out`,
                x: node.width,
                y: node.height / 2,
                width: 0,
                height: 0,
                layoutOptions: { "elk.port.side": "EAST" },
              },
            ],
          }),
    };
  };
  const isFrame = (id: string) => nodes.some((node) => node.parent === id) || !!byId.get(id)?.frame;
  const ends = input.paths.filter(
    (path) => !path.branchIds && members.has(path.item.from) && members.has(path.item.to),
  );
  const edges: ElkExtendedEdge[] = ends
    .filter((path) => path.item.from !== path.item.to)
    .map((path) => {
      const label = input.labels[path.id];
      return {
        id: path.id,
        sources: [isFrame(path.item.from) ? path.item.from : `${path.item.from}__out`],
        targets: [isFrame(path.item.to) ? path.item.to : `${path.item.to}__in`],
        ...(label && {
          labels: [
            {
              id: `${path.id}__label`,
              text: label.short,
              width: Math.ceil(label.shortWidth) + 4,
              height: LABEL_HEIGHT,
              layoutOptions: { "elk.edgeLabels.inline": "true" },
            },
          ],
        }),
      };
    });
  const graph: ElkNode = {
    id: "studio:root",
    layoutOptions: options(ROOT),
    children: ordered(nodes.filter((node) => !node.parent || !byId.has(node.parent))).map(elkNode),
    edges,
  };
  const result = await elk.layout(graph);

  // Snap: card port centres and frame corners to the 32px grid. Rounding is monotone, so every
  // 32-multiple gap ELK left between neighbours survives.
  const raw: Record<string, Shape> = {};
  const visit = (node: ElkNode) => {
    if (node.id !== graph.id)
      raw[node.id] = {
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
      };
    node.children?.forEach(visit);
  };
  visit(result);
  const placed: Record<string, RouteBox> = {};
  for (const [id, box] of Object.entries(raw)) {
    if (isFrame(id)) {
      const x = snap(box.x),
        y = snap(box.y);
      placed[id] = {
        x,
        y,
        width: Math.max(STUDIO_GRID * 6, snap(box.x + box.width) - x),
        height: Math.max(STUDIO_GRID * 3, snap(box.y + box.height) - y),
      };
    } else
      placed[id] = {
        x: snap(box.x),
        y: snap(box.y + box.height / 2) - box.height / 2,
        width: box.width,
        height: box.height,
      };
  }
  const port = (id: string, source: boolean): Point => {
    const box = placed[id] as RouteBox;
    return { x: box.x + (source ? box.width : 0), y: box.y + box.height / 2 };
  };
  const rawPort = (id: string, source: boolean): Point => {
    const box = raw[id] as Shape;
    return { x: box.x + (source ? box.width : 0), y: box.y + box.height / 2 };
  };
  const routes: StudioGeometry = {};
  const laid = new Map<string, ElkExtendedEdge>();
  const collect = (node: ElkNode) => {
    for (const edge of node.edges ?? []) laid.set(edge.id, edge as ElkExtendedEdge);
    node.children?.forEach(collect);
  };
  collect(result);
  for (const path of ends) {
    const { from, to } = path.item;
    const edge = laid.get(path.id);
    const section = edge?.sections?.[0];
    let points: Point[];
    if (from === to || !section) {
      // A self-relationship (or an edge ELK could not route) loops over the card's top right.
      const box = placed[from] as RouteBox;
      const start = port(from, true);
      points = [
        start,
        { x: start.x + 32, y: start.y },
        { x: start.x + 32, y: box.y - 32 },
        { x: box.x + box.width - 32, y: box.y - 32 },
        { x: box.x + box.width - 32, y: box.y },
      ];
    } else {
      const source = port(from, true),
        target = port(to, false);
      const before = rawPort(from, true),
        after = rawPort(to, false);
      const y = (value: number) =>
        Math.abs(value - before.y) < 0.5
          ? source.y
          : Math.abs(value - after.y) < 0.5
            ? target.y
            : half(value);
      const bends = (section.bendPoints ?? []).map((p) => ({ x: half(p.x), y: y(p.y) }));
      // ELK's start/end are on the original port; a frame end attaches to its side centre.
      const first = { x: source.x, y: y(section.startPoint.y) };
      const last = { x: target.x, y: y(section.endPoint.y) };
      // A frame end keeps ELK's height on the frame side, inside the snapped frame.
      const inside = (id: string, value: number) => {
        const box = placed[id] as RouteBox;
        return isFrame(id)
          ? Math.max(box.y + 16, Math.min(value, box.y + box.height - 16))
          : box.y + box.height / 2;
      };
      first.y = inside(from, first.y);
      last.y = inside(to, last.y);
      points = orthogonal([first, ...bends, last]);
    }
    const route: StudioRoute = { points, path: routePath(points) };
    const label = input.labels[path.id];
    const elkLabel = edge?.labels?.[0];
    if (label) {
      const width = Math.ceil(label.shortWidth) + 4;
      const centre = elkLabel
        ? {
            x: (elkLabel.x ?? 0) + (elkLabel.width ?? 0) / 2,
            y: (elkLabel.y ?? 0) + LABEL_HEIGHT / 2,
          }
        : undefined;
      const horizontal = points
        .slice(1)
        .map((p, i) => [points[i] as Point, p] as const)
        .filter(([a, b]) => a.y === b.y && Math.abs(a.x - b.x) >= 16);
      const spans = (a: Point, b: Point, x: number) =>
        x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x);
      const segment =
        (centre &&
          horizontal
            .filter(([a, b]) => spans(a, b, centre.x))
            .sort(([a], [b]) => Math.abs(a.y - centre.y) - Math.abs(b.y - centre.y))[0]) ??
        [...horizontal].sort(([a, b], [c, d]) => Math.abs(d.x - c.x) - Math.abs(b.x - a.x))[0];
      if (segment) {
        const [a, b] = segment;
        const x = centre && spans(a, b, centre.x) ? centre.x : (a.x + b.x) / 2;
        route.label = {
          x: Math.round(x - width / 2),
          y: a.y - LABEL_HEIGHT / 2,
          width,
          height: LABEL_HEIGHT,
          short: label.short,
          // Zoomed-in detail replaces the short text only where ELK reserved room for it.
          detail: label.detailWidth <= label.shortWidth ? label.detail : label.short,
        };
      }
    }
    routes[path.id] = route;
  }
  // A shared trunk runs from its source port to where its branches separate.
  for (const path of input.paths.filter((p) => p.branchIds)) {
    const branches = (path.branchIds ?? []).flatMap((id) => (routes[id] ? [routes[id]] : []));
    const start = branches[0]?.points[0];
    if (!start) continue;
    const x = Math.min(...branches.map((route) => route.points[1]?.x ?? start.x));
    const junction = { x, y: start.y };
    const points = [start, junction];
    routes[path.id] = { points, path: routePath(points) };
    for (const id of path.branchIds ?? []) if (routes[id]) routes[id] = { ...routes[id], junction };
  }
  // Columns: same frame, horizontally overlapping boxes.
  const columns: string[][] = [];
  const parentOf = (id: string) => byId.get(id)?.parent ?? "";
  for (const id of [...ids].sort(
    (a, b) => (placed[a]?.y ?? 0) - (placed[b]?.y ?? 0) || compare(a, b),
  )) {
    const box = placed[id];
    if (!box) continue;
    const column = columns.find((list) =>
      list.some((other) => {
        const o = placed[other] as RouteBox;
        return (
          parentOf(other) === parentOf(id) &&
          Math.min(o.x + o.width, box.x + box.width) - Math.max(o.x, box.x) > 0
        );
      }),
    );
    if (column) column.push(id);
    else columns.push([id]);
  }
  return { nodes: placed, routes, columns };
}

/**
 * Deterministic: same nodes, relationships, label widths and order give the same geometry.
 * Disconnected islands lay out separately and pack left-to-right, then top-to-bottom.
 */
export async function layoutStudio(input: StudioLayoutInput, elk: ELK): Promise<StudioLayout> {
  const position = new Map(input.order.map((id, index) => [id, index]));
  const sorted = [...input.nodes].map((node) => node.id).sort(compare);
  const fallback = new Map(sorted.map((id, index) => [id, input.order.length + index]));
  const rank = (id: string) => position.get(id) ?? fallback.get(id) ?? 0;
  const { groups } = islands(input, rank);
  const laid = [];
  for (const ids of groups) laid.push(await layoutIsland(input, ids, rank, elk));
  const measured = laid.map((island) => {
    const box = bounds([
      ...Object.values(island.nodes),
      ...Object.values(island.routes).flatMap((route) => [
        ...route.points.map((p) => ({ ...p, width: 0, height: 0 })),
        ...(route.label ? [route.label] : []),
      ]),
    ]);
    const x = floorGrid(box.x),
      y = floorGrid(box.y);
    return {
      island,
      x,
      y,
      width: ceilGrid(box.x + box.width) - x,
      height: ceilGrid(box.y + box.height) - y,
      first: Math.min(...Object.keys(island.nodes).map(rank)),
    };
  });
  measured.sort((a, b) => b.width * b.height - a.width * a.height || a.first - b.first);
  const area = measured.reduce((sum, item) => sum + item.width * item.height, 0);
  const limit = Math.max(0, ...measured.map((item) => item.width), Math.sqrt(area * 1.6));
  const result: StudioLayout = { nodes: {}, routes: {}, columns: [] };
  let x = 0,
    y = 0,
    row = 0;
  for (const item of measured) {
    if (x > 0 && x + item.width > limit) {
      x = 0;
      y += row + ISLAND_GAP;
      row = 0;
    }
    const dx = x - item.x,
      dy = y - item.y;
    const move = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
    for (const [id, box] of Object.entries(item.island.nodes))
      result.nodes[id] = { ...box, ...move(box) };
    for (const [id, route] of Object.entries(item.island.routes)) {
      const points = route.points.map(move);
      result.routes[id] = {
        ...route,
        points,
        path: routePath(points),
        ...(route.label && { label: { ...route.label, ...move(route.label) } }),
        ...(route.junction && { junction: move(route.junction) }),
      };
    }
    result.columns.push(...item.island.columns);
    x += item.width + ISLAND_GAP;
    row = Math.max(row, item.height);
  }
  return result;
}

/** 24px padding per side, including routed bends and labels; never zoom past actual size. */
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
  const box = bounds(boxes);
  const w = Math.max(1, box.width),
    h = Math.max(1, box.height);
  const zoom = Math.min(1, Math.max(0.1, Math.min((width - 48) / w, (height - 48) / h)));
  return {
    x: (width - w * zoom) / 2 - box.x * zoom,
    y: (height - h * zoom) / 2 - box.y * zoom,
    zoom,
  };
}

/** Does a camera show any of the diagram? Stale cameras from older layouts are refitted. */
export function studioCameraShows(
  camera: Viewport,
  nodes: Record<string, RouteBox>,
  width: number,
  height: number,
): boolean {
  return Object.values(nodes).some((box) => {
    const left = box.x * camera.zoom + camera.x,
      top = box.y * camera.zoom + camera.y;
    return (
      left < width &&
      top < height &&
      left + box.width * camera.zoom > 0 &&
      top + box.height * camera.zoom > 0
    );
  });
}

/** Derived view geometry only. Stable input ordering makes layout independent of API array order. */
import type { ArchitectureProjection } from "@jeeves/spec";
import type { ElkNode, ElkPoint, LayoutOptions } from "elkjs/lib/elk-api.js";

export const CARD = { width: 252, height: 188 };
export const SCOPE_ID = "architecture:scope";
const PACK_ID = "architecture:independent";
export interface Box extends ElkPoint {
  width: number;
  height: number;
}
export interface RelationGeometry {
  points: ElkPoint[];
  label: Box;
}
export interface ArchitectureGeometry {
  nodes: Record<string, Box>;
  edges: Record<string, RelationGeometry>;
  scope?: Box;
  groups?: Record<string, Box>;
}
const compare = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function labelSize(text: string, detailed = false): { width: number; height: number } {
  // Deliberately conservative, independent of browser font loading. CSS clamps to this box.
  const length = Array.from(text).length;
  const characterWidth = detailed ? 11.5 : 7.5;
  const width = Math.min(detailed ? 240 : 176, Math.max(56, length * characterWidth + 20));
  const lines = Math.min(3, Math.max(1, Math.ceil((length * characterWidth) / (width - 20))));
  return { width, height: Math.max(42, lines * (detailed ? 24 : 17) + 12) };
}

export function architectureLayoutInput(
  projection: ArchitectureProjection,
  down: boolean,
): ElkNode {
  const options: LayoutOptions = {
    "elk.algorithm": "layered",
    "elk.direction": down ? "DOWN" : "RIGHT",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.json.shapeCoords": "ROOT",
    "elk.json.edgeCoords": "ROOT",
    // Stable sorted input + seed; model-order strategy breaks sparse compound graphs in ELK 0.12.
    "elk.randomSeed": "1",
    "elk.padding": "[top=48,left=28,bottom=28,right=28]",
    "elk.spacing.nodeNode": "48",
    "elk.spacing.edgeNode": "24",
    "elk.spacing.edgeEdge": "24",
    "elk.spacing.edgeLabel": "10",
    "elk.layered.spacing.nodeNodeBetweenLayers": "28",
    "elk.layered.spacing.edgeNodeBetweenLayers": "24",
    "elk.layered.mergeEdges": "false",
  };
  const nodes = [...projection.nodes].sort(compare);
  const inside = new Set(
    nodes
      .filter(
        (node) =>
          node.binding &&
          (projection.level === "containers"
            ? node.kind !== "external-system" && node.kind !== "binding"
            : projection.level === "components" && node.binding.element === projection.container),
      )
      .map((node) => node.id),
  );
  const children: ElkNode[] = nodes
    .filter((node) => !inside.has(node.id))
    .map((node) => ({ id: node.id, ...CARD }));
  const connected = new Set(projection.edges.flatMap((edge) => [edge.from, edge.to]));
  const inner = nodes
    .filter((node) => inside.has(node.id))
    .map((node) => ({ id: node.id, ...CARD }));
  const independent = inner.filter((node) => !connected.has(node.id));
  const packed: ElkNode[] =
    independent.length < 3
      ? inner
      : [
          ...inner.filter((node) => connected.has(node.id)),
          {
            id: PACK_ID,
            layoutOptions: {
              "elk.algorithm": "box",
              "elk.hierarchyHandling": "SEPARATE_CHILDREN",
              "elk.aspectRatio": down ? "1.6" : "3",
              "elk.spacing.nodeNode": "32",
              "elk.padding": "[top=0,left=0,bottom=0,right=0]",
            },
            children: independent,
          },
        ];
  if (inside.size)
    children.push({
      id: SCOPE_ID,
      layoutOptions: options,
      children: packed,
    });
  if (projection.groups) {
    const groupChildren = (parent?: string): ElkNode[] =>
      [
        ...nodes.filter((n) => n.parent === parent).map((n) => ({ id: n.id, ...CARD })),
        ...projection
          .groups!.filter((g) => g.parent === parent)
          .map((g) => ({
            id: g.id,
            layoutOptions: options,
            children: groupChildren(g.id),
            // Empty placement boundaries remain visible before the first instance is assigned.
            width: CARD.width + 56,
            height: CARD.height + 76,
          })),
      ].sort(compare);
    children.splice(0, children.length, ...groupChildren());
  }
  const known = new Set(nodes.map((node) => node.id));
  if (projection.edges.some((edge) => !known.has(edge.from) || !known.has(edge.to)))
    throw new Error("A relationship references an unavailable architecture object.");
  return {
    id: "architecture:root",
    layoutOptions: options,
    children: children.sort(compare),
    edges: [...projection.edges].sort(compare).map((edge) => ({
      id: edge.id,
      sources: [edge.from],
      targets: [edge.to],
      labels: [
        {
          text: edge.description,
          ...(() => {
            const size = labelSize(edge.description, projection.level !== "context");
            return {
              ...size,
              height:
                size.height +
                (edge.protocol ? 26 : 0) +
                (edge.planned ? 28 : 0) +
                (edge.contractCount ? 24 : 0),
            };
          })(),
          layoutOptions: { "elk.edgeLabels.inline": "true" },
        },
      ],
    })),
  };
}

function box(shape: Partial<Box>): Box {
  const { x, y, width, height } = shape;
  if (![x, y, width, height].every((value) => typeof value === "number" && Number.isFinite(value)))
    throw new Error("Architecture layout returned incomplete geometry.");
  return { x: x as number, y: y as number, width: width as number, height: height as number };
}

/** ROOT coordinate options apply to cards, edge sections and labels, including nested children. */
export function architectureGeometry(root: ElkNode): ArchitectureGeometry {
  const result: ArchitectureGeometry = { nodes: {}, edges: {} };
  const visit = (node: ElkNode) => {
    if (node.id.startsWith("deployment-group:")) {
      result.groups ??= {};
      result.groups[node.id] = box(node);
    } else if (node.id === SCOPE_ID) result.scope = box(node);
    else if (node.id !== root.id && node.id !== PACK_ID) result.nodes[node.id] = box(node);
    for (const edge of node.edges ?? []) {
      const section = edge.sections?.[0];
      if (!section || edge.sections?.length !== 1 || !edge.labels?.[0])
        throw new Error("Architecture layout returned an incomplete relationship.");
      const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
      if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)))
        throw new Error("Architecture layout returned an invalid relationship.");
      result.edges[edge.id] = { points, label: box(edge.labels[0]) };
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return result;
}

export function relationshipPath(points: ElkPoint[]): string {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x},${point.y}`).join(" ");
}

/** Camera bounds include labels and routed bends, which can extend beyond every card. */
export function architectureBounds(geometry: ArchitectureGeometry): Box {
  const boxes = [
    ...Object.values(geometry.nodes),
    ...Object.values(geometry.groups ?? {}),
    ...(geometry.scope ? [geometry.scope] : []),
    ...Object.values(geometry.edges).flatMap((edge) => [
      edge.label,
      ...edge.points.map((point) => ({ ...point, width: 0, height: 0 })),
    ]),
  ];
  if (!boxes.length) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(...boxes.map((item) => item.x));
  const y = Math.min(...boxes.map((item) => item.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((item) => item.x + item.width)) - x,
    height: Math.max(...boxes.map((item) => item.y + item.height)) - y,
  };
}

/** Re-route incident edges after a manual move; reserve labels outside cards and other labels. */
export function positionedArchitectureGeometry(
  base: ArchitectureGeometry,
  projection: ArchitectureProjection,
  positions: Record<string, ElkPoint>,
): ArchitectureGeometry {
  const moved = Object.keys(positions).filter(
    (id) =>
      base.nodes[id] &&
      (positions[id]?.x !== base.nodes[id]?.x || positions[id]?.y !== base.nodes[id]?.y),
  );
  if (!moved.length) return base;
  const nodes = Object.fromEntries(
    Object.entries(base.nodes).map(([id, box]) => [id, { ...box, ...positions[id] }]),
  );
  const overlaps = (a: Box, b: Box) =>
    a.x < b.x + b.width + 8 &&
    a.x + a.width + 8 > b.x &&
    a.y < b.y + b.height + 8 &&
    a.y + a.height + 8 > b.y;
  const reserved = [...Object.values(nodes)];
  const edges: ArchitectureGeometry["edges"] = {};
  for (const edge of [...projection.edges].sort(compare)) {
    const original = base.edges[edge.id];
    const from = nodes[edge.from],
      to = nodes[edge.to];
    if (!original || !from || !to) continue;
    let points = original.points;
    let label = original.label;
    if (reserved.some((box) => overlaps(label, box))) {
      const center = {
        x: (from.x + to.x + from.width) / 2 - label.width / 2,
        y: (from.y + to.y) / 2,
      };
      // A bounded search with a guaranteed clear fallback beyond all cards/labels.
      const candidates = Array.from({ length: 80 }, (_, index) => ({
        ...label,
        x: center.x + ((index % 5) - 2) * (label.width + 20),
        y: center.y + Math.floor(index / 5) * (label.height + 20),
      }));
      label = candidates.find((candidate) => !reserved.some((box) => overlaps(candidate, box))) ?? {
        ...label,
        x: Math.max(...reserved.map((box) => box.x + box.width)) + 24,
      };
    }
    if (moved.includes(edge.from) || moved.includes(edge.to) || label !== original.label) {
      const start = { x: from.x + from.width, y: from.y + from.height / 2 };
      const end = { x: to.x, y: to.y + to.height / 2 };
      const labelY = label.y + label.height / 2;
      points = [
        start,
        { x: start.x + 24, y: start.y },
        { x: start.x + 24, y: labelY },
        { x: label.x, y: labelY },
        { x: label.x + label.width, y: labelY },
        { x: end.x - 24, y: labelY },
        { x: end.x - 24, y: end.y },
        end,
      ];
    }
    reserved.push(label);
    edges[edge.id] = { points, label };
  }
  const inner = projection.nodes
    .filter(
      (node) =>
        node.binding &&
        node.kind !== "external-system" &&
        node.kind !== "binding" &&
        (projection.level === "containers" || node.binding.element === projection.container),
    )
    .flatMap((node) => (nodes[node.id] ? [nodes[node.id]!] : []));
  const scope =
    base.scope && inner.length
      ? {
          x: Math.min(...inner.map((box) => box.x)) - 28,
          y: Math.min(...inner.map((box) => box.y)) - 48,
          width:
            Math.max(...inner.map((box) => box.x + box.width)) -
            Math.min(...inner.map((box) => box.x)) +
            56,
          height:
            Math.max(...inner.map((box) => box.y + box.height)) -
            Math.min(...inner.map((box) => box.y)) +
            76,
        }
      : base.scope;
  const groups: Record<string, Box> = {};
  const groupBounds = (id: string): Box => {
    const children = [
      ...projection.nodes
        .filter((n) => n.parent === id)
        .flatMap((n) => (nodes[n.id] ? [nodes[n.id]!] : [])),
      ...(projection.groups ?? []).filter((g) => g.parent === id).map((g) => groupBounds(g.id)),
    ];
    if (!children.length) {
      groups[id] = base.groups![id]!;
      return groups[id]!;
    }
    const x = Math.min(...children.map((b) => b.x)) - 28;
    const y = Math.min(...children.map((b) => b.y)) - 48;
    groups[id] = {
      x,
      y,
      width: Math.max(...children.map((b) => b.x + b.width)) - x + 28,
      height: Math.max(...children.map((b) => b.y + b.height)) - y + 28,
    };
    return groups[id]!;
  };
  if (base.groups) for (const group of projection.groups ?? []) groupBounds(group.id);
  return { nodes, edges, ...(scope && { scope }), ...(base.groups && { groups }) };
}

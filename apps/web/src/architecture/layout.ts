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
              height: size.height + (edge.protocol ? 26 : 0) + (edge.planned ? 28 : 0),
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
    if (node.id === SCOPE_ID) result.scope = box(node);
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

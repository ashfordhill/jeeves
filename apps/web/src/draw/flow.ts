/**
 * Maps the design and layout documents to React Flow nodes and edges. Elements, text, notes and
 * frames are nodes; connections and bound arrows are edges. Arrows with a free end are drawn by
 * FreeArrows from layout points instead, since React Flow edges need a node at both ends.
 */
import type { TemplateDescription } from "@jeeves/registry";
import type {
  Annotation,
  Attachment,
  Connection,
  DesignDocument,
  Element,
  LayoutDocument,
  LayoutItem,
} from "@jeeves/spec";
import { type Edge, MarkerType, type Node } from "@xyflow/react";

export type TemplateIndex = ReadonlyMap<string, TemplateDescription>;

export const templateKey = (ref: { id: string; version: string }) => `${ref.id}@${ref.version}`;

export type ElementNodeData = {
  element: Element;
  template: TemplateDescription | undefined;
  attachments: { attachment: Attachment; template: TemplateDescription | undefined }[];
};
export type AnnotationNodeData = { annotation: Annotation };

export type ElementNode = Node<ElementNodeData, "element">;
export type AnnotationNode = Node<AnnotationNodeData, "text" | "note" | "frame">;
export type BoardNode = ElementNode | AnnotationNode;

export type ConnectionEdgeData = { connection: Connection };
export type ArrowEdgeData = { annotation: Extract<Annotation, { kind: "arrow" }> };
export type BoardEdge = Edge<ConnectionEdgeData, "connection"> | Edge<ArrowEdgeData, "arrow">;

/** Handle IDs: an element's own ports are `in`/`out`; an attachment's are `in:<id>`/`out:<id>`. */
export const handleId = (side: "in" | "out", attachment?: string) =>
  attachment ? `${side}:${attachment}` : side;

export function attachmentFromHandle(handle: string | null | undefined): string | undefined {
  const at = handle?.indexOf(":") ?? -1;
  return handle && at > 0 ? handle.slice(at + 1) : undefined;
}

export const FRAME_SIZE = { width: 480, height: 320 };
export const NOTE_SIZE = { width: 180, height: 120 };

// React Flow puts the color in an inline style, so a CSS variable follows the theme.
const ARROW_HEAD = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--line)" };

const GRID_GAP = { x: 340, y: 240 };

/** Where an item with no layout entry goes: a simple grid below the origin, in document order. */
export function fallbackPosition(index: number): { x: number; y: number } {
  return { x: (index % 4) * GRID_GAP.x, y: Math.floor(index / 4) * GRID_GAP.y };
}

/**
 * Builds the node list. `previous` carries over what React Flow measured and what's selected,
 * so rebuilding after an edit doesn't make nodes flicker or lose selection.
 */
export function buildNodes(
  design: DesignDocument,
  layout: LayoutDocument,
  templates: TemplateIndex,
  previous: readonly BoardNode[] = [],
): BoardNode[] {
  const prev = new Map(previous.map((node) => [node.id, node]));
  let unplaced = 0;
  const place = (id: string): LayoutItem => layout.items[id] ?? fallbackPosition(unplaced++);
  const carry = (id: string) => {
    const old = prev.get(id);
    return {
      ...(old?.measured ? { measured: old.measured } : {}),
      ...(old?.selected ? { selected: true } : {}),
    };
  };

  const nodes: BoardNode[] = [];
  for (const annotation of design.annotations) {
    if (annotation.kind === "arrow") continue;
    const item = place(annotation.id);
    const base = {
      id: annotation.id,
      position: { x: item.x, y: item.y },
      data: { annotation },
      ...carry(annotation.id),
    };
    if (annotation.kind === "frame") {
      nodes.push({
        ...base,
        type: "frame",
        zIndex: -1,
        width: item.width ?? FRAME_SIZE.width,
        height: item.height ?? FRAME_SIZE.height,
      });
    } else if (annotation.kind === "note") {
      nodes.push({
        ...base,
        type: "note",
        width: item.width ?? NOTE_SIZE.width,
        height: item.height ?? NOTE_SIZE.height,
      });
    } else {
      nodes.push({ ...base, type: "text" });
    }
  }
  for (const element of design.elements) {
    const item = place(element.id);
    nodes.push({
      id: element.id,
      type: "element",
      ...(item.width ? { width: item.width } : element.planned ? { width: 280 } : {}),
      ...(item.height && { height: item.height }),
      position: { x: item.x, y: item.y },
      data: {
        element,
        template: element.template ? templates.get(templateKey(element.template)) : undefined,
        attachments: element.attachments.map((attachment) => ({
          attachment,
          template: templates.get(templateKey(attachment.template)),
        })),
      },
      ...carry(element.id),
    });
  }
  return nodes;
}

/** Node and handle for a design ID: elements and annotations are nodes, attachments are handles. */
function anchor(design: DesignDocument, id: string, side: "in" | "out") {
  for (const element of design.elements) {
    if (element.id === id) return { node: id, handle: handleId(side) };
    if (element.attachments.some((a) => a.id === id)) {
      return { node: element.id, handle: handleId(side, id) };
    }
  }
  const annotation = design.annotations.find((a) => a.id === id);
  return annotation && annotation.kind !== "arrow"
    ? { node: id, handle: handleId(side) }
    : undefined;
}

export function buildEdges(
  design: DesignDocument,
  previous: readonly BoardEdge[] = [],
): BoardEdge[] {
  const selected = new Set(previous.filter((e) => e.selected).map((e) => e.id));
  const edges: BoardEdge[] = design.connections.map((connection) => ({
    id: connection.id,
    type: "connection",
    source: connection.from.element,
    sourceHandle: handleId("out"),
    target: connection.to.element,
    targetHandle: handleId("in"),
    data: { connection },
    markerEnd: ARROW_HEAD,
    ...(selected.has(connection.id) ? { selected: true } : {}),
  }));
  for (const annotation of design.annotations) {
    if (annotation.kind !== "arrow" || !annotation.from || !annotation.to) continue;
    const from = anchor(design, annotation.from, "out");
    const to = anchor(design, annotation.to, "in");
    if (!from || !to) continue;
    edges.push({
      id: annotation.id,
      type: "arrow",
      source: from.node,
      sourceHandle: from.handle,
      target: to.node,
      targetHandle: to.handle,
      data: { annotation },
      markerEnd: ARROW_HEAD,
      ...(selected.has(annotation.id) ? { selected: true } : {}),
    });
  }
  return edges;
}

/** Arrows React Flow can't draw as edges: at least one end unbound. */
export function freeArrows(design: DesignDocument) {
  return design.annotations.filter(
    (a): a is Extract<Annotation, { kind: "arrow" }> => a.kind === "arrow" && (!a.from || !a.to),
  );
}

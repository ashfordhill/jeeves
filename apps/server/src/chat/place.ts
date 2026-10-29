/**
 * Auto-placement for items the chat agent adds (PLAN §7): new items are laid out among themselves
 * with ELK, then the block goes beside the selection, or beside everything else when nothing is
 * selected, moved down until it overlaps nothing. Existing items never move.
 */
import type { DesignDocument, LayoutDocument, LayoutItem } from "@jeeves/spec";
import ELK from "elkjs/lib/elk.bundled.js";

type Size = { width: number; height: number };
type Box = { x: number; y: number; width: number; height: number };

// Rough card sizes; the canvas measures the real ones. Keep in sync with apps/web draw.css.
const ELEMENT_WIDTH = 260;
const ELEMENT_BASE_HEIGHT = 110;
const ATTACHMENT_HEIGHT = 34;
const ANNOTATION_SIZES = {
  text: { width: 200, height: 40 },
  note: { width: 180, height: 120 },
  frame: { width: 480, height: 320 },
} as const;
const GAP = 120;
const EMPTY_BOARD_ORIGIN = { x: 80, y: 80 };

const elk = new ELK();

/** Sizes of everything on the board that takes space, keyed by ID. */
function sizes(design: DesignDocument): Map<string, Size> {
  const result = new Map<string, Size>();
  for (const element of design.elements) {
    result.set(element.id, {
      width: ELEMENT_WIDTH,
      height: ELEMENT_BASE_HEIGHT + ATTACHMENT_HEIGHT * element.attachments.length,
    });
  }
  for (const annotation of design.annotations) {
    if (annotation.kind !== "arrow") result.set(annotation.id, ANNOTATION_SIZES[annotation.kind]);
  }
  return result;
}

function boxOf(item: LayoutItem, size: Size): Box {
  return {
    x: item.x,
    y: item.y,
    width: item.width ?? size.width,
    height: item.height ?? size.height,
  };
}

function bounds(boxes: readonly Box[]): Box | undefined {
  if (boxes.length === 0) return undefined;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const overlaps = (a: Box, b: Box, margin = 40) =>
  a.x < b.x + b.width + margin &&
  b.x < a.x + a.width + margin &&
  a.y < b.y + b.height + margin &&
  b.y < a.y + a.height + margin;

/** Layout entries for the board items that have none yet. */
export async function placeNewItems(
  design: DesignDocument,
  layout: LayoutDocument,
  selection: readonly string[] = [],
): Promise<Record<string, LayoutItem>> {
  const all = sizes(design);
  const fresh = [...all].filter(([id]) => !layout.items[id]);
  if (fresh.length === 0) return {};

  const freshIds = new Set(fresh.map(([id]) => id));
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "60",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      "elk.separateConnectedComponents": "true",
    },
    children: fresh.map(([id, size]) => ({ id, ...size })),
    edges: design.connections
      .filter((c) => freshIds.has(c.from.element) && freshIds.has(c.to.element))
      .map((c) => ({ id: c.id, sources: [c.from.element], targets: [c.to.element] })),
  });
  const placed = (graph.children ?? []).map((node) => ({
    id: node.id,
    x: node.x ?? 0,
    y: node.y ?? 0,
    width: node.width ?? 0,
    height: node.height ?? 0,
  }));
  const block = bounds(placed);
  if (!block) return {};

  const existing: Box[] = [];
  const selected: Box[] = [];
  for (const [id, size] of all) {
    const item = layout.items[id];
    if (!item) continue;
    const box = boxOf(item, size);
    existing.push(box);
    if (selection.includes(id)) selected.push(box);
  }
  const anchor = bounds(selected) ?? bounds(existing);
  let origin = anchor ? { x: anchor.x + anchor.width + GAP, y: anchor.y } : EMPTY_BOARD_ORIGIN;
  const at = (o: { x: number; y: number }): Box => ({ ...block, x: o.x, y: o.y });
  for (let tries = 0; tries < 40 && existing.some((b) => overlaps(at(origin), b)); tries++) {
    origin = { x: origin.x, y: origin.y + 80 };
  }
  if (existing.some((b) => overlaps(at(origin), b))) {
    const everything = bounds(existing) as Box;
    origin = { x: everything.x + everything.width + GAP, y: everything.y };
  }

  const items: Record<string, LayoutItem> = {};
  for (const node of placed) {
    items[node.id] = {
      x: Math.round(origin.x + node.x - block.x),
      y: Math.round(origin.y + node.y - block.y),
    };
  }
  return items;
}

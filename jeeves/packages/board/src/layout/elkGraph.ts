// Ported from automation-illustrator src/board/layout/elkGraph.ts (0803c4a).
// The ELK input graph for one board. The first layout follows input order (ELK model order).
// When previous positions are passed, tiles and lines are ordered by them instead, so forks keep
// the rows they were shown in.
//
// Changes from automation-illustrator: horizontal only and no word-web mode; tiles and lines come
// in as plain sizes, and a line's chip is an icon box with no text; there are no stored
// positions, so a tile without a previous position is hinted beside its first placed source, and
// the first layout already uses the stability layering (see `STABILITY_OPTIONS`); lines that meet
// in a gap run 32px apart, on the grid; tiles and lines may carry a band (`bands.ts`).
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api.js";
import { BRANCH_GAP, dockHint, GRID, type Point, type Size, TILE_GAP } from "./metrics.ts";

/**
 * A tile. `band` stacks it in a horizontal strip: every tile of a lower band sits above every
 * tile of a higher one (`bands.ts`).
 */
export type LayoutTile = { id: string; band?: number } & Size;
/**
 * A link between two tiles. `chip` is a box drawn on the line, which ELK keeps clear. `band` keeps
 * it apart from lines of other bands: they share no run, except the 32px next to a port both use.
 */
export type LayoutLine = { id: string; source: string; target: string; chip?: Size; band?: number };
export type LayoutInput = { tiles: LayoutTile[]; lines: LayoutLine[] };
/** Tile id → top-left: the previously displayed positions plus hints for new tiles. */
export type PositionMap = Record<string, Point>;

/**
 * Layered, left to right, orthogonal, hyperedges bundled at shared ports, on the 32px grid. Lines
 * that turn in the same gap between columns run 32px apart, so every vertical run and every column
 * sits on a grid line.
 */
export const ROOT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.padding": `[top=${GRID},left=${GRID},bottom=${GRID},right=${GRID}]`,
  "elk.spacing.nodeNode": String(BRANCH_GAP),
  "elk.layered.spacing.nodeNodeBetweenLayers": String(TILE_GAP),
  "elk.layered.spacing.edgeNodeBetweenLayers": "32",
  "elk.layered.spacing.edgeEdgeBetweenLayers": String(GRID),
  "elk.spacing.edgeNode": "16",
  "elk.spacing.edgeEdge": "16",
  "elk.spacing.edgeLabel": "8",
  "elk.edgeLabels.placement": "CENTER",
  "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  /* BALANCED centers a fan-out parent on its children and keeps 1:1 chains straight
     (the default alignment sat the parent level with its first child). */
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.layered.thoroughness": "10",
  "elk.layered.mergeEdges": "true",
  "elk.separateConnectedComponents": "false",
  "elk.layered.wrapping.strategy": "OFF",
  "elk.aspectRatio": "1.6",
};

/**
 * Source-rank layers and the row order seeded from the input (positions, once shown). Every
 * layout uses them, the first one too: automation-illustrator always has stored positions, so its
 * boards are always laid out this way, while a first NETWORK_SIMPLEX layout here would move tiles
 * to other columns on the first edit.
 */
export const STABILITY_OPTIONS: Record<string, string> = {
  "elk.layered.layering.strategy": "LONGEST_PATH_SOURCE",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
};

export const NODE_OPTIONS: Record<string, string> = {
  "elk.portConstraints": "FIXED_POS",
};

export const PORT_OPTIONS_IN: Record<string, string> = { "elk.port.side": "WEST" };
export const PORT_OPTIONS_OUT: Record<string, string> = { "elk.port.side": "EAST" };

/** ELK honors `inline` only on the label element itself, not on the root. */
export const LABEL_OPTIONS: Record<string, string> = {
  "elk.edgeLabels.inline": "true",
};

/** Every option id this module sends, for the known-options unit check. */
export function usedOptionIds(): string[] {
  return [
    ...Object.keys(ROOT_OPTIONS),
    ...Object.keys(STABILITY_OPTIONS),
    ...Object.keys(NODE_OPTIONS),
    ...Object.keys(PORT_OPTIONS_IN),
    ...Object.keys(PORT_OPTIONS_OUT),
    ...Object.keys(LABEL_OPTIONS),
  ];
}

export function inPortId(tileId: string): string {
  return `${tileId}__in`;
}

export function outPortId(tileId: string): string {
  return `${tileId}__out`;
}

export function chipId(lineId: string): string {
  return `${lineId}__chip`;
}

/** One ELK child: a tile with fixed ports at mid-height, `inPorts` west and `outPorts` east. */
export function elkTile(
  t: LayoutTile,
  inPorts: readonly string[] = [inPortId(t.id)],
  outPorts: readonly string[] = [outPortId(t.id)],
): ElkNode {
  return {
    id: t.id,
    width: t.w,
    height: t.h,
    layoutOptions: { ...NODE_OPTIONS },
    ports: [
      ...inPorts.map((id) => ({
        id,
        x: 0,
        y: t.h / 2,
        width: 0,
        height: 0,
        layoutOptions: { ...PORT_OPTIONS_IN },
      })),
      ...outPorts.map((id) => ({
        id,
        x: t.w,
        y: t.h / 2,
        width: 0,
        height: 0,
        layoutOptions: { ...PORT_OPTIONS_OUT },
      })),
    ],
  };
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Previous positions, plus one for each tile that has none (one added by chat, say): beside its
 * first placed source, on that source's row. Null on a first layout.
 */
export function stabilityHints(
  input: LayoutInput,
  previous: PositionMap | undefined,
): Map<string, Point> | null {
  if (!previous || !input.tiles.some((t) => previous[t.id])) return null;
  const sizes = new Map(input.tiles.map((t) => [t.id, t]));
  const hints = new Map<string, Point>();
  for (const t of input.tiles) {
    const p = previous[t.id];
    if (p) hints.set(t.id, p);
  }
  let placed = true;
  while (placed) {
    placed = false;
    for (const line of input.lines) {
      const at = hints.get(line.source);
      const source = sizes.get(line.source);
      const tile = sizes.get(line.target);
      if (!at || !source || !tile || hints.has(line.target)) continue;
      hints.set(line.target, dockHint({ ...at, w: source.w, h: source.h }, tile, 0, []));
      placed = true;
    }
  }
  return hints;
}

/** Row order first (y), then column (x), then id. */
export function byHint(a: string, b: string, hints: Map<string, Point>): number {
  const pa = hints.get(a) ?? { x: 0, y: 0 };
  const pb = hints.get(b) ?? { x: 0, y: 0 };
  return pa.y - pb.y || pa.x - pb.x || compareIds(a, b);
}

/**
 * Flat root graph: one child per tile with fixed west/east ports at mid-height, one edge per
 * line, and one inline centre label per line with a chip.
 */
export function buildElkGraph(input: LayoutInput, previous?: PositionMap): ElkNode {
  const hints = stabilityHints(input, previous);
  const tiles = hints ? [...input.tiles].sort((a, b) => byHint(a.id, b.id, hints)) : input.tiles;
  const lines = hints
    ? [...input.lines].sort(
        (a, b) => byHint(a.target, b.target, hints) || byHint(a.source, b.source, hints),
      )
    : input.lines;

  const children: ElkNode[] = tiles.map((t) => elkTile(t));
  const edges: ElkExtendedEdge[] = lines.map((line) => {
    const edge: ElkExtendedEdge = {
      id: line.id,
      sources: [outPortId(line.source)],
      targets: [inPortId(line.target)],
    };
    const chip = line.chip;
    if (chip && chip.w > 0 && chip.h > 0) {
      edge.labels = [
        {
          id: chipId(line.id),
          // ELK ignores a label with empty text; the chip's text is never drawn.
          text: chipId(line.id),
          width: chip.w,
          height: chip.h,
          layoutOptions: { ...LABEL_OPTIONS },
        },
      ];
    }
    return edge;
  });
  return {
    id: "root",
    layoutOptions: { ...ROOT_OPTIONS, ...STABILITY_OPTIONS },
    children,
    edges,
  };
}

/**
 * Cache key for one graph: tile ids, sizes and bands, line endpoints, chip sizes and bands, in
 * input order (ELK follows model order). Not names, kinds or dashes, which do not move anything.
 */
export function graphKey(input: LayoutInput): string {
  return JSON.stringify([
    input.tiles.map((t) => [t.id, t.w, t.h, t.band ?? null]),
    input.lines.map((l) => [
      l.id,
      l.source,
      l.target,
      l.chip?.w ?? 0,
      l.chip?.h ?? 0,
      l.band ?? null,
    ]),
  ]);
}

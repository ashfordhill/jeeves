// The Detailed view's tiles, ports and lines: the lane graph with each module host drawn as a
// container, one row per module, and each module's own links drawn from or into its row. Pure view
// code; it never changes the design, and the Overview never uses it (`laneLayoutInput` stays its
// only input).
//
// Containers. An application tile with at least one module is a container: `CONTAINER.w` wide, a
// header, one `CONTAINER.row` row per module in `studio.components` order, then padding, the height
// rounded up to the grid. Row i's ports sit at `header + row * i + row / 2` (64, 96, … with the
// values below), the header's at `HEADER_PORT_Y`; the board puts the top of a tile with named
// ports on the grid, so every one is on a grid line. A row has an `in` port when a line enters it
// and an `out` port when one leaves it, so a module with no drawn line has a row with no port.
// Lines at the tile level use the header ports, never the container's default mid-height port,
// which is off the grid at most heights. Every other tile keeps its Overview size, band and
// default ports.
//
// Lines. For each lane edge from A to B, the source anchors are A's modules that link to B through
// it, and the target anchors are B's modules that link to A through it: a module reaches a tile
// only `via` a connection of its host, and its line follows that connection's direction, so a
// consumer's line runs channel → consumer. Without anchors the edge draws one line, with the
// edge's own ID; with anchors on one side, one line per anchor; on both sides, one per pair, in
// module order. An anchored line's ID is the edge ID and its module IDs joined by
// `LINE_SEPARATOR`, which no design ID contains. The user's lines and the entries attach at the
// tile level. An anchored line names the module link it shows (`disconnect`: its source module's,
// else its target module's), which Connect mode's X removes.
//
// Rows and in-process links. A row whose kind has slots can take connections (`connects`, a dot
// at its edge), filled once one of its slots is (`connected`). Of the links between modules of one
// tile, only the Cache reader's loader is drawn: a short arrow in the container's left gutter
// (`DetailedLoader`). Every other one stays saved and is neither drawn nor counted.
//
// Output order follows `laneLayoutInput`: tiles in node order, lines in edge order (an edge's
// lines together), so the result is a `LayoutInput` and its lines are `LineSpec`s.
import { GRID, type LayoutLine, type LayoutTile, type TilePort } from "@jeeves/board";
import {
  type DesignDocument,
  LANE_ACTOR,
  type LaneGraph,
  moduleLinkSlot,
  moduleSlots,
  type StudioComponentKind,
  studioComponentDefinitions,
} from "@jeeves/spec";
import { laneLayoutInput } from "./laneLayout.ts";

/** A container's width, header height, row pitch and bottom padding (px). */
export const CONTAINER = { w: 256, header: 48, row: 32, padding: 16 } as const;
/** The header's ports, for the container's own lines. */
export const HEADER_PORT_Y = GRID;
export const HEADER_IN = "header-in";
export const HEADER_OUT = "header-out";
/** A row's port. The colon keeps it apart from the header's ports and from other modules'. */
export const rowPort = (module: string, side: TilePort["side"]) => `${module}:${side}`;
/** Joins an edge ID and module IDs into a drawn line's ID; `idSchema` never produces it. */
export const LINE_SEPARATOR = "/";

/** A container's row: one module of its host, `y` px below the container's top. */
export type DetailedRow = {
  module: string;
  host: string;
  name: string;
  kind: StudioComponentKind;
  index: number;
  y: number;
  /** Its `in` port, when a line enters this row. */
  in?: string;
  /** Its `out` port, when a line leaves this row. */
  out?: string;
  /** Its kind takes connections (it has slots). */
  connects: boolean;
  /** At least one of its slots is connected. */
  connected: boolean;
};
/** The Cache reader's loader inside one container: an arrow from one row to another. */
export type DetailedLoader = {
  /** The module link. */
  link: string;
  /** The Cache reader. */
  from: string;
  /** The Data access it loads from. */
  to: string;
  label: string;
};
export type DetailedContainer = {
  tile: string;
  rows: readonly DetailedRow[];
  loaders: readonly DetailedLoader[];
};
/**
 * A drawn line. `connection` is its canonical lane edge (a connection, an entry or the user's
 * line), whose `dashed` and band it copies; `sourceModule`/`targetModule` are its anchors. It
 * has no chip, so it is both a `LayoutLine` and a `LineSpec`.
 */
export type DetailedLine = Omit<LayoutLine, "chip"> & {
  connection: string;
  dashed: boolean;
  directed: true;
  label: string;
  /** The user's line goes with its action, as in the Overview. */
  removable?: false;
  sourceModule?: string;
  targetModule?: string;
  /** The module link this line shows, and the words for removing it. */
  disconnect?: { link: string; label: string };
};
export type DetailedView = {
  /** One per lane node, in node order: containers resized and with ports, the rest as before. */
  tiles: LayoutTile[];
  /** At least one per lane edge, in edge order. */
  lines: DetailedLine[];
  containers: ReadonlyMap<string, DetailedContainer>;
  /** A drawn line's canonical lane edge. */
  connectionOf(line: string): string | undefined;
  /** A lane edge's drawn lines, in order. */
  linesOf(connection: string): readonly string[];
  rowOf(module: string): DetailedRow | undefined;
};

const containerHeight = (rows: number) =>
  Math.ceil((CONTAINER.header + CONTAINER.row * rows + CONTAINER.padding) / GRID) * GRID;
const rowY = (index: number) => CONTAINER.header + CONTAINER.row * index + CONTAINER.row / 2;

/**
 * The Detailed view of `graph` (`laneGraph(design)`). `name` gives a tile's, action's or the user's
 * name, as on the canvas; lines are labelled with it and with the modules' names.
 */
export function detailedView(
  design: DesignDocument,
  graph: LaneGraph,
  name: (id: string) => string,
): DetailedView {
  const studio = design.architecture?.studio;
  const tiles = new Set(graph.nodes.filter((node) => node.kind).map((node) => node.id));
  const components = (studio?.components ?? []).filter((item) => tiles.has(item.host));
  const order = new Map(components.map((item, i) => [item.id, i]));
  const byOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const modules = new Map(components.map((item) => [item.id, item]));

  const rows = new Map<string, DetailedRow>();
  const hosted = new Map<string, DetailedRow[]>();
  for (const item of components) {
    const own = hosted.get(item.host) ?? [];
    const row: DetailedRow = {
      module: item.id,
      host: item.host,
      name: item.name,
      kind: item.settings.kind,
      index: own.length,
      y: rowY(own.length),
      connects: studioComponentDefinitions[item.settings.kind].slots.length > 0,
      connected: moduleSlots(design, item.id).some((slot) => slot.links.length > 0),
    };
    own.push(row);
    hosted.set(item.host, own);
    rows.set(item.id, row);
  }

  // Each edge's anchors: the modules that reach a tile through it, and each one's link there.
  // The Cache reader's loader is the one link between modules of a tile that is drawn.
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const anchors = new Map<string, { source: string[]; target: string[] }>();
  const linkOf = new Map<string, string>();
  const loaders = new Map<string, DetailedLoader[]>();
  for (const link of studio?.componentConnections ?? []) {
    const from = modules.get(link.from);
    if (!from) continue;
    if (link.to.kind === "component") {
      const to = modules.get(link.to.id);
      if (!to || to.host !== from.host || !moduleLinkSlot(design, link)?.module) continue;
      const own = loaders.get(from.host) ?? [];
      own.push({ link: link.id, from: from.id, to: to.id, label: `${from.name} to ${to.name}` });
      loaders.set(from.host, own);
      continue;
    }
    const edge = edges.get(link.to.via);
    if (!edge) continue;
    const side =
      edge.source === from.host && edge.target === link.to.id
        ? "source"
        : edge.target === from.host && edge.source === link.to.id
          ? "target"
          : undefined;
    if (!side) continue;
    const ends = anchors.get(edge.id) ?? { source: [], target: [] };
    if (!ends[side].includes(from.id)) ends[side].push(from.id);
    anchors.set(edge.id, ends);
    const key = `${edge.id}${LINE_SEPARATOR}${from.id}`;
    if (!linkOf.has(key)) linkOf.set(key, link.id);
  }

  const input = laneLayoutInput(graph);
  const label = (tile: string, module: string | undefined) => {
    const item = module === undefined ? undefined : modules.get(module);
    return item ? `${item.name} (${name(tile)})` : name(tile);
  };
  const lines: DetailedLine[] = [];
  const connectionOf = new Map<string, string>();
  const linesOf = new Map<string, string[]>();
  for (const [i, edge] of graph.edges.entries()) {
    const band = input.lines[i]?.band;
    const ends = anchors.get(edge.id);
    const source = [...(ends?.source ?? [])].sort(byOrder);
    const target = [...(ends?.target ?? [])].sort(byOrder);
    const pairs: [string | undefined, string | undefined][] =
      source.length && target.length
        ? source.flatMap((s) => target.map((t): [string, string] => [s, t]))
        : source.length
          ? source.map((s) => [s, undefined])
          : target.length
            ? target.map((t) => [undefined, t])
            : [[undefined, undefined]];
    const own: string[] = [];
    for (const [s, t] of pairs) {
      const id = [edge.id, s, t].filter((part) => part !== undefined).join(LINE_SEPARATOR);
      const sourcePort =
        s !== undefined ? rowPort(s, "out") : hosted.has(edge.source) ? HEADER_OUT : undefined;
      const targetPort =
        t !== undefined ? rowPort(t, "in") : hosted.has(edge.target) ? HEADER_IN : undefined;
      // The module link this line shows: its source module's to the target tile, else its target
      // module's to the source tile.
      const [module, tile] = s !== undefined ? [s, edge.target] : [t, edge.source];
      const link =
        module === undefined ? undefined : linkOf.get(`${edge.id}${LINE_SEPARATOR}${module}`);
      const disconnect =
        link === undefined || module === undefined
          ? undefined
          : { link, label: `Disconnect ${modules.get(module)?.name} from ${name(tile)}` };
      lines.push({
        id,
        source: edge.source,
        target: edge.target,
        connection: edge.id,
        dashed: edge.dashed,
        directed: true,
        label: `${label(edge.source, s)} to ${label(edge.target, t)}`,
        ...(band !== undefined && { band }),
        ...(sourcePort !== undefined && { sourcePort }),
        ...(targetPort !== undefined && { targetPort }),
        ...(s !== undefined && { sourceModule: s }),
        ...(t !== undefined && { targetModule: t }),
        ...(disconnect && { disconnect }),
        ...(edge.source === LANE_ACTOR && { removable: false as const }),
      });
      connectionOf.set(id, edge.id);
      own.push(id);
      const from = s === undefined ? undefined : rows.get(s);
      const to = t === undefined ? undefined : rows.get(t);
      if (from) from.out = sourcePort;
      if (to) to.in = targetPort;
    }
    linesOf.set(edge.id, own);
  }

  // Containers take their size and the ports their lines use: the header's, then each row's.
  const containers = new Map<string, DetailedContainer>();
  const layoutTiles = input.tiles.map((tile): LayoutTile => {
    const own = hosted.get(tile.id);
    if (!own) return tile;
    containers.set(tile.id, { tile: tile.id, rows: own, loaders: loaders.get(tile.id) ?? [] });
    const header = (side: TilePort["side"], id: string): TilePort[] =>
      lines.some((line) =>
        side === "in"
          ? line.target === tile.id && line.targetPort === id
          : line.source === tile.id && line.sourcePort === id,
      )
        ? [{ id, side, y: HEADER_PORT_Y }]
        : [];
    const ports: TilePort[] = [
      ...header("in", HEADER_IN),
      ...header("out", HEADER_OUT),
      ...own.flatMap((row) => [
        ...(row.in ? [{ id: row.in, side: "in" as const, y: row.y }] : []),
        ...(row.out ? [{ id: row.out, side: "out" as const, y: row.y }] : []),
      ]),
    ];
    return {
      ...tile,
      w: CONTAINER.w,
      h: containerHeight(own.length),
      ...(ports.length > 0 && { ports }),
    };
  });

  return {
    tiles: layoutTiles,
    lines,
    containers,
    connectionOf: (line) => connectionOf.get(line),
    linesOf: (connection) => linesOf.get(connection) ?? [],
    rowOf: (module) => rows.get(module),
  };
}

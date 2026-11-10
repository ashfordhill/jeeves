// The workspace's selection: the board's tile or line, plus the module open in the inspector. Lines
// are canonical relationships; the Detailed view maps its drawn lines to and from them, and marks
// an open module's row and its own drawn lines.
import type { BoardSelection } from "@jeeves/board";
import type { DesignDocument, LaneGraph, Rekey } from "@jeeves/spec";
import type { DetailedView } from "./detailedView.ts";

/**
 * A tile or a line, as the board selects them, and with a tile, the ID of one of its modules
 * when that module is open in the inspector. `module` is never set without its host `tile`, so
 * selecting another tile or a line, or clearing, closes it. It is view state only: it never
 * reaches the design, history or blueprint.
 */
export type WorkspaceSelection = BoardSelection & { module?: string };

/**
 * The part of `pick` that still exists after an Undo, Redo or chat turn: a tile or line that is
 * gone falls back to none, and a module that is gone (or no longer in that tile) to its tile.
 */
export function liveSelection(
  design: DesignDocument,
  graph: LaneGraph,
  pick: WorkspaceSelection,
): WorkspaceSelection {
  if (pick.tile && graph.nodes.some((node) => node.id === pick.tile)) {
    const open =
      pick.module &&
      design.architecture?.studio?.components?.some(
        (item) => item.id === pick.module && item.host === pick.tile,
      );
    return open ? { tile: pick.tile, module: pick.module } : { tile: pick.tile };
  }
  if (pick.line && graph.edges.some((edge) => edge.id === pick.line)) return { line: pick.line };
  return {};
}

/** The ID `renamed` (in order) moves `id` to. */
const followId = (id: string, renamed: readonly Rekey[]) =>
  renamed.reduce((current, item) => (current === item.from ? item.to : current), id);

/**
 * The selection after a change re-keyed IDs (IDs follow names): the tile and the open module move
 * to their new IDs; a line keeps its ID (link IDs never change). The same object when nothing
 * moved.
 */
export function followSelection(
  pick: WorkspaceSelection,
  renamed: readonly Rekey[],
): WorkspaceSelection {
  const tile = pick.tile && followId(pick.tile, renamed);
  const module = pick.module && followId(pick.module, renamed);
  if (tile === pick.tile && module === pick.module) return pick;
  return { ...pick, ...(tile !== undefined && { tile }), ...(module !== undefined && { module }) };
}

/**
 * The inspector's page keys after a re-key: a new ID takes its old ID's key, so the page (and the
 * field being typed in) stays mounted, and the old ID gets a fresh key (`<id>~<revision>`), so a
 * tile created later with that ID opens its own page. Pure, for React's double renders.
 */
export function followKeys(
  keys: Readonly<Record<string, string>>,
  renamed: readonly Rekey[],
  revision: number,
): Record<string, string> {
  const next = { ...keys };
  for (const { from, to } of renamed) {
    next[to] = next[from] ?? from;
    next[from] = `${from}~${revision}`;
  }
  return next;
}

/**
 * The canonical relationship of a line drawn in the Detailed view (`DetailedView.connectionOf`).
 * The inspector, chat and removal only ever see this ID; an unanchored line already is its edge.
 */
export function canonicalLine(
  connectionOf: (line: string) => string | undefined,
  line: string,
): string {
  return connectionOf(line) ?? line;
}

/** What the Detailed view shows for a workspace selection (`drawnSelection`). */
export type DrawnSelection = {
  /** The board's selection: a tile (an open module's host too), or one drawn line. */
  selected: BoardSelection;
  /** Drawn lines in the selection colour beside the selected one. */
  highlighted: readonly string[];
  /**
   * Whether the selected tile's own lines take the selection colour (the board's
   * `selectedTileLines`): not while one of its modules is open, whose lines are `highlighted`.
   */
  selectedTileLines: boolean;
  /** The open module, whose row is marked. */
  open?: string;
  /**
   * The named ports (a row's `in`/`out`) at the ends of the drawn lines in the selection colour,
   * whatever made them blue, so a row's port mark matches its line.
   */
  lit: readonly string[];
};

/**
 * What the board and the containers show for a workspace selection in the Detailed view, where
 * one relationship may be drawn as several lines (`DetailedView.linesOf`): one of them is the
 * board's selected line (the one last clicked when it is one of them, else the first) and the
 * rest are highlighted in the selection colour. A tile stays the tile. With one of its modules
 * open, the host stays selected (its chrome too), but only the module's own drawn lines take the
 * selection colour and only its row is marked. Whatever makes a drawn line blue (its
 * relationship, its tile, the other end's tile or its open module), the named ports at its ends
 * are `lit`, so the rows' port marks turn blue with it.
 */
export function drawnSelection(
  view: Pick<DetailedView, "lines" | "linesOf" | "rowOf">,
  selection: WorkspaceSelection,
  clicked?: string,
): DrawnSelection {
  const lit = (blue: (line: DetailedView["lines"][number]) => boolean) => [
    ...new Set(
      view.lines
        .filter(blue)
        .flatMap((line) => [line.sourcePort, line.targetPort])
        .filter((port) => port !== undefined),
    ),
  ];
  if (selection.line) {
    const drawn = view.linesOf(selection.line);
    const line =
      clicked !== undefined && drawn.includes(clicked) ? clicked : (drawn[0] ?? selection.line);
    return {
      selected: { line },
      highlighted: drawn.filter((id) => id !== line),
      selectedTileLines: true,
      lit: lit((item) => drawn.includes(item.id)),
    };
  }
  const { tile, module } = selection;
  if (!tile) return { selected: {}, highlighted: [], selectedTileLines: true, lit: [] };
  if (module === undefined || view.rowOf(module)?.host !== tile)
    return {
      selected: { tile },
      highlighted: [],
      selectedTileLines: true,
      lit: lit((line) => line.source === tile || line.target === tile),
    };
  const own = (line: DetailedView["lines"][number]) =>
    line.sourceModule === module || line.targetModule === module;
  return {
    selected: { tile },
    highlighted: view.lines.filter(own).map((line) => line.id),
    selectedTileLines: false,
    open: module,
    lit: lit(own),
  };
}

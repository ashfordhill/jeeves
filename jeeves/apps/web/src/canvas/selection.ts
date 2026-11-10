// The workspace's selection: the board's tile or line, plus the module open in the inspector. Lines
// are canonical relationships; the Detailed view maps its drawn lines to and from them, and marks
// an open module's row, its drawn lines and its in-process partners' rows.
import type { BoardSelection } from "@jeeves/board";
import type { DesignDocument, LaneGraph } from "@jeeves/spec";
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
  /** The open module's row, and the rows of the modules of its tile it links with. */
  rows?: { open: string; partners: readonly string[] };
};

/**
 * What the board and the containers show for a workspace selection in the Detailed view, where
 * one relationship may be drawn as several lines (`DetailedView.linesOf`): one of them is the
 * board's selected line (the one last clicked when it is one of them, else the first) and the
 * rest are highlighted in the selection colour. A tile stays the tile. With one of its modules
 * open, the host stays selected (its chrome too), but only the module's own drawn lines take the
 * selection colour, its row is marked, and so are its in-process partners' rows (`partners`).
 */
export function drawnSelection(
  view: Pick<DetailedView, "lines" | "linesOf" | "rowOf" | "partners">,
  selection: WorkspaceSelection,
  clicked?: string,
): DrawnSelection {
  if (selection.line) {
    const drawn = view.linesOf(selection.line);
    const line =
      clicked !== undefined && drawn.includes(clicked) ? clicked : (drawn[0] ?? selection.line);
    return {
      selected: { line },
      highlighted: drawn.filter((id) => id !== line),
      selectedTileLines: true,
    };
  }
  const { tile, module } = selection;
  if (!tile) return { selected: {}, highlighted: [], selectedTileLines: true };
  if (module === undefined || view.rowOf(module)?.host !== tile)
    return { selected: { tile }, highlighted: [], selectedTileLines: true };
  return {
    selected: { tile },
    highlighted: view.lines
      .filter((line) => line.sourceModule === module || line.targetModule === module)
      .map((line) => line.id),
    selectedTileLines: false,
    rows: { open: module, partners: view.partners(module) },
  };
}

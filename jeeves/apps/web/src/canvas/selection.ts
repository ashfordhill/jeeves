// The workspace's selection: the board's tile or line, plus the module open in the inspector.
import type { BoardSelection } from "@jeeves/board";
import type { DesignDocument, LaneGraph } from "@jeeves/spec";

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

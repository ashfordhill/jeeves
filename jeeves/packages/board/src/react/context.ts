// Ported from automation-illustrator src/board/routing/LaneLayoutContext.ts (0803c4a).
// Shares the shown (animated) layout with the lines, which read their route and chip rect from
// it, the line selection callback with their chips, the remove callback of a line's X, and in
// connect mode how its X keeps the line hovered.
import { createContext, useContext } from "react";
import type { BoardLayout } from "../layout/elkLayout.ts";

export type BoardContextValue = {
  layout: BoardLayout | null;
  /** Selects a line; does nothing in hand mode. */
  selectLine: (id: string) => void;
  /** Removes a line: a selected (or, in connect mode, hovered) line shows its X when this is set. */
  removeLine?: (id: string) => void;
  /** Connect mode: the pointer is on this line's X, so the line stays hovered. */
  holdHover?: (id: string) => void;
  /** Connect mode: the pointer left a line's X; the hover ends unless it comes back. */
  releaseHover?: () => void;
};

export const BoardContext = createContext<BoardContextValue>({
  layout: null,
  selectLine: () => {},
});

export function useBoardContext(): BoardContextValue {
  return useContext(BoardContext);
}

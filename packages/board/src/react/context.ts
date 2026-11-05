// Ported from automation-illustrator src/board/routing/LaneLayoutContext.ts (0803c4a).
// Shares the shown (animated) layout with the lines, which read their route and chip rect from
// it, and the line selection callback with their chips.
import { createContext, useContext } from "react";
import type { BoardLayout } from "../layout/elkLayout.ts";

export type BoardContextValue = {
  layout: BoardLayout | null;
  /** Selects a line; does nothing in hand mode. */
  selectLine: (id: string) => void;
};

export const BoardContext = createContext<BoardContextValue>({
  layout: null,
  selectLine: () => {},
});

export function useBoardContext(): BoardContextValue {
  return useContext(BoardContext);
}

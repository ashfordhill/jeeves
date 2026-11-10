// A container's face in the Detailed view: a header with the tile's kind icon in its family colour
// and its name on one line, then one row per module (`DetailedRow`), each centred on its row's
// port height so the module's lines meet it. A row shows the module's icon in its family colour
// and its name, cut short with an ellipsis, with the full name as its tooltip. A row with a drawn
// line has a port mark on that side (`data-ports`), a stub from the frame to its box, so the line
// that ends at the frame visibly reaches its module. The board draws the rectangular frame; a
// design warning is a mark in the header's corner, as on `Tile`.
//
// Each row is a button ("Open <module> in <host>") that opens its module in the inspector, and
// marks itself while that module is open (`data-mark="open"`) or links with the open one in this
// tile (`"partner"`); the container says it holds the open module (`data-open`), so only that
// row's port marks follow its lines into the selection colour. These come from `ModuleRows`,
// which only the live canvas provides: a diagram export renders the same face in its own root,
// with no marks, and its rows do nothing. The click stops at the row, as the board's own tile
// buttons do, so it opens the module instead of selecting the plain tile. In Hand mode the board
// lets the pointer through the tile and its rows.
import { type StudioKind, studioComponentVisuals, studioDefinitions } from "@jeeves/spec";
import { createContext, useContext } from "react";
import { StudioIcon } from "../../studio/StudioIcon.tsx";
import type { DetailedRow } from "../detailedView.ts";
import { CONTAINER } from "../detailedView.ts";
import { WarningMark } from "../Warnings.tsx";

/** The board's tile border (`.board-tile` in board.css): the face starts this far inside. */
const FRAME = 3;
/** A row's box, centred on its port's height. */
const ROW_BOX = 26;

/** The live canvas's module rows: the open module, its in-process partners, and how to open one. */
export type ModuleRowsState = {
  open?: string;
  partners: readonly string[];
  onOpen: (host: string, module: string) => void;
};
export const ModuleRows = createContext<ModuleRowsState | undefined>(undefined);

export function ContainerTile({
  kind,
  name,
  rows,
  warnings,
}: {
  kind?: StudioKind;
  name: string;
  rows: readonly DetailedRow[];
  /** Its design warnings, shown as a mark in the header's corner. */
  warnings?: readonly string[];
}) {
  const live = useContext(ModuleRows);
  const visual = kind ? studioDefinitions[kind].visual : undefined;
  const holdsOpen = rows.some((row) => row.module === live?.open);
  return (
    <div
      className="lane-container"
      data-family={visual?.color ?? "generic"}
      data-open={holdsOpen || undefined}
    >
      <div className="lane-container-header" style={{ height: CONTAINER.header - FRAME }}>
        <span className="lane-container-icon">
          <StudioIcon name={visual?.icon} size={22} />
        </span>
        <span className="lane-container-name">{name}</span>
        <WarningMark messages={warnings} />
      </div>
      <ol className="lane-container-rows" aria-label="Modules">
        {rows.map((row) => {
          const module = studioComponentVisuals[row.kind];
          const open = live?.open === row.module;
          const mark = open ? "open" : live?.partners.includes(row.module) ? "partner" : undefined;
          const ports = [row.in && "in", row.out && "out"].filter(Boolean).join(" ");
          return (
            <li
              key={row.module}
              className="lane-container-row"
              data-module={row.module}
              data-family={module.color}
              data-mark={mark}
              data-ports={ports || undefined}
              title={row.name}
              style={{ top: row.y - FRAME - ROW_BOX / 2, height: ROW_BOX }}
            >
              <button
                type="button"
                className="lane-container-row-button"
                aria-label={`Open ${row.name} in ${name}`}
                aria-current={open || undefined}
                onClick={(event) => {
                  if (!live) return;
                  event.stopPropagation();
                  live.onOpen(row.host, row.module);
                }}
              >
                <span className="lane-container-row-icon">
                  <StudioIcon name={module.icon} size={16} />
                </span>
                <span className="lane-container-row-name">{row.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

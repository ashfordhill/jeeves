// A container's face in the Detailed view: a header with the tile's kind icon in its family colour
// and its name on one line, then one row per module (`DetailedRow`), each centred on its row's
// port height so the module's lines meet it. A row shows the module's icon in its family colour
// and its name, cut short with an ellipsis, with the full name as its tooltip. The board draws the
// rectangular frame; a design warning is a mark in the header's corner, as on `Tile`. Rows carry
// `data-module` and are not interactive yet: a click selects the container.
import { type StudioKind, studioComponentVisuals, studioDefinitions } from "@jeeves/spec";
import { StudioIcon } from "../../studio/StudioIcon.tsx";
import type { DetailedRow } from "../detailedView.ts";
import { CONTAINER } from "../detailedView.ts";
import { WarningMark } from "../Warnings.tsx";

/** The board's tile border (`.board-tile` in board.css): the face starts this far inside. */
const FRAME = 3;
/** A row's box, centred on its port's height. */
const ROW_BOX = 24;

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
  const visual = kind ? studioDefinitions[kind].visual : undefined;
  return (
    <div className="lane-container" data-family={visual?.color ?? "generic"}>
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
          return (
            <li
              key={row.module}
              className="lane-container-row"
              data-module={row.module}
              data-family={module.color}
              title={row.name}
              style={{ top: row.y - FRAME - ROW_BOX / 2, height: ROW_BOX }}
            >
              <span className="lane-container-row-icon">
                <StudioIcon name={module.icon} size={16} />
              </span>
              <span className="lane-container-row-name">{row.name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

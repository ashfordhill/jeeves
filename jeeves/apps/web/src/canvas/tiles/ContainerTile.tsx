// A container's face in the Detailed view: a header with the tile's kind icon in its family colour,
// its name on one line and its kind label in small grey type below it, on the band colour (sky blue
// when the container can take modules, `data-host`, else mint), then one row per module
// (`DetailedRow`), each centred on its row's port height so the module's lines meet it. A row
// shows the module's icon in its family colour and its name, cut short with an ellipsis, with the
// full name as its tooltip. A row with a drawn line has a port mark on that side (`data-ports`), a
// stub from the frame to its box, so the line that ends at the frame visibly reaches its module.
// The board draws the rectangular frame; a design warning is a mark in the header's corner, as on
// `Tile`.
//
// A row whose kind can take connections has a small dot on its right edge, hollow until one of
// its slots is connected, then filled; a row that can't connect has none. Each row is one of the
// board's ends (`data-board-end`) and its dot the end's handle (`data-board-end-handle`), so in
// Connect mode a drag from the dot starts at the module, not at the tile. An in-process slot's link
// (the Cache reader's loader, Favorites' items) is a short arrow in the left gutter, from its row
// to the Data access row; the rows move right to make room for it.
//
// Each row is a button ("Open <module> in <host>") that opens its module in the inspector, and
// marks itself while that module is open (`data-mark="open"`); no other row is marked. A port mark
// takes the selection colour whenever a line at that port does (`data-lit`), whatever selected it,
// and a loader arrow while either of its modules is open. A right-click on a loader arrow asks for
// its menu (`onLoaderMenu`, whose Disconnect removes that link) instead of the tile's. These come
// from `ModuleRows`, which only the live canvas provides: a diagram export renders the same face in
// its own root, with no marks and no menu, and its rows do nothing. The click stops at the row, as
// the board's own tile buttons do, so it opens the module instead of selecting the plain tile.
//
// A container that can take modules (`addable`) has a footer under its rows, and on the live
// canvas in Pointer mode (`BoardModuleAdding`) a small blue `+` sits centred in it, inside the
// frame: it toggles the tile's module menu (`ModuleAddButton`), selected or not. An export and
// Connect mode show none, and the footer stays empty.
import { type StudioKind, studioComponentVisuals, studioDefinitions } from "@jeeves/spec";
import { type CSSProperties, createContext, useContext } from "react";
import { StudioIcon } from "../../studio/StudioIcon.tsx";
import type { DetailedLoader, DetailedRow } from "../detailedView.ts";
import { CONTAINER } from "../detailedView.ts";
import { BoardModuleAdding, ModuleAddButton } from "../ModuleMenu.tsx";
import { WarningMark } from "../Warnings.tsx";

/** The board's tile border (`.board-tile` in board.css): the face starts this far inside. */
const FRAME = 3;
/** A row's box, centred on its port's height. */
const ROW_BOX = 26;
/** The rows' left inset when the container has loader arrows; each arrow runs this far in. */
const GUTTER = 22;
const GUTTER_STEP = 6;
/** How far an arrow's vertical run sits from the rows, and its arrowhead's arms. */
const RUN = 10;
const HEAD = 4;
/** The `+` (canvas.css `.lane-module-add`), centred in the footer. */
const ADD = 28;

/**
 * The live canvas's module rows: the open module, the ports whose lines are in the selection
 * colour (`DrawnSelection.lit`), how to open one, and a right-click on a loader arrow (its module
 * link, its label and the pointer, in client pixels).
 */
export type ModuleRowsState = {
  open?: string;
  lit: readonly string[];
  onOpen: (host: string, module: string) => void;
  onLoaderMenu?: (link: string, label: string, at: { x: number; y: number }) => void;
};
export const ModuleRows = createContext<ModuleRowsState | undefined>(undefined);

export function ContainerTile({
  id,
  kind,
  name,
  label,
  rows,
  loaders = [],
  addable = false,
  warnings,
}: {
  /** The tile's ID, which its `+` adds modules to. */
  id?: string;
  kind?: StudioKind;
  name: string;
  /** Its kind label (`studioKindLabel`), under the name in the header. */
  label?: string;
  rows: readonly DetailedRow[];
  /** The in-process links between its rows (loaders, items). */
  loaders?: readonly DetailedLoader[];
  /**
   * It can take new modules: its header is the host colour and its footer holds the `+`
   * (`DetailedContainer.addable`).
   */
  addable?: boolean;
  /** Its design warnings, shown as a mark in the header's corner. */
  warnings?: readonly string[];
}) {
  const live = useContext(ModuleRows);
  const adding = useContext(BoardModuleAdding);
  const groups = addable && id !== undefined ? adding?.groups(id) : undefined;
  const visual = kind ? studioDefinitions[kind].visual : undefined;
  const rowOf = new Map(rows.map((row) => [row.module, row]));
  const arrows = loaders.flatMap((loader) => {
    const from = rowOf.get(loader.from);
    const to = rowOf.get(loader.to);
    return from && to ? [{ loader, from, to }] : [];
  });
  const gutter = arrows.length ? GUTTER + GUTTER_STEP * (arrows.length - 1) : undefined;
  return (
    <div
      className="lane-container"
      data-family={visual?.color ?? "generic"}
      style={gutter ? ({ "--row-inset-left": `${gutter}px` } as CSSProperties) : undefined}
    >
      <div
        className="lane-container-header"
        data-host={addable || undefined}
        style={{ height: CONTAINER.header - FRAME }}
      >
        <span className="lane-container-icon">
          <StudioIcon name={visual?.icon} size={22} />
        </span>
        <span className="lane-container-title">
          <span className="lane-container-name">{name}</span>
          {label ? <span className="lane-container-kind">{label}</span> : null}
        </span>
        <WarningMark messages={warnings} />
      </div>
      <ol className="lane-container-rows" aria-label="Modules">
        {rows.map((row) => {
          const module = studioComponentVisuals[row.kind];
          const open = live?.open === row.module;
          const ports = [row.in && "in", row.out && "out"].filter(Boolean).join(" ");
          const lit = [
            row.in && live?.lit.includes(row.in) && "in",
            row.out && live?.lit.includes(row.out) && "out",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={row.module}
              className="lane-container-row"
              data-module={row.module}
              data-board-end={row.module}
              data-family={module.color}
              data-mark={open ? "open" : undefined}
              data-ports={ports || undefined}
              data-lit={lit || undefined}
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
                {row.connects ? (
                  <span
                    className="lane-container-row-dot"
                    data-board-end-handle
                    data-connected={row.connected || undefined}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      {arrows.map(({ loader, from, to }, i) => {
        const inset = gutter ?? GUTTER;
        const x = inset - RUN - GUTTER_STEP * i;
        const y1 = from.y - FRAME;
        const y2 = to.y - FRAME;
        const top = Math.min(y1, y2) - HEAD - 4;
        const height = Math.abs(y2 - y1) + 2 * (HEAD + 4);
        const route = `M ${inset} ${y1 - top} H ${x} V ${y2 - top} H ${inset - 1}`;
        const head = `M ${inset - 1 - HEAD} ${y2 - top - HEAD} L ${inset - 1} ${y2 - top} L ${
          inset - 1 - HEAD
        } ${y2 - top + HEAD}`;
        const lit = live?.open === loader.from || live?.open === loader.to;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: a right-click on the drawn arrow (its svg is the labelled image) opens the canvas's menu, as on a tile or line
          <div
            key={loader.link}
            className="lane-container-loader"
            data-link={loader.link}
            data-lit={lit || undefined}
            style={{ top, height, width: inset }}
            onContextMenu={(event) => {
              const menu = live?.onLoaderMenu;
              if (!menu) return;
              event.preventDefault();
              event.stopPropagation();
              menu(loader.link, loader.label, { x: event.clientX, y: event.clientY });
            }}
          >
            <svg width={inset} height={height} role="img" aria-label={loader.label}>
              <path className="lane-container-loader-hit" d={route} />
              <path className="lane-container-loader-line" d={route} />
              <path className="lane-container-loader-line" d={head} />
            </svg>
          </div>
        );
      })}
      {adding && groups?.length && id !== undefined ? (
        <div
          className="lane-container-add"
          style={{
            top:
              CONTAINER.header + CONTAINER.row * rows.length + (CONTAINER.footer - ADD) / 2 - FRAME,
          }}
        >
          <ModuleAddButton
            tile={id}
            name={name}
            groups={groups}
            onAdd={adding.add}
            placement="board"
          />
        </div>
      ) : null}
    </div>
  );
}

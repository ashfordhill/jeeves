// The lane canvas: the design's lane graph (`laneGraph`) on the board. The actor, its actions and
// every tile become board tiles; the user's lines to its actions, the entries and connections
// become directed lines, dashed only when that relationship is asynchronous. The user's line to an
// action goes with the action, so it has no X. Lines carry no words; their accessible names say
// what they join. The selected tile's tabs come from `creation`, its X and the selected
// line's from `removal`, and connect mode's rules and new links from `connect`. A tile or action
// with a design warning carries a mark (`Warnings.tsx`). Every tile and container shows its kind
// label (`studioKindLabel`: a message channel's is Queue or Topic, by its mode).
// Every tile and line carries its lane band (`laneLayoutInput`), so the board stacks download,
// shared and upload.
//
// The Detailed view (`detailedView`) draws each module host as a container of its modules
// (`ContainerTile`) and each module's links from or into its row; every other tile and line is as
// in the Simple view, whose output this view never changes. One relationship may be drawn as
// several lines there. The workspace only ever sees canonical relationships: a clicked or removed
// drawn line maps to its connection (`canonicalLine`), and a selected connection shows all of its
// drawn lines, the clicked one as the board's selected line (`drawnSelection`). The board keeps
// each view's layout hints apart (`view`).
//
// A container's rows are its modules (`ModuleRows`): clicking one opens that module in the
// inspector (`onOpenModule`). In Pointer mode every container that can take modules has a `+` in
// its footer, and in the Simple view the selected tile has one in its corner (`BoardModuleAdding`
// from `adding`): it opens the tile's module menu. While a module is open its host stays
// selected, with its link tab and X, but only the module's own drawn lines take the selection
// colour (the board's
// `selectedTileLines` and `highlighted`), and only its row is marked. A row's port mark turns
// blue with its line, whatever selected it. In the Simple view an open module only keeps its host
// selected.
//
// In Connect mode a row's dot is a drag source of its own (connect mode's rules take module IDs
// too), and the X on a module's drawn line or on a loader arrow disconnects that module link
// (`onDisconnectModule`), leaving the tiles' link; a line no module anchors keeps the tile link's
// X. In Pointer (select) mode a drawn line's X removes its whole relationship, as in the Simple
// view.
import {
  Board,
  type BoardHandle,
  type BoardMode,
  type BoardProps,
  type ConnectRules,
  type LineSpec,
  type TileSpec,
} from "@jeeves/board";
import {
  type DesignDocument,
  LANE_ACTOR,
  type LaneGraph,
  laneActionName,
  studioKindLabel,
  studioWarnings,
} from "@jeeves/spec";
import { type Ref, useMemo, useState } from "react";
import type { CanvasView } from "../studio/preferences.ts";
import { detailedView } from "./detailedView.ts";
import { layoutEngine } from "./elk.ts";
import { LineLegend } from "./LineLegend.tsx";
import { laneLayoutInput } from "./laneLayout.ts";
import { BoardModuleAdding, type ModuleAdding } from "./ModuleMenu.tsx";
import { canonicalLine, drawnSelection, type WorkspaceSelection } from "./selection.ts";
import { ActionTile } from "./tiles/ActionTile.tsx";
import { ACTOR_NAME, ActorTile } from "./tiles/ActorTile.tsx";
import { ContainerTile, ModuleRows } from "./tiles/ContainerTile.tsx";
import { Tile, tileShape } from "./tiles/Tile.tsx";
import "./canvas.css";

/** A tile's, action's or the user's name on the canvas. */
export function laneNodeName(design: DesignDocument, graph: LaneGraph, id: string): string {
  if (id === LANE_ACTOR) return ACTOR_NAME;
  const lane = graph.nodes.find((node) => node.id === id)?.action;
  if (lane) return laneActionName(design, lane) ?? id;
  return design.elements.find((element) => element.id === id)?.name ?? id;
}

export function LaneCanvas({
  design,
  graph,
  view,
  selected,
  mode,
  onSelectTile,
  onSelectLine,
  onOpenModule,
  onClear,
  creation,
  removal,
  connect,
  onDisconnectModule,
  adding,
  ref,
}: {
  design: DesignDocument;
  /** `laneGraph(design)`. */
  graph: LaneGraph;
  view: CanvasView;
  /**
   * A tile (with its open module, if any), or a canonical relationship (never a Detailed view's
   * drawn line).
   */
  selected: WorkspaceSelection;
  mode: BoardMode;
  onSelectTile: (id: string) => void;
  onSelectLine: (id: string) => void;
  /** A module's row was clicked (Detailed view): select its host with the module open. */
  onOpenModule: (host: string, module: string) => void;
  onClear: () => void;
  /** Tabs and fans for the selected tile (`useLaneCreation`). */
  creation?: Pick<BoardProps, "tabs" | "onPick">;
  /** The red X on the selected tile and line, and the removal's confirmation (`useLaneRemoval`). */
  removal?: Pick<BoardProps, "removable" | "onRemoveTile" | "onRemoveLine" | "hud">;
  /** Connect mode's allowed ends, refusals and new links (`useLaneConnect`). */
  connect?: ConnectRules;
  /** Connect mode, Detailed view: the X on a module link (its drawn line or loader arrow). */
  onDisconnectModule?: (link: string) => void;
  /** The tiles' module menus and the pick, for the `+` (Pointer mode only). */
  adding?: ModuleAdding;
  ref?: Ref<BoardHandle>;
}) {
  const { tiles, lines, warnings, kindLabel } = useMemo(() => {
    const name = (id: string) => laneNodeName(design, graph, id);
    const settings = new Map(
      design.architecture?.studio?.elements.map((row) => [row.element, row.settings]),
    );
    const kindLabel = (id: string) => {
      const found = settings.get(id);
      return found && studioKindLabel(found);
    };
    const warnings = new Map<string, string[]>();
    for (const item of studioWarnings(design))
      warnings.set(item.node, [...(warnings.get(item.node) ?? []), item.message]);
    // One layout tile per node and one layout line per edge, in the graph's order.
    const input = laneLayoutInput(graph);
    const box = (i: number) => {
      const { w, h, band } = input.tiles[i] ?? { w: 0, h: 0 };
      return { w, h, ...(band !== undefined && { band }) };
    };
    const tiles: TileSpec[] = graph.nodes.map((node, i) =>
      node.id === LANE_ACTOR
        ? { id: node.id, ...box(i), shape: "rect", label: ACTOR_NAME, content: <ActorTile /> }
        : node.action
          ? {
              id: node.id,
              ...box(i),
              shape: "rect",
              label: name(node.id),
              content: (
                <ActionTile
                  lane={node.action}
                  name={name(node.id)}
                  warnings={warnings.get(node.id)}
                />
              ),
            }
          : {
              id: node.id,
              ...box(i),
              shape: tileShape(node.kind),
              label: name(node.id),
              content: (
                <Tile
                  id={node.id}
                  kind={node.kind}
                  name={name(node.id)}
                  label={kindLabel(node.id)}
                  warnings={warnings.get(node.id)}
                />
              ),
            },
    );
    const lines: LineSpec[] = graph.edges.map((edge, i) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      dashed: edge.dashed,
      directed: true,
      label: `${name(edge.source)} to ${name(edge.target)}`,
      detail: design.connections.find((item) => item.id === edge.id)?.planned.label,
      ...(edge.source === LANE_ACTOR && { removable: false }),
      ...(input.lines[i]?.band !== undefined && { band: input.lines[i]?.band }),
    }));
    return { tiles, lines, warnings, kindLabel };
  }, [design, graph]);

  // The Detailed view: containers in place of module hosts, and the projection's lines.
  const detailed = useMemo(() => {
    if (view !== "detailed") return undefined;
    const projection = detailedView(design, graph, (id) => laneNodeName(design, graph, id));
    // Both are in node order; a container keeps its tile's ID, name and band.
    const detailedTiles = tiles.map((tile, i): TileSpec => {
      const box = projection.tiles[i];
      const container = projection.containers.get(tile.id);
      if (!box || !container) return tile;
      return {
        ...tile,
        w: box.w,
        h: box.h,
        ...(box.ports && { ports: box.ports }),
        shape: "rect",
        content: (
          <ContainerTile
            id={tile.id}
            kind={graph.nodes[i]?.kind}
            name={tile.label}
            label={kindLabel(tile.id)}
            rows={container.rows}
            loaders={container.loaders}
            addable={container.addable}
            warnings={warnings.get(tile.id)}
          />
        ),
      };
    });
    // A relationship drawn as several lines is one entry in Choose relationship (`group`).
    const detailedLines: LineSpec[] = projection.lines.map((line) => ({
      ...line,
      group: line.connection,
      detail: design.connections.find((item) => item.id === line.connection)?.planned.label,
    }));
    return { projection, tiles: detailedTiles, lines: detailedLines };
  }, [view, design, graph, tiles, warnings, kindLabel]);

  // The drawn line last clicked, so it (not its first sibling) shows as the selected line.
  const [clicked, setClicked] = useState<string>();
  const drawn = useMemo(
    () => (detailed ? drawnSelection(detailed.projection, selected, clicked) : undefined),
    [detailed, selected, clicked],
  );
  const rows = useMemo(
    () => ({
      ...(drawn?.open !== undefined && { open: drawn.open }),
      lit: drawn?.lit ?? [],
      onOpen: onOpenModule,
      ...(onDisconnectModule && { onDisconnect: onDisconnectModule }),
    }),
    [drawn, onOpenModule, onDisconnectModule],
  );
  const canonical = (line: string) =>
    detailed ? canonicalLine(detailed.projection.connectionOf, line) : line;
  // Connect mode: a module's drawn line names the module link its X disconnects.
  const unlinks = mode === "connect" && onDisconnectModule !== undefined;
  const boardLines = useMemo(() => {
    if (!detailed) return lines;
    if (!unlinks) return detailed.lines;
    return detailed.lines.map((line, i) => {
      const disconnect = detailed.projection.lines[i]?.disconnect;
      return disconnect ? { ...line, removeLabel: disconnect.label } : line;
    });
  }, [detailed, lines, unlinks]);
  // The `+`: every addable container's, and the selected tile's in the Simple view; none in
  // Connect mode.
  const boardAdding = useMemo(
    () => (adding && mode === "select" ? { ...adding, selected: selected.tile } : undefined),
    [adding, mode, selected.tile],
  );
  const removeLine = removal?.onRemoveLine;
  const onRemoveLine =
    removeLine &&
    ((line: string) => {
      const disconnect = unlinks
        ? detailed?.projection.lines.find((item) => item.id === line)?.disconnect
        : undefined;
      if (disconnect) onDisconnectModule?.(disconnect.link);
      else removeLine(canonical(line));
    });

  return (
    <div className="lane-canvas">
      <BoardModuleAdding value={boardAdding}>
        <ModuleRows value={rows}>
          <Board
            ref={ref}
            tiles={detailed?.tiles ?? tiles}
            lines={boardLines}
            engine={layoutEngine}
            selected={drawn?.selected ?? selected}
            mode={mode}
            onSelectTile={onSelectTile}
            onSelectLine={(line) => {
              setClicked(line);
              onSelectLine(canonical(line));
            }}
            onClear={onClear}
            {...creation}
            {...removal}
            {...connect}
            {...(onRemoveLine && { onRemoveLine })}
            view={view}
            {...(drawn && {
              highlighted: drawn.highlighted,
              selectedTileLines: drawn.selectedTileLines,
            })}
          />
        </ModuleRows>
      </BoardModuleAdding>
      <LineLegend />
    </div>
  );
}

// The lane canvas: the design's lane graph (`laneGraph`) on the board. The actor, its actions and
// every tile become board tiles; the user's lines to its actions, the entries and connections
// become directed lines, dashed only when that relationship is asynchronous. The user's line to an
// action goes with the action, so it has no X. Lines carry no words; their accessible names say
// what they join. The selected tile's pull tabs come from `creation`, its X and the selected
// line's from `removal`. A tile or action with a design warning carries a mark (`Warnings.tsx`).
// Every tile and line carries its lane band (`laneLayoutInput`), so the board stacks download,
// shared and upload.
//
// The Detailed view (`detailedView`) draws each module host as a container of its modules
// (`ContainerTile`) and each module's links from or into its row; every other tile and line is as
// in the Overview, whose output this view never changes. One relationship may be drawn as several
// lines there. The workspace only ever sees canonical relationships: a clicked or removed drawn
// line maps to its connection (`canonicalLine`), and a selected connection shows all of its drawn
// lines, the clicked one as the board's selected line (`drawnSelection`). The board keeps each
// view's layout hints apart (`view`).
import {
  Board,
  type BoardHandle,
  type BoardMode,
  type BoardProps,
  type BoardSelection,
  type LineSpec,
  type TileSpec,
} from "@jeeves/board";
import {
  type DesignDocument,
  LANE_ACTOR,
  type LaneGraph,
  laneActionName,
  studioWarnings,
} from "@jeeves/spec";
import { type Ref, useMemo, useState } from "react";
import type { CanvasView } from "../studio/preferences.ts";
import { detailedView } from "./detailedView.ts";
import { layoutEngine } from "./elk.ts";
import { LineLegend } from "./LineLegend.tsx";
import { laneLayoutInput } from "./laneLayout.ts";
import { canonicalLine, drawnSelection } from "./selection.ts";
import { ActionTile } from "./tiles/ActionTile.tsx";
import { ACTOR_NAME, ActorTile } from "./tiles/ActorTile.tsx";
import { ContainerTile } from "./tiles/ContainerTile.tsx";
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
  view = "overview",
  selected,
  mode,
  onSelectTile,
  onSelectLine,
  onClear,
  creation,
  removal,
  ref,
}: {
  design: DesignDocument;
  /** `laneGraph(design)`. */
  graph: LaneGraph;
  view?: CanvasView;
  /** A tile, or a canonical relationship (never a Detailed view's drawn line). */
  selected: BoardSelection;
  mode: BoardMode;
  onSelectTile: (id: string) => void;
  onSelectLine: (id: string) => void;
  onClear: () => void;
  /** Pull tabs, fans and drops for the selected tile (`useLaneCreation`). */
  creation?: Pick<BoardProps, "tabs" | "canDrop" | "onPick" | "onDrop" | "onDropRefused">;
  /** The red X on the selected tile and line, and the removal's confirmation (`useLaneRemoval`). */
  removal?: Pick<BoardProps, "removable" | "onRemoveTile" | "onRemoveLine" | "hud">;
  ref?: Ref<BoardHandle>;
}) {
  const { tiles, lines, warnings } = useMemo(() => {
    const name = (id: string) => laneNodeName(design, graph, id);
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
                <Tile kind={node.kind} name={name(node.id)} warnings={warnings.get(node.id)} />
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
    return { tiles, lines, warnings };
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
            kind={graph.nodes[i]?.kind}
            name={tile.label}
            rows={container.rows}
            warnings={warnings.get(tile.id)}
          />
        ),
      };
    });
    const detailedLines: LineSpec[] = projection.lines.map((line) => ({
      ...line,
      detail: design.connections.find((item) => item.id === line.connection)?.planned.label,
    }));
    return { projection, tiles: detailedTiles, lines: detailedLines };
  }, [view, design, graph, tiles, warnings]);

  // The drawn line last clicked, so it (not its first sibling) shows as the selected line.
  const [clicked, setClicked] = useState<string>();
  const drawn = useMemo(
    () => (detailed ? drawnSelection(detailed.projection.linesOf, selected, clicked) : undefined),
    [detailed, selected, clicked],
  );
  const canonical = (line: string) =>
    detailed ? canonicalLine(detailed.projection.connectionOf, line) : line;
  const onRemoveLine = removal?.onRemoveLine;

  return (
    <div className="lane-canvas">
      <Board
        ref={ref}
        tiles={detailed?.tiles ?? tiles}
        lines={detailed?.lines ?? lines}
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
        {...(onRemoveLine && { onRemoveLine: (line: string) => onRemoveLine(canonical(line)) })}
        view={view}
        {...(drawn && { highlighted: drawn.highlighted })}
      />
      <LineLegend />
    </div>
  );
}

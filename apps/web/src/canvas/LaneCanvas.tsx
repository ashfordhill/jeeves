// The lane canvas: the design's lane graph (`laneGraph`) on the board. The actor, its actions and
// every tile become board tiles; the user's lines to its actions, the entries and connections
// become lines, dashed when asynchronous or after an asynchronous link. The user's line to an
// action goes with the action, so it has no X. Lines carry no words; their accessible names say
// what they join. The selected tile's pull tabs come from `creation`, its X and the selected
// line's from `removal`. A tile or action with a design warning carries a mark (`Warnings.tsx`).
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
import { type Ref, useMemo } from "react";
import { layoutEngine } from "./elk.ts";
import { ACTION_SIZE, ActionTile } from "./tiles/ActionTile.tsx";
import { ACTOR_NAME, ACTOR_SIZE, ActorTile } from "./tiles/ActorTile.tsx";
import { TILE_SIZE, Tile, tileShape } from "./tiles/Tile.tsx";
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
  const { tiles, lines } = useMemo(() => {
    const name = (id: string) => laneNodeName(design, graph, id);
    const warnings = new Map<string, string[]>();
    for (const item of studioWarnings(design))
      warnings.set(item.node, [...(warnings.get(item.node) ?? []), item.message]);
    const tiles: TileSpec[] = graph.nodes.map((node) =>
      node.id === LANE_ACTOR
        ? { id: node.id, ...ACTOR_SIZE, shape: "rect", label: ACTOR_NAME, content: <ActorTile /> }
        : node.action
          ? {
              id: node.id,
              ...ACTION_SIZE,
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
              ...TILE_SIZE,
              shape: tileShape(node.kind),
              label: name(node.id),
              content: (
                <Tile kind={node.kind} name={name(node.id)} warnings={warnings.get(node.id)} />
              ),
            },
    );
    const lines: LineSpec[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      dashed: edge.dashed,
      label: `${name(edge.source)} to ${name(edge.target)}`,
      ...(edge.source === LANE_ACTOR && { removable: false }),
    }));
    return { tiles, lines };
  }, [design, graph]);

  return (
    <div className="lane-canvas">
      <Board
        ref={ref}
        tiles={tiles}
        lines={lines}
        engine={layoutEngine}
        selected={selected}
        mode={mode}
        onSelectTile={onSelectTile}
        onSelectLine={onSelectLine}
        onClear={onClear}
        {...creation}
        {...removal}
      />
    </div>
  );
}

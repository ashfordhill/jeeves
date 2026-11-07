// The lane canvas: the design's lane graph (`laneGraph`) on the board. The actor, its actions and
// every tile become board tiles; the user's lines to its actions, the entries and connections
// become directed lines, dashed only when that relationship is asynchronous. The user's line to an
// action goes with the action, so it has no X. Lines carry no words; their accessible names say
// what they join. The selected tile's pull tabs come from `creation`, its X and the selected
// line's from `removal`. A tile or action with a design warning carries a mark (`Warnings.tsx`).
// Every tile and line carries its lane band (`laneLayoutInput`), so the board stacks download,
// shared and upload.
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
  designOperations,
  designOwnership,
  knownCreateSignature,
  knownResolveSignature,
  LANE_ACTOR,
  type LaneGraph,
  laneActionName,
  studioWarnings,
} from "@jeeves/spec";
import { type Ref, useMemo } from "react";
import { layoutEngine } from "./elk.ts";
import { LineLegend } from "./LineLegend.tsx";
import { laneLayoutInput } from "./laneLayout.ts";
import { ownerNodeId } from "./ownerProjection.ts";
import { ActionTile } from "./tiles/ActionTile.tsx";
import { ACTOR_NAME, ActorTile } from "./tiles/ActorTile.tsx";
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
  selected,
  mode,
  onSelectTile,
  onSelectLine,
  onClear,
  creation,
  removal,
  ref,
  visibleLines,
  emphasizedTiles,
  onExpandOwner,
  canonicalGraph,
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
  visibleLines?: readonly string[];
  emphasizedTiles?: readonly string[];
  onExpandOwner?: (id: string) => void;
  canonicalGraph?: LaneGraph;
}) {
  const { tiles, lines } = useMemo(() => {
    const ownership = designOwnership(design);
    const operations = designOperations(design);
    const ownerOperations = (id: string) =>
      operations.receivers.filter((x) =>
        ownership.roles.some((r) => r.element === x.role && ownerNodeId(r.owner) === id),
      );
    const ownerOf = (id: string) => ownership.owners.find((owner) => ownerNodeId(owner.id) === id);
    const name = (id: string) =>
      ownerOf(id)?.name ?? laneNodeName(design, canonicalGraph ?? graph, id);
    const warnings = new Map<string, string[]>();
    for (const item of studioWarnings(design))
      warnings.set(item.node, [...(warnings.get(item.node) ?? []), item.message]);
    // One layout tile per node and one layout line per edge, in the graph's order.
    const input = laneLayoutInput(graph);
    const box = (i: number) => {
      const { w, h, band } = input.tiles[i] ?? { w: 0, h: 0 };
      if (ownerOf(graph.nodes[i]?.id ?? ""))
        return {
          w: 176,
          h: ownerOperations(graph.nodes[i]?.id ?? "").length ? 184 : 160,
          ...(band !== undefined && { band }),
        };
      if (operations.receivers.some((x) => x.role === graph.nodes[i]?.id))
        return { w: 176, h: 184, ...(band !== undefined && { band }) };
      return { w, h, ...(band !== undefined && { band }) };
    };
    const tiles: TileSpec[] = graph.nodes.map((node, i) =>
      node.id === LANE_ACTOR
        ? { id: node.id, ...box(i), shape: "rect", label: ACTOR_NAME, content: <ActorTile /> }
        : ownerOf(node.id)
          ? {
              id: node.id,
              ...box(i),
              shape: "rect",
              label: `${name(node.id)} · logical owner`,
              content: (
                <div className="lane-owner">
                  <small>Logical owner</small>
                  <strong>{name(node.id)}</strong>
                  <small>
                    {ownership.roles.filter((role) => ownerNodeId(role.owner) === node.id).length}{" "}
                    roles
                  </small>
                  {ownerOperations(node.id).length ? (
                    <small>{ownerOperations(node.id).length} declared operation</small>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onExpandOwner?.(ownerOf(node.id)?.id ?? "");
                    }}
                  >
                    Expand roles
                  </button>
                </div>
              ),
            }
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
                    kind={node.kind}
                    name={name(node.id)}
                    warnings={warnings.get(node.id)}
                    operation={
                      operations.receivers.filter((x) => x.role === node.id).length > 1
                        ? `${operations.receivers.filter((x) => x.role === node.id).length} declared operations`
                        : operations.receivers.some(
                              (x) => x.role === node.id && knownCreateSignature(x.implementation),
                            )
                          ? "Create link · v1"
                          : operations.receivers.some(
                                (x) =>
                                  x.role === node.id && knownResolveSignature(x.implementation),
                              )
                            ? "Resolve link · v1"
                            : operations.receivers.some((x) => x.role === node.id)
                              ? "Unresolved operation"
                              : undefined
                    }
                    owner={
                      ownership.owners.find(
                        (owner) =>
                          owner.id ===
                          ownership.roles.find((role) => role.element === node.id)?.owner,
                      )?.name
                    }
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
      label: `${name(canonicalGraph?.edges.find((x) => x.id === edge.id)?.source ?? edge.source)} to ${name(canonicalGraph?.edges.find((x) => x.id === edge.id)?.target ?? edge.target)}`,
      detail: design.connections.find((item) => item.id === edge.id)?.planned.label,
      ...(edge.source === LANE_ACTOR && { removable: false }),
      ...(input.lines[i]?.band !== undefined && { band: input.lines[i]?.band }),
    }));
    return { tiles, lines };
  }, [design, graph, canonicalGraph, onExpandOwner]);

  return (
    <div className="lane-canvas">
      <Board
        ref={ref}
        tiles={tiles}
        lines={lines}
        engine={layoutEngine}
        selected={selected}
        visibleLines={visibleLines}
        emphasizedTiles={emphasizedTiles}
        mode={mode}
        onSelectTile={onSelectTile}
        onSelectLine={onSelectLine}
        onClear={onClear}
        {...creation}
        {...removal}
      />
      <LineLegend />
    </div>
  );
}

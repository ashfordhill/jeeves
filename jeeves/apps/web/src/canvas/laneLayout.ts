// What the lane canvas gives the board's layout: each node's size and band, and each line's band
// (`laneBands`, numbered in `laneBandOrder`, so download sits above shared above upload).
import type { LayoutInput } from "@jeeves/board";
import { LANE_ACTOR, type LaneBand, type LaneGraph, laneBandOrder, laneBands } from "@jeeves/spec";
import { ACTION_SIZE } from "./tiles/ActionTile.tsx";
import { ACTOR_SIZE } from "./tiles/ActorTile.tsx";
import { TILE_SIZE } from "./tiles/Tile.tsx";

const banded = (band: LaneBand | undefined) =>
  band === undefined ? {} : { band: laneBandOrder.indexOf(band) };

export function laneLayoutInput(graph: LaneGraph): LayoutInput {
  const bands = laneBands(graph);
  return {
    tiles: graph.nodes.map((node) => ({
      id: node.id,
      ...(node.id === LANE_ACTOR ? ACTOR_SIZE : node.action ? ACTION_SIZE : TILE_SIZE),
      ...banded(bands.nodes.get(node.id)),
    })),
    lines: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...banded(bands.edges.get(edge.id)),
    })),
  };
}

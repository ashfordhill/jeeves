// The lane canvas: the design's lane graph (`laneGraph`) on the board. The actor and every tile
// become board tiles; entries and connections become lines, dashed when asynchronous or after an
// asynchronous link. Entry lines carry a download or upload chip. Lines carry no words; their
// accessible names say what they join. The selected tile's pull tabs come from `creation`, its X
// and the selected line's from `removal`.
import {
  Board,
  type BoardHandle,
  type BoardMode,
  type BoardProps,
  type BoardSelection,
  type LineSpec,
  type TileSpec,
} from "@jeeves/board";
import { type DesignDocument, LANE_ACTOR, type LaneGraph, type StudioLane } from "@jeeves/spec";
import { IconDownload, IconUpload } from "@tabler/icons-react";
import { type Ref, useMemo } from "react";
import { layoutEngine } from "./elk.ts";
import { ACTOR_NAME, ACTOR_SIZE, ActorTile } from "./tiles/ActorTile.tsx";
import { TILE_SIZE, Tile, tileShape } from "./tiles/Tile.tsx";
import "./canvas.css";

/** Entry chips are icon boxes ELK keeps clear on the line. */
const CHIP = { w: 32, h: 32 } as const;
export const laneNames: Record<StudioLane, string> = { download: "Download", upload: "Upload" };

export function LaneIcon({ lane, size = 18 }: { lane: StudioLane; size?: number }) {
  const Glyph = lane === "download" ? IconDownload : IconUpload;
  return <Glyph size={size} stroke={2.4} aria-hidden />;
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
    const names = new Map(design.elements.map((element) => [element.id, element.name]));
    const name = (id: string) => (id === LANE_ACTOR ? ACTOR_NAME : (names.get(id) ?? id));
    const tiles: TileSpec[] = graph.nodes.map((node) =>
      node.id === LANE_ACTOR
        ? { id: node.id, ...ACTOR_SIZE, shape: "rect", label: ACTOR_NAME, content: <ActorTile /> }
        : {
            id: node.id,
            ...TILE_SIZE,
            shape: tileShape(node.kind),
            label: name(node.id),
            content: <Tile kind={node.kind} name={name(node.id)} />,
          },
    );
    const lines: LineSpec[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      dashed: edge.dashed,
      label: edge.lane
        ? `${laneNames[edge.lane]} lane: ${name(edge.source)} to ${name(edge.target)}`
        : `${name(edge.source)} to ${name(edge.target)}`,
      ...(edge.lane && { chip: { ...CHIP, content: <LaneIcon lane={edge.lane} /> } }),
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

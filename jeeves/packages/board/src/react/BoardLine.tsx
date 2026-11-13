// Ported from automation-illustrator src/board/routing/FlowArrow.tsx (0803c4a).
// One line: the ELK route from the shown layout (a right-angle fallback until ELK has routed
// it), solid or dashed, a 44px hit band, and an optional chip at the rect ELK kept clear for it.
// The dashes are drawn per segment with their phase locked to the world, so shared trunks keep
// the same gaps. The selected line, and the selected tile's own lines, take the selection colour.
//
// Changes from automation-illustrator: no restitch preview, stretch, insert hover or label editor;
// a right-click goes to the board's caller (`onLineMenu`), which draws its own menu. The chip holds
// caller content (an icon) instead of condition text.
import { BaseEdge, type Edge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import type { ReactNode } from "react";
import type { Point } from "../layout/metrics.ts";
import {
  DASH_GAP,
  DASH_LENGTH,
  DASH_PERIOD,
  orthogonalPolyline,
  pathLength,
  pointAtLength,
  polylineDrawSegments,
  polylineToSvg,
} from "../layout/polyline.ts";
import { useBoardContext } from "./context.ts";
import { directionArrow } from "./directionArrow.ts";

/** The invisible hit band, wider than the drawn stroke. */
export const LINE_HIT_WIDTH = 44;
export const LINE_WIDTH = 2.75;
export const LINE_WIDTH_SELECTED = 4;

export type BoardLineData = {
  dashed: boolean;
  directed?: boolean;
  /** A line into or out of the selected tile: the selection colour at the normal width. */
  linked?: boolean;
  /** Accessible name of the line and its chip; never drawn. */
  label?: string;
  chip?: ReactNode;
  bridges?: Point[][];
};

export type BoardLineEdge = Edge<BoardLineData, "line">;

export function BoardLine({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
}: EdgeProps<BoardLineEdge>) {
  const { layout, selectLine } = useBoardContext();
  const dashed = Boolean(data?.dashed);
  const route = layout?.routes[id];
  const points =
    route && route.length >= 2 ? route : orthogonalPolyline(sourceX, sourceY, targetX, targetY);
  const path = polylineToSvg(points);
  const width = selected ? LINE_WIDTH_SELECTED : LINE_WIDTH;
  const ink = selected || data?.linked ? "var(--board-select)" : "var(--board-line)";
  const segments = dashed ? polylineDrawSegments(points, DASH_PERIOD) : [];
  const arrow = data?.directed ? directionArrow(points) : undefined;

  const rect = layout?.chips[id];
  const mid = pointAtLength(points, pathLength(points) / 2);
  const chip = rect
    ? { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, w: rect.w, h: rect.h }
    : { x: mid.x, y: mid.y, w: undefined, h: undefined };

  return (
    <>
      {data?.bridges?.map((bridge) => (
        <path
          key={polylineToSvg(bridge)}
          className="board-line-crossing"
          d={polylineToSvg(bridge)}
          fill="none"
          pointerEvents="none"
          style={{ stroke: "var(--board-paper)", strokeWidth: width + 8 }}
        />
      ))}
      <BaseEdge
        id={id}
        path={path}
        className={dashed ? "board-line is-dashed" : "board-line"}
        interactionWidth={LINE_HIT_WIDTH}
        style={{
          stroke: dashed ? "transparent" : ink,
          strokeWidth: width,
          strokeLinecap: "butt",
          strokeLinejoin: "miter",
        }}
      />
      {segments.map((seg) => (
        <path
          key={`${seg.x1},${seg.y1},${seg.x2},${seg.y2}`}
          className="board-line-dash"
          d={`M ${seg.x1} ${seg.y1} L ${seg.x2} ${seg.y2}`}
          fill="none"
          pointerEvents="none"
          style={{
            stroke: ink,
            strokeWidth: width,
            strokeDasharray: `${DASH_LENGTH} ${DASH_GAP}`,
            strokeDashoffset: seg.dashOffset,
            strokeLinecap: "butt",
          }}
        />
      ))}
      {arrow ? (
        <path
          className="board-line-arrow"
          d={arrow}
          fill="none"
          pointerEvents="none"
          style={{ stroke: ink, strokeWidth: width, strokeLinejoin: "miter" }}
        />
      ) : null}
      {data?.chip ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="board-chip nopan nowheel"
            data-selected={selected || undefined}
            aria-label={data.label}
            tabIndex={-1}
            style={{
              transform: `translate(-50%, -50%) translate(${chip.x}px, ${chip.y}px)`,
              width: chip.w,
              height: chip.h,
            }}
            onClick={(event) => {
              event.stopPropagation();
              selectLine(id);
            }}
          >
            {data.chip}
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

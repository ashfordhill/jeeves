/**
 * Typed connections (solid, with a kind chip) and plain arrows (dashed, optional label).
 */
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from "@xyflow/react";
import { connectionLabels } from "../connect.ts";
import type { BoardEdge } from "../flow.ts";
import { useDraw } from "../store.ts";

function useGeometry(props: EdgeProps<BoardEdge>) {
  return getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
}

function EdgeChip({
  x,
  y,
  text,
  className,
  onClick,
}: {
  x: number;
  y: number;
  text: string;
  className: string;
  onClick?: () => void;
}) {
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        onClick={onClick}
        className={`edge-chip nodrag nopan ${className}`}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      >
        {text}
      </button>
    </EdgeLabelRenderer>
  );
}

export function ConnectionEdge(props: EdgeProps<BoardEdge>) {
  const [path, x, y] = useGeometry(props);
  const kind = props.data && "connection" in props.data ? props.data.connection.kind : undefined;
  const planned =
    props.data && "connection" in props.data ? props.data.connection.planned : undefined;
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        className={`connection-path${props.selected ? " is-selected" : ""}`}
        interactionWidth={24}
        style={planned ? { strokeDasharray: "7 4" } : undefined}
      />
      {kind ? (
        <EdgeChip
          x={x}
          y={y}
          text={planned?.label ?? connectionLabels[kind]}
          className={`connection-chip${props.selected ? " is-selected" : ""}`}
          onClick={() => useDraw.getState().focus({ nodes: [], edges: [props.id] })}
        />
      ) : null}
    </>
  );
}

export function ArrowEdge(props: EdgeProps<BoardEdge>) {
  const [path, x, y] = useGeometry(props);
  const label = props.data && "annotation" in props.data ? props.data.annotation.label : undefined;
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        className={`arrow-path${props.selected ? " is-selected" : ""}`}
        interactionWidth={24}
      />
      {label ? (
        <EdgeChip
          x={x}
          y={y}
          text={label}
          className="arrow-chip"
          onClick={() => useDraw.getState().focus({ nodes: [], edges: [props.id] })}
        />
      ) : null}
    </>
  );
}

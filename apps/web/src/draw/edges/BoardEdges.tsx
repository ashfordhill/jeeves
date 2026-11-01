/**
 * C4 relationships (verb phrase, protocol and interaction style) and plain arrows (dashed, optional label).
 */

import { connectionPresentation, containerContext } from "@jeeves/spec";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  Position,
  useNodes,
} from "@xyflow/react";
import type { ReactNode } from "react";
import { RelationshipLabel, relationshipLineStyle } from "../../architecture/RelationshipLabel.tsx";
import type { BoardEdge, BoardNode } from "../flow.ts";
import { useDraw } from "../store.ts";
import { type LabelBox, placeRelationshipLabel, relationshipLabelSize } from "./label-position.ts";

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
  size,
}: {
  x: number;
  y: number;
  text: ReactNode;
  className: string;
  onClick?: () => void;
  size?: { width: number; height: number };
}) {
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        onClick={onClick}
        className={`edge-chip nodrag nopan ${className}`}
        style={{ ...size, transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      >
        {text}
      </button>
    </EdgeLabelRenderer>
  );
}

function useLabelPosition(
  id: string,
  x: number,
  y: number,
  description: string,
  protocol: string,
  planned = false,
) {
  const nodes = useNodes<BoardNode>();
  const design = useDraw((state) => state.loaded!.design);
  const boxes = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    ...node.position,
    width: node.measured?.width ?? node.width ?? 280,
    height: node.measured?.height ?? node.height ?? 180,
  }));
  const boundary = boxes.find((box) => box.type === "systemBoundary");
  // Stay within fitted object bounds, below the boundary title and floating toolbar.
  const bounds = boundary
    ? {
        minX: Math.min(...boxes.map((box) => box.x)),
        minY: boundary.y + 40,
        maxX: Math.max(...boxes.map((box) => box.x + box.width)),
        maxY: Math.max(...boxes.map((box) => box.y + box.height)),
      }
    : undefined;
  const obstacles: LabelBox[] = boxes
    .filter((box) => box.type !== "frame")
    .map((box) => (box.type === "systemBoundary" ? { ...box, height: 40 } : box));
  const relations = [
    ...design.connections.map((connection) => ({
      id: connection.id,
      from: connection.from.element,
      to: connection.to.element,
      ...connectionPresentation(connection, design),
    })),
    ...containerContext(design).relationships.map((relation) => ({
      id: `context:${relation.id}`,
      from: relation.source,
      to: relation.target,
      description: relation.description,
      protocol: relation.protocol,
      planned: false,
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));
  let result = { x, y, size: relationshipLabelSize(description, protocol, planned) };
  for (const relation of relations) {
    const from = boxes.find((box) => box.id === relation.from);
    const to = boxes.find((box) => box.id === relation.to);
    if (!from || !to) continue;
    const [, centerX, centerY] = getBezierPath({
      sourceX: from.x + from.width,
      sourceY: from.y + (from.type === "element" ? 30 : from.height / 2),
      targetX: to.x,
      targetY: to.y + (to.type === "element" ? 30 : to.height / 2),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
    const size = relationshipLabelSize(relation.description, relation.protocol, relation.planned);
    const position = placeRelationshipLabel({ x: centerX, y: centerY, ...size }, obstacles, bounds);
    obstacles.push({ ...size, x: position.x - size.width / 2, y: position.y - size.height / 2 });
    if (relation.id === id) result = { ...position, size };
  }
  return result;
}

function LabelLeader({ x, y, label }: { x: number; y: number; label: { x: number; y: number } }) {
  return Math.hypot(x - label.x, y - label.y) > 1 ? (
    <path d={`M ${x} ${y} L ${label.x} ${label.y}`} className="relationship-label-leader" />
  ) : null;
}

export function ConnectionEdge(props: EdgeProps<BoardEdge>) {
  const [path, x, y] = useGeometry(props);
  const design = useDraw((state) => state.loaded!.design);
  const connection = props.data && "connection" in props.data ? props.data.connection : undefined;
  const presentation = connection ? connectionPresentation(connection, design) : undefined;
  const label = useLabelPosition(
    props.id,
    x,
    y,
    presentation?.description ?? "",
    presentation?.protocol ?? "",
    presentation?.planned,
  );
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        className={`connection-path${props.selected ? " is-selected" : ""}`}
        interactionWidth={24}
        style={relationshipLineStyle(presentation?.interaction)}
      />
      <LabelLeader x={x} y={y} label={label} />
      {presentation ? (
        <EdgeChip
          x={label.x}
          y={label.y}
          size={label.size}
          text={
            <RelationshipLabel
              {...presentation}
              scenarioRelationship={{ kind: "connection", id: props.id }}
            />
          }
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

export function ContextEdge(props: EdgeProps<BoardEdge>) {
  const [path, x, y] = useGeometry(props);
  const text = props.data && "context" in props.data ? props.data.label : "";
  const protocol = props.data && "context" in props.data ? props.data.protocol : "HTTPS";
  const label = useLabelPosition(props.id, x, y, text, protocol);
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} className="connection-path" />
      <LabelLeader x={x} y={y} label={label} />
      <EdgeChip
        x={label.x}
        y={label.y}
        size={label.size}
        text={<RelationshipLabel description={text} protocol={protocol} />}
        className="context-chip"
        onClick={() => useDraw.getState().focus({ nodes: [], edges: [props.id] })}
      />
    </>
  );
}

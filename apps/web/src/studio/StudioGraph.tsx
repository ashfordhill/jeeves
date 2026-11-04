import type { StudioRelationship, StudioScopeProjection, StudioViewNode } from "@jeeves/spec";
import {
  Background,
  BaseEdge,
  type Edge,
  type EdgeProps,
  EdgeText,
  getBezierPath,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  useViewport,
  type Viewport,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraw } from "../draw/store.ts";
import {
  boundedStudioText,
  StudioProviderMark,
  StudioRoleIcon,
  studioCardDetails,
  studioCardSize,
} from "./card-appearance.tsx";
import { initialPosition, type Point } from "./creation.ts";

type Card = Node<{ item: StudioViewNode }, "studio">;
function StudioCard({ data, selected }: NodeProps<Card>) {
  const { zoom } = useViewport();
  const design = useDraw((state) => state.loaded?.design);
  const item = data.item;
  const details = design ? studioCardDetails(item, design) : {};
  const detailed = zoom >= 1.1;
  return (
    <div
      className="studio-card"
      data-selected={selected}
      data-kind={item.kind}
      data-shape={item.visual.shape}
      data-family={item.visual.color}
      data-density={detailed ? "detail" : "name"}
      title={[item.name, item.description, details.technology].filter(Boolean).join("\n")}
    >
      <Handle type="target" position={Position.Left} />
      <span className="studio-role-icon">
        <StudioRoleIcon node={item} />
        <StudioProviderMark provider={details.providerKey} label={details.provider} />
      </span>
      <span className="studio-card-text">
        <strong>{item.name}</strong>
        {detailed && item.description.trim() ? (
          <span className="studio-card-purpose">{item.description}</span>
        ) : null}
        {detailed && details.technology ? (
          <span className="studio-card-technology">{details.technology}</span>
        ) : null}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { studio: StudioCard };

type Relation = Edge<{ item: StudioRelationship }, "studio">;
function StudioRelation({ data, ...props }: EdgeProps<Relation>) {
  const { zoom } = useViewport();
  const [path, x, y] = getBezierPath(props);
  const item = data?.item;
  const action = item?.actions.join(" / ") ?? "";
  const protocols = item?.protocols
    .filter((protocol) => protocol !== "In process" && protocol !== "Unspecified")
    .join(" / ");
  const protocolText = boundedStudioText(protocols ?? "", 18);
  const label =
    zoom >= 1.1 && protocolText
      ? `${boundedStudioText(action, 53 - Array.from(protocolText).length)} · ${protocolText}`
      : boundedStudioText(action, zoom >= 1.1 ? 56 : 36);
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={props.style}
        interactionWidth={12}
      />
      {zoom >= 0.55 && label ? (
        <EdgeText
          x={x}
          y={y}
          label={label}
          labelStyle={{ fill: "var(--ink)", fontSize: 12 }}
          labelBgStyle={{ fill: "var(--cream)" }}
          labelBgPadding={[3, 2]}
          labelBgBorderRadius={2}
          className="studio-relation-text"
        />
      ) : null}
    </>
  );
}
const edgeTypes = { studio: StudioRelation };

/** Fixed role geometry; the later units own placement, dragging and shared route geometry. */
export function StudioGraph({
  scope,
  selection,
  selectedIds,
  placing,
  connecting,
  hand,
  camera,
  onCamera,
  onSelect,
  onOpen,
  onPlace,
  onCenter,
}: {
  scope: StudioScopeProjection;
  selection?: string;
  selectedIds?: string[];
  placing: boolean;
  connecting?: string;
  hand: boolean;
  camera?: Viewport;
  onCamera: (camera: Viewport) => void;
  onSelect: (id?: string) => void;
  onOpen: (key?: string) => void;
  onPlace: (point: Point) => void;
  onCenter: (point: Point) => void;
}) {
  const container = useRef<HTMLElement>(null);
  const saved = useDraw((state) => state.loaded?.layout.architecture?.[scope.key]);
  const [flow, setFlow] = useState<ReactFlowInstance<Card, Relation>>();
  const viewport = saved?.viewport;
  const appliedCamera = useRef(JSON.stringify(viewport));
  useEffect(() => {
    const next = JSON.stringify(viewport);
    if (!flow || appliedCamera.current === next) return;
    appliedCamera.current = next;
    if (viewport) void flow.setViewport(viewport);
  }, [flow, viewport]);
  const nodes = useMemo(
    () =>
      scope.nodes.map(
        (item, index): Card => ({
          id: item.id,
          type: "studio",
          position: saved?.positions[item.id] ?? initialPosition(index),
          data: { item },
          selected:
            selection === item.id || selectedIds?.includes(item.id) || connecting === item.id,
          ariaLabel: `Inspect ${item.name}`,
          ...studioCardSize(item),
          style: studioCardSize(item),
        }),
      ),
    [scope, selection, selectedIds, saved?.positions, connecting],
  );
  const edges = useMemo(
    () =>
      scope.edges.map(
        (edge): Relation => ({
          id: edge.id,
          type: "studio",
          source: edge.from,
          target: edge.to,
          data: { item: edge },
          selected: selection === edge.id,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: selection === edge.id ? "var(--blue)" : "var(--ink-soft)",
          },
          style: {
            stroke: selection === edge.id ? "var(--blue)" : "var(--ink-soft)",
            strokeWidth: selection === edge.id ? 3 : 2,
          },
          interactionWidth: 12,
          ariaLabel: `Inspect relationship: ${edge.actions.join(" / ")}${edge.protocols.length ? `; ${edge.protocols.join(" / ")}` : ""}`,
        }),
      ),
    [scope, selection],
  );
  return (
    <section
      className="studio-graph"
      ref={container}
      data-placing={placing || undefined}
      aria-label={`${scope.level === "context" ? "C1" : scope.level === "containers" ? "C2" : "C3"} ${scope.name}`}
      data-scope={scope.key}
    >
      <ReactFlow
        onInit={setFlow}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!hand}
        panOnDrag={hand ? true : [1, 2]}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={camera ?? viewport}
        fitView={!camera && !viewport}
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        onMoveEnd={(_, next) => {
          onCamera(next);
          const bounds = container.current?.getBoundingClientRect();
          if (flow && bounds)
            onCenter(
              flow.screenToFlowPosition({
                x: bounds.x + bounds.width / 2 - 108,
                y: bounds.y + bounds.height / 2 - 48,
              }),
            );
        }}
        onNodeClick={(_, node) => {
          if (!hand && !placing) onSelect(node.id);
        }}
        onNodeDoubleClick={(_, node) => {
          if (!hand && !placing && connecting === undefined) onOpen(node.data.item.drillKey);
        }}
        onEdgeClick={(_, edge) => {
          if (!hand && !placing) onSelect(edge.id);
        }}
        onPaneClick={(event) => {
          if (placing && flow)
            onPlace(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
          else if (!hand && connecting === undefined) onSelect();
        }}
      >
        <Background gap={24} color="var(--grid-dot)" />
      </ReactFlow>
    </section>
  );
}

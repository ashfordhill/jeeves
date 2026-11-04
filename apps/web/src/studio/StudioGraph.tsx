import type { StudioScopeProjection, StudioViewNode } from "@jeeves/spec";
import {
  Background,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraw } from "../draw/store.ts";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";
import { initialPosition, type Point } from "./creation.ts";

type Card = Node<{ item: StudioViewNode }, "studio">;
function StudioCard({ data, selected }: NodeProps<Card>) {
  return (
    <div className="studio-card" data-selected={selected} title={data.item.name}>
      <Handle type="target" position={Position.Left} />
      <TemplateIcon name={data.item.visual.icon} size={24} />
      <strong>{data.item.name}</strong>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { studio: StudioCard };

/** Navigation scaffold. The later geometry units own placement, drag, trunks and label density. */
export function StudioGraph({
  scope,
  selection,
  selectedIds,
  placing,
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
  const [flow, setFlow] = useState<ReactFlowInstance<Card>>();
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
          selected: selection === item.id || selectedIds?.includes(item.id),
          ariaLabel: `Inspect ${item.name}`,
          width: 216,
          height: 96,
        }),
      ),
    [scope, selection, selectedIds, saved?.positions],
  );
  const edges = useMemo(
    () =>
      scope.edges.map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.actions.join(" / "),
        selected: selection === edge.id,
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ink-soft)" },
        style: { stroke: "var(--ink-soft)", strokeWidth: 2 },
        labelStyle: { fill: "var(--ink)", fontSize: 12 },
        labelBgStyle: { fill: "var(--cream)" },
        interactionWidth: 12,
        ariaLabel: `Inspect relationship: ${edge.actions.join(" / ")}`,
      })),
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
          if (!hand && !placing) onOpen(node.data.item.drillKey);
        }}
        onEdgeClick={(_, edge) => {
          if (!hand && !placing) onSelect(edge.id);
        }}
        onPaneClick={(event) => {
          if (placing && flow)
            onPlace(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
          else if (!hand) onSelect();
        }}
      >
        <Background gap={24} color="var(--grid-dot)" />
      </ReactFlow>
    </section>
  );
}

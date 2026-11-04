import type { StudioScopeProjection, StudioViewNode } from "@jeeves/spec";
import {
  Background,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type Viewport,
} from "@xyflow/react";
import { useMemo } from "react";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";

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
  hand,
  camera,
  onCamera,
  onSelect,
  onOpen,
}: {
  scope: StudioScopeProjection;
  selection?: string;
  hand: boolean;
  camera?: Viewport;
  onCamera: (camera: Viewport) => void;
  onSelect: (id?: string) => void;
  onOpen: (key?: string) => void;
}) {
  const nodes = useMemo(
    () =>
      scope.nodes.map(
        (item, index): Card => ({
          id: item.id,
          type: "studio",
          position: { x: (index % 3) * 288, y: Math.floor(index / 3) * 168 },
          data: { item },
          selected: selection === item.id,
          ariaLabel: `Inspect ${item.name}`,
          width: 216,
          height: 96,
        }),
      ),
    [scope, selection],
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
      aria-label={`${scope.level === "context" ? "C1" : scope.level === "containers" ? "C2" : "C3"} ${scope.name}`}
      data-scope={scope.key}
    >
      <ReactFlow
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
        defaultViewport={camera}
        fitView={!camera}
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        onMoveEnd={(_, next) => onCamera(next)}
        onNodeClick={(_, node) => {
          if (!hand) onSelect(node.id);
        }}
        onNodeDoubleClick={(_, node) => {
          if (!hand) onOpen(node.data.item.drillKey);
        }}
        onEdgeClick={(_, edge) => {
          if (!hand) onSelect(edge.id);
        }}
        onPaneClick={() => {
          if (!hand) onSelect();
        }}
      >
        <Background gap={24} color="var(--grid-dot)" />
      </ReactFlow>
    </section>
  );
}

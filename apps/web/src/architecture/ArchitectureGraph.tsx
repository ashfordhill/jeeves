import type {
  ArchitectureProjection,
  ArchitectureSupport,
  ArchitectureViewNode,
} from "@jeeves/spec";
import { useElementSize } from "@mantine/hooks";
import {
  IconBox,
  IconBuilding,
  IconDatabase,
  IconPuzzle,
  IconUser,
  IconWorld,
} from "@tabler/icons-react";
import {
  Background,
  BaseEdge,
  Controls,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useMemo } from "react";

export const supportLabel: Record<ArchitectureSupport, string> = {
  template: "Template provided",
  recipe: "Recipe provided",
  extension: "Project implementation",
  intent: "Architecture intent",
  external: "Externally supplied",
};
type CardNode = Node<
  { item: ArchitectureViewNode; onSelect: (id: string) => void },
  "architecture"
>;
function ArchitectureCard({ data, selected }: NodeProps<CardNode>) {
  const item = data.item;
  const Icon =
    item.kind === "person"
      ? IconUser
      : item.kind === "external-system"
        ? IconWorld
        : item.kind === "system"
          ? IconBuilding
          : item.kind === "component"
            ? IconPuzzle
            : item.technology.toLowerCase().includes("postgres")
              ? IconDatabase
              : IconBox;
  return (
    <>
      {([Position.Left, Position.Right, Position.Top] as const).flatMap((side) =>
        (["source", "target"] as const).flatMap((type) =>
          ([30, 50, 70] as const).map((port) => (
            <Handle
              key={`${side}-${type}-${port}`}
              type={type}
              position={side}
              id={`${side}-${type}-${port}`}
              style={side === Position.Top ? { left: `${port}%` } : { top: `${port}%` }}
            />
          )),
        ),
      )}
      <button
        type="button"
        className="architecture-card nodrag"
        data-selected={selected}
        data-kind={item.kind}
        onClick={() => data.onSelect(item.id)}
        aria-pressed={selected}
        aria-label={`Inspect ${item.name}`}
      >
        <span className="architecture-card-kind">
          <Icon size={21} aria-hidden />
          {item.kind.replaceAll("-", " ")}
        </span>
        <strong>{item.name}</strong>
        <span className="architecture-card-description">{item.description}</span>
        <span className="architecture-card-technology">{item.technology}</span>
        <span className="architecture-support" data-support={item.support}>
          {supportLabel[item.support]}
        </span>
      </button>
    </>
  );
}
type ScopeNode = Node<{ label: string }, "scope">;
function ScopeFrame({ data }: NodeProps<ScopeNode>) {
  return (
    <div className="architecture-scope-frame">
      <strong>{data.label}</strong>
    </div>
  );
}
const nodeTypes = { architecture: ArchitectureCard, scope: ScopeFrame };
type RelationEdge = Edge<
  { description: string; lane?: number; laneX?: number; insideFrom?: boolean },
  "relation"
>;
function Relation({ data, ...props }: EdgeProps<RelationEdge>) {
  let [path, x, y] = getSmoothStepPath(props);
  if (data?.lane !== undefined) {
    y = data.lane;
    const laneX = data.laneX ?? Math.max(props.sourceX, props.targetX) + 40;
    x = ((data.insideFrom ? props.sourceX : props.targetX) + laneX) / 2;
    path = data.insideFrom
      ? `M ${props.sourceX},${props.sourceY} V ${y} H ${laneX} V ${props.targetY} H ${props.targetX}`
      : `M ${props.sourceX},${props.sourceY} H ${laneX} V ${y} H ${props.targetX} V ${props.targetY}`;
  }
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
      <EdgeLabelRenderer>
        <span
          className="architecture-relation-label"
          style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
        >
          {data?.description}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}
const edgeTypes = { relation: Relation };

function FocusControl({ selected }: { selected?: string }) {
  const { fitView } = useReactFlow();
  return (
    <Panel position="top-right">
      <button
        type="button"
        className="architecture-focus"
        disabled={!selected}
        onClick={() => {
          if (selected)
            void fitView({ nodes: [{ id: selected }], minZoom: 1, maxZoom: 1, duration: 200 });
        }}
      >
        Focus selected object
      </button>
    </Panel>
  );
}

/** Positions belong to this derived view only. The editable board's layout is never touched. */
function positions(
  projection: ArchitectureProjection,
  compact: boolean,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (projection.level === "context") {
    let people = 0,
      external = 0;
    for (const node of projection.nodes) {
      if (node.kind === "system") out.set(node.id, { x: 490, y: compact ? 0 : 170 });
      else if (node.kind === "person") out.set(node.id, { x: 0, y: people++ * 330 });
      else out.set(node.id, { x: compact ? 490 : 980, y: external++ * 330 + 330 });
    }
  } else {
    const inner = projection.nodes.filter(
      (node) =>
        node.binding &&
        (projection.level === "containers"
          ? node.kind !== "external-system" && node.kind !== "binding"
          : node.binding.element === projection.container),
    );
    const outer = projection.nodes.filter((node) => !inner.includes(node));
    const columns = Math.min(inner.length > 9 ? 4 : 3, inner.length || 1);
    for (const [index, node] of inner.entries())
      out.set(node.id, {
        x: (index % columns) * 312,
        y: Math.floor(index / columns) * 242 + (projection.level === "containers" ? 330 : 0),
      });
    for (const [index, node] of outer.entries())
      out.set(
        node.id,
        projection.level === "containers"
          ? { x: index * 360, y: 0 }
          : { x: columns * 312 + 80, y: index * 280 },
      );
  }
  return out;
}

export function ArchitectureGraph({
  projection,
  selected,
  onSelect,
}: {
  projection: ArchitectureProjection;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const { ref, width } = useElementSize<HTMLElement>();
  const compact = width > 0 && width < 900;
  const graph = useMemo(() => {
    const points = positions(projection, compact);
    const nodes: (CardNode | ScopeNode)[] = projection.nodes.map((item) => ({
      id: item.id,
      type: "architecture",
      ariaRole: "group",
      position: points.get(item.id) ?? { x: 0, y: 0 },
      data: { item, onSelect },
      selected: item.id === selected,
      zIndex: 1,
      style: { width: 252, height: 188 },
    }));
    const inner = projection.nodes.filter(
      (node) =>
        node.binding &&
        ((projection.level === "containers" &&
          node.kind !== "external-system" &&
          node.kind !== "binding") ||
          (projection.level === "components" && node.binding.element === projection.container)),
    );
    if (inner.length) {
      const coordinates = inner.map((node) => points.get(node.id) ?? { x: 0, y: 0 });
      const minX = Math.min(...coordinates.map((point) => point.x)),
        minY = Math.min(...coordinates.map((point) => point.y));
      nodes.unshift({
        id: "architecture:scope",
        type: "scope",
        position: { x: minX - 24, y: minY - 42 },
        data: { label: projection.name },
        style: {
          width: Math.max(...coordinates.map((point) => point.x)) - minX + 300,
          height: Math.max(...coordinates.map((point) => point.y)) - minY + 254,
        },
        zIndex: 0,
        selectable: false,
        focusable: false,
      });
    }
    const edges = projection.edges
      .filter((edge) => points.has(edge.from) && points.has(edge.to))
      .map((edge, index): RelationEdge => {
        const forward = (points.get(edge.from)?.x ?? 0) <= (points.get(edge.to)?.x ?? 0);
        const reciprocal = projection.edges.some(
          (other) => other.from === edge.to && other.to === edge.from,
        );
        const port = reciprocal ? (edge.from < edge.to ? 30 : 70) : 50;
        // Component dependencies leave the scope above its first responsibility row,
        // keeping the pinned boundary/adapter's connections clear of the feature cards.
        const inside = projection.nodes.find(
          (node) =>
            node.binding?.element === projection.container &&
            (node.id === edge.from || node.id === edge.to),
        );
        const lane =
          projection.level === "components" && inside && points.get(inside.id)?.y === 0
            ? -70 - index * 40
            : undefined;
        const outside = inside?.id === edge.from ? edge.to : edge.from;
        const laneX = (points.get(outside)?.x ?? 0) + 292 + index * 18;
        return {
          id: edge.id,
          source: edge.from,
          target: edge.to,
          sourceHandle: `${lane !== undefined ? (inside?.id === edge.from ? "top" : "right") : forward ? "right" : "left"}-source-${port}`,
          targetHandle: `${lane !== undefined ? (inside?.id === edge.to ? "top" : "right") : forward ? "left" : "right"}-target-${port}`,
          type: "relation",
          data: {
            description: edge.description,
            lane,
            laneX,
            insideFrom: inside?.id === edge.from,
          },
          style: {
            stroke: "var(--line)",
            strokeWidth: 2,
            ...(edge.context ? { strokeDasharray: "5 4" } : {}),
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--line)" },
        };
      });
    return { nodes, edges };
  }, [projection, selected, onSelect, compact]);
  return (
    <section ref={ref} className="architecture-graph" aria-label={`${projection.level} diagram`}>
      <ReactFlowProvider>
        <ReactFlow
          key={`${projection.level}:${projection.container ?? "system"}:${compact}`}
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.65, maxZoom: 1 }}
          minZoom={0.35}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--grid-dot)" gap={24} size={1} />
          <Controls showInteractive={false} />
          <FocusControl selected={selected} />
        </ReactFlow>
      </ReactFlowProvider>
    </section>
  );
}

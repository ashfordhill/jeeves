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
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ArchitectureGeometry,
  architectureLayoutInput,
  CARD,
  type RelationGeometry,
  relationshipPath,
  SCOPE_ID,
} from "./layout.ts";
import { layoutArchitecture } from "./layout-client.ts";

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
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <button
        type="button"
        className="architecture-card nodrag nopan"
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
      <strong title={data.label}>{data.label}</strong>
    </div>
  );
}
const nodeTypes = { architecture: ArchitectureCard, scope: ScopeFrame };
type RelationEdge = Edge<{ description: string; geometry: RelationGeometry }, "relation">;
function Relation({ data, ...props }: EdgeProps<RelationEdge>) {
  if (!data) return null;
  const { label, points } = data.geometry;
  return (
    <>
      <BaseEdge
        id={props.id}
        path={relationshipPath(points)}
        markerEnd={props.markerEnd}
        style={props.style}
      />
      <EdgeLabelRenderer>
        <span
          className="architecture-relation-label nodrag nopan"
          data-relation-id={props.id}
          title={data.description}
          style={{ left: label.x, top: label.y, width: label.width, height: label.height }}
        >
          <span>{data.description}</span>
        </span>
      </EdgeLabelRenderer>
    </>
  );
}
const edgeTypes = { relation: Relation };

function InitialCamera({ minimumZoom, onReady }: { minimumZoom: number; onReady: () => void }) {
  // Read-only nodes do not feed dimension changes back through onNodesChange. Inspect the
  // current measured internals rather than the cached controlled-node initialization flag.
  const initialized = useNodesInitialized({ includeHiddenNodes: true });
  const { fitView } = useReactFlow();
  const fitted = useRef(false);
  useEffect(() => {
    if (!initialized || fitted.current) return;
    let active = true;
    void fitView({ padding: 0.1, minZoom: minimumZoom, maxZoom: 1 }).then(() => {
      if (active) {
        fitted.current = true;
        onReady();
      }
    });
    return () => {
      active = false;
    };
  }, [initialized, fitView, minimumZoom, onReady]);
  return null;
}

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

/** Layout never writes the semantic model or editable board positions. */
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
  const [direction, setDirection] = useState<boolean>();
  const down = direction ?? compact;
  const key = useMemo(
    () => JSON.stringify(architectureLayoutInput(projection, down)),
    [projection, down],
  );
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; geometry: ArchitectureGeometry }>();
  const [error, setError] = useState<string>();
  const [cameraReadyKey, setCameraReadyKey] = useState<string>();
  const cameraReady = useCallback(() => setCameraReadyKey(key), [key]);
  const ready = width > 0;
  const request = useMemo(() => ({ key, attempt }), [key, attempt]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setError(undefined);
    void layoutArchitecture(request.key, controller.signal).then(
      (geometry) => {
        if (!controller.signal.aborted) setResult({ key: request.key, geometry });
      },
      () => {
        if (!controller.signal.aborted)
          setError(
            "This architecture view could not be arranged. Retry the layout or return to the board.",
          );
      },
    );
    return () => controller.abort();
  }, [request, ready]);
  const current = result?.key === key ? result.geometry : undefined;
  const graph = useMemo(() => {
    if (!current) return undefined;
    const nodes: (CardNode | ScopeNode)[] = projection.nodes.map((item) => {
      const point = current.nodes[item.id];
      if (!point) throw new Error("Architecture object geometry is missing.");
      return {
        id: item.id,
        type: "architecture",
        ariaRole: "group",
        position: { x: point.x, y: point.y },
        width: CARD.width,
        height: CARD.height,
        data: { item, onSelect },
        selected: item.id === selected,
        zIndex: 1,
        style: CARD,
      };
    });
    if (current.scope)
      nodes.unshift({
        id: SCOPE_ID,
        type: "scope",
        position: { x: current.scope.x, y: current.scope.y },
        width: current.scope.width,
        height: current.scope.height,
        data: { label: projection.name },
        style: { width: current.scope.width, height: current.scope.height },
        zIndex: 0,
        selectable: false,
        focusable: false,
      });
    const edges: RelationEdge[] = projection.edges.map((edge) => {
      const geometry = current.edges[edge.id];
      if (!geometry) throw new Error("Architecture relationship geometry is missing.");
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: "relation",
        data: { description: edge.description, geometry },
        style: {
          stroke: "var(--line)",
          strokeWidth: 2,
          ...(edge.context ? { strokeDasharray: "5 4" } : {}),
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--line)" },
      };
    });
    return { nodes, edges };
  }, [projection, selected, onSelect, current]);
  return (
    <section
      ref={ref}
      className="architecture-graph"
      aria-label={`${projection.level} diagram`}
      aria-busy={!error && (!graph || (projection.nodes.length > 0 && cameraReadyKey !== key))}
    >
      {error ? (
        <div className="architecture-layout-status" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="architecture-focus"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry layout
          </button>
        </div>
      ) : !graph ? (
        <div className="architecture-layout-status" role="status">
          Arranging architecture…
        </div>
      ) : (
        <ReactFlowProvider>
          <ReactFlow
            key={`${projection.level}:${projection.container ?? "system"}:${down}`}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.1}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <InitialCamera
              minimumZoom={projection.level === "components" ? 0.6 : 0.1}
              onReady={cameraReady}
            />
            <Background color="var(--grid-dot)" gap={24} size={1} />
            <Controls showInteractive={false} />
            <Panel position="top-left">
              <button
                type="button"
                className="architecture-focus"
                onClick={() => setDirection(!down)}
              >
                {down ? "Flow right" : "Flow down"}
              </button>
            </Panel>
            <FocusControl selected={selected} />
          </ReactFlow>
        </ReactFlowProvider>
      )}
    </section>
  );
}

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
  getViewportForBounds,
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
  useStore,
  useViewport,
  type Viewport,
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
  planned: "Planned",
  mixed: "Mixed ownership",
};
type CardNode = Node<
  { item: ArchitectureViewNode; onSelect: (id: string) => void },
  "architecture"
>;
function ArchitectureCard({ data, selected }: NodeProps<CardNode>) {
  const item = data.item;
  const { zoom } = useViewport();
  const overview = zoom < 0.65;
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
        data-support={item.support}
        data-overview={overview}
        onClick={() => data.onSelect(item.id)}
        aria-pressed={selected}
        aria-label={`Inspect ${item.name}`}
      >
        <span className="architecture-card-kind">
          <Icon size={21} aria-hidden />
          {item.kind.replaceAll("-", " ")}
        </span>
        <strong style={{ fontSize: overview ? 14 / Math.max(zoom, 0.25) : 18 }}>{item.name}</strong>
        <span className="architecture-card-description">{item.description}</span>
        {item.members?.length ? (
          <span className="architecture-card-technology">
            {item.members.length} bound capabilities
          </span>
        ) : null}
        {item.support === "planned" || item.missing?.length || item.unassigned ? (
          <span
            className="architecture-support"
            data-support={item.support}
            style={overview ? { fontSize: 9 / Math.max(zoom, 0.25) } : undefined}
          >
            {item.missing?.length
              ? "Binding needs attention"
              : item.unassigned
                ? "Ungrouped"
                : "Planned"}
          </span>
        ) : null}
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
type RelationEdge = Edge<
  { description: string; geometry: RelationGeometry; onSelect: (id: string) => void },
  "relation"
>;
function Relation({ data, ...props }: EdgeProps<RelationEdge>) {
  const { zoom } = useViewport();
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
        <button
          type="button"
          onClick={() => data.onSelect(props.id)}
          aria-label={`Inspect relationship: ${data.description}`}
          className="architecture-relation-label nodrag nopan"
          data-relation-id={props.id}
          title={data.description}
          style={{
            left: label.x,
            top: label.y,
            width: label.width,
            height: label.height,
            fontSize: Math.min(20, 11 / zoom),
          }}
        >
          <span>{data.description}</span>
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
const edgeTypes = { relation: Relation };

function InitialCamera({ onReady, restored }: { onReady: () => void; restored?: Viewport }) {
  // Read-only nodes do not feed dimension changes back through onNodesChange. Inspect the
  // current measured internals rather than the cached controlled-node initialization flag.
  const initialized = useNodesInitialized({ includeHiddenNodes: true });
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const { getNodes, getNodesBounds, setViewport, viewportInitialized } = useReactFlow();
  const saved = useRef(restored);
  const fitted = useRef(false);
  useEffect(() => {
    if (!initialized || !viewportInitialized || width <= 0 || height <= 0 || fitted.current) return;
    let active = true;
    // Set the camera from measured bounds directly. Queued fitView can wait indefinitely
    // when a controlled read-only graph replaces nodes during initial measurement.
    const viewport =
      saved.current ??
      getViewportForBounds(getNodesBounds(getNodes()), width, height, 0.1, 1, 0.12);
    void setViewport(viewport).then(() => {
      if (active) {
        fitted.current = true;
        onReady();
      }
    });
    return () => {
      active = false;
    };
  }, [
    initialized,
    viewportInitialized,
    width,
    height,
    getNodes,
    getNodesBounds,
    setViewport,
    onReady,
  ]);
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
export type ArchitectureCameraCache = {
  directions: Map<string, boolean>;
  viewports: Map<string, { key: string; viewport: Viewport }>;
};
export function ArchitectureGraph({
  projection,
  selected,
  onSelect,
  cameraCache,
}: {
  projection: ArchitectureProjection;
  selected?: string;
  onSelect: (id: string) => void;
  cameraCache?: ArchitectureCameraCache;
}) {
  const { ref, width } = useElementSize<HTMLElement>();
  const compact = width > 0 && width < 900;
  const scope = `${projection.level}:${projection.container ?? "system"}`;
  const [directions, setDirections] = useState<Record<string, boolean>>({});
  const direction = directions[scope] ?? cameraCache?.directions.get(scope);
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
          setError("This architecture view could not be arranged. Retry the layout or open C2.");
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
        data: { description: edge.description, geometry, onSelect },
        style: {
          stroke: "var(--line)",
          strokeWidth: 2,
          ...(edge.context || edge.declared ? { strokeDasharray: "5 4" } : {}),
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
            onMoveEnd={(_, viewport) =>
              cameraCache?.viewports.set(`${scope}:${down}`, { key, viewport })
            }
            onEdgeClick={(_, edge) => onSelect(edge.id)}
          >
            <InitialCamera
              key={key}
              restored={
                cameraCache?.viewports.get(`${scope}:${down}`)?.key === key
                  ? cameraCache.viewports.get(`${scope}:${down}`)?.viewport
                  : undefined
              }
              onReady={cameraReady}
            />
            <Background color="var(--grid-dot)" gap={24} size={1} />
            <Controls showInteractive={false} />
            <Panel position="top-left">
              <button
                type="button"
                className="architecture-focus"
                onClick={() => {
                  setDirections((current) => ({ ...current, [scope]: !down }));
                  cameraCache?.directions.set(scope, !down);
                }}
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

import type { StudioScopeProjection, StudioViewNode } from "@jeeves/spec";
import {
  Background,
  BaseEdge,
  type Edge,
  type EdgeProps,
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
  StudioProviderMark,
  StudioRoleIcon,
  studioCardDetails,
  studioCardSize,
} from "./card-appearance.tsx";
import { initialPosition, type Point } from "./creation.ts";
import { type StudioPath, type StudioRoute, studioPaths, studioRouteGeometry } from "./routing.ts";

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

type Relation = Edge<{ path: StudioPath; route: StudioRoute }, "studio">;
function StudioRelation({ data, ...props }: EdgeProps<Relation>) {
  const { zoom } = useViewport();
  if (!data) return null;
  const { route, path } = data;
  const label = zoom >= 1.1 ? route.label?.detail : route.label?.short;
  return (
    <g
      data-path-kind={path.branchIds ? "trunk" : path.trunk ? "branch" : "relationship"}
      data-members={path.item.members.map((m) => m.id).join("|")}
      data-connections={path.item.connectionIds.join("|")}
      data-original-edges={path.edgeIds.join("|")}
    >
      <path d={route.path} className="studio-crossing-gap" />
      <BaseEdge
        id={props.id}
        path={route.path}
        markerEnd={path.branchIds ? undefined : props.markerEnd}
        style={props.style}
        interactionWidth={12}
      />
      {route.junction ? (
        <circle
          className="studio-junction"
          cx={route.junction.x}
          cy={route.junction.y}
          r={3}
          style={{ fill: props.style?.stroke }}
        />
      ) : null}
      {zoom >= 0.55 && label && route.label ? (
        <text
          x={route.label.x + route.label.width / 2}
          y={route.label.y + 13}
          textAnchor="middle"
          className="studio-relation-text"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
const edgeTypes = { studio: StudioRelation };

/** Fixed role/edge geometry; movement and fresh-scope arrangement belong to UX11. */
export function StudioGraph({
  scope,
  selection,
  member,
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
  member?: { kind: "connection" | "context"; id: string };
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
  const paths = useMemo(() => studioPaths(scope), [scope]);
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) setFontReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  const geometry = useMemo(() => {
    const context = fontReady ? document.createElement("canvas").getContext("2d") : null;
    if (context) context.font = '12px "Nunito Variable", Nunito, system-ui, sans-serif';
    return studioRouteGeometry(
      paths,
      Object.fromEntries(
        scope.nodes.map((item, index) => [
          item.id,
          {
            ...(saved?.positions[item.id] ?? initialPosition(index)),
            ...studioCardSize(item),
          },
        ]),
      ),
      (text) => context?.measureText(text).width ?? Array.from(text).length * 8,
    );
  }, [paths, scope.nodes, saved?.positions, fontReady]);
  const edges = useMemo(
    () =>
      paths.map((path): Relation => {
        const selected = member
          ? (member.kind === "connection"
              ? path.item.connectionIds
              : path.item.contextRelationshipIds
            ).includes(member.id)
          : selection === path.id || path.edgeIds.includes(selection ?? "");
        return {
          id: path.id,
          type: "studio",
          source: path.item.from,
          target: path.item.to,
          data: { path, route: geometry[path.id] as StudioRoute },
          selected,
          zIndex: path.branchIds ? 0 : 1,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: selected ? "var(--blue)" : "var(--ink-soft)",
          },
          style: {
            stroke: selected ? "var(--blue)" : "var(--ink-soft)",
            strokeWidth: selected ? 3 : 2,
          },
          interactionWidth: 12,
          ariaLabel: `Inspect ${path.branchIds ? "shared paths" : "relationship"}: ${path.item.actions.join(" / ")}${path.item.protocols.length ? `; ${path.item.protocols.join(" / ")}` : ""}`,
        };
      }),
    [paths, geometry, selection, member],
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
        elevateEdgesOnSelect={false}
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

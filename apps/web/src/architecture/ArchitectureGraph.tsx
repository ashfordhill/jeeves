import type {
  ArchitectureProjection,
  ArchitectureSupport,
  ArchitectureViewEdge,
  ArchitectureViewNode,
} from "@jeeves/spec";
import { ActionIcon, Button, Group, Menu } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconDots } from "@tabler/icons-react";
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
import { useDraw } from "../draw/store.ts";
import { TemplateIcon } from "../draw/TemplateIcon.tsx";
import {
  type ArchitectureGeometry,
  architectureBounds,
  architectureLayoutInput,
  positionedArchitectureGeometry,
  type RelationGeometry,
  relationshipPath,
  SCOPE_ID,
} from "./layout.ts";
import { layoutArchitecture } from "./layout-client.ts";
import { RelationshipLabel, relationshipLineStyle } from "./RelationshipLabel.tsx";
import { ScenarioMenuItems } from "./Scenarios.tsx";
import { nodeFamily, typeStyles } from "./type-style.tsx";

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
  {
    item: ArchitectureViewNode;
    showTechnology: boolean;
    onSelect: (id: string) => void;
    onOpen?: (element: string, component?: string) => void;
    showResponsibilities: boolean;
    connected?: boolean;
  },
  "architecture"
>;
function ArchitectureCard({ data, selected }: NodeProps<CardNode>) {
  const item = data.item;
  const { zoom } = useViewport();
  const graphWidth = useStore((state) => state.width);
  const overview = zoom < 0.65 && graphWidth < 600;
  const design = useDraw((state) => state.loaded!.design);
  const family = nodeFamily(item, design);
  const style = typeStyles[family];
  return (
    <>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <span className="architecture-drag-handle" title="Drag to move" aria-hidden="true">
        ⠿
      </span>
      <div className="architecture-card-shell" data-dimmed={data.connected === false}>
        <button
          type="button"
          className="architecture-card nodrag nopan"
          data-selected={selected}
          data-kind={item.kind}
          data-has-responsibilities={data.showResponsibilities && !!item.responsibilities?.length}
          data-family={family}
          data-support={item.support}
          data-overview={overview}
          onClick={() => data.onSelect(item.id)}
          aria-pressed={selected}
          aria-label={`Inspect ${item.name}`}
        >
          <span className="architecture-card-kind">
            <TemplateIcon name={style.icon} size={21} />
            {item.deploymentKind ??
              (item.kind === "component"
                ? "Component"
                : item.kind === "binding"
                  ? "Capability group"
                  : style.label)}
          </span>
          <strong
            style={{
              fontSize: overview
                ? Math.min(28, 14 / Math.max(zoom, 0.25))
                : Math.min(26, Math.max(18, 12 / zoom)),
            }}
          >
            {item.name}
          </strong>
          <span className="architecture-card-description">{item.description}</span>
          {data.showTechnology && item.technology ? (
            <span className="architecture-card-technology">{item.technology}</span>
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
        {data.showResponsibilities && item.responsibilities?.length ? (
          <div className="architecture-card-responsibilities nodrag nopan" data-family={family}>
            <span>Inside this application · C3</span>
            {item.responsibilities.map((member) => (
              <button
                type="button"
                key={member.id}
                title={member.description}
                onClick={() => data.onOpen?.(item.binding!.element, member.id)}
              >
                <span aria-hidden="true">▧</span> {member.name}
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        ) : null}
        {data.onOpen && item.binding && item.responsibilities && !item.responsibilities.length ? (
          <button
            type="button"
            className="architecture-card-open nodrag nopan"
            onClick={() => data.onOpen?.(item.binding!.element)}
          >
            Design components →
          </button>
        ) : null}
      </div>
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
type BoundsNode = Node<Record<string, never>, "bounds">;
const nodeTypes = { architecture: ArchitectureCard, scope: ScopeFrame, bounds: () => null };
type RelationEdge = Edge<
  {
    description: string;
    presentation: ArchitectureViewEdge;
    geometry: RelationGeometry;
    onSelect: (id: string) => void;
  },
  "relation"
>;
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
            fontSize: 12,
            lineHeight: data.presentation.protocol ? "1.2" : undefined,
          }}
        >
          <RelationshipLabel
            {...data.presentation}
            contractCount={undefined}
            scenarioRelationship={
              data.presentation.componentRelationship
                ? { kind: "componentRelationship", id: data.presentation.componentRelationship }
                : data.presentation.connection
                  ? { kind: "connection", id: data.presentation.connection }
                  : undefined
            }
          />
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

function FocusSelection({
  request,
  selected,
  projection,
  ready,
}: {
  request: number;
  selected?: string;
  projection: ArchitectureProjection;
  ready: boolean;
}) {
  const { fitView } = useReactFlow();
  const width = useStore((state) => state.width);
  const previous = useRef("");
  useEffect(() => {
    const key = `${request}:${width}`;
    if (!ready || !selected || !request || key === previous.current) return;
    const edge = projection.edges.find((edge) => edge.id === selected);
    const nodes = edge ? [{ id: edge.from }, { id: edge.to }] : [{ id: selected }];
    if (!nodes.some((node) => projection.nodes.some((item) => item.id === node.id))) return;
    previous.current = key;
    void fitView({ nodes, minZoom: 0.75, maxZoom: 1, duration: 200 });
  }, [request, selected, ready, projection, fitView, width]);
  return null;
}

function DiagramOptions({
  selected,
  projection,
  down,
  onDirection,
  onNudge,
  onReset,
}: {
  selected?: string;
  projection: ArchitectureProjection;
  down: boolean;
  onDirection: () => void;
  onNudge: (x: number, y: number) => void;
  onReset: () => void;
}) {
  const { fitView } = useReactFlow();
  const undoable = useDraw((state) => state.architectureUndo.length > 0);
  const redoable = useDraw((state) => state.architectureRedo.length > 0);
  const edge = projection.edges.find((edge) => edge.id === selected);
  const selectedNodes = edge
    ? [{ id: edge.from }, { id: edge.to }]
    : selected
      ? [{ id: selected }]
      : [];
  const movable = projection.nodes.some((node) => node.id === selected);
  return (
    <>
      <Panel position="bottom-center" className="diagram-view-controls">
        <Group gap={5}>
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => void fitView({ padding: 0.08, duration: 200 })}
          >
            Fit diagram
          </Button>
          <Button
            size="compact-xs"
            variant="default"
            disabled={!selected}
            onClick={() =>
              void fitView({ nodes: selectedNodes, minZoom: 0.8, maxZoom: 1, duration: 200 })
            }
          >
            Focus selection
          </Button>
          <Button size="compact-xs" variant="default" onClick={onReset}>
            Auto-arrange
          </Button>
        </Group>
      </Panel>
      <Panel position="top-right">
        <Menu position="bottom-end" shadow="md">
          <Menu.Target>
            <ActionIcon variant="default" aria-label="Diagram options" size="lg">
              <IconDots size={19} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onDirection}>{down ? "Flow right" : "Flow down"}</Menu.Item>
            <Menu.Item
              disabled={!selected}
              onClick={() =>
                void fitView({ nodes: selectedNodes, minZoom: 0.65, maxZoom: 1, duration: 200 })
              }
            >
              Fit selected
            </Menu.Item>
            <Menu.Item
              disabled={!selected}
              onClick={() =>
                void fitView({ nodes: selectedNodes, minZoom: 1, maxZoom: 1, duration: 200 })
              }
            >
              Focus selected object
            </Menu.Item>
            <Menu.Label>Move selected object</Menu.Label>
            <Menu.Item disabled={!movable} onClick={() => onNudge(-24, 0)}>
              Nudge left
            </Menu.Item>
            <Menu.Item disabled={!movable} onClick={() => onNudge(24, 0)}>
              Nudge right
            </Menu.Item>
            <Menu.Item disabled={!movable} onClick={() => onNudge(0, -24)}>
              Nudge up
            </Menu.Item>
            <Menu.Item disabled={!movable} onClick={() => onNudge(0, 24)}>
              Nudge down
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              disabled={!undoable}
              onClick={() => useDraw.getState().undoArchitectureLayout()}
            >
              Undo layout
            </Menu.Item>
            <Menu.Item
              disabled={!redoable}
              onClick={() => useDraw.getState().redoArchitectureLayout()}
            >
              Redo layout
            </Menu.Item>
            <Menu.Item onClick={onReset}>Auto-arrange diagram</Menu.Item>
            <ScenarioMenuItems />
          </Menu.Dropdown>
        </Menu>
      </Panel>
    </>
  );
}

/** Geometry, membership and cameras persist independently of semantic edits. */
export function ArchitectureGraph({
  projection: sourceProjection,
  selected,
  onSelect,
  viewKey,
  onOpen,
  focusRequest = 0,
}: {
  projection: ArchitectureProjection;
  selected?: string;
  onSelect: (id: string) => void;
  viewKey?: string;
  focusRequest?: number;
  onOpen?: (element: string, component?: string) => void;
}) {
  const design = useDraw((state) => state.loaded!.design);
  const projection = useMemo(
    () => ({
      ...sourceProjection,
      nodes: sourceProjection.nodes.filter(
        (node) =>
          sourceProjection.level !== "containers" ||
          node.kind !== "system" ||
          sourceProjection.edges.some((edge) => edge.from === node.id || edge.to === node.id),
      ),
      edges: sourceProjection.edges.map((edge) => ({
        ...edge,
        contractCount:
          design.architecture?.bindings?.filter((binding) =>
            binding.relationship.kind === "connection"
              ? binding.relationship.id === edge.connection
              : binding.relationship.id === edge.componentRelationship,
          ).length ?? 0,
      })),
    }),
    [sourceProjection, design.architecture?.bindings],
  );
  const { ref, width } = useElementSize<HTMLElement>();
  const compact = width > 0 && width < 900;
  const scope = viewKey ?? `${projection.level}:${projection.container ?? "system"}`;
  const saved = useDraw((state) => state.loaded?.layout.architecture?.[scope]);
  const [dragging, setDragging] = useState<Record<string, { x: number; y: number }>>({});
  const [reset, setReset] = useState(0);
  const down = saved?.down ?? compact;
  const update = (patch: Partial<NonNullable<typeof saved>>, undoable = false) => {
    const previous = useDraw.getState().loaded?.layout.architecture?.[scope];
    useDraw
      .getState()
      .setArchitectureView(scope, { positions: {}, ...previous, ...patch }, undoable);
  };
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
  const current = useMemo(
    () =>
      result?.key === key
        ? positionedArchitectureGeometry(result.geometry, projection, {
            ...saved?.positions,
            ...dragging,
          })
        : undefined,
    [result, key, projection, saved?.positions, dragging],
  );
  const selectedEdge = projection.edges.find((edge) => edge.id === selected);
  const bindings =
    design.architecture?.bindings?.filter(
      (binding) =>
        selectedEdge &&
        (binding.relationship.kind === "connection"
          ? binding.relationship.id === selectedEdge.connection
          : binding.relationship.id === selectedEdge.componentRelationship),
    ) ?? [];
  const graph = useMemo(() => {
    if (!current) return undefined;
    const nodes: (CardNode | ScopeNode | BoundsNode)[] = projection.nodes.map((item) => {
      const point = current.nodes[item.id];
      if (!point) throw new Error("Architecture object geometry is missing.");
      return {
        id: item.id,
        type: "architecture",
        dragHandle: ".architecture-drag-handle",
        ariaRole: "group",
        position: { x: point.x, y: point.y },
        width: point.width,
        height: point.height,
        data: {
          item,
          onSelect,
          onOpen,
          showResponsibilities: projection.level === "containers",
          showTechnology: projection.level !== "context",
          connected:
            !selected ||
            item.id === selected ||
            projection.edges.some(
              (edge) =>
                (edge.id === selected && [edge.from, edge.to].includes(item.id)) ||
                ([edge.from, edge.to].includes(selected) && [edge.from, edge.to].includes(item.id)),
            ),
        },
        selected: item.id === selected,
        zIndex: 1,
        style: { width: point.width, height: point.height },
      };
    });
    for (const group of projection.groups ?? []) {
      const point = current.groups?.[group.id];
      if (point)
        nodes.unshift({
          id: group.id,
          type: "scope",
          position: { x: point.x, y: point.y },
          width: point.width,
          height: point.height,
          data: { label: group.name },
          style: { width: point.width, height: point.height },
          zIndex: -1,
          selectable: false,
          draggable: false,
          focusable: false,
        });
    }
    if (current.scope)
      nodes.unshift({
        id: SCOPE_ID,
        type: "scope",
        position: { x: current.scope.x, y: current.scope.y },
        width: current.scope.width,
        height: current.scope.height,
        data: {
          label:
            projection.level === "containers"
              ? (design.architecture?.system.name ?? projection.name)
              : projection.name,
        },
        style: { width: current.scope.width, height: current.scope.height },
        zIndex: 0,
        selectable: false,
        draggable: false,
        focusable: false,
      });
    // React Flow's Fit View uses node bounds. A presentation-only extent also covers
    // edge labels and routed bends, without adding an object to the semantic model.
    const bounds = architectureBounds(current);
    nodes.unshift({
      id: "architecture:bounds",
      type: "bounds",
      position: { x: bounds.x, y: bounds.y },
      width: bounds.width,
      height: bounds.height,
      data: {},
      style: { width: bounds.width, height: bounds.height, pointerEvents: "none", opacity: 0 },
      ariaRole: "presentation",
      selectable: false,
      focusable: false,
      zIndex: -1,
    });
    // When every relationship in the view is planned, the per-edge badge says nothing new; the
    // view subtitle and the node chips still carry the planned status.
    const modeled = projection.edges.filter((edge) => !edge.context);
    const allPlanned = modeled.length > 0 && modeled.every((edge) => edge.planned);
    const edges: RelationEdge[] = projection.edges.map((edge) => {
      const geometry = current.edges[edge.id];
      if (!geometry) throw new Error("Architecture relationship geometry is missing.");
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: "relation",
        data: {
          description: edge.description,
          presentation: allPlanned ? { ...edge, planned: false } : edge,
          geometry,
          onSelect,
        },
        className:
          selected && edge.id !== selected && edge.from !== selected && edge.to !== selected
            ? "architecture-edge-muted"
            : undefined,
        style: {
          stroke: "var(--line)",
          strokeWidth: 2,
          ...(projection.level === "context"
            ? edge.context || edge.declared
              ? { strokeDasharray: "5 4" }
              : {}
            : relationshipLineStyle(edge.interaction)),
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--line)" },
      };
    });
    return { nodes, edges };
  }, [projection, selected, onSelect, onOpen, current, design.architecture?.system.name]);
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
            key={`${scope}:${down}:${reset}`}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.1}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            onNodeDrag={(_, node) => setDragging({ [node.id]: node.position })}
            onNodeDragStop={(_, node) => {
              update({ positions: { ...saved?.positions, [node.id]: node.position } }, true);
              setDragging({});
            }}
            onViewportChange={(viewport) => {
              const previous = useDraw.getState().loaded?.layout.architecture?.[scope]?.viewport;
              if (JSON.stringify(previous) !== JSON.stringify(viewport)) update({ viewport, down });
            }}
            onEdgeClick={(_, edge) => onSelect(edge.id)}
            onPaneClick={() => onSelect("")}
          >
            <InitialCamera key={key} restored={saved?.viewport} onReady={cameraReady} />
            <FocusSelection
              request={focusRequest}
              selected={selected}
              projection={projection}
              ready={cameraReadyKey === key}
            />

            {selectedEdge ? (
              <Panel position="top-left" className="architecture-selection-summary">
                <strong>{selectedEdge.description}</strong>
                <span>{selectedEdge.protocol}</span>
                {bindings.length ? (
                  bindings.map((binding) => {
                    const contract = design.architecture?.contracts?.find(
                      (contract) => contract.id === binding.contract.id,
                    );
                    return (
                      <span key={binding.id}>
                        {contract?.name ?? binding.contract.id} · {binding.contract.version}
                      </span>
                    );
                  })
                ) : (
                  <span>No interface contracts bound</span>
                )}
              </Panel>
            ) : null}
            <Background color="var(--grid-dot)" gap={24} size={1} />
            <Controls showInteractive={false} />
            <DiagramOptions
              selected={selected}
              projection={projection}
              down={down}
              onDirection={() => update({ down: !down, positions: {}, viewport: undefined }, true)}
              onNudge={(x, y) => {
                const point = selected && current?.nodes[selected];
                if (point && selected)
                  update(
                    {
                      positions: {
                        ...saved?.positions,
                        [selected]: { x: point.x + x, y: point.y + y },
                      },
                    },
                    true,
                  );
              }}
              onReset={() => {
                update({ positions: {}, viewport: undefined }, true);
                setReset((value) => value + 1);
              }}
            />
          </ReactFlow>
        </ReactFlowProvider>
      )}
    </section>
  );
}

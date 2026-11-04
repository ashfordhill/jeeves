import {
  type StudioScopeProjection,
  type StudioViewNode,
  studioComponentDefinitions,
  studioDefinitions,
} from "@jeeves/spec";
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
  ViewportPortal,
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
import { arrangeStudio, studioFit, studioFrames, studioLanding } from "./layout.ts";
import {
  movedStudioGeometry,
  type StudioGeometry,
  type StudioPath,
  type StudioRoute,
  studioIncidentPaths,
  studioPaths,
} from "./routing.ts";
import { routeStudio } from "./routing-client.ts";
import { useStudioRouting } from "./use-routing.ts";
import { useStudioSettle } from "./use-settle.ts";

type Card = Node<{ item: StudioViewNode }, "studio" | "frame">;
/** An open labelled group: a package at C2, an application with its components at C3. */
function StudioFrame({ data, selected }: NodeProps<Card>) {
  const item = data.item;
  const kind =
    item.kind === "package"
      ? "Package"
      : item.kind in studioDefinitions
        ? studioDefinitions[item.kind as keyof typeof studioDefinitions].creationName
        : "Application";
  return (
    <div
      className="studio-frame"
      data-selected={selected}
      data-kind={item.kind}
      data-family={item.visual.color}
      title={[item.name, item.description].filter(Boolean).join("\n")}
    >
      <Handle type="target" position={Position.Left} />
      <span className="studio-frame-header">
        <span className="studio-role-icon">
          <StudioRoleIcon node={item} />
        </span>
        <strong>{item.name}</strong>
        <span className="studio-frame-kind">{kind}</span>
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function StudioCard({ data, selected }: NodeProps<Card>) {
  const { zoom } = useViewport();
  const design = useDraw((state) => state.loaded?.design);
  const item = data.item;
  const details = design ? studioCardDetails(item, design) : {};
  if (item.componentKind) details.technology = studioComponentDefinitions[item.componentKind].name;
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
const nodeTypes = { studio: StudioCard, frame: StudioFrame };

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

/** Captured transient movement, grid preview and one acknowledged scope-layout history step. */
export function StudioGraph({
  scope,
  selection,
  member,
  selectedIds,
  multiple,
  placing,
  connecting,
  hand,
  camera,
  onCamera,
  onSelect,
  onPlace,
  onCenter,
}: {
  scope: StudioScopeProjection;
  selection?: string;
  member?: { kind: "connection" | "context"; id: string };
  selectedIds?: string[];
  multiple?: boolean;
  placing: boolean;
  connecting?: string;
  hand: boolean;
  camera?: Viewport;
  onCamera: (camera: Viewport) => void;
  onSelect: (id?: string) => void;
  onPlace: (point: Point) => void;
  onCenter: (point: Point) => void;
}) {
  const container = useRef<HTMLElement>(null);
  const saved = useDraw((state) => state.loaded?.layout.architecture?.[scope.key]);
  const projectId = useDraw((state) => state.loaded?.project.id);
  const [pending, setPending] = useState<Record<string, Point>>();
  const [busy, setBusy] = useState(false);
  const action = useRef(0);
  const tidyController = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      action.current++;
      tidyController.current?.abort();
    },
    [],
  );
  const [flow, setFlow] = useState<ReactFlowInstance<Card, Relation>>();
  const viewport = saved?.viewport;
  const appliedCamera = useRef(JSON.stringify(viewport));
  useEffect(() => {
    const next = JSON.stringify(viewport);
    if (!flow || appliedCamera.current === next) return;
    appliedCamera.current = next;
    if (viewport) void flow.setViewport(viewport);
  }, [flow, viewport]);
  const arranged = useMemo(() => arrangeStudio(scope), [scope]);
  const parents = useMemo(() => studioFrames(scope), [scope]);
  const frames = useMemo(() => new Set(Object.values(parents)), [parents]);
  // Framed scopes are arranged automatically (SG05; SG06 replaces this with ELK). Saved positions
  // from older collapsed-package or per-service layouts are ignored there, never rewritten.
  const automatic = frames.size > 0;
  const boxes = useMemo(
    () =>
      Object.fromEntries(
        scope.nodes.map((item, index) => {
          const box = arranged[item.id];
          return [
            item.id,
            {
              ...((automatic ? undefined : saved?.positions[item.id]) ??
                box ??
                initialPosition(index)),
              ...(frames.has(item.id) && box
                ? { width: box.width, height: box.height }
                : studioCardSize(item)),
            },
          ];
        }),
      ),
    [scope.nodes, saved?.positions, arranged, automatic, frames],
  );
  const settledBoxes = useMemo(
    () =>
      pending
        ? Object.fromEntries(
            Object.entries(boxes).map(([id, box]) => [id, { ...box, ...pending[id] }]),
          )
        : boxes,
    [boxes, pending],
  );
  const paths = useMemo(() => studioPaths(scope), [scope]);
  const pathMap = useMemo(() => new Map(paths.map((path) => [path.id, path])), [paths]);
  const incident = useMemo(() => studioIncidentPaths(paths), [paths]);
  const [dragging, setDragging] = useState<Record<string, Point>>();
  const preview = useMemo(
    () => (dragging ? studioLanding(boxes, dragging) : undefined),
    [boxes, dragging],
  );
  const [fixed, setFixed] = useState<{
    paths: StudioPath[];
    geometry: StudioGeometry;
    boxes: string;
  }>();
  const latestPaths = useRef(paths);
  latestPaths.current = paths;
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const snapshot = useRef<
    | { routes: StudioGeometry; nodes: typeof boxes; paths: StudioPath[]; generation: number }
    | undefined
  >(undefined);
  const routing = useStudioRouting(
    scope.key,
    paths,
    settledBoxes,
    !!dragging,
    fixed?.paths === paths && fixed.boxes === JSON.stringify(settledBoxes)
      ? fixed.geometry
      : undefined,
    parents,
  );
  const targetGeometry = useMemo(
    () =>
      dragging && snapshot.current
        ? movedStudioGeometry(
            snapshot.current.routes,
            pathMap,
            snapshot.current.nodes,
            dragging,
            incident,
          )
        : routing.geometry,
    [dragging, routing.geometry, pathMap, incident],
  );
  const targetNodes = useMemo(
    () =>
      dragging
        ? Object.fromEntries(
            Object.entries(boxes).map(([id, box]) => [id, { ...box, ...dragging[id] }]),
          )
        : settledBoxes,
    [boxes, dragging, settledBoxes],
  );
  const target = useMemo(
    () => ({ nodes: targetNodes, routes: targetGeometry }),
    [targetNodes, targetGeometry],
  );
  const frame = useStudioSettle(target, !!dragging);
  const geometry = frame.routes;
  useEffect(() => {
    // An accepted delete/edit or external layout supersedes the gesture, never the other way around.
    if (
      snapshot.current &&
      (snapshot.current.nodes !== boxes || snapshot.current.paths !== paths)
    ) {
      snapshot.current = undefined;
      setDragging(undefined);
    }
  }, [boxes, paths]);
  useEffect(() => {
    const cancel = (event: Event) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
      snapshot.current = undefined;
      setDragging(undefined);
    };
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, []);
  const nodes = useMemo(
    () =>
      scope.nodes.map((item, index): Card => {
        const size = {
          width: boxes[item.id]?.width ?? studioCardSize(item).width,
          height: boxes[item.id]?.height ?? studioCardSize(item).height,
        };
        return {
          id: item.id,
          type: frames.has(item.id) ? "frame" : "studio",
          position: frame.nodes[item.id] ?? initialPosition(index),
          data: { item },
          selected:
            (multiple ? selectedIds?.includes(item.id) : selection === item.id) ||
            connecting === item.id,
          ariaLabel: `Inspect ${item.name}`,
          // Frames sit beneath relationships; cards sit above them.
          zIndex: frames.has(item.id) ? 0 : 3,
          ...(automatic && { draggable: false }),
          ...size,
          measured: measured[item.id],
          style: size,
        };
      }),
    [
      scope,
      selection,
      selectedIds,
      multiple,
      frame.nodes,
      connecting,
      measured,
      boxes,
      frames,
      automatic,
    ],
  );
  const tidy = async () => {
    if (!flow || !container.current || busy || dragging || !projectId || !routing.ready) return;
    snapshot.current = undefined;
    routing.invalidate();
    const generation = ++action.current;
    const abort = new AbortController();
    tidyController.current = abort;
    setBusy(true);
    try {
      if (
        !(await useDraw.getState().flushEdits()) ||
        useDraw.getState().loaded?.project.id !== projectId
      )
        return;
      const routes = await routeStudio(
        { ...routing.input, nodes: arranged, fixed: undefined },
        abort.signal,
      );
      if (action.current !== generation || abort.signal.aborted || latestPaths.current !== paths)
        return;
      const bounds = container.current.getBoundingClientRect();
      const viewport = studioFit(arranged, routes, bounds.width, bounds.height);
      // Empty overrides mean deterministic automatic placement. Other scope records stay intact.
      const current = useDraw.getState().loaded?.layout.architecture?.[scope.key];
      if (
        await useDraw
          .getState()
          .setArchitectureView(
            scope.key,
            { ...current, positions: {}, viewport },
            true,
            flow.getViewport(),
          )
      ) {
        setFixed(undefined);
        onCamera(viewport);
      }
    } catch {
      if (!abort.signal.aborted)
        useDraw.getState().setNotice({
          tone: "error",
          message: "Tidy could not finish. Existing layout is retained; try again.",
        });
    } finally {
      if (action.current === generation) setBusy(false);
    }
  };
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
          zIndex: path.branchIds ? 1 : 2,
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
      data-automatic={automatic || undefined}
      data-scope={scope.key}
      data-dragging={!!dragging}
      onPointerDownCapture={(event) => {
        if (automatic || busy || hand || placing || connecting !== undefined || event.button !== 0)
          return;
        const target = event.target as HTMLElement;
        if (
          !target.closest(".react-flow__node") ||
          target.closest("button, input, select, textarea")
        )
          return;
        snapshot.current = {
          routes: routing.geometry,
          nodes: boxes,
          paths,
          generation: routing.generation,
        };
      }}
    >
      <ReactFlow
        onInit={(instance) => {
          setFlow(instance);
          // Framed scopes fit their deterministic arrangement explicitly, frames included.
          const bounds = container.current?.getBoundingClientRect();
          if (automatic && !camera && !viewport && bounds)
            void instance.setViewport(studioFit(boxes, {}, bounds.width, bounds.height));
        }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!busy && !hand && !placing && connecting === undefined}
        nodeDragThreshold={5}
        autoPanOnNodeDrag={false}
        selectNodesOnDrag={false}
        nodesConnectable={false}
        elementsSelectable={!hand}
        elevateEdgesOnSelect={false}
        // A selected frame must stay beneath its components and relationships.
        elevateNodesOnSelect={!automatic}
        panOnDrag={hand ? true : [1, 2]}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={viewport ?? camera}
        fitView={!automatic && !camera && !viewport}
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        onNodesChange={(changes) => {
          const dimensions = changes.filter(
            (change) => change.type === "dimensions" && change.dimensions,
          );
          if (dimensions.length)
            setMeasured((previous) => {
              const next = { ...previous };
              for (const change of dimensions)
                if (change.type === "dimensions" && change.dimensions)
                  next[change.id] = change.dimensions;
              return next;
            });
        }}
        onNodeDragStart={(_, _node, moving) => {
          routing.invalidate();
          snapshot.current ??= {
            routes: routing.geometry,
            nodes: boxes,
            paths,
            generation: routing.generation,
          };
          setDragging(Object.fromEntries(moving.map((node) => [node.id, node.position])));
        }}
        onNodeDrag={(_, _node, moving) => {
          if (snapshot.current)
            setDragging(Object.fromEntries(moving.map((node) => [node.id, node.position])));
        }}
        onNodeDragStop={() => {
          const captured = snapshot.current;
          if (!captured || !preview || !flow || !dragging) return;
          const changed = Object.keys(preview).filter(
            (id) => preview[id]?.x !== boxes[id]?.x || preview[id]?.y !== boxes[id]?.y,
          );
          snapshot.current = undefined;
          setDragging(undefined);
          if (!changed.length) return;
          const positions = Object.fromEntries(
            Object.entries(boxes).map(([id, box]) => [id, preview[id] ?? { x: box.x, y: box.y }]),
          );
          // Settle a shared bus and its branches together; every unrelated route stays captured.
          const affected = new Set(changed.flatMap((id) => incident.get(id) ?? []));
          for (const path of paths)
            if (affected.has(path.id) || (path.trunk && affected.has(path.trunk))) {
              if (path.trunk) affected.add(path.trunk);
              path.branchIds?.forEach((id) => {
                affected.add(id);
              });
            }
          for (const path of paths)
            if (path.trunk && affected.has(path.trunk)) affected.add(path.id);
          setFixed({
            paths,
            boxes: JSON.stringify(
              Object.fromEntries(
                Object.entries(boxes).map(([id, box]) => [id, { ...box, ...positions[id] }]),
              ),
            ),
            geometry: Object.fromEntries(
              Object.entries(captured.routes).filter(([id]) => !affected.has(id)),
            ),
          });
          setPending(positions);
          setBusy(true);
          const beforeCamera = flow.getViewport();
          void useDraw
            .getState()
            .setArchitectureView(
              scope.key,
              { ...saved, positions, viewport: beforeCamera },
              true,
              beforeCamera,
            )
            .finally(() => {
              setPending(undefined);
              setBusy(false);
            });
        }}
        onMoveEnd={(event, next) => {
          onCamera(next);
          if (event && !busy && !dragging) {
            const view = useDraw.getState().loaded?.layout.architecture?.[scope.key];
            void useDraw.getState().setArchitectureView(scope.key, {
              ...view,
              positions: view?.positions ?? {},
              viewport: next,
            });
          }
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
        {preview ? (
          <ViewportPortal>
            {Object.entries(preview).map(([id, point]) => (
              <div
                key={id}
                className="studio-landing"
                data-landing={id}
                style={{
                  transform: `translate(${point.x}px, ${point.y}px)`,
                  width: boxes[id]?.width,
                  height: boxes[id]?.height,
                }}
              />
            ))}
          </ViewportPortal>
        ) : null}
      </ReactFlow>
      <button
        className="studio-tidy"
        type="button"
        disabled={busy || !!dragging || !routing.ready || !scope.nodes.length}
        onClick={() => void tidy()}
      >
        Tidy and fit
      </button>
      {routing.error ? (
        <div className="studio-routing-error" role="alert">
          {routing.error}{" "}
          <button type="button" onClick={routing.retry}>
            Retry routing
          </button>
        </div>
      ) : null}
    </section>
  );
}

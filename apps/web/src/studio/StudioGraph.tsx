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
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  useViewport,
  type Viewport,
} from "@xyflow/react";
import {
  createContext,
  type PointerEvent as ReactPointerEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDraw } from "../draw/store.ts";
import {
  StudioProviderMark,
  StudioRoleIcon,
  studioCardDetails,
  studioCardSize,
} from "./card-appearance.tsx";
import type { Point } from "./creation.ts";
import { type StudioLayoutNode, studioCameraShows, studioFit } from "./layout.ts";
import {
  movedStudioGeometry,
  type StudioPath,
  type StudioRoute,
  studioDetailLabel,
  studioIncidentPaths,
  studioMergedCount,
  studioPaths,
} from "./routing.ts";
import type { SpawnSide } from "./spawn.ts";
import { useStudioLayout } from "./use-layout.ts";
import { useStudioSettle } from "./use-settle.ts";

type Card = Node<{ item: StudioViewNode }, "studio" | "frame">;
/** automation-illustrator's pull threshold: a shorter press is a click that opens the picker. */
export const SPAWN_THRESHOLD = 36;
export type StudioHandleRelease = {
  source: string;
  side: SpawnSide;
  /** Where to open the picker, relative to the graph. */
  at: Point;
  /** Set when the handle was dropped on another box. */
  target?: string;
};
const SpawnContext = createContext<
  | {
      enabled: (id: string) => boolean;
      begin: (event: ReactPointerEvent, id: string, side: SpawnSide) => void;
    }
  | undefined
>(undefined);
/** `+` handles: east creates or connects a target, west a source. Shown on hover or selection. */
function SpawnHandles({ item }: { item: StudioViewNode }) {
  const spawn = useContext(SpawnContext);
  const { zoom } = useViewport();
  if (!spawn?.enabled(item.id)) return null;
  // Keep the handle at least about 22px on screen when zoomed out.
  const scale = Math.max(1, 0.85 / zoom);
  return (
    <>
      {(["in", "out"] as const).map((side) => (
        <button
          type="button"
          key={side}
          className="studio-spawn nodrag nopan"
          data-side={side}
          style={{
            transform: `translate(${side === "in" ? "-50%" : "50%"}, -50%) scale(${scale})`,
          }}
          aria-label={
            side === "out"
              ? `Add or connect a box after ${item.name}`
              : `Add or connect a box before ${item.name}`
          }
          title="Drag out to add a connected box, or drop on a box to connect"
          onPointerDown={(event) => spawn.begin(event, item.id, side)}
          onClick={(event) => event.stopPropagation()}
        >
          +
        </button>
      ))}
    </>
  );
}
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
      <SpawnHandles item={item} />
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
      <SpawnHandles item={item} />
    </div>
  );
}
const nodeTypes = { studio: StudioCard, frame: StudioFrame };

type Relation = Edge<{ path: StudioPath; route: StudioRoute }, "studio">;
/** Labels are drawn from this zoom up; below it the diagram shows lines and boxes only. */
export const STUDIO_LABEL_ZOOM = 0.45;
/** Screen-space arrowhead: lines use a non-scaling stroke, so the head keeps its size too. */
function StudioArrow({ points, zoom, color }: { points: Point[]; zoom: number; color?: string }) {
  const tip = points.at(-1),
    before = points.at(-2);
  if (!tip || !before) return null;
  const angle = (Math.atan2(tip.y - before.y, tip.x - before.x) * 180) / Math.PI;
  // 11px on screen, but never longer than the final straight run (short in-frame stubs).
  const run = Math.hypot(tip.x - before.x, tip.y - before.y);
  const scale = Math.min(1 / zoom, run / 12);
  return (
    <path
      className="studio-arrow"
      d="M0,0 L-11,-5 L-11,5 Z"
      transform={`translate(${tip.x},${tip.y}) rotate(${angle}) scale(${scale})`}
      style={{ fill: color }}
    />
  );
}
function StudioRelation({ data, ...props }: EdgeProps<Relation>) {
  const { zoom } = useViewport();
  if (!data) return null;
  const { route, path } = data;
  const box = route.label;
  const label = zoom >= 1.1 ? box?.detail : box?.short;
  const merged = path.item.members.length > 1;
  const stroke = props.style?.stroke;
  return (
    <g
      data-path-kind="relationship"
      data-merged={merged ? path.item.members.length : undefined}
      data-members={path.item.members.map((m) => m.id).join("|")}
      data-connections={path.item.connectionIds.join("|")}
      data-original-edges={path.edgeIds.join("|")}
    >
      <title>{studioDetailLabel(path.item)}</title>
      <path d={route.path} className="studio-crossing-gap" />
      <BaseEdge id={props.id} path={route.path} style={props.style} interactionWidth={14} />
      <StudioArrow points={route.points} zoom={zoom} color={stroke} />
      {zoom >= STUDIO_LABEL_ZOOM && label && box && !label.includes("\n") ? (
        // A one-line label sits on its line; the plate keeps the line out of the word gaps.
        <rect
          className="studio-relation-plate"
          x={box.x}
          y={box.y + 1}
          width={box.width}
          height={box.height - 2}
          rx={3}
        />
      ) : null}
      {zoom >= STUDIO_LABEL_ZOOM && label && box ? (
        <text
          x={box.x + box.width / 2}
          y={box.y + 13}
          textAnchor="middle"
          className="studio-relation-text"
          data-merged={merged || undefined}
        >
          {label.split("\n").map((line, index) => (
            <tspan
              key={index ? "protocol" : "verb"}
              x={box.x + box.width / 2}
              dy={index ? 15 : 0}
              data-line={index ? "protocol" : undefined}
            >
              {line}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );
}
const edgeTypes = { studio: StudioRelation };

/**
 * Automatic ELK layout (SG06). Positions are derived; dragging a box up or down inside its column
 * changes only its row, saved as one undoable row-order hint. Nothing else writes layout.
 */
export function StudioGraph({
  scope,
  selection,
  member,
  selectedIds,
  multiple,
  connecting,
  hand,
  camera,
  spawnable,
  onCamera,
  onSelect,
  onHandle,
}: {
  scope: StudioScopeProjection;
  selection?: string;
  member?: { kind: "connection" | "context"; id: string };
  selectedIds?: string[];
  multiple?: boolean;
  connecting?: string;
  hand: boolean;
  camera?: Viewport;
  /** Boxes that carry `+` handles in the current mode. */
  spawnable?: (id: string) => boolean;
  onCamera: (camera: Viewport) => void;
  onSelect: (id?: string) => void;
  onHandle: (release: StudioHandleRelease) => void;
}) {
  const container = useRef<HTMLElement>(null);
  const saved = useDraw((state) => state.loaded?.layout.architecture?.[scope.key]);
  const [flow, setFlow] = useState<ReactFlowInstance<Card, Relation>>();
  const ids = useMemo(() => new Set(scope.nodes.map((node) => node.id)), [scope.nodes]);
  const frames = useMemo(
    () =>
      new Set(
        scope.nodes.flatMap((node) =>
          node.frame || scope.nodes.some((child) => child.parent === node.id) ? [node.id] : [],
        ),
      ),
    [scope.nodes],
  );
  const layoutNodes = useMemo(
    () =>
      [...scope.nodes]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(
          (node): StudioLayoutNode => ({
            id: node.id,
            ...studioCardSize(node),
            ...(node.parent && ids.has(node.parent) && { parent: node.parent }),
            ...(frames.has(node.id) && { frame: true as const }),
          }),
        ),
    [scope.nodes, ids, frames],
  );
  const order = useMemo(() => saved?.order ?? [], [saved?.order]);
  const paths = useMemo(() => studioPaths(scope), [scope]);
  const pathMap = useMemo(() => new Map(paths.map((path) => [path.id, path])), [paths]);
  const incident = useMemo(() => studioIncidentPaths(paths), [paths]);
  const studio = useStudioLayout(scope.key, layoutNodes, paths, order);
  const layout = studio.layout;
  const boxes = useMemo(() => layout?.nodes ?? {}, [layout]);
  // A vertical drag inside the column; released positions are held until the new layout lands.
  const [dragging, setDragging] = useState<{ id: string; positions: Record<string, Point> }>();
  const [held, setHeld] = useState<{ layout: unknown; positions: Record<string, Point> }>();
  // Layouts are cached by input, so an undo can bring the pre-drop object back: drop the hold
  // as soon as any other layout is shown.
  useEffect(() => {
    if (held && held.layout !== layout) setHeld(undefined);
  }, [held, layout]);
  const shownHeld = held && held.layout === layout ? held.positions : undefined;
  const moving = dragging?.positions ?? shownHeld;
  const targetGeometry = useMemo(
    () =>
      moving && layout
        ? movedStudioGeometry(layout.routes, pathMap, boxes, moving, incident)
        : (layout?.routes ?? {}),
    [moving, layout, boxes, pathMap, incident],
  );
  const targetNodes = useMemo(
    () =>
      moving
        ? Object.fromEntries(
            Object.entries(boxes).map(([id, box]) => [id, { ...box, ...moving[id] }]),
          )
        : boxes,
    [boxes, moving],
  );
  const target = useMemo(
    () => ({ nodes: targetNodes, routes: targetGeometry }),
    [targetNodes, targetGeometry],
  );
  const frame = useStudioSettle(target, !!moving);
  const geometry = frame.routes;
  useEffect(() => {
    const cancel = (event: Event) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
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
  // SG08 handle pull: below the threshold a release is a click; past it a preview follows the
  // pointer and the release either connects to the box beneath or opens the kind picker.
  const [pull, setPull] = useState<{
    source: string;
    side: SpawnSide;
    start: Point;
    at: Point;
    active: boolean;
    target?: string;
  }>();
  const pullRef = useRef(pull);
  pullRef.current = pull;
  const local = (x: number, y: number): Point => {
    const bounds = container.current?.getBoundingClientRect();
    return { x: x - (bounds?.left ?? 0), y: y - (bounds?.top ?? 0) };
  };
  const boxAt = (x: number, y: number, source: string) => {
    const hit = document
      .elementFromPoint(x, y)
      ?.closest(".react-flow__node")
      ?.getAttribute("data-id");
    return hit && hit !== source && ids.has(hit) ? hit : undefined;
  };
  const live = useRef({ local, boxAt, onHandle });
  live.current = { local, boxAt, onHandle };
  const pulling = !!pull;
  useEffect(() => {
    if (!pulling) return;
    const { local, boxAt, onHandle } = {
      local: (x: number, y: number) => live.current.local(x, y),
      boxAt: (x: number, y: number, source: string) => live.current.boxAt(x, y, source),
      onHandle: (release: StudioHandleRelease) => live.current.onHandle(release),
    };
    const move = (event: PointerEvent) => {
      const current = pullRef.current;
      if (!current) return;
      const at = local(event.clientX, event.clientY);
      const active =
        current.active ||
        Math.hypot(at.x - current.start.x, at.y - current.start.y) > SPAWN_THRESHOLD;
      setPull({
        ...current,
        at,
        active,
        target: active ? boxAt(event.clientX, event.clientY, current.source) : undefined,
      });
    };
    const up = (event: PointerEvent) => {
      const current = pullRef.current;
      setPull(undefined);
      if (!current) return;
      const at = local(event.clientX, event.clientY);
      if (!current.active) {
        // A click opens the picker beside the handle.
        onHandle({ source: current.source, side: current.side, at: current.start });
        return;
      }
      const target = boxAt(event.clientX, event.clientY, current.source);
      onHandle({ source: current.source, side: current.side, at, ...(target && { target }) });
    };
    const cancel = (event: Event) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
      setPull(undefined);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [pulling]);
  const spawn = {
    enabled: (id: string) =>
      !hand && !dragging && connecting === undefined && !multiple && !!spawnable?.(id),
    begin: (event: ReactPointerEvent, id: string, side: SpawnSide) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      const start = local(event.clientX, event.clientY);
      setPull({ source: id, side, start, at: start, active: false });
    },
  };
  const pullTarget = pull?.target
    ? container.current
        ?.querySelector(`.react-flow__node[data-id="${CSS.escape(pull.target)}"]`)
        ?.getBoundingClientRect()
    : undefined;
  const graphBounds = container.current?.getBoundingClientRect();
  // Camera: a remembered local camera that still shows the diagram, otherwise fit. Never saved
  // to the project layout.
  const [fitted, setFitted] = useState(false);
  // Controlled nodes keep React Flow's measurements, or edges hide when the node list changes.
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const fit = () => {
    const bounds = container.current?.getBoundingClientRect();
    if (!flow || !bounds || !layout) return;
    const next = studioFit(layout.nodes, layout.routes, bounds.width, bounds.height);
    void flow.setViewport(next);
    onCamera(next);
  };
  useEffect(() => {
    if (fitted || !flow || !layout) return;
    const bounds = container.current?.getBoundingClientRect();
    if (!bounds) return;
    setFitted(true);
    if (camera && studioCameraShows(camera, layout.nodes, bounds.width, bounds.height))
      void flow.setViewport(camera);
    else void flow.setViewport(studioFit(layout.nodes, layout.routes, bounds.width, bounds.height));
  }, [fitted, flow, layout, camera]);
  const nodes = useMemo(
    () =>
      scope.nodes.flatMap((item): Card[] => {
        const box = frame.nodes[item.id];
        if (!box) return [];
        const size = { width: box.width, height: box.height };
        return [
          {
            id: item.id,
            type: frames.has(item.id) ? "frame" : "studio",
            position: { x: box.x, y: box.y },
            data: { item },
            selected:
              (multiple ? selectedIds?.includes(item.id) : selection === item.id) ||
              connecting === item.id,
            ariaLabel: `Inspect ${item.name}`,
            // Frames sit beneath relationships; cards sit above them.
            zIndex: frames.has(item.id) ? 0 : dragging?.positions[item.id] ? 4 : 3,
            ...size,
            measured: measured[item.id],
            style: size,
          },
        ];
      }),
    [scope, selection, selectedIds, multiple, frame.nodes, connecting, frames, dragging, measured],
  );
  const edges = useMemo(
    () =>
      paths.flatMap((path): Relation[] => {
        const route = geometry[path.id];
        if (!route) return [];
        const selected = member
          ? (member.kind === "connection"
              ? path.item.connectionIds
              : path.item.contextRelationshipIds
            ).includes(member.id)
          : selection === path.id || path.edgeIds.includes(selection ?? "");
        return [
          {
            id: path.id,
            type: "studio",
            source: path.item.from,
            target: path.item.to,
            data: { path, route },
            selected,
            zIndex: 2,
            style: {
              stroke: selected ? "var(--blue)" : "var(--ink-soft)",
              strokeWidth: selected ? 3 : 2,
            },
            interactionWidth: 14,
            ariaLabel: `Inspect ${path.item.members.length > 1 ? `${studioMergedCount(path.item)}` : "relationship"}: ${path.item.actions.join(" / ")}${path.item.protocols.length ? `; ${path.item.protocols.join(" / ")}` : ""}`,
          },
        ];
      }),
    [paths, geometry, selection, member],
  );
  /** The node and, for a frame, everything drawn inside it, moved vertically by `dy`. */
  const carried = (id: string, dy: number): Record<string, Point> => {
    const result: Record<string, Point> = {};
    const add = (nodeId: string) => {
      const box = boxes[nodeId];
      if (box) result[nodeId] = { x: box.x, y: box.y + dy };
      for (const child of scope.nodes) if (child.parent === nodeId) add(child.id);
    };
    add(id);
    return result;
  };
  const drop = (id: string, y: number) => {
    const column = layout?.columns.find((list) => list.includes(id));
    const box = boxes[id];
    setDragging(undefined);
    if (!layout || !column || !box || column.length < 2) return;
    const siblings = column.filter((other) => other !== id);
    const centre = y + box.height / 2;
    const index = siblings.filter((other) => {
      const o = boxes[other] as { y: number; height: number };
      return o.y + o.height / 2 < centre;
    }).length;
    if (index === column.indexOf(id)) return;
    // The hint lists every box in its current row order, with this one moved.
    const rows = Object.keys(layout.nodes)
      .filter((other) => other !== id)
      .sort(
        (a, b) =>
          (layout.nodes[a]?.y ?? 0) - (layout.nodes[b]?.y ?? 0) ||
          (layout.nodes[a]?.x ?? 0) - (layout.nodes[b]?.x ?? 0) ||
          (a < b ? -1 : a > b ? 1 : 0),
      );
    const anchor = siblings[index];
    const at = anchor
      ? rows.indexOf(anchor)
      : rows.indexOf(siblings[siblings.length - 1] as string) + 1;
    rows.splice(at, 0, id);
    setHeld({ layout, positions: carried(id, y - box.y) });
    const view = useDraw.getState().loaded?.layout.architecture?.[scope.key];
    void useDraw
      .getState()
      .setArchitectureView(scope.key, { ...view, positions: {}, order: rows }, true)
      .then((ok) => {
        if (!ok) setHeld(undefined);
      });
  };
  return (
    <section
      className="studio-graph"
      ref={container}
      data-pulling={pull?.active || undefined}
      aria-label={`${scope.level === "context" ? "C1" : scope.level === "containers" ? "C2" : "C3"} ${scope.name}`}
      aria-busy={!layout || undefined}
      data-scope={scope.key}
      data-layout={studio.current ? "ready" : "pending"}
      data-dragging={!!dragging}
    >
      <SpawnContext.Provider value={spawn}>
        <ReactFlow
          onInit={setFlow}
          style={fitted ? undefined : { visibility: "hidden" }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={!hand && !pull && connecting === undefined && studio.current}
          nodeDragThreshold={5}
          autoPanOnNodeDrag={false}
          selectNodesOnDrag={false}
          nodesConnectable={false}
          elementsSelectable={!hand}
          elevateEdgesOnSelect={false}
          // A selected frame must stay beneath its components and relationships.
          elevateNodesOnSelect={false}
          panOnDrag={hand ? true : [1, 2]}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={2}
          {...(camera && { defaultViewport: camera })}
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
          onNodeDragStart={(_, node) => {
            const box = boxes[node.id];
            if (box) setDragging({ id: node.id, positions: carried(node.id, 0) });
          }}
          onNodeDrag={(_, node) => {
            const box = boxes[node.id];
            if (box && dragging?.id === node.id)
              setDragging({ id: node.id, positions: carried(node.id, node.position.y - box.y) });
          }}
          onNodeDragStop={(_, node) => {
            if (dragging?.id === node.id) drop(node.id, node.position.y);
          }}
          onMoveEnd={(_, next) => {
            if (fitted) onCamera(next);
          }}
          onNodeClick={(_, node) => {
            if (!hand) onSelect(node.id);
          }}
          onEdgeClick={(_, edge) => {
            if (!hand) onSelect(edge.id);
          }}
          onPaneClick={() => {
            if (!hand && connecting === undefined) onSelect();
          }}
        >
          <Background gap={32} color="var(--grid-dot)" />
        </ReactFlow>
      </SpawnContext.Provider>
      {pull?.active ? (
        <svg className="studio-pull" aria-hidden="true">
          <line x1={pull.start.x} y1={pull.start.y} x2={pull.at.x} y2={pull.at.y} />
          {pullTarget && graphBounds ? (
            <rect
              className="studio-pull-target"
              x={pullTarget.left - graphBounds.left - 4}
              y={pullTarget.top - graphBounds.top - 4}
              width={pullTarget.width + 8}
              height={pullTarget.height + 8}
              rx={14}
            />
          ) : (
            <rect
              className="studio-pull-ghost"
              x={pull.side === "out" ? pull.at.x : pull.at.x - 120}
              y={pull.at.y - 36}
              width={120}
              height={72}
              rx={10}
            />
          )}
        </svg>
      ) : null}
      {pull?.active ? (
        <div className="studio-placement-hint" role="status">
          {pull.target ? "Release to connect these boxes." : "Release to choose a new box."}
        </div>
      ) : null}
      <button className="studio-fit" type="button" disabled={!layout || !!dragging} onClick={fit}>
        Fit
      </button>
      {studio.error ? (
        <div className="studio-routing-error" role="alert">
          {studio.error}{" "}
          <button type="button" onClick={studio.retry}>
            Retry layout
          </button>
        </div>
      ) : null}
    </section>
  );
}

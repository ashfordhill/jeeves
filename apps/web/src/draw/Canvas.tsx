/**
 * The Draw board: React Flow wired to the design (through the operations API) and the layout
 * (saved separately). Adapted from automation-pitch's Board: same paper texture following the
 * camera, handle look, and grab cursors; the tool model is Excalidraw's.
 */
import {
  type DesignDocument,
  type LayoutItem,
  type OperationInput,
  plannedCapability,
} from "@jeeves/spec";
import { IconFocusCentered } from "@tabler/icons-react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  ControlButton,
  Controls,
  type EdgeChange,
  type NodeChange,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
  ReactFlow,
  useReactFlow,
  useStore,
  useViewport,
} from "@xyflow/react";
import { type DragEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { PaperTextureSvg } from "../theme/PaperTexture.tsx";
import { type CanvasEnd, type ConnectPlan, planConnect } from "./connect.ts";
import { ContextBoardCard, SystemBoundary, withContainerNotation } from "./container-notation.tsx";
import { ArrowEdge, ConnectionEdge, ContextEdge } from "./edges/BoardEdges.tsx";
import { FreeArrows } from "./edges/FreeArrows.tsx";
import {
  attachmentFromHandle,
  type BoardEdge,
  type BoardNode,
  buildEdges,
  buildNodes,
  FRAME_SIZE,
  NOTE_SIZE,
  templateKey,
} from "./flow.ts";
import { uniqueId, uniqueName } from "./ids.ts";
import { FrameNode, NoteNode, TextNode } from "./nodes/AnnotationNodes.tsx";
import { ElementNode } from "./nodes/ElementNode.tsx";
import { attach, deleteOps, placeAnnotation, placeElement } from "./ops.ts";
import { registry } from "./registry.ts";
import { type Tool, useDraw } from "./store.ts";
import { readDraggedTool, Toolbar } from "./Toolbar.tsx";

const nodeTypes = {
  context: ContextBoardCard,
  systemBoundary: SystemBoundary,
  element: ElementNode,
  text: TextNode,
  note: NoteNode,
  frame: FrameNode,
};
const edgeTypes = { connection: ConnectionEdge, arrow: ArrowEdge, context: ContextEdge };

/** Offset from the pointer to a new item's top-left, so it lands roughly centered. */
const PLACE_OFFSET: Record<string, { x: number; y: number }> = {
  element: { x: 130, y: 40 },
  service: { x: 130, y: 40 },
  planned: { x: 130, y: 40 },
  text: { x: 20, y: 14 },
  note: { x: NOTE_SIZE.width / 2, y: NOTE_SIZE.height / 2 },
  frame: { x: FRAME_SIZE.width / 2, y: 24 },
};

const SHORTCUTS: Record<string, Tool> = {
  v: { kind: "select" },
  h: { kind: "hand" },
  c: { kind: "connect" },
  t: { kind: "text" },
  n: { kind: "note" },
  f: { kind: "frame" },
};

function BoardTexture() {
  const { x, y, zoom } = useViewport();
  return (
    <PaperTextureSvg x={x} y={y} zoom={zoom} className="react-flow__container paper-texture" />
  );
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Which item a click on a node meant: the node itself, or an attachment mini-box inside it. */
function endFromClick(_design: DesignDocument, node: BoardNode, _event: MouseEvent): CanvasEnd {
  if (node.type !== "element") return { annotation: node.id };
  return { element: node.id };
}

function endFromHandle(design: DesignDocument, nodeId: string, handle: string | null): CanvasEnd {
  if (!design.elements.some((e) => e.id === nodeId)) return { annotation: nodeId };
  const attachment = attachmentFromHandle(handle);
  return attachment ? { element: nodeId, attachment } : { element: nodeId };
}

export function Canvas() {
  const loaded = useDraw((s) => s.loaded);
  const tool = useDraw((s) => s.tool);
  const pendingEnd = useDraw((s) => s.pendingEnd);
  const focusRequest = useDraw((s) => s.focusRequest);
  const {
    edit,
    setTool,
    setPendingEnd,
    setNotice,
    setLayoutItems,
    setViewport,
    setEditing,
    setSelection,
    undo,
    redo,
  } = useDraw.getState();
  const flow = useReactFlow<BoardNode, BoardEdge>();
  const boardWidth = useStore((s) => s.width);
  const previousWidth = useRef(boardWidth);

  // Opening the rail reduces the actual canvas width. Fit after React Flow measures it,
  // without changing the saved camera on initial load or moving any design items.
  useEffect(() => {
    if (previousWidth.current > boardWidth && boardWidth > 0 && flow.getNodes().length > 0)
      void flow.fitView({ maxZoom: 1, padding: 0.2, duration: 200 });
    previousWidth.current = boardWidth;
  }, [boardWidth, flow]);

  // Seeded synchronously so React Flow's initial fitView sees the nodes.
  const [nodes, setNodes] = useState<BoardNode[]>(() =>
    loaded
      ? withContainerNotation(
          loaded.design,
          buildNodes(loaded.design, loaded.layout, loaded.templates),
          loaded.project.name,
        ).map((node) => ({
          ...node,
          selected: useDraw.getState().selection.nodes.includes(node.id),
        }))
      : [],
  );
  const [edges, setEdges] = useState<BoardEdge[]>(() =>
    loaded
      ? buildEdges(loaded.design).map((edge) => ({
          ...edge,
          selected: useDraw.getState().selection.edges.includes(edge.id),
        }))
      : [],
  );
  // The saved camera, read once: DrawView remounts the canvas per project. Without one, fit the
  // board on open, but never on an empty board: React Flow would refit when the first item lands.
  const [defaultViewport] = useState(() => loaded?.layout.viewport);
  const [fitOnOpen] = useState(() => !defaultViewport && nodes.length > 0);

  const design = loaded?.design;
  const layout = loaded?.layout;
  const templates = loaded?.templates;
  useEffect(() => {
    if (!design || !layout || !templates) return;
    setNodes((prev) =>
      withContainerNotation(
        design,
        [
          ...buildNodes(design, layout, templates, prev),
          ...prev.filter((node) => node.type === "context"),
        ],
        loaded.project.name,
      ),
    );
  }, [design, layout, templates, loaded?.project.name]);
  useEffect(() => {
    if (!design) return;
    setEdges((prev) => buildEdges(design, prev));
  }, [design]);

  // Select (and optionally zoom to) what the findings panel or inspector asked for.
  useEffect(() => {
    if (!focusRequest) return;
    const nodeIds = new Set(focusRequest.nodes);
    const edgeIds = new Set(focusRequest.edges);
    setNodes((nds) => nds.map((n) => ({ ...n, selected: nodeIds.has(n.id) })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: edgeIds.has(e.id) })));
    if (focusRequest.zoom) {
      const ends = flow
        .getEdges()
        .filter((e) => edgeIds.has(e.id))
        .flatMap((e) => [e.source, e.target]);
      const ids = [...new Set([...focusRequest.nodes, ...ends])];
      if (ids.length > 0)
        void flow.fitView({
          nodes: ids.map((id) => ({ id })),
          duration: 250,
          maxZoom: 1,
          padding: 0.4,
        });
    }
  }, [focusRequest, flow]);

  const onSelectionChange = useCallback(
    ({ nodes: picked, edges: pickedEdges }: OnSelectionChangeParams<BoardNode, BoardEdge>) =>
      setSelection({ nodes: picked.map((n) => n.id), edges: pickedEdges.map((e) => e.id) }),
    [setSelection],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<BoardNode>[]) =>
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        return design ? withContainerNotation(design, updated, loaded!.project.name) : updated;
      }),
    [design, loaded?.project.name],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<BoardEdge>[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const runPlan = useCallback(
    async (plan: ConnectPlan) => {
      setPendingEnd(undefined);
      if (plan.ok === true) {
        if (await edit(plan.ops)) setNotice(undefined);
      } else if (plan.ok === "choose") {
        setNotice({ tone: "info", message: "Which kind of connection?", actions: plan.choices });
      } else {
        setNotice({ tone: "error", message: plan.reason, actions: plan.fixes });
      }
    },
    [edit, setNotice, setPendingEnd],
  );

  /** Places a new item at a flow position, saving its layout first so it appears in place. */
  const placeAt = useCallback(
    async (placing: Tool, at: { x: number; y: number }) => {
      if (!design || !templates) return;
      let placed: { id: string; ops: OperationInput[] } | undefined;
      if (placing.kind === "planned") {
        const capability = plannedCapability(placing.capability);
        if (!capability || capability.scope !== "container") return;
        const id = uniqueId(design, capability.id);
        placed = {
          id,
          ops: [
            {
              op: "addElement",
              element: {
                id,
                name: uniqueName(design, capability.name),
                template: null,
                planned: capability.id,
              },
            },
          ],
        };
      } else if (placing.kind === "service") {
        const id = uniqueId(design, "service");
        placed = {
          id,
          ops: [
            {
              op: "addElement",
              element: { id, name: uniqueName(design, "Service"), template: null },
            },
          ],
        };
      } else if (placing.kind === "element") {
        const template = templates.get(templateKey(placing.template));
        if (template) placed = placeElement(design, template);
      } else if (placing.kind === "text" || placing.kind === "note" || placing.kind === "frame") {
        placed = placeAnnotation(design, placing.kind);
      }
      if (!placed) return;
      const offset = PLACE_OFFSET[placing.kind] ?? { x: 0, y: 0 };
      setLayoutItems({
        [placed.id]: { x: Math.round(at.x - offset.x), y: Math.round(at.y - offset.y) },
      });
      setTool({ kind: "select" });
      const ok = await edit(placed.ops);
      if (ok) {
        setNotice(undefined);
        useDraw.getState().focus({ nodes: [placed.id], edges: [] });
        if (placing.kind === "text" || placing.kind === "note") setEditing(placed.id);
      }
    },
    [design, templates, edit, setEditing, setLayoutItems, setNotice, setTool],
  );

  const attachTo = useCallback(
    async (elementId: string, template: { id: string; version: string }) => {
      if (!design) return;
      setTool({ kind: "select" });
      const plan = attach(design, registry, elementId, template);
      if (!plan.ok) {
        setNotice({ tone: "error", message: plan.reason });
        return;
      }
      if (await edit(plan.ops)) setNotice(undefined);
    },
    [design, edit, setNotice, setTool],
  );

  const onPaneClick = useCallback(
    (event: MouseEvent) => {
      if (tool.kind === "attachment") {
        setNotice({ tone: "info", message: "Click an element card to add the attachment to it." });
        return;
      }
      if (tool.kind === "connect") {
        setPendingEnd(undefined);
        return;
      }
      void placeAt(tool, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [tool, flow, placeAt, setNotice, setPendingEnd],
  );

  const onNodeClick: NodeMouseHandler<BoardNode> = useCallback(
    (event, node) => {
      if (!design) return;
      if (node.type === "context" || node.type === "systemBoundary") return;
      if (tool.kind === "connect") {
        const end = endFromClick(design, node, event);
        if (pendingEnd) void runPlan(planConnect(design, registry, pendingEnd, end));
        else setPendingEnd(end);
      } else if (tool.kind === "attachment") {
        if (node.type === "element") void attachTo(node.id, tool.template);
        else
          setNotice({ tone: "info", message: "Attachments go on element cards, not annotations." });
      } else if (tool.kind !== "select" && tool.kind !== "hand") {
        // A placement click must never create a card over an existing card or activate
        // its subtype controls. Frames are containers and can still receive new items.
        if (node.type === "frame")
          void placeAt(tool, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        else setNotice({ tone: "info", message: "Click empty board space to place the new item." });
      }
    },
    [design, tool, pendingEnd, flow, runPlan, attachTo, placeAt, setNotice, setPendingEnd],
  );

  const onNodeDoubleClick: NodeMouseHandler<BoardNode> = useCallback(
    (_, node) => {
      if (
        tool.kind === "select" &&
        (node.type === "text" || node.type === "note" || node.type === "frame")
      )
        setEditing(node.id);
    },
    [setEditing, tool.kind],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!design) return;
      const from = endFromHandle(design, connection.source, connection.sourceHandle);
      const to = endFromHandle(design, connection.target, connection.targetHandle);
      void runPlan(planConnect(design, registry, from, to));
    },
    [design, runPlan],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, __: BoardNode, dragged: BoardNode[]) => {
      const items: Record<string, LayoutItem> = {};
      for (const node of dragged) {
        if (node.type === "context" || node.type === "systemBoundary") continue;
        const x = Math.round(node.position.x);
        const y = Math.round(node.position.y);
        items[node.id] = { ...layout?.items[node.id], x, y };
      }
      setLayoutItems(items, { undoable: true });
    },
    [layout, setLayoutItems],
  );

  const selectedNodes = nodes.filter((n) => n.selected).map((n) => n.id);
  const selectedEdges = edges.filter((e) => e.selected).map((e) => e.id);
  const deleteSelection = useCallback(() => {
    if (!design) return;
    const ops = deleteOps(design, selectedNodes, selectedEdges);
    if (ops.length > 0) void edit(ops);
  }, [design, selectedNodes, selectedEdges, edit]);

  const hasSelection = selectedNodes.length + selectedEdges.length > 0;
  const zoomToSelection = useCallback(() => {
    const ends = edges.filter((e) => e.selected).flatMap((e) => [e.source, e.target]);
    const ids = [...new Set([...selectedNodes, ...ends])];
    if (ids.length > 0)
      void flow.fitView({
        nodes: ids.map((id) => ({ id })),
        duration: 250,
        maxZoom: 1,
        padding: 0.4,
      });
  }, [edges, selectedNodes, flow]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && !event.altKey && (key === "z" || key === "y")) {
        event.preventDefault();
        if (key === "y" || event.shiftKey) void redo();
        else void undo();
        return;
      }
      if (event.shiftKey && event.code === "Digit2") {
        zoomToSelection();
        return;
      }
      if (mod || event.altKey) return;
      if (event.key === "Escape") {
        setTool({ kind: "select" });
        setNotice(undefined);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelection();
        return;
      }
      const shortcut = SHORTCUTS[event.key.toLowerCase()];
      if (shortcut) setTool(shortcut);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection, zoomToSelection, setTool, setNotice, undo, redo]);

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes("application/x-jeeves-tool")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const dropped = readDraggedTool(event);
      if (!dropped) return;
      event.preventDefault();
      if (dropped.kind === "attachment") {
        // Hit-test by point: the drop target can be a child the card doesn't own (e.g. an edge label).
        const card = document
          .elementsFromPoint(event.clientX, event.clientY)
          .find((el) => el.classList.contains("react-flow__node-element"));
        const elementId = card?.getAttribute("data-id");
        if (elementId) void attachTo(elementId, dropped.template);
        else setNotice({ tone: "info", message: "Drop an attachment onto an element card." });
        return;
      }
      if (
        document
          .elementsFromPoint(event.clientX, event.clientY)
          .some(
            (el) =>
              el.classList.contains("react-flow__node") &&
              !el.classList.contains("react-flow__node-frame") &&
              !el.classList.contains("react-flow__node-systemBoundary"),
          )
      ) {
        setNotice({ tone: "info", message: "Drop the new item onto empty board space." });
        return;
      }
      void placeAt(dropped, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [flow, placeAt, attachTo, setNotice],
  );

  if (!loaded) return null;

  return (
    <div className="draw-board" data-tool={tool.kind}>
      <section
        className="architecture-scope-caption c2-scope-caption"
        aria-label={`Container diagram for ${loaded.design.architecture?.system.name ?? loaded.project.name}`}
      >
        <strong>{loaded.design.architecture?.system.name ?? loaded.project.name}</strong>
        <span>Applications and data stores</span>
      </section>
      <div className="c2-board-stage">
        <ReactFlow<BoardNode, BoardEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          edgesReconnectable={tool.kind === "select"}
          onReconnect={(edge, connection) => {
            if (!design || !design.connections.some((c) => c.id === edge.id)) return;
            const draft = {
              ...design,
              connections: design.connections.filter((c) => c.id !== edge.id),
            };
            const plan = planConnect(
              draft,
              registry,
              { element: connection.source },
              { element: connection.target },
            );
            const disconnect: OperationInput = { op: "disconnect", id: edge.id };
            if (plan.ok === true) void runPlan({ ...plan, ops: [disconnect, ...plan.ops] });
            else if (plan.ok === "choose")
              void runPlan({
                ...plan,
                choices: plan.choices.map((c) => ({ ...c, ops: [disconnect, ...c.ops] })),
              });
            else
              void runPlan({
                ...plan,
                fixes: plan.fixes.map((c) => ({ ...c, ops: [disconnect, ...c.ops] })),
              });
          }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onPaneClick={onPaneClick}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          onMoveEnd={(_, viewport) => setViewport(viewport)}
          defaultViewport={defaultViewport}
          fitView={fitOnOpen}
          fitViewOptions={{ maxZoom: 1, padding: 0.15 }}
          panOnDrag={tool.kind === "hand" ? true : [1, 2]}
          selectionOnDrag={tool.kind === "select"}
          nodesDraggable={tool.kind === "select"}
          nodesConnectable={tool.kind === "select" || tool.kind === "connect"}
          elementsSelectable={tool.kind === "select"}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <BoardTexture />
          <FreeArrows design={loaded.design} layout={loaded.layout} />
          <Controls showInteractive={false} position="bottom-right">
            <ControlButton
              onClick={zoomToSelection}
              disabled={!hasSelection}
              title="Zoom to selection (Shift+2)"
              aria-label="Zoom to selection"
            >
              <IconFocusCentered size={16} />
            </ControlButton>
          </Controls>
        </ReactFlow>
      </div>
      <Toolbar onDelete={deleteSelection} canDelete={hasSelection} />
    </div>
  );
}

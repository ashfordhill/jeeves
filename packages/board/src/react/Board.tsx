// Ported from automation-illustrator src/board/Board.tsx and src/board/controls/PathHostFrame.tsx
// (0803c4a).
// The board: React Flow showing tiles and lines where ELK put them. Nothing is dragged or
// connected; dragging the paper pans, the wheel zooms, a click selects. The first non-empty
// layout takes a one-time camera (a fit, or a sole tile centred); `fit()` refits on demand.
//
// Changes from automation-illustrator: no store, lanes, compare camera, word-web, present mode,
// insert previews or departing tiles. Tiles and lines come in as props, with caller content on
// each tile face and line chip. In hand mode tiles and lines let the pointer through, so every
// drag pans and nothing is selected.
import "@xyflow/react/dist/base.css";
import "./board.css";
import {
  Background,
  BackgroundVariant,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ANIMATE_MS } from "../layout/animate.ts";
import type { LayoutInput } from "../layout/elkGraph.ts";
import type { BoardLayout } from "../layout/elkLayout.ts";
import type { LayoutEngine } from "../layout/engine.ts";
import { GRID, type Point, type Size } from "../layout/metrics.ts";
import { BoardLine, type BoardLineEdge } from "./BoardLine.tsx";
import {
  boardNeedsCover,
  canApplyFirstLayoutCamera,
  clampWheelZoom,
  firstLayoutCentersAtCurrentZoom,
  graphIsIsland,
  layoutBoundsAreUsable,
  MAX_ZOOM,
  MIN_ZOOM,
  type Pane,
  pointerOverTileOrLine,
  pointInPaddedBounds,
  shouldZoomTowardBounds,
  unionTileBounds,
  type Viewport,
  viewportToCenterRect,
  viewportToFitRect,
  viewportZoomAround,
  wheelZoomFactor,
  ZOOM_BOUNDS_PAD,
} from "./camera.ts";
import { BoardContext } from "./context.ts";
import { prefersReducedMotion, useAnimatedLayout } from "./useAnimatedLayout.ts";
import { useBoardLayout } from "./useBoardLayout.ts";

export type TileShape = "rect" | "pill";

export type TileSpec = {
  id: string;
  w: number;
  h: number;
  shape: TileShape;
  /** Accessible name of the tile. */
  label: string;
  /** The tile face, drawn inside the board's frame. */
  content: ReactNode;
};

export type LineSpec = {
  id: string;
  source: string;
  target: string;
  dashed: boolean;
  /** Accessible name of the line; never drawn. */
  label?: string;
  /** A box drawn on the line (phrasing content, such as an icon), kept clear by ELK. */
  chip?: Size & { content: ReactNode };
};

export type BoardSelection = { tile?: string; line?: string };
export type BoardMode = "select" | "hand";
export type BoardHandle = { fit: () => void };

export type BoardProps = {
  tiles: readonly TileSpec[];
  lines: readonly LineSpec[];
  engine: LayoutEngine;
  selected: BoardSelection;
  onSelectTile: (id: string) => void;
  onSelectLine: (id: string) => void;
  /** A click on empty paper. */
  onClear: () => void;
  mode: BoardMode;
  /** Positions for tiles that have none shown yet (a new tile's slot); shown positions win. */
  hints?: Record<string, Point>;
  ref?: Ref<BoardHandle>;
};

type TileData = { shape: TileShape; content: ReactNode };
type TileNode = Node<TileData, "tile">;

function Tile({ data, selected }: NodeProps<TileNode>) {
  return (
    <div className="board-tile" data-shape={data.shape} data-selected={selected || undefined}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {data.content}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { tile: Tile };
const edgeTypes = { line: BoardLine };

function layoutInput(tiles: readonly TileSpec[], lines: readonly LineSpec[]): LayoutInput {
  return {
    tiles: tiles.map((t) => ({ id: t.id, w: t.w, h: t.h })),
    lines: lines.map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      ...(l.chip ? { chip: { w: l.chip.w, h: l.chip.h } } : {}),
    })),
  };
}

function paneOf(host: HTMLElement | null): (Pane & { left: number; top: number }) | null {
  const el = host?.querySelector(".react-flow");
  if (!(el instanceof HTMLElement)) return null;
  const box = el.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return null;
  return { width: box.width, height: box.height, left: box.left, top: box.top };
}

/** The zoom a fit of the shown tiles would use; zooming out stops a little below it. */
function fitZoom(pane: Pane, shown: BoardLayout | null, sizes: Record<string, Size>): number {
  const box = shown ? unionTileBounds(shown.positions, sizes) : undefined;
  return layoutBoundsAreUsable(box) ? viewportToFitRect(pane, box).zoom : MIN_ZOOM;
}

function Inner({
  tiles,
  lines,
  engine,
  selected,
  onSelectTile,
  onSelectLine,
  onClear,
  mode,
  hints,
  handle,
}: Omit<BoardProps, "ref"> & { handle?: Ref<BoardHandle> }) {
  const rf = useReactFlow<TileNode, BoardLineEdge>();
  const hostRef = useRef<HTMLDivElement>(null);
  const input = layoutInput(tiles, lines);
  const { layout, phase, error } = useBoardLayout(engine, input, hints);
  const shown = useAnimatedLayout(layout);
  const display = shown?.positions;

  const sizes: Record<string, Size> = {};
  for (const t of tiles) sizes[t.id] = { w: t.w, h: t.h };
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  const shownRef = useRef<BoardLayout | null>(shown);
  shownRef.current = shown;
  const lastZoomRef = useRef(1);

  /* First non-empty layout: hold the board until ELK and the camera land, then fit once. A sole
     tile is centred at the current zoom instead. */
  const tileCount = tiles.length;
  const cameraApplied = useRef(false);
  const [boardReady, setBoardReady] = useState(tileCount === 0);
  const covering = boardNeedsCover(tileCount, boardReady);
  useLayoutEffect(() => {
    if (tileCount === 0) {
      cameraApplied.current = false;
      setBoardReady(true);
      return;
    }
    if (cameraApplied.current) {
      setBoardReady(true);
      return;
    }
    if (!canApplyFirstLayoutCamera(phase, tileCount)) {
      setBoardReady(false);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const finish = (next: Viewport) => {
      lastZoomRef.current = next.zoom;
      void rf.setViewport(next, { duration: 0 }).finally(() => {
        if (cancelled) return;
        cameraApplied.current = true;
        setBoardReady(true);
      });
    };
    const attempt = () => {
      const pane = paneOf(hostRef.current);
      const box = layout ? unionTileBounds(layout.positions, sizesRef.current) : undefined;
      if (!pane || !layoutBoundsAreUsable(box)) {
        raf = requestAnimationFrame(attempt);
        return;
      }
      finish(
        firstLayoutCentersAtCurrentZoom(tileCount)
          ? viewportToCenterRect(pane, box, rf.getViewport().zoom || 1)
          : viewportToFitRect(pane, box),
      );
    };
    attempt();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, rf, tileCount, layout]);

  useImperativeHandle(
    handle,
    () => ({
      fit() {
        const pane = paneOf(hostRef.current);
        const current = shownRef.current;
        const box = current ? unionTileBounds(current.positions, sizesRef.current) : undefined;
        if (!pane || !layoutBoundsAreUsable(box)) return;
        const next = viewportToFitRect(pane, box);
        lastZoomRef.current = next.zoom;
        void rf.setViewport(next, { duration: prefersReducedMotion() ? 0 : ANIMATE_MS });
      },
    }),
    [rf],
  );

  /* Wheel zoom: finer steps than React Flow's, with a floor a little below fit. Zooming in on
     empty paper aims at the graph. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.deltaY === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const pane = paneOf(host);
      if (!pane) return;
      const vp = rf.getViewport();
      const nextZoom = clampWheelZoom(
        vp.zoom,
        vp.zoom * wheelZoomFactor(e.deltaY, e.deltaMode),
        fitZoom(pane, shownRef.current, sizesRef.current),
      );
      if (Math.abs(nextZoom - vp.zoom) < 1e-6) return;
      lastZoomRef.current = nextZoom;
      const flowPointer = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const bounds = shownRef.current?.bounds;
      const toward =
        layoutBoundsAreUsable(bounds) &&
        shouldZoomTowardBounds({
          zoomingIn: nextZoom > vp.zoom,
          pointerOverTileOrLine: pointerOverTileOrLine(e.target),
          pointerInPaddedBounds: pointInPaddedBounds(flowPointer, bounds, ZOOM_BOUNDS_PAD),
          graphIsland: graphIsIsland(bounds, vp.zoom, pane),
        });
      const flowFocal =
        toward && bounds ? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 } : flowPointer;
      const screenFocal = toward
        ? rf.flowToScreenPosition(flowFocal)
        : { x: e.clientX, y: e.clientY };
      void rf.setViewport(
        viewportZoomAround({
          paneLeft: pane.left,
          paneTop: pane.top,
          clientX: screenFocal.x,
          clientY: screenFocal.y,
          flowX: flowFocal.x,
          flowY: flowFocal.y,
          nextZoom,
        }),
      );
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [rf]);

  const hand = mode === "hand";
  const placed = (id: string): Point | undefined => display?.[id] ?? hints?.[id];

  const nodes: TileNode[] = tiles.map((t) => {
    const at = placed(t.id);
    return {
      id: t.id,
      type: "tile",
      position: at ?? { x: 0, y: 0 },
      hidden: !at,
      data: { shape: t.shape, content: t.content },
      draggable: false,
      connectable: false,
      selected: selected.tile === t.id,
      className: "nopan",
      width: t.w,
      height: t.h,
      measured: { width: t.w, height: t.h },
      // Lines know their ends before React Flow measures the tile (and in tests, where it never does).
      handles: [
        { type: "target", position: Position.Left, x: 0, y: t.h / 2, width: 0, height: 0 },
        { type: "source", position: Position.Right, x: t.w, y: t.h / 2, width: 0, height: 0 },
      ],
      ariaLabel: t.label,
      style: { width: t.w, height: t.h, ...(hand ? { pointerEvents: "none" } : {}) },
    };
  });

  /* Draw order at crossings: dashed first, solid next, the selected line on top. */
  const rank = (l: LineSpec) => (selected.line === l.id ? 2 : l.dashed ? 0 : 1);
  const edges: BoardLineEdge[] = [...lines]
    .sort((a, b) => rank(a) - rank(b))
    .map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      type: "line",
      hidden: !placed(l.source) || !placed(l.target),
      selected: selected.line === l.id,
      ...(l.label ? { ariaLabel: l.label } : {}),
      data: {
        dashed: l.dashed,
        ...(l.label ? { label: l.label } : {}),
        ...(l.chip ? { chip: l.chip.content } : {}),
      },
    }));

  const context = useMemo(
    () => ({
      layout: shown,
      selectLine: (id: string) => {
        if (!hand) onSelectLine(id);
      },
    }),
    [shown, hand, onSelectLine],
  );

  return (
    <div
      ref={hostRef}
      className="board"
      data-layout={phase}
      data-board={covering ? "loading" : "ready"}
      data-mode={mode}
      data-layout-error={error || undefined}
      aria-busy={covering || undefined}
    >
      <BoardContext.Provider value={context}>
        <ReactFlow<TileNode, BoardLineEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={!hand}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          panOnDrag
          selectionOnDrag={false}
          selectNodesOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          panOnScroll={false}
          autoPanOnNodeFocus={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          snapToGrid
          snapGrid={[GRID, GRID]}
          onMove={(event, viewport) => {
            const previous = lastZoomRef.current;
            lastZoomRef.current = viewport.zoom;
            // Pinch zoom-out stops a little below fit, like the wheel. Programmatic moves pass.
            if (!event || viewport.zoom >= previous - 1e-4) return;
            const pane = paneOf(hostRef.current);
            if (!pane) return;
            const zoom = clampWheelZoom(
              previous,
              viewport.zoom,
              fitZoom(pane, shownRef.current, sizesRef.current),
            );
            if (Math.abs(zoom - viewport.zoom) <= 1e-4) return;
            lastZoomRef.current = zoom;
            void rf.setViewport({ ...viewport, zoom });
          }}
          onNodeClick={(_, node) => {
            if (!hand) onSelectTile(node.id);
          }}
          onEdgeClick={(_, edge) => {
            if (!hand) onSelectLine(edge.id);
          }}
          onPaneClick={() => {
            if (!hand) onClear();
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={GRID}
            size={2.2}
            color="var(--board-dot)"
          />
        </ReactFlow>
      </BoardContext.Provider>
      {covering ? (
        <div className="board-loading" role="status">
          Loading…
        </div>
      ) : null}
    </div>
  );
}

export function Board({ ref, ...props }: BoardProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} handle={ref} />
    </ReactFlowProvider>
  );
}

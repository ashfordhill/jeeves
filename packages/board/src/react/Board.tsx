// Ported from automation-illustrator src/board/Board.tsx and src/board/controls/PathHostFrame.tsx
// (0803c4a).
// The board: React Flow showing tiles and lines where ELK put them. Tiles are never dragged;
// dragging the paper pans, the wheel zooms, a click selects. The first non-empty layout takes a
// one-time camera (a fit, or a sole tile centred); `fit()` refits on demand. A fitted camera
// refits when the board changes size (a rail opens or closes); once the user pans or zooms, the
// camera is theirs and stays. The selected tile shows the caller's pull tabs (`TileChrome`): a
// picked fan item becomes a new tile, which docks at the next slot beside its source until ELK
// lands and the layout animates, and the camera pans just enough to show it. The selected line
// and the selected tile's lines take the selection colour, drawn over the rest. A removable
// selected tile, and a selected line, show a red X; a caller's panel (`hud`, a confirmation)
// sits at the bottom centre of the board.
//
// Changes from automation-illustrator: no store, lanes, compare camera, word-web, present mode,
// insert previews or departing tiles. Tiles, lines and tabs come in as props, with caller content
// on each tile face, line chip and fan item. In hand mode tiles and lines let the pointer
// through, so every drag pans and nothing is selected.
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
  useCallback,
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
import {
  type DockSide,
  GRID,
  newTileHint,
  type Point,
  type Rect,
  type Size,
  type SlotOrder,
} from "../layout/metrics.ts";
import { BoardLine, type BoardLineEdge } from "./BoardLine.tsx";
import {
  boardNeedsCover,
  type CameraOrigin,
  cameraOriginAfterMove,
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
  viewportOnResize,
  viewportToCenterRect,
  viewportToFitRect,
  viewportToReveal,
  viewportZoomAround,
  wheelZoomFactor,
  ZOOM_BOUNDS_PAD,
} from "./camera.ts";
import { BoardContext } from "./context.ts";
import { type PullState, type TabSpec, TileChrome } from "./TileChrome.tsx";
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
/**
 * A panel about a tile (such as a removal's confirmation), at the bottom centre of the board at
 * screen size. While it shows, that tile has no chrome and the `marked` tiles get a warning ring.
 */
export type TileHud = { tile: string; content: ReactNode; marked?: readonly string[] };
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
  /** The selected tile's pull tabs (select mode only); none shows no chrome. */
  tabs?: readonly TabSpec[];
  /** Whether a tab of `tile` may drop on `target`: the target shows through the scrim. */
  canDrop?: (tile: string, tab: string, target: string) => boolean;
  /**
   * A fan item released on: returns, or resolves to, the new tile's ID (undefined when nothing is
   * added). Return it synchronously so the tile docks at the next slot as soon as it appears.
   */
  onPick?: (
    tile: string,
    tab: string,
    item: string,
  ) => string | undefined | Promise<string | undefined>;
  /** A release over a tile `canDrop` allows. */
  onDrop?: (tile: string, tab: string, target: string) => void;
  /** A release over a tile `canDrop` refuses; the pull springs back. */
  onDropRefused?: (tile: string, tab: string, target: string) => void;
  /** Whether the selected tile shows a red X (select mode). */
  removable?: (tile: string) => boolean;
  /** The selected tile's X was clicked. */
  onRemoveTile?: (tile: string) => void;
  /** The selected line's X (at its midpoint) was clicked; without it lines have no X. */
  onRemoveLine?: (line: string) => void;
  hud?: TileHud;
  ref?: Ref<BoardHandle>;
};

type TileData = { shape: TileShape; content: ReactNode; chrome?: ReactNode };
type TileNode = Node<TileData, "tile">;

function Tile({ data, selected }: NodeProps<TileNode>) {
  return (
    <div className="board-tile-host">
      <div className="board-tile" data-shape={data.shape} data-selected={selected || undefined}>
        <Handle type="target" position={Position.Left} isConnectable={false} />
        {data.content}
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </div>
      {data.chrome}
    </div>
  );
}

/** A picked tile waiting to appear: where it docks, worked out once it is in `tiles`. */
type Dock = {
  source: string;
  side: DockSide;
  port: number;
  order?: SlotOrder;
  hint?: { at: Point; show: boolean };
};

function rectOf(id: string, at: Record<string, Point>, sizes: Record<string, Size>) {
  const p = at[id];
  const size = sizes[id];
  return p && size ? { ...p, ...size } : undefined;
}

/** The new tile's hint beside its source's shown rect, among the shown tiles. */
function dockFor(
  dock: Dock,
  size: Size,
  shown: Record<string, Point>,
  sizes: Record<string, Size>,
): Dock["hint"] {
  const source = rectOf(dock.source, shown, sizes);
  if (!source) return undefined;
  const others = Object.keys(shown).flatMap((id) => {
    const rect = rectOf(id, shown, sizes);
    return rect ? [rect] : ([] as Rect[]);
  });
  const neighbourId = dock.order && ("after" in dock.order ? dock.order.after : dock.order.before);
  const neighbour = neighbourId ? rectOf(neighbourId, shown, sizes) : undefined;
  return newTileHint(
    source,
    size,
    dock.port,
    others,
    dock.side,
    neighbour && dock.order
      ? { rect: neighbour, place: "after" in dock.order ? "after" : "before" }
      : undefined,
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
  tabs,
  canDrop,
  onPick,
  onDrop,
  onDropRefused,
  removable,
  onRemoveTile,
  onRemoveLine,
  hud,
  handle,
}: Omit<BoardProps, "ref"> & { handle?: Ref<BoardHandle> }) {
  const rf = useReactFlow<TileNode, BoardLineEdge>();
  const hostRef = useRef<HTMLDivElement>(null);
  const input = layoutInput(tiles, lines);

  const sizes: Record<string, Size> = {};
  for (const t of tiles) sizes[t.id] = { w: t.w, h: t.h };
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  const shownRef = useRef<BoardLayout | null>(null);

  /* Picked tiles dock beside their source, worked out against the positions shown when they
     first appear. The hint orders them for ELK and, when the slot is free, shows them there. */
  const docks = useRef(new Map<string, Dock>());
  const [, setDocked] = useState(0);
  const dockOrder: Record<string, Point> = {};
  const dockShow: Record<string, Point> = {};
  for (const [id, dock] of docks.current) {
    const size = sizes[id];
    const before = shownRef.current?.positions;
    if (!size || !before) continue;
    dock.hint ??= dockFor(dock, size, before, sizes);
    if (!dock.hint) continue;
    dockOrder[id] = dock.hint.at;
    if (dock.hint.show) dockShow[id] = dock.hint.at;
  }

  const { layout, phase, error } = useBoardLayout(engine, input, { ...hints, ...dockOrder });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const shown = useAnimatedLayout(layout);
  shownRef.current = shown;
  const display = shown?.positions;
  for (const id of docks.current.keys()) if (display?.[id]) docks.current.delete(id);
  const lastZoomRef = useRef(1);
  /* Where the current pan or zoom gesture started. */
  const moveFrom = useRef<Viewport | null>(null);
  /* Whether the camera came from a fit (the first layout or Fit) or from the user's pan or zoom. */
  const originRef = useRef<CameraOrigin>("fit");
  /* A picked tile to bring into view once ELK has placed it. */
  const revealRef = useRef<string | null>(null);

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
      originRef.current = "fit";
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
        originRef.current = "fit";
        void rf.setViewport(next, { duration: prefersReducedMotion() ? 0 : ANIMATE_MS });
      },
    }),
    [rf],
  );

  /* The board changed size (a rail opened or closed, the window resized): a fitted camera refits
     the laid-out tiles at once; the user's camera stays. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    let last: Pane | null = null;
    const observer = new ResizeObserver(() => {
      const pane = paneOf(host);
      if (!pane) return;
      const before = last;
      last = { width: pane.width, height: pane.height };
      if (!before || !cameraApplied.current) return;
      if (Math.abs(before.width - pane.width) < 1 && Math.abs(before.height - pane.height) < 1)
        return;
      const positions = (layoutRef.current ?? shownRef.current)?.positions;
      const next = viewportOnResize(
        originRef.current,
        pane,
        positions ? unionTileBounds(positions, sizesRef.current) : undefined,
      );
      if (!next) return;
      lastZoomRef.current = next.zoom;
      void rf.setViewport(next, { duration: 0 });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [rf]);

  /* A picked tile ELK has placed outside the view: pan just enough to show it, at the same zoom. */
  useEffect(() => {
    const id = revealRef.current;
    const at = id ? layout?.positions[id] : undefined;
    const size = id ? sizesRef.current[id] : undefined;
    if (!id || phase !== "ready" || !at || !size || !cameraApplied.current) return;
    revealRef.current = null;
    const pane = paneOf(hostRef.current);
    const next = pane && viewportToReveal(rf.getViewport(), pane, { ...at, ...size });
    if (next) void rf.setViewport(next, { duration: prefersReducedMotion() ? 0 : ANIMATE_MS });
  }, [layout, phase, rf]);

  /* Wheel zoom: finer steps than React Flow's, with a floor a little below fit. Zooming in on
     empty paper aims at the graph. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.deltaY === 0) return;
      if (e.target instanceof Element && e.target.closest(".board-hud")) return;
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
      originRef.current = "user";
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
  const placed = (id: string): Point | undefined => display?.[id] ?? dockShow[id] ?? hints?.[id];

  /* The selected tile's pull: which tiles it may drop on, and the one under the pointer. */
  const [pull, setPull] = useState<PullState | null>(null);
  const onPull = useCallback((next: PullState | null) => {
    setPull((current) =>
      current === next ||
      (current &&
        next &&
        current.tab === next.tab &&
        current.targets === next.targets &&
        current.over === next.over)
        ? current
        : next,
    );
  }, []);
  const source = selected.tile;
  /* A tile with a panel under it shows no chrome; the panel speaks for it. */
  const hudTile = !hand && !covering && hud && placed(hud.tile) ? hud.tile : null;
  const removeTile = source && removable?.(source) ? onRemoveTile : undefined;
  const chromeTile =
    !hand &&
    !covering &&
    source &&
    source !== hudTile &&
    (tabs?.length || removeTile) &&
    placed(source)
      ? source
      : null;
  const label = (id: string) => tiles.find((t) => t.id === id)?.label ?? id;
  const chrome = chromeTile ? (
    <TileChrome
      tile={chromeTile}
      size={sizes[chromeTile] ?? { w: 128, h: 128 }}
      tabs={tabs ?? []}
      {...(removeTile && {
        remove: { label: `Remove ${label(chromeTile)}`, onRemove: () => removeTile(chromeTile) },
      })}
      host={hostRef}
      others={() => tiles.map((t) => t.id).filter((id) => id !== chromeTile && placed(id))}
      canDrop={(tab, target) => canDrop?.(chromeTile, tab, target) ?? false}
      onPull={onPull}
      onPick={(tab, item) => {
        const port = lines.filter((l) =>
          tab.side === "after" ? l.source === chromeTile : l.target === chromeTile,
        ).length;
        const record = (id: string | undefined) => {
          if (id) revealRef.current = id;
          if (!id || shownRef.current?.positions[id]) return;
          docks.current.set(id, {
            source: chromeTile,
            side: tab.side,
            port,
            ...(tab.order ? { order: tab.order } : {}),
          });
          setDocked((n) => n + 1);
        };
        const result = onPick?.(chromeTile, tab.id, item);
        if (result instanceof Promise) void result.then(record, () => {});
        else record(result);
      }}
      onDrop={(tab, target) => onDrop?.(chromeTile, tab, target)}
      onRefused={(tab, target) => onDropRefused?.(chromeTile, tab, target)}
    />
  ) : null;
  /* Tiles the pull may drop on are outlined; the one under the pointer more strongly. Tiles a
     panel is about (a removal's) get a warning ring. */
  const tileClass = (id: string): string => {
    if (hudTile && hud?.marked?.includes(id)) return " is-marked";
    if (!pull?.targets?.has(id) || !chromeTile) return "";
    return pull.over === id ? " is-drop-target is-drop-over" : " is-drop-target";
  };

  const nodes: TileNode[] = tiles.map((t) => {
    const at = placed(t.id);
    return {
      id: t.id,
      type: "tile",
      position: at ?? { x: 0, y: 0 },
      hidden: !at,
      data: {
        shape: t.shape,
        content: t.content,
        ...(t.id === chromeTile ? { chrome } : {}),
      },
      draggable: false,
      connectable: false,
      selected: selected.tile === t.id,
      className: `nopan${tileClass(t.id)}`,
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

  /* Draw order at crossings: dashed under solid; the selected tile's lines over the rest, and the
     selected line on top. */
  const linked = (l: LineSpec) =>
    selected.tile !== undefined && (l.source === selected.tile || l.target === selected.tile);
  const rank = (l: LineSpec) =>
    (selected.line === l.id ? 4 : linked(l) ? 2 : 0) + (l.dashed ? 0 : 1);
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
        ...(linked(l) ? { linked: true } : {}),
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
      ...(!hand && onRemoveLine ? { removeLine: onRemoveLine } : {}),
    }),
    [shown, hand, onSelectLine, onRemoveLine],
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
          onMoveStart={(_, viewport) => {
            moveFrom.current = viewport;
          }}
          onMove={(event, viewport) => {
            // A drag, the wheel or a pinch makes the camera the user's; the board's moves don't.
            originRef.current = cameraOriginAfterMove(
              originRef.current,
              Boolean(event),
              moveFrom.current ?? viewport,
              viewport,
            );
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
      {hudTile ? (
        <div className="board-hud" data-tile={hudTile}>
          {hud?.content}
        </div>
      ) : null}
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

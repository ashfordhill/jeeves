// Ported from automation-illustrator src/board/Board.tsx and src/board/controls/PathHostFrame.tsx
// (0803c4a).
// The board: React Flow showing tiles and lines where ELK put them. Tiles are never dragged;
// dragging the paper pans, the wheel zooms, a click selects. The first non-empty layout takes a
// one-time camera (a fit, or a sole tile centred); `fit()` refits on demand. A fitted camera
// refits when the board changes size (a rail opens or closes); once the user pans or zooms, the
// camera is theirs and stays. In select mode the selected tile shows the caller's pull tabs
// (`TileChrome`): a picked fan item becomes a new tile, which docks at the next slot beside its
// source until ELK lands and the layout animates, and the camera pans just enough to show it.
// The selected line and the selected tile's lines take the selection colour, drawn over the rest.
// A removable selected tile (select mode), and a selected line, show a red X; a caller's panel
// (`hud`, a confirmation) sits at the bottom centre of the board.
//
// Modes: in select mode a click selects and the paper pans. In connect mode a click still
// selects and the paper still pans, but a drag from a tile draws a new line to another tile
// (`ConnectDrag.tsx`, with the caller's `canConnect`, `connectRefusal`, `onConnect` and
// `onConnectRefused`); a tile's content may mark ends of its own inside it (`data-board-end`,
// such as a container's rows), dragged from their handles and dropped on where the rules know
// them. Tiles show no chrome, and a line under the pointer turns the selection colour and shows
// its red X (on the stretch the selected line's X would take) until the pointer leaves it and its
// X. A drag held near the board's edge pans the camera towards it, as far as the tiles go; the
// camera is then the user's.
//
// Hit areas: the host carries the camera's zoom as `--board-zoom` and the smallest hit area an
// end's handle should keep on screen as `--board-handle-hit` (16px), so a tile's content can keep
// a small handle grabbable at any zoom (`calc(var(--board-handle-hit) / var(--board-zoom))`
// board pixels) without growing what it draws.
//
// Ports: a tile's `ports` are named ports at fixed heights beside its default mid-height ones, and
// a line's `sourcePort`/`targetPort` name the ones it uses (`elkGraph.ts` has the rules). Each
// becomes a React Flow handle with the port's id at its height, after the default handle (which an
// edge without a handle id takes), so a line's fallback route before ELK lands starts and ends at
// its ports too; the drawn line and its arrowhead follow the routed ends. Snapshots carry them.
// Flat and banded layouts both route lines to their named ports.
//
// Views: `view` names which view of one graph the tiles and lines show (a simple and a detailed
// one, say). Each view keeps its own stability hints (`useBoardLayout`). On a switch the previous
// view stays drawn until the new one is laid out, the move animates however far tiles go
// (`useAnimatedLayout`), and then the camera fits. `highlighted` lines take the selection colour
// like the selected tile's own lines (several drawn lines of one selected relationship, say); it
// is view only and selects nothing. `selectedTileLines={false}` keeps the selected tile and its
// chrome but leaves its own lines plain, so `highlighted` alone shows which of them belong to a
// part of the tile (one row of a container, say). Without these props the board is a single
// view, as before. Lines that share a `group` (one relationship drawn as several lines) are one
// entry in the overlap chooser.
//
// Changes from automation-illustrator: no store, lanes, compare camera, word-web, present mode,
// insert previews or departing tiles; connect mode is new. Tiles, lines and tabs come in as props,
// with caller content on each tile face, line chip and fan item.
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
  useStore,
} from "@xyflow/react";
import {
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ANIMATE_MS } from "../layout/animate.ts";
import type { LayoutInput, TilePort } from "../layout/elkGraph.ts";
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
  ConnectOverlay,
  type ConnectRules,
  type EdgePanCamera,
  useConnectDrag,
} from "./ConnectDrag.tsx";
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
import { crossingBridges, nearestLines, oneLinePerGroup } from "./lineGeometry.ts";
import { type TabSpec, TileChrome } from "./TileChrome.tsx";
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
  /** Its band: lower bands are laid out above higher ones (`layoutBands`). */
  band?: number;
  /** Named ports at fixed heights, beside the default mid-height ones (`elkGraph.ts`). */
  ports?: readonly TilePort[];
};

export type LineSpec = {
  id: string;
  source: string;
  target: string;
  dashed: boolean;
  /** Draw an arrowhead at the target, following the routed line's final segment. */
  directed?: boolean;
  /** Accessible name of the line; also shown in the overlap chooser. */
  label?: string;
  /** Optional explanation in the chooser when several routes overlap. */
  detail?: string;
  /**
   * Lines with the same group are one choice (several drawn lines of one relationship, say): the
   * overlap chooser lists the group once, by the first of its lines under the click, and a click
   * whose lines are all one group selects that line without asking. Default: its own group.
   */
  group?: string;
  /** A box drawn on the line (phrasing content, such as an icon), kept clear by ELK. */
  chip?: Size & { content: ReactNode };
  /** `false`: the selected line shows no X (it goes with a tile). Default true. */
  removable?: boolean;
  /** The X's accessible name; default "Remove <label>". */
  removeLabel?: string;
  /** Its band: it shares no run with lines of other bands, except next to a port (`meetAtPorts`). */
  band?: number;
  /** The source's `out` port it leaves from; default: mid-height. */
  sourcePort?: string;
  /** The target's `in` port it enters; default: mid-height. */
  targetPort?: string;
};

export type BoardSelection = { tile?: string; line?: string };
/**
 * A panel about a tile (such as a removal's confirmation), at the bottom centre of the board at
 * screen size. While it shows, that tile has no chrome and the `marked` tiles get a warning ring.
 */
export type TileHud = { tile: string; content: ReactNode; marked?: readonly string[] };
export type BoardMode = "select" | "connect";
/** A frozen full view, independent of camera and selection. */
export type BoardSnapshot = {
  tiles: readonly TileSpec[];
  lines: readonly LineSpec[];
  layout: BoardLayout;
};
export type BoardHandle = {
  fit: () => void;
  /** Null while arranging/animating; throws on layout failure. Never changes the live board. */
  snapshot: () => BoardSnapshot | null;
};

export type BoardProps = ConnectRules & {
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
  /**
   * A tab's enabled fan item released on: returns, or resolves to, the new tile's ID (undefined
   * when nothing is added). Return it synchronously so the tile docks at the next slot as soon as
   * it appears.
   */
  onPick?: (
    tile: string,
    tab: string,
    item: string,
  ) => string | undefined | Promise<string | undefined>;
  /** Whether the selected tile shows a red X (select mode). */
  removable?: (tile: string) => boolean;
  /** The selected tile's X was clicked. */
  onRemoveTile?: (tile: string) => void;
  /**
   * A line's X was clicked (the selected line's, or in connect mode the one under the pointer);
   * without it lines have no X.
   */
  onRemoveLine?: (line: string) => void;
  hud?: TileHud;
  /**
   * The view the tiles and lines show; default one view. Each view keeps its own stability
   * hints; a switch keeps the previous view drawn until the new one is laid out, animates the
   * move however far tiles go, then fits.
   */
  view?: string;
  /**
   * Lines drawn in the selection colour and over the rest, as the selected tile's own lines are.
   * View only: it selects nothing and shows no X.
   */
  highlighted?: readonly string[];
  /**
   * Whether the selected tile's own lines take the selection colour; default true. False keeps
   * the tile selected, with its chrome, and leaves the colour to `highlighted`.
   */
  selectedTileLines?: boolean;
  ref?: Ref<BoardHandle>;
};

type TileData = {
  shape: TileShape;
  content: ReactNode;
  chrome?: ReactNode;
  ports?: readonly TilePort[];
};
type TileNode = Node<TileData, "tile">;

/** A named port's handle at its height; the default handles stay first, at mid-height. */
function PortHandle({ port }: { port: TilePort }) {
  const target = port.side === "in";
  return (
    <Handle
      id={port.id}
      type={target ? "target" : "source"}
      position={target ? Position.Left : Position.Right}
      isConnectable={false}
      style={{ top: port.y }}
    />
  );
}

function Tile({ data, selected }: NodeProps<TileNode>) {
  return (
    <div className="board-tile-host">
      <div className="board-tile" data-shape={data.shape} data-selected={selected || undefined}>
        <Handle type="target" position={Position.Left} isConnectable={false} />
        {data.content}
        <Handle type="source" position={Position.Right} isConnectable={false} />
        {data.ports?.map((port) => (
          <PortHandle key={`${port.side}:${port.id}`} port={port} />
        ))}
      </div>
      {data.chrome}
    </div>
  );
}

type TileHandle = NonNullable<TileNode["handles"]>[number];

/**
 * A tile's handles before React Flow measures it (and in tests, where it never does): the default
 * ones at mid-height, then one per named port, then any `lingering` ports it no longer has.
 */
function tileHandles(
  t: Pick<TileSpec, "w" | "h" | "ports">,
  lingering: readonly TilePort[] = [],
): TileHandle[] {
  const handle = (side: TilePort["side"], y: number, id?: string): TileHandle => ({
    ...(id !== undefined && { id }),
    type: side === "in" ? "target" : "source",
    position: side === "in" ? Position.Left : Position.Right,
    x: side === "in" ? 0 : t.w,
    y,
    width: 0,
    height: 0,
  });
  return [
    handle("in", t.h / 2),
    handle("out", t.h / 2),
    ...(t.ports ?? []).map((p) => handle(p.side, p.y, p.id)),
    ...lingering
      .filter((p) => !t.ports?.some((own) => own.id === p.id && own.side === p.side))
      .map((p) => handle(p.side, p.y, p.id)),
  ];
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

/** Keeps the camera's zoom on the board's host as `--board-zoom`, for content's hit areas. */
function ZoomVariable({ host }: { host: RefObject<HTMLElement | null> }) {
  const zoom = useStore((state) => state.transform[2]);
  useEffect(() => {
    host.current?.style.setProperty("--board-zoom", String(zoom));
  }, [host, zoom]);
  return null;
}

const nodeTypes = { tile: Tile };
/** The paper's dot diameter, in board pixels. */
const DOT_SIZE = 2.2;
const edgeTypes = { line: BoardLine };

function layoutInput(tiles: readonly TileSpec[], lines: readonly LineSpec[]): LayoutInput {
  return {
    tiles: tiles.map((t) => ({
      id: t.id,
      w: t.w,
      h: t.h,
      ...(t.band !== undefined && { band: t.band }),
      ...(t.ports?.length ? { ports: t.ports } : {}),
    })),
    lines: lines.map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      ...(l.chip ? { chip: { w: l.chip.w, h: l.chip.h } } : {}),
      ...(l.band !== undefined && { band: l.band }),
      ...(l.sourcePort !== undefined && { sourcePort: l.sourcePort }),
      ...(l.targetPort !== undefined && { targetPort: l.targetPort }),
    })),
  };
}

function sizesOf(tiles: readonly TileSpec[]): Record<string, Size> {
  const sizes: Record<string, Size> = {};
  for (const t of tiles) sizes[t.id] = { w: t.w, h: t.h };
  return sizes;
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

/** Both the live board and frozen export use exactly the same line ordering/artwork. */
function lineEdges(
  lines: readonly LineSpec[],
  layout: BoardLayout,
  selected: BoardSelection = {},
  placed: (id: string) => Point | undefined = (id) => layout.positions[id],
  highlighted?: ReadonlySet<string>,
  tileLines = true,
  hovered?: string,
): BoardLineEdge[] {
  /* Draw order at crossings: dashed under solid; the selected tile's lines (unless `tileLines`
     is false) and highlighted lines over the rest, then the hovered line (connect mode), and
     the selected line on top. */
  const linked = (l: LineSpec) =>
    (tileLines &&
      selected.tile !== undefined &&
      (l.source === selected.tile || l.target === selected.tile)) ||
    highlighted?.has(l.id) === true;
  const rank = (l: LineSpec) =>
    (selected.line === l.id ? 6 : hovered === l.id ? 4 : linked(l) ? 2 : 0) + (l.dashed ? 0 : 1);
  const ordered = [...lines].sort((a, b) => rank(a) - rank(b));
  const { routes } = layout;
  return ordered.map((l, i) => ({
    id: l.id,
    source: l.source,
    target: l.target,
    ...(l.sourcePort !== undefined && { sourceHandle: l.sourcePort }),
    ...(l.targetPort !== undefined && { targetHandle: l.targetPort }),
    type: "line",
    hidden: !placed(l.source) || !placed(l.target),
    selected: selected.line === l.id,
    ...(l.label ? { ariaLabel: l.label } : {}),
    data: {
      dashed: l.dashed,
      ...(l.directed ? { directed: true } : {}),
      ...(linked(l) || hovered === l.id ? { linked: true } : {}),
      ...(hovered === l.id ? { hovered: true } : {}),
      ...(l.label ? { label: l.label } : {}),
      ...(l.chip ? { chip: l.chip.content } : {}),
      ...(l.removable === false ? { fixed: true } : {}),
      ...(l.removeLabel !== undefined && { removeLabel: l.removeLabel }),
      bridges: crossingBridges(
        routes[l.id] ?? [],
        ordered
          .slice(0, i)
          .flatMap((line) => (routes[line.id] ? [routes[line.id] as Point[]] : [])),
      ),
    },
  }));
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
  onPick,
  canConnect,
  connectRefusal,
  onConnect,
  onConnectRefused,
  removable,
  onRemoveTile,
  onRemoveLine,
  hud,
  view = "",
  highlighted,
  selectedTileLines = true,
  handle,
}: Omit<BoardProps, "ref"> & { handle?: Ref<BoardHandle> }) {
  const rf = useReactFlow<TileNode, BoardLineEdge>();
  const hostRef = useRef<HTMLDivElement>(null);
  const [lineChoice, setLineChoice] = useState<{ ids: string[]; x: number; y: number }>();
  useEffect(() => {
    if (selected.tile || selected.line) setLineChoice(undefined);
  }, [selected.tile, selected.line]);
  const connectMode = mode === "connect";
  // biome-ignore lint/correctness/useExhaustiveDependencies: another view's lines close the chooser
  useEffect(() => setLineChoice(undefined), [view]);
  const input = layoutInput(tiles, lines);

  const sizes = sizesOf(tiles);
  const sizesRef = useRef(sizes);
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

  const {
    layout,
    phase,
    error,
    view: laidOut,
  } = useBoardLayout(engine, input, { ...hints, ...dockOrder }, view);
  /* While a switched-to view is laid out, the previous view's tiles and lines stay drawn with the
     previous layout; then the move animates from one finished view to the other. */
  const settled = useRef({ tiles, lines, sizes });
  if (laidOut === view && (settled.current.tiles !== tiles || settled.current.lines !== lines))
    settled.current = { tiles, lines, sizes };
  const drawn = settled.current;
  sizesRef.current = drawn.sizes;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const shown = useAnimatedLayout(layout, laidOut);
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

  /* Frames the shown tiles, animated; never zooms in past 100%. */
  const fit = useCallback(() => {
    const pane = paneOf(hostRef.current);
    const current = shownRef.current;
    const box = current ? unionTileBounds(current.positions, sizesRef.current) : undefined;
    if (!pane || !layoutBoundsAreUsable(box)) return;
    const next = viewportToFitRect(pane, box);
    lastZoomRef.current = next.zoom;
    originRef.current = "fit";
    void rf.setViewport(next, { duration: prefersReducedMotion() ? 0 : ANIMATE_MS });
  }, [rf]);

  useImperativeHandle(
    handle,
    () => ({
      snapshot() {
        if (error) throw new Error("The diagram layout failed. Reload and try exporting again.");
        // Animated frames carry the target key too: object identity detects actual settlement.
        if (phase !== "ready" || !layout || shown !== layout || covering) return null;
        return {
          tiles: [...drawn.tiles],
          lines: [...drawn.lines],
          layout: structuredClone(layout),
        };
      },
      fit,
    }),
    [fit, drawn, layout, shown, phase, error, covering],
  );

  /* Once a switched-to view has laid out and animated, the camera fits it. */
  const fittedView = useRef(laidOut);
  useEffect(() => {
    if (laidOut === fittedView.current || phase !== "ready" || shown !== layout) return;
    if (!cameraApplied.current) return;
    fittedView.current = laidOut;
    fit();
  }, [fit, laidOut, phase, shown, layout]);

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
      if (e.target instanceof Element && e.target.closest(".board-hud, .board-line-chooser"))
        return;
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

  const placed = (id: string): Point | undefined => display?.[id] ?? dockShow[id] ?? hints?.[id];

  /* A connect drag held near the edge pans the camera, as far as the shown tiles reach; a pan
     makes the camera the user's, so a resize doesn't refit it away. */
  const edgePan = useMemo<EdgePanCamera>(
    () => ({
      frame: () => {
        const pane = paneOf(hostRef.current);
        if (!pane) return null;
        const vp = rf.getViewport();
        const shown = shownRef.current;
        const box = shown ? unionTileBounds(shown.positions, sizesRef.current) : undefined;
        return {
          pane: { x: pane.left, y: pane.top, w: pane.width, h: pane.height },
          ...(layoutBoundsAreUsable(box) && {
            content: {
              x: pane.left + vp.x + box.x * vp.zoom,
              y: pane.top + vp.y + box.y * vp.zoom,
              w: box.w * vp.zoom,
              h: box.h * vp.zoom,
            },
          }),
        };
      },
      pan: (dx, dy) => {
        const vp = rf.getViewport();
        originRef.current = "user";
        void rf.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 0 });
      },
    }),
    [rf],
  );

  /* Connect mode: a drag from a tile, and the line under the pointer (its X shows). The pointer
     may leave a line for its X, which sits over it: the line stays hovered for a moment, and
     while the pointer is on the X. */
  const connecting = useConnectDrag(
    hostRef,
    connectMode && !covering,
    () => drawn.tiles.map((t) => t.id).filter((id) => placed(id)),
    { canConnect, connectRefusal, onConnect, onConnectRefused },
    edgePan,
  );
  const [hoverLine, setHoverLine] = useState<string>();
  const unhover = useRef<ReturnType<typeof setTimeout>>(undefined);
  const holdHover = useCallback((id: string) => {
    clearTimeout(unhover.current);
    setHoverLine(id);
  }, []);
  const releaseHover = useCallback(() => {
    clearTimeout(unhover.current);
    unhover.current = setTimeout(() => setHoverLine(undefined), 150);
  }, []);
  useEffect(() => () => clearTimeout(unhover.current), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: leaving or entering connect mode forgets the hover
  useEffect(() => setHoverLine(undefined), [connectMode]);
  const hovered = connectMode && !connecting ? hoverLine : undefined;
  const refusal =
    connecting?.over != null && !connecting.targets.has(connecting.over)
      ? connectRefusal?.(connecting.from, connecting.over)
      : undefined;

  const source = selected.tile;
  /* A tile with a panel under it shows no chrome; the panel speaks for it. */
  const hudTile = !covering && hud && placed(hud.tile) ? hud.tile : null;
  const removeTile = source && removable?.(source) ? onRemoveTile : undefined;
  const chromeTile =
    mode === "select" &&
    !covering &&
    source &&
    source !== hudTile &&
    (tabs?.length || removeTile) &&
    placed(source)
      ? source
      : null;
  const label = (id: string) => drawn.tiles.find((t) => t.id === id)?.label ?? id;
  const chrome = chromeTile ? (
    <TileChrome
      tile={chromeTile}
      size={drawn.sizes[chromeTile] ?? { w: 128, h: 128 }}
      tabs={tabs ?? []}
      {...(removeTile && {
        remove: { label: `Remove ${label(chromeTile)}`, onRemove: () => removeTile(chromeTile) },
      })}
      host={hostRef}
      onPick={(tab, item) => {
        const port = drawn.lines.filter((l) =>
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
    />
  ) : null;
  /* A connect drag's allowed ends are outlined; the one under the pointer more strongly. Tiles a
     panel is about (a removal's) get a warning ring. */
  const tileClass = (id: string): string => {
    if (hudTile && hud?.marked?.includes(id)) return " is-marked";
    if (!connecting?.targets.has(id)) return "";
    return connecting.over === id ? " is-drop-target is-drop-over" : " is-drop-target";
  };

  /* The previously drawn tiles' ports. React Flow takes new tiles before new lines, and its lines
     check their ends once more before they update, so after a view switch drops a port its handle
     stays (invisible) until the tiles change again. */
  const lingering = useRef({ drawn, ports: new Map<string, readonly TilePort[]>() });
  if (lingering.current.drawn !== drawn) {
    const before = lingering.current.drawn.tiles;
    lingering.current = {
      drawn,
      ports: new Map(before.flatMap((t) => (t.ports ? [[t.id, t.ports]] : []))),
    };
  }
  const nodes: TileNode[] = drawn.tiles.map((t) => {
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
        ...(t.ports?.length ? { ports: t.ports } : {}),
      },
      draggable: false,
      connectable: false,
      selected: selected.tile === t.id,
      className: `nopan${tileClass(t.id)}`,
      width: t.w,
      height: t.h,
      measured: { width: t.w, height: t.h },
      // Lines know their ends before React Flow measures the tile (and in tests, where it never does).
      handles: tileHandles(t, lingering.current.ports.get(t.id)),
      ariaLabel: t.label,
      style: { width: t.w, height: t.h },
    };
  });

  const routes = shown?.routes ?? {};
  const highlight = useMemo(() => new Set(highlighted), [highlighted]);
  const edges = shown
    ? lineEdges(drawn.lines, shown, selected, placed, highlight, selectedTileLines, hovered)
    : [];

  const context = useMemo(
    () => ({
      layout: shown,
      selectLine: onSelectLine,
      ...(onRemoveLine
        ? {
            removeLine: (id: string) => {
              clearTimeout(unhover.current);
              setHoverLine(undefined);
              onRemoveLine(id);
            },
          }
        : {}),
      ...(connectMode ? { holdHover, releaseHover } : {}),
    }),
    [shown, connectMode, onSelectLine, onRemoveLine, holdHover, releaseHover],
  );

  return (
    <div
      ref={hostRef}
      className="board"
      data-layout={phase}
      data-board={covering ? "loading" : "ready"}
      data-mode={mode}
      data-connecting={connecting ? true : undefined}
      data-layout-error={error || undefined}
      aria-busy={covering || undefined}
    >
      <ZoomVariable host={hostRef} />
      <BoardContext.Provider value={context}>
        <ReactFlow<TileNode, BoardLineEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
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
          onEdgeMouseEnter={(_, edge) => {
            if (connectMode && !connecting) holdHover(edge.id);
          }}
          onEdgeMouseLeave={() => {
            if (connectMode) releaseHover();
          }}
          onNodeClick={(_, node) => {
            setLineChoice(undefined);
            onSelectTile(node.id);
          }}
          onEdgeClick={(event, edge) => {
            const point = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const ids = oneLinePerGroup(
              nearestLines(point, routes, 3 / rf.getZoom(), 22),
              (id) => drawn.lines.find((line) => line.id === id)?.group ?? id,
            );
            if (ids.length > 1) {
              const pane = paneOf(hostRef.current);
              if (pane)
                setLineChoice({
                  ids,
                  x: Math.max(8, Math.min(event.clientX - pane.left, pane.width - 332)),
                  y: Math.max(8, Math.min(event.clientY - pane.top, pane.height - 260)),
                });
            } else {
              setLineChoice(undefined);
              onSelectLine(ids[0] ?? edge.id);
            }
          }}
          onPaneClick={() => {
            setLineChoice(undefined);
            onClear();
          }}
        >
          {/* React Flow draws each dot at its cell's corner plus the dot's radius, half a cell
              off; this offset puts the dots on the grid's crossings, where ports and corners sit. */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={GRID}
            size={DOT_SIZE}
            offset={DOT_SIZE / 2 - GRID / 2}
            color="var(--board-dot)"
          />
        </ReactFlow>
      </BoardContext.Provider>
      {lineChoice ? (
        <div
          className="board-line-chooser"
          role="dialog"
          aria-label="Choose relationship"
          style={{ left: lineChoice.x, top: lineChoice.y }}
        >
          <strong>Choose relationship</strong>
          {lineChoice.ids.map((id) => {
            const line = drawn.lines.find((item) => item.id === id);
            return line ? (
              <button
                key={id}
                data-line-id={id}
                type="button"
                onClick={() => {
                  setLineChoice(undefined);
                  onSelectLine(id);
                }}
              >
                {line.label ?? id}
                {line.detail ? <span>{line.detail}</span> : null}
              </button>
            ) : null;
          })}
          <button type="button" onClick={() => setLineChoice(undefined)}>
            Cancel
          </button>
        </div>
      ) : null}
      {connecting ? (
        <ConnectOverlay
          drag={connecting}
          host={hostRef}
          {...(refusal !== undefined && { refusal })}
        />
      ) : null}
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

/**
 * A full-size frozen board using the live Tile and BoardLine renderers and resolved routes.
 * No engine, camera effects, selection or editing chrome participates in this surface.
 * The caller supplies its own capture theme and a rectangle including the desired margin.
 */
export function BoardSnapshotView({ snapshot, bounds }: { snapshot: BoardSnapshot; bounds: Rect }) {
  const { tiles, lines, layout } = snapshot;
  const nodes: TileNode[] = tiles.map((tile) => ({
    id: tile.id,
    type: "tile",
    position: layout.positions[tile.id] ?? { x: 0, y: 0 },
    data: {
      shape: tile.shape,
      content: tile.content,
      ...(tile.ports?.length ? { ports: tile.ports } : {}),
    },
    handles: tileHandles(tile),
    width: tile.w,
    height: tile.h,
    measured: { width: tile.w, height: tile.h },
    style: { width: tile.w, height: tile.h },
    ariaLabel: tile.label,
  }));
  return (
    <div className="board board-snapshot" style={{ width: bounds.w, height: bounds.h }}>
      <ReactFlowProvider>
        <BoardContext.Provider value={{ layout, selectLine: () => {} }}>
          <ReactFlow<TileNode, BoardLineEdge>
            nodes={nodes}
            edges={lineEdges(lines, layout)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: -bounds.x, y: -bounds.y, zoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
          />
        </BoardContext.Provider>
      </ReactFlowProvider>
    </div>
  );
}

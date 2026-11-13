// Ported from automation-illustrator src/board/firstLayoutCamera.ts and src/board/zoom.ts (0803c4a).
// The board camera: the one-time first-layout camera, Fit, and wheel zoom with finer steps than
// React Flow's default that aims at the graph when zooming in on empty paper.
//
// Changes from automation-illustrator: no compare, present or word-web cameras, and a fit never
// magnifies past 100% (`FIT_MAX_ZOOM`), so a small design does not fill the screen with tiles.
// The camera remembers whether it came from a fit or from the user: a fitted camera refits when
// the board changes size, a user's camera stays; a new tile out of view is panned in. A connect
// drag held near the board's edge pans the camera towards it (`edgePanStep`).
import type { Point, Rect, Size } from "../layout/metrics.ts";

export type Viewport = { x: number; y: number; zoom: number };
export type Pane = { width: number; height: number };

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;
/** A fit never zooms in past this. */
export const FIT_MAX_ZOOM = 1;
/** Space a fit leaves around the tiles, as a fraction of their size on each side. */
export const FIT_PADDING = 0.28;
/** One mouse-wheel notch (100 px or 3 lines) multiplies zoom by this. */
export const WHEEL_ZOOM_FACTOR = 1.08;
export const ZOOM_BOUNDS_PAD = 32;
/** The graph is an "island" when it covers less than this fraction of the pane on both axes. */
export const GRAPH_ISLAND_FRACTION = 0.4;
/** Zoom-out may go this far below fit (about four 1.08 notches) so the camera has give. */
export const ZOOM_OUT_FIT_SLACK = 0.72;

// First-layout camera ------------------------------------------------------------------------

/** True when this layout may take the one-time camera (non-empty and settled). */
export function canApplyFirstLayoutCamera(phase: string, tileCount: number): boolean {
  return phase === "ready" && tileCount > 0;
}

/** Cover the board until the first non-empty camera is applied (no pre-fit flash). */
export function boardNeedsCover(tileCount: number, cameraApplied: boolean): boolean {
  return tileCount > 0 && !cameraApplied;
}

/** A sole tile keeps the current zoom and is centred; anything more is fitted. */
export function firstLayoutCentersAtCurrentZoom(tileCount: number): boolean {
  return tileCount === 1;
}

/**
 * React Flow viewport that puts `rect`'s centre in the pane centre at `zoom`. Flow point
 * (fx, fy) maps to pane (x + fx * zoom, y + fy * zoom).
 */
export function viewportToCenterRect(pane: Pane, rect: Rect, zoom: number): Viewport {
  return {
    x: pane.width / 2 - (rect.x + rect.w / 2) * zoom,
    y: pane.height / 2 - (rect.y + rect.h / 2) * zoom,
    zoom,
  };
}

/** Fits `rect` in the pane with `padding` on each side, centred. */
export function viewportToFitRect(
  pane: Pane,
  rect: Rect,
  padding = FIT_PADDING,
  zoomMin = MIN_ZOOM,
  zoomMax = FIT_MAX_ZOOM,
): Viewport {
  const pad = Math.max(0.05, padding);
  const zoom = Math.min(
    zoomMax,
    Math.max(
      zoomMin,
      Math.min(pane.width / (rect.w * (1 + 2 * pad)), pane.height / (rect.h * (1 + 2 * pad))),
    ),
  );
  return viewportToCenterRect(pane, rect, zoom);
}

export function layoutBoundsAreUsable(bounds: Rect | undefined): bounds is Rect {
  return Boolean(bounds && bounds.w > 0 && bounds.h > 0);
}

/** Union of the placed tile boxes (not the padded ELK root). */
export function unionTileBounds(
  positions: Record<string, Point>,
  sizes: Record<string, Size>,
): Rect | undefined {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [id, p] of Object.entries(positions)) {
    const s = sizes[id];
    if (!s || s.w <= 0 || s.h <= 0) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + s.w);
    maxY = Math.max(maxY, p.y + s.h);
  }
  if (!Number.isFinite(minX)) return undefined;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Following the canvas -----------------------------------------------------------------------

/** Where the camera came from: a fit (the first layout or Fit) or the user (a pan or zoom). */
export type CameraOrigin = "fit" | "user";

/**
 * The camera's origin after a move. A move the user made (`byUser`, such as a drag, the wheel or a
 * pinch) that changed the view makes it the user's; the board's own moves keep the origin.
 */
export function cameraOriginAfterMove(
  origin: CameraOrigin,
  byUser: boolean,
  from: Viewport,
  to: Viewport,
): CameraOrigin {
  const moved =
    Math.abs(from.x - to.x) > 0.5 ||
    Math.abs(from.y - to.y) > 0.5 ||
    Math.abs(from.zoom - to.zoom) > 1e-4;
  return byUser && moved ? "user" : origin;
}

/**
 * The camera after the board changes size (a rail opens or closes): a fitted camera refits
 * `tiles` in the new pane; a camera the user set is left alone (undefined).
 */
export function viewportOnResize(
  origin: CameraOrigin,
  pane: Pane,
  tiles: Rect | undefined,
): Viewport | undefined {
  if (origin !== "fit" || !layoutBoundsAreUsable(tiles)) return undefined;
  return viewportToFitRect(pane, tiles);
}

/** Room a revealed tile keeps from the pane's edges (screen pixels), for its tabs. */
export const REVEAL_MARGIN = 48;

/**
 * The smallest pan, at the same zoom, that brings `rect` (flow coordinates) into the pane with
 * `margin` to spare; undefined when it is already in view. A tile larger than the room lines up
 * with the top or left edge.
 */
export function viewportToReveal(
  viewport: Viewport,
  pane: Pane,
  rect: Rect,
  margin = REVEAL_MARGIN,
): Viewport | undefined {
  const shift = (start: number, size: number, room: number) => {
    const lo = margin;
    const hi = room - margin;
    if (start < lo || size > hi - lo) return lo - start;
    if (start + size > hi) return hi - (start + size);
    return 0;
  };
  const dx = shift(viewport.x + rect.x * viewport.zoom, rect.w * viewport.zoom, pane.width);
  const dy = shift(viewport.y + rect.y * viewport.zoom, rect.h * viewport.zoom, pane.height);
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return undefined;
  return { x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom };
}

// Edge pan -----------------------------------------------------------------------------------

/** How near the board's edge (screen pixels) a held drag starts to pan the canvas. */
export const EDGE_PAN_ZONE = 40;
/** The edge pan's top speed (screen pixels a second), at the edge and past it. */
export const EDGE_PAN_SPEED = 480;
/** How far inside the board the edge pan stops with the tiles' far edge (screen pixels). */
export const EDGE_PAN_MARGIN = REVEAL_MARGIN;
/** The longest step one frame may take (ms), so a late frame doesn't jump. */
export const EDGE_PAN_MAX_STEP_MS = 50;

/**
 * One step of the camera while a drag is held near the board's edge: how far to move the view
 * (screen pixels, as added to the viewport's x and y) over `dt` ms. Within `zone` of an edge it
 * pans towards that edge, faster the nearer the pointer, at `speed` at the edge and past it. It
 * pans only while the tiles (`content`, on screen) reach past that edge, and never further than
 * brings their far edge `margin` inside the board; with no tiles it doesn't pan. Zero elsewhere.
 */
export function edgePanStep(
  pointer: Point,
  pane: Rect,
  dt: number,
  content: Rect | undefined,
  { zone = EDGE_PAN_ZONE, speed = EDGE_PAN_SPEED, margin = EDGE_PAN_MARGIN } = {},
): Point {
  const step = Math.max(0, Math.min(dt, EDGE_PAN_MAX_STEP_MS)) * (speed / 1000);
  const axis = (at: number, start: number, size: number, from: number, length: number) => {
    const near = at - start;
    const far = start + size - at;
    const pace = (distance: number) => Math.min(1, (zone - distance) / zone) * step;
    // Towards the start, the view moves forward until the tiles' start is `margin` inside.
    if (near < zone && near <= far) return Math.max(0, Math.min(pace(near), start + margin - from));
    // Towards the end, back until their end is `margin` inside.
    if (far < zone)
      return 0 - Math.max(0, Math.min(pace(far), from + length - (start + size - margin)));
    return 0;
  };
  if (!content) return { x: 0, y: 0 };
  return {
    x: axis(pointer.x, pane.x, pane.w, content.x, content.w),
    y: axis(pointer.y, pane.y, pane.h, content.y, content.h),
  };
}

// Wheel zoom ---------------------------------------------------------------------------------

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Lowest zoom-out when the graph can fill the pane. Huge graphs still stop at MIN_ZOOM. */
export function zoomOutFloor(fitZoom: number, slack = ZOOM_OUT_FIT_SLACK): number {
  return clampZoom(fitZoom * slack);
}

/** Zoom-out may pass fit by ZOOM_OUT_FIT_SLACK, then stops. Zoom-in is only clamped. */
export function clampWheelZoom(current: number, next: number, fitZoom: number): number {
  const capped = clampZoom(next);
  if (capped >= current) return capped;
  const floor = zoomOutFloor(fitZoom);
  if (current <= floor + 1e-6) return current;
  return Math.max(capped, floor);
}

/** Maps a wheel delta to a multiplicative zoom factor (deltaY > 0 zooms out). */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * (100 / 3) : deltaMode === 2 ? deltaY * 800 : deltaY;
  if (pixels === 0) return 1;
  return WHEEL_ZOOM_FACTOR ** (-pixels / 100);
}

export function pointInPaddedBounds(p: Point, bounds: Rect, pad = ZOOM_BOUNDS_PAD): boolean {
  return (
    p.x >= bounds.x - pad &&
    p.x <= bounds.x + bounds.w + pad &&
    p.y >= bounds.y - pad &&
    p.y <= bounds.y + bounds.h + pad
  );
}

export function graphIsIsland(
  bounds: Rect,
  zoom: number,
  pane: Pane,
  fraction = GRAPH_ISLAND_FRACTION,
): boolean {
  if (pane.width <= 0 || pane.height <= 0) return false;
  return bounds.w * zoom < pane.width * fraction && bounds.h * zoom < pane.height * fraction;
}

export function pointerOverTileOrLine(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  return Boolean(
    el.closest(".react-flow__node") || el.closest(".react-flow__edge") || el.closest(".board-chip"),
  );
}

/**
 * Zooming in on empty paper (or on a small island graph) aims at the graph's centre. Over a
 * tile or line, and for all zoom-out, the cursor stays the focal point.
 */
export function shouldZoomTowardBounds(opts: {
  zoomingIn: boolean;
  pointerOverTileOrLine: boolean;
  pointerInPaddedBounds: boolean;
  graphIsland: boolean;
}): boolean {
  if (!opts.zoomingIn) return false;
  if (opts.pointerOverTileOrLine) return false;
  return !opts.pointerInPaddedBounds || opts.graphIsland;
}

/** Pan offsets so flow point (flowX, flowY) stays under client point (clientX, clientY). */
export function viewportZoomAround(opts: {
  paneLeft: number;
  paneTop: number;
  clientX: number;
  clientY: number;
  flowX: number;
  flowY: number;
  nextZoom: number;
}): Viewport {
  return {
    x: opts.clientX - opts.paneLeft - opts.flowX * opts.nextZoom,
    y: opts.clientY - opts.paneTop - opts.flowY * opts.nextZoom,
    zoom: opts.nextZoom,
  };
}

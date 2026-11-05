// Ported from automation-illustrator src/board/firstLayoutCamera.ts and src/board/zoom.ts (0803c4a).
// The board camera: the one-time first-layout camera, Fit, and wheel zoom with finer steps than
// React Flow's default that aims at the graph when zooming in on empty paper.
//
// Changes from automation-illustrator: no compare, present or word-web cameras, and a fit never
// magnifies past 100% (`FIT_MAX_ZOOM`), so a small design does not fill the screen with tiles.
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

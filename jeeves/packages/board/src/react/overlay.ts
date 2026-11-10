// Ported from automation-illustrator src/board/controls/tileOverlay.ts and the geometry helpers of
// src/board/controls/TileChrome.tsx (0803c4a).
// Screen-space geometry for the pull and connect overlays: the live rect and corner radius of a
// tile, or of an end inside one (a scrim hole and the ribbon's exit), where the ribbon starts
// under the tile face, the ribbon itself, and where a connect drag's line leaves its tile. Holes
// use the tile's own radius (a pill's 32px), scaled by the zoom.
//
// Changes from automation-illustrator: tiles are found inside one board host; the fallback rect
// takes the tile size from the caller (there are no Step or Data kinds); horizontal only; the
// connect line's exit point; ends inside tiles.
import type { Size } from "../layout/metrics.ts";

export type TileRect = { x: number; y: number; w: number; h: number; rx: number };

/**
 * Maps a CSS corner radius onto a screen-space box (the React Flow zoom): computed styles stay
 * in layout pixels, `getBoundingClientRect` is in screen pixels.
 */
export function scaleCornerRadius(cssRx: number, layoutW: number, screenW: number): number {
  if (!(cssRx > 0)) return 0;
  if (!(layoutW > 0) || !(screenW > 0)) return cssRx;
  return cssRx * (screenW / layoutW);
}

/** The tile frame of `id` inside `host`, in screen pixels, or null when it is not drawn. */
export function tileScreenRect(host: HTMLElement | null, id: string): TileRect | null {
  const el = host?.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"] .board-tile`);
  if (!(el instanceof HTMLElement)) return null;
  const b = el.getBoundingClientRect();
  const cssRx = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  const rx = scaleCornerRadius(Number.isFinite(cssRx) ? cssRx : 14, el.offsetWidth, b.width);
  return { x: b.left, y: b.top, w: b.width, h: b.height, rx };
}

/**
 * The end `id` inside a tile of `host` (an element marked `data-board-end`), or with `handle` its
 * handle (`data-board-end-handle`), in screen pixels, or null when it is not drawn. Its radius is
 * its own corner's, scaled by the zoom.
 */
export function endScreenRect(
  host: HTMLElement | null,
  id: string,
  handle = false,
): TileRect | null {
  const end = `.react-flow__node [data-board-end="${CSS.escape(id)}"]`;
  const el = host?.querySelector(handle ? `${end} [data-board-end-handle]` : end);
  if (!(el instanceof HTMLElement)) return null;
  const b = el.getBoundingClientRect();
  const cssRx = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  const rx = scaleCornerRadius(Number.isFinite(cssRx) ? cssRx : 0, el.offsetWidth, b.width);
  return { x: b.left, y: b.top, w: b.width, h: b.height, rx };
}

/** Room around a target's hole in the scrim, for its outline. */
export const TARGET_PAD = 14;

/** A scrim hole around a tile's screen rect, `pad` wider on every side, with its radius. */
export function holeRect(tile: TileRect, pad: number) {
  return {
    x: tile.x - pad,
    y: tile.y - pad,
    width: tile.w + pad * 2,
    height: tile.h + pad * 2,
    rx: tile.rx + pad,
  };
}

/**
 * Where a straight line from the middle of `rect` towards `to` crosses the rect's edge (`to`
 * itself while it is inside the rect).
 */
export function rectExit(
  rect: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = to.x - cx;
  const dy = to.y - cy;
  const t = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : rect.w / 2 / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : rect.h / 2 / Math.abs(dy),
  );
  return t >= 1 ? { x: to.x, y: to.y } : { x: cx + dx * t, y: cy + dy * t };
}

/** Last-resort rect when the tile is not drawn: the tile's size beside the resting tab. */
export function fallbackTileRect(rest: { right: number; top: number }, size: Size): TileRect {
  return { x: rest.right - size.w, y: rest.top - 8, w: size.w, h: size.h, rx: 14 };
}

/** Where the ribbon starts: under the tile face, near the pulled side, level with the tab. */
export function underTileOrigin(
  tile: TileRect,
  restY: number,
  before: boolean,
): { x: number; y: number } {
  return {
    x: before ? tile.x + 22 : tile.x + tile.w - 22,
    y: Math.min(Math.max(restY, tile.y + tile.rx + 8), tile.y + tile.h - tile.rx - 8),
  };
}

/** Outside pad so about 3px of the outline stays after antialiasing (as tile and tab borders). */
export const RIBBON_BORDER = 5;

export type Ribbon = { fill: string; outline: string };

/**
 * The rubber band: a capsule from an origin under the tile face to the pointer, thick at the
 * tile and thinning as it stretches, bowed a little to one side (round caps, no tile-edge cut).
 */
export function taffyRibbon(x0: number, y0: number, x1: number, y1: number): Ribbon {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const r0 = 16;
  const r1 = Math.max(10, 18 - len * 0.04);
  const bulge = Math.min(22, len * 0.18);
  const mx = (x0 + x1) / 2 + px * bulge;
  const my = (y0 + y1) / 2 + py * bulge;
  const capsule = (pad: number) => {
    const a = r0 + pad;
    const b = r1 + pad;
    const a0x = x0 + px * a;
    const a0y = y0 + py * a;
    const b0x = x0 - px * a;
    const b0y = y0 - py * a;
    const a1x = x1 + px * b;
    const a1y = y1 + py * b;
    const b1x = x1 - px * b;
    const b1y = y1 - py * b;
    const topC = `${mx + px * a} ${my + py * a}`;
    const botC = `${mx - px * a} ${my - py * a}`;
    return `M ${a0x} ${a0y} Q ${topC} ${a1x} ${a1y} A ${b} ${b} 0 0 1 ${b1x} ${b1y} Q ${botC} ${b0x} ${b0y} A ${a} ${a} 0 0 1 ${a0x} ${a0y} Z`;
  };
  return { fill: capsule(0), outline: capsule(RIBBON_BORDER) };
}

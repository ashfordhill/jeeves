/** Bounded PNG capture policy. Layout is supplied by the live board, never recomputed. */
import type { BoardSnapshot, Rect } from "@jeeves/board";

export const CAPTURE_SCALE = 2;
export const CAPTURE_MARGIN = 32;
export const CAPTURE_BACKGROUND = "#e8f4fa";
export const CAPTURE_MAX_SIDE = 16_384;
export const CAPTURE_MAX_PIXELS = 40_000_000;

export function captureBounds(snapshot: BoardSnapshot): Rect {
  const points: { x: number; y: number }[] = [];
  const rect = ({ x, y, w, h }: Rect) => {
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0)
      throw new Error("The diagram contains invalid bounds; PNG export was stopped.");
    points.push({ x, y }, { x: x + w, y: y + h });
  };
  if (!snapshot.tiles.length) throw new Error("There are no tiles to export.");
  for (const tile of snapshot.tiles) {
    const at = snapshot.layout.positions[tile.id];
    if (!at) throw new Error(`The layout is missing tile ${tile.label}; PNG export was stopped.`);
    rect({ ...at, w: tile.w, h: tile.h });
  }
  for (const line of snapshot.lines) {
    const route = snapshot.layout.routes[line.id];
    if (
      !route ||
      route.length < 2 ||
      !snapshot.layout.positions[line.source] ||
      !snapshot.layout.positions[line.target] ||
      route.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
    )
      throw new Error(`The layout is missing a complete route for ${line.label ?? line.id}.`);
    points.push(...route);
    if (line.chip) {
      const chip = snapshot.layout.chips[line.id];
      if (!chip) throw new Error(`The layout is missing a label for ${line.label ?? line.id}.`);
      rect(chip);
    }
  }
  const x = Math.floor(Math.min(...points.map((p) => p.x))) - CAPTURE_MARGIN;
  const y = Math.floor(Math.min(...points.map((p) => p.y))) - CAPTURE_MARGIN;
  const w = Math.ceil(Math.max(...points.map((p) => p.x))) + CAPTURE_MARGIN - x;
  const h = Math.ceil(Math.max(...points.map((p) => p.y))) + CAPTURE_MARGIN - y;
  if (
    w * CAPTURE_SCALE > CAPTURE_MAX_SIDE ||
    h * CAPTURE_SCALE > CAPTURE_MAX_SIDE ||
    w * h * CAPTURE_SCALE ** 2 > CAPTURE_MAX_PIXELS
  )
    throw new Error(
      "This diagram is too large for PNG export (40 megapixels or 16,384 pixels per side). Export was stopped to avoid clipping or unreadable scaling.",
    );
  return { x, y, w, h };
}

/** Capture-source hashing uses sorted object keys, array order, JSON values and UTF-8. */
export function captureJson(value: unknown): string {
  return JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}

export async function sha256(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

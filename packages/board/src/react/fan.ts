// Ported from automation-illustrator src/board/controls/plusPreviewLayout.ts (0803c4a).
// Screen-space placement of the fan a pulled tab opens: N items on a short arc around the tab's
// resting place, fanning right from an "after" tab and left from a "before" tab.
//
// Changes from automation-illustrator: N items instead of the fixed Step and Data pair, and
// horizontal only. Two items keep automation-illustrator's arc (radius 104, 56°); every item
// beyond two adds 24px of radius and the spread widens with the count, up to 150°.
import type { Point } from "../layout/metrics.ts";

export const FAN_RADIUS = 104;
/** Extra radius for every item beyond two, so neighbours keep their distance. */
export const FAN_RADIUS_STEP = 24;
/** The spread between two neighbours' angles (automation-illustrator's two-item spread). */
export const FAN_ITEM_SPREAD = 56;
export const FAN_MAX_SPREAD = 150;

/** Centres of `count` items, first at the top, around the rest point (restX, restY). */
export function fanCenters(restX: number, restY: number, count: number, before = false): Point[] {
  const dir = before ? -1 : 1;
  const radius = FAN_RADIUS + FAN_RADIUS_STEP * Math.max(0, count - 2);
  const spread = Math.min(FAN_MAX_SPREAD, FAN_ITEM_SPREAD * Math.max(0, count - 1));
  const out: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = count === 1 ? 0 : -spread / 2 + (i * spread) / (count - 1);
    const rad = (angle * Math.PI) / 180;
    out.push({ x: restX + dir * Math.cos(rad) * radius, y: restY + Math.sin(rad) * radius });
  }
  return out;
}

import { describe, expect, it } from "vitest";
import {
  FAN_EDGE_MARGIN,
  FAN_ITEM_SIZE,
  FAN_MAX_SPREAD,
  FAN_RADIUS,
  fanCenters,
  placeFan,
} from "./fan.ts";

const angle = (p: { x: number; y: number }, dir = 1) =>
  (Math.atan2(p.y, dir * p.x) * 180) / Math.PI;

describe("fanCenters", () => {
  it("keeps automation-illustrator's two-item arc and widens for more items", () => {
    // Two items: radius 104, 56° apart, fanning right of an "after" tab.
    const two = fanCenters(0, 0, 2);
    expect(two.map((p) => Math.round(Math.hypot(p.x, p.y)))).toEqual([FAN_RADIUS, FAN_RADIUS]);
    expect(two.map((p) => Math.round(angle(p)))).toEqual([-28, 28]);
    // Seven items: 24px more radius per item beyond two, spread capped at 150°, top to bottom.
    const seven = fanCenters(0, 0, 7);
    expect(Math.round(Math.hypot(seven[0]?.x ?? 0, seven[0]?.y ?? 0))).toBe(FAN_RADIUS + 5 * 24);
    expect(Math.round(angle(seven[0] ?? { x: 0, y: 0 }))).toBe(-FAN_MAX_SPREAD / 2);
    expect(Math.round(angle(seven[6] ?? { x: 0, y: 0 }))).toBe(FAN_MAX_SPREAD / 2);
    // A "before" tab fans left.
    expect(fanCenters(0, 0, 3, true).every((p) => p.x < 0)).toBe(true);
  });
});

describe("placeFan", () => {
  it("keeps items on the board without stacking them and nudges one off a drop target", () => {
    const board = { x: 0, y: 0, w: 400, h: 600 };
    const room = FAN_EDGE_MARGIN + FAN_ITEM_SIZE / 2;
    // A six-item fan from a tab near the right edge: all inside, 16px to spare, none on another.
    const placed = placeFan(fanCenters(380, 300, 6), board);
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(room);
      expect(p.x).toBeLessThanOrEqual(400 - room);
      expect(p.y).toBeGreaterThanOrEqual(room);
      expect(p.y).toBeLessThanOrEqual(600 - room);
    }
    for (const [i, p] of placed.entries())
      for (const q of placed.slice(i + 1))
        expect(Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y))).toBeGreaterThanOrEqual(
          FAN_ITEM_SIZE,
        );
    // An item on top of a drop target moves the shortest way off it (here up), clear of it.
    const target = { x: 100, y: 100, w: 100, h: 100 };
    expect(placeFan([{ x: 150, y: 120 }], board, [target])).toEqual([
      { x: 150, y: 100 - 6 - FAN_ITEM_SIZE / 2 },
    ]);
  });
});

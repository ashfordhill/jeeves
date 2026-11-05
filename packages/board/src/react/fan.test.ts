import { describe, expect, it } from "vitest";
import { FAN_MAX_SPREAD, FAN_RADIUS, fanCenters } from "./fan.ts";

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

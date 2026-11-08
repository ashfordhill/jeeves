import { describe, expect, it } from "vitest";
import { directionArrow } from "./directionArrow.ts";

describe("direction arrow", () => {
  it.each([
    [
      [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
      ],
      "M 18 7 L 32 0 L 18 -7",
    ],
    [
      [
        { x: 32, y: 0 },
        { x: 0, y: 0 },
      ],
      "M 14 -7 L 0 0 L 14 7",
    ],
    // A return can wrap above a store and enter its top, or below and enter its bottom.
    [
      [
        { x: 0, y: 0 },
        { x: 0, y: 32 },
      ],
      "M -7 18 L 0 32 L 7 18",
    ],
    [
      [
        { x: 0, y: 32 },
        { x: 0, y: 0 },
      ],
      "M 7 14 L 0 0 L -7 14",
    ],
  ] as const)("follows the last segment to its target: %j", (points, expected) => {
    expect(directionArrow(points)).toBe(expected);
    expect(directionArrow([...points, points[1]])).toBe(expected);
  });

  it("fits short animated segments and skips routes with no direction", () => {
    expect(
      directionArrow([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
    ).toBe("M 0 2 L 4 0 L 0 -2");
    expect(directionArrow([])).toBeUndefined();
    expect(
      directionArrow([
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toBeUndefined();
  });
});

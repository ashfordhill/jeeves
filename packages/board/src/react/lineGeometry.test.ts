import { describe, expect, it } from "vitest";
import { crossingBridges, nearestLines } from "./lineGeometry.ts";

describe("route identity at overlaps", () => {
  const routes = {
    reads: [
      { x: 0, y: 0 },
      { x: 32, y: 0 },
      { x: 32, y: -96 },
      { x: 96, y: -96 },
    ],
    writes: [
      { x: 0, y: 0 },
      { x: 64, y: 0 },
      { x: 64, y: -64 },
      { x: 96, y: -64 },
    ],
  };
  it("offers both IDs on a shared stem and the nearest route inside overlapping hit bands", () => {
    expect(nearestLines({ x: 16, y: 0 }, routes, 3, 22)).toEqual(["reads", "writes"]);
    expect(nearestLines({ x: 40, y: -40 }, routes, 3, 22)).toEqual(["reads"]);
    expect(nearestLines({ x: 48, y: -40 }, routes, 3, 22)).toEqual(["reads", "writes"]);
    expect(nearestLines({ x: 300, y: 300 }, routes, 3, 22)).toEqual([]);
  });
  it("cuts a visual gap at a crossing, preserving shared stems and real port junctions", () => {
    const horizontal = [
      { x: 0, y: 0 },
      { x: 96, y: 0 },
    ];
    const vertical = [
      { x: 48, y: -32 },
      { x: 48, y: 32 },
    ];
    expect(crossingBridges(horizontal, [vertical])).toEqual([
      [
        { x: 41, y: 0 },
        { x: 55, y: 0 },
      ],
    ]);
    expect(crossingBridges(routes.reads, [routes.writes])).toEqual([]);
    expect(
      crossingBridges(horizontal, [
        [
          { x: 0, y: -32 },
          { x: 0, y: 0 },
        ],
      ]),
    ).toEqual([]);
  });
});

import type { BoardSnapshot } from "@jeeves/board";
import { describe, expect, it } from "vitest";
import { captureBounds, captureJson } from "./diagramCapture.ts";

const snapshot = (): BoardSnapshot => ({
  tiles: [
    { id: "a", label: "A", w: 128, h: 128, shape: "rect", content: null },
    { id: "b", label: "B", w: 128, h: 128, shape: "pill", content: null },
  ],
  lines: [{ id: "ab", source: "a", target: "b", dashed: false }],
  layout: {
    key: "resolved",
    positions: { a: { x: 0, y: 0 }, b: { x: 256, y: 0 } },
    routes: {
      ab: [
        { x: 128, y: 64 },
        { x: 128, y: -200 },
        { x: 256, y: -200 },
        { x: 256, y: 64 },
      ],
    },
    chips: {},
    bounds: { x: 0, y: 0, w: 384, h: 128 },
  },
});

describe("diagram capture bounds", () => {
  it("includes off-tile route extents, chips and margin without trusting root bounds", () => {
    const input = snapshot();
    input.lines = input.lines.map((line) => ({ ...line, chip: { w: 32, h: 32, content: null } }));
    input.layout.chips.ab = { x: -100, y: 0, w: 32, h: 32 };
    expect(captureBounds(input)).toEqual({ x: -132, y: -232, w: 548, h: 392 });
  });
  it("refuses missing or nonfinite routes and missing label geometry", () => {
    const input = snapshot();
    input.layout.routes.ab = [{ x: 128, y: 64 }];
    expect(() => captureBounds(input)).toThrow("complete route");
    input.layout.routes.ab = [
      { x: 128, y: 64 },
      { x: Infinity, y: 64 },
    ];
    expect(() => captureBounds(input)).toThrow("complete route");
    input.layout.routes = snapshot().layout.routes;
    input.lines = input.lines.map((line) => ({ ...line, chip: { w: 32, h: 32, content: null } }));
    expect(() => captureBounds(input)).toThrow("missing a label");
  });
  it("refuses oversized images instead of scaling or clipping", () => {
    const input = snapshot();
    input.layout.positions.b = { x: 10_000, y: 0 };
    expect(() => captureBounds(input)).toThrow("too large");
    input.layout.positions.b = { x: 4000, y: 4000 };
    expect(() => captureBounds(input)).toThrow("too large");
  });
  it("hash serialization ignores object-key order while preserving arrays and revision", () => {
    expect(captureJson({ revision: 1, nested: { b: 2, a: [3, 4] } })).toBe(
      captureJson({ nested: { a: [3, 4], b: 2 }, revision: 1 }),
    );
    expect(captureJson({ a: [3, 4] })).not.toBe(captureJson({ a: [4, 3] }));
  });
});

import { expect, it } from "vitest";
import { graphKey, type LayoutInput } from "./elkGraph.ts";
import type { BoardLayout } from "./elkLayout.ts";
import { laneShifts } from "./lanes.ts";

it("keeps a single line centred at both ports without changing its input or layout", () => {
  const input: LayoutInput = {
    tiles: [
      { id: "a", w: 128, h: 128 },
      { id: "b", w: 128, h: 128 },
    ],
    lines: [{ id: "ab", source: "a", target: "b" }],
  };
  const layout: BoardLayout = {
    key: "single",
    positions: { a: { x: 0, y: 0 }, b: { x: 256, y: 0 } },
    routes: {
      ab: [
        { x: 128, y: 64 },
        { x: 256, y: 64 },
      ],
    },
    chips: {},
    bounds: { x: 0, y: 0, w: 384, h: 128 },
  };
  const before = structuredClone({ input, layout });
  expect(laneShifts(input, layout)).toEqual(new Map([["ab", { source: 0, target: 0 }]]));
  expect({ input, layout }).toEqual(before);
});

it("orders a source's lanes by the routes' upward, level and downward turns", () => {
  const input: LayoutInput = {
    tiles: [
      { id: "a", w: 128, h: 128 },
      { id: "up", w: 128, h: 128 },
      { id: "level", w: 128, h: 128 },
      { id: "down", w: 128, h: 128 },
    ],
    lines: [
      { id: "down", source: "a", target: "down" },
      { id: "up", source: "a", target: "up" },
      { id: "level", source: "a", target: "level" },
    ],
  };
  const layout: BoardLayout = {
    key: "source-order",
    positions: {
      a: { x: 0, y: 128 },
      up: { x: 320, y: 0 },
      level: { x: 320, y: 128 },
      down: { x: 320, y: 256 },
    },
    routes: {
      down: [
        { x: 128, y: 192 },
        { x: 224, y: 192 },
        { x: 224, y: 320 },
        { x: 320, y: 320 },
      ],
      up: [
        { x: 128, y: 192 },
        { x: 192, y: 192 },
        { x: 192, y: 64 },
        { x: 320, y: 64 },
      ],
      level: [
        { x: 128, y: 192 },
        { x: 320, y: 192 },
      ],
    },
    chips: {},
    bounds: { x: 0, y: 0, w: 448, h: 384 },
  };
  const shifts = laneShifts(input, layout);
  expect(shifts.get("up")?.source).toBe(-10);
  expect(shifts.get("level")?.source).toBe(0);
  expect(shifts.get("down")?.source).toBe(10);
});

it("spaces incoming lanes 22px at a default port and 16px at a named port", () => {
  const input: LayoutInput = {
    tiles: [
      { id: "above", w: 128, h: 128 },
      { id: "below", w: 128, h: 128 },
      { id: "target", w: 128, h: 128 },
    ],
    lines: [
      { id: "below", source: "below", target: "target" },
      { id: "above", source: "above", target: "target" },
    ],
  };
  const layout: BoardLayout = {
    key: "entry-pitch",
    positions: {
      above: { x: 0, y: 0 },
      below: { x: 0, y: 128 },
      target: { x: 320, y: 64 },
    },
    routes: {
      above: [
        { x: 128, y: 64 },
        { x: 192, y: 64 },
        { x: 192, y: 128 },
        { x: 320, y: 128 },
      ],
      below: [
        { x: 128, y: 192 },
        { x: 224, y: 192 },
        { x: 224, y: 128 },
        { x: 320, y: 128 },
      ],
    },
    chips: {},
    bounds: { x: 0, y: 0, w: 448, h: 256 },
  };
  const defaults = laneShifts(input, layout);
  expect(defaults.get("above")?.target).toBe(-11);
  expect(defaults.get("below")?.target).toBe(11);

  const named: LayoutInput = {
    tiles: input.tiles.map((tile) =>
      tile.id === "target" ? { ...tile, ports: [{ id: "row", side: "in", y: 64 }] } : tile,
    ),
    lines: input.lines.map((line) => ({ ...line, targetPort: "row" })),
  };
  const rows = laneShifts(named, layout);
  expect(rows.get("above")?.target).toBe(-8);
  expect(rows.get("below")?.target).toBe(8);
});

it("separates neighbouring source ports while keeping whole-pixel lanes 10px apart", () => {
  const input: LayoutInput = {
    tiles: [
      {
        id: "a",
        w: 256,
        h: 192,
        ports: [
          { id: "upper", side: "out", y: 64 },
          { id: "lower", side: "out", y: 96 },
        ],
      },
      { id: "b", w: 128, h: 128 },
    ],
    lines: [
      { id: "u0", source: "a", sourcePort: "upper", target: "b" },
      { id: "u1", source: "a", sourcePort: "upper", target: "b" },
      { id: "l0", source: "a", sourcePort: "lower", target: "b" },
      { id: "l1", source: "a", sourcePort: "lower", target: "b" },
      { id: "l2", source: "a", sourcePort: "lower", target: "b" },
      { id: "l3", source: "a", sourcePort: "lower", target: "b" },
      { id: "l4", source: "a", sourcePort: "lower", target: "b" },
    ],
  };
  const layout: BoardLayout = {
    key: "neighbouring-ports",
    positions: { a: { x: 0, y: 0 }, b: { x: 512, y: 0 } },
    routes: {
      u0: [
        { x: 256, y: 64 },
        { x: 512, y: 64 },
      ],
      u1: [
        { x: 256, y: 64 },
        { x: 512, y: 64 },
      ],
      l0: [
        { x: 256, y: 96 },
        { x: 352, y: 96 },
        { x: 352, y: 64 },
        { x: 512, y: 64 },
      ],
      l1: [
        { x: 256, y: 96 },
        { x: 352, y: 96 },
        { x: 352, y: 64 },
        { x: 512, y: 64 },
      ],
      l2: [
        { x: 256, y: 96 },
        { x: 352, y: 96 },
        { x: 352, y: 64 },
        { x: 512, y: 64 },
      ],
      l3: [
        { x: 256, y: 96 },
        { x: 352, y: 96 },
        { x: 352, y: 64 },
        { x: 512, y: 64 },
      ],
      l4: [
        { x: 256, y: 96 },
        { x: 352, y: 96 },
        { x: 352, y: 64 },
        { x: 512, y: 64 },
      ],
    },
    chips: {},
    bounds: { x: 0, y: 0, w: 640, h: 192 },
  };
  const shifts = laneShifts(input, layout);
  const upper = ["u0", "u1"].map((id) => 64 + (shifts.get(id)?.source ?? Number.NaN));
  const lower = ["l0", "l1", "l2", "l3", "l4"].map(
    (id) => 96 + (shifts.get(id)?.source ?? Number.NaN),
  );
  const all = [...upper, ...lower].sort((a, b) => a - b);
  expect(all).toHaveLength(7);
  expect(all.every(Number.isInteger)).toBe(true);
  for (const group of [upper, lower]) {
    for (let i = 1; i < group.length; i++) {
      expect((group[i] as number) - (group[i - 1] as number)).toBe(10);
    }
  }
  for (let i = 1; i < all.length; i++) {
    expect((all[i] as number) - (all[i - 1] as number)).toBeGreaterThanOrEqual(10);
  }
});

it("keeps seven incoming lanes within a 128px tile", () => {
  const input: LayoutInput = {
    tiles: [
      { id: "a", w: 128, h: 128 },
      { id: "b", w: 128, h: 128 },
    ],
    lines: Array.from({ length: 7 }, (_, i) => ({ id: `line${i}`, source: "a", target: "b" })),
  };
  const layout: BoardLayout = {
    key: "tile-bounds",
    positions: { a: { x: 0, y: 0 }, b: { x: 256, y: 0 } },
    routes: {
      line0: [
        { x: 128, y: 64 },
        { x: 256, y: 64 },
      ],
      line1: [
        { x: 128, y: 64 },
        { x: 256, y: 64 },
      ],
      line2: [
        { x: 128, y: 64 },
        { x: 256, y: 64 },
      ],
      line3: [
        { x: 128, y: 64 },
        { x: 256, y: 64 },
      ],
      line4: [
        { x: 128, y: 64 },
        { x: 256, y: 64 },
      ],
      line5: [
        { x: 128, y: 64 },
        { x: 256, y: 64 },
      ],
      line6: [
        { x: 128, y: 64 },
        { x: 256, y: 64 },
      ],
    },
    chips: {},
    bounds: { x: 0, y: 0, w: 384, h: 128 },
  };
  const shifts = laneShifts(input, layout);
  expect(shifts.size).toBe(7);
  for (const line of input.lines) {
    const y = 64 + (shifts.get(line.id)?.target ?? Number.NaN);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(128);
  }
});

it("marks lane-enabled graph keys while preserving the exact default key", () => {
  const input: LayoutInput = { tiles: [{ id: "a", w: 128, h: 128 }], lines: [] };
  expect(graphKey(input)).toBe(JSON.stringify([[["a", 128, 128, null]], []]));
  expect(graphKey({ ...input, lanes: true })).not.toBe(graphKey(input));
});

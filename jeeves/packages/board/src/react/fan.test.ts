import { describe, expect, it } from "vitest";
import type { Point } from "../layout/metrics.ts";
import {
  FAN_CAPTION_H,
  FAN_CELL,
  FAN_CELL_DETAIL,
  FAN_EDGE_MARGIN,
  FAN_GRID_OFFSET,
  FAN_ITEM_SIZE,
  FAN_MAX_SPREAD,
  FAN_RADIUS,
  fanCenters,
  fanGrid,
  gridBounds,
  placeFan,
  placeGrid,
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
  it("keeps items on the board without stacking them", () => {
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
  });
});

describe("fanGrid", () => {
  // Eleven items in four groups: rows of 4, 4, 1 and 2.
  const groups = ["a", "a", "a", "a", "d", "d", "d", "d", "m", "e", "e"];

  const nth = (list: readonly Point[], i: number) => list[i] as Point;

  it("puts each group in a row beside the tab, items left to right, centred on its height", () => {
    const cells = fanGrid(0, 0, groups);
    const rows = [...new Set(cells.map((p) => p.y))];
    expect(rows).toHaveLength(4);
    // Rows a cell apart, centred on the tab (each item sits above its caption).
    expect(rows.map((y) => y - (rows[0] ?? 0))).toEqual([0, 1, 2, 3].map((i) => i * FAN_CELL.h));
    expect(((rows[0] ?? 0) + (rows[3] ?? 0)) / 2 + FAN_CAPTION_H / 2).toBeCloseTo(0);
    // Each row starts in the first column, right of an "after" tab.
    const first = FAN_GRID_OFFSET + FAN_CELL.w / 2;
    expect(cells.map((p) => (p.x - first) / FAN_CELL.w)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0, 0, 1]);
    // An item's column is its place in its group, whatever comes after it.
    expect(fanGrid(0, 0, groups.slice(0, 9)).map((p) => p.x)).toEqual(
      cells.slice(0, 9).map((p) => p.x),
    );
    // A "before" tab's grid ends left of it, still read left to right.
    const left = fanGrid(0, 0, groups, true);
    expect(Math.max(...left.map((p) => p.x)) + FAN_CELL.w / 2).toBe(-FAN_GRID_OFFSET);
    expect(nth(left, 1).x - nth(left, 0).x).toBe(FAN_CELL.w);
  });

  it("stays on the board as one block", () => {
    const board = { x: 0, y: 0, w: 900, h: 700 };
    const near = fanGrid(860, 30, groups);
    const placed = placeGrid(near, board);
    // Moved together: every offset between two items is kept.
    const dx = nth(placed, 0).x - nth(near, 0).x;
    const dy = nth(placed, 0).y - nth(near, 0).y;
    for (const [i, p] of placed.entries()) {
      expect(p.x - nth(near, i).x).toBeCloseTo(dx);
      expect(p.y - nth(near, i).y).toBeCloseTo(dy);
    }
    // Every cell inside the board's 16px margin.
    for (const p of placed) {
      expect(p.x - FAN_CELL.w / 2).toBeGreaterThanOrEqual(FAN_EDGE_MARGIN);
      expect(p.x + FAN_CELL.w / 2).toBeLessThanOrEqual(900 - FAN_EDGE_MARGIN);
      expect(p.y + FAN_CAPTION_H / 2 - FAN_CELL.h / 2).toBeGreaterThanOrEqual(FAN_EDGE_MARGIN);
      expect(p.y + FAN_CAPTION_H / 2 + FAN_CELL.h / 2).toBeLessThanOrEqual(700 - FAN_EDGE_MARGIN);
    }
    // A grid with room stays where it is.
    const middle = fanGrid(300, 350, groups);
    expect(placeGrid(middle, board)).toEqual(middle);
  });

  it("wraps a long group after `columns`, in cells sized for a detail line", () => {
    // Four, five and seven items in rows of at most five: rows of 4, 5, 5 and 2.
    const long = [...Array(4).fill("lead"), ...Array(5).fill("part"), ...Array(7).fill("stub")];
    const layout = { cell: FAN_CELL_DETAIL, columns: 5 };
    const cells = fanGrid(0, 0, long, true, layout);
    const rows = [...new Set(cells.map((p) => p.y))];
    expect(rows.map((y) => y - (rows[0] ?? 0))).toEqual([0, 1, 2, 3].map((i) => i * 108));
    const first = -FAN_GRID_OFFSET - 5 * FAN_CELL_DETAIL.w + FAN_CELL_DETAIL.w / 2;
    expect(cells.map((p) => (p.x - first) / FAN_CELL_DETAIL.w)).toEqual([
      0, 1, 2, 3, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1,
    ]);
    // Centred on the tab, captions included; the panel is the cells' box.
    const box = gridBounds(cells, FAN_CELL_DETAIL);
    expect(box).toEqual({ x: -FAN_GRID_OFFSET - 600, y: -216, w: 600, h: 432 });
    // Kept on a board as one block, measured with the same cells.
    const placed = placeGrid(cells, { x: -700, y: -200, w: 800, h: 500 }, FAN_CELL_DETAIL);
    const moved = gridBounds(placed, FAN_CELL_DETAIL);
    expect(moved.y).toBe(-200 + FAN_EDGE_MARGIN);
    expect(moved.x).toBe(box.x);
    // Without a limit a group stays on one row, as before.
    expect(new Set(fanGrid(0, 0, long).map((p) => p.y)).size).toBe(3);
  });
});

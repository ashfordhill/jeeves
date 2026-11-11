import { describe, expect, it } from "vitest";
import type { Point } from "../layout/metrics.ts";
import {
  FAN_CAPTION_H,
  FAN_CELL,
  FAN_EDGE_MARGIN,
  FAN_GRID_OFFSET,
  FAN_ITEM_SIZE,
  FAN_MAX_SPREAD,
  FAN_RADIUS,
  FAN_TILE_GAP,
  fanCenters,
  fanGrid,
  gridBounds,
  placeBeside,
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
    // Every item is right of the tab.
    expect(seven.every((p) => p.x > 0)).toBe(true);
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
    // Each row starts in the first column, right of the tab.
    const first = FAN_GRID_OFFSET + FAN_CELL.w / 2;
    expect(cells.map((p) => (p.x - first) / FAN_CELL.w)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0, 0, 1]);
    // An item's column is its place in its group, whatever comes after it.
    expect(fanGrid(0, 0, groups.slice(0, 9)).map((p) => p.x)).toEqual(
      cells.slice(0, 9).map((p) => p.x),
    );
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

  it("goes beside its own tile, not over it, where the board is too narrow beside the tab", () => {
    // A 128px tile whose tab rests on its right edge, 212px from the board's right edge: the
    // grid (four columns, 416px) can't sit right of the tab.
    const tile = { x: 500, y: 300, w: 128, h: 128 };
    const rest = { x: 626, y: 364 };
    const cells = fanGrid(rest.x, rest.y, groups);
    const box = gridBounds(cells);
    const covers = (placed: readonly Point[]) => {
      const b = gridBounds(placed);
      return (
        b.x < tile.x + tile.w && b.x + b.w > tile.x && b.y < tile.y + tile.h && b.y + b.h > tile.y
      );
    };
    // Kept on the board only, it would slide back over the tile.
    const narrow = { x: 0, y: 0, w: 840, h: 900 };
    expect(covers(placeGrid(cells, narrow))).toBe(true);
    // With the tile to avoid: on its left, at the tab's height, as one block.
    const left = placeGrid(cells, narrow, tile);
    expect(covers(left)).toBe(false);
    const moved = gridBounds(left);
    expect(moved.x + moved.w).toBe(tile.x - FAN_TILE_GAP);
    expect(moved.y).toBe(box.y);
    expect(nth(left, 1).x - nth(left, 0).x).toBe(FAN_CELL.w);
    // No room on either side: below the tile, centred on it, kept inside the board.
    const tight = { x: 200, y: 0, w: 560, h: 900 };
    const below = gridBounds(placeGrid(cells, tight, tile));
    expect(below.y).toBe(tile.y + tile.h + FAN_TILE_GAP);
    expect(below.x).toBe(tight.x + tight.w - FAN_EDGE_MARGIN - box.w);
    // A tile low on the board: above it instead.
    const low = { ...tile, y: 600 };
    const above = gridBounds(placeGrid(fanGrid(rest.x, 664, groups), tight, low));
    expect(above.y + above.h).toBe(low.y - FAN_TILE_GAP);
    // No side has room (a tile in the middle of a board too small for the grid on any side): the
    // grid still keeps off the tile, its panel included, on the side that covers least.
    const middle = { x: 445, y: 290, w: 128, h: 128 };
    const small = { x: 0, y: 0, w: 650, h: 708 };
    const squeezed = gridBounds(placeGrid(fanGrid(571, 354, groups), small, middle));
    expect(squeezed.x + squeezed.w).toBeLessThanOrEqual(middle.x - 8);
    expect(squeezed.x).toBe(FAN_EDGE_MARGIN);
    // Room beside the tab: where it was.
    expect(placeGrid(cells, { x: 0, y: 0, w: 1400, h: 900 }, tile)).toEqual(cells);
  });
});

describe("placeBeside", () => {
  it("takes the first side with room, else the one that covers least", () => {
    const board = { x: 0, y: 0, w: 1000, h: 800 };
    const avoid = { x: 400, y: 300, w: 200, h: 100 };
    const size = { w: 300, h: 200 };
    // Right, centred on the tile's middle.
    expect(placeBeside(size, avoid, board)).toEqual({ x: 628, y: 250 });
    // Below first, centred on a given point, slid inside the board.
    expect(
      placeBeside(size, avoid, board, { sides: ["below"], gap: 8, align: { x: 950, y: 0 } }),
    ).toEqual({ x: 1000 - FAN_EDGE_MARGIN - 300, y: 408 });
    // Left of a tile near the right edge.
    expect(placeBeside(size, { ...avoid, x: 760 }, board)).toEqual({ x: 432, y: 250 });
    // Too big for any side: inside the board, covering as little as it can.
    const big = placeBeside({ w: 900, h: 700 }, avoid, board);
    expect(big.x).toBeGreaterThanOrEqual(FAN_EDGE_MARGIN);
    expect(big.y).toBeGreaterThanOrEqual(FAN_EDGE_MARGIN);
  });
});

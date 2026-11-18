import { describe, expect, it } from "vitest";
import { assignWireSlots, wireHue, wireStep, wireTone } from "./wireColours.ts";

describe("wire colours", () => {
  it("spaces twelve hues, offsets later rounds and avoids the sky-blue sector", () => {
    expect(wireHue(0)).toBeCloseTo(28, 1);
    expect(wireHue(1)).toBeCloseTo(157.2, 1);
    expect(wireHue(12)).toBeCloseTo(wireHue(0) + 12.9, 1);
    const hues = Array.from({ length: 12 }, (_, slot) => wireHue(slot));
    for (const [index, hue] of hues.entries()) {
      for (const other of hues.slice(index + 1)) {
        const distance = Math.abs(hue - other);
        expect(Math.min(distance, 360 - distance)).toBeGreaterThanOrEqual(25.8);
      }
    }
    for (let slot = 0; slot < 36; slot++) {
      const hue = wireHue(slot);
      expect(hue > 215 && hue < 265).toBe(false);
    }
  });

  it("makes distinct light and dark hex tones and a neutral slate without a slot", () => {
    const tone = wireTone(0, 0.5);
    expect(tone.light).toMatch(/^#[0-9a-f]{6}$/);
    expect(tone.dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(tone.light).not.toBe(tone.dark);
    const slate = wireTone(undefined, 0.5).light;
    const channels = [1, 3, 5].map((start) => Number.parseInt(slate.slice(start, start + 2), 16));
    expect(Math.max(...channels) - Math.min(...channels)).toBeLessThanOrEqual(40);
  });

  it("alternates shade steps as a permutation for every line count from one to fourteen", () => {
    for (let of = 1; of <= 14; of++) {
      const ranks = Array.from({ length: of }, (_, rank) => rank);
      expect(ranks.map((rank) => wireStep(rank, of)).sort((a, b) => a - b)).toEqual(ranks);
    }
  });

  it("keeps a tile's slot for life and gives new senders the lowest free slot in order", () => {
    const tiles = new Set(["a", "b"]);
    expect(assignWireSlots({}, ["a", "b"], tiles)).toEqual({ a: 0, b: 1 });
    expect(assignWireSlots({ a: 3 }, ["a", "b"], tiles)).toEqual({ a: 3, b: 0 });
    expect(assignWireSlots({ removed: 0 }, ["a", "b"], tiles)).toEqual({ a: 0, b: 1 });
    expect(assignWireSlots({ a: 3 }, ["b"], tiles)).toEqual({ a: 3, b: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { wireArt } from "./wirePath.ts";

describe("wireArt", () => {
  it("draws a straight level route without curves and with a directed head", () => {
    const art = wireArt(
      [
        { x: 0, y: 20 },
        { x: 160, y: 20 },
      ],
      { x: 0, y: 20 },
      true,
    );
    expect(art.body).not.toMatch(/[CQ]/);
    expect(art.head).toBeDefined();
  });

  it("fans from a port 10px above its lane to 36px right of the port", () => {
    const art = wireArt(
      [
        { x: 100, y: 0 },
        { x: 300, y: 0 },
      ],
      { x: 100, y: -10 },
      true,
    );
    expect(art.body).toMatch(/^M 100 -10 C 119\.8 -10 116\.2 0 136 0(?: |$)/);
  });

  it("rounds both corners of a four-point route with exactly two quadratics", () => {
    const art = wireArt(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 80 },
        { x: 200, y: 80 },
      ],
      { x: 0, y: 0 },
      true,
    );
    expect(art.body.match(/\bQ\b/g)).toHaveLength(2);
  });

  it("runs straight in to a head on its own lane", () => {
    const art = wireArt(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 72 },
        { x: 200, y: 72 },
      ],
      { x: 0, y: 0 },
      true,
    );
    // After the last corner the body has no curve, and the head's tip is on the lane.
    expect(art.body.slice(art.body.lastIndexOf("Q"))).toMatch(/^Q 100 72 109 72 L 188\.2 72$/);
    const tip = art.head?.match(/^M ([-\d.]+) ([-\d.]+)/);
    expect(Number(tip?.[2])).toBe(72);
  });

  it("omits an undirected head and reaches the route's last x", () => {
    const art = wireArt(
      [
        { x: 0, y: 20 },
        { x: 160, y: 20 },
      ],
      { x: 0, y: 20 },
      false,
    );
    expect(art.head).toBeUndefined();
    expect(art.body).toMatch(/ L 160 20$/);
  });

  it("points a head down when the last run is upright", () => {
    const art = wireArt(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      { x: 0, y: 0 },
      true,
    );
    expect(art.head).toBeDefined();
    const vertices = [...(art.head ?? "").matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g)];
    expect(vertices).toHaveLength(3);
    const ys = vertices.map((vertex) => Number(vertex[2]));
    expect(ys[0]).toBeGreaterThan(ys[1] as number);
    expect(ys[0]).toBeGreaterThan(ys[2] as number);
  });
});

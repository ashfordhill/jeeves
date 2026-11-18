import { expect, it } from "vitest";
import { distanceToRoute } from "./lineGeometry.ts";
import { wirePolyline } from "./wireGeometry.ts";

it("keeps long straight artwork compact and follows cubic fans and quadratic corners", () => {
  const points = wirePolyline(
    "M 128 64 C 147.8 64 144.2 44 164 44 L 9000 44 Q 9009 44 9009 53 L 9009 10000",
  );
  expect(points.length).toBeLessThan(40);
  for (let i = 0; i <= 100; i++) {
    const t = i / 100,
      u = 1 - t;
    const fan = {
      x: u ** 3 * 128 + 3 * u * u * t * 147.8 + 3 * u * t * t * 144.2 + t ** 3 * 164,
      y: u ** 3 * 64 + 3 * u * u * t * 64 + 3 * u * t * t * 44 + t ** 3 * 44,
    };
    const corner = {
      x: u * u * 9000 + 2 * u * t * 9009 + t * t * 9009,
      y: u * u * 44 + 2 * u * t * 44 + t * t * 53,
    };
    expect(distanceToRoute(fan, points)).toBeLessThanOrEqual(0.25);
    expect(distanceToRoute(corner, points)).toBeLessThanOrEqual(0.25);
  }
  expect(points.at(-1)).toEqual({ x: 9009, y: 10000 });
});

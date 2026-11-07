import { expect, it } from "vitest";
import { separateBranches } from "./branches.ts";
import type { BoardLayout } from "./elkLayout.ts";

it("leaves an outer return stem inside its existing bounds when no grid slot is free", () => {
  const route = [
    { x: 64, y: 64 },
    { x: 96, y: 64 },
    { x: 96, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 128 },
    { x: 32, y: 128 },
  ];
  const layout: BoardLayout = {
    key: "outer-return",
    positions: { source: { x: 32, y: 48 }, target: { x: 32, y: 112 } },
    routes: { a: route, b: route },
    chips: {},
    bounds: { x: -32, y: -32, w: 160, h: 192 },
  };
  const before = structuredClone(layout);
  const result = separateBranches(layout, {
    tiles: [
      { id: "source", w: 32, h: 32 },
      { id: "target", w: 32, h: 32 },
    ],
    lines: [
      { id: "a", source: "source", target: "target" },
      { id: "b", source: "source", target: "target" },
    ],
  });
  expect(result).toEqual(before);
  expect(layout).toEqual(before);
});

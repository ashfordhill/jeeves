// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { EdgeProps } from "@xyflow/react";
import { Position, ReactFlowProvider } from "@xyflow/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BoardSnapshot } from "./Board.tsx";
import { BoardSnapshotView } from "./Board.tsx";
import { BoardLine, type BoardLineEdge } from "./BoardLine.tsx";
import { BoardContext } from "./context.ts";
import { wireArt } from "./wirePath.ts";

beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const route = [
  { x: 288, y: 106 },
  { x: 400, y: 106 },
  { x: 400, y: 304 },
  { x: 512, y: 304 },
];
const layout = {
  key: "anchors",
  positions: { s: { x: 32, y: 32 }, t: { x: 512, y: 256 } },
  routes: { wire: route },
  chips: {},
  bounds: { x: 0, y: 0, w: 800, h: 500 },
};
const tone = { light: "#cc5500", dark: "#ee9955" };

it("uses Board anchors even when React Flow supplies unsettled handle coordinates", () => {
  const anchors = { source: { x: 288, y: 96 }, target: { x: 512, y: 288 } };
  const props: EdgeProps<BoardLineEdge> = {
    id: "wire",
    source: "s",
    target: "t",
    type: "line",
    selected: false,
    sourceX: 900,
    sourceY: 950,
    targetX: 1000,
    targetY: 1200,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { dashed: false, directed: true, wire: tone, anchors },
    selectable: true,
    deletable: false,
  };
  const { container } = render(
    <ReactFlowProvider>
      <BoardContext value={{ layout, selectLine: () => {} }}>
        <svg aria-hidden="true">
          <BoardLine {...props} />
        </svg>
      </BoardContext>
    </ReactFlowProvider>,
  );
  const art = wireArt(route, anchors.source, true);
  expect(container.querySelector(".board-wire-fill")?.getAttribute("d")).toBe(art.body);
  expect(container.querySelector(".board-wire-head")?.getAttribute("d")).toBe(art.head);
});

for (const named of [false, true])
  it(`snapshot anchors ${named ? "module row/header" : "default"} ports on their exact frames`, () => {
    const snapshot: BoardSnapshot = {
      tiles: [
        {
          id: "s",
          w: 256,
          h: 192,
          shape: "rect",
          label: "Source",
          content: "Source",
          ...(named ? { ports: [{ id: "row", side: "out", y: 64 }] } : {}),
        },
        {
          id: "t",
          w: 128,
          h: 128,
          shape: "rect",
          label: "Target",
          content: "Target",
          ...(named ? { ports: [{ id: "header", side: "in", y: 32 }] } : {}),
        },
      ],
      lines: [
        {
          id: "wire",
          source: "s",
          target: "t",
          dashed: false,
          directed: true,
          wire: () => tone,
          ...(named ? { sourcePort: "row", targetPort: "header" } : {}),
        },
      ],
      layout,
    };
    const { container } = render(<BoardSnapshotView snapshot={snapshot} bounds={layout.bounds} />);
    const art = wireArt(route, { x: 288, y: named ? 96 : 128 }, true);
    expect(container.querySelector(".board-wire-fill")?.getAttribute("d")).toBe(art.body);
    expect(container.querySelector(".board-wire-head")?.getAttribute("d")).toBe(art.head);
  });

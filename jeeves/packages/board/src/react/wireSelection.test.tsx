// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BoardLayout } from "../layout/elkLayout.ts";
import type { LayoutEngine } from "../layout/engine.ts";
import { Board, type LineSpec } from "./Board.tsx";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: 1200, height: 800 }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

for (const action of ["click", "contextMenu"] as const) {
  it(`${action} identifies a wire on its visible fan rather than a neighbouring raw lane`, async () => {
    const layout: BoardLayout = {
      key: "fan",
      positions: { source: { x: 0, y: 0 }, target: { x: 400, y: 0 } },
      routes: {
        upper: [
          { x: 128, y: 44 },
          { x: 400, y: 44 },
        ],
        middle: [
          { x: 128, y: 64 },
          { x: 400, y: 64 },
        ],
      },
      chips: {},
      bounds: { x: 0, y: 0, w: 528, h: 128 },
    };
    const engine: LayoutEngine = {
      keyFor: () => layout.key,
      get: () => layout,
      request: async () => layout,
    };
    const lines: LineSpec[] = ["upper", "middle"].map((id) => ({
      id,
      source: "source",
      target: "target",
      dashed: false,
      directed: true,
      wire: () => ({ light: "#cc5500", dark: "#ee9955" }),
    }));
    const onSelectLine = vi.fn();
    const onLineMenu = vi.fn();
    const { container } = render(
      <Board
        tiles={["source", "target"].map((id) => ({
          id,
          w: 128,
          h: 128,
          shape: "rect",
          label: id,
          content: id,
        }))}
        lines={lines}
        engine={engine}
        selected={{ line: "middle" }}
        onSelectTile={() => {}}
        onSelectLine={onSelectLine}
        onClear={() => {}}
        onLineMenu={onLineMenu}
        mode="select"
      />,
    );
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const edge = container.querySelector('.react-flow__edge[data-id="upper"]');
    expect(edge?.querySelector(".board-wire-fill")?.getAttribute("d")).toMatch(
      /^M 128 64 C 147\.8 64 144\.2 44 164 44/,
    );
    // The pointer is on the exact emitted cubic fan, where the raw middle lane would be
    // nearer. Picking must follow the actual d, including its cubic controls.
    const upperFan = (t: number) => ({
      x:
        (1 - t) ** 3 * 128 +
        3 * (1 - t) ** 2 * t * 147.8 +
        3 * (1 - t) * t * t * 144.2 +
        t ** 3 * 164,
      y: (1 - t) ** 3 * 64 + 3 * (1 - t) ** 2 * t * 64 + 3 * (1 - t) * t * t * 44 + t ** 3 * 44,
    });
    const point = upperFan(0.4); // Raw middle lane is 7.04px away; raw upper is 12.96px away.
    const camera = container.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform;
    const [tx = 0, ty = 0, zoom = 1] = camera?.match(/-?[\d.]+/g)?.map(Number) ?? [];
    const pointer = { clientX: tx + point.x * zoom, clientY: ty + point.y * zoom };
    const hit = edge?.querySelector(".react-flow__edge-interaction");
    if (!hit) throw new Error("Missing wire hit target");
    fireEvent[action](hit, pointer);
    if (action === "click") expect(onSelectLine).toHaveBeenCalledWith("upper");
    else
      expect(onLineMenu).toHaveBeenCalledWith("upper", { x: pointer.clientX, y: pointer.clientY });
    // Repeated picking reuses the same shape. A layout/animation change updates d on the same
    // element: the next pick must use that new artwork, not the cached former fan.
    fireEvent[action](hit, pointer);
    const upperPath = edge?.querySelector(".board-wire-fill");
    upperPath?.setAttribute("d", "M 128 200 L 400 200");
    fireEvent[action](hit, pointer);
    if (action === "click") expect(onSelectLine).toHaveBeenLastCalledWith("middle");
    else
      expect(onLineMenu).toHaveBeenLastCalledWith("middle", {
        x: pointer.clientX,
        y: pointer.clientY,
      });
    expect(container.querySelector(".board-line-chooser")).toBeNull();
  });
}

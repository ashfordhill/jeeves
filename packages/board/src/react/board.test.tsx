// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ElkNode } from "elkjs/lib/elk-api.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLayoutEngine, type ElkLike } from "../layout/engine.ts";
import { Board, type LineSpec, type TileSpec } from "./Board.tsx";

/** Fixed geometry: tiles in one row, 192px apart; lines run port to port; chips sit mid-line. */
const fakeElk: ElkLike = {
  async layout(graph: ElkNode) {
    const children = (graph.children ?? []).map((c, i) => ({ ...c, x: 32 + i * 192, y: 32 }));
    const at = new Map(children.map((c) => [c.id, c]));
    const edges = (graph.edges ?? []).map((e) => {
      const s = at.get(String(e.sources[0]).replace(/__out$/, ""));
      const t = at.get(String(e.targets[0]).replace(/__in$/, ""));
      const y = 32 + (s?.height ?? 0) / 2;
      const start = (s?.x ?? 0) + (s?.width ?? 0);
      const end = t?.x ?? 0;
      return {
        ...e,
        sections: [{ id: `${e.id}_s`, startPoint: { x: start, y }, endPoint: { x: end, y } }],
        labels: e.labels?.map((l) => ({
          ...l,
          x: (start + end) / 2 - (l.width ?? 0) / 2,
          y: y - (l.height ?? 0) / 2,
        })),
      };
    });
    return {
      ...graph,
      x: 0,
      y: 0,
      width: 32 + children.length * 192,
      height: 192,
      children,
      edges,
    };
  },
};

const tile = (id: string, label: string, h = 128): TileSpec => ({
  id,
  w: 128,
  h,
  shape: "rect",
  label,
  content: <span>{label}</span>,
});

const tiles = [tile("actor", "User", 160), tile("redirect", "Redirect"), tile("events", "Events")];
const lines: LineSpec[] = [
  {
    id: "entry",
    source: "actor",
    target: "redirect",
    dashed: false,
    label: "Download",
    chip: { w: 32, h: 32, content: <span>v</span> },
  },
  { id: "publish", source: "redirect", target: "events", dashed: true },
];

describe("Board", () => {
  beforeEach(() => {
    // jsdom has no ResizeObserver (React Flow needs one) and lays nothing out (the camera does).
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

  it("draws tiles and lines where ELK put them, dashes async lines and selects by click", async () => {
    const onSelectTile = vi.fn();
    const onSelectLine = vi.fn();
    const { container } = render(
      <div style={{ width: 1200, height: 800 }}>
        <Board
          tiles={tiles}
          lines={lines}
          engine={createLayoutEngine(fakeElk, { debounceMs: 0 })}
          selected={{}}
          onSelectTile={onSelectTile}
          onSelectLine={onSelectLine}
          onClear={() => {}}
          mode="select"
        />
      </div>,
    );
    const board = container.querySelector(".board");
    await waitFor(() => expect(board?.getAttribute("data-layout")).toBe("ready"));
    await waitFor(() => expect(board?.getAttribute("data-board")).toBe("ready"));

    const redirect = screen.getByRole("group", { name: "Redirect" });
    expect(redirect.style.transform).toBe("translate(224px,32px)");
    expect(screen.getByRole("group", { name: "User" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Events" })).toBeTruthy();

    const entry = container.querySelector('.react-flow__edge[data-id="entry"]');
    const publish = container.querySelector('.react-flow__edge[data-id="publish"]');
    // The solid line follows its ELK route (the fallback would run at y 104) and has no dashes.
    expect(entry?.querySelector(".react-flow__edge-path")?.getAttribute("d")).toBe(
      "M 160 112 L 224 112",
    );
    expect(entry?.querySelectorAll(".board-line-dash")).toHaveLength(0);
    // The dashed line is drawn as world-locked dash segments over a transparent hit path.
    expect(publish?.querySelectorAll(".board-line-dash").length).toBeGreaterThan(0);

    fireEvent.click(redirect);
    expect(onSelectTile).toHaveBeenCalledWith("redirect");
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onSelectLine).toHaveBeenCalledWith("entry");
  });
});

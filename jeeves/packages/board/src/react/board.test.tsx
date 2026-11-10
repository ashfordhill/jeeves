// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api.js";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLayoutEngine, type ElkLike } from "../layout/engine.ts";
import {
  Board,
  type BoardHandle,
  type BoardProps,
  type LineSpec,
  type TileSpec,
} from "./Board.tsx";
import { fanCenters } from "./fan.ts";
import type { FanItem, TabSpec } from "./TileChrome.tsx";

/**
 * Fixed geometry: tile tops in one row at y 32, 192px apart; lines run level from the source's
 * port; chips sit mid-line. The engine then puts it on the grid (`alignLayout`).
 */
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
  { id: "publish", source: "redirect", target: "events", dashed: true, directed: true },
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
    // The 160px User's port (112) goes onto the grid at 128, and Redirect follows onto its row.
    expect(redirect.style.transform).toBe("translate(224px,64px)");
    expect(screen.getByRole("group", { name: "User" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Events" })).toBeTruthy();

    const entry = container.querySelector('.react-flow__edge[data-id="entry"]');
    const publish = container.querySelector('.react-flow__edge[data-id="publish"]');
    // The solid line follows its aligned route, straight on that row, and has no dashes.
    expect(entry?.querySelector(".react-flow__edge-path")?.getAttribute("d")).toBe(
      "M 160 128 L 224 128",
    );
    expect(entry?.querySelectorAll(".board-line-dash")).toHaveLength(0);
    // The dashed line is drawn as world-locked dash segments over a transparent hit path.
    expect(publish?.querySelectorAll(".board-line-dash").length).toBeGreaterThan(0);
    expect(entry?.querySelector(".board-line-arrow")).toBeNull();
    expect(publish?.querySelector(".board-line-arrow")?.getAttribute("pointer-events")).toBe(
      "none",
    );

    fireEvent.click(redirect);
    expect(onSelectTile).toHaveBeenCalledWith("redirect");
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onSelectLine).toHaveBeenCalledWith("entry");
  });

  it("waits for layout then snapshots all routes independently of selection", async () => {
    const ref = createRef<BoardHandle>();
    let finish: (() => void) | undefined;
    const engine = createLayoutEngine(
      {
        layout: async (graph) => {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          return fakeElk.layout(graph);
        },
      },
      { debounceMs: 0 },
    );
    render(
      <Board
        ref={ref}
        tiles={tiles}
        lines={lines}
        engine={engine}
        selected={{ line: "publish" }}
        onSelectTile={() => {}}
        onSelectLine={() => {}}
        onClear={() => {}}
        mode="select"
      />,
    );
    expect(ref.current?.snapshot()).toBeNull();
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    await act(async () => {
      finish?.();
    });
    await waitFor(() => expect(ref.current?.snapshot()).toBeTruthy());
    const first = ref.current?.snapshot();
    expect(first?.lines.map((line) => line.id)).toEqual(["entry", "publish"]);
    expect(first?.tiles).toHaveLength(3);
    if (!first) throw new Error("Missing snapshot");
    first.layout.positions.actor = { x: -500, y: -500 };
    expect(ref.current?.snapshot()?.layout.positions.actor).not.toEqual({ x: -500, y: -500 });
  });

  it("keeps a directed line's hit band and mouse removal", async () => {
    const onSelectLine = vi.fn();
    const onRemoveLine = vi.fn();
    const engine = createLayoutEngine(fakeElk, { debounceMs: 0 });
    const board = (selected: BoardProps["selected"]) => (
      <Board
        tiles={tiles}
        lines={lines}
        engine={engine}
        selected={selected}
        onSelectTile={() => {}}
        onSelectLine={onSelectLine}
        onClear={() => {}}
        onRemoveLine={onRemoveLine}
        mode="select"
      />
    );
    const { container, rerender } = render(board({}));
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const line = container.querySelector('.react-flow__edge[data-id="publish"]');
    const hit = line?.querySelector(".react-flow__edge-interaction");
    expect(hit?.getAttribute("stroke-width")).toBe("44");
    if (!hit) throw new Error("Missing line hit target");
    fireEvent.click(hit);
    expect(onSelectLine).toHaveBeenCalledWith("publish");
    rerender(board({ line: "publish" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove line" }));
    expect(onRemoveLine).toHaveBeenCalledWith("publish");
  });

  it("keeps each view's hints apart, draws the old view until the new one lands, and highlights lines", async () => {
    let finish: (() => void) | undefined;
    let hold = false;
    const engine = createLayoutEngine(
      {
        layout: async (graph) => {
          if (hold)
            await new Promise<void>((resolve) => {
              finish = resolve;
            });
          return fakeElk.layout(graph);
        },
      },
      { debounceMs: 0 },
    );
    const request = vi.spyOn(engine, "request");
    // The detailed view draws Redirect taller, with a module line of its own.
    const detailedTiles = [
      tiles[0] as TileSpec,
      tile("redirect", "Redirect", 192),
      tiles[2] as TileSpec,
    ];
    const detailedLines: LineSpec[] = [
      lines[0] as LineSpec,
      { id: "publish/m", source: "redirect", target: "events", dashed: true, directed: true },
    ];
    const extra = tile("extra", "Extra");
    const board = (
      view: string,
      t: readonly TileSpec[],
      l: readonly LineSpec[],
      highlighted?: string[],
    ) => (
      <Board
        tiles={t}
        lines={l}
        engine={engine}
        selected={{}}
        onSelectTile={() => {}}
        onSelectLine={() => {}}
        onClear={() => {}}
        mode="select"
        view={view}
        {...(highlighted && { highlighted })}
      />
    );
    const drawn = () =>
      [...container.querySelectorAll<HTMLElement>(".react-flow__edge")]
        .map((e) => e.dataset.id)
        .sort();
    const { container, rerender } = render(board("overview", tiles, lines));
    const ready = () =>
      waitFor(() =>
        expect(container.querySelector(".board")?.getAttribute("data-layout")).toBe("ready"),
      );
    await ready();
    const overview = request.mock.results[0]?.value as Promise<{ positions: object }>;
    const overviewPositions = (await overview).positions;

    // A first switch lays the detailed view out without the overview's positions as hints, and
    // the overview stays drawn until it lands.
    hold = true;
    rerender(board("detailed", detailedTiles, detailedLines));
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(request.mock.calls.at(-1)?.[1]).toBeUndefined();
    expect(drawn()).toEqual(["entry", "publish"]);
    expect(screen.getByRole("group", { name: "Redirect" }).style.height).toBe("128px");
    hold = false;
    await act(async () => {
      finish?.();
    });
    await ready();
    expect(drawn()).toEqual(["entry", "publish/m"]);
    expect(screen.getByRole("group", { name: "Redirect" }).style.height).toBe("192px");

    // An edit made in the detailed view is hinted by the detailed positions; back in the
    // overview, the next edit is hinted by the overview's own positions, never the detailed ones.
    rerender(board("detailed", [...detailedTiles, extra], detailedLines));
    await ready();
    const detailedHints = request.mock.calls.at(-1)?.[1];
    expect(detailedHints && Object.keys(detailedHints).sort()).toEqual([
      "actor",
      "events",
      "redirect",
    ]);
    expect(detailedHints).not.toEqual(overviewPositions);
    rerender(board("overview", [...tiles, extra], lines));
    await ready();
    expect(request.mock.calls.at(-1)?.[1]).toEqual(overviewPositions);

    // Highlighted lines take the selection colour; nothing is selected.
    rerender(board("overview", [...tiles, extra], lines, ["entry"]));
    const ink = (id: string) =>
      container.querySelector<SVGPathElement>(
        `.react-flow__edge[data-id="${id}"] .react-flow__edge-path`,
      )?.style.stroke;
    expect(ink("entry")).toBe("var(--board-select)");
    expect(container.querySelector(".react-flow__edge.selected")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  it("leaves a selected tile's own lines to `highlighted` when asked, keeping its chrome", async () => {
    const engine = createLayoutEngine(fakeElk, { debounceMs: 0 });
    const board = (props: Partial<BoardProps>) => (
      <Board
        tiles={tiles}
        lines={lines}
        engine={engine}
        selected={{ tile: "redirect" }}
        onSelectTile={() => {}}
        onSelectLine={() => {}}
        onClear={() => {}}
        removable={() => true}
        onRemoveTile={() => {}}
        mode="select"
        {...props}
      />
    );
    const { container, rerender } = render(board({}));
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    // `entry` is solid; `publish` is dashed (a transparent hit path), so read its arrowhead.
    const ink = (id: string) =>
      container.querySelector<SVGPathElement>(
        `.react-flow__edge[data-id="${id}"] ${id === "publish" ? ".board-line-arrow" : ".react-flow__edge-path"}`,
      )?.style.stroke;
    // By default every line of the selected tile takes the selection colour.
    expect([ink("entry"), ink("publish")]).toEqual(["var(--board-select)", "var(--board-select)"]);
    rerender(board({ selectedTileLines: false, highlighted: ["publish"] }));
    expect(ink("entry")).toBe("var(--board-line)");
    expect(ink("publish")).toBe("var(--board-select)");
    // The tile is still the selected one, with its X; no line is selected.
    expect(screen.getByRole("group", { name: "Redirect" }).classList).toContain("selected");
    expect(screen.getByRole("button", { name: "Remove Redirect" })).toBeTruthy();
    expect(container.querySelector(".react-flow__edge.selected")).toBeNull();
    rerender(board({ selectedTileLines: false }));
    expect([ink("entry"), ink("publish")]).toEqual(["var(--board-line)", "var(--board-line)"]);
  });

  it("draws lines and arrowheads at named ports, with handles there, and snapshots the ports", async () => {
    const ref = createRef<BoardHandle>();
    const hub: TileSpec = {
      ...tile("hub", "Hub", 160),
      w: 256,
      ports: [
        { id: "head", side: "in", y: 32 },
        { id: "first", side: "out", y: 64 },
        { id: "second", side: "out", y: 96 },
        { id: "third", side: "out", y: 128 },
      ],
    };
    const ported: LineSpec[] = [
      {
        id: "in",
        source: "start",
        target: "hub",
        targetPort: "head",
        dashed: false,
        directed: true,
      },
      ...["first", "second", "third"].map((port, i) => ({
        id: port,
        source: "hub",
        target: `t${i}`,
        sourcePort: port,
        dashed: false,
        directed: true,
      })),
    ];
    const { container } = render(
      <Board
        ref={ref}
        tiles={[tile("start", "Start"), hub, tile("t0", "T0"), tile("t1", "T1"), tile("t2", "T2")]}
        lines={ported}
        engine={createLayoutEngine(new ELK(), { debounceMs: 0 })}
        selected={{}}
        onSelectTile={() => {}}
        onSelectLine={() => {}}
        onClear={() => {}}
        mode="select"
      />,
    );
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const at = (name: string) => {
      const [x = 0, y = 0] = (
        screen.getByRole("group", { name }).style.transform.match(/-?\d+/g) ?? []
      ).map(Number);
      return { x, y };
    };
    const points = (d: string | null | undefined) => {
      const n = (d ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      return n.flatMap((x, i) => (i % 2 ? [] : [{ x, y: n[i + 1] }]));
    };
    const drawn = (id: string) => {
      const edge = container.querySelector(`.react-flow__edge[data-id="${id}"]`);
      return {
        line: points(edge?.querySelector(".react-flow__edge-path")?.getAttribute("d")),
        arrow: points(edge?.querySelector(".board-line-arrow")?.getAttribute("d")),
      };
    };
    const [start, h] = [at("Start"), at("Hub")];
    // Into the hub's named in port: from the start's default port, arrowhead tip at the port.
    const into = drawn("in");
    expect(into.line.at(0)).toEqual({ x: start.x + 128, y: start.y + 64 });
    expect(into.line.at(-1)).toEqual({ x: h.x, y: h.y + 32 });
    expect(into.arrow[1]).toEqual({ x: h.x, y: h.y + 32 });
    // Out of its three out ports, each to its target's default port.
    for (const [i, port] of ["first", "second", "third"].entries()) {
      const target = at(`T${i}`);
      const { line, arrow } = drawn(port);
      expect(line.at(0), port).toEqual({ x: h.x + 256, y: h.y + 64 + 32 * i });
      expect(line.at(-1), port).toEqual({ x: target.x, y: target.y + 64 });
      expect(arrow[1], port).toEqual({ x: target.x, y: target.y + 64 });
    }
    // Each named port has its own handle at its height; the default ones stay at mid-height.
    const handles = [
      ...container.querySelectorAll<HTMLElement>(
        '.react-flow__node[data-id="hub"] .react-flow__handle',
      ),
    ].map((el) => `${el.dataset.handleid ?? "default"} ${el.style.top || "mid"}`);
    expect(handles).toEqual([
      "default mid",
      "default mid",
      "head 32px",
      "first 64px",
      "second 96px",
      "third 128px",
    ]);
    const snapshot = ref.current?.snapshot();
    expect(snapshot?.tiles.find((t) => t.id === "hub")?.ports).toEqual(hub.ports);
    expect(snapshot?.lines.map((l) => l.sourcePort ?? l.targetPort)).toEqual([
      "head",
      "first",
      "second",
      "third",
    ]);
  });

  it("greys a disabled fan item in its own slot, shows its reason and never picks it", async () => {
    // jsdom has no pointer capture or hit testing; the pull reads both. With no matchMedia the
    // board takes reduced motion, so the fan opens as soon as the tab is pressed.
    const capture = { setPointerCapture: () => {}, releasePointerCapture: () => {} };
    Object.assign(HTMLElement.prototype, capture);
    if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (value: string) => value });
    let under: Element | null = null;
    document.elementFromPoint = () => under;

    const item = (id: string, disabled?: string): FanItem => ({
      id,
      label: id.toUpperCase(),
      content: <span>{id}</span>,
      ...(disabled && { disabled }),
    });
    const tab = (items: FanItem[]): TabSpec => ({
      id: "add",
      kind: "create",
      side: "after",
      label: "Add after",
      items,
    });
    const onPick = vi.fn<NonNullable<BoardProps["onPick"]>>(() => undefined);
    const board = (items: FanItem[]) => (
      <div style={{ width: 1200, height: 800 }}>
        <Board
          tiles={tiles}
          lines={lines}
          engine={createLayoutEngine(fakeElk, { debounceMs: 0 })}
          selected={{ tile: "redirect" }}
          onSelectTile={() => {}}
          onSelectLine={() => {}}
          onClear={() => {}}
          mode="select"
          tabs={[tab(items)]}
          onPick={onPick}
        />
      </div>
    );
    const { container, rerender } = render(board([item("a"), item("b"), item("c")]));
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const handle = await screen.findByRole("button", { name: "Add after" });
    // Every element's rect is the 1200×800 board, so the tab rests at its centre.
    const press = () =>
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 600, clientY: 400 });
    const fan = () =>
      [...document.querySelectorAll<HTMLElement>("[data-fan-item]")].map((el) => ({
        id: el.dataset.fanItem,
        at: `${el.style.left},${el.style.top}`,
        disabled: el.getAttribute("aria-disabled") === "true",
      }));
    const slots = fanCenters(600, 400, 3).map((p) => `${p.x}px,${p.y}px`);

    press();
    expect(fan()).toEqual([
      { id: "a", at: slots[0], disabled: false },
      { id: "b", at: slots[1], disabled: false },
      { id: "c", at: slots[2], disabled: false },
    ]);
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 600, clientY: 400 });

    // Disabling an item keeps every item in its slot.
    rerender(board([item("a"), item("b", "B doesn't fit here."), item("c")]));
    press();
    expect(fan()).toEqual([
      { id: "a", at: slots[0], disabled: false },
      { id: "b", at: slots[1], disabled: true },
      { id: "c", at: slots[2], disabled: false },
    ]);
    // On the disabled item, its tip gives the reason; releasing there picks nothing.
    under = document.querySelector('[data-fan-item="b"]');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700, clientY: 400 });
    expect(document.querySelector(".board-fan-tip")?.textContent).toBe("BB doesn't fit here.");
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 700, clientY: 400 });
    expect(onPick).not.toHaveBeenCalled();
    expect(fan()).toEqual([]);

    // An enabled item is picked, even one the board's edge pushed back near the tab: once the
    // pull has gone past the threshold it stays open.
    press();
    under = null;
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700, clientY: 400 });
    under = document.querySelector('[data-fan-item="c"]');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 610, clientY: 400 });
    expect(fan()).toHaveLength(3);
    await act(async () => {
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 610, clientY: 400 });
    });
    expect(onPick).toHaveBeenCalledWith("redirect", "add", "c");
  });
});

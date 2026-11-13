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
import { fanCenters, fanGrid, placeGrid } from "./fan.ts";
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

  it("keeps a directed line's hit band and selects it by click", async () => {
    const onSelectLine = vi.fn();
    const engine = createLayoutEngine(fakeElk, { debounceMs: 0 });
    const { container } = render(
      <Board
        tiles={tiles}
        lines={lines}
        engine={engine}
        selected={{}}
        onSelectTile={() => {}}
        onSelectLine={onSelectLine}
        onClear={() => {}}
        mode="select"
      />,
    );
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const line = container.querySelector('.react-flow__edge[data-id="publish"]');
    const hit = line?.querySelector(".react-flow__edge-interaction");
    expect(hit?.getAttribute("stroke-width")).toBe("44");
    if (!hit) throw new Error("Missing line hit target");
    fireEvent.click(hit);
    expect(onSelectLine).toHaveBeenCalledWith("publish");
  });

  it("hands a right-click on a tile to `onTileMenu` with its ID and the pointer", async () => {
    const onTileMenu = vi.fn();
    const onSelectTile = vi.fn();
    const { container } = render(
      <Board
        tiles={tiles}
        lines={lines}
        engine={createLayoutEngine(fakeElk, { debounceMs: 0 })}
        selected={{}}
        onSelectTile={onSelectTile}
        onSelectLine={() => {}}
        onClear={() => {}}
        onTileMenu={onTileMenu}
        mode="select"
      />,
    );
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const redirect = screen.getByRole("group", { name: "Redirect" });
    // The browser's own menu is prevented; the tile is not selected.
    expect(fireEvent.contextMenu(redirect, { clientX: 300, clientY: 140 })).toBe(false);
    expect(onTileMenu).toHaveBeenCalledWith("redirect", { x: 300, y: 140 });
    expect(onSelectTile).not.toHaveBeenCalled();
  });

  it("hands a right-click on a line to `onLineMenu` with that line's ID", async () => {
    const onLineMenu = vi.fn();
    const { container } = render(
      <Board
        tiles={tiles}
        lines={lines}
        engine={createLayoutEngine(fakeElk, { debounceMs: 0 })}
        selected={{}}
        onSelectTile={() => {}}
        onSelectLine={() => {}}
        onClear={() => {}}
        onLineMenu={onLineMenu}
        mode="connect"
      />,
    );
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const hit = container.querySelector(
      '.react-flow__edge[data-id="publish"] .react-flow__edge-interaction',
    );
    if (!hit) throw new Error("Missing line hit target");
    expect(fireEvent.contextMenu(hit, { clientX: 500, clientY: 120 })).toBe(false);
    expect(onLineMenu).toHaveBeenCalledWith("publish", { x: 500, y: 120 });
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
    const { container, rerender } = render(board("simple", tiles, lines));
    const ready = () =>
      waitFor(() =>
        expect(container.querySelector(".board")?.getAttribute("data-layout")).toBe("ready"),
      );
    await ready();
    const simple = request.mock.results[0]?.value as Promise<{ positions: object }>;
    const simplePositions = (await simple).positions;

    // A first switch lays the detailed view out without the simple view's positions as hints,
    // and the simple view stays drawn until it lands.
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

    // An edit made in the detailed view is hinted by the detailed positions; back in the simple
    // view, the next edit is hinted by its own positions, never the detailed ones.
    rerender(board("detailed", [...detailedTiles, extra], detailedLines));
    await ready();
    const detailedHints = request.mock.calls.at(-1)?.[1];
    expect(detailedHints && Object.keys(detailedHints).sort()).toEqual([
      "actor",
      "events",
      "redirect",
    ]);
    expect(detailedHints).not.toEqual(simplePositions);
    rerender(board("simple", [...tiles, extra], lines));
    await ready();
    expect(request.mock.calls.at(-1)?.[1]).toEqual(simplePositions);

    // Highlighted lines take the selection colour; nothing is selected.
    rerender(board("simple", [...tiles, extra], lines, ["entry"]));
    const ink = (id: string) =>
      container.querySelector<SVGPathElement>(
        `.react-flow__edge[data-id="${id}"] .react-flow__edge-path`,
      )?.style.stroke;
    expect(ink("entry")).toBe("var(--board-select)");
    expect(container.querySelector(".react-flow__edge.selected")).toBeNull();
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
        tabs={[{ id: "add", kind: "create", label: "Add after", items: [] }]}
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
    // The tile is still the selected one, with its tab; no line is selected.
    expect(screen.getByRole("group", { name: "Redirect" }).classList).toContain("selected");
    expect(
      screen.getByRole("group", { name: "Redirect" }).querySelector(".board-tab"),
    ).toBeTruthy();
    expect(container.querySelector(".react-flow__edge.selected")).toBeNull();
    rerender(board({ selectedTileLines: false }));
    expect([ink("entry"), ink("publish")]).toEqual(["var(--board-line)", "var(--board-line)"]);
  });

  it("offers each group of overlapping lines once, and selects a lone group without asking", async () => {
    // Three lines on one route: two drawn lines of one relationship (`group`) and another one.
    const shared = (id: string, group?: string): LineSpec => ({
      id,
      source: "redirect",
      target: "events",
      dashed: false,
      label: id,
      ...(group && { group }),
    });
    const onSelectLine = vi.fn();
    const board = (overlapping: LineSpec[]) => (
      <Board
        tiles={tiles}
        lines={overlapping}
        engine={createLayoutEngine(fakeElk, { debounceMs: 0 })}
        selected={{}}
        onSelectTile={() => {}}
        onSelectLine={onSelectLine}
        onClear={() => {}}
        mode="select"
      />
    );
    const clickMiddle = async (container: HTMLElement, id: string) => {
      await waitFor(() =>
        expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
      );
      const edge = container.querySelector(`.react-flow__edge[data-id="${id}"]`);
      const [x1, y, x2] = (edge?.querySelector(".react-flow__edge-path")?.getAttribute("d") ?? "")
        .match(/-?\d+(\.\d+)?/g)
        ?.map(Number) ?? [0, 0, 0];
      const camera = container.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform;
      const [tx = 0, ty = 0, zoom = 1] = camera?.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      const hit = edge?.querySelector(".react-flow__edge-interaction");
      if (!hit || x1 === undefined || y === undefined || x2 === undefined)
        throw new Error("Missing line");
      fireEvent.click(hit, { clientX: tx + ((x1 + x2) / 2) * zoom, clientY: ty + y * zoom });
    };

    const one = render(board([shared("a/first", "a"), shared("a/second", "a")]));
    await clickMiddle(one.container, "a/second");
    expect(screen.queryByRole("dialog", { name: "Choose relationship" })).toBeNull();
    expect(onSelectLine).toHaveBeenCalledWith("a/first");
    cleanup();

    onSelectLine.mockClear();
    const two = render(board([shared("a/first", "a"), shared("a/second", "a"), shared("b")]));
    await clickMiddle(two.container, "b");
    const chooser = screen.getByRole("dialog", { name: "Choose relationship" });
    const offered = [...chooser.querySelectorAll<HTMLElement>("[data-line-id]")].map(
      (button) => button.dataset.lineId,
    );
    expect(offered).toEqual(["a/first", "b"]);
    expect(onSelectLine).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "b" }));
    expect(onSelectLine).toHaveBeenCalledWith("b");
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

  it("connects by dragging from a tile, refuses with the reason, and still selects by click", async () => {
    if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (value: string) => value });
    let under: Element | null = null;
    document.elementFromPoint = () => under;
    const calls: string[] = [];
    const onSelectTile = vi.fn();
    const onConnect = vi.fn((from: string, to: string) => calls.push(`connect ${from} ${to}`));
    const onConnectRefused = vi.fn((from: string, to: string) =>
      calls.push(`refused ${from} ${to}`),
    );
    const tab: TabSpec = {
      id: "add",
      kind: "create",
      label: "Add after",
      items: [],
    };
    const board = (mode: BoardProps["mode"]) => (
      <div style={{ width: 1200, height: 800 }}>
        <Board
          tiles={tiles}
          lines={lines}
          engine={createLayoutEngine(fakeElk, { debounceMs: 0 })}
          selected={{ tile: "redirect" }}
          onSelectTile={onSelectTile}
          onSelectLine={() => {}}
          onClear={() => {}}
          mode={mode}
          tabs={[tab]}
          canConnect={(from, to) => from === "redirect" && to === "events"}
          connectRefusal={(from, to) => `${from} can't link to ${to}.`}
          onConnect={onConnect}
          onConnectRefused={onConnectRefused}
        />
      </div>
    );
    const { container, rerender } = render(board("select"));
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const node = (id: string) =>
      container.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;
    // Select mode: the selected tile has its chrome, and a drag from a tile connects nothing.
    expect(node("redirect").querySelectorAll(".board-tab")).toHaveLength(1);
    const drag = (from: string, to: string | null, x = 700) => {
      fireEvent.pointerDown(node(from), { button: 0, isPrimary: true, clientX: 600, clientY: 400 });
      under = to ? node(to) : null;
      fireEvent.pointerMove(window, { clientX: x, clientY: 400 });
    };
    const release = (x = 700) => fireEvent.pointerUp(window, { clientX: x, clientY: 400 });
    drag("redirect", "events");
    release();
    expect(container.querySelector(".board-connect")).toBeNull();
    expect(calls).toEqual([]);

    // Connect mode: no chrome; a drag past a few pixels draws the line and lights the allowed end.
    rerender(board("connect"));
    expect(container.querySelector(".board")?.getAttribute("data-mode")).toBe("connect");
    expect(node("redirect").querySelector(".board-tab")).toBeNull();
    drag("redirect", "events");
    expect(document.querySelector(".board-connect .board-connect-line line")).not.toBeNull();
    expect(node("events").className).toContain("is-drop-target is-drop-over");
    expect(node("actor").className).not.toContain("is-drop-target");
    expect(document.querySelector(".board-connect-tip")).toBeNull();
    release();
    expect(document.querySelector(".board-connect")).toBeNull();
    expect(calls).toEqual(["connect redirect events"]);
    // The click that ends a drag is swallowed: it selects nothing.
    fireEvent.click(node("events"));
    expect(onSelectTile).not.toHaveBeenCalled();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    // A refused end fades, its reason by the pointer; a release there reports it.
    drag("redirect", "actor");
    expect(node("actor").className).not.toContain("is-drop-target");
    expect(document.querySelector(".board-connect-line g")?.hasAttribute("data-refused")).toBe(
      true,
    );
    expect(document.querySelector(".board-connect-tip")?.textContent).toBe(
      "redirect can't link to actor.",
    );
    release();
    expect(calls).toEqual(["connect redirect events", "refused redirect actor"]);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    // The drag's direction is the line's: from Events, Redirect is refused, not reversed.
    drag("events", "redirect");
    release();
    expect(calls.at(-1)).toBe("refused events redirect");
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    // Released on paper or on the tile itself, or cancelled with Escape: nothing.
    drag("redirect", null);
    release();
    drag("redirect", "redirect");
    release();
    drag("redirect", "events");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".board-connect")).toBeNull();
    release();
    expect(calls).toHaveLength(3);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    // A press that doesn't move that far is a click: it selects.
    fireEvent.pointerDown(node("events"), {
      button: 0,
      isPrimary: true,
      clientX: 600,
      clientY: 400,
    });
    fireEvent.pointerMove(window, { clientX: 603, clientY: 402 });
    fireEvent.pointerUp(window, { clientX: 603, clientY: 402 });
    fireEvent.click(node("events"));
    expect(onSelectTile).toHaveBeenCalledWith("events");
    expect(calls).toHaveLength(3);
  });

  it("drags from an end's handle inside a tile and ends on tiles or on ends the rules know", async () => {
    if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (value: string) => value });
    let under: Element | null = null;
    document.elementFromPoint = () => under;
    const calls: string[] = [];
    // Redirect holds two ends: a reader with a handle, and a data row any drag may end on.
    const withEnds = tiles.map((t) =>
      t.id === "redirect"
        ? {
            ...t,
            content: (
              <div>
                <span data-board-end="reader">
                  Reader <i data-board-end-handle>o</i>
                </span>
                <span data-board-end="data">Data</span>
                <span data-testid="face">Redirect</span>
              </div>
            ),
          }
        : t,
    );
    const allowed: Record<string, string[]> = { reader: ["events", "data"] };
    const { container } = render(
      <div style={{ width: 1200, height: 800 }}>
        <Board
          tiles={withEnds}
          lines={lines}
          engine={createLayoutEngine(fakeElk, { debounceMs: 0 })}
          selected={{}}
          onSelectTile={() => {}}
          onSelectLine={() => {}}
          onClear={() => {}}
          mode="connect"
          canConnect={(from, to) => allowed[from]?.includes(to) === true}
          connectRefusal={(from, to) =>
            from === "reader" && to === "actor" ? "The reader can't use the user." : undefined
          }
          onConnect={(from, to) => calls.push(`connect ${from} ${to}`)}
          onConnectRefused={(from, to) => calls.push(`refused ${from} ${to}`)}
        />
      </div>,
    );
    await waitFor(() =>
      expect(container.querySelector(".board")?.getAttribute("data-board")).toBe("ready"),
    );
    const node = (id: string) =>
      container.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;
    const at = (selector: string) => container.querySelector(selector) as HTMLElement;
    const drag = (from: Element, to: Element | null) => {
      fireEvent.pointerDown(from, { button: 0, isPrimary: true, clientX: 600, clientY: 400 });
      under = to;
      fireEvent.pointerMove(window, { clientX: 700, clientY: 400 });
    };
    const release = () => fireEvent.pointerUp(window, { clientX: 700, clientY: 400 });
    const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    // From the handle: the drag is the end's. The allowed tile is lit; the allowed end gets its
    // dashed outline on the overlay.
    drag(at("[data-board-end-handle]"), node("events"));
    expect(node("events").className).toContain("is-drop-target is-drop-over");
    expect(
      [...document.querySelectorAll(".board-connect-ends rect")].map((r) =>
        r.getAttribute("data-end"),
      ),
    ).toEqual(["data"]);
    release();
    expect(calls).toEqual(["connect reader events"]);
    await settle();

    // Onto an end it may use, in its own tile.
    drag(at("[data-board-end-handle]"), at('[data-board-end="data"]'));
    expect(document.querySelector(".board-connect-ends rect")?.hasAttribute("data-over")).toBe(
      true,
    );
    release();
    expect(calls.at(-1)).toBe("connect reader data");
    await settle();

    // A tile it is refused is faded with the reason; its own tile is the source, so nothing.
    drag(at("[data-board-end-handle]"), node("actor"));
    expect(document.querySelector(".board-connect-tip")?.textContent).toBe(
      "The reader can't use the user.",
    );
    release();
    expect(calls.at(-1)).toBe("refused reader actor");
    await settle();
    drag(at("[data-board-end-handle]"), at('[data-testid="face"]'));
    expect(document.querySelector(".board-connect-line g")?.hasAttribute("data-refused")).toBe(
      false,
    );
    release();
    expect(calls).toHaveLength(3);
    await settle();

    // Anywhere else on the tile the drag is the tile's, and an end the rules don't know for it
    // is part of its tile: over Events' face it is Events, refused without a reason.
    drag(at('[data-board-end="data"]'), node("events"));
    expect(document.querySelectorAll(".board-connect-ends rect")).toHaveLength(0);
    expect(node("events").className).not.toContain("is-drop-target");
    release();
    expect(calls.at(-1)).toBe("refused redirect events");
  });

  it("pans while a connect drag is held near the edge, as far as the tiles go, then connects", async () => {
    if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (value: string) => value });
    let under: Element | null = null;
    document.elementFromPoint = () => under;
    const calls: string[] = [];
    const { container } = render(
      <div style={{ width: 1200, height: 800 }}>
        <Board
          tiles={tiles}
          lines={lines}
          engine={createLayoutEngine(fakeElk, { debounceMs: 0 })}
          selected={{}}
          onSelectTile={() => {}}
          onSelectLine={() => {}}
          onClear={() => {}}
          mode="connect"
          canConnect={(from, to) => from === "redirect" && to === "events"}
          onConnect={(from, to) => calls.push(`connect ${from} ${to}`)}
          onConnectRefused={(from, to) => calls.push(`refused ${from} ${to}`)}
        />
      </div>,
    );
    const host = container.querySelector(".board") as HTMLElement;
    await waitFor(() => expect(host.getAttribute("data-board")).toBe("ready"));
    const node = (id: string) =>
      container.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;
    const camera = () => {
      const style = (container.querySelector(".react-flow__viewport") as HTMLElement).style;
      const [x, y, zoom] = (style.transform.match(/-?[\d.]+/g) ?? []).map(Number);
      return { x: x ?? 0, y: y ?? 0, zoom: zoom ?? 1 };
    };
    /** The tiles' right edge on screen (the board fills the 1200×800 window). */
    const right = () => {
      const { x, zoom } = camera();
      const at = Number(node("events").style.transform.match(/-?[\d.]+/)?.[0]);
      return x + (at + 128) * zoom;
    };
    // From here on the test drives every frame itself, 1/60 s apart, so each step of the pan is
    // the same in every run. (jsdom's frames follow the wall clock: a busy machine changed the
    // step sizes, and a frame could land between the last two steps of the pan.)
    const due = new Map<number, FrameRequestCallback>();
    let handle = 0;
    let clock = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      handle += 1;
      due.set(handle, callback);
      return handle;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => due.delete(id));
    const frames = (n: number) =>
      act(async () => {
        for (let i = 0; i < n; i += 1) {
          clock += 1000 / 60;
          const callbacks = [...due.values()];
          due.clear();
          for (const callback of callbacks) callback(clock);
          await Promise.resolve();
        }
      });
    // The fit shows every tile: a drag held at the edge doesn't pan.
    expect(host.style.getPropertyValue("--board-zoom")).toBe(String(camera().zoom));
    const fitted = camera();
    fireEvent.pointerDown(node("redirect"), {
      button: 0,
      isPrimary: true,
      clientX: 600,
      clientY: 400,
    });
    fireEvent.pointerMove(window, { clientX: 1196, clientY: 400 });
    await frames(4);
    expect(camera()).toEqual(fitted);
    fireEvent.pointerUp(window, { clientX: 1196, clientY: 400 });
    expect(calls).toEqual([]);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    // Zoomed in, Events reaches past the right edge. Held there (past it, over a rail), the drag
    // pans left at a steady pace with the pointer still the line's end, and stops once the
    // tiles' end is 48px inside; the zoom is kept.
    fireEvent.wheel(host, { deltaY: -1200, clientX: 600, clientY: 400 });
    const zoomed = camera();
    expect(zoomed.zoom).toBeGreaterThan(fitted.zoom);
    expect(host.style.getPropertyValue("--board-zoom")).toBe(String(zoomed.zoom));
    expect(right()).toBeGreaterThan(1200);
    fireEvent.pointerDown(node("redirect"), {
      button: 0,
      isPrimary: true,
      clientX: 600,
      clientY: 400,
    });
    fireEvent.pointerMove(window, { clientX: 1230, clientY: 400 });
    await frames(3);
    const moving = camera();
    expect(moving.x).toBeLessThan(zoomed.x);
    expect(zoomed.x - moving.x).toBeLessThanOrEqual(3 * 24);
    expect(moving.y).toBe(zoomed.y);
    expect(moving.zoom).toBe(zoomed.zoom);
    const tip = document.querySelector(".board-connect-line line");
    expect([tip?.getAttribute("x2"), tip?.getAttribute("y2")]).toEqual(["1230", "400"]);
    // Frame by frame, at most a step's pace each, until a frame no longer moves it.
    let previous = camera();
    for (let n = 0; n < 120; n += 1) {
      await frames(1);
      const now = camera();
      if (now.x === previous.x) break;
      expect(previous.x - now.x).toBeGreaterThan(0);
      expect(previous.x - now.x).toBeLessThanOrEqual(24);
      expect(now.zoom).toBe(zoomed.zoom);
      previous = now;
    }
    expect(right()).toBeCloseTo(1200 - 48, 0);
    const stopped = camera();
    await frames(3);
    expect(camera()).toEqual(stopped);

    // Released on Events, now in view: it connects.
    under = node("events");
    fireEvent.pointerUp(window, { clientX: 1100, clientY: 400 });
    expect(calls).toEqual(["connect redirect events"]);
    expect(document.querySelector(".board-connect")).toBeNull();
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
    // An arc fan has no panel and no captions.
    expect(document.querySelectorAll(".board-fan-panel, .board-fan-caption")).toHaveLength(0);
    // Pulled and released on nothing: it springs back.
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700, clientY: 400 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 700, clientY: 400 });
    expect(fan()).toEqual([]);

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

  it("lays a grid fan out in a row per group, captions every item and picks from it", async () => {
    // The tile sits left of the tab, which rests at the board's centre, so the grid has room.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains("board-tile")
        ? DOMRect.fromRect({ x: 456, y: 336, width: 128, height: 128 })
        : DOMRect.fromRect({ x: 0, y: 0, width: 1200, height: 800 });
    });
    const capture = { setPointerCapture: () => {}, releasePointerCapture: () => {} };
    Object.assign(HTMLElement.prototype, capture);
    if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (value: string) => value });
    let under: Element | null = null;
    document.elementFromPoint = () => under;
    const groups = ["app", "app", "data", "data", "data", "edge"];
    const items: FanItem[] = groups.map((group, i) => ({
      id: `k${i}`,
      label: `Kind ${i}`,
      content: <span>{i}</span>,
      group,
      ...(i === 3 && { disabled: "Kind 3 doesn't fit here." }),
    }));
    const onPick = vi.fn<NonNullable<BoardProps["onPick"]>>(() => undefined);
    render(
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
          tabs={[
            {
              id: "link",
              kind: "create",
              label: "Add linked tile",
              glyph: "link",
              layout: "grid",
              items,
            },
          ]}
          onPick={onPick}
        />
      </div>,
    );
    const handle = await screen.findByRole("button", { name: "Add linked tile" });
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 600, clientY: 400 });
    const overlay = document.querySelector(".board-pull");
    expect(overlay?.getAttribute("data-layout")).toBe("grid");
    // One panel under the cells, so the items read over the tiles they cover.
    expect(document.querySelectorAll(".board-pull .board-fan-panel")).toHaveLength(1);
    // Every item in its grid slot, kept on the 1200×800 board, with its name as a caption.
    const slots = placeGrid(
      fanGrid(600, 400, groups),
      { x: 0, y: 0, w: 1200, h: 800 },
      { x: 456, y: 336, w: 128, h: 128 },
    );
    expect(slots).toEqual(fanGrid(600, 400, groups));
    const fan = [...document.querySelectorAll<HTMLElement>("[data-fan-item]")];
    expect(fan.map((el) => `${el.style.left},${el.style.top}`)).toEqual(
      slots.map((p) => `${p.x}px,${p.y}px`),
    );
    expect(fan.map((el) => el.querySelector(".board-fan-caption")?.textContent)).toEqual(
      items.map((item) => item.label),
    );
    expect(fan[3]?.getAttribute("aria-disabled")).toBe("true");
    // Three rows: two, three and one item.
    expect(new Set(slots.map((p) => p.y)).size).toBe(3);
    under = document.querySelector('[data-fan-item="k4"]');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700, clientY: 400 });
    await act(async () => {
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 700, clientY: 400 });
    });
    expect(onPick).toHaveBeenCalledWith("redirect", "link", "k4");
  });
  it("opens a fan by a click, closes it on a second click, a click away, the wheel or Escape, and picks by a click", async () => {
    const capture = { setPointerCapture: () => {}, releasePointerCapture: () => {} };
    Object.assign(HTMLElement.prototype, capture);
    if (!globalThis.CSS?.escape) vi.stubGlobal("CSS", { escape: (value: string) => value });
    document.elementFromPoint = () => null;
    const groups = ["app", "app", "data"];
    const items: FanItem[] = groups.map((group, i) => ({
      id: `k${i}`,
      label: `Kind ${i}`,
      content: <span>{i}</span>,
      group,
      ...(i === 1 && { disabled: "Kind 1 doesn't fit here." }),
    }));
    const onPick = vi.fn<NonNullable<BoardProps["onPick"]>>(() => undefined);
    render(
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
          tabs={[
            {
              id: "link",
              kind: "create",
              label: "Add linked tile",
              glyph: "link",
              layout: "grid",
              items,
            },
          ]}
          onPick={onPick}
        />
      </div>,
    );
    const handle = await screen.findByRole("button", { name: "Add linked tile" });
    const fan = () =>
      document.querySelectorAll<HTMLElement>(".board-pull[data-clicked] [data-fan-item]");
    /** A press and a release in place on the tab: a click. */
    const click = () => {
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 600, clientY: 400 });
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 600, clientY: 400 });
    };

    click();
    expect(fan()).toHaveLength(3);
    expect(handle.getAttribute("aria-expanded")).toBe("true");
    // No band and no ghost: the tab stays where it is.
    expect(document.querySelector(".board-ribbon, .board-tab-ghost")).toBeNull();
    expect(handle.hasAttribute("data-hidden")).toBe(false);
    // A press on the fan (an item or its panel) keeps it open; the pointer on an item shows its
    // tip; a click on a disabled one picks nothing.
    const disabled = document.querySelector<HTMLElement>('[data-fan-item="k1"]');
    if (!disabled) throw new Error("No item.");
    fireEvent.pointerDown(disabled);
    fireEvent.pointerDown(document.querySelector(".board-fan-panel") as Element);
    fireEvent.pointerEnter(disabled);
    expect(document.querySelector(".board-fan-tip")?.textContent).toBe(
      "Kind 1Kind 1 doesn't fit here.",
    );
    fireEvent.click(disabled);
    expect(onPick).not.toHaveBeenCalled();
    expect(fan()).toHaveLength(3);

    // A second click on the tab closes it.
    click();
    expect(fan()).toHaveLength(0);
    expect(handle.getAttribute("aria-expanded")).toBe("false");
    // A press anywhere else closes it.
    click();
    expect(fan()).toHaveLength(3);
    fireEvent.pointerDown(document.body);
    expect(fan()).toHaveLength(0);
    // Escape closes it, and the wheel does.
    click();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(fan()).toHaveLength(0);
    click();
    fireEvent.wheel(document.body);
    expect(fan()).toHaveLength(0);

    // The keyboard's click (no pointer press) toggles it too.
    fireEvent.click(handle, { detail: 0 });
    expect(fan()).toHaveLength(3);
    fireEvent.click(handle, { detail: 0 });
    expect(fan()).toHaveLength(0);

    // A click on an enabled item picks it and closes the fan.
    click();
    await act(async () => {
      fireEvent.click(document.querySelector('[data-fan-item="k2"]') as Element);
    });
    expect(onPick).toHaveBeenCalledWith("redirect", "link", "k2");
    expect(fan()).toHaveLength(0);
  });
});

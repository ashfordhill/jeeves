// A container's rows carry port marks only on the sides their drawn lines use, and a mark is lit
// (the selection colour) exactly while a line at that port is, whatever selected it. A row that
// can connect has a dot, filled once connected, as the handle of its board end; the Cache reader's
// loader is an arrow in the gutter, and a right-click on it (live canvas only) asks for its menu. A
// container's header and a plain tile's face show the kind label under the name, and their band
// is marked (`data-host`) only when the tile can take modules.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetailedRow } from "../detailedView.ts";
import { ContainerTile, ModuleRows } from "./ContainerTile.tsx";
import { Tile } from "./Tile.tsx";

const row = (module: string, index: number, ports: Partial<DetailedRow> = {}): DetailedRow => ({
  module,
  host: "worker",
  name: module,
  kind: "custom",
  index,
  y: 64 + 32 * index,
  connects: true,
  connected: false,
  ...ports,
});
const rows = [
  row("consumer", 0, { in: "consumer:in" }),
  row("writer", 1, { out: "writer:out" }),
  row("relay", 2, { in: "relay:in", out: "relay:out" }),
  row("helper", 3),
];
const marks = (container: HTMLElement) =>
  [...container.querySelectorAll("li")].map((li) => [
    li.dataset.module,
    li.dataset.ports ?? null,
    li.dataset.mark ?? null,
    li.dataset.lit ?? null,
  ]);

afterEach(cleanup);

describe("ContainerTile", () => {
  it("marks each row's ports by its drawn lines, and lights the ports of blue lines", () => {
    const own = render(
      <ModuleRows value={{ open: "writer", lit: ["writer:out"], onOpen: () => {} }}>
        <ContainerTile kind="worker" name="Worker" rows={rows} />
      </ModuleRows>,
    );
    expect(marks(own.container)).toEqual([
      ["consumer", "in", null, null],
      ["writer", "out", "open", "out"],
      ["relay", "in out", null, null],
      ["helper", null, null, null],
    ]);
    cleanup();

    // A line selected elsewhere (another tile, its relationship) lights its port with no module
    // open; a port no drawn line uses has no mark to light, and another tile's ports change nothing.
    const elsewhere = render(
      <ModuleRows
        value={{
          lit: ["relay:out", "consumer:in", "helper:out", "other:in"],
          onOpen: () => {},
        }}
      >
        <ContainerTile kind="worker" name="Worker" rows={rows} />
      </ModuleRows>,
    );
    expect(marks(elsewhere.container).map(([module, , , lit]) => [module, lit])).toEqual([
      ["consumer", "in"],
      ["writer", null],
      ["relay", "out"],
      ["helper", null],
    ]);
    cleanup();

    // An export (no live rows) has port marks, but nothing open or lit.
    const exported = render(<ContainerTile kind="worker" name="Worker" rows={rows} />);
    expect(marks(exported.container).map(([, ports, mark, lit]) => [ports, mark, lit])).toEqual([
      ["in", null, null],
      ["out", null, null],
      ["in out", null, null],
      [null, null, null],
    ]);
  });
  it("gives a row that can connect a dot, filled once connected, and draws the loader arrow", () => {
    const own = [
      row("cache", 0, { kind: "cache-reader", connected: true }),
      row("responder", 1, { kind: "redirect-responder", connects: false }),
      row("data", 2, { kind: "data-access" }),
    ];
    const loaders = [
      { link: "cache-data", from: "cache", to: "data", label: "Cache reader to Data access" },
    ];
    const onLoaderMenu = vi.fn();
    const live = render(
      <ModuleRows value={{ open: "data", lit: [], onOpen: () => {}, onLoaderMenu }}>
        <ContainerTile kind="service" name="Watch" rows={own} loaders={loaders} />
      </ModuleRows>,
    );
    const dots = [...live.container.querySelectorAll("li")].map((li) => {
      const dot = li.querySelector(".lane-container-row-dot");
      return [
        li.dataset.boardEnd,
        dot ? dot.hasAttribute("data-board-end-handle") : null,
        dot?.hasAttribute("data-connected") ?? null,
      ];
    });
    expect(dots).toEqual([
      ["cache", true, true],
      ["responder", null, null],
      ["data", true, false],
    ]);
    // The rows make room in the gutter; the arrow is lit while either module is open.
    const face = live.container.querySelector<HTMLElement>(".lane-container");
    expect(face?.style.getPropertyValue("--row-inset-left")).toBe("22px");
    const arrow = live.container.querySelector<HTMLElement>(".lane-container-loader");
    expect(arrow?.dataset.link).toBe("cache-data");
    expect(arrow?.hasAttribute("data-lit")).toBe(true);
    const img = screen.getByRole("img", { name: "Cache reader to Data access" });
    // A right-click on the arrow asks for its menu, not the browser's or the tile's.
    expect(fireEvent.contextMenu(img, { clientX: 40, clientY: 90 })).toBe(false);
    expect(onLoaderMenu).toHaveBeenCalledWith("cache-data", "Cache reader to Data access", {
      x: 40,
      y: 90,
    });
    cleanup();

    // An export draws the arrow, and a right-click on it asks for nothing; no loaders, no gutter.
    const exported = render(
      <ContainerTile kind="service" name="Watch" rows={own} loaders={loaders} />,
    );
    expect(exported.container.querySelectorAll(".lane-container-loader")).toHaveLength(1);
    expect(
      fireEvent.contextMenu(screen.getByRole("img", { name: "Cache reader to Data access" })),
    ).toBe(true);
    cleanup();
    const plain = render(<ContainerTile kind="service" name="Watch" rows={own} />);
    expect(
      plain.container
        .querySelector<HTMLElement>(".lane-container")
        ?.style.getPropertyValue("--row-inset-left"),
    ).toBe("");
  });
  it("shows the kind label under the name, in the header and on a plain tile's face", () => {
    const text = (container: HTMLElement, selector: string) =>
      [...container.querySelectorAll(selector)].map((item) => item.textContent);
    const container = render(
      <ContainerTile kind="worker" name="Transcoder" label="Worker" rows={rows} />,
    ).container;
    expect(text(container, ".lane-container-header .lane-container-title > span")).toEqual([
      "Transcoder",
      "Worker",
    ]);
    cleanup();
    const tile = render(<Tile kind="queue" name="Upload jobs" label="Queue" />).container;
    expect(text(tile, ".lane-tile > span:not(.lane-tile-cap)")).toEqual(["Upload jobs", "Queue"]);
    cleanup();
    // A tile without studio settings has no label.
    expect(render(<Tile name="Legacy" />).container.querySelector(".lane-tile-kind")).toBeNull();
  });
  it("marks the band of a tile that can take modules, and of no other tile", () => {
    const band = (container: HTMLElement, selector: string) =>
      container.querySelector<HTMLElement>(selector)?.dataset.host;
    const cap = ".lane-tile > .lane-tile-cap";
    // The band holds the icon.
    const service = render(<Tile kind="service" name="Shorten API" label="Service" host />);
    expect(band(service.container, cap)).toBe("true");
    expect(service.container.querySelector(`${cap} > .lane-tile-icon svg`)).not.toBeNull();
    cleanup();
    expect(
      band(render(<Tile kind="database" name="Links DB" label="Database" />).container, cap),
    ).toBeUndefined();
    cleanup();
    expect(
      band(
        render(<Tile kind="database" name="Links DB" label="Database" host={false} />).container,
        cap,
      ),
    ).toBeUndefined();
    cleanup();
    const header = ".lane-container > .lane-container-header";
    expect(
      band(
        render(<ContainerTile kind="service" name="Shorten API" rows={rows} addable />).container,
        header,
      ),
    ).toBe("true");
    cleanup();
    expect(
      band(render(<ContainerTile kind="database" name="Links DB" rows={[]} />).container, header),
    ).toBeUndefined();
  });
});

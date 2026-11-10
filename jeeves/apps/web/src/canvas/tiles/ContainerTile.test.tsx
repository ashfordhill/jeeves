// A container's rows carry port marks only on the sides their drawn lines use, and a mark is lit
// (the selection colour) exactly while a line at that port is, whatever selected it. A row that
// can connect has a dot, filled once connected, as the handle of its board end; the Cache reader's
// loader is an arrow in the gutter whose X (live canvas only) disconnects it.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetailedRow } from "../detailedView.ts";
import { ContainerTile, ModuleRows } from "./ContainerTile.tsx";

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
    const onDisconnect = vi.fn();
    const live = render(
      <ModuleRows value={{ open: "data", lit: [], onOpen: () => {}, onDisconnect }}>
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
    expect(screen.getByRole("img", { name: "Cache reader to Data access" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect cache from data" }));
    expect(onDisconnect).toHaveBeenCalledWith("cache-data");
    cleanup();

    // An export draws the arrow but has no X; no loaders, no gutter.
    const exported = render(
      <ContainerTile kind="service" name="Watch" rows={own} loaders={loaders} />,
    );
    expect(exported.container.querySelectorAll(".lane-container-loader")).toHaveLength(1);
    expect(exported.container.querySelector(".lane-container-loader-remove")).toBeNull();
    cleanup();
    const plain = render(<ContainerTile kind="service" name="Watch" rows={own} />);
    expect(
      plain.container
        .querySelector<HTMLElement>(".lane-container")
        ?.style.getPropertyValue("--row-inset-left"),
    ).toBe("");
  });
});

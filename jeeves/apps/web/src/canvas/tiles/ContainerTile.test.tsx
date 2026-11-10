// A container's rows carry port marks only on the sides their drawn lines use, and a mark is lit
// (the selection colour) exactly while a line at that port is, whatever selected it.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DetailedRow } from "../detailedView.ts";
import { ContainerTile, ModuleRows } from "./ContainerTile.tsx";

const row = (module: string, index: number, ports: Partial<DetailedRow> = {}): DetailedRow => ({
  module,
  host: "worker",
  name: module,
  kind: "custom",
  index,
  y: 64 + 32 * index,
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
      <ModuleRows
        value={{ open: "writer", partners: ["relay"], lit: ["writer:out"], onOpen: () => {} }}
      >
        <ContainerTile kind="worker" name="Worker" rows={rows} />
      </ModuleRows>,
    );
    expect(marks(own.container)).toEqual([
      ["consumer", "in", null, null],
      ["writer", "out", "open", "out"],
      ["relay", "in out", "partner", null],
      ["helper", null, null, null],
    ]);
    cleanup();

    // A line selected elsewhere (another tile, its relationship) lights its port with no module
    // open; a port no drawn line uses has no mark to light, and another tile's ports change nothing.
    const elsewhere = render(
      <ModuleRows
        value={{
          partners: [],
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

    // An export (no live rows) has port marks, but nothing open, partnered or lit.
    const exported = render(<ContainerTile kind="worker" name="Worker" rows={rows} />);
    expect(marks(exported.container).map(([, ports, mark, lit]) => [ports, mark, lit])).toEqual([
      ["in", null, null],
      ["out", null, null],
      ["in out", null, null],
      [null, null, null],
    ]);
  });
});

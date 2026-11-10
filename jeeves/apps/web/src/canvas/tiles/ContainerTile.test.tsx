// A container's rows carry port marks only on the sides their drawn lines use, and the container
// says when it holds the open module, so only that row's marks follow its lines' selection colour.
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
  ]);

afterEach(cleanup);

describe("ContainerTile", () => {
  it("marks each row's ports by its drawn lines, and the container that holds the open module", () => {
    const own = render(
      <ModuleRows value={{ open: "writer", partners: ["relay"], onOpen: () => {} }}>
        <ContainerTile kind="worker" name="Worker" rows={rows} />
      </ModuleRows>,
    );
    expect(marks(own.container)).toEqual([
      ["consumer", "in", null],
      ["writer", "out", "open"],
      ["relay", "in out", "partner"],
      ["helper", null, null],
    ]);
    expect(own.container.querySelector(".lane-container")?.hasAttribute("data-open")).toBe(true);
    cleanup();

    // Another tile's open module, or an export (no live rows), marks nothing here.
    const other = render(
      <ModuleRows value={{ open: "elsewhere", partners: [], onOpen: () => {} }}>
        <ContainerTile kind="worker" name="Worker" rows={rows} />
      </ModuleRows>,
    );
    expect(other.container.querySelector(".lane-container")?.hasAttribute("data-open")).toBe(false);
    cleanup();
    const exported = render(<ContainerTile kind="worker" name="Worker" rows={rows} />);
    expect(marks(exported.container).map(([, ports, mark]) => [ports, mark])).toEqual([
      ["in", null],
      ["out", null],
      ["in out", null],
      [null, null],
    ]);
  });
});

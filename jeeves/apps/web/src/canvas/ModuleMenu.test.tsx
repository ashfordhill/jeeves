// The module menu: the kinds a tile allows, grouped by what each does, each card with a dot for
// what it can generate there and a legend of the dots; opened and closed by its `+`, closed by a
// press elsewhere, the wheel or Escape, and a pick reported once. The board's tiles show the `+`
// only on the live canvas in Pointer mode: every addable container, and the selected Simple tile.
import { moduleKinds, studioArchitectureExample } from "@jeeves/spec";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BoardModuleAdding,
  ModuleAddButton,
  type ModuleAdding,
  moduleMenuGroups,
} from "./ModuleMenu.tsx";
import { ContainerTile } from "./tiles/ContainerTile.tsx";
import { Tile } from "./tiles/Tile.tsx";

afterEach(cleanup);

const design = studioArchitectureExample("studio-youtube").design;
const rows = (host: string, kind: "service" | "worker") =>
  moduleMenuGroups(moduleKinds(design, host), kind).map((group) => [
    group.label,
    group.family,
    group.items.map((item) => `${item.name}: ${item.generation}`),
  ]);

describe("moduleMenuGroups", () => {
  it("groups a Service's and a Worker's kinds by what they do, each with what it generates there", () => {
    expect(rows("watch", "service")).toEqual([
      [
        "Requests",
        "api",
        [
          "Rate limiter: stub",
          "Redirect responder: stub",
          "Auth guard: lead",
          "External call: stub",
        ],
      ],
      [
        "Data",
        "data",
        [
          "Cache reader: lead",
          "ID generator: stub",
          "Data access: part",
          "Search query: lead",
          "Favorites: lead",
        ],
      ],
      ["Events", "messaging", ["Event publisher: part", "Event consumer: stub"]],
      ["Files & media", "worker", ["Multipart uploads: lead"]],
      ["Custom", "generic", ["Custom: stub"]],
    ]);
    const worker = rows("transcoder", "worker");
    expect(worker.flatMap(([, , items]) => items)).toHaveLength(16);
    expect(worker[1]).toEqual([
      "Data",
      "data",
      [
        "Cache reader: stub",
        "ID generator: stub",
        "Data access: part",
        "Lifecycle writer: lead",
        "Event counter: lead",
        "Index writer: lead",
      ],
    ]);
    expect(worker[3]).toEqual([
      "Files & media",
      "worker",
      ["Video encoder: lead", "Video packager: part", "Video thumbnailer: part"],
    ]);
    // Each item is its kind, with its icon, its one-line description and its generation.
    const [custom] = moduleMenuGroups(["custom"], "service");
    expect(custom?.items[0]).toMatchObject({
      kind: "custom",
      name: "Custom",
      description: "Your own logic, generated as a stub.",
      generation: "stub",
      icon: expect.any(String),
    });
  });
});

describe("ModuleAddButton", () => {
  const groups = moduleMenuGroups(moduleKinds(design, "watch"), "service");
  const menu = () => screen.queryByRole("menu");

  it("toggles the menu, closes it on a press elsewhere, the wheel or Escape, and reports a pick", async () => {
    const onAdd = vi.fn();
    render(
      <div className="board">
        <ModuleAddButton
          tile="watch"
          name="Watch API"
          groups={groups}
          onAdd={onAdd}
          placement="board"
        />
      </div>,
    );
    const plus = screen.getByRole("button", { name: "Add module" });
    expect(plus.getAttribute("aria-expanded")).toBe("false");

    // Open: titled for its tile, a group per job in its family, each kind a menu item in its
    // group's family, with its dot and its description, which starts with the dot's word.
    fireEvent.click(plus);
    expect(menu()?.getAttribute("aria-label")).toBe("Add module to Watch API");
    expect(plus.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen
        .getAllByRole("group")
        .map((group) => [group.querySelector("legend")?.textContent, group.dataset.family]),
    ).toEqual([
      ["Requests", "api"],
      ["Data", "data"],
      ["Events", "messaging"],
      ["Files & media", "worker"],
      ["Custom", "generic"],
    ]);
    expect(screen.getAllByRole("menuitem")).toHaveLength(13);
    const data = screen.getByRole("menuitem", { name: "Data access" });
    expect(data.dataset.family).toBe("data");
    const described = document.getElementById(data.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe("Building block. Reads and writes one database.");
    const dot = (name: string) =>
      screen.getByRole("menuitem", { name }).querySelector(".lane-generation-dot");
    expect(
      ["Auth guard", "Data access", "Rate limiter"].map((name) => [
        dot(name)?.getAttribute("data-generation"),
        dot(name)?.getAttribute("title"),
      ]),
    ).toEqual([
      ["lead", "Generated"],
      ["part", "Building block"],
      ["stub", "You write it"],
    ]);
    // Under the last group, the legend: each dot, its word and what it means.
    const legend = menu()?.querySelector(".lane-module-menu-legend");
    expect(
      [...(legend?.querySelectorAll("li") ?? [])].map((item) => [
        item.querySelector(".lane-generation-dot")?.getAttribute("data-generation"),
        item.textContent,
      ]),
    ).toEqual([
      ["lead", "Generated. Jeeves writes working code; you fill in one short hooks file."],
      [
        "part",
        "Building block. Generated once a Generated module is connected to it. Until then, you write it.",
      ],
      ["stub", "You write it. An empty, typed file for your own code."],
    ]);
    expect(legend?.previousElementSibling?.querySelector("legend")?.textContent).toBe("Custom");
    // A press inside the menu keeps it open.
    fireEvent.pointerDown(data);
    expect(menu()).not.toBeNull();

    // The `+` again closes it.
    fireEvent.click(plus);
    expect(menu()).toBeNull();
    // A press anywhere else closes it.
    fireEvent.click(plus);
    fireEvent.pointerDown(document.body);
    expect(menu()).toBeNull();
    // So do the wheel and Escape.
    fireEvent.click(plus);
    fireEvent.wheel(document.body);
    expect(menu()).toBeNull();
    fireEvent.click(plus);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(menu()).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();

    // A pick closes it and reports the tile and the kind.
    fireEvent.click(plus);
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Data access" }));
    });
    expect(onAdd).toHaveBeenCalledWith("watch", "data-access");
    expect(menu()).toBeNull();
  });

  it("shows on every addable container and the selected Simple tile, only on the live canvas", () => {
    const adding: ModuleAdding = {
      groups: (tile) => (tile === "watch" ? groups : undefined),
      add: () => {},
    };
    const live = (selected: string | undefined, children: ReactNode) => (
      <BoardModuleAdding value={{ ...adding, selected }}>{children}</BoardModuleAdding>
    );
    const plus = (container: HTMLElement) =>
      container.querySelectorAll('button[aria-label="Add module"]').length;

    // A container that can take modules, selected or not, with or without rows.
    let view = render(
      live(undefined, <ContainerTile id="watch" name="Watch API" rows={[]} addable />),
    );
    expect(plus(view.container)).toBe(1);
    cleanup();
    // One that can't, a diagram export and Connect mode (no context) have none.
    view = render(live(undefined, <ContainerTile id="watch" name="Watch API" rows={[]} />));
    expect(plus(view.container)).toBe(0);
    cleanup();
    view = render(<ContainerTile id="watch" name="Watch API" rows={[]} addable />);
    expect(plus(view.container)).toBe(0);
    cleanup();

    // A Simple tile only while selected, and only one that can take modules.
    view = render(
      live("watch", <Tile id="watch" kind="service" name="Watch API" label="Service" />),
    );
    expect(plus(view.container)).toBe(1);
    cleanup();
    view = render(live("other", <Tile id="watch" kind="service" name="Watch API" />));
    expect(plus(view.container)).toBe(0);
    cleanup();
    view = render(live("cache", <Tile id="cache" kind="cache" name="Hot metadata" />));
    expect(plus(view.container)).toBe(0);
  });
});

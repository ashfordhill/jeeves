// Connection sentences follow the actual direction of each action. Clicking a row opens its other endpoint.
import { designBlueprint, laneGraph, studioArchitectureExample } from "@jeeves/spec";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { laneNodeName } from "./LaneCanvas.tsx";
import { ConnectionList, connectionUses } from "./TileInspector.tsx";

afterEach(cleanup);

const design = studioArchitectureExample("studio-tinyurl").design;
const graph = laneGraph(design);
const name = (id: string) => laneNodeName(design, graph, id);
const rows = () =>
  within(screen.getByRole("list", { name: "Connections" }))
    .getAllByRole("button")
    .map((row) => row.getAttribute("aria-label"));

describe("ConnectionList", () => {
  it("lists a tile's lines, incoming first, each with the blueprint's word", () => {
    render(
      <ConnectionList design={design} graph={graph} id="redirect" name={name} onJump={vi.fn()} />,
    );
    expect(rows()).toEqual([
      "Open link calls Redirect service",
      "Redirect service reads and refills URL cache",
      "Redirect service reads from URL database when the cache has no fresh copy",
      "Redirect service publishes to Click events",
    ]);
    expect(screen.getAllByRole("button")[0]?.querySelector("strong")?.textContent).toBe(
      "Open link",
    );
  });

  it("a click on a row calls jump with the other tile's ID", () => {
    const jump = vi.fn();
    render(<ConnectionList design={design} graph={graph} id="shorten" name={name} onJump={jump} />);
    expect(rows()).toEqual([
      "Shorten calls Shorten service",
      "Shorten service writes to URL database",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Shorten service writes to URL database" }));
    expect(jump).toHaveBeenCalledExactlyOnceWith("url-db");
    fireEvent.click(screen.getByRole("button", { name: "Shorten calls Shorten service" }));
    expect(jump).toHaveBeenLastCalledWith("@upload");
  });

  it("lists an action's lines: the user's, then its entries; a consumer's word", () => {
    render(
      <ConnectionList design={design} graph={graph} id="@download" name={name} onJump={vi.fn()} />,
    );
    expect(rows()).toEqual([
      "User chooses Open link",
      "Open link calls Stats API",
      "Open link calls Redirect service",
    ]);
    cleanup();
    render(
      <ConnectionList design={design} graph={graph} id="analytics" name={name} onJump={vi.fn()} />,
    );
    expect(rows()).toEqual([
      "Analytics worker receives messages from Click events",
      "Analytics worker writes to Analytics store",
    ]);
  });
});

describe("connectionUses", () => {
  it("describes a database as a cache fallback only when all its callers are loaders", () => {
    const shared = structuredClone(design);
    shared.architecture?.studio?.componentConnections?.push({
      id: "another-lookup",
      from: "redirect-responder",
      to: { kind: "element", id: "url-db", via: "redirect-db" },
    });
    expect(connectionUses(shared).get("redirect-cache")).toBe("cache");
    expect(connectionUses(shared).get("redirect-db")).toBe("read");
  });

  it("reads a schema-3 design's words too, which blueprint v2 refuses", () => {
    const foundation = studioArchitectureExample("studio-tinyurl-foundation").design;
    expect(() => designBlueprint(foundation)).toThrow(/Blueprint v2 cannot represent/);
    expect(connectionUses(foundation).get("resolve-cache")).toBe("read-write");
    // Worked out once per design.
    expect(connectionUses(foundation)).toBe(connectionUses(foundation));
  });
});

// A tile's and an action's Connections: one row per line, incoming first, each with From or To, the
// other end's name and kind, and what the line does in the blueprint's words; a click on a row
// jumps to the other end.
import { designBlueprint, laneGraph, studioArchitectureExample } from "@jeeves/spec";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { laneNodeName } from "./LaneCanvas.tsx";
import { ConnectionList, connectionWords } from "./TileInspector.tsx";

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
      "From Open link, Action: calls",
      "To Click events, Message channel: publishes",
      "To URL cache, Cache: writes",
      "To URL database, Database: reads",
    ]);
    const first = screen.getAllByRole("button")[0];
    expect(first?.querySelector(".lane-connection-way")?.textContent).toBe("From");
    expect(first?.querySelector(".lane-connection-name")?.textContent).toBe("Open link · Action");
    expect(first?.querySelector(".lane-connection-word")?.textContent).toBe("calls");
  });

  it("a click on a row calls jump with the other tile's ID", () => {
    const jump = vi.fn();
    render(<ConnectionList design={design} graph={graph} id="shorten" name={name} onJump={jump} />);
    expect(rows()).toEqual(["From Shorten, Action: calls", "To URL database, Database: writes"]);
    fireEvent.click(screen.getByRole("button", { name: "To URL database, Database: writes" }));
    expect(jump).toHaveBeenCalledExactlyOnceWith("url-db");
    fireEvent.click(screen.getByRole("button", { name: "From Shorten, Action: calls" }));
    expect(jump).toHaveBeenLastCalledWith("@upload");
  });

  it("lists an action's lines: the user's, then its entries; a consumer's word", () => {
    render(
      <ConnectionList design={design} graph={graph} id="@download" name={name} onJump={vi.fn()} />,
    );
    expect(rows()).toEqual([
      "From User: calls",
      "To Stats API, Microservice: calls",
      "To Redirect service, Microservice: calls",
    ]);
    cleanup();
    render(
      <ConnectionList design={design} graph={graph} id="analytics" name={name} onJump={vi.fn()} />,
    );
    expect(rows()).toEqual([
      "From Click events, Message channel: consumes",
      "To Analytics store, Database: writes",
    ]);
  });
});

describe("connectionWords", () => {
  it("reads a schema-3 design's words too, which blueprint v2 refuses", () => {
    const foundation = studioArchitectureExample("studio-tinyurl-foundation").design;
    expect(() => designBlueprint(foundation)).toThrow(/Blueprint v2 cannot represent/);
    expect(connectionWords(foundation).get("resolve-cache")).toBe("reads");
    // Worked out once per design.
    expect(connectionWords(foundation)).toBe(connectionWords(foundation));
  });
});

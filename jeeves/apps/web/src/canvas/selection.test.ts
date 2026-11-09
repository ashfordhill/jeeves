// The open module is view state that lives only while its host tile and itself exist.
import {
  applyOperations,
  buildStudioCommand,
  laneGraph,
  studioArchitectureExample,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { liveSelection } from "./selection.ts";

const design = studioArchitectureExample("studio-youtube").design;
const graph = laneGraph(design);

describe("liveSelection", () => {
  it("keeps an open module only with its own host tile", () => {
    expect(
      liveSelection(design, graph, { tile: "transcoder", module: "transcoder-encoder" }),
    ).toEqual({ tile: "transcoder", module: "transcoder-encoder" });
    // Another tile's module, or a module without a tile, is not open.
    expect(liveSelection(design, graph, { tile: "upload", module: "transcoder-encoder" })).toEqual({
      tile: "upload",
    });
    expect(liveSelection(design, graph, { module: "transcoder-encoder" })).toEqual({});
    expect(liveSelection(design, graph, { line: "transcoder-read" })).toEqual({
      line: "transcoder-read",
    });
  });

  it("falls back from a removed module to its tile, and from a removed tile to none", () => {
    const removed = applyOperations(
      design,
      buildStudioCommand(design, { type: "removeComponent", components: ["transcoder-encoder"] })
        .ops,
    );
    if (!removed.ok) throw new Error(removed.errors.map((item) => item.message).join(" "));
    expect(
      liveSelection(removed.design, laneGraph(removed.design), {
        tile: "transcoder",
        module: "transcoder-encoder",
      }),
    ).toEqual({ tile: "transcoder" });
    expect(liveSelection(design, graph, { tile: "gone", module: "transcoder-encoder" })).toEqual(
      {},
    );
  });
});

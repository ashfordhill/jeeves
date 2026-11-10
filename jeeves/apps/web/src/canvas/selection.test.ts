// The open module is view state that lives only while its host tile and itself exist, and the
// Detailed view's drawn lines map to and from canonical relationships; an open module marks its
// own drawn lines, its row and its in-process partners' rows.
import {
  applyOperations,
  buildStudioCommand,
  designSchema,
  laneGraph,
  studioArchitectureExample,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import v2 from "../../../../../field-projects/youtube/v2/inputs/design.json" with { type: "json" };
import { detailedView } from "./detailedView.ts";
import { laneNodeName } from "./LaneCanvas.tsx";
import { canonicalLine, drawnSelection, liveSelection } from "./selection.ts";

const design = studioArchitectureExample("studio-youtube").design;
const graph = laneGraph(design);
const view = detailedView(design, graph, (id) => laneNodeName(design, graph, id));

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

describe("Detailed view selection", () => {
  it("maps a drawn line to its canonical relationship", () => {
    expect(canonicalLine(view.connectionOf, "transcoder-write/transcoder-thumbnails")).toBe(
      "transcoder-write",
    );
    expect(canonicalLine(view.connectionOf, "completions-handler/handler-consumer")).toBe(
      "completions-handler",
    );
    // An unanchored line already is its relationship, and so is a canonical ID.
    expect(canonicalLine(view.connectionOf, "cdn-transcoded")).toBe("cdn-transcoded");
    expect(canonicalLine(view.connectionOf, "transcoder-write")).toBe("transcoder-write");
  });

  it("shows a selected relationship as all of its drawn lines, the clicked one selected", () => {
    const both = ["transcoder-write/transcoder-packager", "transcoder-write/transcoder-thumbnails"];
    expect(view.linesOf("transcoder-write")).toEqual(both);
    // Selected elsewhere (diagnostics, chat, Undo): the first drawn line, the rest highlighted.
    expect(drawnSelection(view, { line: "transcoder-write" })).toEqual({
      selected: { line: both[0] },
      highlighted: [both[1]],
      selectedTileLines: true,
    });
    expect(drawnSelection(view, { line: "transcoder-write" }, both[1])).toEqual({
      selected: { line: both[1] },
      highlighted: [both[0]],
      selectedTileLines: true,
    });
    // A click on another relationship's line doesn't pick this one's.
    expect(
      drawnSelection(view, { line: "transcoder-write" }, "transcoder-read/transcoder-encoder")
        .selected,
    ).toEqual({ line: both[0] });
    // A tile stays the tile, with all its lines; nothing selected stays nothing.
    expect(drawnSelection(view, { tile: "transcoder", line: undefined })).toEqual({
      selected: { tile: "transcoder" },
      highlighted: [],
      selectedTileLines: true,
    });
    expect(drawnSelection(view, {})).toEqual({
      selected: {},
      highlighted: [],
      selectedTileLines: true,
    });
  });

  it("round-trips every drawn line through its relationship", () => {
    // 25 relationships drawn as 26 lines; detailed-view.spec.ts counts them on the canvas.
    expect(graph.edges).toHaveLength(25);
    expect(view.lines).toHaveLength(26);
    for (const line of view.lines) {
      const connection = canonicalLine(view.connectionOf, line.id);
      expect(
        graph.edges.some((edge) => edge.id === connection),
        line.id,
      ).toBe(true);
      const shown = drawnSelection(view, { line: connection }, line.id);
      expect(shown.selected).toEqual({ line: line.id });
      expect([shown.selected.line, ...shown.highlighted].sort()).toEqual(
        [...view.linesOf(connection)].sort(),
      );
    }
  });
});

describe("an open module in the Detailed view", () => {
  it("keeps its host selected but marks only its own drawn lines, its row and its partners", () => {
    // The Packager writes Transcoded videos; the Thumbnailer's line of that relationship is not
    // the Packager's, and neither are the Transcoder's other lines.
    expect(drawnSelection(view, { tile: "transcoder", module: "transcoder-packager" })).toEqual({
      selected: { tile: "transcoder" },
      highlighted: ["transcoder-write/transcoder-packager"],
      selectedTileLines: false,
      rows: { open: "transcoder-packager", partners: ["transcoder-encoder", "transcoder-done"] },
    });
    // A module drawn with no line of its own: its host's lines stay plain, its partners marked.
    expect(drawnSelection(view, { tile: "view-counter", module: "counter-sum" })).toEqual({
      selected: { tile: "view-counter" },
      highlighted: [],
      selectedTileLines: false,
      rows: { open: "counter-sum", partners: ["counter-consumer", "counter-writer"] },
    });
    // Another tile's module is not open there; the tile shows as a plain selected tile.
    expect(drawnSelection(view, { tile: "upload", module: "transcoder-packager" })).toEqual({
      selected: { tile: "upload" },
      highlighted: [],
      selectedTileLines: true,
    });
  });

  it("marks every drawn line of a module and none of its siblings' (v2 Video lifecycle worker)", () => {
    const field = designSchema.parse(structuredClone(v2));
    const fieldGraph = laneGraph(field);
    const fieldView = detailedView(field, fieldGraph, (id) => laneNodeName(field, fieldGraph, id));
    const open = (module: string) =>
      drawnSelection(fieldView, { tile: "completion-handler", module });
    expect(open("handler-publications").highlighted).toEqual([
      "handler-metadata/handler-publications",
      "handler-publication/handler-publications",
    ]);
    expect(open("handler-writer").highlighted).toEqual(["handler-metadata/handler-writer"]);
    expect(open("handler-writer").rows).toEqual({ open: "handler-writer", partners: [] });
  });
});

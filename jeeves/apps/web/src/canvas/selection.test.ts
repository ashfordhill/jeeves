// The open module is view state that lives only while its host tile and itself exist, and the
// Detailed view's drawn lines map to and from canonical relationships; an open module marks only
// its own drawn lines and its own row.
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
import {
  canonicalLine,
  drawnSelection,
  followKeys,
  followSelection,
  liveSelection,
} from "./selection.ts";

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

describe("a selection after a rename re-keyed IDs", () => {
  const renamed = [
    { from: "worker-service", to: "video-worker" },
    { from: "worker-service-custom", to: "video-worker-custom" },
  ];
  it("moves the tile and its open module to their new IDs; a line keeps its ID", () => {
    expect(
      followSelection({ tile: "worker-service", module: "worker-service-custom" }, renamed),
    ).toEqual({ tile: "video-worker", module: "video-worker-custom" });
    const line = { line: "upload-worker-service" };
    expect(followSelection(line, renamed)).toBe(line);
    const other = { tile: "cache" };
    expect(followSelection(other, renamed)).toBe(other);
  });

  it("keeps each page's key on its new ID and gives the old ID a fresh one, both ways", () => {
    const keys = followKeys({}, renamed, 3);
    expect(keys).toEqual({
      "video-worker": "worker-service",
      "worker-service": "worker-service~3",
      "video-worker-custom": "worker-service-custom",
      "worker-service-custom": "worker-service-custom~3",
    });
    // Undo moves the IDs back, last first: the page keeps the same key again.
    const back = followKeys(
      keys,
      renamed.toReversed().map(({ from, to }) => ({ from: to, to: from })),
      4,
    );
    expect(back["worker-service"]).toBe("worker-service");
    expect(back["worker-service-custom"]).toBe("worker-service-custom");
    expect(back["video-worker"]).toBe("video-worker~4");
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
    const writes = ["transcoder-packager:out", "transcoder-thumbnails:out"];
    expect(drawnSelection(view, { line: "transcoder-write" })).toEqual({
      selected: { line: both[0] },
      highlighted: [both[1]],
      selectedTileLines: true,
      lit: writes,
    });
    expect(drawnSelection(view, { line: "transcoder-write" }, both[1])).toEqual({
      selected: { line: both[1] },
      highlighted: [both[0]],
      selectedTileLines: true,
      lit: writes,
    });
    // A click on another relationship's line doesn't pick this one's.
    expect(
      drawnSelection(view, { line: "transcoder-write" }, "transcoder-read/transcoder-encoder")
        .selected,
    ).toEqual({ line: both[0] });
    // A tile stays the tile, with all its lines (and their row ports); nothing stays nothing.
    expect(drawnSelection(view, { tile: "transcoder", line: undefined })).toEqual({
      selected: { tile: "transcoder" },
      highlighted: [],
      selectedTileLines: true,
      lit: [
        "transcoder-consumer:in",
        "transcoder-encoder:out",
        "transcoder-packager:out",
        "transcoder-thumbnails:out",
        "transcoder-done:out",
      ],
    });
    expect(drawnSelection(view, {})).toEqual({
      selected: {},
      highlighted: [],
      selectedTileLines: true,
      lit: [],
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
  it("keeps its host selected but marks only its own drawn lines and its own row", () => {
    // The Packager writes Transcoded videos; the Thumbnailer's line of that relationship is not
    // the Packager's, and neither are the Transcoder's other lines.
    expect(drawnSelection(view, { tile: "transcoder", module: "transcoder-packager" })).toEqual({
      selected: { tile: "transcoder" },
      highlighted: ["transcoder-write/transcoder-packager"],
      selectedTileLines: false,
      open: "transcoder-packager",
      lit: ["transcoder-packager:out"],
    });
    // A module drawn with no line of its own: its host's lines stay plain, and the modules it
    // links with in its tile are not marked.
    expect(drawnSelection(view, { tile: "view-counter", module: "counter-sum" })).toEqual({
      selected: { tile: "view-counter" },
      highlighted: [],
      selectedTileLines: false,
      open: "counter-sum",
      lit: [],
    });
    // Another tile's module is not open there; the tile shows as a plain selected tile.
    expect(drawnSelection(view, { tile: "upload", module: "transcoder-packager" })).toEqual(
      drawnSelection(view, { tile: "upload" }),
    );
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
    expect(open("handler-writer").open).toBe("handler-writer");
    expect(open("handler-writer").lit).toEqual(["handler-writer:out"]);
  });

  it("lights a row's port marks whenever its line is blue, whatever selected it (v2)", () => {
    const field = designSchema.parse(structuredClone(v2));
    const fieldGraph = laneGraph(field);
    const fieldView = detailedView(field, fieldGraph, (id) => laneNodeName(field, fieldGraph, id));
    const rowPorts = (shown: { lit: readonly string[] }) =>
      shown.lit.filter((port) => port.startsWith("handler-"));
    // The Metadata database selected: its lines from the worker's writer and outbox rows are blue.
    expect(rowPorts(drawnSelection(fieldView, { tile: "metadata-db" }))).toEqual([
      "handler-writer:out",
      "handler-publications:out",
    ]);
    // One relationship selected: only its own row's port, not the row's other line's.
    expect(drawnSelection(fieldView, { line: "handler-publication" }).lit).toEqual([
      "handler-publications:out",
    ]);
    // The tile at the other end of the consumer's line.
    expect(rowPorts(drawnSelection(fieldView, { tile: "completion-events" }))).toEqual([
      "handler-consumer:in",
    ]);
  });
});

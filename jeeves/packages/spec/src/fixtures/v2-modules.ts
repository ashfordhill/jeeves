/**
 * YouTube v2 rebuilt with the lane and module commands (module authoring contract, section 3):
 * v2's tiles, links and 22 modules with v2's own IDs and names, and its tile-level twin, v2's
 * seven installed selections. Read-only: the frozen inputs are never edited.
 */
import frozenV2 from "../../../../../field-projects/youtube/v2/inputs/design.json" with {
  type: "json",
};
import { applyOperations } from "../apply.ts";
import { type DesignDocument, designSchema, emptyDesign } from "../design.ts";
import type { StudioComponentKind, StudioModuleSlotId } from "../studio-components.ts";
import type { StudioKind } from "../studio-model.ts";
import { buildStudioCommand, type StudioCommand } from "../studio-operations.ts";

/** The frozen v2 design, parsed. */
export const frozenV2Design = () => designSchema.parse(structuredClone(frozenV2));

export function runStudioCommand(design: DesignDocument, command: StudioCommand): DesignDocument {
  const batch = buildStudioCommand(design, command);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
export const runStudioCommands = (design: DesignDocument, commands: readonly StudioCommand[]) =>
  commands.reduce((current, command) => runStudioCommand(current, command), design);

const v2Element = (id: string) => {
  const design = frozenV2Design();
  const element = design.elements.find((item) => item.id === id);
  const kind = design.architecture?.studio?.elements.find((item) => item.element === id)?.settings
    .kind;
  if (!element || !kind) throw new Error(id);
  return { id, name: element.name, kind: kind as StudioKind };
};
const tile = (from: string, id: string, linkId: string): StudioCommand => ({
  type: "addTile",
  from:
    from === "lane:download" || from === "lane:upload"
      ? { lane: from === "lane:download" ? "download" : "upload" }
      : { tile: from },
  side: "after",
  tile: v2Element(id),
  linkId,
});
const link = (from: string, to: string, linkId: string): StudioCommand => ({
  type: "linkTiles",
  from: { tile: from },
  to,
  linkId,
});
/** A module with v2's name for its ID, or the kind's fresh name. */
export const addV2Module = (host: string, id: string, kind: StudioComponentKind): StudioCommand => {
  const name = frozenV2Design().architecture?.studio?.components?.find(
    (item) => item.id === id,
  )?.name;
  return { type: "addModule", host, kind, id, ...(name && { name }) };
};
export const connectModule = (
  module: string,
  slot: StudioModuleSlotId,
  target: { tile: string } | { module: string },
): StudioCommand => ({ type: "connectModule", module, slot, target });
const add = addV2Module;
const connect = connectModule;

/** v2's actions, tiles and links as lane commands, with v2's own IDs, from a blank design. */
export const v2TileCommands: readonly StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Watch", system: { name: "YouTube" } },
  { type: "addAction", lane: "upload", name: "Publish" },
  tile("lane:download", "watch", "download-watch"),
  tile("watch", "metadata-cache", "watch-cache"),
  tile("watch", "metadata-db", "watch-metadata"),
  tile("watch", "view-counts", "watch-counts-read"),
  tile("watch", "view-events", "watch-views-publish"),
  tile("view-events", "view-counter", "views-counter"),
  link("view-counter", "view-counts", "counter-write"),
  tile("lane:download", "search", "download-search"),
  tile("search", "search-index", "search-read"),
  tile("lane:download", "video-cdn", "download-video-cdn"),
  tile("lane:upload", "identity", "upload-identity"),
  tile("lane:upload", "upload", "upload-service"),
  link("upload", "metadata-db", "upload-state"),
  tile("upload", "originals", "upload-originals"),
  tile("upload", "upload-queue", "upload-publish"),
  tile("upload-queue", "transcoder", "jobs-transcoder"),
  link("transcoder", "originals", "transcoder-read"),
  tile("transcoder", "transcoded", "transcoder-write"),
  link("video-cdn", "transcoded", "cdn-transcoded"),
  tile("transcoder", "completion-events", "transcoder-publish"),
  tile("completion-events", "completion-handler", "completions-handler"),
  link("completion-handler", "metadata-db", "handler-metadata"),
  tile("completion-handler", "publication-events", "handler-publication"),
  tile("publication-events", "search-indexer", "publications-indexer"),
  link("search-indexer", "search-index", "indexer-write"),
];
/** v2's tiles and links, built with the lane commands. */
export const v2Tiles = (): DesignDocument => runStudioCommands(emptyDesign(), v2TileCommands);

/** v2's 22 modules under the contract's kinds (section 3), added and connected by command. */
export const v2Modules: readonly StudioCommand[] = [
  add("watch", "watch-cache-reader", "cache-reader"),
  add("watch", "watch-details", "data-access"),
  add("watch", "watch-counts", "data-access"),
  add("watch", "watch-views", "event-publisher"),
  connect("watch-cache-reader", "cache", { tile: "metadata-cache" }),
  connect("watch-details", "database", { tile: "metadata-db" }),
  connect("watch-cache-reader", "loader", { module: "watch-details" }),
  connect("watch-counts", "database", { tile: "view-counts" }),
  connect("watch-views", "channel", { tile: "view-events" }),
  add("view-counter", "counter-consumer", "event-consumer"),
  add("view-counter", "counter-sum", "event-counter"),
  add("view-counter", "counter-writer", "data-access"),
  connect("counter-consumer", "channel", { tile: "view-events" }),
  connect("counter-writer", "database", { tile: "view-counts" }),
  add("search", "search-query", "search-query"),
  connect("search-query", "index", { tile: "search-index" }),
  add("upload", "upload-auth", "auth-guard"),
  add("upload", "upload-multipart", "multipart-uploads"),
  add("upload", "upload-jobs", "event-publisher"),
  add("upload", "upload-state-writer", "data-access"),
  connect("upload-auth", "identity", { tile: "identity" }),
  connect("upload-multipart", "objects", { tile: "originals" }),
  connect("upload-jobs", "channel", { tile: "upload-queue" }),
  connect("upload-jobs", "outbox", { tile: "metadata-db" }),
  connect("upload-state-writer", "database", { tile: "metadata-db" }),
  add("transcoder", "transcoder-consumer", "event-consumer"),
  add("transcoder", "transcoder-encoder", "video-encoder"),
  add("transcoder", "transcoder-packager", "video-packager"),
  add("transcoder", "transcoder-thumbnails", "video-thumbnailer"),
  add("transcoder", "transcoder-done", "event-publisher"),
  connect("transcoder-consumer", "channel", { tile: "upload-queue" }),
  connect("transcoder-encoder", "originals", { tile: "originals" }),
  connect("transcoder-packager", "outputs", { tile: "transcoded" }),
  connect("transcoder-thumbnails", "outputs", { tile: "transcoded" }),
  connect("transcoder-done", "channel", { tile: "completion-events" }),
  add("completion-handler", "handler-consumer", "event-consumer"),
  add("completion-handler", "handler-writer", "lifecycle-writer"),
  add("completion-handler", "handler-publications", "event-publisher"),
  connect("handler-consumer", "channel", { tile: "completion-events" }),
  connect("handler-writer", "state", { tile: "metadata-db" }),
  connect("handler-publications", "channel", { tile: "publication-events" }),
  connect("handler-publications", "outbox", { tile: "metadata-db" }),
  add("search-indexer", "indexer-consumer", "event-consumer"),
  add("search-indexer", "indexer-writer", "index-writer"),
  connect("indexer-consumer", "channel", { tile: "publication-events" }),
  connect("indexer-writer", "index", { tile: "search-index" }),
];

/** v2 authored with modules: its tiles, then its 22 modules connected. */
export const v2ModuleDesign = () => runStudioCommands(v2Tiles(), v2Modules);

/**
 * The stub stack (tile process contract, section 8): a design built only of stub modules, with
 * every kind of store and channel a stub can use. Built by commands from a blank design; module
 * IDs are their names' slugs, so routes and files read `/modules/<module id>`.
 */
import { type DesignDocument, emptyDesign } from "../design.ts";
import type { StudioComponentKind, StudioModuleSlotId } from "../studio-components.ts";
import type { StudioKind } from "../studio-model.ts";
import type { StudioCommand } from "../studio-operations.ts";
import { runStudioCommands } from "./v2-modules.ts";

const tile = (from: string, id: string, name: string, kind: StudioKind): StudioCommand => ({
  type: "addTile",
  from:
    from === "lane:download" || from === "lane:upload"
      ? { lane: from === "lane:download" ? "download" : "upload" }
      : { tile: from },
  side: "after",
  tile: { id, name, kind },
  linkId: `${from.replace("lane:", "")}-${id}`,
});
const link = (from: string, to: string): StudioCommand => ({
  type: "linkTiles",
  from: { tile: from },
  to,
  linkId: `${from}-${to}`,
});
const module = (host: string, id: string, name: string, kind: StudioComponentKind) =>
  ({ type: "addModule", host, kind, id, name }) satisfies StudioCommand;
const connect = (
  id: string,
  slot: StudioModuleSlotId,
  target: { tile: string } | { module: string },
): StudioCommand => ({ type: "connectModule", module: id, slot, target });

/** The stack's actions, tiles and links. Visits is a topic; Uploaded stays a work queue. */
export const stubStackTileCommands: readonly StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Visit", system: { name: "Stub stack" } },
  { type: "addAction", lane: "upload", name: "Upload" },
  tile("lane:download", "links-api", "Links API", "service"),
  tile("links-api", "links-db", "Links database", "database"),
  tile("links-api", "links-cache", "Links cache", "cache"),
  tile("links-api", "visits", "Visits", "queue"),
  {
    type: "edit",
    element: "visits",
    settings: { kind: "queue", mode: "topic", provider: "unspecified" },
  },
  tile("visits", "visit-worker", "Visit worker", "worker"),
  link("visit-worker", "links-db"),
  tile("links-api", "stats-api", "Stats API", "service"),
  tile("stats-api", "stats-index", "Stats index", "search"),
  tile("lane:upload", "upload-api", "Upload API", "uploads"),
  tile("upload-api", "archive", "Archive", "object-store"),
  link("visit-worker", "archive"),
  tile("upload-api", "uploaded", "Uploaded", "queue"),
];

/** Its 13 modules, every one a stub, added and connected by command. */
export const stubStackModuleCommands: readonly StudioCommand[] = [
  module("links-api", "link-reader", "Link reader", "data-access"),
  module("links-api", "link-cache", "Link cache", "cache-reader"),
  module("links-api", "limiter", "Limiter", "rate-limiter"),
  module("links-api", "visit-publisher", "Visit publisher", "event-publisher"),
  module("links-api", "redirector", "Redirector", "redirect-responder"),
  module("links-api", "stats-caller", "Stats caller", "external-call"),
  module("links-api", "upload-consumer", "Upload consumer", "event-consumer"),
  connect("link-reader", "database", { tile: "links-db" }),
  connect("link-cache", "loader", { module: "link-reader" }),
  connect("limiter", "store", { tile: "links-cache" }),
  connect("visit-publisher", "channel", { tile: "visits" }),
  connect("stats-caller", "target", { tile: "stats-api" }),
  // A consumer link from a downstream queue back to Links API would loop its lane, so the Upload
  // lane's queue feeds it.
  connect("upload-consumer", "channel", { tile: "uploaded" }),
  module("stats-api", "stats-search", "Stats search", "search-query"),
  connect("stats-search", "index", { tile: "stats-index" }),
  module("upload-api", "archive-upload", "Archive upload", "multipart-uploads"),
  module("upload-api", "upload-publisher", "Upload publisher", "event-publisher"),
  connect("archive-upload", "objects", { tile: "archive" }),
  connect("upload-publisher", "channel", { tile: "uploaded" }),
  module("visit-worker", "visit-consumer", "Visit consumer", "event-consumer"),
  module("visit-worker", "visit-writer", "Visit writer", "data-access"),
  module("visit-worker", "archiver", "Archiver", "custom"),
  connect("visit-consumer", "channel", { tile: "visits" }),
  connect("visit-writer", "database", { tile: "links-db" }),
  connect("archiver", "uses", { tile: "archive" }),
];

/** The stub stack: its tiles, then its 13 stub modules connected. */
export const stubStackDesign = (): DesignDocument =>
  runStudioCommands(
    runStudioCommands(emptyDesign(), stubStackTileCommands),
    stubStackModuleCommands,
  );

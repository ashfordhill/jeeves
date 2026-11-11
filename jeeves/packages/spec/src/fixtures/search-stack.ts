/**
 * The search stack (V3-08): mounted search fed by events, a CDN in front of public object storage,
 * and two stub consumers of one topic in one tile. Built by commands from a blank design; module
 * IDs are their names' slugs.
 *
 * - Catalog API: a cache read on Catalog (the template that writes the outbox's database), an
 *   Event publisher stub with its outbox there feeding Item events, and an Image writer stub on
 *   public Images.
 * - Indexer: the Index writer on Items index, fed by Item events. Search API: Item search on it.
 * - Auditor: two stub consumers of Item events, each on its own subscriber queue.
 * - Image delivery: a CDN in front of Images.
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

export const searchStackTileCommands: readonly StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Find", system: { name: "Search stack" } },
  { type: "addAction", lane: "upload", name: "Publish" },
  tile("lane:download", "search-api", "Search API", "service"),
  tile("search-api", "items-index", "Items index", "search"),
  tile("lane:download", "image-delivery", "Image delivery", "cdn"),
  tile("lane:upload", "catalog-api", "Catalog API", "service"),
  tile("catalog-api", "catalog", "Catalog", "database"),
  tile("catalog-api", "catalog-cache", "Catalog cache", "cache"),
  tile("catalog-api", "images", "Images", "object-store"),
  {
    type: "edit",
    element: "images",
    settings: { kind: "object-store", provider: "unspecified", access: "public" },
  },
  link("image-delivery", "images"),
  tile("catalog-api", "item-events", "Item events", "queue"),
  {
    type: "edit",
    element: "item-events",
    settings: { kind: "queue", mode: "topic", provider: "unspecified" },
  },
  tile("item-events", "indexer", "Indexer", "worker"),
  link("indexer", "items-index"),
  tile("item-events", "auditor", "Auditor", "worker"),
];

export const searchStackModuleCommands: readonly StudioCommand[] = [
  module("catalog-api", "item-cache", "Item cache", "cache-reader"),
  module("catalog-api", "item-reader", "Item reader", "data-access"),
  module("catalog-api", "item-publisher", "Item publisher", "event-publisher"),
  module("catalog-api", "image-writer", "Image writer", "custom"),
  connect("item-cache", "cache", { tile: "catalog-cache" }),
  connect("item-reader", "database", { tile: "catalog" }),
  connect("item-cache", "loader", { module: "item-reader" }),
  connect("item-publisher", "channel", { tile: "item-events" }),
  connect("item-publisher", "outbox", { tile: "catalog" }),
  connect("image-writer", "uses", { tile: "images" }),
  module("indexer", "item-consumer", "Item consumer", "event-consumer"),
  module("indexer", "index-writer", "Index writer", "index-writer"),
  connect("item-consumer", "channel", { tile: "item-events" }),
  connect("index-writer", "index", { tile: "items-index" }),
  module("search-api", "item-search", "Item search", "search-query"),
  connect("item-search", "index", { tile: "items-index" }),
  module("auditor", "item-auditor", "Item auditor", "event-consumer"),
  module("auditor", "item-notifier", "Item notifier", "event-consumer"),
  connect("item-auditor", "channel", { tile: "item-events" }),
  connect("item-notifier", "channel", { tile: "item-events" }),
];

/** The search stack: its tiles, then its modules connected. */
export const searchStackDesign = (): DesignDocument =>
  runStudioCommands(
    runStudioCommands(emptyDesign(), searchStackTileCommands),
    searchStackModuleCommands,
  );

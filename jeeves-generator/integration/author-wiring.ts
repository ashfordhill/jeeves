/** Development authoring only: the saved graph uses the studio's actual commands. */
import { writeFile } from "node:fs/promises";
import {
  emptyDesign,
  type StudioCommand,
  type StudioComponentKind,
  type StudioKind,
  type StudioModuleSlotId,
} from "@jeeves/spec";
import { runStudioCommands } from "../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

// Adapt stub-stack's service/store clients and search-stack's two topic subscribers, plus
// stubStackCacheReadCommands' installed positive reader. No alternative topology specification.
const tile = (from: string, id: string, name: string, kind: StudioKind): StudioCommand => ({
  type: "addTile",
  from: from === "entry" ? { lane: "download" } : { tile: from },
  side: "after",
  tile: { id, name, kind },
  linkId: `${from}-${id}`,
});
const module = (
  host: string,
  id: string,
  name: string,
  kind: StudioComponentKind,
): StudioCommand => ({ type: "addModule", host, id, name, kind });
const connect = (
  id: string,
  slot: StudioModuleSlotId,
  target: string,
  module = false,
): StudioCommand => ({
  type: "connectModule",
  module: id,
  slot,
  target: module ? { module: target } : { tile: target },
});
const commands: StudioCommand[] = [
  {
    type: "addAction",
    lane: "download",
    name: "Exercise wiring",
    system: { name: "Wiring" },
  },
  tile("entry", "wiring-api", "Wiring API", "service"),
  tile("entry", "catalog-api", "Catalog API", "service"),
  tile("entry", "publisher-api", "Publisher API", "service"),
  tile("catalog-api", "catalog", "Catalog", "database"),
  tile("catalog-api", "catalog-cache", "Catalog cache", "cache"),
  {
    type: "edit",
    element: "catalog-cache",
    settings: {
      kind: "cache",
      engine: "redis-compatible",
      provider: "unspecified",
      ttlSeconds: 4,
    },
  },
  tile("wiring-api", "objects", "Objects", "object-store"),
  tile("wiring-api", "items-index", "Items index", "search"),
  tile("wiring-api", "internal-api", "Internal API", "service"),
  tile("internal-api", "vault", "Vault", "object-store"),
  tile("wiring-api", "partner", "Partner", "external-api"),
  tile("publisher-api", "broadcasts", "Broadcasts", "queue"),
  {
    type: "edit",
    element: "broadcasts",
    settings: { kind: "queue", mode: "topic", provider: "unspecified" },
  },
  tile("broadcasts", "fanout", "Fanout", "worker"),
  tile("fanout", "fanout-db", "Fanout database", "database"),
  tile("publisher-api", "jobs", "Jobs", "queue"),
  {
    type: "edit",
    element: "jobs",
    settings: { kind: "queue", mode: "work-queue", provider: "unspecified" },
  },
  tile("jobs", "workers", "Workers", "worker"),
  tile("workers", "work-db", "Work database", "database"),
  module("wiring-api", "echo", "Echo", "data-access"),
  module("wiring-api", "forward", "Forward", "cache-reader"),
  connect("forward", "loader", "echo", true),
  module("wiring-api", "internal-call", "Internal call", "external-call"),
  connect("internal-call", "target", "internal-api"),
  module("wiring-api", "external-call", "External call", "external-call"),
  connect("external-call", "target", "partner"),
  module("wiring-api", "object-roundtrip", "Object roundtrip", "custom"),
  connect("object-roundtrip", "uses", "objects"),
  module("wiring-api", "find-item", "Find item", "search-query"),
  connect("find-item", "index", "items-index"),
  module("publisher-api", "publish", "Publish", "custom"),
  connect("publish", "uses", "broadcasts"),
  connect("publish", "uses", "jobs"),
  module("catalog-api", "catalog-read", "Catalog read", "cache-reader"),
  module("catalog-api", "catalog-source", "Catalog source", "data-access"),
  module("catalog-api", "catalog-writer", "Catalog writer", "data-access"),
  connect("catalog-read", "cache", "catalog-cache"),
  connect("catalog-source", "database", "catalog"),
  connect("catalog-read", "loader", "catalog-source", true),
  connect("catalog-writer", "database", "catalog"),
  module("internal-api", "transform", "Transform", "custom"),
  connect("transform", "uses", "vault"),
  // `uses` follows the existing incoming consume link, so these custom bodies receive messages
  // and real generated database dependencies together; they implement only a domain SQL insert.
  module("fanout", "audit", "Audit", "custom"),
  connect("audit", "uses", "broadcasts"),
  connect("audit", "uses", "fanout-db"),
  module("fanout", "notify", "Notify", "custom"),
  connect("notify", "uses", "broadcasts"),
  connect("notify", "uses", "fanout-db"),
  module("workers", "work", "Work", "custom"),
  connect("work", "uses", "jobs"),
  connect("work", "uses", "work-db"),
  { type: "setRunnableProcesses", on: true },
];
const design = runStudioCommands(emptyDesign(), commands);
await writeFile(
  new URL("../../field-projects/generator-system/fixtures/wiring/design.json", import.meta.url),
  `${JSON.stringify(design, null, 2)}\n`,
);

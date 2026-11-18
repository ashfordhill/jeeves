import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { remoteDurableWorkDesign } from "../rg-durable-work/design.ts";

/** Catalog ingestion, native durable replication and receipt projection; no UI/provider pack. */
export async function catalogDesign() {
  const design = runStudioCommands(await remoteDurableWorkDesign(), [
    { type: "addModule", host: "caller", kind: "webhook-receiver", id: "catalog-events" },
    {
      type: "connectModule",
      module: "catalog-events",
      slot: "state",
      target: { tile: "caller-db" },
    },
    {
      type: "addTile",
      from: { tile: "caller" },
      side: "after",
      tile: { id: "events", name: "Catalog events", kind: "queue" },
      linkId: "publish-events",
    },
    {
      type: "addTile",
      from: { tile: "events" },
      side: "after",
      tile: { id: "projector", name: "Catalog projector", kind: "worker" },
      linkId: "projector-events",
    },
    { type: "shareOwner", worker: "projector", api: "caller" },
    { type: "addModule", host: "projector", kind: "event-consumer", id: "apply-catalog" },
    { type: "connectModule", module: "apply-catalog", slot: "channel", target: { tile: "events" } },
    {
      type: "connectModule",
      module: "apply-catalog",
      slot: "state",
      target: { tile: "caller-db" },
    },
    {
      type: "setDatabaseAccess",
      role: "caller",
      database: "caller-db",
      product: {
        tables: [
          { name: "items", operations: ["SELECT", "INSERT", "UPDATE"] },
          { name: "inbox", operations: ["SELECT", "INSERT", "UPDATE"] },
        ],
        views: [],
      },
    },
    {
      type: "setDatabaseAccess",
      role: "projector",
      database: "caller-db",
      product: {
        tables: [{ name: "deliveries", operations: ["SELECT", "INSERT", "UPDATE"] }],
        views: [],
      },
    },
    {
      type: "setDatabaseAccess",
      role: "callee",
      database: "callee-db",
      product: {
        tables: [{ name: "items", operations: ["SELECT", "INSERT", "UPDATE"] }],
        views: [],
      },
    },
  ]);
  const caller = design.architecture.studio?.elements.find((row) => row.element === "caller");
  if (caller?.settings.kind !== "service") throw Error("Missing caller source");
  caller.settings.requestTimeoutMs = 10000;
  return design;
}

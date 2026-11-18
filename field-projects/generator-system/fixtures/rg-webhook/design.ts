import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** Generic HMAC ingress with its own durable processor and owned product state; no queue. */
export function webhookDesign() {
  return runStudioCommands(emptyDesign(), [
    {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      tile: { id: "events-api", name: "Events API", kind: "service" },
      linkId: "events-entry",
      system: { name: "Authenticated events" },
    },
    { type: "addModule", host: "events-api", kind: "webhook-receiver", id: "receive-events" },
    {
      type: "addTile",
      from: { tile: "events-api" },
      side: "after",
      tile: { id: "event-state", name: "Event state", kind: "database" },
      linkId: "events-state",
    },
    {
      type: "connectModule",
      module: "receive-events",
      slot: "state",
      target: { tile: "event-state" },
    },
    {
      type: "setDatabaseAccess",
      role: "events-api",
      database: "event-state",
      product: { tables: [{ name: "items", operations: ["SELECT", "INSERT"] }], views: [] },
    },
    { type: "setRunnableProcesses", on: true },
  ]);
}

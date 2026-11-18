import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

export function receiptDesign() {
  return runStudioCommands(emptyDesign(), [
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "source", name: "Source", kind: "service" },
      linkId: "source-entry",
      system: { name: "Receipt consumers" },
    },
    {
      type: "addTile",
      from: { tile: "source" },
      side: "after",
      tile: { id: "events", name: "Events", kind: "queue" },
      linkId: "publish-events",
    },
    {
      type: "addTile",
      from: { tile: "events" },
      side: "after",
      tile: { id: "counter", name: "Counter", kind: "worker" },
      linkId: "counter-events",
    },
    {
      type: "addTile",
      from: { tile: "counter" },
      side: "after",
      tile: { id: "totals", name: "Totals", kind: "database" },
      linkId: "counter-totals",
    },
    { type: "addModule", host: "counter", kind: "event-consumer", id: "counter-input" },
    { type: "connectModule", module: "counter-input", slot: "channel", target: { tile: "events" } },
    { type: "addModule", host: "counter", kind: "event-counter", id: "count-events" },
    { type: "addModule", host: "counter", kind: "data-access", id: "counter-state" },
    {
      type: "connectModule",
      module: "counter-state",
      slot: "database",
      target: { tile: "totals" },
    },
    {
      type: "addTile",
      from: { tile: "events" },
      side: "after",
      tile: { id: "projector", name: "Projector", kind: "worker" },
      linkId: "projector-events",
    },
    {
      type: "addTile",
      from: { tile: "projector" },
      side: "after",
      tile: { id: "items", name: "Items", kind: "database" },
      linkId: "projector-items",
    },
    { type: "addModule", host: "projector", kind: "event-consumer", id: "apply-item" },
    { type: "connectModule", module: "apply-item", slot: "channel", target: { tile: "events" } },
    { type: "connectModule", module: "apply-item", slot: "state", target: { tile: "items" } },
    {
      type: "setDatabaseAccess",
      role: "projector",
      database: "items",
      product: { tables: [{ name: "items", operations: ["SELECT", "INSERT"] }], views: [] },
    },
    { type: "setRunnableProcesses", on: true },
  ]);
}

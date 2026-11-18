import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** Two independently runnable timer hosts, explicitly sharing an owner's product state. No queue. */
export function scheduledDesign() {
  return runStudioCommands(emptyDesign(), [
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "maintenance-api", name: "Maintenance API", kind: "service" },
      linkId: "maintenance-entry",
      system: { name: "Scheduled reconciliation" },
    },
    { type: "addModule", host: "maintenance-api", kind: "scheduled-task", id: "service-task" },
    {
      type: "addTile",
      from: { tile: "maintenance-api" },
      side: "after",
      tile: { id: "state", name: "State", kind: "database" },
      linkId: "api-state",
    },
    {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      tile: { id: "maintenance-worker", name: "Maintenance worker", kind: "worker" },
      linkId: "worker-entry",
    },
    { type: "connectModule", module: "service-task", slot: "state", target: { tile: "state" } },
    { type: "shareOwner", worker: "maintenance-worker", api: "maintenance-api" },
    {
      type: "connectModule",
      module: "maintenance-worker-scheduled-task",
      slot: "state",
      target: { tile: "state" },
    },
    {
      type: "setDatabaseAccess",
      role: "maintenance-api",
      database: "state",
      product: { tables: [{ name: "items", operations: ["SELECT", "INSERT"] }], views: [] },
    },
    {
      type: "setDatabaseAccess",
      role: "maintenance-worker",
      database: "state",
      product: { tables: [{ name: "items", operations: ["SELECT", "UPDATE"] }], views: [] },
    },
  ]);
}

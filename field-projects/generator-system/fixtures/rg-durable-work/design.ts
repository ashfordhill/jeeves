import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** RG15: a durable item intent completes under the generated database lease and fence. */
export const durableWorkDesign = () =>
  runStudioCommands(emptyDesign(), [
    {
      type: "addAction",
      lane: "download",
      name: "Create",
      system: { name: "Durable work fixture" },
    },
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "items-api", name: "Items API", kind: "service" },
      linkId: "create-items",
    },
    {
      type: "addTile",
      from: { tile: "items-api" },
      side: "after",
      tile: { id: "items-db", name: "Items database", kind: "database" },
      linkId: "api-db",
    },
    {
      type: "addModule",
      host: "items-api",
      id: "create-item",
      name: "Create item",
      kind: "data-access",
    },
    {
      type: "connectModule",
      module: "create-item",
      slot: "database",
      target: { tile: "items-db" },
    },
    {
      type: "addModule",
      host: "items-api",
      id: "item-caller",
      name: "Item caller",
      kind: "cache-reader",
    },
    {
      type: "connectModule",
      module: "item-caller",
      slot: "loader",
      target: { module: "create-item" },
    },
    {
      type: "setDatabaseAccess",
      role: "items-api",
      database: "items-db",
      product: {
        tables: [{ name: "items", operations: ["SELECT", "INSERT"] }],
        views: [],
      },
    },
    { type: "setRunnableProcesses", on: true },
  ]);

export async function remoteDurableWorkDesign() {
  const { workloadDesign } = await import("../rg-workload/design.ts");
  return runStudioCommands(workloadDesign(), [
    {
      type: "addTile",
      from: { tile: "caller" },
      side: "after",
      tile: { id: "caller-db", name: "Caller DB", kind: "database" },
      linkId: "caller-db-link",
    },
    {
      type: "addTile",
      from: { tile: "callee" },
      side: "after",
      tile: { id: "callee-db", name: "Callee DB", kind: "database" },
      linkId: "callee-db-link",
    },
    { type: "connectModule", module: "send", slot: "uses", target: { tile: "caller-db" } },
    { type: "connectModule", module: "receive", slot: "uses", target: { tile: "callee-db" } },
    {
      type: "setDatabaseAccess",
      role: "caller",
      database: "caller-db",
      product: { tables: [{ name: "items", operations: ["INSERT", "SELECT"] }], views: [] },
    },
    {
      type: "setDatabaseAccess",
      role: "callee",
      database: "callee-db",
      product: { tables: [{ name: "items", operations: ["INSERT", "SELECT"] }], views: [] },
    },
  ]);
}

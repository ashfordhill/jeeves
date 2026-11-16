import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** RG10: one local operation owns its registered mutation and private replay together. */
export const localOperationDesign = () =>
  runStudioCommands(emptyDesign(), [
    {
      type: "addAction",
      lane: "download",
      name: "Create",
      system: { name: "Local operation fixture" },
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
      product: { tables: [{ name: "items", operations: ["SELECT", "INSERT"] }], views: [] },
    },
    { type: "setRunnableProcesses", on: true },
  ]);

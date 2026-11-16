import { stubStackDesign } from "../../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** RG06: three independent processes; an API explicitly shares product state with its worker. */
export const ownershipDesign = () =>
  runStudioCommands(stubStackDesign(), [
    { type: "shareOwner", worker: "visit-worker", api: "links-api" },
    {
      type: "setDatabaseAccess",
      role: "links-api",
      database: "links-db",
      product: {
        tables: [{ name: "items", operations: ["SELECT", "INSERT"] }],
        views: [],
      },
    },
    {
      type: "setDatabaseAccess",
      role: "visit-worker",
      database: "links-db",
      product: {
        tables: [{ name: "items", operations: ["SELECT", "UPDATE"] }],
        views: [],
      },
    },
    {
      type: "addModule",
      host: "stats-api",
      kind: "data-access",
      id: "published-reader",
      name: "Published reader",
    },
    {
      type: "connectModule",
      module: "published-reader",
      slot: "database",
      target: { tile: "links-db" },
    },
    {
      type: "setDatabaseAccess",
      role: "stats-api",
      database: "links-db",
      product: { tables: [], views: ["visible_items"] },
    },
    { type: "setRunnableProcesses", on: true },
  ]);

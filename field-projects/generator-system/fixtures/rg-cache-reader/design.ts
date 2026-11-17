import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { stubStackCacheReadCommands } from "../../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** Same mechanism with immutable manuals or mutable redirect-like records; no product rebuild. */
export const cacheReaderDesign = (
  freshness: "immutable-positive" | "versioned" = "immutable-positive",
  transport: "http" | "in-process" = "in-process",
) =>
  runStudioCommands(emptyDesign(), [
    { type: "addAction", lane: "download", name: "Read", system: { name: "Cache reader fixture" } },
    ...stubStackCacheReadCommands,
    {
      type: "editComponent",
      component: "preview-reader",
      settings: {
        kind: "cache-reader",
        pattern: "cache-aside",
        stampede: "single-flight",
        freshness,
        transport,
      },
    },
    {
      type: "addModule",
      host: "preview-api",
      id: "read-record",
      kind: "custom",
      name: "Read record",
    },
    {
      type: "connectModule",
      module: "read-record",
      slot: "read",
      target: { module: "preview-reader" },
    },
    {
      type: "setDatabaseAccess",
      role: "preview-api",
      database: "previews-db",
      product: { tables: [{ name: "records", operations: ["SELECT"] }], views: [] },
    },
    { type: "setRunnableProcesses", on: true },
  ]);

/** RG08: two product operations share one private ring file with distinct purposes/modes. */
import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
export const keysDesign = () =>
  runStudioCommands(emptyDesign(), [
    { type: "addAction", lane: "download", name: "Read", system: { name: "Keys fixture" } },
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "items-api", name: "Items API", kind: "service" },
      linkId: "read-items",
    },
    {
      type: "addTile",
      from: { tile: "items-api" },
      side: "after",
      tile: { id: "items-cache", name: "Items cache", kind: "cache" },
      linkId: "api-items-cache",
    },
    { type: "addModule", host: "items-api", id: "cursor", name: "Cursor", kind: "custom" },
    { type: "addModule", host: "items-api", id: "receipt", name: "Receipt", kind: "custom" },
    { type: "connectModule", module: "cursor", slot: "uses", target: { tile: "items-cache" } },
    { type: "setRunnableProcesses", on: true },
  ]);

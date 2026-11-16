import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { ownershipDesign } from "../rg-ownership/design.ts";

/** Two same-owner modules plus an independent shared-owner worker and published reader. */
export const productSqlDesign = () =>
  runStudioCommands(ownershipDesign(), [
    {
      type: "addModule",
      host: "links-api",
      kind: "data-access",
      id: "second-product",
      name: "Second product operation",
    },
    {
      type: "connectModule",
      module: "second-product",
      slot: "database",
      target: { tile: "links-db" },
    },
  ]);

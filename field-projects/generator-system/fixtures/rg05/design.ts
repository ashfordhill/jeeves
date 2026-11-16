/** RG05: existing Favorites core called by one Custom operation in the same process. */
import { favoritesStackDesign } from "../../../../jeeves/packages/spec/src/fixtures/favorites-stack.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
export const callableDesign = () =>
  runStudioCommands(favoritesStackDesign(), [
    {
      type: "addModule",
      host: "account-api",
      kind: "custom",
      id: "favorite-summary",
      name: "Favorite summary",
      description: "Reads the signed-in account's Favorites through the declared callable handle.",
    },
    {
      type: "connectModule",
      module: "favorite-summary",
      slot: "call",
      target: { module: "favorite-items" },
    },
  ]);

/** Development authoring: reuse Favorites and Sign-in's Optional guard through studio commands. */
import { writeFile } from "node:fs/promises";
import { favoritesStackDesign } from "../../jeeves/packages/spec/src/fixtures/favorites-stack.ts";
import { signIn } from "../../jeeves/packages/spec/src/fixtures/sign-in-stack.ts";
import { runStudioCommands } from "../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

const base = runStudioCommands(favoritesStackDesign(), [
  {
    type: "addTile",
    from: { lane: "download" },
    side: "after",
    tile: { id: "viewer-api", name: "Viewer API", kind: "service" },
    linkId: "download-viewer-api",
  },
  { type: "linkTiles", from: { tile: "viewer-api" }, to: "sign-in", linkId: "viewer-sign-in" },
  {
    type: "addModule",
    host: "viewer-api",
    id: "viewer-check",
    name: "Viewer check",
    kind: "auth-guard",
  },
  { type: "connectModule", module: "viewer-check", slot: "identity", target: { tile: "sign-in" } },
]);
const design = runStudioCommands(base, [signIn(base, "viewer-check", "optional")]);
await writeFile(
  new URL("../../field-projects/generator-system/fixtures/identity/design.json", import.meta.url),
  `${JSON.stringify(design, null, 2)}\n`,
);

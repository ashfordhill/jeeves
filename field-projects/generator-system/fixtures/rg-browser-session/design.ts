import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
export function browserSessionDesign() {
  return runStudioCommands(emptyDesign(), [
    {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      tile: { id: "browser-api", name: "Browser API", kind: "service" },
      linkId: "browser-entry",
      system: { name: "Browser session proof" },
    },
    { type: "addModule", host: "browser-api", kind: "browser-session", id: "sign-in" },
    { type: "addModule", host: "browser-api", kind: "custom", id: "account" },
    {
      type: "addTile",
      from: { tile: "browser-api" },
      side: "after",
      tile: { id: "sessions", name: "Sessions", kind: "database" },
      linkId: "session-state",
    },
    { type: "connectModule", module: "sign-in", slot: "state", target: { tile: "sessions" } },
    {
      type: "addTile",
      from: { tile: "browser-api" },
      side: "after",
      tile: { id: "identity", name: "Identity", kind: "identity" },
      linkId: "session-identity",
    },
    { type: "connectModule", module: "sign-in", slot: "identity", target: { tile: "identity" } },
    { type: "setRunnableProcesses", on: true },
  ]);
}

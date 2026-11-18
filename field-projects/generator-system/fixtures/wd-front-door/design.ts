import { emptyDesign } from "../../../../jeeves/packages/spec/src/design.ts";
import { runStudioCommands } from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";

/** WD10 input; no historical fixture mutation or completed product claim. */
export function frontDoorDesign(frontDoor?: "required" | "none") {
  const design = runStudioCommands(emptyDesign(), [
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "front", name: "Public API", kind: "service" },
      linkId: "entry-front",
      system: { name: "WD10 front door" },
    },
    { type: "addModule", host: "front", id: "echo", name: "Echo", kind: "custom" },
    { type: "setRunnableProcesses", on: true },
  ]);
  const binding = design.architecture?.studio?.elements.find((row) => row.element === "front");
  if (binding?.settings.kind !== "service") throw Error("Missing fixture service");
  binding.settings.exposure = "public";
  if (frontDoor !== undefined) binding.settings.frontDoor = frontDoor;
  return design;
}

/** A public required callee retains workload and Required user guards on internal adapters. */
export function frontDoorWorkloadDesign() {
  const design = runStudioCommands(frontDoorDesign("required"), [
    {
      type: "addTile",
      from: { tile: "front" },
      side: "after",
      tile: { id: "callee", name: "Protected API", kind: "service" },
      linkId: "front-callee",
    },
    {
      type: "addTile",
      from: { tile: "callee" },
      side: "after",
      tile: { id: "issuer", name: "Issuer", kind: "identity" },
      linkId: "callee-issuer",
    },
    { type: "linkTiles", from: { tile: "front" }, to: "issuer", linkId: "front-issuer" },
    { type: "addModule", host: "callee", id: "receive", name: "Receive", kind: "custom" },
    { type: "connectModule", module: "echo", slot: "uses", target: { tile: "callee" } },
    { type: "connectModule", module: "echo", slot: "workload", target: { tile: "issuer" } },
    { type: "connectModule", module: "receive", slot: "workload", target: { tile: "issuer" } },
    {
      type: "addModule",
      host: "front",
      id: "front-auth",
      name: "Required caller user",
      kind: "auth-guard",
    },
    { type: "connectModule", module: "front-auth", slot: "identity", target: { tile: "issuer" } },
    { type: "addModule", host: "callee", id: "auth", name: "Required user", kind: "auth-guard" },
    { type: "connectModule", module: "auth", slot: "identity", target: { tile: "issuer" } },
  ]);
  const callee = design.architecture?.studio?.elements.find((row) => row.element === "callee");
  if (callee?.settings.kind !== "service") throw Error("Missing callee");
  callee.settings.exposure = "public";
  callee.settings.frontDoor = "required";
  return design;
}

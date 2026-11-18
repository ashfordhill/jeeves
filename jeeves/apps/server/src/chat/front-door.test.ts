import {
  applyOperations,
  buildSupportedAuthoringCommand,
  emptyDesign,
  normalSettingFields,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { frontDoorDesign } from "../../../../../field-projects/generator-system/fixtures/wd-front-door/design.ts";
import { installedGenerationSupport } from "../generation/support.ts";
import { Workspace } from "./tools.ts";

const run = (workspace: Workspace, name: string, args: unknown = {}) =>
  JSON.parse(workspace.run(name, JSON.stringify(args)));
describe("WD10 normal authoring and offline chat", () => {
  it("creates a new public service required with identical mouse and chat operations", () => {
    const source = emptyDesign();
    const command = {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "public-api", name: "Public API", kind: "service" },
      linkId: "entry-public",
      system: { name: "WD10 defaults" },
    } as const;
    const mouse = applyOperations(
      source,
      buildSupportedAuthoringCommand(source, command, installedGenerationSupport()).ops,
    );
    if (!mouse.ok) throw Error("Mouse creation refused");
    const chat = new Workspace(source);
    expect(
      run(chat, "applyStudioCommands", { baseRevision: source.revision, commands: [command] }).ok,
    ).toBe(true);
    expect(chat.working).toEqual(mouse.design);
    expect(chat.working.architecture?.studio?.elements[0]?.settings).toMatchObject({
      exposure: "public",
      frontDoor: "required",
    });
  });
  it("offers and saves both finite values with blueprint/generation parity and refuses others", () => {
    const source = frontDoorDesign();
    const controls = normalSettingFields(source, installedGenerationSupport(), {
      element: "front",
    });
    expect(controls.find((c) => c.input === "process.frontDoor")).toMatchObject({
      value: "none",
      supported: { values: ["required", "none"] },
    });
    const chat = new Workspace(source);
    for (const value of ["required", "none"] as const) {
      const before = chat.working;
      const binding = before.architecture?.studio?.elements.find((b) => b.element === "front");
      if (binding?.settings.kind !== "service") throw Error("Missing front");
      const mouse = applyOperations(
        before,
        buildSupportedAuthoringCommand(
          before,
          { type: "edit", element: "front", settings: { ...binding.settings, frontDoor: value } },
          installedGenerationSupport(),
        ).ops,
      );
      if (!mouse.ok) throw Error("Mouse setting refused");
      expect(
        run(chat, "applyStudioCommands", {
          baseRevision: before.revision,
          commands: [{ type: "setSetting", tile: "front", setting: "frontDoor", value }],
        }).ok,
      ).toBe(true);
      expect(chat.working).toEqual(mouse.design);
      expect(JSON.stringify(run(chat, "getDesign"))).toContain('"frontDoor"');
    }
    const before = chat.working;
    expect(
      run(chat, "applyStudioCommands", {
        baseRevision: before.revision,
        commands: [{ type: "setSetting", tile: "front", setting: "frontDoor", value: "optional" }],
      }).ok,
    ).toBe(false);
    expect(chat.working).toEqual(before);
  });
  it("hides the control on internal services and vendor identity tiles", async () => {
    const { deploymentDesign } = await import(
      "../../../../../field-projects/generator-system/fixtures/wd-deployment/design.ts"
    );
    const design = deploymentDesign();
    for (const element of ["catalog", "issuer"])
      expect(
        normalSettingFields(design, installedGenerationSupport(), { element }).some(
          (c) => c.sourcePaths[0]?.at(-1) === "frontDoor",
        ),
      ).toBe(false);
    const chat = new Workspace(design);
    expect(
      run(chat, "applyStudioCommands", {
        baseRevision: design.revision,
        commands: [{ type: "setSetting", tile: "issuer", setting: "frontDoor", value: "required" }],
      }).ok,
    ).toBe(false);
  });
});

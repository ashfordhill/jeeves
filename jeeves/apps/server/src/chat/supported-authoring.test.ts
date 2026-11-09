import { assembleV2, loadLocalV2Dependencies, loadLocalV2Registry } from "@jeeves/generator";
import {
  applyOperations,
  buildGenerationPresetCommand,
  buildSupportedAuthoringCommand,
  emptyDesign,
  generationExportBlockers,
  normalSettingFields,
  studioArchitectureExample,
  supportedGenerationPresets,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { Workspace } from "./tools.ts";

const registry = loadLocalV2Registry();
const historical = () => {
  const base = emptyDesign();
  const result = applyOperations(
    base,
    buildGenerationPresetCommand(base, { preset: "youtube" }).ops,
  );
  if (!result.ok) throw Error();
  return result.design;
};
const apply = (
  design: ReturnType<typeof emptyDesign>,
  command: Parameters<typeof buildSupportedAuthoringCommand>[1],
) => {
  const result = applyOperations(
    design,
    buildSupportedAuthoringCommand(design, command, registry.installed).ops,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
const run = (workspace: Workspace, commands: unknown[]) =>
  JSON.parse(
    workspace.run(
      "applyStudioCommands",
      JSON.stringify({ baseRevision: workspace.base.revision, commands }),
    ),
  );

describe("installed feature authoring", () => {
  it("shares atomic attachment and authoritative TTL editing with chat and actual generated constructors", () => {
    const base = emptyDesign();
    const attach = { type: "attachGenerationPreset" as const, preset: "video" as const };
    const attached = apply(base, attach);
    const attachmentChat = new Workspace(base);
    expect(run(attachmentChat, [attach]).ok).toBe(true);
    expect(attachmentChat.working).toEqual(attached);
    expect(
      run(new Workspace(base), [{ type: "attachGenerationPreset", preset: "youtube" }]).ok,
    ).toBe(false);
    const design = historical();
    const chat = new Workspace(design);
    const row = design.architecture?.studio?.elements.find(
      (row) => row.element === "metadata-cache",
    );
    if (row?.settings.kind !== "cache") throw new Error("Missing cache");
    const controls = normalSettingFields(design, registry.installed, { element: row.element });
    expect(controls.map((control) => control.input)).toEqual(["cache.ttlSeconds"]);
    expect(
      normalSettingFields(design, registry.installed, { component: "watch-cache-reader" }),
    ).toEqual([]);
    const edit = {
      type: "edit" as const,
      element: row.element,
      settings: { ...row.settings, ttlSeconds: 420 },
    };
    const changed = apply(design, edit);
    expect(run(chat, [edit]).ok).toBe(true);
    expect(chat.working).toEqual(changed);
    expect(generationExportBlockers(changed, registry.installed)).toEqual([]);
    expect(
      changed.architecture?.studio?.components?.find(
        (component) => component.settings.kind === "cache-reader",
      )?.settings,
    ).toMatchObject({ l2TtlSeconds: 420 });
    const before = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const after = assembleV2({ designJson: JSON.stringify(changed) }, registry);
    const output = (bundle: typeof before) =>
      new TextDecoder().decode(
        bundle.files.find((file) => file.path === "src/features/application-bindings.ts")?.bytes,
      );
    expect(output(before)).not.toBe(output(after));
    expect(output(after)).toContain('"cache.ttlSeconds":420');
    expect(after.report.applicationComplete).toBe(false);
    const consumer = new TextDecoder().decode(
      after.files.find((file) => file.path === "src/features/service-resources.ts")?.bytes,
    );
    expect(consumer).toContain('ttlSeconds: input(s, "cache.ttlSeconds")');
  });
  it("fails closed for an uninstalled preset, hidden alternatives, mirror editing and custom modules, preserving historical source", () => {
    expect(supportedGenerationPresets(loadLocalV2Dependencies().installed)).toEqual([]);
    const base = emptyDesign();
    const uninstalled = new Workspace(base, base, { templates: [] });
    expect(run(uninstalled, [{ type: "attachGenerationPreset", preset: "youtube" }])).toMatchObject(
      { ok: false, error: expect.stringContaining("not installed") },
    );
    expect(uninstalled.pending).toEqual([]);
    const design = historical();
    const row = design.architecture?.studio?.elements.find((row) => row.element === "upload");
    if (row?.settings.kind !== "uploads") throw new Error();
    const chat = new Workspace(design);
    expect(
      run(chat, [
        { type: "edit", element: row.element, settings: { ...row.settings, language: "go" } },
      ]).ok,
    ).toBe(false);
    expect(
      run(chat, [
        {
          type: "createComponent",
          component: { id: "custom", host: "upload", name: "Custom", settings: { kind: "custom" } },
        },
      ]).ok,
    ).toBe(false);
    const mirror = design.architecture?.studio?.components?.find(
      (row) => row.id === "watch-cache-reader",
    );
    if (mirror?.settings.kind !== "cache-reader") throw new Error();
    expect(
      run(chat, [
        {
          type: "editComponent",
          component: mirror.id,
          settings: { ...mirror.settings, l2TtlSeconds: 421 },
        },
      ]).ok,
    ).toBe(false);
    expect(chat.working).toEqual(design);
    const legacy = studioArchitectureExample("studio-youtube").design;
    const preserved = structuredClone(legacy);
    expect(normalSettingFields(legacy, registry.installed, { element: "upload" })).toEqual([]);
    expect(legacy).toEqual(preserved);
    const renamed = apply(legacy, { type: "edit", element: "upload", name: "Preserved upload" });
    expect(renamed.architecture?.studio).toEqual(legacy.architecture?.studio);
    expect(renamed.connections).toEqual(legacy.connections);
  });
});

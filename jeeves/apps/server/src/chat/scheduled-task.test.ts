import { buildSupportedAuthoringCommand, designBlueprintV3, resolveGeneration } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { scheduledDesign } from "../../../../../field-projects/generator-system/fixtures/rg-scheduled/design.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";
import { Workspace } from "./tools.ts";

const installed = loadLocalV2Registry().installed;
describe("RG16 offline chat/mouse/export parity", () => {
  it("advertises Scheduled task and uses the same consumed interval controls as the inspector", () => {
    const source = scheduledDesign();
    const workspace = new Workspace(source);
    const catalog = workspace.run("listStudioDefinitions", "{}");
    expect(catalog).toContain("scheduled-task");
    const applied = JSON.parse(
      workspace.run(
        "applyStudioCommands",
        JSON.stringify({
          commands: [
            { type: "setSetting", module: "service-task", setting: "intervalSeconds", value: 5 },
            {
              type: "setSetting",
              module: "maintenance-worker-scheduled-task",
              setting: "intervalSeconds",
              value: 300,
            },
          ],
        }),
      ),
    );
    expect(applied).toMatchObject({ ok: true, commands: 2 });
    const resolved = resolveGeneration(workspace.working, installed);
    expect(resolved.findings).toEqual([]);
    expect(
      resolved.model?.selections
        .filter((s) => s.binding.kind === "scheduled-task")
        .map((s) => s.inputs["task.intervalSeconds"]),
    ).toEqual([5, 300]);
    expect(JSON.stringify(designBlueprintV3(workspace.working))).toContain('"intervalSeconds":300');
    expect(() =>
      buildSupportedAuthoringCommand(
        source,
        {
          type: "editComponent",
          component: "service-task",
          settings: { kind: "scheduled-task", intervalSeconds: 5 },
        },
        installed,
      ),
    ).not.toThrow();
    for (const [setting, value] of [
      ["intervalSeconds", 0],
      ["cron", "* * * * *"],
      ["maxAttempts", 100],
    ] as const) {
      const refused = JSON.parse(
        workspace.run(
          "applyStudioCommands",
          JSON.stringify({
            commands: [{ type: "setSetting", module: "service-task", setting, value }],
          }),
        ),
      );
      expect(refused.ok).toBe(false);
    }
  });
});

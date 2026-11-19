import { designBlueprintV3, resolveGeneration } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { webhookDesign } from "../../../../../field-projects/generator-system/fixtures/rg-webhook/design.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";
import { Workspace } from "./tools.ts";

describe("RG17 offline webhook authoring parity", () => {
  it("selects Stripe and its limits on older source and refuses verifier and retry overrides", () => {
    const workspace = new Workspace(webhookDesign());
    expect(workspace.run("listStudioDefinitions", "{}")).toContain("webhook-receiver");
    const apply = (setting: string, value: unknown) =>
      JSON.parse(
        workspace.run(
          "applyStudioCommands",
          JSON.stringify({
            commands: [{ type: "setSetting", module: "receive-events", setting, value }],
          }),
        ),
      );
    expect(apply("signatureFormat", "stripe")).toMatchObject({ ok: true });
    expect(apply("bodyLimitBytes", "262144")).toMatchObject({ ok: true });
    expect(apply("replayWindowSeconds", 60)).toMatchObject({ ok: true });
    const result = resolveGeneration(workspace.working, loadLocalV2Registry().installed);
    expect(result.findings).toEqual([]);
    expect(
      result.model?.selections.find((s) => s.binding.kind === "webhook-receiver")?.inputs,
    ).toMatchObject({
      "webhook.signatureFormat": "stripe",
      "webhook.bodyLimitBytes": "262144",
      "webhook.replayWindowSeconds": 60,
    });
    expect(JSON.stringify(designBlueprintV3(workspace.working))).toContain(
      '"replayWindowSeconds":60',
    );
    expect(JSON.stringify(designBlueprintV3(workspace.working))).toContain(
      '"signatureFormat":"stripe"',
    );
    for (const [field, value] of [
      ["signatureFormat", "arbitrary"],
      ["bodyLimitBytes", "1048576"],
      ["replayWindowSeconds", 301],
      ["provider", "stripe"],
      ["verify", "custom"],
      ["maxAttempts", 100],
      ["ackBeforeStorage", true],
    ] as const)
      expect(apply(field, value).ok).toBe(false);
  });
});

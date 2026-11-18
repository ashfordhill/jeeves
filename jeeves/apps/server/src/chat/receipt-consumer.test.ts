import { designBlueprintV3, normalSettingFields, resolveGeneration } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { receiptDesign } from "../../../../../field-projects/generator-system/fixtures/rg-receipts/design.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";
import { Workspace } from "./tools.ts";

describe("RG18 receipt authoring parity", () => {
  it("consumes the finite horizon in mouse/chat/blueprint/export and exposes optional owned consumer state", () => {
    const workspace = new Workspace(receiptDesign());
    const registry = loadLocalV2Registry();
    const catalog = workspace.run("listStudioDefinitions", "{}");
    expect(catalog).toContain("event-counter");
    expect(workspace.run("getDesign", "{}")).toContain("deliveryHorizonSeconds");
    const apply = (setting: string, value: unknown) =>
      JSON.parse(
        workspace.run(
          "applyStudioCommands",
          JSON.stringify({
            commands: [{ type: "setSetting", module: "count-events", setting, value }],
          }),
        ),
      );
    expect(apply("deliveryHorizonSeconds", 86400)).toMatchObject({ ok: true });
    const resolved = resolveGeneration(workspace.working, registry.installed);
    expect(resolved.findings).toEqual([]);
    expect(
      resolved.model?.selections.find((s) => s.binding.kind === "event-counter")?.inputs[
        "receipt.deliveryHorizonSeconds"
      ],
    ).toBe(86400);
    expect(
      normalSettingFields(workspace.working, registry.installed, { component: "count-events" }).map(
        (c) => c.input,
      ),
    ).toContain("receipt.deliveryHorizonSeconds");
    expect(JSON.stringify(designBlueprintV3(workspace.working))).toContain(
      '"deliveryHorizonSeconds":86400',
    );
    const output = assembleV2({ designJson: JSON.stringify(workspace.working) }, registry);
    const read = (path: string) =>
      new TextDecoder().decode(output.files.find((f) => f.path === path)?.bytes);
    expect(read("src/processes/counter.ts")).toContain('"deliveryHorizonSeconds": 86400');
    expect(read("src/processes/counter.ts")).toContain("binding.receiptRetention");
    expect(read("src/processes/projector.ts")).toContain("invokeReceiptConsumer");
    expect(read("src/processes/projector.ts")).toContain("startReceiptConsumer");
    expect(read("src/operations/projector-apply-item-requeue-0.ts")).toContain(
      "UNGUARDED_REQUEUE_UNSUPPORTED",
    );
    const status = read("src/operations/projector-apply-item-receipt-status.ts");
    expect(status).toContain('receipts.status(tx,"apply-item")');
    expect(status).toContain("readOnly:true");
    expect(status).not.toContain("receipts.heartbeat");
    expect(read("src/operations/counter-count-events-receipts.ts")).toContain(
      "requeueCounterQuarantine",
    );
    for (const [setting, value] of [
      ["deliveryHorizonSeconds", 0],
      ["deliveryHorizonSeconds", 604801],
      ["retentionSeconds", 1],
      ["ackBeforeCommit", true],
      ["cleanupBatch", 999999],
    ] as const)
      expect(apply(setting, value).ok).toBe(false);
    const unsupported = receiptDesign();
    const events = unsupported.architecture?.studio?.elements.find(
      (row) => row.element === "events",
    );
    if (events?.settings.kind !== "queue") throw Error("Missing event topic");
    events.settings.provider = "google-cloud";
    const refused = resolveGeneration(unsupported, registry.installed);
    expect(
      refused.findings.some(
        (finding) =>
          finding.code === "NEEDS_TEMPLATE" && finding.message.includes("events.provider"),
      ),
    ).toBe(true);
    expect(() => assembleV2({ designJson: JSON.stringify(unsupported) }, registry)).toThrow(
      "Contribution requires an actual selected local resource",
    );
  });
});

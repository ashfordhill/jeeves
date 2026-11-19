import { designBlueprintV3, normalSettingFields, resolveGeneration } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { retentionDesign } from "../../../../../field-projects/generator-system/fixtures/qr-retention/design.ts";
import { receiptDesign } from "../../../../../field-projects/generator-system/fixtures/rg-receipts/design.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";
import { Workspace } from "./tools.ts";

describe("RG18 receipt authoring parity", () => {
  it("shares optional day and calendar settings with saved blueprints and compiled policies", () => {
    const design = retentionDesign({ pubsub: true });
    const workspace = new Workspace(design);
    const apply = (...commands: Record<string, unknown>[]) =>
      JSON.parse(workspace.run("applyStudioCommands", JSON.stringify({ commands })));
    const setting = (module: string, field: string, value: unknown) => ({
      type: "setSetting",
      module,
      setting: field,
      value,
    });
    expect(apply(setting("aggregate-click", "receiptDays", 30))).toMatchObject({ ok: false });
    expect(
      apply(
        setting("aggregate-click", "replayDays", 30),
        setting("aggregate-click", "receiptDays", 30),
      ),
    ).toMatchObject({ ok: true });
    expect(apply(setting("retention-sweep", "keepDailyTotalsMonths", 12))).toMatchObject({
      ok: true,
    });
    expect(JSON.stringify(designBlueprintV3(workspace.working))).toContain(
      '"keepDailyTotalsMonths":12',
    );
    expect(JSON.stringify(designBlueprintV3(workspace.working))).toContain('"receiptDays":30');
    const registry = loadLocalV2Registry();
    const bundle = assembleV2({ designJson: JSON.stringify(workspace.working) }, registry);
    const file = (path: string) =>
      new TextDecoder().decode(bundle.files.find((entry) => entry.path === path)?.bytes);
    expect(bundle.report.findings).toEqual([]);
    const worker = JSON.parse(file("deploy/contract.json")).processes.find(
      ({ id }: { id: string }) => id === "click-processor",
    );
    expect(worker.receiptConsumers).toEqual([
      {
        module: "aggregate-click",
        deliveryHorizonSeconds: 2592000,
        retentionSeconds: 2592000,
        channels: ["click-events"],
      },
    ]);
    expect(worker.calendarCleanups).toEqual([
      {
        module: "retention-sweep",
        keepDailyTotalsMonths: 12,
        intervalSeconds: 60,
        cutoffTimeZone: "UTC",
      },
    ]);
    expect(
      bundle.report.modules?.find((module) => module.module === "retention-sweep")?.status,
    ).toBe("template");
    expect(
      apply(
        setting("aggregate-click", "receiptDays", null),
        setting("aggregate-click", "replayDays", null),
      ),
    ).toMatchObject({ ok: true });
    expect(apply(setting("retention-sweep", "keepDailyTotalsMonths", null))).toMatchObject({
      ok: true,
    });
    const unconfigured = assembleV2({ designJson: JSON.stringify(workspace.working) }, registry);
    const entry = unconfigured.files.find(
      ({ path }) => path === "src/processes/click-processor.ts",
    );
    expect(new TextDecoder().decode(entry?.bytes)).not.toContain("receiptConsumers[");
  });
  it("consumes the finite horizon in mouse/chat/blueprint/export and exposes optional owned consumer state", () => {
    const workspace = new Workspace(receiptDesign());
    const registry = loadLocalV2Registry();
    const catalog = workspace.run("listStudioDefinitions", "{}");
    expect(catalog).toContain("event-counter");
    expect(
      normalSettingFields(workspace.working, registry.installed, { component: "apply-item" }).map(
        (control) => control.input,
      ),
    ).toEqual(["consumer.replayDays", "consumer.receiptDays"]);
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

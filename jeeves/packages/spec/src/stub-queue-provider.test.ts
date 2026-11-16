import { describe, expect, it } from "vitest";
import { withStubWorkloads } from "../../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import { stubStackDesign } from "./fixtures/stub-stack.ts";
import { runStudioCommands, v2ModuleDesign } from "./fixtures/v2-modules.ts";
import { generationRuntime, generationTemplates } from "./generation-catalog.ts";
import { generationTemplateQueues, resolveGeneration } from "./generation-resolver.ts";
import { type GenerationInstalledSupport, generationCapabilities } from "./generation-support.ts";
import type { StudioCommand } from "./studio-operations.ts";
import { buildSupportedAuthoringCommand, normalSettingFields } from "./supported-authoring.ts";

// Every template with a consumer for each of its settings, as an installed registry lists them.
const installed: GenerationInstalledSupport = {
  runtime: generationRuntime.ref,
  templates: Object.entries(generationTemplates).map(([kind, template]) => ({
    ref: template.ref,
    consumers: [
      { input: "binding", consumer: template.ref.id, outputPaths: ["src/a.ts"] },
      ...generationCapabilities[kind as keyof typeof generationCapabilities].settings.map(
        (rule) => ({ input: rule.input, consumer: rule.consumer, outputPaths: ["src/a.ts"] }),
      ),
    ],
  })),
  processes: true,
};
const on: StudioCommand = { type: "setRunnableProcesses", on: true };
const settingsOf = (design: DesignDocument, element: string) =>
  design.architecture?.studio?.elements.find((row) => row.element === element)?.settings as
    | Record<string, unknown>
    | undefined;
/** The tile edit the Options form and chat send: its complete settings with one value changed. */
const editCommand = (design: DesignDocument, element: string, change: Record<string, unknown>) =>
  ({
    type: "edit",
    element,
    settings: { ...settingsOf(design, element), ...change },
  }) as StudioCommand;
function edit(design: DesignDocument, element: string, change: Record<string, unknown>) {
  const batch = buildSupportedAuthoringCommand(
    design,
    editCommand(design, element, change),
    installed,
  );
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
const index = (design: DesignDocument, element: string) =>
  design.architecture?.studio?.elements.findIndex((row) => row.element === element);
const refusal = "has no installed, useful editable consumer";

describe("a Queue's Provider when only stubs use it (QG07)", () => {
  it("is the queue's normal control while Runnable processes is on, with the values its processes run", () => {
    const off = stubStackDesign();
    expect(normalSettingFields(off, installed, { element: "visits" })).toEqual([]);
    const design = runStudioCommands(off, [on]);
    // Visits: Visit publisher publishes, Visit consumer consumes; both are stubs.
    expect(normalSettingFields(design, installed, { element: "visits" })).toEqual([
      {
        input: "queue.provider",
        sourcePaths: [
          ["architecture", "studio", "elements", index(design, "visits"), "settings", "provider"],
        ],
        origin: "source",
        value: "unspecified",
        supported: { values: ["unspecified", "self-hosted", "google-cloud"] },
        consumer: "stub-channel.provider",
        outputPaths: [
          "compose.yaml",
          "infra/local.json",
          "src/runtime/module-clients.ts",
          "src/processes/links-api.ts",
          "src/processes/visit-worker.ts",
        ],
        status: "supported",
        userNeed: "Choose where this channel runs: self-hosted RabbitMQ or Google Cloud Pub/Sub.",
        normalControl: true,
      },
    ]);
    expect(
      normalSettingFields(design, installed, { element: "uploaded" }).map((item) => item.input),
    ).toEqual(["queue.provider"]);
    // Without an installed processes owner there is no control.
    expect(
      normalSettingFields(design, { ...installed, processes: undefined }, { element: "visits" }),
    ).toEqual([]);
  });

  it("accepts Google Cloud by the supported command and refuses a provider nothing generates", () => {
    const design = runStudioCommands(withStubWorkloads(stubStackDesign()), [on]);
    const cloud = edit(design, "visits", { provider: "google-cloud" });
    expect(settingsOf(cloud, "visits")).toEqual({
      kind: "queue",
      mode: "topic",
      provider: "google-cloud",
    });
    const [control] = normalSettingFields(cloud, installed, { element: "visits" });
    expect(control).toMatchObject({ value: "google-cloud", status: "supported" });
    // The model still resolves with no finding, and the stores keep the saved provider.
    const resolved = resolveGeneration(cloud, installed);
    expect(resolved.findings).toEqual([]);
    expect(
      resolved.model?.processes
        ?.find((row) => row.tile === "links-api")
        ?.stubs.flatMap((stub) => stub.stores ?? [])
        .find((store) => store.element === "visits"),
    ).toMatchObject({ kind: "queue", access: "publish", provider: "google-cloud" });
    // Self-hosted and back again; AWS and the mode have no consumer.
    expect(settingsOf(edit(cloud, "visits", { provider: "self-hosted" }), "visits")).toMatchObject({
      provider: "self-hosted",
    });
    expect(() => edit(design, "visits", { provider: "aws" })).toThrow(`provider ${refusal}`);
    expect(() => edit(design, "visits", { mode: "work-queue" })).toThrow(`mode ${refusal}`);
  });

  it("keeps a saved provider it doesn't support on its control, unsupported, until it is put right", () => {
    const design = runStudioCommands(
      runStudioCommands(withStubWorkloads(stubStackDesign()), [on]),
      [
        {
          type: "edit",
          element: "visits",
          settings: { kind: "queue", mode: "topic", provider: "aws" },
        },
      ],
    );
    expect(normalSettingFields(design, installed, { element: "visits" })).toMatchObject([
      { input: "queue.provider", value: "aws", status: "unsupported", normalControl: true },
    ]);
    expect(
      settingsOf(edit(design, "visits", { provider: "google-cloud" }), "visits"),
    ).toMatchObject({ provider: "google-cloud" });
  });

  it("gives a queue a template uses no control, so Google Cloud stays refused there", () => {
    // View events: Watch views (a stub) publishes, and the event counter template consumes it.
    const design = runStudioCommands(v2ModuleDesign(), [on]);
    const resolved = resolveGeneration(design, installed);
    expect([...generationTemplateQueues(resolved.model?.selections ?? [])]).toContain(
      "view-events",
    );
    expect(
      resolved.model?.processes
        ?.find((row) => row.tile === "watch")
        ?.stubs.find((stub) => stub.module === "watch-views")?.stores,
    ).toMatchObject([{ element: "view-events", kind: "queue", access: "publish" }]);
    expect(resolved.settings.filter((item) => item.input === "queue.provider")).toEqual([]);
    expect(() => edit(design, "view-events", { provider: "google-cloud" })).toThrow(
      `provider ${refusal}`,
    );
    // Saved there anyway (outside the studio's commands): the template's own fixed provider is
    // unsupported, as before.
    const saved = runStudioCommands(design, [
      {
        type: "edit",
        element: "view-events",
        settings: { kind: "queue", mode: "topic", provider: "google-cloud" },
      },
    ]);
    const again = resolveGeneration(saved, installed);
    const path = [
      "architecture",
      "studio",
      "elements",
      index(saved, "view-events"),
      "settings",
      "provider",
    ];
    expect(again.settings.filter((item) => item.input === "queue.provider")).toEqual([]);
    expect(
      again.settings.find((item) => JSON.stringify(item.sourcePaths[0]) === JSON.stringify(path)),
    ).toMatchObject({ input: "events.provider", status: "unsupported", normalControl: false });
    expect(again.findings).toContainEqual(
      expect.objectContaining({
        code: "NEEDS_TEMPLATE",
        target: expect.objectContaining({ path }),
        message: expect.stringContaining("Unsupported events.provider=google-cloud"),
      }),
    );
  });
});

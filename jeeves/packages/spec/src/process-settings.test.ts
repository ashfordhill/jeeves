import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import { emptyDesign } from "./design.ts";
import { searchStackDesign } from "./fixtures/search-stack.ts";
import { signInStackCommands } from "./fixtures/sign-in-stack.ts";
import { stubStackDesign } from "./fixtures/stub-stack.ts";
import { runStudioCommands, v2ModuleDesign } from "./fixtures/v2-modules.ts";
import { generationRuntime, generationTemplates } from "./generation-catalog.ts";
import { resolveGeneration } from "./generation-resolver.ts";
import { type GenerationInstalledSupport, generationCapabilities } from "./generation-support.ts";
import type { StudioCommand } from "./studio-operations.ts";
import {
  buildSupportedAuthoringCommand,
  normalGenerationControls,
  normalSettingFields,
} from "./supported-authoring.ts";

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
/** The tile edit the Options form sends: its complete settings with one value changed. */
function edit(design: DesignDocument, element: string, change: Record<string, unknown>) {
  const settings = { ...settingsOf(design, element), ...change };
  for (const [key, value] of Object.entries(change)) if (value === undefined) delete settings[key];
  const batch = buildSupportedAuthoringCommand(
    design,
    { type: "edit", element, settings } as StudioCommand,
    installed,
  );
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
const controls = (design: DesignDocument, element: string) =>
  normalSettingFields(design, installed, { element }).map((item) => [
    item.input,
    item.value,
    item.origin,
  ]);
const process = (design: DesignDocument, tile: string) =>
  resolveGeneration(design, installed).model?.processes?.find((row) => row.tile === tile);

describe("process settings on stub tiles (v3 contract, section 4, D5)", () => {
  it("shows Request timeout and Concurrency limit on HTTP tiles and Concurrency on Workers, only while on", () => {
    const off = stubStackDesign();
    for (const tile of ["links-api", "stats-api", "upload-api", "visit-worker"])
      expect(controls(off, tile)).toEqual([]);
    const design = runStudioCommands(off, [on]);
    for (const tile of ["links-api", "stats-api", "upload-api"])
      expect(controls(design, tile)).toEqual([
        ["process.requestTimeoutMs", 1000, "descriptor-default"],
        ["process.concurrencyLimit", 1000, "descriptor-default"],
      ]);
    expect(controls(design, "visit-worker")).toEqual([
      ["process.concurrency", 1, "descriptor-default"],
    ]);
    // Stores get none; turning the option on wrote nothing on the tiles.
    expect(controls(design, "links-db")).toEqual([]);
    expect(settingsOf(design, "links-api")).toEqual(settingsOf(off, "links-api"));
    const [timeout] = normalSettingFields(design, installed, { element: "links-api" });
    const index = design.architecture?.studio?.elements.findIndex(
      (row) => row.element === "links-api",
    );
    expect(timeout).toMatchObject({
      process: "links-api",
      sourcePaths: [["architecture", "studio", "elements", index, "settings", "requestTimeoutMs"]],
      supported: { integer: { min: 1, max: 300000 } },
      consumer: "tile-process.requestTimeoutMs",
      outputPaths: ["src/processes/links-api.ts"],
      status: "supported",
      userNeed: "Bound how long a request may occupy this service.",
      normalControl: true,
    });
    expect(timeout?.selection).toBeUndefined();
    // Without an installed processes owner there is no control.
    expect(
      normalSettingFields(design, { ...installed, processes: undefined }, { element: "links-api" }),
    ).toEqual([]);
  });

  it("saves a typed value on the tile, which the process runs as the tile's, and clears it", () => {
    let design = runStudioCommands(stubStackDesign(), [on]);
    design = edit(design, "links-api", { requestTimeoutMs: 250 });
    design = edit(design, "visit-worker", { concurrency: 8 });
    expect(settingsOf(design, "links-api")?.requestTimeoutMs).toBe(250);
    expect(process(design, "links-api")?.http).toEqual({
      requestTimeoutMs: {
        value: 250,
        origin: "tile",
        sourcePaths: [expect.arrayContaining(["requestTimeoutMs"])],
      },
      concurrencyLimit: { value: 1000, origin: "fixed", sourcePaths: [] },
    });
    expect(process(design, "visit-worker")?.worker?.concurrency).toMatchObject({
      value: 8,
      origin: "tile",
    });
    expect(controls(design, "links-api")[0]).toEqual(["process.requestTimeoutMs", 250, "source"]);
    // Out of bounds is refused as for any control.
    expect(() => edit(design, "links-api", { requestTimeoutMs: 300001 })).toThrow();
    // Clearing it runs the initial value again.
    design = edit(design, "links-api", { requestTimeoutMs: undefined });
    expect(process(design, "links-api")?.http?.requestTimeoutMs).toEqual({
      value: 1000,
      origin: "fixed",
      sourcePaths: [],
    });
    // Off, a saved value changes nothing a process runs, and shows no control.
    const off = runStudioCommands(design, [{ type: "setRunnableProcesses", on: false }]);
    expect(controls(off, "visit-worker")).toEqual([]);
    expect(resolveGeneration(off, installed).model?.processes).toBeUndefined();
  });

  it("leaves a template's own control, and Video HLS's fixed concurrency hidden", () => {
    const design = runStudioCommands(v2ModuleDesign(), [on]);
    // Every v2 process tile has a template that consumes its limits: no process control.
    expect(normalGenerationControls(design, installed).filter((item) => item.process)).toEqual([]);
    expect(controls(design, "watch").map(([input]) => input)).toEqual([
      "host.requestTimeoutMs",
      "host.concurrencyLimit",
    ]);
    expect(controls(design, "view-counter").map(([input]) => input)).toEqual(["host.concurrency"]);
    expect(controls(design, "transcoder")).toEqual([]);
    expect(process(design, "transcoder")?.worker?.concurrency).toMatchObject({
      value: 1,
      origin: "template",
      selection: "transcoder-encoder",
    });
    expect(process(design, "view-counter")?.worker?.concurrency).toMatchObject({
      origin: "template",
      selection: "counter-sum",
    });
    // A tile whose only template doesn't consume them (the Auth guard) shows the process's.
    const signIn = runStudioCommands(runStudioCommands(emptyDesign(), signInStackCommands), [on]);
    expect(controls(signIn, "watch-api").map(([input]) => input)).toEqual([
      "process.requestTimeoutMs",
      "process.concurrencyLimit",
    ]);
  });

  it("works out what each CDN fronts, only while on", () => {
    expect(resolveGeneration(searchStackDesign(), installed).model?.delivery).toBeUndefined();
    const design = runStudioCommands(searchStackDesign(), [on]);
    const index = design.connections.findIndex(
      (item) => item.from.element === "image-delivery" && item.to.element === "images",
    );
    expect(resolveGeneration(design, installed).model?.delivery).toEqual([
      {
        cdn: "image-delivery",
        name: "Image delivery",
        sourcePath: [
          "architecture",
          "studio",
          "elements",
          design.architecture?.studio?.elements.findIndex(
            (row) => row.element === "image-delivery",
          ),
        ],
        origins: [
          {
            element: "images",
            name: "Images",
            objects: "public",
            provider: "unspecified",
            sourcePath: ["connections", index],
          },
        ],
      },
    ]);
    const v2 = resolveGeneration(runStudioCommands(v2ModuleDesign(), [on]), installed).model;
    expect(v2?.delivery?.map((row) => [row.cdn, row.origins.map((item) => item.objects)])).toEqual([
      ["video-cdn", ["public"]],
    ]);
    // A design with no CDN has none.
    const stub = resolveGeneration(runStudioCommands(stubStackDesign(), [on]), installed).model;
    expect(stub && "delivery" in stub).toBe(false);
  });
});

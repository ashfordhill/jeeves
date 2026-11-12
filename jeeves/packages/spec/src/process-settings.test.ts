import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import { designSchema, emptyDesign, parseStoredDesign } from "./design.ts";
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

  it("keeps an out-of-range value's own control, so mouse and chat can put it right (V3-18)", () => {
    // An older saved revision whose Request timeout is out of range: the schema refuses it, so
    // the resolver has no model. Before V3-18 that hid every control, this one included, and
    // neither the Options form nor chat's edit could reach the value.
    const valid = runStudioCommands(stubStackDesign(), [on]);
    const design = structuredClone(valid);
    const tile = settingsOf(design, "links-api");
    if (!tile) throw new Error("No Links API.");
    tile.requestTimeoutMs = 99999999;
    const index = design.architecture?.studio?.elements.findIndex(
      (row) => row.element === "links-api",
    );
    const path = ["architecture", "studio", "elements", index, "settings", "requestTimeoutMs"];
    const resolved = resolveGeneration(design, installed);
    expect(resolved.model).toBeUndefined();
    expect(resolved.findings).toContainEqual(
      expect.objectContaining({ code: "CONFIG_INVALID", target: { path } }),
    );
    // Only the control the finding names is shown (the Options form and chat's editableSettings
    // both read this list), with the saved value; everything else waits for a valid design.
    expect(normalGenerationControls(design, installed)).toEqual([
      expect.objectContaining({
        process: "links-api",
        input: "process.requestTimeoutMs",
        value: 99999999,
        origin: "source",
        status: "unsupported",
        sourcePaths: [path],
        normalControl: true,
      }),
    ]);
    expect(controls(design, "visit-worker")).toEqual([]);
    // Another out-of-range value is refused, as for any control; one in range puts it right.
    expect(() => edit(design, "links-api", { requestTimeoutMs: 400000 })).toThrow();
    const fixed = edit(design, "links-api", { requestTimeoutMs: 5000 });
    expect(resolveGeneration(fixed, installed).findings).toEqual([]);
    expect(process(fixed, "links-api")?.http?.requestTimeoutMs).toMatchObject({
      value: 5000,
      origin: "tile",
    });
    expect(controls(fixed, "links-api")).toEqual([
      ["process.requestTimeoutMs", 5000, "source"],
      ["process.concurrencyLimit", 1000, "descriptor-default"],
    ]);
    // Clearing it works too: the process runs the initial value again.
    const cleared = edit(design, "links-api", { requestTimeoutMs: undefined });
    expect(settingsOf(cleared, "links-api")).toEqual(settingsOf(valid, "links-api"));
    expect(resolveGeneration(cleared, installed).findings).toEqual([]);
  });

  it("opens a stored design whose only problem is a setting's number out of bounds", () => {
    const valid = runStudioCommands(stubStackDesign(), [on]);
    const stored = structuredClone(valid);
    const links = settingsOf(stored, "links-api");
    const worker = settingsOf(stored, "visit-worker");
    if (!links || !worker) throw new Error("No tiles.");
    links.requestTimeoutMs = 99999999;
    worker.concurrency = 0;
    // Both values are kept as saved; everything else parses as usual.
    const opened = parseStoredDesign(JSON.parse(JSON.stringify(stored)));
    expect(opened).toEqual(stored);
    expect(designSchema.safeParse(stored).success).toBe(false);
    // Any other problem still fails as the schema does: an unknown field, a wrong type, a bad ID.
    const extra = structuredClone(stored) as unknown as { elements: { extra?: boolean }[] };
    if (extra.elements[0]) extra.elements[0].extra = true;
    expect(() => parseStoredDesign(extra)).toThrow();
    const typed = structuredClone(valid);
    const text = settingsOf(typed, "links-api");
    if (text) text.requestTimeoutMs = "slow";
    expect(() => parseStoredDesign(typed)).toThrow();
    expect(() => parseStoredDesign({ ...valid, elements: [{ id: "Bad ID", name: "x" }] })).toThrow();
    expect(parseStoredDesign(valid)).toEqual(valid);
  });

  it("keeps a template's out-of-range control too, and puts its mirror right in the same step", () => {
    const valid = runStudioCommands(v2ModuleDesign(), [on]);
    const design = structuredClone(valid);
    const cache = settingsOf(design, "metadata-cache");
    if (!cache) throw new Error("No cache.");
    cache.ttlSeconds = 99999999;
    expect(resolveGeneration(design, installed).model).toBeUndefined();
    expect(
      normalGenerationControls(design, installed).map((item) => [item.input, item.value]),
    ).toEqual([["cache.ttlSeconds", 99999999]]);
    const fixed = edit(design, "metadata-cache", { ttlSeconds: 7200 });
    const resolved = resolveGeneration(fixed, installed);
    // The model is back, with only the findings the valid design has (this test's registry lists
    // no policy consumers).
    expect(resolved.findings).toEqual(resolveGeneration(valid, installed).findings);
    expect(
      resolved.model?.selections.find((item) => item.inputs["cache.ttlSeconds"] !== undefined)
        ?.inputs["cache.ttlSeconds"],
    ).toBe(7200);
    // Every control is back.
    expect(normalGenerationControls(fixed, installed)).toHaveLength(
      normalGenerationControls(valid, installed).length,
    );
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

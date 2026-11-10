import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { stubStackDesign } from "./fixtures/stub-stack.ts";
import { frozenV2Design, runStudioCommands, v2ModuleDesign } from "./fixtures/v2-modules.ts";
import { designGeneration, generationSchema } from "./generation.ts";
import { generationRuntime, generationTemplates } from "./generation-catalog.ts";
import { generationExportBlockers, resolveGeneration } from "./generation-resolver.ts";
import type { GenerationInstalledSupport } from "./generation-support.ts";
import { designBlueprint, unsupportedBlueprintV2 } from "./studio-blueprint.ts";
import { studioArchitectureExample, studioArchitectureExamples } from "./studio-examples/index.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";
import { buildSupportedAuthoringCommand } from "./supported-authoring.ts";

const installed: GenerationInstalledSupport = {
  runtime: generationRuntime.ref,
  templates: [
    {
      ref: generationTemplates["module-stub"].ref,
      consumers: [{ input: "binding", consumer: "module-stub", outputPaths: ["src/a.ts"] }],
    },
  ],
  processes: true,
};
const processes = (on: boolean): StudioCommand => ({ type: "setRunnableProcesses", on });
function run(design: DesignDocument, command: StudioCommand) {
  const batch = buildStudioCommand(design, command);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { batch, design: result.design };
}
const refusal = (design: DesignDocument, command: StudioCommand) => {
  try {
    buildStudioCommand(design, command);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Expected a refusal");
};

describe("Runnable processes (tile process contract, section 1)", () => {
  it("is one setGeneration that saves true and removes the key when off", () => {
    const design = stubStackDesign();
    expect(designGeneration(design)?.processes).toBeUndefined();
    const on = run(design, processes(true));
    expect(on.batch.ops.map((op) => op.op)).toEqual(["setGeneration"]);
    expect(designGeneration(on.design)?.processes).toBe(true);
    // Only the flag changes: no module, ownership or selection is derived.
    const { processes: _, ...rest } = designGeneration(on.design) ?? {};
    expect(rest).toEqual(designGeneration(design));
    expect(on.design.architecture).toEqual(design.architecture);
    const off = run(on.design, processes(false));
    expect(designGeneration(off.design)).toEqual(designGeneration(design));
    expect(Object.hasOwn(designGeneration(off.design) ?? {}, "processes")).toBe(false);
    expect(refusal(on.design, processes(true))).toBe("Runnable processes are already on.");
    expect(refusal(design, processes(false))).toBe("Runnable processes are already off.");
  });

  it("refuses on designs not built from modules, in plain words", () => {
    const built = "Runnable processes needs a design built from modules.";
    expect(refusal(frozenV2Design(), processes(true))).toBe(built);
    for (const study of studioArchitectureExamples)
      expect(refusal(studioArchitectureExample(study.id).design, processes(true)), study.id).toBe(
        built,
      );
    const tiles = runStudioCommands(emptyDesign(), [
      { type: "addAction", lane: "download", name: "Visit", system: { name: "S" } },
      {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        tile: { id: "api", name: "API", kind: "service" },
        linkId: "download-api",
      },
    ]);
    expect(refusal(tiles, processes(true))).toBe("Add a module first.");
    expect(refusal(emptyDesign(), processes(true))).toBe("Add a module first.");
    // Normal authoring also needs the host to install processes; off is always allowed.
    expect(() =>
      buildSupportedAuthoringCommand(stubStackDesign(), processes(true), {
        ...installed,
        processes: undefined,
      }),
    ).toThrow("Runnable processes aren't installed in this studio's generator.");
    const on = run(stubStackDesign(), processes(true)).design;
    expect(
      buildSupportedAuthoringCommand(on, processes(false), { templates: [] }).ops,
    ).toHaveLength(1);
  });

  it("keeps the option through later module commands", () => {
    const on = run(stubStackDesign(), processes(true)).design;
    const next = runStudioCommands(on, [
      { type: "addModule", host: "stats-api", kind: "rate-limiter", name: "Stats limiter" },
    ]);
    expect(designGeneration(next)?.processes).toBe(true);
  });

  it("normalizes a process per application tile only when on", () => {
    const off = resolveGeneration(stubStackDesign(), installed);
    expect(off.model && "processes" in off.model).toBe(false);
    const on = resolveGeneration(run(stubStackDesign(), processes(true)).design, installed);
    expect(on.findings).toEqual([]);
    const rows = on.model?.processes ?? [];
    expect(rows.map((row) => [row.tile, row.kind, row.shape, row.exposure])).toEqual([
      ["links-api", "service", "http", "public"],
      ["stats-api", "service", "http", "internal"],
      ["upload-api", "uploads", "http", "public"],
      ["visit-worker", "worker", "worker", undefined],
    ]);
    const links = rows[0];
    expect(links?.http).toEqual({
      requestTimeoutMs: { value: 1000, origin: "fixed", sourcePaths: [] },
      concurrencyLimit: { value: 1000, origin: "fixed", sourcePaths: [] },
    });
    expect(links?.templates).toEqual([]);
    expect(links?.stubs.map((stub) => [stub.module, stub.role])).toEqual([
      ["link-reader", "route"],
      ["link-cache", "route"],
      ["limiter", "route"],
      ["visit-publisher", "route"],
      ["redirector", "route"],
      ["stats-caller", "route"],
      ["upload-consumer", "loop"],
    ]);
    expect(rows[3]?.stubs.map((stub) => [stub.module, stub.role])).toEqual([
      ["visit-consumer", "loop"],
      ["visit-writer", "library"],
      ["archiver", "library"],
    ]);
  });

  it("reads HTTP limits from a template on the tile, and runs empty tiles", () => {
    let design = v2ModuleDesign();
    design = runStudioCommands(design, [
      {
        type: "addTile",
        from: { tile: "view-events" },
        side: "after",
        tile: { id: "empty-worker", name: "Empty worker", kind: "worker" },
        linkId: "views-empty-worker",
      },
      processes(true),
    ]);
    const model = resolveGeneration(design, { ...installed, templates: [] }).model;
    const watch = model?.processes?.find((row) => row.tile === "watch");
    expect(watch?.http?.requestTimeoutMs).toMatchObject({
      origin: "template",
      selection: "watch-cache-reader",
    });
    expect(watch?.templates.map((item) => item.selection)).toEqual(["watch-cache-reader"]);
    expect(watch?.stubs.map((stub) => stub.module)).toEqual(["watch-counts", "watch-views"]);
    expect(model?.processes?.find((row) => row.tile === "empty-worker")).toMatchObject({
      shape: "worker",
      templates: [],
      stubs: [],
    });
    // v2's seven application tiles (Identity is not a process) and the empty worker.
    expect(model?.processes?.map((row) => row.tile)).toEqual([
      "completion-handler",
      "empty-worker",
      "search",
      "search-indexer",
      "transcoder",
      "upload",
      "view-counter",
      "watch",
    ]);
  });

  it("needs the host to install it, and a design built from modules", () => {
    const on = run(stubStackDesign(), processes(true)).design;
    const without = { ...installed, processes: undefined };
    const finding = resolveGeneration(on, without).findings.map((item) => [
      item.code,
      item.target.path,
    ]);
    expect(finding).toEqual([["NEEDS_TEMPLATE", ["generation", "processes"]]]);
    expect(generationExportBlockers(on, without)).toHaveLength(1);
    // A raw source edit on a tile-level design still refuses at export.
    const frozen = frozenV2Design();
    const generation = designGeneration(frozen);
    if (generation) generation.processes = true;
    expect(
      resolveGeneration(frozen, installed).findings.some(
        (item) =>
          item.code === "CONFIG_INVALID" && item.target.path?.join("/") === "generation/processes",
      ),
    ).toBe(true);
  });

  it("is absent or true in source, and blueprint v2 refuses it", () => {
    const generation = { version: 1, runtime: generationRuntime.ref, selections: [] };
    expect(generationSchema.safeParse({ ...generation, processes: true }).success).toBe(true);
    expect(generationSchema.safeParse({ ...generation, processes: false }).success).toBe(false);
    const on = run(stubStackDesign(), processes(true)).design;
    expect(unsupportedBlueprintV2(on)).toContainEqual({
      path: ["generation", "processes"],
      reason: "Runnable processes are unsupported by blueprint v2.",
    });
    expect(
      unsupportedBlueprintV2(stubStackDesign()).some(
        (item) => item.path.join("/") === "generation/processes",
      ),
    ).toBe(false);
    expect(() => designBlueprint(on)).toThrow("Blueprint v2 cannot represent");
  });
});

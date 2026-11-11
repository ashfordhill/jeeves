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
    // A loop stub carries each queue it consumes: its saved mode and provider, and the link.
    const consumes = (row: (typeof rows)[number] | undefined, module: string) =>
      row?.stubs.find((stub) => stub.module === module)?.consumes;
    expect(consumes(rows[3], "visit-consumer")).toEqual([
      expect.objectContaining({
        element: "visits",
        name: "Visits",
        mode: "topic",
        provider: "unspecified",
      }),
    ]);
    expect(consumes(links, "upload-consumer")).toEqual([
      expect.objectContaining({ element: "uploaded", mode: "work-queue" }),
    ]);
    const link = consumes(links, "upload-consumer")?.[0];
    expect(link?.sourcePath.slice(0, 3)).toEqual([
      "architecture",
      "studio",
      "componentConnections",
    ]);
    expect(consumes(links, "link-reader")).toBeUndefined();
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

  it("works out every other store and channel a stub links to, with the link's access", () => {
    const rows = resolveGeneration(run(stubStackDesign(), processes(true)).design, installed).model
      ?.processes;
    const stores = (tile: string, module: string) =>
      rows
        ?.find((row) => row.tile === tile)
        ?.stubs.find((stub) => stub.module === module)
        ?.stores?.map((store) =>
          [store.element, store.kind, store.access, store.provider, store.engine ?? store.mode]
            .filter((item) => item !== undefined)
            .join(" "),
        );
    // Links API created Links database, so its Data access reads and writes; Visit worker's only
    // reads. A queue it doesn't consume is published to; a consumed one is its loop's.
    expect(stores("links-api", "link-reader")).toEqual([
      "links-db database read-write unspecified unspecified",
    ]);
    expect(stores("visit-worker", "visit-writer")).toEqual([
      "links-db database read unspecified unspecified",
    ]);
    expect(stores("links-api", "limiter")).toEqual([
      "links-cache cache read-write unspecified unspecified",
    ]);
    expect(stores("links-api", "visit-publisher")).toEqual([
      "visits queue publish unspecified topic",
    ]);
    expect(stores("upload-api", "upload-publisher")).toEqual([
      "uploaded queue publish unspecified work-queue",
    ]);
    expect(stores("upload-api", "archive-upload")).toEqual([
      "archive object-store read-write unspecified",
    ]);
    expect(stores("visit-worker", "archiver")).toEqual(["archive object-store read unspecified"]);
    expect(stores("stats-api", "stats-search")).toEqual([
      "stats-index search read unspecified unspecified",
    ]);
    // Neither a module link nor an application tile is a store, nor is a consumed queue.
    for (const module of ["link-cache", "stats-caller", "redirector", "upload-consumer"])
      expect(stores("links-api", module)).toBeUndefined();
    const archive = rows
      ?.find((row) => row.tile === "upload-api")
      ?.stubs.find((stub) => stub.module === "archive-upload")?.stores?.[0];
    expect(archive).toMatchObject({ name: "Archive", objects: "private" });
    expect(archive?.sourcePath.slice(0, 3)).toEqual([
      "architecture",
      "studio",
      "componentConnections",
    ]);
    // MA05's ownership is only read: View counts belongs to the event counter's owner, so Watch's
    // View count reader reads it only through what that owner publishes.
    const v2 = resolveGeneration(run(v2ModuleDesign(), processes(true)).design, installed).model;
    const watch = v2?.processes?.find((row) => row.tile === "watch");
    expect(watch?.stubs.map((stub) => stub.stores)).toEqual([
      [
        expect.objectContaining({
          element: "view-counts",
          kind: "database",
          access: "read",
          boundary: "published-read",
          provider: "self-hosted",
          engine: "postgresql",
        }),
      ],
      [expect.objectContaining({ element: "view-events", kind: "queue", access: "publish" })],
    ]);
  });

  it("lists each module that writes a database, apart from outboxes and another owner's store", () => {
    const writers = (design: DesignDocument) =>
      resolveGeneration(run(design, processes(true)).design, installed).model?.processes?.flatMap(
        (row) =>
          (row.writers ?? []).map((writer) =>
            [row.tile, writer.module, writer.kind, writer.selection, writer.database, writer.access]
              .join(" ")
              .concat(` ${writer.links.length}`),
          ),
      );
    // v2 from modules (v3 contract, section 1): the Upload state writer and the Lifecycle writer
    // write Metadata database, the Count writer View counts. The jobs and publication outboxes
    // are their templates' tables; the cache read's loader and View count reader only read.
    expect(writers(v2ModuleDesign())).toEqual([
      "completion-handler handler-writer lifecycle-writer handler-writer metadata-db read-write 1",
      "upload upload-state-writer data-access upload-multipart metadata-db read-write 1",
      "view-counter counter-writer data-access counter-sum view-counts read-write 1",
    ]);
    // A stub's is its link's: Links API created Links database; Visit worker's link only reads.
    expect(writers(stubStackDesign())).toEqual([
      "links-api link-reader data-access link-reader links-db read-write 1",
    ]);
    const v2 = resolveGeneration(run(v2ModuleDesign(), processes(true)).design, installed).model;
    const writer = v2?.processes?.find((row) => row.tile === "completion-handler")?.writers?.[0];
    expect(writer).toMatchObject({ name: "Lifecycle writer", databaseName: "Metadata database" });
    expect(writer?.sourcePath.slice(0, 3)).toEqual(["architecture", "studio", "components"]);
    expect(writer?.links[0]?.slice(0, 3)).toEqual([
      "architecture",
      "studio",
      "componentConnections",
    ]);
    // Off: no processes, so no writers.
    expect(resolveGeneration(v2ModuleDesign(), installed).model?.processes).toBeUndefined();
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

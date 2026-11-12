import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { isStructural } from "./findings.ts";
import { testInstalledSupport as installed } from "./fixtures/installed-support.ts";
import { runStudioCommands } from "./fixtures/v2-modules.ts";
import { V3_PATTERN_STEPS } from "./fixtures/v3-modules.ts";
import { designGeneration } from "./generation.ts";
import { resolveGeneration } from "./generation-resolver.ts";
import { moduleStatuses } from "./module-status.ts";
import { designReview } from "./studio-design-review.ts";
import {
  buildModulePattern,
  type ModulePattern,
  ModulePatternRefusal,
  modulePatternArguments,
  modulePatternGuide,
  modulePatternIds,
  modulePatternSchema,
} from "./studio-module-patterns.ts";
import type { StudioCommand } from "./studio-operations.ts";
import { studioLinkFanKinds } from "./studio-tiles.ts";
import { buildSupportedAuthoringCommand } from "./supported-authoring.ts";
import { validateDesign } from "./validate.ts";

/** Applies a pattern and checks it is one batch of commands the mouse could send. */
function apply(design: DesignDocument, pattern: ModulePattern) {
  const built = buildModulePattern(design, pattern, installed);
  // The same commands, run again one by one, make the same design: nothing hidden.
  let replayed = design;
  for (const command of built.commands) {
    const batch = buildSupportedAuthoringCommand(replayed, command, installed);
    const result = applyOperations(replayed, batch.ops);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    replayed = result.design;
  }
  expect(replayed).toEqual(built.design);
  for (const command of built.commands) {
    expect([
      "addAction",
      "addTile",
      "linkTiles",
      "addModule",
      "connectModule",
      "editComponent",
      "edit",
    ]).toContain(command.type);
    if (command.type === "addTile") expect(studioLinkFanKinds).toContain(command.tile.kind);
  }
  expect(validateDesign(built.design).filter(isStructural)).toEqual([]);
  return built;
}
/** Every module's status, keyed `Tile / Module` (default module names repeat across tiles). */
const statuses = (design: DesignDocument) =>
  Object.fromEntries(
    moduleStatuses(design).map((item) => [
      `${design.elements.find((tile) => tile.id === item.host)?.name} / ${item.name}`,
      item.status === "template" ? `template ${item.template}` : `${item.status}: ${item.reason}`,
    ]),
  );
const tileId = (design: DesignDocument, name: string) =>
  design.elements.find((item) => item.name === name)?.id ?? name;

/** The pipeline with its neutral defaults, plus the optional topic and CDN. */
const pipeline: ModulePattern = {
  id: "upload-pipeline",
  system: "Media",
  publication: "Publications",
  delivery: "Delivery",
};

describe("curated module patterns (V3-09)", () => {
  it("describes every argument each pattern's schema takes", () => {
    for (const id of modulePatternIds)
      expect(Object.keys(modulePatternGuide[id].arguments).sort()).toEqual(
        modulePatternArguments(id).sort(),
      );
    expect(modulePatternSchema.safeParse({ id: "sign-in" }).success).toBe(false);
    expect(modulePatternSchema.safeParse({ id: "cache-read", extra: 1 }).success).toBe(false);
  });

  it("builds the upload pipeline from blank: sign-in, multipart, encoding and lifecycle templates", () => {
    const { design } = apply(emptyDesign(), pipeline);
    expect(statuses(design)).toEqual({
      "Ingest API / Auth guard": "template verified-identity",
      "Ingest API / Multipart uploads": "template owned-multipart",
      "Ingest API / Event publisher": "template owned-multipart",
      "Ingest API / State writer": "template owned-multipart",
      "Processor / Event consumer": "template video-hls",
      "Processor / Video encoder": "template video-hls",
      "Processor / Video packager": "template video-hls",
      "Processor / Video thumbnailer": "template video-hls",
      "Processor / Event publisher": "template video-hls",
      "Lifecycle / Event consumer": "template asset-lifecycle",
      "Lifecycle / Lifecycle writer": "template asset-lifecycle",
      "Lifecycle / Event publisher": "template asset-lifecycle",
    });
    expect(design.architecture?.system.name).toBe("Media");
    expect(design.elements.map((item) => item.name).sort()).toEqual(
      [
        "Delivery",
        "Ingest API",
        "Jobs",
        "Lifecycle",
        "Login",
        "Originals",
        "Outputs",
        "Processor",
        "Publications",
        "Records",
        "Results",
      ].sort(),
    );
    // A queue for jobs and a topic for results, derived by the templates.
    const mode = (name: string) =>
      design.architecture?.studio?.elements.find((item) => item.element === tileId(design, name))
        ?.settings;
    expect(mode("Jobs")).toMatchObject({ mode: "work-queue" });
    expect(mode("Results")).toMatchObject({ mode: "topic" });
    // Applied again, everything is there: nothing to add.
    expect(buildModulePattern(design, pipeline, installed).commands).toEqual([]);
  });

  it("builds a cached read path: the cache read template, and says its database has no writer", () => {
    const { design } = apply(emptyDesign(), { id: "cache-read" });
    expect(statuses(design)).toEqual({
      "Read API / Cache reader": "template positive-cache-read",
      "Read API / Record loader": "template positive-cache-read",
    });
    expect(designReview(design, installed).findings).toContainEqual(
      expect.objectContaining({ check: "store-without-writer", tile: "records" }),
    );
    // Beside the upload pipeline, which writes Records, nothing is left to fix.
    const writer = apply(emptyDesign(), { id: "upload-pipeline", delivery: "Delivery" });
    const both = apply(writer.design, { id: "cache-read" }).design;
    expect(
      designReview(both, installed).findings.filter((item) => item.severity === "fix"),
    ).toEqual([]);
  });

  it("counts from events: the counter's template, the source's publisher and reader as stubs", () => {
    const { design } = apply(emptyDesign(), { id: "counting" });
    expect(statuses(design)).toEqual({
      "Read API / Event publisher": "stub: No template in Read API uses it.",
      "Read API / Totals reader": "stub: No template in Read API uses it.",
      "Counter / Event consumer": "template event-counter",
      "Counter / Event counter": "template event-counter",
      "Counter / Totals writer": "template event-counter",
    });
    // The counter owns the totals; the source only reads them.
    const counts = design.architecture?.studio?.elements.find((item) => item.element === "totals");
    expect(counts?.owner).toEqual({ kind: "element", id: "counter" });
  });

  it("feeds search from the lifecycle's publication topic, and refuses without a topic", () => {
    expect(() => buildModulePattern(emptyDesign(), { id: "search" }, installed)).toThrow(
      ModulePatternRefusal,
    );
    expect(() => buildModulePattern(emptyDesign(), { id: "search" }, installed)).toThrow(
      'There is no topic "Publications".',
    );
    const { design } = apply(apply(emptyDesign(), pipeline).design, { id: "search" });
    expect(statuses(design)).toMatchObject({
      "Indexer / Event consumer": "template search-projection",
      "Indexer / Index writer": "template search-projection",
      "Query API / Search query": "template search-query",
    });
  });

  it("protects a tile with required or optional sign-in, and changes an existing guard's choice", () => {
    const optional = apply(emptyDesign(), {
      id: "sign-in",
      tile: "Read API",
      signIn: "optional",
    }).design;
    expect(statuses(optional)).toEqual({ "Read API / Auth guard": "template verified-identity" });
    expect(optional.elements.map((item) => item.name)).toEqual(["Read API", "Login"]);
    const guard = () =>
      optional.architecture?.studio?.components?.find((item) => item.name === "Auth guard");
    expect(guard()?.settings).toMatchObject({ signIn: "optional" });
    const required = apply(optional, { id: "sign-in", tile: "Read API" }).design;
    expect(
      required.architecture?.studio?.components?.find((item) => item.name === "Auth guard")
        ?.settings,
    ).toMatchObject({ signIn: "required" });
    // A tile of the wrong kind is refused in plain words, and nothing is applied.
    expect(() =>
      buildModulePattern(
        apply(emptyDesign(), { id: "cache-read" }).design,
        {
          id: "sign-in",
          tile: "Records",
        },
        installed,
      ),
    ).toThrow("Records is a database; the tile to protect must be a service or an upload service.");
  });

  it("keeps favorites behind a Required guard, with optional items, and refuses an Optional guard", () => {
    const { design } = apply(emptyDesign(), { id: "favorites" });
    expect(statuses(design)).toEqual({
      "Member API / Auth guard": "template verified-identity",
      "Member API / Favorites": "template favorites",
    });
    expect(design.elements.map((item) => item.name)).toEqual([
      "Member API",
      "Saved items",
      "Login",
    ]);
    const items = apply(apply(emptyDesign(), pipeline).design, {
      id: "favorites",
      items: "Records",
    }).design;
    expect(statuses(items)).toMatchObject({
      "Member API / Favorites": "template favorites",
      "Member API / Item reader": "template favorites",
    });
    const optional = apply(emptyDesign(), {
      id: "sign-in",
      tile: "Member API",
      signIn: "optional",
    }).design;
    expect(() => buildModulePattern(optional, { id: "favorites" }, installed)).toThrow(
      "Auth guard in Member API is Optional, and this pattern needs it Required.",
    );
  });

  it("gives a store one writer and readers: stubs, a SQL file for the writer and published reads", () => {
    expect(statuses(apply(emptyDesign(), { id: "owned-store" }).design)).toEqual({
      "Writer API / Entries writer": "stub: No template in Writer API uses it.",
    });
    const { design } = apply(emptyDesign(), {
      id: "owned-store",
      writer: "Catalog API",
      database: "Catalog",
      readers: ["Shop API", "Search API"],
    });
    expect(statuses(design)).toEqual({
      "Catalog API / Catalog writer": "stub: No template in Catalog API uses it.",
      "Shop API / Catalog reader": "stub: No template in Shop API uses it.",
      "Search API / Catalog reader": "stub: No template in Search API uses it.",
    });
    expect(moduleStatuses(design)).toHaveLength(3);
    const on = runStudioCommands(design, [{ type: "setRunnableProcesses", on: true }]);
    const processes = resolveGeneration(on, installed).model?.processes ?? [];
    // The writer writes the database; each reader reads it through what the writer publishes.
    expect(processes.flatMap((item) => (item.writers ?? []).map((row) => row.module))).toEqual([
      "catalog-api-catalog-writer",
    ]);
    const store = (tile: string) =>
      processes
        .find((item) => item.tile === tile)
        ?.stubs?.flatMap((stub) => stub.stores ?? [])
        .find((row) => row.element === "catalog");
    expect(store("catalog-api")?.access).toBe("read-write");
    expect(store("shop-api")?.access).toBe("read");
  });

  it("builds YouTube v3's shape from the patterns and the brief's names: 21 tiles, 26 modules, 24 templates and 2 stubs", () => {
    const design = V3_PATTERN_STEPS.reduce(
      (current, step) => apply(current, step).design,
      emptyDesign(),
    );
    expect(design.elements).toHaveLength(21);
    const all = moduleStatuses(design);
    expect(all).toHaveLength(26);
    expect(all.filter((item) => item.status === "template")).toHaveLength(24);
    expect(all.filter((item) => item.status !== "template").map((item) => item.name)).toEqual([
      "View publisher",
      "View count reader",
    ]);
    const templates = (designGeneration(design)?.selections ?? [])
      .filter((item) => item.binding.kind !== "module-stub")
      .map((item) => item.binding.kind);
    expect(templates.sort()).toEqual(
      [
        "asset-lifecycle",
        "event-counter",
        "favorites",
        "owned-multipart",
        "positive-cache-read",
        "search-projection",
        "search-query",
        "verified-identity",
        "verified-identity",
        "verified-identity",
        "video-hls",
      ].sort(),
    );
    // Watch API reaches its cap: Hot metadata, Metadata, View events, View counts and Sign-in.
    expect(design.connections.filter((item) => item.from.element === "watch-api")).toHaveLength(5);
    // What is left is advice about long lines, nothing to fix.
    expect(designReview(design, installed).findings.map((item) => item.check)).toEqual([
      "long-line",
      "long-line",
    ]);
  });

  it("refuses a step the lanes refuse, naming the pattern, and applies nothing", () => {
    // A sixth link out of Watch API is past the cap.
    const full = V3_PATTERN_STEPS.filter((step) => step.id !== "search" && step.id !== "favorites");
    const design = full.reduce<DesignDocument>(
      (current, step) => apply(current, step as ModulePattern).design,
      emptyDesign(),
    );
    const attempt = () =>
      buildModulePattern(
        design,
        { id: "favorites", service: "Watch API", identity: "Sign-in" },
        installed,
      );
    expect(attempt).toThrow(/^Favorites: .*Nothing of the pattern was applied\.$/);
    expect(attempt).toThrow("Watch API already has 5 links");
    // Only the design's own commands: the pattern returned none.
    const command: StudioCommand = { type: "editSystem", name: "Still YouTube" };
    expect(buildSupportedAuthoringCommand(design, command, installed).ops.length).toBeGreaterThan(
      0,
    );
  });
});

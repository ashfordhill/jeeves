import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { isStructural } from "./findings.ts";
import { testInstalledSupport as installed } from "./fixtures/installed-support.ts";
import { runStudioCommands } from "./fixtures/v2-modules.ts";
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
const statuses = (design: DesignDocument) =>
  Object.fromEntries(
    moduleStatuses(design).map((item) => [
      item.name,
      item.status === "template" ? `template ${item.template}` : `${item.status}: ${item.reason}`,
    ]),
  );
const tileId = (design: DesignDocument, name: string) =>
  design.elements.find((item) => item.name === name)?.id ?? name;

const pipeline: ModulePattern = {
  id: "upload-pipeline",
  system: "YouTube",
  publication: "Publication events",
  delivery: "Video delivery",
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
      "Creator check": "template verified-identity",
      "Multipart uploads": "template owned-multipart",
      "Job outbox publisher": "template owned-multipart",
      "Upload state writer": "template owned-multipart",
      "Job consumer": "template video-hls",
      "Segmenter and encoder": "template video-hls",
      Packager: "template video-hls",
      Thumbnailer: "template video-hls",
      "Processing result publisher": "template video-hls",
      "Processing consumer": "template asset-lifecycle",
      "Lifecycle writer": "template asset-lifecycle",
      "Video publication publisher": "template asset-lifecycle",
    });
    expect(design.architecture?.system.name).toBe("YouTube");
    // A queue for jobs and a topic for results, derived by the templates.
    const mode = (name: string) =>
      design.architecture?.studio?.elements.find((item) => item.element === tileId(design, name))
        ?.settings;
    expect(mode("Upload jobs")).toMatchObject({ mode: "work-queue" });
    expect(mode("Processing events")).toMatchObject({ mode: "topic" });
    // Applied again, everything is there: nothing to add.
    expect(buildModulePattern(design, pipeline, installed).commands).toEqual([]);
  });

  it("builds a cached read path: the cache read template, and says its database has no writer", () => {
    const { design } = apply(emptyDesign(), { id: "cache-read" });
    expect(statuses(design)).toEqual({
      "Video details cache": "template positive-cache-read",
      "Video details reader": "template positive-cache-read",
    });
    expect(designReview(design, installed).findings).toContainEqual(
      expect.objectContaining({ check: "store-without-writer", tile: "metadata" }),
    );
    // Beside the upload pipeline, which writes Metadata, nothing is left to fix.
    const writer = apply(emptyDesign(), { id: "upload-pipeline", delivery: "Video delivery" });
    const both = apply(writer.design, { id: "cache-read" }).design;
    expect(
      designReview(both, installed).findings.filter((item) => item.severity === "fix"),
    ).toEqual([]);
  });

  it("counts from events: the counter's template, the source's publisher and reader as stubs", () => {
    const { design } = apply(emptyDesign(), { id: "counting" });
    expect(statuses(design)).toEqual({
      "View publisher": "stub: No template in Watch API uses it.",
      "View count reader": "stub: No template in Watch API uses it.",
      "View consumer": "template event-counter",
      "Receipt and increment": "template event-counter",
      "Count writer": "template event-counter",
    });
    // The counter owns the totals; the source only reads them.
    const counts = design.architecture?.studio?.elements.find(
      (item) => item.element === "view-counts",
    );
    expect(counts?.owner).toEqual({ kind: "element", id: "view-counter" });
  });

  it("feeds search from the lifecycle's publication topic, and refuses without a topic", () => {
    expect(() => buildModulePattern(emptyDesign(), { id: "search" }, installed)).toThrow(
      ModulePatternRefusal,
    );
    expect(() => buildModulePattern(emptyDesign(), { id: "search" }, installed)).toThrow(
      'There is no topic "Publication events".',
    );
    const { design } = apply(apply(emptyDesign(), pipeline).design, { id: "search" });
    expect(statuses(design)).toMatchObject({
      "Publication consumer": "template search-projection",
      "Index writer": "template search-projection",
      "Video search": "template search-query",
    });
  });

  it("protects a tile with required or optional sign-in, and changes an existing guard's choice", () => {
    const optional = apply(emptyDesign(), {
      id: "sign-in",
      tile: "Watch API",
      signIn: "optional",
    }).design;
    expect(statuses(optional)).toEqual({ "Viewer check": "template verified-identity" });
    const guard = () =>
      optional.architecture?.studio?.components?.find((item) => item.name === "Viewer check");
    expect(guard()?.settings).toMatchObject({ signIn: "optional" });
    const required = apply(optional, { id: "sign-in", tile: "Watch API" }).design;
    expect(
      required.architecture?.studio?.components?.find((item) => item.name === "Viewer check")
        ?.settings,
    ).toMatchObject({ signIn: "required" });
    // A tile of the wrong kind is refused in plain words, and nothing is applied.
    expect(() =>
      buildModulePattern(
        apply(emptyDesign(), { id: "cache-read" }).design,
        {
          id: "sign-in",
          tile: "Metadata",
        },
        installed,
      ),
    ).toThrow(
      "Metadata is a database; the tile to protect must be a service or an upload service.",
    );
  });

  it("keeps favorites behind a Required guard, with optional items, and refuses an Optional guard", () => {
    const { design } = apply(emptyDesign(), { id: "favorites" });
    expect(statuses(design)).toEqual({
      "Account check": "template verified-identity",
      "Favorite videos": "template favorites",
    });
    const items = apply(apply(emptyDesign(), pipeline).design, {
      id: "favorites",
      items: "Metadata",
    }).design;
    expect(statuses(items)).toMatchObject({
      "Favorite videos": "template favorites",
      "Video reader": "template favorites",
    });
    const optional = apply(emptyDesign(), {
      id: "sign-in",
      tile: "Account API",
      signIn: "optional",
    }).design;
    expect(() => buildModulePattern(optional, { id: "favorites" }, installed)).toThrow(
      "Viewer check in Account API is Optional, and this pattern needs it Required.",
    );
  });

  it("gives a store one writer and readers: stubs, a SQL file for the writer and published reads", () => {
    const { design } = apply(emptyDesign(), {
      id: "owned-store",
      readers: ["Shop API", "Search API"],
    });
    expect(statuses(design)).toEqual({
      "Catalog writer": "stub: No template in Catalog API uses it.",
      "Catalog reader": "stub: No template in Search API uses it.",
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

  it("builds YouTube v3's shape from the patterns: 21 tiles, 26 modules, 24 templates and 2 stubs", () => {
    const steps: ModulePattern[] = [
      pipeline,
      { id: "cache-read" },
      { id: "counting" },
      { id: "search" },
      { id: "sign-in", tile: "Watch API", signIn: "optional" },
      { id: "favorites", items: "Metadata" },
    ];
    const design = steps.reduce((current, step) => apply(current, step).design, emptyDesign());
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
    const full = [
      pipeline,
      { id: "cache-read" },
      { id: "counting" },
      { id: "sign-in", tile: "Watch API", signIn: "optional" },
    ] satisfies ModulePattern[];
    const design = full.reduce<DesignDocument>(
      (current, step) => apply(current, step as ModulePattern).design,
      emptyDesign(),
    );
    const attempt = () =>
      buildModulePattern(design, { id: "favorites", service: "Watch API" }, installed);
    expect(attempt).toThrow(/^Favorites: .*Nothing of the pattern was applied\.$/);
    expect(attempt).toThrow("Watch API already has 5 links");
    // Only the design's own commands: the pattern returned none.
    const command: StudioCommand = { type: "editSystem", name: "Still YouTube" };
    expect(buildSupportedAuthoringCommand(design, command, installed).ops.length).toBeGreaterThan(
      0,
    );
  });
});

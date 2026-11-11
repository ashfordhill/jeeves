import { describe, expect, it } from "vitest";
import { emptyDesign } from "../design.ts";
import { isStructural } from "../findings.ts";
import { designGeneration } from "../generation.ts";
import { resolveGeneration } from "../generation-resolver.ts";
import { moduleStatuses } from "../module-status.ts";
import { studioKindLabel } from "../studio-definitions.ts";
import { designReview } from "../studio-design-review.ts";
import { laneGraph } from "../studio-lanes.ts";
import { buildModulePattern, type ModulePattern } from "../studio-module-patterns.ts";
import { studioLinkFanKinds } from "../studio-tiles.ts";
import { validateDesign } from "../validate.ts";
import { designDiff } from "./design-diff.ts";
import { testInstalledSupport as installed } from "./installed-support.ts";
import {
  buildV3Reference,
  V3_CONNECTIONS,
  V3_MODULES,
  V3_TEMPLATES,
  V3_TILES,
  V3_VALUES,
  v3Diff,
  v3DiffReport,
  v3ModuleDesign,
} from "./v3-modules.ts";

const keys = (rows: readonly { area: string; key: string }[]) =>
  rows.map((row) => `${row.area}: ${row.key}`);

describe("the v3 reference (contract section 5)", () => {
  const { commands, design } = buildV3Reference(installed);
  const studio = design.architecture?.studio;
  const name = (id: string) => design.elements.find((item) => item.id === id)?.name ?? id;

  it("has the contract's tiles, lines, entries and links", () => {
    expect(V3_TILES).toHaveLength(31);
    expect(design.architecture?.system?.name).toBe("YouTube");
    expect(design.elements).toHaveLength(21);
    for (const command of commands)
      if (command.type === "addTile") expect(studioLinkFanKinds).toContain(command.tile.kind);
    // 33 lines in Simple: 2 user links, 6 entries (Watch 4, Publish 2) and 25 tile links.
    const lines = laneGraph(design).edges;
    expect(lines).toHaveLength(33);
    expect(studio?.entries?.map((item) => `${item.lane} ${name(item.element)}`)).toEqual([
      "download Watch API",
      "download Search API",
      "download Video delivery",
      "download Account API",
      "upload Sign-in",
      "upload Upload API",
    ]);
    expect(design.connections).toHaveLength(25);
    // 8 dashed, each through a queue or topic; no direct async line.
    const dashed = design.connections.filter((item) => item.planned.interaction === "Asynchronous");
    expect(dashed.map((item) => `${name(item.from.element)} → ${name(item.to.element)}`)).toEqual([
      "Watch API → View events",
      "View events → View counter",
      "Upload API → Upload jobs",
      "Upload jobs → Transcoder",
      "Transcoder → Processing events",
      "Processing events → Video lifecycle",
      "Video lifecycle → Publication events",
      "Publication events → Search indexer",
    ]);
    const kinds = new Map(studio?.elements.map((item) => [item.element, item.settings]));
    for (const link of dashed)
      expect(
        [link.from.element, link.to.element].some((id) => kinds.get(id)?.kind === "queue"),
      ).toBe(true);
    expect(
      design.connections.filter((item) => name(item.from.element) === "Watch API"),
    ).toHaveLength(5);
    // Upload jobs is a queue; the three event channels are topics.
    expect(
      studio?.elements
        .filter((item) => item.settings.kind === "queue")
        .map((item) => `${name(item.element)} ${studioKindLabel(item.settings)}`),
    ).toEqual([
      "View events Topic",
      "Upload jobs Queue",
      "Processing events Topic",
      "Publication events Topic",
    ]);
  });

  it("has 26 modules, 24 Template and 2 Stub, with the contract's names and descriptions", () => {
    const modules = studio?.components ?? [];
    expect(modules).toHaveLength(26);
    expect(
      modules.map((item) => [name(item.host), item.name, item.settings.kind, item.description]),
    ).toEqual(
      Object.entries(V3_MODULES).flatMap(([host, items]) =>
        items.map((item) => [host, item.name, item.kind, item.description]),
      ),
    );
    const statuses = moduleStatuses(design);
    expect(statuses.filter((item) => item.status === "template")).toHaveLength(24);
    expect(statuses.filter((item) => item.status !== "template").map((item) => item.name)).toEqual([
      "View count reader",
      "View publisher",
    ]);
    expect(studio?.componentConnections).toHaveLength(30);
    expect(V3_CONNECTIONS).toHaveLength(30);
  });

  it("resolves 11 template selections and 2 stubs with no findings, processes on", () => {
    const generation = designGeneration(design);
    expect(generation?.processes).toBe(true);
    const resolved = resolveGeneration(design, installed);
    expect(resolved.findings).toEqual([]);
    const moduleName = (id: string) => studio?.components?.find((item) => item.id === id)?.name;
    expect(
      (resolved.model?.selections ?? [])
        .map((item) =>
          item.binding.kind === "module-stub" && item.target.kind === "component"
            ? `module-stub ${name(item.host)} ${moduleName(item.target.component)}`
            : `${item.template.id} ${name(item.host)}`,
        )
        .sort(),
    ).toEqual(
      V3_TEMPLATES.map((item) =>
        [item.template, item.tile, item.module].filter(Boolean).join(" "),
      ).sort(),
    );
    expect(validateDesign(design).filter(isStructural)).toEqual([]);
    // Three Sign-in guards verify the one Identity: its Keycloak substitution is noted once.
    expect(
      resolved.model?.selections.filter((item) => item.binding.kind === "verified-identity"),
    ).toHaveLength(3);
    expect(resolved.model?.localAdapterTreatments).toEqual([
      expect.objectContaining({
        sourcePath: [
          "architecture",
          "studio",
          "elements",
          expect.any(Number),
          "settings",
          "language",
        ],
        actual: "keycloak",
      }),
    ]);
    // What is left is advice about two long lines, nothing to fix.
    expect(designReview(design, installed).findings.map((item) => item.check)).toEqual([
      "long-line",
      "long-line",
    ]);
  });

  it("has the 8 useful values, set through the inspector's controls", () => {
    expect(V3_VALUES).toHaveLength(8);
    for (const value of V3_VALUES) {
      const tile = design.elements.find((item) => item.name === value.tile)?.id;
      const settings = value.module
        ? studio?.components?.find((item) => item.host === tile && item.name === value.module)
            ?.settings
        : studio?.elements.find((item) => item.element === tile)?.settings;
      expect((settings as Record<string, unknown> | undefined)?.[value.key]).toBe(value.value);
    }
    // 2 actions, 31 steps, 26 modules, 30 connections, 8 values and Runnable processes.
    expect(commands).toHaveLength(98);
  });

  it("compares by name: nothing against itself, and a different build's differences", () => {
    expect(v3DiffReport(v3Diff(v3ModuleDesign(installed), installed)).unexpected).toEqual([]);
    expect(designDiff(design, design, { installed })).toEqual([]);
    // V3-09's patterns compose v3's shape with other choices: these rows say where.
    const steps: ModulePattern[] = [
      {
        id: "upload-pipeline",
        system: "YouTube",
        publication: "Publication events",
        delivery: "Video delivery",
      },
      { id: "cache-read" },
      { id: "counting" },
      { id: "search" },
      { id: "sign-in", tile: "Watch API", signIn: "optional" },
      { id: "favorites", items: "Metadata" },
    ];
    const composed = steps.reduce(
      (current, step) => buildModulePattern(current, step, installed).design,
      emptyDesign(),
    );
    const unexpected = keys(v3DiffReport(v3Diff(composed, installed)).unexpected);
    expect(unexpected).toEqual(
      expect.arrayContaining([
        // Sign-in hangs off Upload API rather than being a Publish entry.
        "entry: Sign-in",
        // View publisher is an Event publisher, not a Custom module reading Metadata.
        "module kind: Watch API / View publisher",
        "module link: View publisher → Metadata",
        // The values and Runnable processes are left to set.
        "tile setting: Hot metadata.ttlSeconds",
        "generation: processes",
      ]),
    );
    // Its tiles and modules are the reference's, by name and kind.
    expect(unexpected.filter((key) => key.startsWith("tile: "))).toEqual([]);
  });
});

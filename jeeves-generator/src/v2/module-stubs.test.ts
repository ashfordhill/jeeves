import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyOperations,
  buildGenerationPresetCommand,
  buildStudioCommand,
  type DesignDocument,
  designSchema,
  emptyDesign,
  generationExportBlockers,
  type StudioCommand,
  type StudioComponentKind,
  type StudioModuleSlotId,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import frozenV2 from "../../../field-projects/youtube/v2/inputs/design.json" with { type: "json" };
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { exportNewDirectory } from "../export.ts";
import { planFileWrites } from "../files.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const run = (design: DesignDocument, command: StudioCommand) => {
  const batch = buildStudioCommand(design, command);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
const tile = (
  from: string,
  id: string,
  name: string,
  kind: "service" | "database" | "queue" | "cache",
): StudioCommand => ({
  type: "addTile",
  from: from === "lane" ? { lane: "download" } : { tile: from },
  side: "after",
  tile: { id, name, kind },
  linkId: `${from}-to-${id}`,
});
const add = (
  host: string,
  kind: StudioComponentKind,
  id: string,
  name?: string,
): StudioCommand => ({
  type: "addModule",
  host,
  kind,
  id,
  ...(name && { name }),
});
const connect = (
  module: string,
  slot: StudioModuleSlotId,
  target: { tile: string } | { module: string },
): StudioCommand => ({
  type: "connectModule",
  module,
  slot,
  target,
});
/** One Service with stub modules only: a connected Data access, a publisher with its outbox
 * unconnected, an unconnected Rate limiter and a Cache reader with only its loader. */
const stubCommands: StudioCommand[] = [
  { type: "addAction", lane: "download", name: "Shorten", system: { name: "Links" } },
  tile("lane", "shorten", "Shorten service", "service"),
  tile("shorten", "links-db", "Links database", "database"),
  tile("shorten", "clicks", "Click events", "queue"),
  add("shorten", "data-access", "shorten-links", "Links writer"),
  add("shorten", "event-publisher", "shorten-clicks"),
  add("shorten", "rate-limiter", "shorten-limit"),
  add("shorten", "cache-reader", "shorten-cache", "Link cache"),
  connect("shorten-links", "database", { tile: "links-db" }),
  connect("shorten-clicks", "channel", { tile: "clicks" }),
  connect("shorten-cache", "loader", { module: "shorten-links" }),
];
const build = (commands: StudioCommand[]) => commands.reduce(run, emptyDesign());
const assemble = (design: DesignDocument) =>
  assembleV2({ designJson: canonicalJson(design) }, registry);
const text = (bundle: ReturnType<typeof assemble>, path: string) => {
  const file = bundle.files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
type ReportModule = {
  module: string;
  status: string;
  files: string[];
  unconnected: string[];
  reason?: string;
  template?: string;
};
const modulesOf = (bundle: ReturnType<typeof assemble>) =>
  (bundle.report as { modules?: ReportModule[] }).modules;

describe("module stubs", () => {
  const design = build(stubCommands);
  const bundle = assemble(design);

  it("exports a typed stub per module, with a dependency per connected slot", () => {
    expect(generationExportBlockers(design, registry.installed)).toEqual([]);
    expect(bundle.report.findings).toEqual([]);
    expect(bundle.report.semanticComplete).toBe(true);
    const slots = text(bundle, "src/modules/shorten/shorten-links.slots.ts");
    expect(slots).toContain(
      "// Generated scaffold: Links writer, a Data access in Shorten service.",
    );
    expect(slots).toContain('import type { DatabaseReadWriter } from "../dependencies.ts";');
    expect(slots).toContain(
      "  // database: Links database (Database) through shorten-to-links-db, read & write\n  linksDb: DatabaseReadWriter;",
    );
    expect(slots).toContain(
      '"tile":"links-db","kind":"database","connection":"shorten-to-links-db"',
    );
    expect(slots).toContain('"use":"read-write","access":"write"');
    // A publisher's channel is typed; its unconnected outbox is a comment, not a property.
    const publisher = text(bundle, "src/modules/shorten/shorten-clicks.slots.ts");
    expect(publisher).toContain("  clicks: QueuePublisher;");
    expect(publisher).toContain("  // outbox: not connected (Database, write, optional)");
    expect(publisher.match(/^ {2}\w+: \w+;$/gmu)).toEqual(["  clicks: QueuePublisher;"]);
    // An unconnected module has no properties and no import.
    const limit = text(bundle, "src/modules/shorten/shorten-limit.slots.ts");
    expect(limit).toContain("  // store: not connected (Cache, read & write, optional)\n};");
    expect(limit).not.toContain("import");
    expect(limit).toContain("export const slots = [] as const;");
    // The loader names the module it uses; the cache slot it lacks is a comment.
    const cache = text(bundle, "src/modules/shorten/shorten-cache.slots.ts");
    expect(cache).toContain("  // cache: not connected (Cache, read & write)");
    expect(cache).toContain(
      "  // loader: Links writer (Data access in this tile), in-process\n  shortenLinks: ModuleCall;",
    );
    // The extension is the entry point, named after the module, that throws until written.
    expect(text(bundle, "src/modules/shorten/shorten-cache.ts")).toBe(
      [
        "// Link cache, a Cache reader in Shorten service: Reads from a cache before the database.",
        "// Write the module here. Export never overwrites your edits: export afresh and carry them over.",
        'import type { Dependencies } from "./shorten-cache.slots.ts";',
        "",
        "export async function shortenCache(dependencies: Dependencies): Promise<void> {",
        '  throw new Error("Not implemented: Link cache");',
        "}",
        "",
      ].join("\n"),
    );
    expect(text(bundle, "src/modules/dependencies.ts")).toContain(
      "export interface QueuePublisher",
    );
  });

  it("is deterministic, gives each file one owner and provisions nothing", () => {
    const again = assemble(design);
    expect(again.files.map((file) => [file.path, [...file.bytes].join()])).toEqual(
      bundle.files.map((file) => [file.path, [...file.bytes].join()]),
    );
    const stubs = bundle.manifest.files.filter((file) => file.path.startsWith("src/modules/"));
    expect(stubs.map((file) => [file.path, file.ownership])).toEqual([
      ["src/modules/dependencies.ts", "generated-scaffold"],
      ["src/modules/shorten/shorten-cache.slots.ts", "generated-scaffold"],
      ["src/modules/shorten/shorten-cache.ts", "generated-extension"],
      ["src/modules/shorten/shorten-clicks.slots.ts", "generated-scaffold"],
      ["src/modules/shorten/shorten-clicks.ts", "generated-extension"],
      ["src/modules/shorten/shorten-limit.slots.ts", "generated-scaffold"],
      ["src/modules/shorten/shorten-limit.ts", "generated-extension"],
      ["src/modules/shorten/shorten-links.slots.ts", "generated-scaffold"],
      ["src/modules/shorten/shorten-links.ts", "generated-extension"],
    ]);
    for (const file of stubs) {
      expect(file.owner).toMatchObject({ id: "local.module-stubs" });
      expect(file.contributors).toEqual([]);
    }
    expect(
      bundle.manifest.implementations.find((item) => item.id === "local.module-stubs")
        ?.sourceSha256,
    ).toMatch(/^[a-f0-9]{64}$/u);
    // Stubs import no template library and their tiles are not provisioned.
    for (const file of bundle.files.filter((item) => item.path.startsWith("src/modules/")))
      expect(new TextDecoder().decode(file.bytes)).not.toContain("runtime/");
    expect(
      bundle.files.some(
        (file) => file.path.startsWith("src/runtime/") && file.path !== "src/runtime/local.ts",
      ),
    ).toBe(false);
    const plan = JSON.parse(text(bundle, "infra/local.json"));
    expect([plan.resources, plan.databases, plan.broker, plan.providers]).toEqual([[], [], [], []]);
    // Each stub is required custom work.
    expect(bundle.report.gaps.filter((gap) => gap.emitter === "local.module-stubs")).toHaveLength(
      4,
    );
    expect(bundle.report.applicationComplete).toBe(false);
  });

  it("lists every module in the report only for a module-level design", () => {
    const modules = modulesOf(bundle);
    expect(modules?.map((item) => [item.module, item.status, item.unconnected])).toEqual([
      ["shorten-links", "stub", []],
      ["shorten-clicks", "stub", ["outbox"]],
      ["shorten-limit", "stub", ["store"]],
      ["shorten-cache", "stub", ["cache"]],
    ]);
    expect(modules?.find((item) => item.module === "shorten-limit")).toMatchObject({
      reason: "Rate limiter has no template.",
      files: [
        "src/modules/dependencies.ts",
        "src/modules/shorten/shorten-limit.slots.ts",
        "src/modules/shorten/shorten-limit.ts",
      ],
    });
    expect(modules?.find((item) => item.module === "shorten-cache")?.reason).toBe(
      "Needs a connection to a cache.",
    );
    // A complete template beside the stubs: its modules are Template, with its files.
    const cached = run(
      run(design, tile("shorten", "links-cache", "Links cache", "cache")),
      connect("shorten-cache", "cache", { tile: "links-cache" }),
    );
    const rows = modulesOf(assemble(cached));
    expect(rows?.find((item) => item.module === "shorten-cache")).toMatchObject({
      status: "template",
      template: "positive-cache-read",
    });
    expect(rows?.find((item) => item.module === "shorten-cache")?.files).toContain(
      "src/runtime/positive-cache.ts",
    );
    expect(rows?.find((item) => item.module === "shorten-links")?.status).toBe("template");
    // Tile-level designs keep the report's shape: the frozen v2 and the video preset.
    const v2 = assembleV2({ designJson: JSON.stringify(frozenV2) }, registry);
    expect("modules" in v2.report).toBe(false);
    const empty = designSchema.parse({
      schemaVersion: 2,
      revision: 0,
      elements: [],
      connections: [],
    });
    const preset = applyOperations(
      empty,
      buildGenerationPresetCommand(empty, { preset: "video" }).ops,
    );
    if (!preset.ok) throw new Error();
    expect("modules" in assemble(preset.design).report).toBe(false);
  });

  it("never overwrites an edited extension file", async () => {
    const scratch = await mkdtemp(join(tmpdir(), "jeeves-v2-stubs-"));
    try {
      const destination = join(scratch, "export");
      await exportNewDirectory(bundle.files, destination);
      const path = "src/modules/shorten/shorten-limit.ts";
      const edited = "export async function shortenLimit(): Promise<void> {}\n";
      await writeFile(join(destination, path), edited);
      await expect(exportNewDirectory(bundle.files, destination)).rejects.toMatchObject({
        code: "EEXIST",
      });
      // Connecting a slot changes the scaffold only; the extension's bytes stay the same.
      const next = assemble(
        run(run(design, tile("shorten", "limits", "Limits", "cache")), {
          type: "connectModule",
          module: "shorten-limit",
          slot: "store",
          target: { tile: "limits" },
        }),
      );
      expect(text(next, path)).toBe(text(bundle, path));
      expect(text(next, "src/modules/shorten/shorten-limit.slots.ts")).toContain(
        "  limits: CacheClient;",
      );
      const existing = await Promise.all(
        bundle.files.map(async (file) => ({
          path: file.path,
          bytes: new Uint8Array(await readFile(join(destination, file.path))),
        })),
      );
      expect(() => planFileWrites(next.files, existing)).toThrowError(
        expect.objectContaining({ code: "EXISTING_OUTPUT_CHANGED" }),
      );
      expect(() => planFileWrites(bundle.files, existing)).toThrowError(
        expect.objectContaining({ code: "EXISTING_OUTPUT_CHANGED", path }),
      );
      expect(await readFile(join(destination, path), "utf8")).toBe(edited);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });
});

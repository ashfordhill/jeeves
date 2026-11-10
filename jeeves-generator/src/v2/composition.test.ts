import {
  applyOperations,
  buildGenerationPresetCommand,
  designSchema,
  generationExportBlockers,
  generationPresets,
  resolveGeneration,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { tinyurlStudioExample } from "../../../jeeves/packages/spec/src/studio-examples/tinyurl.ts";
import { createProductAttachmentExample } from "../../examples/product-attachment/recipe.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

const empty = () =>
  designSchema.parse({ schemaVersion: 2, revision: 0, elements: [], connections: [] });
function attach(design = empty(), preset: "video" | "youtube" = "youtube", prefix?: string) {
  const result = applyOperations(
    design,
    buildGenerationPresetCommand(design, { preset, prefix }).ops,
  );
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  return result.design;
}
function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw Error("Missing fixture value");
  return value;
}
const registry = loadLocalV2Registry();
const read = (bundle: ReturnType<typeof assembleV2>, path: string) =>
  new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
describe("reusable composition before product completion", () => {
  it("exports reusable mechanisms from a saved product design and leaves every product implementation custom", () => {
    const design = attach();
    const before = structuredClone(design);
    expect(generationExportBlockers(design, registry.installed)).toEqual([]);
    expect(resolveGeneration(design, registry.installed).findings).toHaveLength(4);
    // The video preset stays installed for designs that attached it; nothing attaches it now.
    expect(registry.installed.presets).toEqual([generationPresets.video.ref]);
    expect(registry.installed.templates).toHaveLength(8);
    const a = assembleV2({ designJson: JSON.stringify(design) }, registry);
    expect(design).toEqual(before);
    expect(a.report.applicationComplete).toBe(false);
    expect(a.report.selections.filter((s) => s.status === "unfinished")).toHaveLength(3);
    expect(a.report.gaps.filter((g) => g.required)).toHaveLength(9);
    const plan = JSON.parse(read(a, "infra/local.json"));
    expect(plan.application).toEqual([]);
    expect(plan.identity[0].roles).toEqual([]);
    expect(plan.search).toEqual([]);
    expect(
      a.files.some((f) =>
        /src\/(adapters|services)\/|public-video|video-paths|infra\/edge/.test(f.path),
      ),
    ).toBe(false);
    expect(
      registry.sources.some(
        (s) =>
          /youtube|public-video|video-paths/.test(s.path) && s.path.startsWith("jeeves-generator/"),
      ),
    ).toBe(false);
    expect(read(a, "src/features/video-runtime.ts")).toContain('["ffmpeg", "ffprobe"]');
    expect(read(a, "src/features/service-resources.ts")).toContain(
      'ttlSeconds: input(s, "cache.ttlSeconds")',
    );
    const changed = structuredClone(design);
    const studio = required(changed.architecture?.studio);
    const tile = required(studio.elements.find((e) => e.element === "metadata-cache"));
    if (tile.settings.kind !== "cache") throw Error();
    tile.settings.ttlSeconds = 120;
    const mirror = required(studio.components?.find((c) => c.id === "watch-cache-reader"));
    if (mirror.settings.kind !== "cache-reader") throw Error();
    mirror.settings.l2TtlSeconds = 120;
    const edited = assembleV2({ designJson: JSON.stringify(changed) }, registry);
    expect(read(edited, "src/features/application-bindings.ts")).toContain(
      '"cache.ttlSeconds":120',
    );
  });
  it("attaches base graph/modules/ownership without search/count product choices and preserves existing nodes", () => {
    const existing = tinyurlStudioExample().design;
    const design = attach(existing, "video", "catalog"),
      bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
    expect(design.elements.some((e) => e.id === required(existing.elements[0]).id)).toBe(true);
    expect(design.elements).toHaveLength(existing.elements.length + 9);
    if (design.schemaVersion !== 3 || !design.generation || !design.ownership) throw Error();
    expect(design.generation.selections.map((s) => s.binding.kind)).toEqual([
      "owned-multipart",
      "asset-lifecycle",
      "video-hls",
    ]);
    expect(required(design.generation.selections[1]).binding).not.toHaveProperty("publication");
    expect(design.ownership.roles).toHaveLength(4);
    expect(JSON.parse(read(bundle, "infra/local.json")).application).toEqual([]);
    expect(JSON.parse(read(bundle, "infra/local.json")).identity[0].roles).toEqual([]);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(
      bundle.files.some(
        (f) =>
          f.path.includes("youtube") ||
          f.path.includes("search-query") ||
          f.path.includes("counter-worker"),
      ),
    ).toBe(false);
    expect(() => attach(design, "video", "catalog")).toThrow();
  });
  it("composes the product attachment through the default registry without YouTube/search/count dependencies", () => {
    const design = attach(empty(), "video", "fitting");
    const productRegistry = loadLocalV2Registry([createProductAttachmentExample()]);
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, productRegistry);
    expect(bundle.report.applicationComplete).toBe(true);
    expect(bundle.report.gaps).toEqual([]);
    const plan = JSON.parse(read(bundle, "infra/local.json"));
    expect(plan.application).toHaveLength(3);
    expect(plan.search).toEqual([]);
    expect(plan.identity[0].roles).toEqual([]);
    expect(plan.logins).toHaveLength(2);
    expect(plan.logins.every((l: { resource: string }) => l.resource.startsWith("fitting-"))).toBe(
      true,
    );
    expect(bundle.files.some((f) => /youtube|counter|search/.test(f.path))).toBe(false);
    expect(read(bundle, "src/examples/product.ts")).toContain("productId");
    expect(read(bundle, "src/examples/product-bindings.ts")).toContain("attachment_private");
    for (const file of bundle.files.filter((f) => f.path.startsWith("src/")))
      expect(new TextDecoder().decode(file.bytes)).not.toMatch(/from ["'][^"']*youtube/);
  });
  it("refuses disconnected saved bindings and preserves unsupported historic protocol intent", () => {
    const design = attach();
    if (design.schemaVersion !== 3 || !design.generation || !design.ownership) throw Error();
    const selected = required(
      design.generation.selections.find((s) => s.binding.kind === "youtube-upload"),
    );
    if (selected.binding.kind !== "youtube-upload") throw Error();
    selected.target = { kind: "element", element: "watch" };
    expect(() => assembleV2({ designJson: JSON.stringify(design) }, registry)).toThrow();
    const historic = attach();
    const connection = required(historic.connections[0]);
    connection.planned.security = "Service identity";
    const bundle = assembleV2({ designJson: JSON.stringify(historic) }, registry);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(connection.planned.security).toBe("Service identity");
  });
  it("keeps unknown identities and a missing runtime blocked while allowing known custom gaps", () => {
    const design = attach();
    if (design.schemaVersion !== 3 || !design.generation?.preset) throw Error();
    expect(
      generationExportBlockers(design, { ...registry.installed, runtime: undefined }),
    ).toContainEqual(expect.objectContaining({ target: { path: ["generation", "runtime"] } }));
    design.generation.preset.sha256 = "0".repeat(64);
    expect(generationExportBlockers(design, registry.installed)).toContainEqual(
      expect.objectContaining({ target: { path: ["generation", "preset"] } }),
    );
    const unknown = attach();
    if (unknown.schemaVersion !== 3 || !unknown.generation) throw Error();
    const index = unknown.generation.selections.findIndex(
      (selection) => selection.binding.kind === "youtube-watch",
    );
    required(unknown.generation.selections[index]).template.sha256 = "0".repeat(64);
    expect(generationExportBlockers(unknown, registry.installed)).toContainEqual(
      expect.objectContaining({
        target: { path: ["generation", "selections", index, "template"] },
      }),
    );
  });
});

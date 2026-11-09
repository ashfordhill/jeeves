import {
  applyOperations,
  buildGenerationPresetCommand,
  designSchema,
  resolveGeneration,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { tinyurlStudioExample } from "../../../jeeves/packages/spec/src/studio-examples/tinyurl.ts";
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
describe("compiled video and YouTube composition", () => {
  it("materializes one atomic complete local recipe and consumes selected settings in real processes", () => {
    const design = attach();
    expect(resolveGeneration(design, registry.installed).findings).toEqual([]);
    const a = assembleV2({ designJson: JSON.stringify(design) }, registry);
    expect(a.report.applicationComplete).toBe(true);
    expect(a.report.gaps).toEqual([]);
    const plan = JSON.parse(read(a, "infra/local.json")),
      compose = JSON.parse(read(a, "compose.yaml"));
    expect(plan.application).toHaveLength(8);
    expect(plan.identity[0].roles).toEqual(["creator"]);
    expect(compose.services["app-transcoder"].build.target).toBe("media");
    expect(compose.services["app-transcoder"].secrets).toEqual([
      "s3-transcoder",
      "broker-password",
    ]);
    expect(compose.services["app-search-indexer"].secrets).toEqual(["broker-password"]);
    expect(compose.services["app-watch"].secrets).toEqual([
      "sql-metadata-db--watch",
      "sql-view-counts--watch",
      "cache-metadata-cache",
      "broker-password",
    ]);
    expect(
      plan.grants
        .filter((g: { host: string }) => g.host === "watch")
        .every(
          (g: { kind: string; privileges: string[] }) =>
            g.kind === "view" && g.privileges.join() === "SELECT",
        ),
    ).toBe(true);
    expect(read(a, "infra/edge/nginx.conf")).toContain("/api/upload/");
    expect(read(a, "src/features/video-runtime.ts")).toContain('["ffmpeg", "ffprobe"]');
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
});

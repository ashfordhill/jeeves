import { generationRuntime } from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import type { V2Emitter } from "./registry.ts";

/** Storage and broker contributions use actual selected resource access. No SQL login or
 * service is contributed: the compiled recipe must bind codecs and the pinned media runtime. */
export function createLocalMediaWorker(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.media-worker",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "Bound storage/queue video execution, immutable marker reuse and confirmed results.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    local: ({ model }) => {
      const selections = model.selections.filter((s) => s.binding.kind === "video-hls");
      if (!selections.length) return undefined;
      return {
        sourcePaths: selections.map(
          (s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`,
        ),
        storage: selections.flatMap((s) => {
          const resources = ["originals", "outputs"].map((field) => {
            const resource = s.resources.find((r) => r.field === field);
            if (!resource) throw new Error("Normalized media object binding required");
            return resource.identity.local;
          });
          return [...new Set(resources)].map((resource) => ({ resource, host: s.host }));
        }),
        broker: selections.map((s) => {
          const jobs = s.resources.find((r) => r.field === "jobs");
          if (!jobs) throw new Error("Normalized media job queue required");
          return { resource: jobs.identity.local, host: s.host };
        }),
      };
    },
    render: ({ model, asset }) => {
      const paths = model.selections
        .filter((s) => s.binding.kind === "video-hls")
        .map((s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`);
      return {
        files: paths.length
          ? ["media-worker", "media-objects"].map((name) => ({
              path: `src/runtime/${name}.ts`,
              content: asset(
                `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts.template`,
              ),
              ownership: "generated-scaffold" as const,
              sourcePaths: paths,
            }))
          : [],
      };
    },
  };
}

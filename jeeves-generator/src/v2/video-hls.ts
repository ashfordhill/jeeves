import { generationRuntime } from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import type { V2Emitter } from "./registry.ts";

/** Shared identity is emitted once, without bringing SQL into a standalone video engine. */
export function createLocalAssetIdentity(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.asset-identity",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Finite asset/job identity shared by lifecycle and video dependencies.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const paths = model.selections
        .filter((s) => ["asset-lifecycle", "video-hls"].includes(s.binding.kind))
        .map((s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`);
      return {
        files: paths.length
          ? [
              "asset-identity",
              ...(model.selections.some((s) => s.binding.kind === "asset-lifecycle")
                ? ["event-identity"]
                : []),
            ].map((name) => ({
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

/** Engine files do not install a source-bound worker, runtime image or application. */
export function createLocalVideoHls(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.video-hls",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Fixed CPU video probe, HLS, full-size thumbnail and bound inventory dependency.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const paths = model.selections
        .filter((s) => s.binding.kind === "video-hls")
        .map((s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`);
      if (!paths.length) return { files: [] };
      return {
        files: ["media-process", "video-result", "video-hls"].map((name) => ({
          path: `src/runtime/${name}.ts`,
          content: asset(
            `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts.template`,
          ),
          ownership: "generated-scaffold" as const,
          sourcePaths: paths,
        })),
        gaps: [
          {
            id: "video-hls-worker-bindings",
            status: "unfinished" as const,
            required: true,
            description:
              "Bind authoritative job/result/event codecs, source/result namespaces, confirmed queue transports, pinned FFmpeg runtime and the single media service in a compiled recipe. Engine/runner libraries and access contributions alone install no worker.",
            sourcePaths: paths,
          },
        ],
      };
    },
  };
}

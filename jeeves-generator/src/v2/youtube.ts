import { generationRuntime } from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import type { V2Emitter } from "./registry.ts";

export {
  youtubeReadySelect,
  youtubeReadyView,
} from "../../templates/local-v2/assets/src/adapters/youtube-public-sql.ts";

/** Product contract libraries only. YV2-16 owns source-bound SQL/access, services and recipe;
 * emitting an adapter does not install an HTTP API or attest a complete selected template. */
export function createLocalYouTubeAdapters(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.youtube-adapters",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "YouTube metadata/wire/namespace and existing browser HTTP contract adapters.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const selections = model.selections.filter((s) => s.binding.kind.startsWith("youtube-"));
      if (!selections.length) return { files: [] };
      const paths = selections.map(
        (s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`,
      );
      const has = (kind: string) => model.selections.some((s) => s.binding.kind === kind);
      const names = [
        "features/video-paths.ts",
        "features/public-video.ts",
        "adapters/youtube-contract.ts.template",
        ...(has("youtube-upload")
          ? ["youtube-events", "youtube-lifecycle", "youtube-upload", "youtube-objects"]
              .map((name) => `adapters/${name}.ts.template`)
              .concat("adapters/youtube-public-sql.ts")
          : []),
        ...(has("youtube-watch") ? ["adapters/youtube-watch.ts.template"] : []),
        ...(has("youtube-watch") && has("event-counter")
          ? ["adapters/youtube-counter.ts.template"]
          : []),
        ...(has("search-projection") ? ["adapters/youtube-projection.ts.template"] : []),
        ...(has("youtube-search")
          ? ["adapters/youtube-search.ts.template", "features/public-video-search.ts.template"]
          : []),
      ];
      return {
        files: names.map((name) => ({
          path: `src/${name.replace(/\.template$/, "")}`,
          content: asset(`jeeves-generator/templates/local-v2/assets/src/${name}`),
          ownership: "generated-scaffold" as const,
          sourcePaths: paths,
        })),
        gaps: [
          {
            id: "youtube-service-composition",
            required: true,
            status: "unfinished" as const,
            description:
              "Bind actual selected resources/SQL/public views, emitted settings and verified identity; mount adapters in complete services with readiness, confirmed transports and signal/drain ownership. Product contract libraries alone install no source-bound application or preset.",
            sourcePaths: paths,
          },
        ],
      };
    },
  };
}

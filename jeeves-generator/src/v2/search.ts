import { generationRuntime } from "@jeeves/spec";
import {
  type SearchMapping,
  validateSearchMapping,
} from "../../templates/local-v2/assets/src/runtime/search-contract.ts";
import { jsonFile, pointerPart } from "../json.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import type { V2Emitter } from "./registry.ts";

export type {
  SearchField,
  SearchMapping,
} from "../../templates/local-v2/assets/src/runtime/search-contract.ts";

/** Compiled recipe contributes the same exact version/fields that its runtime asserts.
 * No saved-source mapping/DSL, index reset, SQL login or application service is introduced. */
export function searchProjectionMapping(binding: {
  resource: string;
  mapping: SearchMapping<Record<string, unknown>>;
  sourcePaths: readonly string[];
}): V2LocalContribution {
  validateSearchMapping(binding.mapping);
  return {
    sourcePaths: binding.sourcePaths,
    search: [{ resource: binding.resource, ...structuredClone(binding.mapping) }],
  };
}
export function createLocalSearch(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.search-projection-query",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Explicit public projection/versioned upsert and bounded query dependencies.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    local: ({ model }) => ({
      sourcePaths: ["/generation"],
      broker: model.selections
        .filter((s) => s.binding.kind === "search-projection")
        .map((s) => {
          const events = s.resources.find((r) => r.field === "events");
          if (!events) throw new Error("Normalized projection events required");
          return { resource: events.identity.local, host: s.host };
        }),
    }),
    render: ({ model, asset }) => {
      const selections = model.selections.filter((s) =>
        ["search-projection", "search-query"].includes(s.binding.kind),
      );
      if (!selections.length) return { files: [] };
      const paths = selections.map(
        (s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`,
      );
      const bindings = Object.fromEntries(
        selections.map((s) => {
          const index = s.resources.find((r) => r.field === "index");
          if (!index) throw new Error("Normalized search index required");
          const events = s.resources.find((r) => r.field === "events");
          return [
            s.id,
            {
              host: s.host,
              index: {
                resource: index.identity.local,
                endpoint: `http://search-${index.identity.local}:9200`,
              },
              ...(events && {
                events: {
                  resource: events.identity.local,
                  exchange: events.identity.local,
                  queue: `${events.identity.local}--${s.host}`,
                  failedQueue: `${events.identity.local}--${s.host}.failed`,
                },
              }),
            },
          ];
        }),
      );
      const names = [
        "search-contract",
        "search-schema",
        "search-query",
        ...(selections.some((s) => s.binding.kind === "search-projection")
          ? ["search-projection", "search-indexer"]
          : []),
      ];
      return {
        files: [
          ...names.map((name) => ({
            path: `src/runtime/${name}.ts`,
            content: asset(
              `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts${name === "search-contract" ? "" : ".template"}`,
            ),
            ownership: "generated-scaffold" as const,
            sourcePaths: paths,
          })),
          {
            path: "src/features/search-bindings.ts",
            content: `// Explicit normalized clients/index and topic subscriber; no SQL credential.\nexport const searchBindings = ${jsonFile(bindings).trim()} as const;\n`,
            ownership: "generated-scaffold" as const,
            sourcePaths: paths,
          },
          ...(model.selections.some((s) => s.binding.kind === "youtube-search")
            ? [
                {
                  path: "src/features/public-video.ts",
                  content: asset(
                    "jeeves-generator/templates/local-v2/assets/src/features/public-video.ts",
                  ),
                  ownership: "generated-scaffold" as const,
                  sourcePaths: paths,
                },
                {
                  path: "src/features/public-video-search.ts",
                  content: asset(
                    "jeeves-generator/templates/local-v2/assets/src/features/public-video-search.ts.template",
                  ),
                  ownership: "generated-scaffold" as const,
                  sourcePaths: paths,
                },
              ]
            : []),
        ],
        gaps: [
          {
            id: "search-application-bindings",
            required: true,
            status: "unfinished" as const,
            description:
              "Bind a committed public event codec, document ID/version, explicit contributed mapping and compiled query preset; construct actual bound indexer/query services with readiness, client/consumer drain and HTTP mapping. Dependencies alone install no application.",
            sourcePaths: paths,
          },
        ],
      };
    },
  };
}

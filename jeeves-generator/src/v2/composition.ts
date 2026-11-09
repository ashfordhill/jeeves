import {
  generationCapabilities,
  generationPolicies,
  generationPresets,
  generationTemplates,
  sameContractRef,
} from "@jeeves/spec";
import { jsonFile } from "../json.ts";
import type { V2Emitter } from "./registry.ts";

/** Resource constructors for reusable mechanisms. Product codecs, SQL projections, routes
 * and process entry points belong to application completion after the generated baseline. */
export function createLocalComposition(sourcePaths: readonly string[]): V2Emitter {
  const capabilities = (
    [
      "owned-multipart",
      "asset-lifecycle",
      "video-hls",
      "positive-cache-read",
      "event-counter",
      "search-projection",
      "search-query",
    ] as const
  ).map((kind) => [kind, generationCapabilities[kind]] as const);
  return {
    id: "local.video-composition",
    version: "0.1.0-experimental.2",
    status: "implemented",
    sourcePaths,
    description:
      "Reusable selected-resource constructors; application policy and services remain custom.",
    provides: {
      presets: [
        {
          ref: generationPresets.video.ref,
          outputPaths: [
            "src/features/application-bindings.ts",
            "src/features/service-resources.ts",
          ],
        },
      ],
      templates: capabilities.map(([kind, capability]) => ({
        ref: capability.template,
        consumers: [
          {
            input: "binding",
            consumer: kind,
            outputPaths: [
              "src/features/application-bindings.ts",
              "src/features/service-resources.ts",
            ],
          },
          ...Object.values(generationPolicies)
            .filter((p) =>
              generationTemplates[
                kind as keyof typeof generationTemplates
              ].definition.policies.some((ref) => sameContractRef(ref, p.ref)),
            )
            .map((p) => ({
              input: `policy.${p.ref.id}`,
              consumer: kind,
              outputPaths: [
                "src/features/application-bindings.ts",
                "src/features/service-resources.ts",
              ],
            })),
          ...capability.settings.map((rule) => ({
            input: rule.input,
            consumer: rule.consumer,
            outputPaths: [
              "src/features/application-bindings.ts",
              "src/features/service-resources.ts",
            ],
          })),
        ],
      })),
    },
    render: ({ model, asset }) => {
      const selections = model.selections.filter((s) =>
        capabilities.some(([kind]) => kind === s.binding.kind),
      );
      if (!selections.length) return { files: [] };
      let constructors = new TextDecoder().decode(
        asset(
          "jeeves-generator/templates/local-v2/assets/src/features/service-resources.ts.template",
        ),
      );
      for (const [section, required] of [
        [
          "sql",
          selections.some((s) =>
            s.resources.some((r) => ["state", "source", "counts"].includes(r.field)),
          ),
        ],
        [
          "objects",
          selections.some((s) =>
            s.resources.some((r) => ["objects", "originals", "outputs"].includes(r.field)),
          ),
        ],
        ["broker", selections.some((s) => s.resources.some((r) => !!r.channel))],
        ["cache", selections.some((s) => s.binding.kind === "positive-cache-read")],
      ] as const) {
        for (const name of [section, `${section}-import`])
          constructors = constructors.replace(
            new RegExp(`// @${name}-start[\\s\\S]*?// @${name}-end`, "g"),
            (block) => (required ? block.replace(/\/\/ @[^\n]+/g, "") : ""),
          );
      }
      const bindings = selections.map((s) => ({
        id: s.id,
        kind: s.binding.kind,
        host: s.host,
        identity: s.identity?.element,
        inputs: s.inputs,
        resources: Object.fromEntries(s.resources.map((r) => [r.field, r.identity.local])),
      }));
      const file = (path: string, content: string | Uint8Array) => ({
        path,
        content,
        sourcePaths: ["/generation"],
        ownership: "generated-scaffold" as const,
      });
      return {
        files: [
          file(
            "src/features/application-bindings.ts",
            `// Validated reusable selections/settings. Product declarations remain in the source/report.\nexport const selections: {id:string;kind:string;host:string;identity?:string;inputs:Record<string,string|number>;resources:Record<string,string>}[] = ${jsonFile(bindings).trim()};\n`,
          ),
          ...(selections.some((s) => s.binding.kind === "video-hls")
            ? [
                file(
                  "src/features/video-runtime.ts",
                  asset(
                    "jeeves-generator/templates/local-v2/assets/src/features/video-runtime.ts.template",
                  ),
                ),
              ]
            : []),
          file(
            "src/runtime/process.ts",
            asset("jeeves-generator/templates/local-v2/assets/src/runtime/process.ts.template"),
          ),
          file("src/features/service-resources.ts", constructors),
        ],
      };
    },
  };
}

import { generationRuntime } from "@jeeves/spec";
import { jsonFile, pointerPart } from "../json.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import { mountedHooksGap } from "./module-stubs.ts";
import type { V2Emitter } from "./registry.ts";

/** Trusted recipe names an actual public view. This grants no private table access and
 * creates no product projection; its owner must separately contribute the view definition. */
export function positiveCacheReadAccess(binding: {
  resource: string;
  host: string;
  view: { schema: string; name: string };
  sourcePaths: readonly string[];
}): V2LocalContribution {
  return {
    sourcePaths: binding.sourcePaths,
    logins: [{ resource: binding.resource, host: binding.host }],
    grants: [
      {
        resource: binding.resource,
        host: binding.host,
        schema: binding.view.schema,
        relation: binding.view.name,
        kind: "view",
        privileges: ["SELECT"],
      },
    ],
  };
}

export function createLocalPositiveCache(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.positive-cache",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "Positive-only immutable lookup, single-flight, bounded cache fallback and explicit adapter bindings.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const selections = model.selections.filter((s) => s.binding.kind === "positive-cache-read");
      const paths = selections.map(
        (s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`,
      );
      if (!paths.length) return { files: [] };
      const bindings = Object.fromEntries(
        selections.map((s) => {
          const source = s.resources.find((r) => r.field === "source");
          const cache = s.resources.find((r) => r.field === "cache");
          const ttlSeconds = s.inputs["cache.ttlSeconds"];
          if (!source || !cache || typeof ttlSeconds !== "number")
            throw new Error("Normalized positive cache source, cache and TTL required");
          return [
            s.id,
            {
              host: s.host,
              source: { resource: source.identity.local },
              cache: {
                resource: cache.identity.local,
                hostname: `cache-${cache.identity.local}`,
                port: 6379,
                secret: `cache-${cache.identity.local}`,
              },
              ttlSeconds,
            },
          ];
        }),
      );
      return {
        files: [
          ...["positive-cache", "valkey"].map((name) => ({
            path: `src/runtime/${name}.ts`,
            content: asset(
              `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts.template`,
            ),
            ownership: "generated-scaffold" as const,
            sourcePaths: paths,
          })),
          {
            path: "src/features/positive-cache-bindings.ts",
            content: `// Authoritative normalized resources and cache tile TTL; no module default.\nexport const positiveCacheBindings = ${jsonFile(bindings).trim()} as const;\n`,
            ownership: "generated-scaffold" as const,
            sourcePaths: paths,
          },
        ],
        gaps: [
          mountedHooksGap(model, selections, {
            id: "positive-cache-application-bindings",
            required: true,
            status: "unfinished" as const,
            description:
              "Bind an immutable public-record codec, requested identity/eligibility, key and authoritative loader; contribute an explicit ready-only view/login and construct the reader with emitted TTL and actual cache client in the service. Dependency output alone installs no application.",
            sourcePaths: paths,
          }),
        ],
      };
    },
  };
}

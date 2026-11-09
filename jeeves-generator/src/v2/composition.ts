import {
  generationCapabilities,
  generationPolicies,
  generationPresets,
  generationTemplates,
  type NormalizedGeneration,
  type NormalizedGenerationSelection,
  sameContractRef,
} from "@jeeves/spec";
import { publicVideoMapping } from "../../templates/local-v2/assets/src/features/public-video.ts";
import { jsonFile, refuse } from "../json.ts";
import { assetLifecyclePersistence } from "./asset-lifecycle.ts";
import { eventCounterPersistence, eventCounterReadAccess } from "./event-counter.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import { positiveCacheReadAccess } from "./positive-cache.ts";
import type { V2Emitter } from "./registry.ts";
import { ownedUploadPersistence } from "./upload-state.ts";
import { youtubeReadySelect } from "./youtube.ts";

export const videoRelations = {
  uploads: { schema: "asset_private", table: "uploads" },
  assets: { schema: "asset_private", table: "assets" },
  receipts: { schema: "asset_private", table: "receipts" },
  outbox: { schema: "asset_private", table: "outbox", destinations: ["jobs", "publication"] },
  ready: { schema: "asset_public", table: "ready" },
  counts: {
    receipts: { schema: "count_private", table: "receipts" },
    totals: { schema: "count_private", table: "totals" },
  },
  totals: { schema: "count_public", table: "totals" },
} as const;
const resource = (s: NormalizedGenerationSelection, field: string) => {
  const r = s.resources.find((r) => r.field === field);
  if (!r) throw new Error(`Missing normalized ${s.id}.${field}`);
  return r.identity.local;
};
/** Exact connected recipe; neither labels nor ID prefixes select behavior. Incomplete selections
 * stay libraries with explicit hooks. A declared YouTube preset with conflicting refs refuses. */
export function youtubeComposition(model: NormalizedGeneration) {
  if (!model.preset || !sameContractRef(model.preset, generationPresets.youtube.ref))
    return undefined;
  const rows = Object.fromEntries(
    Object.keys(generationTemplates).map((kind) => {
      const matches = model.selections.filter((s) => s.binding.kind === kind);
      if (matches.length !== 1) return [kind, undefined];
      return [kind, matches[0]];
    }),
  );
  if (Object.values(rows).some((r) => !r)) return undefined;
  const get = (kind: keyof typeof generationTemplates) =>
    rows[kind] as NormalizedGenerationSelection;
  const upload = get("owned-multipart"),
    lifecycle = get("asset-lifecycle"),
    media = get("video-hls"),
    reader = get("positive-cache-read"),
    counter = get("event-counter"),
    projection = get("search-projection"),
    query = get("search-query"),
    uploadApi = get("youtube-upload"),
    watch = get("youtube-watch"),
    search = get("youtube-search");
  const valid =
    lifecycle.binding.kind === "asset-lifecycle" &&
    lifecycle.binding.upload === upload.id &&
    uploadApi.binding.kind === "youtube-upload" &&
    uploadApi.binding.upload === upload.id &&
    uploadApi.binding.lifecycle === lifecycle.id &&
    uploadApi.host === upload.host &&
    watch.binding.kind === "youtube-watch" &&
    watch.binding.reader === reader.id &&
    watch.host === reader.host &&
    search.binding.kind === "youtube-search" &&
    search.binding.query === query.id &&
    search.host === query.host &&
    resource(upload, "state") === resource(lifecycle, "state") &&
    upload.owner === lifecycle.owner &&
    resource(reader, "source") === resource(upload, "state") &&
    resource(upload, "jobs") === resource(media, "jobs") &&
    resource(upload, "objects") === resource(media, "originals") &&
    resource(lifecycle, "results") === resource(media, "results") &&
    resource(lifecycle, "publication") === resource(projection, "events") &&
    resource(projection, "index") === resource(query, "index") &&
    resource(watch, "counts") === resource(counter, "state") &&
    resource(watch, "events") === resource(counter, "events") &&
    new Set([
      upload.host,
      lifecycle.host,
      media.host,
      reader.host,
      counter.host,
      projection.host,
      query.host,
    ]).size === 7;
  if (!valid)
    refuse(
      "INVALID_YOUTUBE_COMPOSITION",
      "/generation",
      "YouTube requires explicit connected upload/lifecycle/media/public-read/search/count refs and one same-authority Video store.",
    );
  return { upload, lifecycle, media, reader, counter, projection, query, uploadApi, watch, search };
}
const hooks = [
  ["local.multipart", "multipart-application-bindings"],
  ["local.asset-lifecycle", "asset-lifecycle-application-bindings"],
  ["local.positive-cache", "positive-cache-application-bindings"],
  ["local.event-counter", "event-counter-application-bindings"],
  ["local.search-projection-query", "search-application-bindings"],
  ["local.youtube-adapters", "youtube-service-composition"],
  ["local.video-hls", "video-hls-worker-bindings"],
];
export function createLocalComposition(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.video-composition",
    version: "0.1.0-experimental.1",
    status: "implemented",
    sourcePaths,
    description:
      "Reusable resource-bound video constructors and complete finite YouTube backend recipe.",
    provides: {
      presets: [
        {
          ref: generationPresets.video.ref,
          outputPaths: [
            "src/features/application-bindings.ts",
            "src/features/service-resources.ts",
          ],
        },
        { ref: generationPresets.youtube.ref, outputPaths: ["src/services/youtube.ts"] },
      ],
      templates: Object.entries(generationCapabilities).map(([kind, capability]) => ({
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
    local: ({ model }) => {
      const c = youtubeComposition(model);
      if (!c) return undefined;
      const paths = ["/generation"];
      const state = resource(c.upload, "state"),
        counts = resource(c.counter, "state");
      const parts: V2LocalContribution[] = [
        ownedUploadPersistence({
          resource: state,
          host: c.upload.host,
          relation: videoRelations.uploads,
          migrationId: "001-uploads.sql",
          sourcePaths: paths,
        }),
        assetLifecyclePersistence({
          resource: state,
          uploadHost: c.upload.host,
          lifecycleHost: c.lifecycle.host,
          relation: videoRelations.assets,
          receipts: videoRelations.receipts,
          outbox: {
            ...videoRelations.outbox,
            destinations: [...videoRelations.outbox.destinations],
          },
          migrationId: "002-lifecycle.sql",
          sourcePaths: paths,
        }),
        positiveCacheReadAccess({
          resource: state,
          host: c.reader.host,
          view: { schema: videoRelations.ready.schema, name: videoRelations.ready.table },
          sourcePaths: paths,
        }),
        eventCounterPersistence({
          resource: counts,
          writerHost: c.counter.host,
          tables: videoRelations.counts,
          publicView: videoRelations.totals,
          migrationId: "001-counts.sql",
          sourcePaths: paths,
        }),
        eventCounterReadAccess({
          resource: counts,
          host: c.watch.host,
          publicView: videoRelations.totals,
          sourcePaths: paths,
        }),
      ];
      return {
        sourcePaths: paths,
        identityRoles: c.upload.identity
          ? [{ element: c.upload.identity.element, roles: ["creator"] }]
          : [],
        logins: parts.flatMap((p) => p.logins ?? []),
        grants: parts.flatMap((p) => p.grants ?? []),
        migrations: [
          ...parts.flatMap((p) => p.migrations ?? []),
          {
            resource: state,
            id: "003-ready-schema.sql",
            sql: `CREATE SCHEMA IF NOT EXISTS "asset_public"; REVOKE ALL ON SCHEMA "asset_public" FROM PUBLIC;\n`,
          },
        ],
        views: [
          ...parts.flatMap((p) => p.views ?? []),
          {
            resource: state,
            schema: videoRelations.ready.schema,
            name: videoRelations.ready.table,
            selectSql: youtubeReadySelect(videoRelations.assets),
          },
        ],
        broker: [{ resource: resource(c.lifecycle, "results"), host: c.lifecycle.host }],
        search: [{ resource: resource(c.projection, "index"), ...publicVideoMapping }],
        services: [
          {
            host: c.upload.host,
            command: ["node", "dist/services/youtube.js", "upload"],
            http: true,
            identity: c.upload.identity?.element,
            dependsOn: [state, resource(c.upload, "objects"), resource(c.upload, "jobs")],
            sql: [state],
            storage: [resource(c.upload, "objects")],
            broker: true,
            environment: {
              OBJECT_PUBLIC_ENDPOINT:
                "http://127.0.0.1:${LOCAL_OBJECT_PORT:?Set LOCAL_OBJECT_PORT}",
            },
          },
          {
            host: c.lifecycle.host,
            command: ["node", "dist/services/youtube.js", "lifecycle"],
            dependsOn: [
              state,
              resource(c.lifecycle, "results"),
              resource(c.lifecycle, "publication"),
            ],
            sql: [state],
            broker: true,
          },
          {
            host: c.media.host,
            command: ["node", "dist/services/youtube.js", "media"],
            target: "media" as const,
            dependsOn: [
              resource(c.media, "originals"),
              resource(c.media, "outputs"),
              resource(c.media, "jobs"),
              resource(c.media, "results"),
            ],
            storage: [resource(c.media, "originals"), resource(c.media, "outputs")],
            broker: true,
          },
          {
            host: c.reader.host,
            command: ["node", "dist/services/youtube.js", "watch"],
            http: true,
            dependsOn: [state, counts, resource(c.reader, "cache"), resource(c.watch, "events")],
            sql: [state, counts],
            cache: [resource(c.reader, "cache")],
            broker: true,
          },
          {
            host: c.counter.host,
            command: ["node", "dist/services/youtube.js", "counter"],
            dependsOn: [counts, resource(c.counter, "events")],
            sql: [counts],
            broker: true,
          },
          {
            host: c.projection.host,
            command: ["node", "dist/services/youtube.js", "indexer"],
            dependsOn: [resource(c.projection, "index"), resource(c.projection, "events")],
            broker: true,
          },
          {
            host: c.query.host,
            command: ["node", "dist/services/youtube.js", "search"],
            http: true,
            dependsOn: [resource(c.query, "index")],
          },
        ].map((s) => ({ ...s, readiness: true })),
        youtubeEdge: {
          upload: c.upload.host,
          watch: c.reader.host,
          search: c.query.host,
          outputs: resource(c.media, "outputs"),
        },
      };
    },
    render: ({ model, asset }) => {
      if (!model.selections.length) return { files: [] };
      const c = youtubeComposition(model);
      let constructors = new TextDecoder().decode(
        asset(
          "jeeves-generator/templates/local-v2/assets/src/features/service-resources.ts.template",
        ),
      );
      for (const [section, required] of [
        [
          "sql",
          model.selections.some((s) =>
            s.resources.some((r) => ["state", "source", "counts"].includes(r.field)),
          ),
        ],
        [
          "objects",
          model.selections.some((s) =>
            s.resources.some((r) => ["objects", "originals", "outputs"].includes(r.field)),
          ),
        ],
        ["broker", model.selections.some((s) => s.resources.some((r) => !!r.channel))],
      ] as const) {
        for (const name of [section, `${section}-import`])
          constructors = constructors.replace(
            new RegExp(`// @${name}-start[\\s\\S]*?// @${name}-end`, "g"),
            (block) => (required ? block.replace(/\/\/ @[^\n]+/g, "") : ""),
          );
      }
      const bindings = model.selections.map((s) => ({
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
            `// Validated selected refs/settings. Constructors consume these exact values.\nexport const selections: {id:string;kind:string;host:string;identity?:string;inputs:Record<string,string|number>;resources:Record<string,string>}[] = ${jsonFile(bindings).trim()};\nexport const relations = ${jsonFile(c ? videoRelations : { uploads: videoRelations.uploads, assets: videoRelations.assets, receipts: videoRelations.receipts, outbox: { ...videoRelations.outbox, destinations: ["jobs"] } }).trim()} as const;\n`,
          ),
          ...(c
            ? [
                file(
                  "src/services/youtube.ts",
                  asset(
                    "jeeves-generator/templates/local-v2/assets/src/services/youtube.ts.template",
                  ),
                ),
              ]
            : []),
          ...(model.selections.some((s) => s.binding.kind === "video-hls")
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
        ...(c ? { resolves: hooks.map(([emitter, id]) => ({ emitter: emitter!, id: id! })) } : {}),
      };
    },
  };
}

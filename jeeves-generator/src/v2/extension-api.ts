import { pointer } from "./http-wiring.ts";
import type { V2Emitter } from "./registry.ts";

/** A finite public surface. Runtime implementation imports remain private to generated code. */
export function createLocalExtensionApi(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.extension-api",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "Checked product extension imports and DTO-only policy hooks; no driver or lifecycle authority.",
    sourcePaths,
    render: ({ model, asset }) => {
      const has = (kind: string) => model.selections.some((s) => s.binding.kind === kind);
      const http =
        model.processes?.some((p) => p.shape === "http") ||
        model.selections.some((s) => "host.requestTimeoutMs" in s.inputs);
      const publicLines = [
        "/** Public extension API v8. Application contracts live in src/contracts/. */",
        'export class NotImplemented extends Error { constructor(what: string) { super("Not implemented: " + what); this.name = "NotImplemented"; } }',
        'export type { OperationContext, OperationFailure, EffectOutcome, PublisherOptions } from "../runtime/operation.ts";',
        'export { OperationError } from "../runtime/operation.ts";',
        "/** Registered parameterized product operations; no raw SQL, transaction or lifecycle handle. */",
        "export interface ProductQueries { call(name: string, parameters: readonly unknown[]): Promise<Readonly<{ rows: readonly unknown[]; rowCount: number }>>; }",
        "export interface UnavailableCapability { call(input: unknown): Promise<never>; }",
        "export interface ServiceTarget { call(operation: string, request: Readonly<{ method: 'GET' | 'POST'; body?: unknown; key?: string }>): Promise<Readonly<{ status: number; body: unknown }>>; }",
        "export interface FavoritesHooks { eligible(itemId: string): boolean; }",
        "export type DatabaseReader = ProductQueries; export type DatabaseReadWriter = ProductQueries; export type QueueConsumer = UnavailableCapability; export type TokenVerifier = UnavailableCapability; export type HttpTarget = UnavailableCapability;",
      ];
      if (
        model.processes?.some((p) =>
          p.stubs.some((s) => s.stores?.some((store) => store.kind === "database")),
        )
      )
        publicLines.push(
          'export { defineLocalOperation } from "../runtime/local-operation.ts";',
          'export { defineWorkloadOperation } from "../runtime/local-operation.ts";',
          'export type { WorkloadCaller, WorkloadOperation } from "../runtime/local-operation.ts";',
          'export type { LocalOperation, LocalCommands, LocalResult } from "../runtime/local-operation.ts";',
          'export { defineDurableWork } from "../runtime/durable-work.ts";',
          'export type { DurableWork, WorkStatus, WorkState } from "../runtime/durable-work.ts";',
        );
      if (has("webhook-receiver"))
        publicLines.push(
          'export { defineWebhookWork } from "../runtime/webhook.ts";',
          'export type { WebhookEvent, WebhookWork } from "../runtime/webhook.ts";',
        );
      if (has("rate-limiter"))
        publicLines.push(
          'export type { RateLimiterCapability, RateLimiterHooks, RateLimitDecision } from "../runtime/rate-limiter.ts";',
        );
      if (has("favorites"))
        publicLines.push(
          'export type { FavoritesCapability, Favorite, FavoritesPage } from "../runtime/favorites.ts";',
        );
      if (http)
        publicLines.push(
          'export type { PublicHttpError, HttpErrorFormatter } from "../runtime/admission.ts";',
        );
      const safeTypes: [string, string, boolean][] = [
        [
          "positive-cache",
          "PositiveReadAdapter, CacheReaderCapability, CacheReadResult",
          has("positive-cache-read"),
        ],

        ["event-counter", "CounterAdapter", has("event-counter")],
        ["media-worker", "MediaCodecs", has("video-hls")],
        ["video-result", "VideoHlsJob", has("video-hls")],
        ["search-contract", "SearchMapping", has("search-projection") || has("search-query")],
        [
          "tile-search",
          "SearchIndexHooks, SearchQueryHooks",
          !!model.processes && (has("search-projection") || has("search-query")),
        ],
        ["search-query", "SearchQueryPreset", has("search-query")],
      ];
      for (const [file, names, used] of safeTypes)
        if (used) publicLines.push(`export type { ${names} } from "../runtime/${file}.ts";`);
      if (has("module-stub") || has("scheduled-task") || has("webhook-receiver"))
        publicLines.push(
          'export type { CacheClient, ObjectReader, ObjectWriter, ObjectStore, QueuePublisher, SearchReader, SearchWriter, SearchIndex, ModuleCall } from "../modules/dependencies.ts";',
          'export { declareSettings, text, integer, url, optional, signingKeys, sealingKeys } from "../runtime/settings.ts";',
          'export type { SettingsOf } from "../runtime/settings.ts";',
          'export type { SigningKeys, SealingKeys, ValueContext } from "../runtime/keys.ts";',
        );
      if (model.processes?.some((p) => p.stubs.some((s) => s.role !== "library")))
        publicLines.push(
          'export { defineRoutes } from "../modules/entry.ts";',
          'export type { ModuleRequest, ModuleResponse, ModuleMessage, Caller } from "../modules/entry.ts";',
        );
      let boundary = new TextDecoder().decode(
        asset("jeeves-generator/templates/local-v2/assets/src/runtime/hook-boundary.ts.template"),
      );
      if (has("owned-multipart")) {
        publicLines.push(
          'import type { UploadHooks as InternalUploadHooks } from "../runtime/owned-upload.ts";',
          'export type { UploadFile } from "../runtime/owned-upload.ts";',
          "type OmitTx<F> = F extends (tx: never, ...args: infer A) => infer R ? (...args: A) => Awaited<R> : never;",
          'export type UploadHooks<M, R> = Omit<InternalUploadHooks<M, R>, "reserve" | "complete" | "closed"> & { reserve: OmitTx<InternalUploadHooks<M, R>["reserve"]>; complete: OmitTx<InternalUploadHooks<M, R>["complete"]>; closed: OmitTx<InternalUploadHooks<M, R>["closed"]>; };',
        );
        boundary +=
          '\nimport type { UploadHooks } from "./owned-upload.ts";\nexport function bindUploadHooks<T extends { upload: object }>(value: T, lifecycle?: Pick<UploadHooks<unknown, unknown>, "reserve" | "complete" | "closed">): Omit<T, "upload"> & { upload: UploadHooks<unknown, unknown> } {\n const wrapped = productHooks(value);\n return { ...wrapped, upload: { ...wrapped.upload, ...(lifecycle ? {reserve: lifecycle.reserve, complete: lifecycle.complete, closed: lifecycle.closed} : {}) } } as Omit<T, "upload"> & { upload: UploadHooks<unknown, unknown> };\n}\n';
      }
      if (has("asset-lifecycle")) {
        publicLines.push(
          'import type { AssetLifecycleHooks as InternalAssetHooks } from "../runtime/asset-lifecycle.ts";',
          'export type { AssetLifecycleBinding } from "../runtime/asset-lifecycle.ts";',
          "type AssetOmitTx<F> = F extends (tx: never, ...args: infer A) => infer R ? (...args: A) => Awaited<R> : never;",
          'export type AssetLifecycleHooks<M,R,S,J,P> = Omit<InternalAssetHooks<M,R,S,J,P>, "failed" | "job" | "publication"> & { failed?: AssetOmitTx<NonNullable<InternalAssetHooks<M,R,S,J,P>["failed"]>>; job: Omit<InternalAssetHooks<M,R,S,J,P>["job"], "construct"> & { construct: AssetOmitTx<InternalAssetHooks<M,R,S,J,P>["job"]["construct"]> }; publication?: Omit<NonNullable<InternalAssetHooks<M,R,S,J,P>["publication"]>, "construct"> & { construct: AssetOmitTx<NonNullable<InternalAssetHooks<M,R,S,J,P>["publication"]>["construct"]> }; };',
        );
        boundary +=
          '\nimport type { AssetLifecycleHooks } from "./asset-lifecycle.ts";\nexport function bindAssetHooks<T>(hooks: T): T & AssetLifecycleHooks<unknown, unknown, unknown, unknown, unknown> { return productHooks(hooks) as T & AssetLifecycleHooks<unknown, unknown, unknown, unknown, unknown>; }\n';
      }
      const file = (path: string, content: string | Uint8Array, extension = false) => ({
        path,
        content,
        ownership: extension ? ("generated-extension" as const) : ("generated-scaffold" as const),
        sourcePaths: ["/generation"],
      });
      return {
        files: [
          file("src/extension-api/index.ts", `${publicLines.join("\n")}\n`),
          ...(http
            ? [
                file(
                  "src/http-errors.hooks.ts",
                  '/** Pure public error body policy, shared by every HTTP process. No status/header authority. */\nimport type { HttpErrorFormatter } from "./extension-api/index.ts";\nexport const formatHttpError: HttpErrorFormatter = (error) => ({ error: error.code, message: error.message });\n',
                  true,
                ),
              ]
            : []),
          file(
            "src/contracts/index.ts",
            "/** Application-owned DTOs and pure shared definitions. Public across processes. */\nexport {};\n",
            true,
          ),
          ...(model.processes?.length || has("rate-limiter") || has("positive-cache-read")
            ? [file("src/runtime/hook-boundary.ts", boundary)]
            : []),
        ],
        gaps: model.selections.flatMap((s) => {
          const reason =
            s.binding.kind === "module-stub"
              ? "Migrate legacy Custom code to src/extension-api/index.ts. Use registered product SQL names and positional values for database links. Raw SQL, token verification and arbitrary HTTP target calls remain unavailable."
              : s.binding.kind === "positive-cache-read"
                ? "The loader receives a scoped registered read-only ProductQueries handle. Register its named SELECT and declared relations in products.json, then supply the codec/eligibility/load policy; no raw SQL or private runtime import."
                : undefined;
          return reason
            ? [
                {
                  id: `restricted-${s.id}`,
                  status: "custom" as const,
                  required: true,
                  description: reason,
                  sourcePaths: [pointer(s.sourcePath)],
                },
              ]
            : [];
        }),
      };
    },
  };
}

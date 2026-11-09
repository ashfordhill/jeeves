import type { NormalizedGenerationSelection } from "@jeeves/spec";
import { assetLifecyclePersistence } from "../../src/v2/asset-lifecycle.ts";
import type { V2Emitter } from "../../src/v2/registry.ts";
import { ownedUploadPersistence } from "../../src/v2/upload-state.ts";

export const productRelations = {
  uploads: { schema: "attachment_private", table: "transfers" },
  assets: { schema: "attachment_private", table: "attachments" },
  receipts: { schema: "attachment_private", table: "delivery_receipts" },
  outbox: { schema: "attachment_private", table: "job_intents", destinations: ["encode"] },
};
const paths = [
  "jeeves-generator/examples/product-attachment/export.ts",
  "jeeves-generator/examples/product-attachment/recipe.ts",
  "jeeves-generator/examples/product-attachment/product.ts.template",
  "jeeves-generator/examples/product-attachment/service.ts.template",
] as const;
const resource = (s: NormalizedGenerationSelection, field: string) => {
  const value = s.resources.find((r) => r.field === field);
  if (!value) throw Error(`Missing product attachment ${field}`);
  return value.identity.local;
};
/** Trusted compiled example, explicitly registered by its harness. Saved names cannot install
 * it. Only product metadata, namespaces, codecs and construction live here; no copied engines. */
export function createProductAttachmentExample(): V2Emitter {
  function composition(model: Parameters<NonNullable<V2Emitter["local"]>>[0]["model"]) {
    const selections = model.selections;
    if (selections.length !== 3) throw Error("Example requires exactly the base video pack");
    const get = (kind: string) => {
      const rows = selections.filter((s) => s.binding.kind === kind);
      if (rows.length !== 1 || !rows[0]) throw Error("Example requires explicit video selections");
      return rows[0];
    };
    const upload = get("owned-multipart"),
      lifecycle = get("asset-lifecycle"),
      media = get("video-hls");
    if (
      lifecycle.binding.kind !== "asset-lifecycle" ||
      lifecycle.binding.upload !== upload.id ||
      lifecycle.binding.publication ||
      upload.owner !== lifecycle.owner ||
      resource(upload, "state") !== resource(lifecycle, "state") ||
      resource(upload, "jobs") !== resource(media, "jobs") ||
      resource(upload, "objects") !== resource(media, "originals") ||
      resource(lifecycle, "results") !== resource(media, "results") ||
      new Set([upload.host, lifecycle.host, media.host]).size !== 3
    )
      throw Error("Disconnected product attachment recipe");
    return { upload, lifecycle, media };
  }
  return {
    id: "example.product-attachment",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Bounded product association proof through shared upload/lifecycle/media engines.",
    sourcePaths: paths,
    local: ({ model }) => {
      const c = composition(model),
        state = resource(c.upload, "state"),
        sourcePaths = ["/generation"];
      const parts = [
        ownedUploadPersistence({
          resource: state,
          host: c.upload.host,
          relation: productRelations.uploads,
          migrationId: "001-transfers.sql",
          sourcePaths,
        }),
        assetLifecyclePersistence({
          resource: state,
          uploadHost: c.upload.host,
          lifecycleHost: c.lifecycle.host,
          relation: productRelations.assets,
          receipts: productRelations.receipts,
          outbox: productRelations.outbox,
          migrationId: "002-attachments.sql",
          sourcePaths,
        }),
      ];
      return {
        sourcePaths,
        logins: parts.flatMap((p) => p.logins ?? []),
        grants: parts.flatMap((p) => p.grants ?? []),
        migrations: parts.flatMap((p) => p.migrations ?? []),
        broker: [{ resource: resource(c.lifecycle, "results"), host: c.lifecycle.host }],
        services: [
          {
            host: c.upload.host,
            command: ["node", "dist/examples/attachment-service.js", "upload"],
            dependsOn: [state, resource(c.upload, "objects"), resource(c.upload, "jobs")],
            sql: [state],
            storage: [resource(c.upload, "objects")],
            broker: true,
          },
          {
            host: c.lifecycle.host,
            command: ["node", "dist/examples/attachment-service.js", "lifecycle"],
            dependsOn: [state, resource(c.lifecycle, "results")],
            sql: [state],
            broker: true,
          },
          {
            host: c.media.host,
            command: ["node", "dist/examples/attachment-service.js", "media"],
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
        ].map((s) => ({ ...s, readiness: true })),
      };
    },
    render: ({ model, asset }) => {
      composition(model);
      return {
        files: [
          {
            path: "src/examples/product-bindings.ts",
            content: `export const productRelations = ${JSON.stringify(productRelations)} as const;\n`,
          },
          { path: "src/examples/product.ts", content: asset(paths[2]) },
          { path: "src/examples/attachment-service.ts", content: asset(paths[3]) },
        ].map((f) => ({
          ...f,
          ownership: "generated-extension" as const,
          sourcePaths: ["/generation"],
        })),
        resolves: [
          { emitter: "local.multipart", id: "multipart-application-bindings" },
          { emitter: "local.asset-lifecycle", id: "asset-lifecycle-application-bindings" },
          { emitter: "local.video-hls", id: "video-hls-worker-bindings" },
        ],
      };
    },
  };
}

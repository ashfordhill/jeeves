import { generationRuntime } from "@jeeves/spec";
import { assetLifecycleSchema } from "../../templates/local-v2/assets/src/runtime/asset-sql.ts";
import { pointerPart } from "../json.ts";
import { type OutboxTable, outboxSchema, receiptSchema, type SqlRelation } from "./durability.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import type { V2Emitter } from "./registry.ts";

export {
  assetLifecycleSchema,
  assetReadySelect,
} from "../../templates/local-v2/assets/src/runtime/asset-sql.ts";

/** Explicit compiled same-authority upload/lifecycle access, validated by the foundation.
 * Media workers/readers receive no SQL login here. Public projections are application-owned. */
export function assetLifecyclePersistence(binding: {
  resource: string;
  uploadHost: string;
  lifecycleHost: string;
  relation: SqlRelation;
  receipts: SqlRelation;
  outbox: OutboxTable;
  migrationId: string;
  sourcePaths: readonly string[];
}): V2LocalContribution {
  const hosts = [...new Set([binding.uploadHost, binding.lifecycleHost])];
  return {
    sourcePaths: binding.sourcePaths,
    migrations: [
      {
        resource: binding.resource,
        id: binding.migrationId,
        sql:
          assetLifecycleSchema(binding.relation) +
          receiptSchema(binding.receipts) +
          outboxSchema(binding.outbox),
      },
    ],
    logins: hosts.map((host) => ({ resource: binding.resource, host })),
    grants: hosts.flatMap((host) =>
      [
        {
          relation: binding.relation,
          privileges:
            host === binding.uploadHost
              ? (["SELECT", "INSERT", "UPDATE"] as const)
              : (["SELECT", "UPDATE"] as const),
        },
        { relation: binding.outbox, privileges: ["SELECT", "INSERT", "UPDATE"] as const },
        ...(host === binding.lifecycleHost
          ? [{ relation: binding.receipts, privileges: ["SELECT", "INSERT", "UPDATE"] as const }]
          : []),
      ].map(({ relation, privileges }) => ({
        resource: binding.resource,
        host,
        schema: relation.schema,
        relation: relation.table,
        kind: "table" as const,
        privileges,
      })),
    ),
  };
}

export function createLocalAssetLifecycle(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.asset-lifecycle",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "Fixed asset lifecycle, upload hooks, result receipts and optional committed publication dependency.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const paths = model.selections
        .filter((s) => s.binding.kind === "asset-lifecycle")
        .map((s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`);
      if (!paths.length) return { files: [] };
      return {
        files: ["asset-sql", "asset-lifecycle", "asset-worker"].map((name) => ({
          path: `src/runtime/${name}.ts`,
          content: asset(
            `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts${name === "asset-sql" ? "" : ".template"}`,
          ),
          ownership: "generated-scaffold" as const,
          sourcePaths: paths,
        })),
        gaps: [
          {
            id: "asset-lifecycle-application-bindings",
            status: "unfinished" as const,
            required: true,
            description:
              "Bind metadata/result/event/job/response codecs, stable event identities, upload hooks, optional committed publication/public projection, explicit SQL contributions and worker/service construction in a compiled recipe. Dependency output alone installs no application.",
            sourcePaths: paths,
          },
        ],
      };
    },
  };
}

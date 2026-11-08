import { generationRuntime } from "@jeeves/spec";
import { ownedUploadSchema } from "../../templates/local-v2/assets/src/runtime/upload-sql.ts";
import { pointerPart } from "../json.ts";
import type { SqlRelation } from "./durability.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import type { V2Emitter } from "./registry.ts";

export { ownedUploadSchema } from "../../templates/local-v2/assets/src/runtime/upload-sql.ts";

/** Compiled recipes bind the table to their selected store/host. Foundation validates authority
 * and is the sole writer of migrations/logins/grants; selecting this dependency grants nothing. */
export function ownedUploadPersistence(binding: {
  resource: string;
  host: string;
  relation: SqlRelation;
  migrationId: string;
  sourcePaths: readonly string[];
}): V2LocalContribution {
  return {
    sourcePaths: binding.sourcePaths,
    migrations: [
      {
        resource: binding.resource,
        id: binding.migrationId,
        sql: ownedUploadSchema(binding.relation),
      },
    ],
    logins: [{ resource: binding.resource, host: binding.host }],
    grants: [
      {
        resource: binding.resource,
        host: binding.host,
        schema: binding.relation.schema,
        relation: binding.relation.table,
        kind: "table",
        privileges: ["SELECT", "INSERT", "UPDATE"],
      },
    ],
  };
}

/** Durable dependency only; signed multipart is not installed until its engine exists. */
export function createLocalUploadState(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.upload-state",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Owned transfer repository and transaction-bound metadata/completion hooks only.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const paths = model.selections
        .filter((s) => s.binding.kind === "owned-multipart")
        .map((s) => `/${s.sourcePath.map((part) => pointerPart(String(part))).join("/")}`);
      return {
        files: paths.length
          ? ["upload-sql", "owned-upload"].map((name) => ({
              path: `src/runtime/${name}.ts`,
              content: asset(
                `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts${name === "upload-sql" ? "" : ".template"}`,
              ),
              ownership: "generated-scaffold" as const,
              sourcePaths: paths,
            }))
          : [],
      };
    },
  };
}

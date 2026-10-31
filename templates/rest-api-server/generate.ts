import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createValidators, parseContract } from "@jeeves/rest-server";
import { resourceConfigSchema } from "@jeeves/spec";
import type { GenerateContext, GenerateResult } from "@jeeves/template-kit";
import { bearerToken, contractPath, renderScaffold, renderText } from "@jeeves/template-kit";
import { stringify } from "yaml";
import {
  DestructiveModelError,
  fingerprint,
  modelMigration,
  resourceContract,
  resourceFiles,
} from "./resources.ts";

export { bearerToken, contractPath };

const CONTRACT = fileURLToPath(new URL("./scaffold/openapi.yaml", import.meta.url));
const FEATURES = fileURLToPath(new URL("./scaffold/features", import.meta.url));

/**
 * Scaffolds the contract and a ping feature that implements it. The service's own generated
 * wiring (http-service) adds `restServer(...)` with this attachment's config.
 */
export function generate(ctx: GenerateContext): GenerateResult {
  const { element, config, dir } = ctx;
  if (config.model) {
    const model = resourceConfigSchema.parse(config.model);
    const files = resourceFiles(ctx, model);
    const history = ctx.previousMigrations ?? [];
    const changed =
      !ctx.previousModel ||
      fingerprint(ctx.previousModel.resources) !== fingerprint(model.resources);
    if (ctx.previousModel && ctx.previousModel.storeConnection !== model.storeConnection)
      throw new DestructiveModelError([`${element.id}: resource storeConnection changed`]);
    files.push(...history);
    if (changed) {
      let sql: string;
      if (ctx.reviewedMigration) {
        const review = ctx.reviewedMigration;
        if (
          !ctx.previousModel ||
          review.fromFingerprint !== fingerprint(ctx.previousModel.resources) ||
          review.toFingerprint !== fingerprint(model.resources) ||
          !review.sql.trim()
        )
          throw new Error("Reviewed migration fingerprints do not match previous/next resources");
        sql = review.sql;
      } else sql = modelMigration(model, ctx.previousModel);
      const number = String(history.length + 1).padStart(4, "0");
      files.push({
        path: `${dir}/resource-migrations/${number}.sql`,
        contents: `-- Immutable Jeeves resource migration ${number}\n${sql.trim() || "-- Metadata-only change; storage identities retained."}\n`,
        ownership: "generated",
      });
    }
    files.push({
      path: `${dir}/resource-migrations/manifest.json`,
      ownership: "generated",
      contents:
        JSON.stringify(
          files
            .filter((f) => f.path.endsWith(".sql"))
            .map((f) => ({ file: f.path.split("/").at(-1), sha256: fingerprintText(f.contents) })),
          null,
          2,
        ) + "\n",
    });
    const contract = stringify(
      resourceContract(model, element.name, ctx.manifest.version === "0.2.0"),
    );
    createValidators(parseContract(contract));
    files.push({
      path: contractPath(element.id),
      contents: contract,
      ownership: "generated",
    });
    return {
      files,
      resourceModel: model,
      packageDependencies: model.extensions.flatMap((extension) =>
        (extension.dependencies ?? []).map((dependency) => ({
          element: element.id,
          name: dependency.name,
          version: dependency.version,
        })),
      ),
      compose: {
        services: {
          [element.id]: {
            environment: {
              PUBLIC_ORIGIN:
                "${" +
                element.id.toUpperCase().replaceAll("-", "_") +
                "_PUBLIC_ORIGIN:?Set the deployment public origin}",
            },
          },
        },
      },
      runtimeDependencies: [{ element: element.id, name: "@jeeves/rest-server" }],
    };
  }
  const vars = { serviceName: element.name, basePath: String(config.basePath) };
  const files = [
    {
      path: contractPath(element.id),
      contents: renderText(readFileSync(CONTRACT, "utf8"), vars, CONTRACT),
      ownership: "scaffold" as const,
    },
    ...renderScaffold(FEATURES, `${dir}/src/features`, vars),
  ];
  const bearer = config.auth === "bearer";
  return {
    files,
    compose: bearer
      ? {
          services: {
            [element.id]: { environment: { REST_BEARER_TOKEN: bearerToken(element.id) } },
          },
        }
      : {},
    runtimeDependencies: [{ element: element.id, name: "@jeeves/rest-server" }],
  };
}

const fingerprintText = (text: string) => createHash("sha256").update(text).digest("hex");

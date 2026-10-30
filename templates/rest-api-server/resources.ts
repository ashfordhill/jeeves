import { createHash } from "node:crypto";
import {
  type Resource,
  type ResourceConfig,
  resourceInputSchema,
  sessionCredentialsSchema,
  sessionIdentitySchema,
} from "@jeeves/spec";
import type { GenerateContext, OutputFile } from "@jeeves/template-kit";
import { z } from "zod";
import { resourceTests, sessionTests } from "./resource-tests.ts";

const q = JSON.stringify;
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
// Physical names depend only on stable IDs, never on editable API names.
const storage = (prefix: string, id: string) => `${prefix}_${fingerprint(id).slice(0, 24)}`;
export const tableName = (r: Resource) => storage("r", r.id);
const columnName = (id: string) => storage("f", id);
const relationColumn = (id: string) => storage("b", id);
const sqlType = (f: Resource["fields"][number]) =>
  f.type === "text" ? `varchar(${f.maxLength})` : f.type === "timestamp" ? "timestamptz" : "text";
const required = (f: Resource["fields"][number]) => f.type === "timestamp" || f.required;
const fieldSql = (f: Resource["fields"][number]) =>
  `"${columnName(f.id)}" ${sqlType(f)}${required(f) ? " NOT NULL" : ""}${f.type === "timestamp" ? " DEFAULT now()" : ""}`;

export class DestructiveModelError extends Error {
  constructor(readonly affected: string[]) {
    super(`Reviewed migration/backfill required; no files written:\n${affected.join("\n")}`);
  }
}

/** Only additive storage changes are automatic. Renames keep physical identities. */
export function modelMigration(next: ResourceConfig, previous?: ResourceConfig): string {
  const affected: string[] = [];
  const sql: string[] = [];
  for (const old of previous?.resources ?? []) {
    const r = next.resources.find((r) => r.id === old.id);
    if (!r) {
      affected.push(`resource ${old.id}: removal`);
      continue;
    }
    if (r.access !== old.access) affected.push(`resource ${r.id}: ownership change`);
    if (
      JSON.stringify([...r.belongsTo].sort((a, b) => a.id.localeCompare(b.id))) !==
      JSON.stringify([...old.belongsTo].sort((a, b) => a.id.localeCompare(b.id)))
    )
      affected.push(`resource ${r.id}: relationship change`);
    for (const field of old.fields) {
      const f = r.fields.find((f) => f.id === field.id);
      if (!f) affected.push(`${r.id}.${field.id}: removal or changed identity`);
      else if (
        f.type !== field.type ||
        (f.type === "text" && field.type === "text" && f.maxLength < field.maxLength) ||
        (!required(field) && required(f))
      )
        affected.push(`${r.id}.${field.id}: type/requiredness narrowing`);
      else {
        if (f.type === "text" && field.type === "text" && f.maxLength > field.maxLength)
          sql.push(
            `ALTER TABLE "${tableName(r)}" ALTER COLUMN "${columnName(f.id)}" TYPE varchar(${f.maxLength});`,
          );
        if (required(field) && !required(f))
          sql.push(
            `ALTER TABLE "${tableName(r)}" ALTER COLUMN "${columnName(f.id)}" DROP NOT NULL;`,
          );
      }
    }
    for (const f of r.fields.filter((f) => !old.fields.some((o) => o.id === f.id))) {
      if (required(f)) affected.push(`${r.id}.${f.id}: new required field needs a backfill`);
      else sql.push(`ALTER TABLE "${tableName(r)}" ADD COLUMN ${fieldSql(f)};`);
    }
  }
  if (affected.length) throw new DestructiveModelError(affected);
  if (!previous)
    sql.push(
      `CREATE TABLE app_user (id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`,
      `CREATE TABLE app_session (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_user(id), csrf_token text NOT NULL, expires_at timestamptz NOT NULL);`,
      `CREATE INDEX app_session_expiry ON app_session(expires_at);`,
    );
  const added = next.resources.filter((r) => !previous?.resources.some((o) => o.id === r.id));
  for (const r of added) {
    sql.push(
      `CREATE TABLE "${tableName(r)}" (\n  ${["id uuid PRIMARY KEY", ...(r.access === "owner" ? ["owner_id uuid NOT NULL REFERENCES app_user(id)", "created_at timestamptz NOT NULL DEFAULT now()"] : []), ...r.fields.map(fieldSql), ...r.belongsTo.map((b) => `"${relationColumn(b.id)}" uuid NOT NULL`)].join(",\n  ")}\n);`,
    );
    if (r.access === "owner")
      sql.push(
        `CREATE INDEX "${storage("idx", r.id)}" ON "${tableName(r)}" (owner_id, created_at DESC, id DESC);`,
      );
  }
  // All tables exist before constraints, including forward references.
  for (const r of added)
    for (const b of r.belongsTo) {
      const parent = next.resources.find((p) => p.id === b.resource)!;
      sql.push(
        `ALTER TABLE "${tableName(r)}" ADD FOREIGN KEY ("${relationColumn(b.id)}") REFERENCES "${tableName(parent)}"(id);`,
        `CREATE INDEX "${storage("idx", `${r.id}/${b.id}`)}" ON "${tableName(r)}" ("${relationColumn(b.id)}"${r.fields
          .filter((f) => f.type === "timestamp")
          .map((f) => `, "${columnName(f.id)}"`)
          .join("")});`,
      );
    }
  return `${sql.join("\n")}\n`;
}

export function resourceDescriptor(r: Resource, model: ResourceConfig) {
  return {
    ...r,
    table: tableName(r),
    fields: r.fields.map((f) => ({ ...f, column: columnName(f.id) })),
    belongsTo: r.belongsTo.map((b) => ({
      ...b,
      column: relationColumn(b.id),
      name: `${model.resources.find((p) => p.id === b.resource)!.name}Id`,
    })),
    inputSchema: z.toJSONSchema(resourceInputSchema(r, model), { io: "input" }),
  };
}

const error = {
  description: "Request failed",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["error", "message"],
        properties: {
          error: { type: "string" },
          message: { type: "string" },
          details: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
};
export function resourceContract(model: ResourceConfig, title: string) {
  const credentials = z.toJSONSchema(sessionCredentialsSchema, { io: "input" });
  const identity = z.toJSONSchema(sessionIdentitySchema, { io: "input" });
  const identityResponse = {
    description: "Signed-in identity and CSRF token",
    content: { "application/json": { schema: identity } },
  };
  const paths: Record<string, Record<string, unknown>> = {
    "/auth/register": {
      post: {
        operationId: "registerAccount",
        requestBody: { required: true, content: { "application/json": { schema: credentials } } },
        responses: {
          "201": identityResponse,
          "400": error,
          "403": error,
          "409": error,
          "500": error,
        },
      },
    },
    "/auth/login": {
      post: {
        operationId: "login",
        requestBody: { required: true, content: { "application/json": { schema: credentials } } },
        responses: {
          "200": identityResponse,
          "400": error,
          "401": error,
          "403": error,
          "500": error,
        },
      },
    },
    "/auth/session": {
      get: {
        operationId: "readSession",
        security: [{ session: [] }],
        responses: { "200": identityResponse, "401": error, "500": error },
      },
    },
    "/auth/logout": {
      post: {
        operationId: "logout",
        security: [{ session: [] }],
        responses: {
          "204": { description: "Session invalidated" },
          "401": error,
          "403": error,
          "500": error,
        },
      },
    },
  };
  for (const r of model.resources) {
    const input = z.toJSONSchema(resourceInputSchema(r, model), { io: "input" });
    const properties: Record<string, unknown> = {
      id: { type: "string", format: "uuid" },
      createdAt: { type: "string", format: "date-time" },
    };
    for (const f of r.fields)
      properties[f.name] =
        f.type === "timestamp"
          ? { type: "string", format: "date-time" }
          : f.type === "text"
            ? { type: f.required ? "string" : ["string", "null"], maxLength: f.maxLength }
            : { type: f.required ? "string" : ["string", "null"], format: "uri" };
    for (const b of r.belongsTo)
      properties[`${model.resources.find((p) => p.id === b.resource)!.name}Id`] = {
        type: "string",
        format: "uuid",
      };
    const output = {
      type: "object",
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
    };
    for (const op of r.operations) {
      const collection = op === "list" || op === "create";
      const path = `/api/${r.name}${collection ? "" : "/{id}"}`;
      const method = { create: "post", list: "get", read: "get", update: "patch" }[op];
      const body =
        op === "list"
          ? {
              type: "object",
              additionalProperties: false,
              required: ["items", "nextCursor"],
              properties: {
                items: { type: "array", items: output },
                nextCursor: { type: ["string", "null"] },
              },
            }
          : output;
      const status = op === "create" ? "201" : "200";
      paths[path] ??= {};
      paths[path][method] = {
        operationId: `${op}${r.name[0]!.toUpperCase()}${r.name.slice(1)}`,
        security: [{ session: [] }],
        parameters: [
          ...(!collection
            ? [
                {
                  in: "path",
                  name: "id",
                  required: true,
                  schema: { type: "string", format: "uuid" },
                },
              ]
            : []),
          ...(op === "list"
            ? [
                {
                  in: "query",
                  name: "limit",
                  required: false,
                  schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
                },
                {
                  in: "query",
                  name: "cursor",
                  required: false,
                  schema: { type: "string", maxLength: 512 },
                },
              ]
            : []),
        ],
        ...((op === "create" || op === "update") && {
          requestBody: { required: true, content: { "application/json": { schema: input } } },
        }),
        responses: {
          [status]: { description: "Success", content: { "application/json": { schema: body } } },
          "400": error,
          "401": error,
          "403": error,
          "404": error,
          "500": error,
        },
      };
    }
  }
  for (const e of model.extensions) {
    paths[e.path] ??= {};
    paths[e.path]!.get = {
      operationId: e.operationId,
      ...e.contract,
      security: e.access === "owner" ? [{ session: [] }] : [],
      "x-jeeves-acceptance": e.acceptance,
    };
  }
  return {
    openapi: "3.1.0",
    info: { title, version: "1.0.0" },
    paths,
    components: {
      securitySchemes: { session: { type: "apiKey", in: "cookie", name: "jeeves_session" } },
    },
  };
}

export function resourceFiles(ctx: GenerateContext, model: ResourceConfig): OutputFile[] {
  const files: OutputFile[] = model.resources.map((r) => ({
    path: `${ctx.dir}/src/generated/resources/${r.id}.ts`,
    ownership: "generated",
    contents: `// Generated by Jeeves. Do not edit.\nexport default ${q(resourceDescriptor(r, model))} as const;\n`,
  }));
  files.push({
    path: `${ctx.dir}/src/generated/routes.ts`,
    ownership: "generated",
    contents: [
      "// Generated by Jeeves. Do not edit.",
      'import { resourceServer } from "@jeeves/rest-server";',
      ...model.resources.map((r, i) => `import resource${i} from "./resources/${r.id}.ts";`),
      'import type { ResourceDatabase } from "@jeeves/rest-server";',
      `export const generatedApi = (database: () => ResourceDatabase, contract: string) => resourceServer({database,contract,resources:[${model.resources.map((_, i) => `resource${i}`).join(",")}],extensions:${q(model.extensions.map((e) => ({ operationId: e.operationId, access: e.access })))}});`,
      "",
    ].join("\n"),
  });
  for (const e of model.extensions)
    files.push({
      path: `${ctx.dir}/src/features/${e.id}/index.ts`,
      ownership: "scaffold",
      contents: `import { defineFeature } from "@jeeves/service-runtime";\n\n// Acceptance: ${e.acceptance.join(", ")}\n// ${e.notes.replaceAll("\n", "\n// ")}\n// Implement operationId ${e.operationId} here; the runtime reports 501 until it is registered.\nexport default defineFeature({name:${q(e.id)}, operations:{}});\n`,
    });
  files.push(
    ...model.resources
      .filter((r) => r.access === "owner" && r.operations.length > 0)
      .map((r) => resourceTests(ctx.element.id, r, model)),
  );
  files.push(sessionTests(ctx.element.id));
  return files;
}

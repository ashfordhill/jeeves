import { randomUUID } from "node:crypto";
import type {
  OperationHandler,
  OperationRequest,
  RegisteredOperation,
  ServicePlugin,
} from "@jeeves/service-runtime";
import type { FastifyRequest } from "fastify";
import { restServer } from "./plugin.ts";
import { type Principal, sessions } from "./sessions.ts";

/** Serialized generation output. Runtime has no dependency on Jeeves or template generators. */
export interface ResourceDefinition {
  readonly id: string;
  readonly name: string;
  readonly table: string;
  readonly access: "owner" | "internal";
  readonly fields: readonly {
    readonly id: string;
    readonly name: string;
    readonly column: string;
    readonly type: "text" | "http-url" | "timestamp";
    readonly required?: boolean;
    readonly maxLength?: number;
  }[];
  readonly belongsTo: readonly {
    readonly id: string;
    readonly resource: string;
    readonly column: string;
    readonly name: string;
  }[];
  readonly operations: readonly ("create" | "read" | "list" | "update")[];
}
export interface ResourceDatabase {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
export interface ResourceServerOptions {
  database: () => ResourceDatabase;
  contract: string;
  resources: readonly ResourceDefinition[];
  extensions: readonly { operationId: string; access: "public" | "owner" }[];
}
const authenticated = new WeakMap<FastifyRequest, Principal>();
/** Project-owned owner extensions use this server-established principal, never request IDs. */
export function sessionPrincipal(request: FastifyRequest): Principal | undefined {
  return authenticated.get(request);
}
let validatedPublicOrigin: string | undefined;
/**
 * The deployment public origin the resource server validated at startup. Extensions must use this
 * value, not `process.env.PUBLIC_ORIGIN`, so a QR payload can't be built from a bad value.
 */
export function publicOrigin(): string {
  if (!validatedPublicOrigin)
    throw new Error("The resource server hasn't validated PUBLIC_ORIGIN yet");
  return validatedPublicOrigin;
}
const quote = (name: string) => {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) throw new Error(`Unsafe generated identifier ${name}`);
  return `"${name}"`;
};
const fail = (status: number, error: string, message: string) => ({
  status,
  body: { error, message },
});

/** Owner filtering and parent checks are in the mutation query itself. */
export function resourceHandlers(
  resources: readonly ResourceDefinition[],
  database: () => ResourceDatabase,
  principal: (r: FastifyRequest) => Principal | undefined,
): Map<string, RegisteredOperation> {
  const handlers = new Map<string, RegisteredOperation>();
  for (const r of resources) {
    if (r.access === "internal") continue;
    const columns = [
      { name: "id", column: "id" },
      { name: "createdAt", column: "created_at" },
      ...r.fields,
      ...r.belongsTo,
    ];
    const projection = columns.map((f) => `${quote(f.column)} AS ${quote(f.name)}`).join(", ");
    const writable = [...r.fields.filter((f) => f.type !== "timestamp"), ...r.belongsTo];
    const serialize = (row: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
      );
    for (const op of r.operations) {
      const operationId = `${op}${r.name[0]!.toUpperCase()}${r.name.slice(1)}`;
      const handler: OperationHandler = async (request: OperationRequest) => {
        const user = principal(request.request);
        if (!user) return fail(401, "UNAUTHORIZED", "Sign in required");
        const values: unknown[] = [user.id];
        const param = (value: unknown) => {
          values.push(value);
          return `$${values.length}`;
        };
        const input = (request.body ?? {}) as Record<string, unknown>;
        for (const f of r.fields)
          if (f.type === "http-url" && input[f.name] != null) {
            try {
              const url = new URL(String(input[f.name]));
              if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
                throw new Error();
            } catch {
              return fail(
                400,
                "REQUEST_INVALID",
                `${f.name} must be an HTTP/HTTPS URL without credentials`,
              );
            }
          }
        const ownerPredicate = (
          target: ResourceDefinition,
          alias: string,
          path = new Set<string>(),
        ): string => {
          if (path.has(target.id)) throw new Error("Cyclic generated relationship");
          if (target.access === "owner") return `${alias}.owner_id = $1`;
          const next = new Set(path).add(target.id);
          return (
            target.belongsTo
              .map((b, i) => {
                const parent = resources.find((p) => p.id === b.resource)!;
                const peer = `${alias}_${i}`;
                return `EXISTS (SELECT 1 FROM ${quote(parent.table)} ${peer} WHERE ${peer}.id = ${alias}.${quote(b.column)} AND ${ownerPredicate(parent, peer, next)})`;
              })
              .join(" AND ") || "TRUE"
          );
        };
        if (op === "read") {
          const result = await database().query(
            `SELECT ${projection} FROM ${quote(r.table)} WHERE owner_id = $1 AND id = ${param(request.params.id)}`,
            values,
          );
          return result.rows[0]
            ? { status: 200, body: serialize(result.rows[0]) }
            : fail(404, "NOT_FOUND", "Resource not found");
        }
        if (op === "list") {
          let cursor = "";
          if (request.query.cursor !== undefined) {
            try {
              const raw = JSON.parse(
                Buffer.from(String(request.query.cursor), "base64url").toString(),
              );
              if (
                !Array.isArray(raw) ||
                raw.length !== 2 ||
                typeof raw[0] !== "string" ||
                !Number.isFinite(Date.parse(raw[0])) ||
                !/^[0-9a-f-]{36}$/i.test(raw[1])
              )
                throw new Error();
              cursor = ` AND (created_at, id) < (${param(raw[0])}::timestamptz, ${param(raw[1])}::uuid)`;
            } catch {
              return fail(400, "REQUEST_INVALID", "Invalid pagination cursor");
            }
          }
          const limit = Number(request.query.limit ?? 25);
          if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            return fail(400, "REQUEST_INVALID", "Limit must be 1–100");
          // Preserve PostgreSQL microseconds in cursors; JS Date alone loses pagination precision.
          const result = await database().query(
            `SELECT ${projection}, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "_cursorTime" FROM ${quote(r.table)} WHERE owner_id = $1${cursor} ORDER BY created_at DESC, id DESC LIMIT ${param(limit + 1)}`,
            values,
          );
          const rows = result.rows.slice(0, limit);
          const last = rows.at(-1);
          const nextCursor =
            result.rows.length > limit && last
              ? Buffer.from(JSON.stringify([last._cursorTime, last.id])).toString("base64url")
              : null;
          return {
            status: 200,
            body: {
              items: rows.map((row) => {
                const { _cursorTime: _, ...item } = row;
                return serialize(item);
              }),
              nextCursor,
            },
          };
        }
        const assigned =
          op === "create" ? writable : writable.filter((f) => Object.hasOwn(input, f.name));
        const fieldParams = assigned.map((f) => param(input[f.name] ?? null));
        const parents = r.belongsTo.flatMap((b) => {
          const index = assigned.findIndex((f) => f.column === b.column);
          if (index < 0) return [];
          const parent = resources.find((p) => p.id === b.resource)!;
          const p = fieldParams[index];
          return [
            `EXISTS (SELECT 1 FROM ${quote(parent.table)} parent WHERE parent.id = ${p} AND ${ownerPredicate(parent, "parent")})`,
          ];
        });
        const condition = parents.length ? ` AND ${parents.join(" AND ")}` : "";
        const sql =
          op === "create"
            ? `INSERT INTO ${quote(r.table)} (id,owner_id${writable.length ? `,${writable.map((f) => quote(f.column)).join(",")}` : ""}) SELECT ${param(randomUUID())},$1${fieldParams.length ? `,${fieldParams.join(",")}` : ""} WHERE TRUE${condition} RETURNING ${projection}`
            : `UPDATE ${quote(r.table)} SET ${assigned.length ? assigned.map((f, i) => `${quote(f.column)} = ${fieldParams[i]}`).join(",") : "id = id"} WHERE owner_id = $1 AND id = ${param(request.params.id)}${condition} RETURNING ${projection}`;
        const result = await database().query(sql, values);
        return result.rows[0]
          ? { status: op === "create" ? 201 : 200, body: serialize(result.rows[0]) }
          : fail(404, "NOT_FOUND", "Resource or related resource not found");
      };
      handlers.set(operationId, { feature: `generated:${r.id}`, handler });
    }
  }
  return handlers;
}

export function resourceServer(options: ResourceServerOptions): ServicePlugin {
  let origin = "";
  return {
    name: "resources",
    servesOperations: true,
    configure(env) {
      try {
        const url = new URL(env.PUBLIC_ORIGIN ?? "");
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        )
          throw new Error();
        origin = url.origin;
        validatedPublicOrigin = origin;
        return [];
      } catch {
        return [
          "PUBLIC_ORIGIN must be an absolute HTTP/HTTPS origin without a path or credentials",
        ];
      }
    },
    async register(app, ctx) {
      const auth = sessions(options.database, origin);

      const principals = authenticated;
      const generated = resourceHandlers(options.resources, options.database, (r) =>
        principals.get(r),
      );
      for (const [id, handler] of auth.handlers((r) => principals.get(r)))
        generated.set(id, handler);
      const selectedExtensions = new Set(options.extensions.map((e) => e.operationId));
      const operations = new Map([...ctx.operations].filter(([id]) => selectedExtensions.has(id)));
      for (const [id] of ctx.operations) {
        if (generated.has(id))
          throw new Error(`Project feature overrides generated operation ${id}`);
        if (!selectedExtensions.has(id))
          ctx.log.warn(
            `Inactive project operation ${id}: its extension is no longer selected; implementation retained`,
          );
      }
      for (const [id, handler] of generated) {
        if (operations.has(id))
          throw new Error(`Project feature overrides generated operation ${id}`);
        operations.set(id, handler);
      }
      const publicIds = new Set(
        options.extensions.filter((e) => e.access === "public").map((e) => e.operationId),
      );
      const plugin = restServer({
        contract: options.contract,
        basePath: "",
        beforeOperation: async (request, reply, operationId) => {
          if (publicIds.has(operationId)) return true;
          if (["registerAccount", "login"].includes(operationId)) {
            if (auth.sameOrigin(request)) return true;
            reply.code(403).send({ error: "CSRF", message: "A matching Origin is required" });
            return false;
          }
          const user = await auth.principal(request);
          if (!user) {
            reply.code(401).send({ error: "UNAUTHORIZED", message: "Sign in required" });
            return false;
          }
          if (
            !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
            !auth.mutationAllowed(request, user)
          ) {
            reply
              .code(403)
              .send({ error: "CSRF", message: "CSRF token and matching Origin required" });
            return false;
          }
          principals.set(request, user);
          reply.header("cache-control", "no-store");
          return true;
        },
      });
      await plugin.register(app, { ...ctx, operations });
    },
  };
}

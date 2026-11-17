import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { idempotencyMigration, localOperationMigration } from "./client-wiring.ts";
import { operationImports, operationUrl } from "./operation.test.helpers.ts";
import { dataUrl, productContractUrl } from "./product-sql.test.helpers.ts";

const urls = new Map<string, string>();
function load(name: string): string {
  const known = urls.get(name);
  if (known) return known;
  if (name === "operation") return operationUrl;
  if (name === "product-contract") return productContractUrl;
  const extension = name === "product-operations" ? "ts" : "ts.template";
  const source = operationImports(
    stripTypeScriptTypes(
      readFileSync(
        new URL(
          `../../templates/local-v2/assets/src/runtime/${name}.${extension}`,
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  ).replace(/from "\.\/([a-z-]+)\.ts"/g, (_match, child: string) => `from "${load(child)}"`);
  const url = dataUrl(source);
  urls.set(name, url);
  return url;
}
const runtime = await import(load("local-operation"));
const { operation, withOperation, withEffect, assertNetworkAllowed } = await import(operationUrl);
const { registeredProductOperations } = await import(load("product-operations"));
const { transaction } = await import(load("transaction"));
const { sweepExpired } = await import(load("idempotency"));
const { createSealingKeys } = await import(load("keys"));
const { keyRing } = await import(load("settings"));
const ring = (ids = ["old"]) =>
  createSealingKeys(
    keyRing().parse(
      Buffer.from(
        JSON.stringify(
          ids.map((id) => ({
            id,
            key: Buffer.alloc(32, id === "old" ? 4 : 5).toString("base64url"),
          })),
        ),
      ),
    ),
    "jeeves.replay.v1",
  );
const databases: PGlite[] = [];
async function fixture() {
  const pg = new PGlite();
  databases.push(pg);
  await pg.exec(`CREATE ROLE runtime; CREATE ROLE product; GRANT product TO runtime WITH INHERIT FALSE, SET TRUE;
    ${idempotencyMigration.sql} ${localOperationMigration.sql} ${localOperationMigration.sql}
    CREATE SCHEMA p_app; CREATE TABLE p_app.items(id text PRIMARY KEY, account text NOT NULL);
    GRANT USAGE ON SCHEMA jeeves TO runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON jeeves.idempotency_records TO runtime;
    GRANT USAGE ON SCHEMA p_app TO product; GRANT SELECT,INSERT,UPDATE,DELETE ON p_app.items TO product;`);
  let previous = Promise.resolve();
  let loseCommit = false;
  let denyLock = false;
  const trace: { sql: string; role: string }[] = [];
  const releases: boolean[] = [];
  const pool = {
    async connect() {
      let free!: () => void;
      const pending = previous;
      previous = new Promise<void>((resolve) => {
        free = resolve;
      });
      await pending;
      await pg.exec("SET SESSION AUTHORIZATION runtime");
      return {
        async query(sql: string, values?: unknown[]) {
          if (denyLock && sql.includes("pg_try_advisory_xact_lock"))
            return { rows: [{ locked: false }], rowCount: 1 };
          const role =
            sql === "ROLLBACK"
              ? "aborted"
              : ((await pg.query<{ role: string }>("SELECT current_user AS role")).rows[0]
                  ?.role as string);
          trace.push({ sql, role });
          const result = await pg.query(sql, values);
          if (sql === "COMMIT" && loseCommit) {
            loseCommit = false;
            throw Object.assign(new Error("lost response"), { code: "EPIPE" });
          }
          return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
        },
        release(discard: boolean) {
          releases.push(discard);
          void pg.exec("SET SESSION AUTHORIZATION postgres").then(free);
        },
      };
    },
  };
  const maximum = {
    resource: "db",
    modules: [{ module: "create", host: "api", schema: "p_app" }],
    productState: {
      schema: "p_app",
      access: [
        {
          host: "api",
          product: {
            tables: [
              {
                name: "items",
                operations: ["SELECT", "INSERT", "UPDATE", "DELETE"],
              },
            ],
            views: [],
          },
        },
      ],
    },
    productSql: {
      version: 1,
      file: "products.json",
      namespaces: [{ schema: "p_app", role: "migration" }],
      bindings: [{ host: "api", module: "create", access: "read-write" }],
    },
  };
  const declaration = {
    version: 1,
    namespaces: [
      {
        schema: "p_app",
        migrations: [
          {
            version: "0001",
            file: "infra/postgres/db/products/migrations/p_app/0001-initial.sql",
          },
        ],
      },
    ],
    tables: [{ schema: "p_app", name: "items" }],
    views: [],
    operations: [
      {
        name: "insert",
        host: "api",
        module: "create",
        kind: "command",
        parameters: 2,
        file: "infra/postgres/db/products/commands/insert.sql",
        relations: [{ schema: "p_app", name: "items", operations: ["insert"] }],
      },
      {
        name: "read",
        host: "api",
        module: "create",
        kind: "query",
        parameters: 0,
        file: "infra/postgres/db/products/queries/read.sql",
        relations: [{ schema: "p_app", name: "items", operations: ["select"] }],
      },
    ],
  };
  const files: Record<string, string> = {
    "products.json": JSON.stringify(declaration),
    "infra/postgres/db/products/commands/insert.sql":
      "INSERT INTO p_app.items(id,account) VALUES($1,$2) RETURNING id, account",
    "infra/postgres/db/products/queries/read.sql": "SELECT id,account FROM p_app.items",
  };
  const commands = (execute: unknown) =>
    registeredProductOperations(
      maximum,
      { tile: "api", module: "create" },
      execute,
      (path: string) => files[path],
    );
  const dependencies = {
    db: commands((sql: string, values: unknown[], readOnly: boolean) =>
      transaction(
        pool,
        (tx: { query: (sql: string, values: unknown[]) => unknown }) => tx.query(sql, values),
        { readOnly },
      ),
    ),
  };
  const define = (overrides: Record<string, unknown> = {}, keys = ring()) => {
    const local = runtime.defineLocalOperation({
      database: "db",
      id: "create-item",
      version: 1,
      retentionSeconds: 60,
      secret: true,
      validate(input: unknown) {
        if (
          !input ||
          typeof input !== "object" ||
          Object.keys(input).join() !== "id" ||
          typeof (input as { id: unknown }).id !== "string"
        )
          throw Error("bad");
        return input;
      },
      admit: async () => {},
      mutate: async (
        input: { id: string },
        sql: { call: (name: string, args: unknown[]) => Promise<unknown> },
        caller: { subject: string },
      ) => {
        await sql.call("insert", [input.id, caller.subject]);
        return { status: 201, body: { id: input.id, secret: "replay-secret" } };
      },
      ...overrides,
    });
    runtime.bindLocalOperation(
      dependencies.db,
      runtime.localOperationDefinition(local, "db", true),
      {
        tile: "api",
        module: "create",
        pool,
        productRole: "product",
        keys,
        commands,
      },
    );
    return local;
  };
  const run = async (
    local: ReturnType<typeof define>,
    key = "key",
    input: unknown = { id: "one" },
    subject: string | undefined = "alice",
    http = false,
  ) => {
    const context = operation({
      maximumMs: 10000,
      caller: subject ? { subject } : undefined,
    });
    try {
      return await withOperation(context.context, () =>
        http
          ? local.route(dependencies, {
              method: "POST",
              rawPath: "/",
              headers: { "idempotency-key": key },
              body: input,
            })
          : local.call(dependencies, { key, input }),
      );
    } finally {
      context.close();
    }
  };
  return {
    pg,
    pool,
    trace,
    releases,
    dependencies,
    define,
    run,
    lose: () => {
      loseCommit = true;
    },
    deny: () => {
      denyLock = true;
    },
    files,
    commands,
  };
}

export {
  assertNetworkAllowed,
  databases,
  fixture,
  load,
  operation,
  ring,
  runtime,
  sweepExpired,
  transaction,
  withEffect,
  withOperation,
};

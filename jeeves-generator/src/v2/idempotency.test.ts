import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { generationPolicies } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { idempotencyMigration } from "./client-wiring.ts";

// The exact idempotency.ts a stub's database client runs (QL04); its imports are type-only but
// node:crypto, so it loads on its own. SQL runs in real offline PGlite, beside transaction.ts.
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const runtime = (name: string) =>
  dataUrl(
    stripTypeScriptTypes(
      readFileSync(
        new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
        "utf8",
      ),
    ),
  );
const idempotency = await import(runtime("idempotency"));
const { transaction } = await import(runtime("transaction"));

type Key = { tile: string; scope: { kind: string; id: string }; key: string; hash: string };
const hash = (body: unknown, route = "POST /links", method = "POST") =>
  idempotency.requestHash({ method, route, body }) as string;

describe("requestHash (QL04)", () => {
  it("is SHA-256 over the canonical request, keys sorted at every depth", () => {
    expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 }));
    expect(hash({ x: { b: [2, { d: 1, c: 2 }], a: null } })).toBe(
      hash({ x: { a: null, b: [2, { c: 2, d: 1 }] } }),
    );
    expect(
      idempotency.requestHash({ method: "post", route: "/links/:id", params: { b: "2", a: "1" } }),
    ).toBe(
      idempotency.requestHash({ method: "POST", route: "/links/:id", params: { a: "1", b: "2" } }),
    );
    // Exactly the brief's text: method upper-cased, then route, params and body.
    expect(hash({ b: 2, a: 1 })).toBe(
      createHash("sha256")
        .update('{"method":"POST","route":"POST /links","params":{},"body":{"a":1,"b":2}}', "utf8")
        .digest("hex"),
    );
    expect(hash(undefined)).toBe(hash(null));
    expect(hash({ a: 1, gone: undefined })).toBe(hash({ a: 1 }));
    expect(hash({ a: 1, b: 2 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for a different body, array order, route or method", () => {
    const base = hash({ a: 1, b: 2 });
    for (const other of [
      hash({ a: 1, b: 3 }),
      hash({ a: 1 }),
      hash({ a: 1, b: 2 }, "POST /payments"),
      hash({ a: 1, b: 2 }, "POST /links", "PUT"),
    ])
      expect(other).not.toBe(base);
    expect(hash({ list: [1, 2] })).not.toBe(hash({ list: [2, 1] }));
  });

  it("runs the catalog's idempotency policy", () => {
    expect(idempotency.idempotencyPolicy).toEqual(generationPolicies.idempotency.definition);
  });

  it("refuses a scope, key or hash the table doesn't take, naming no value", () => {
    const ok = { scope: { kind: "account", id: "acct-1" }, key: "k-1", hash: hash({}) };
    expect(() => idempotency.checkIdempotencyKey(ok)).not.toThrow();
    expect(() =>
      idempotency.checkIdempotencyKey({
        ...ok,
        scope: { kind: `a${"b".repeat(31)}`, id: "é".repeat(255) },
        key: "~".repeat(255),
      }),
    ).not.toThrow();
    for (const bad of [
      { ...ok, scope: { kind: "Account", id: "1" } },
      { ...ok, scope: { kind: "1account", id: "1" } },
      { ...ok, scope: { kind: `a${"b".repeat(32)}`, id: "1" } },
      { ...ok, scope: { kind: "account", id: "" } },
      { ...ok, scope: { kind: "account", id: "x".repeat(256) } },
      { ...ok, scope: { kind: "account", id: "a\u0000b" } },
      { ...ok, key: "" },
      { ...ok, key: "x".repeat(256) },
      { ...ok, key: "has space" },
      { ...ok, key: "café" },
      { ...ok, scope: undefined },
    ])
      expect(() => idempotency.checkIdempotencyKey(bad)).toThrow(/^Invalid idempotency key$/);
    for (const wrong of ["", "ABC", hash({}).toUpperCase(), `${hash({})}0`])
      expect(() => idempotency.checkIdempotencyKey({ ...ok, hash: wrong })).toThrow(
        /^Invalid request hash$/,
      );
  });
});

describe("the idempotency records on PostgreSQL (PGlite, QL04)", () => {
  /** A database with the export's migration, applied by its owner, and the writer's grants as
   * migrate.mjs gives them; a pool whose connections are the writer's, one at a time. */
  async function database() {
    const pg = new PGlite();
    await pg.exec(`CREATE ROLE o_links; CREATE ROLE r_links__api; CREATE ROLE r_links__reader;
      GRANT CREATE ON DATABASE postgres TO o_links;
      SET ROLE o_links;
      ${idempotencyMigration.sql}
      ${idempotencyMigration.sql}
      GRANT USAGE ON SCHEMA jeeves TO r_links__api;
      GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE jeeves.idempotency_records TO r_links__api;
      RESET ROLE;`);
    let previous = Promise.resolve();
    const pool = {
      async connect() {
        let free!: () => void;
        const pending = previous;
        previous = new Promise<void>((resolve) => {
          free = resolve;
        });
        await pending;
        await pg.exec("SET ROLE r_links__api");
        return {
          async query(sql: string, values?: unknown[]) {
            const result = await pg.query(sql, values);
            return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
          },
          release() {
            void pg.exec("RESET ROLE").then(free);
          },
        };
      },
    };
    return { pg, pool };
  }
  /** One call as `idempotent` makes it: take the key, run, store a 2xx answer, in one transaction. */
  const call = (
    pool: unknown,
    record: Key,
    answer: { status: number; body: unknown },
    writes: string[] = [],
  ) =>
    transaction(
      pool,
      async (scope: {
        query(sql: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }>;
      }) => {
        const tx = {
          query: async (sql: string, values?: unknown[]) => (await scope.query(sql, values)).rows,
          execute: async (sql: string, values?: unknown[]) => ({
            rowCount: (await scope.query(sql, values)).rowCount,
          }),
        };
        const taken = await idempotency.takeKey(tx, record);
        if (!taken.taken) return { status: taken.status, body: taken.body, replayed: true };
        writes.push(record.key);
        if (!idempotency.storedStatus(answer.status)) throw new Error("rolled back");
        await idempotency.storeResult(tx, record, answer);
        return { ...answer, replayed: false };
      },
    );
  const record = (key: string, body: unknown = { url: "https://example.com" }): Key => ({
    tile: "link-api",
    scope: { kind: "account", id: "acct-1" },
    key,
    hash: hash(body),
  });

  it("stores a 2xx answer once, replays it, refuses another request and lets only the writer in", async () => {
    const { pg, pool } = await database();
    const created = { status: 201, body: { id: "l1", tags: ["a"] } };
    const writes: string[] = [];
    expect(await call(pool, record("k1"), created, writes)).toEqual({
      ...created,
      replayed: false,
    });
    expect(await call(pool, record("k1"), { status: 201, body: "unused" }, writes)).toEqual({
      status: 201,
      body: { id: "l1", tags: ["a"] },
      replayed: true,
    });
    expect(writes).toEqual(["k1"]);
    await expect(call(pool, record("k1", { url: "other" }), created)).rejects.toMatchObject({
      name: "IdempotencyConflict",
    });
    // Another tile's or scope's key is its own record.
    expect(await call(pool, { ...record("k1"), tile: "billing-api" }, created)).toMatchObject({
      replayed: false,
    });
    const rows = await pg.query(
      "SELECT tile, scope_kind, scope_id, idem_key, status, response, extract(epoch FROM expires_at - created_at)::int AS ttl FROM jeeves.idempotency_records ORDER BY tile",
    );
    expect(rows.rows).toEqual([
      {
        tile: "billing-api",
        scope_kind: "account",
        scope_id: "acct-1",
        idem_key: "k1",
        status: 201,
        response: created.body,
        ttl: 86400,
      },
      {
        tile: "link-api",
        scope_kind: "account",
        scope_id: "acct-1",
        idem_key: "k1",
        status: 201,
        response: created.body,
        ttl: 86400,
      },
    ]);
    // A 403 rolls back: no record, so the same key runs again.
    await expect(call(pool, record("k2"), { status: 403, body: {} })).rejects.toThrow(
      "rolled back",
    );
    expect(
      (await pg.query("SELECT 1 FROM jeeves.idempotency_records WHERE idem_key = 'k2'")).rows,
    ).toEqual([]);
    // Only a writing tile's login uses the table.
    await pg.exec("SET ROLE r_links__reader");
    await expect(pg.query("SELECT * FROM jeeves.idempotency_records")).rejects.toThrow(
      "permission denied for schema jeeves",
    );
    await pg.exec("RESET ROLE");
    await pg.close();
  });

  it("runs a key again once its record expired, and sweeps expired records under the lock", async () => {
    const { pg, pool } = await database();
    await call(pool, record("k1"), { status: 200, body: 1 });
    await pg.exec("UPDATE jeeves.idempotency_records SET expires_at = now() - interval '1 second'");
    const writes: string[] = [];
    expect(await call(pool, record("k1", "other"), { status: 200, body: 2 }, writes)).toEqual({
      status: 200,
      body: 2,
      replayed: false,
    });
    expect(writes).toEqual(["k1"]);
    for (const key of ["k2", "k3", "k4"]) await call(pool, record(key), { status: 200, body: 0 });
    await pg.exec(
      "UPDATE jeeves.idempotency_records SET expires_at = now() - interval '1 second' WHERE idem_key <> 'k4'",
    );
    expect(await idempotency.sweepExpired(pool)).toBe(3);
    expect((await pg.query("SELECT idem_key FROM jeeves.idempotency_records")).rows).toEqual([
      { idem_key: "k4" },
    ]);
    expect(await idempotency.sweepExpired(pool)).toBe(0);
    // The lock was released: the next sweep (another session) takes it.
    expect(
      (await pg.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory'")).rows,
    ).toEqual([{ n: 0 }]);
    await pg.close();
  });
});

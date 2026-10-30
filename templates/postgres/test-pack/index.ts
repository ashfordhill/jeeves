import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TestPack, TestPackContext } from "@jeeves/template-kit";
import pg from "pg";
import { type Consumer, consumersOf, SUPERUSER } from "../generate.ts";

/**
 * Checks for one postgres element in a running project (PLAN §8 test pack). Consumers are expected
 * to have applied their migrations at startup. The last check restarts the database.
 */
export const testPack: TestPack = {
  template: "postgres",
  checks: [
    {
      id: "healthy",
      title: "the container is healthy and runs the configured major version",
      async run(ctx) {
        const db = ctx.service(ctx.subject.element.id);
        const ready = await db.exec(["pg_isready", "-U", SUPERUSER.user, "-d", "postgres"]);
        if (ready.exitCode !== 0) throw new Error(`pg_isready failed: ${ready.output.trim()}`);
        const rows = await superuserQuery(ctx, "show server_version_num");
        const major = Math.floor(Number(rows[0]?.server_version_num) / 10_000);
        if (String(major) !== String(ctx.subject.config.version)) {
          throw new Error(`Expected PostgreSQL ${ctx.subject.config.version}, got ${major}`);
        }
      },
    },
    {
      id: "consumer-own-database",
      title: "each consumer connects to its own database with its own role and can create tables",
      async run(ctx) {
        for (const consumer of consumersOf(ctx.subject)) {
          await withClient(await consumerUrl(ctx, consumer), async (client) => {
            const who = await client.query("select current_database() as db, current_user as role");
            const row = who.rows[0];
            if (row?.db !== consumer.id || row?.role !== consumer.id) {
              throw new Error(`${consumer.id} connected as ${row?.role} to ${row?.db}`);
            }
            await client.query("create table jeeves_test_pack_probe (id int)");
            await client.query("drop table jeeves_test_pack_probe");
          });
        }
      },
    },
    {
      id: "consumer-isolation",
      title: "a consumer can't connect to other databases or act as a superuser",
      async run(ctx) {
        const consumers = consumersOf(ctx.subject);
        for (const consumer of consumers) {
          const url = new URL(await consumerUrl(ctx, consumer));
          const others = ["postgres", ...consumers.filter((c) => c !== consumer).map((c) => c.id)];
          for (const other of others) {
            url.pathname = `/${other}`;
            const error = await connectError(url.toString());
            if (!error) throw new Error(`${consumer.id} could connect to database "${other}"`);
            if (error.code !== "42501") {
              throw new Error(`${consumer.id} → "${other}" failed oddly: ${error.message}`);
            }
          }
          await withClient(await consumerUrl(ctx, consumer), async (client) => {
            const role = await client.query(
              "select rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user",
            );
            const r = role.rows[0];
            if (!r || r.rolsuper || r.rolcreatedb || r.rolcreaterole) {
              throw new Error(`${consumer.id}'s role has elevated privileges`);
            }
          });
        }
      },
    },
    {
      id: "migrations-applied",
      title: "each consumer's database has exactly the migrations in its journal",
      run: (ctx) => checkMigrations(ctx),
    },
    {
      id: "survives-restart",
      title: "data and migrations survive a database restart",
      async run(ctx) {
        const token = `probe-${Date.now()}`;
        await superuserQuery(
          ctx,
          "create table if not exists jeeves_test_pack_probe (token text primary key)",
        );
        await superuserQuery(ctx, "insert into jeeves_test_pack_probe values ($1)", [token]);
        await ctx.service(ctx.subject.element.id).restart();
        const rows = await superuserQuery(
          ctx,
          "select token from jeeves_test_pack_probe where token = $1",
          [token],
        );
        if (rows.length !== 1) throw new Error("A row written before the restart is gone");
        await superuserQuery(ctx, "drop table jeeves_test_pack_probe");
        await checkMigrations(ctx);
      },
    },
  ],
};

async function checkMigrations(ctx: TestPackContext): Promise<void> {
  for (const consumer of consumersOf(ctx.subject)) {
    const journal = JSON.parse(
      readFileSync(join(ctx.projectDir, consumer.dir, "migrations/meta/_journal.json"), "utf8"),
    ) as { entries: unknown[] };
    const recorded = await withClient(await consumerUrl(ctx, consumer), async (client) => {
      const exists = await client.query("select to_regclass('drizzle.__drizzle_migrations') as t");
      if (!exists.rows[0]?.t) return 0;
      const count = await client.query(
        "select count(*)::int as n from drizzle.__drizzle_migrations",
      );
      return count.rows[0].n as number;
    });
    if (recorded !== journal.entries.length) {
      throw new Error(
        `${consumer.id}: ${journal.entries.length} migration(s) in the journal, ${recorded} applied`,
      );
    }
  }
}

/** The consumer's resolved credentials, pointed at the published port. */
async function consumerUrl(ctx: TestPackContext, consumer: Consumer): Promise<string> {
  const env = ctx.compose.services[consumer.id]?.environment ?? {};
  const raw =
    env.DATABASE_URL ??
    (env.DATABASE_HOST && env.DATABASE_USER && env.DATABASE_PASSWORD && env.DATABASE_NAME
      ? `postgres://${encodeURIComponent(env.DATABASE_USER)}:${encodeURIComponent(env.DATABASE_PASSWORD)}@${env.DATABASE_HOST}/${encodeURIComponent(env.DATABASE_NAME)}`
      : undefined);
  if (!raw)
    throw new Error(`docker-compose.yml gives ${consumer.id} no resolved database credentials`);
  const url = new URL(raw);
  if (url.hostname !== ctx.subject.element.id) {
    throw new Error(`${consumer.id}'s DATABASE_URL points at ${url.hostname}`);
  }
  const { host, port } = await ctx.service(ctx.subject.element.id).endpoint(5432);
  url.hostname = host;
  url.port = String(port);
  return url.toString();
}

async function superuserQuery(
  ctx: TestPackContext,
  sql: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const { host, port } = await ctx.service(ctx.subject.element.id).endpoint(5432);
  const url = `postgres://${SUPERUSER.user}:${SUPERUSER.password}@${host}:${port}/postgres`;
  return withClient(url, async (client) => (await client.query(sql, params)).rows);
}

async function withClient<T>(url: string, use: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    return await use(client);
  } finally {
    await client.end();
  }
}

async function connectError(url: string): Promise<(Error & { code?: string }) | undefined> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.end();
    return undefined;
  } catch (error) {
    return error as Error & { code?: string };
  }
}

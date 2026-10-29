import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema.ts";

/** Any Drizzle Postgres database with our schema: node-postgres in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type DbHandle = {
  db: Db;
  /** Resolves when Postgres answers a trivial query; rejects otherwise. */
  ping: () => Promise<void>;
  /** Applies pending migrations from `apps/server/drizzle/`. */
  migrate: () => Promise<void>;
  close: () => Promise<void>;
};

export const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export function connectDb(databaseUrl: string): DbHandle {
  const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
  // An idle client losing its connection must not crash the server; /health reports it instead.
  pool.on("error", () => {});
  const db = drizzle(pool, { schema });
  return {
    db,
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => pool.end(),
  };
}

/**
 * Creates the URL's database when it doesn't exist yet (through the server's `postgres`
 * database), so e2e tests can use their own database next to the dev one.
 */
export async function ensureDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name) return;
  url.pathname = "/postgres";
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    const found = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (found.rowCount === 0) await client.query(`create database "${name.replaceAll('"', '""')}"`);
  } finally {
    await client.end().catch(() => {});
  }
}

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool, PoolClient } from "pg";

/** Arbitrary but fixed: every replica of a service takes the same lock before migrating. */
const MIGRATION_LOCK_KEY = 7_340_215_001;

export interface MigrationResult {
  /** Migrations applied by this call. */
  applied: number;
  /** Migrations recorded in the database afterwards. */
  total: number;
}

/**
 * Applies pending Drizzle migrations from `migrationsFolder` (the folder with `meta/_journal.json`).
 * Safe to run on every start and from several replicas at once: a Postgres advisory lock
 * serializes runs, and Drizzle skips migrations it has already recorded.
 */
export async function runMigrations(
  pool: Pool,
  migrationsFolder: string,
): Promise<MigrationResult> {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    try {
      const before = await countMigrations(client);
      await migrate(drizzle(client), { migrationsFolder });
      const total = await countMigrations(client);
      return { applied: total - before, total };
    } finally {
      await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

async function countMigrations(client: PoolClient): Promise<number> {
  const exists = await client.query<{ table: string | null }>(
    "select to_regclass('drizzle.__drizzle_migrations')::text as table",
  );
  if (!exists.rows[0]?.table) return 0;
  const result = await client.query<{ count: string }>(
    "select count(*) as count from drizzle.__drizzle_migrations",
  );
  return Number(result.rows[0]?.count ?? 0);
}

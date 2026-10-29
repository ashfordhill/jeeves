import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { DatabaseConfig } from "./config.ts";
import { type MigrationResult, runMigrations } from "./migrate.ts";

export type ReadyResult = { ok: true } | { ok: false; error: string };

export interface Database<TSchema extends Record<string, unknown>> {
  pool: pg.Pool;
  /** Drizzle over the pool, typed by the service's `src/db/schema.ts`. */
  db: NodePgDatabase<TSchema>;
  /** Readiness: one round trip within `timeoutMs`. Never throws. */
  ready(timeoutMs?: number): Promise<ReadyResult>;
  migrate(migrationsFolder?: string): Promise<MigrationResult>;
  close(): Promise<void>;
}

export interface CreateDatabaseOptions<TSchema> {
  schema?: TSchema;
  /**
   * Called when an idle pooled connection fails (for example while Postgres restarts). The pool
   * drops the connection and opens a new one on demand. Defaults to `console.error`.
   */
  onIdleError?: (error: Error) => void;
}

export function createDatabase<TSchema extends Record<string, unknown> = Record<string, never>>(
  config: DatabaseConfig,
  options: CreateDatabaseOptions<TSchema> = {},
): Database<TSchema> {
  const pool = new pg.Pool({
    connectionString: config.url,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectTimeoutMs,
    idleTimeoutMillis: 30_000,
  });
  const onIdleError =
    options.onIdleError ?? ((error) => console.error("postgres pool error:", error.message));
  pool.on("error", onIdleError);
  const db = options.schema ? drizzle(pool, { schema: options.schema }) : drizzle(pool);

  return {
    pool,
    db: db as NodePgDatabase<TSchema>,
    async ready(timeoutMs = config.connectTimeoutMs) {
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${timeoutMs} ms`)), timeoutMs);
      });
      try {
        await Promise.race([pool.query("select 1"), timeout]);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      } finally {
        clearTimeout(timer);
      }
    },
    migrate: (folder = config.migrationsFolder) => runMigrations(pool, folder),
    close: () => pool.end(),
  };
}

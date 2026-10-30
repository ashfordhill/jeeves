import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type pg from "pg";
import { type DatabaseConfig, DatabaseConfigError, databaseConfigFromEnv } from "./config.ts";
import { createDatabase, type Database, type ReadyResult } from "./database.ts";
import { runResourceMigrations } from "./resource-migrate.ts";

/**
 * Runs project-owned extension work in one transaction on the generated resource tables. The
 * callback gets the checked-out client; use descriptor column names and parameterized SQL.
 */
export async function withTransaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export interface PostgresDependencyOptions<TSchema extends Record<string, unknown>> {
  /** The postgres element's ID; `/ready` reports under this name. */
  name: string;
  schema?: TSchema;
  /** Absolute path of the service's migrations folder; defaults to `DATABASE_MIGRATIONS`. */
  migrationsFolder?: string;
  resourceMigrationsFolder?: string;
}

/**
 * A service's database as an `@jeeves/service-runtime` dependency (it matches that package's
 * `Dependency` shape): the environment is checked with the service's, migrations run before
 * features start, `/ready` runs a round trip, and the pool closes on shutdown. Features use `db`.
 */
export interface PostgresDependency<TSchema extends Record<string, unknown>> {
  name: string;
  configure(env: Record<string, string | undefined>): string[];
  start(log: { info(message: string): void }): Promise<void>;
  ready(): Promise<ReadyResult>;
  close(): Promise<void>;
  /** Drizzle, typed by the service's schema. Usable once the service has started. */
  readonly db: NodePgDatabase<TSchema>;
  readonly pool: pg.Pool;
}

export function postgresDependency<TSchema extends Record<string, unknown>>(
  options: PostgresDependencyOptions<TSchema>,
): PostgresDependency<TSchema> {
  let config: DatabaseConfig | undefined;
  let database: Database<TSchema> | undefined;
  const started = () => {
    if (!database) {
      throw new Error(`Database "${options.name}" used before the service started`);
    }
    return database;
  };
  return {
    name: options.name,
    configure(env) {
      try {
        config = databaseConfigFromEnv(env);
        return [];
      } catch (error) {
        if (error instanceof DatabaseConfigError) return error.problems;
        throw error;
      }
    },
    async start(log) {
      config ??= databaseConfigFromEnv();
      database = createDatabase(config, options.schema ? { schema: options.schema } : {});
      if (options.resourceMigrationsFolder)
        await runResourceMigrations(database.pool, options.resourceMigrationsFolder);
      const result = await database.migrate(options.migrationsFolder ?? config.migrationsFolder);
      log.info(`${options.name}: applied ${result.applied} migration(s), ${result.total} recorded`);
    },
    ready: () =>
      database ? database.ready() : Promise.resolve({ ok: false, error: "not started" }),
    async close() {
      await database?.close();
    },
    get db() {
      return started().db;
    },
    get pool() {
      return started().pool;
    },
  };
}

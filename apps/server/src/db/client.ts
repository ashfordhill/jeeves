import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

export type Db = NodePgDatabase<typeof schema>;

export type DbHandle = {
  db: Db;
  /** Resolves when Postgres answers a trivial query; rejects otherwise. */
  ping: () => Promise<void>;
  close: () => Promise<void>;
};

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
    close: () => pool.end(),
  };
}

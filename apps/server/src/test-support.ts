import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { type AppDeps, buildApp } from "./app.ts";
import { type Db, migrationsFolder } from "./db/client.ts";
import * as schema from "./db/schema.ts";
import { Settings } from "./settings.ts";

/**
 * In-process Postgres (PGlite) with the real migrations, so API tests need no Docker. Pass a
 * directory to persist data across `close()` and reopen, which is how tests simulate a restart.
 */
export async function openTestDb(dataDir?: string) {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as Db, close: () => client.close() };
}

/** `models` and `settings` default to "no provider configured" in a throwaway directory. */
export function buildTestApp(db: Db, deps: Partial<AppDeps> = {}) {
  return buildApp({
    db,
    pingDb: async () => {},
    version: "0.0.0-test",
    settings: new Settings(mkdtempSync(join(tmpdir(), "jeeves-home-")), {}),
    ...deps,
  });
}

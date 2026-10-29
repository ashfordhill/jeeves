#!/usr/bin/env node
// jeeves-db-migrate [migrations-folder]: applies pending migrations once and exits. Reads the same
// environment as the service (DATABASE_URL, …); the folder defaults to DATABASE_MIGRATIONS.
import { databaseConfigFromEnv } from "./config.ts";
import { createDatabase } from "./database.ts";

const config = databaseConfigFromEnv();
const database = createDatabase(config);
try {
  const folder = process.argv[2] ?? config.migrationsFolder;
  const result = await database.migrate(folder);
  console.log(`Applied ${result.applied} migration(s); ${result.total} recorded.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await database.close();
}

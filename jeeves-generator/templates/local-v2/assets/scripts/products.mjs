import { readFileSync } from "node:fs";

/**
 * Product tables (Runnable processes on): each module that writes a database has its own SQL file
 * and schema `m_<module>`, and publishes what others may read as views in `published`. Both steps
 * run inside the setup-only owner's one migration transaction, at every first-run and start.
 */

/** After the template views: the schemas, then each writer's file in module order, in its own
 * schema. A failing file rolls the database back, and setup fails naming it. */
export async function applyProductSql(
  owner,
  db,
  quote,
  read = (path) => readFileSync(path, "utf8"),
) {
  if (!db.modules) return;
  for (const schema of ["published", ...db.modules.map((module) => module.schema)])
    await owner.query(
      `CREATE SCHEMA IF NOT EXISTS ${quote(schema)}; REVOKE ALL ON SCHEMA ${quote(schema)} FROM PUBLIC`,
    );
  for (const module of db.modules) {
    await owner.query(`SET LOCAL search_path TO ${quote(module.schema)}`);
    try {
      await owner.query(read(module.file));
    } catch (error) {
      throw new Error(
        `Product SQL ${module.file} failed: ${error instanceof Error ? error.message : error}. Keep it re-runnable; nothing in ${db.database} was changed.`,
      );
    }
    console.log(`Applied ${module.file}`);
  }
  await owner.query("RESET search_path");
}

/** After the template grants: every runtime login reads `published`, and only a writer's host
 * uses its module's schema. Revoked first and granted again, every run. */
export async function grantProductSql(owner, db, runtime, quote) {
  if (!db.modules) return;
  for (const login of runtime.filter((login) => login.provider !== "identity")) {
    const user = quote(login.user);
    const published = quote("published");
    await owner.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA ${published} FROM ${user}; GRANT USAGE ON SCHEMA ${published} TO ${user}; GRANT SELECT ON ALL TABLES IN SCHEMA ${published} TO ${user}; ALTER DEFAULT PRIVILEGES IN SCHEMA ${published} GRANT SELECT ON TABLES TO ${user}`,
    );
    for (const module of db.modules) {
      const schema = quote(module.schema);
      await owner.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM ${user}; REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${schema} FROM ${user}; ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON TABLES FROM ${user}; ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON SEQUENCES FROM ${user}; REVOKE ALL ON SCHEMA ${schema} FROM ${user}`,
      );
      if (module.host === login.host)
        await owner.query(
          `GRANT USAGE ON SCHEMA ${schema} TO ${user}; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${user}; GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${user}; ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${user}; ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${user}`,
        );
    }
  }
}

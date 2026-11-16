import { readFileSync } from "node:fs";

/** Setup-only product SQL. All namespaces exist before any module runs; shared namespaces
 * belong to the declared logical owner, independently of module initialization order.
 * Versioned product migration execution is a separate contract. */
export async function applyProductSql(
  owner,
  db,
  quote,
  read = (path) => readFileSync(path, "utf8"),
) {
  if (!db.modules) return;
  for (const schema of new Set([
    "published",
    ...db.modules.map((module) => module.schema),
    ...(db.productState?.schema ? [db.productState.schema] : []),
  ]))
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

/** Revocation also removes the old blanket/default grants. Product declarations can address
 * only ordinary tables in the owner namespace and named views in published, never internal
 * template schemas. No runtime CREATE, ownership, membership, DDL or default privileges. */
export async function grantProductSql(owner, db, runtime, quote) {
  if (!db.modules) return;
  for (const login of runtime.filter((login) => login.provider !== "identity")) {
    const user = quote(login.user);
    for (const name of new Set([
      "published",
      ...db.modules.map((module) => module.schema),
      ...(db.productState?.schema ? [db.productState.schema] : []),
    ])) {
      const schema = quote(name);
      await owner.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM ${user}; REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${schema} FROM ${user}; ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON TABLES FROM ${user}; ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON SEQUENCES FROM ${user}; REVOKE ALL ON SCHEMA ${schema} FROM ${user}`,
      );
    }
    const access = db.productState?.access.find((entry) => entry.host === login.host)?.product;
    if (!access) continue;
    const grant = async (schema, name, operations, kinds) => {
      // A table declaration must not smuggle a view (or a foreign table) into private access.
      const result = await owner.query(
        "SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2",
        [schema, name],
      );
      if (!result.rows?.length || !kinds.includes(result.rows[0].relkind))
        throw new Error(
          `Declared product relation ${schema}.${name} is missing or has the wrong kind`,
        );
      if (
        operations.some(
          (operation) => !["SELECT", "INSERT", "UPDATE", "DELETE"].includes(operation),
        )
      )
        throw new Error("Unsupported product table operation");
      await owner.query(
        `GRANT USAGE ON SCHEMA ${quote(schema)} TO ${user}; GRANT ${operations.join(", ")} ON TABLE ${quote(schema)}.${quote(name)} TO ${user}`,
      );
    };
    for (const table of access.tables)
      await grant(db.productState.schema, table.name, table.operations, ["r", "p"]);
    for (const view of access.views) await grant("published", view, ["SELECT"], ["v"]);
  }
}

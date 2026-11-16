import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { checkedProductSql, validateProductDeclaration } from "../src/runtime/product-contract.ts";

export function readProductSql(db, read = (path) => readFileSync(path, "utf8")) {
  if (!db.productSql)
    throw new Error("Product migration declaration required; legacy SQL is never executed");
  return validateProductDeclaration(JSON.parse(read(db.productSql.file)), db);
}

/** Called inside the setup owner's transaction. A namespace lock protects both checksum checks
 * and application; ledger writes remain outside the product DDL role. No module-local ledgers. */
export async function applyProductSql(
  owner,
  db,
  quote,
  read = (path) => readFileSync(path, "utf8"),
) {
  if (!db.modules) return;
  const declaration = readProductSql(db, read);
  await owner.query(
    "CREATE TABLE IF NOT EXISTS public.jeeves_product_migrations(namespace text NOT NULL, version text NOT NULL, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(namespace,version))",
  );
  await owner.query(
    `CREATE SCHEMA IF NOT EXISTS published; REVOKE ALL ON SCHEMA published FROM PUBLIC`,
  );
  for (const namespace of declaration.namespaces) {
    const binding = db.productSql.namespaces.find((row) => row.schema === namespace.schema);
    const schema = quote(namespace.schema),
      role = quote(binding.role);
    await owner.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `product:${db.database}:${namespace.schema}`,
    ]);
    await owner.query(
      `CREATE SCHEMA IF NOT EXISTS ${schema}; REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC; GRANT USAGE, CREATE ON SCHEMA ${schema} TO ${role}`,
    );
    const prior = (
      await owner.query(
        "SELECT version,sha256 FROM public.jeeves_product_migrations WHERE namespace=$1 ORDER BY version",
        [namespace.schema],
      )
    ).rows;
    const migrations = namespace.migrations.map((entry) => {
      const sql = read(entry.file);
      return { ...entry, sql, sha256: createHash("sha256").update(sql).digest("hex") };
    });
    for (const applied of prior) {
      const entry = migrations.find((row) => row.version === applied.version);
      if (!entry || entry.sha256 !== applied.sha256)
        throw new Error(
          `Applied product migration ${namespace.schema}/${applied.version} differs or is missing; add a new migration. No reset performed.`,
        );
    }
    for (const entry of migrations) {
      if (prior.some((row) => row.version === entry.version)) continue;
      if (prior.some((row) => row.version > entry.version))
        throw new Error("Cannot insert an earlier product migration; append a new version");
      checkedProductSql(entry.sql);
      await owner.query(`SET LOCAL ROLE ${role}`);
      await owner.query(`SET LOCAL search_path TO ${schema}, pg_catalog`);
      // A failed statement aborts the enclosing transaction; its caller rolls back schema + ledger.
      try {
        await owner.query(entry.sql);
      } catch (error) {
        throw new Error(`Product migration ${entry.file} failed; transaction will roll back`, {
          cause: error,
        });
      }
      await owner.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO ${quote(db.owner)} WITH GRANT OPTION`,
      );
      await owner.query("RESET ROLE; RESET search_path");
      await owner.query(
        "INSERT INTO public.jeeves_product_migrations(namespace,version,sha256) VALUES($1,$2,$3)",
        [namespace.schema, entry.version, entry.sha256],
      );
    }
  }
  // Publish only explicitly declared product views. Product migrations have no CREATE on published.
  for (const view of declaration.views) {
    const binding = db.productSql.namespaces.find((row) => row.schema === view.schema);
    const found = await owner.query(
      "SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2",
      [view.schema, view.source],
    );
    if (found.rows?.[0]?.relkind !== "v")
      throw new Error("Published source must be an owned product view");
    await owner.query(`SET LOCAL ROLE ${quote(binding.role)}`);
    await owner.query(
      `GRANT SELECT ON ${quote(view.schema)}.${quote(view.source)} TO ${quote(db.owner)}`,
    );
    await owner.query("RESET ROLE");
    await owner.query(
      `CREATE OR REPLACE VIEW published.${quote(view.name)} AS SELECT * FROM ${quote(view.schema)}.${quote(view.source)}`,
    );
  }
}

/** Revocation also removes the old blanket/default grants. Product declarations can address
 * only ordinary tables in the owner namespace and named views in published, never internal
 * template schemas. No runtime CREATE, ownership, membership, DDL or default privileges. */
export async function grantProductSql(owner, db, runtime, quote, read) {
  if (!db.modules) return;
  const declaration = readProductSql(db, read);
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
    for (const table of access.tables.filter((table) =>
      declaration.tables.some(
        (row) => row.schema === db.productState.schema && row.name === table.name,
      ),
    ))
      await grant(db.productState.schema, table.name, table.operations, ["r", "p"]);
    for (const view of access.views.filter((name) =>
      declaration.views.some((row) => row.name === name),
    ))
      await grant("published", view, ["SELECT"], ["v"]);
  }
}

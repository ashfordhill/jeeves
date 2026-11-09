import { readFileSync } from "node:fs";
import pg from "pg";
import { hash, plan, quote, secret } from "./common.mjs";

const connect = async (database, user, password) => {
  const client = new pg.Client({
    host: process.env.PGHOST ?? "local-postgres",
    port: Number(process.env.PGPORT ?? 5432),
    database,
    user,
    password,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  return client;
};
const admin = await connect("postgres", "postgres", secret("postgres-admin"));
try {
  for (const login of [
    ...plan.databases.map((db) => ({ user: db.owner, secret: db.secret })),
    ...plan.logins,
    ...plan.providerLogins,
  ]) {
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [login.user])).rowCount) {
      const result = await admin.query(
        "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql",
        [login.user, secret(login.secret)],
      );
      await admin.query(result.rows[0].sql);
    }
  }
  for (const db of plan.databases) {
    const existing = await admin.query(
      "SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1",
      [db.database],
    );
    if (existing.rowCount && existing.rows[0].owner !== db.owner)
      throw new Error(`Database ${db.database} owner differs; preserve and inspect runtime.`);
    if (!existing.rowCount)
      await admin.query(`CREATE DATABASE ${quote(db.database)} OWNER ${quote(db.owner)}`);
    await admin.query(`REVOKE ALL ON DATABASE ${quote(db.database)} FROM PUBLIC`);
    const runtime = [...plan.logins, ...plan.providerLogins].filter(
      (login) => login.database === db.database,
    );
    for (const login of runtime)
      await admin.query(`GRANT CONNECT ON DATABASE ${quote(db.database)} TO ${quote(login.user)}`);
    const owner = await connect(db.database, db.owner, secret(db.secret)); // Refuse mismatched existing credentials, never rotate.
    try {
      await owner.query("BEGIN");
      await owner.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`local-v2:${db.database}`]);
      await owner.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
      await owner.query(
        "CREATE TABLE IF NOT EXISTS public.local_migrations(version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())",
      );
      for (const path of db.migrations) {
        const bytes = readFileSync(path),
          sha256 = hash(bytes);
        const prior = await owner.query(
          "SELECT sha256 FROM public.local_migrations WHERE version=$1",
          [path],
        );
        if (prior.rowCount) {
          if (prior.rows[0].sha256 !== sha256)
            throw new Error(
              `Applied migration ${path} differs; add a new migration. No reset performed.`,
            );
        } else {
          await owner.query(bytes.toString("utf8"));
          await owner.query("INSERT INTO public.local_migrations(version,sha256) VALUES($1,$2)", [
            path,
            sha256,
          ]);
          console.log(`Applied ${path}`);
        }
      }
      for (const view of plan.views.filter((view) => view.resource === db.resource))
        await owner.query(
          `CREATE OR REPLACE VIEW ${quote(view.schema ?? "public")}.${quote(view.name)} AS ${view.selectSql}`,
        );
      for (const login of runtime) {
        // Keycloak owns its vendor tables through a dedicated runtime login; it never receives
        // the setup owner credential or database ownership. Ordinary app users get no CREATE.
        if (login.provider === "identity") {
          await owner.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${quote(login.user)}`);
          continue;
        }
        await owner.query(
          `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${quote(login.user)}; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${quote(login.user)}; ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${quote(login.user)}; GRANT USAGE ON SCHEMA public TO ${quote(login.user)}`,
        );
        for (const schema of new Set(
          plan.grants
            .filter((grant) => grant.resource === db.resource && grant.host === login.host)
            .map((grant) => grant.schema ?? "public"),
        )) {
          await owner.query(
            `REVOKE ALL ON ALL TABLES IN SCHEMA ${quote(schema)} FROM ${quote(login.user)}; REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${quote(schema)} FROM ${quote(login.user)}; ALTER DEFAULT PRIVILEGES IN SCHEMA ${quote(schema)} REVOKE ALL ON TABLES FROM ${quote(login.user)}; GRANT USAGE ON SCHEMA ${quote(schema)} TO ${quote(login.user)}`,
          );
        }
        for (const grant of plan.grants.filter(
          (grant) => grant.resource === db.resource && grant.host === login.host,
        )) {
          await owner.query(
            `GRANT ${grant.privileges.join(",")} ON TABLE ${quote(grant.schema ?? "public")}.${quote(grant.relation)} TO ${quote(login.user)}`,
          );
        }
      }
      await owner.query("COMMIT");
    } catch (error) {
      await owner.query("ROLLBACK");
      throw error;
    } finally {
      await owner.end();
    }
    for (const login of runtime) {
      const check = await connect(db.database, login.user, secret(login.secret));
      await check.end();
    }
  }
} finally {
  await admin.end();
}
console.log("Migrations current; setup-only owners and exact runtime credentials preserved.");

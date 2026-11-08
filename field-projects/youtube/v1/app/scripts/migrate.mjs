import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";
const secret = (name) =>
  readFileSync(`${process.env.SECRET_DIR ?? "/run/secrets"}/${name}`, "utf8").trim();
const host = process.env.PGHOST ?? "postgres",
  port = Number(process.env.PGPORT ?? 5432);
const connect = async (database, user, password) => {
  const c = new pg.Client({ host, port, database, user, password, connectionTimeoutMillis: 5000 });
  await c.connect();
  return c;
};
const admin = await connect("postgres", "postgres", secret("postgres_admin"));
try {
  for (const role of ["metadata_upload", "metadata_lifecycle", "counts_writer"]) {
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount) {
      // Identifiers are a finite allowlist; password is quoted by PostgreSQL, never logged.
      const q = await admin.query(
        "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql",
        [role, secret(role)],
      );
      await admin.query(q.rows[0].sql);
    }
  }
} finally {
  await admin.end();
}
for (const [database, owner, reader, writers] of [
  ["metadata", "metadata_owner", "metadata_reader", ["metadata_upload", "metadata_lifecycle"]],
  ["counts", "counts_owner", "counts_reader", ["counts_writer"]],
]) {
  const a = await connect(database, "postgres", secret("postgres_admin"));
  try {
    await a.query(
      `REVOKE ALL ON DATABASE ${database} FROM PUBLIC; GRANT CONNECT ON DATABASE ${database} TO ${[owner, reader, ...writers].join(",")}; REVOKE ALL ON SCHEMA public FROM PUBLIC,${reader}; ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public REVOKE ALL ON TABLES FROM ${reader}`,
    );
    // Existing installations may already have blanket/default public SELECT. Remove it on every run.
    await a.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${reader}; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${reader}`,
    );
  } finally {
    await a.end();
  }
  // Refuse mismatched existing-role credentials; never silently rotate a live login.
  for (const role of writers) {
    const runtime = await connect(database, role, secret(role));
    await runtime.end();
  }
  const c = await connect(database, owner, secret(owner));
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext('youtube-v1-migrations'))");
    await c.query(
      "CREATE TABLE IF NOT EXISTS public.field_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT clock_timestamp())",
    );
    for (const file of readdirSync(`infra/postgres/migrations/${database}`)
      .filter((f) => /^\d+-.*\.sql$/.test(f))
      .sort()) {
      const sql = readFileSync(`infra/postgres/migrations/${database}/${file}`, "utf8"),
        hash = createHash("sha256").update(sql).digest("hex");
      const prior = await c.query("SELECT sha256 FROM public.field_migrations WHERE version=$1", [
        file,
      ]);
      if (prior.rowCount) {
        if (prior.rows[0].sha256 !== hash)
          throw new Error(`Applied ${database}/${file} differs; add a new migration`);
        continue;
      }
      await c.query(sql);
      await c.query("INSERT INTO public.field_migrations(version,sha256) VALUES($1,$2)", [
        file,
        hash,
      ]);
      console.log(`Applied ${database}/${file}`);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}
console.log("Migrations current; runtime credentials preserved. Owners are setup-only.");

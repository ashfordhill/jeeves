import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "pg";

/** Immutable, hashed SQL in its own journal; project-owned Drizzle migrations stay separate. */
export async function runResourceMigrations(pool: Pool, folder: string): Promise<void> {
  const manifest: { file: string; sha256: string }[] = JSON.parse(
    readFileSync(join(folder, "manifest.json"), "utf8"),
  );
  if (!Array.isArray(manifest) || new Set(manifest.map((m) => m.file)).size !== manifest.length)
    throw new Error("Invalid resource migration manifest");
  const migrations = manifest.map((m, i) => {
    if (m.file !== `${String(i + 1).padStart(4, "0")}.sql`)
      throw new Error(`Invalid migration order: ${m.file}`);
    const sql = readFileSync(join(folder, m.file), "utf8");
    if (createHash("sha256").update(sql).digest("hex") !== m.sha256)
      throw new Error(`Migration hash mismatch: ${m.file}`);
    return { ...m, sql };
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7340215002)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS jeeves_resource_migrations (file text PRIMARY KEY, sha256 text NOT NULL)",
    );
    const existing = await client.query<{ file: string; sha256: string }>(
      "SELECT file, sha256 FROM jeeves_resource_migrations ORDER BY file",
    );
    for (const row of existing.rows)
      if (!migrations.some((m) => m.file === row.file && m.sha256 === row.sha256))
        throw new Error(`Applied migration missing or changed: ${row.file}`);
    for (const m of migrations) {
      if (existing.rows.some((row) => row.file === m.file)) continue;
      await client.query(m.sql);
      await client.query("INSERT INTO jeeves_resource_migrations (file,sha256) VALUES ($1,$2)", [
        m.file,
        m.sha256,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

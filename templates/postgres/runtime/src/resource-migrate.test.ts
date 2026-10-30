import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterEach, expect, it, vi } from "vitest";
import { runResourceMigrations } from "./resource-migrate.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-migrations-"));
  dirs.push(dir);
  const sql = "CREATE TABLE example (id uuid PRIMARY KEY);";
  const sha256 = createHash("sha256").update(sql).digest("hex");
  writeFileSync(join(dir, "0001.sql"), sql);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify([{ file: "0001.sql", sha256 }]));
  const journal: { file: string; sha256: string }[] = [];
  const release = vi.fn();
  const query = vi.fn(async (text: string, values?: unknown[]) => {
    if (text.startsWith("SELECT file")) return { rows: [...journal] };
    if (text.startsWith("INSERT INTO jeeves_resource"))
      journal.push({ file: String(values?.[0]), sha256: String(values?.[1]) });
    return { rows: [] };
  });
  const pool = { connect: vi.fn(async () => ({ query, release })) } as unknown as Pool;
  return { dir, pool, query, journal, release, sql };
}
it("serializes migrations, runs twice without reapplying, and releases its connection", async () => {
  const f = fixture();
  await runResourceMigrations(f.pool, f.dir);
  await runResourceMigrations(f.pool, f.dir);
  expect(f.query.mock.calls.filter(([sql]) => sql === f.sql)).toHaveLength(1);
  expect(f.query.mock.calls[0]?.[0]).toBe("BEGIN");
  expect(f.query.mock.calls[1]?.[0]).toContain("pg_advisory_xact_lock");
  expect(f.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  expect(f.release).toHaveBeenCalledTimes(2);
});
it("rejects tampered files before connecting, and changed applied history rolls back", async () => {
  const f = fixture();
  writeFileSync(join(f.dir, "0001.sql"), "DROP TABLE example;");
  await expect(runResourceMigrations(f.pool, f.dir)).rejects.toThrow("hash mismatch");
  expect(f.pool.connect).not.toHaveBeenCalled();
  writeFileSync(join(f.dir, "0001.sql"), f.sql);
  f.journal.push({ file: "0001.sql", sha256: "edited" });
  await expect(runResourceMigrations(f.pool, f.dir)).rejects.toThrow("Applied migration");
  expect(f.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  expect(f.release).toHaveBeenCalledOnce();
});

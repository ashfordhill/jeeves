import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { usageTotals } from "./usage.ts";

describe("implementation usage", () => {
  it("retains known subtotals with independent token and cost coverage", () => {
    expect(
      usageTotals([
        { inputTokens: 100, outputTokens: 10, known: true, costUsd: 0.02 },
        null,
        { inputTokens: 200, outputTokens: 20, known: true },
        { inputTokens: 30, outputTokens: 3, known: false },
      ]),
    ).toEqual({
      inputTokens: 330,
      outputTokens: 33,
      known: false,
      records: 4,
      tokenRecords: 2,
      costRecords: 1,
      knownCostUsd: 0.02,
    });
    expect(usageTotals([])).toMatchObject({ records: 0, known: true });
    expect(
      usageTotals([{ inputTokens: 0, outputTokens: 0, known: true, costUsd: 0 }]),
    ).toMatchObject({ costUsd: 0, costRecords: 1 });
  });

  it("migrates legacy usage once, without importing design chat", async () => {
    const pg = new PGlite();
    try {
      for (const file of [
        "0000_design_api",
        "0001_chat",
        "0002_generate",
        "0003_orchestrator",
        "0004_execution",
      ]) {
        await pg.exec(readFileSync(new URL(`../../drizzle/${file}.sql`, import.meta.url), "utf8"));
      }
      await pg.exec(`INSERT INTO projects (id, name) VALUES ('00000000-0000-4000-8000-000000000001', 'legacy');
        INSERT INTO runs (project_id, status, output_dir, planner) VALUES ('00000000-0000-4000-8000-000000000001', 'succeeded', '/tmp/old', '{"model":"old-model","usage":{"inputTokens":10,"outputTokens":2,"known":true}}');
        INSERT INTO tasks (run_id, position, key, element, title, description, acceptance, owned_paths, depends_on, source, status) VALUES (1,0,'x','x','X','X','[]','[]','[]','seed','done');
        INSERT INTO attempts (run_id, task_id, number, status, usage) VALUES (1,1,1,'failed','{"inputTokens":20,"outputTokens":4,"known":true}'),(1,1,2,'succeeded',NULL);`);
      await pg.exec(
        readFileSync(new URL("../../drizzle/0005_runs_evidence.sql", import.meta.url), "utf8"),
      );
      const { rows } = await pg.query<{
        kind: string;
        usage: { inputTokens: number; outputTokens: number; known: boolean } | null;
      }>("SELECT kind, usage FROM implementation_usage ORDER BY id");
      expect(rows.map((r) => r.kind)).toEqual(["legacy", "legacy", "planning"]);
      expect(usageTotals(rows.map((r) => r.usage))).toMatchObject({
        inputTokens: 30,
        outputTokens: 6,
        records: 3,
        tokenRecords: 2,
        known: false,
      });
    } finally {
      await pg.close();
    }
  });
});

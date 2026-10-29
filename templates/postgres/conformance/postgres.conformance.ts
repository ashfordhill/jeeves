import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, databaseConfigFromEnv } from "@jeeves/postgres-runtime";
import { createGenerateContext, type TestPackContext } from "@jeeves/template-kit";
import {
  type BuiltProject,
  buildProject,
  type StartedProject,
  startProject,
} from "@jeeves/template-kit/harness";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initServiceName } from "../generate.ts";
import { postgresTemplate } from "../template.ts";
import { lookup, sharedDatabaseDesign } from "./fixtures/design.ts";

// http-service isn't built until S8, so consumers are stand-in containers with psql available.
const consumerStub = { image: "postgres:17-alpine", entrypoint: ["sleep", "infinity"], init: true };
const stubsFor = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, consumerStub]));

const projectName = `jeeves-postgres-conformance-${process.pid}`;
const dir = mkdtempSync(join(tmpdir(), "jeeves-postgres-"));
let built: BuiltProject;
let project: StartedProject;

function build(extra: string[] = []): BuiltProject {
  return buildProject({
    dir,
    design: sharedDatabaseDesign(extra),
    lookup,
    modules: [postgresTemplate],
    stubs: stubsFor(["links", "stats", ...extra]),
  });
}

function packContext(extra: string[] = []): TestPackContext {
  return {
    projectDir: dir,
    subject: createGenerateContext(sharedDatabaseDesign(extra), lookup, "main-db"),
    compose: project.compose,
    service: (name) => project.service(name),
    log: () => {},
  };
}

/** What a consumer service does at startup: apply its migrations through the runtime. */
async function migrateConsumer(id: string) {
  const raw = project.compose.services[id]?.environment?.DATABASE_URL ?? "";
  const url = new URL(raw);
  const { host, port } = await project.service("main-db").endpoint(5432);
  url.hostname = host;
  url.port = String(port);
  const database = createDatabase(databaseConfigFromEnv({ DATABASE_URL: url.toString() }));
  try {
    return await database.migrate(join(dir, "services", id, "migrations"));
  } finally {
    await database.close();
  }
}

async function query(id: string, sql: string, params: unknown[] = []) {
  const url = new URL(project.compose.services[id]?.environment?.DATABASE_URL ?? "");
  const { host, port } = await project.service("main-db").endpoint(5432);
  url.hostname = host;
  url.port = String(port);
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  built = build();
  // The links service has written two migrations of its own.
  cpSync(
    join(import.meta.dirname, "fixtures/links-migrations"),
    join(dir, "services/links/migrations"),
    {
      recursive: true,
    },
  );
  project = await startProject(dir, { projectName });
  for (const id of ["links", "stats"]) await migrateConsumer(id);
});

afterAll(async () => {
  await project?.down({ volumes: true });
  rmSync(dir, { recursive: true, force: true });
});

describe("postgres conformance", () => {
  it("generates the init job, wiring, and consumer scaffolds", () => {
    expect(built.compose.services[initServiceName("main-db")]).toBeDefined();
    expect(built.written).toContain("databases/main-db/init/10-consumers.sql");
    expect(built.written).toContain("services/stats/src/db/schema.ts");
  });

  describe("test pack", () => {
    for (const check of postgresTemplate.testPack.checks) {
      it(check.title, () => check.run(packContext()));
    }
  });

  it("consumer containers reach their database by service name through DATABASE_URL", async () => {
    const result = await project
      .service("links")
      .exec(["sh", "-c", 'psql "$DATABASE_URL" -tAc "select current_database()"']);
    expect(result.exitCode, result.output).toBe(0);
    expect(result.output.trim()).toBe("links");
  });

  it("migrations are idempotent: a second run applies nothing", async () => {
    expect(await migrateConsumer("links")).toEqual({ applied: 0, total: 2 });
    expect(await migrateConsumer("stats")).toEqual({ applied: 0, total: 0 });
  });

  it("concurrent migration runs (several replicas starting) apply each migration once", async () => {
    await query("links", "drop schema drizzle cascade; drop table links");
    const results = await Promise.all([1, 2, 3].map(() => migrateConsumer("links")));
    expect(results.map((r) => r.applied).sort()).toEqual([0, 0, 2]);
    expect(results.every((r) => r.total === 2)).toBe(true);
  });

  it("data survives a restart and a down/up that keeps the volume", async () => {
    await query("links", "insert into links (code, target) values ('jv', 'https://example.com')");
    await project.service("main-db").restart();
    expect(await query("links", "select target from links")).toEqual([
      { target: "https://example.com" },
    ]);

    await project.down();
    project = await startProject(dir, { projectName });
    expect(await query("links", "select target, clicks from links")).toEqual([
      { target: "https://example.com", clicks: 0 },
    ]);
    expect(await migrateConsumer("links")).toEqual({ applied: 0, total: 2 });
  });

  it("regenerating with a new consumer keeps project files and creates its database on up", async () => {
    await project.down();
    built = build(["audit"]);
    expect(built.written).not.toContain("services/links/migrations/meta/_journal.json");
    expect(built.written).toContain("services/audit/src/db/schema.ts");

    project = await startProject(dir, { projectName });
    await migrateConsumer("audit");
    for (const check of postgresTemplate.testPack.checks) await check.run(packContext(["audit"]));
    expect(await query("links", "select code from links")).toEqual([{ code: "jv" }]);
  });
});

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { httpServiceTemplate } from "@jeeves/template-http-service/template";
import { createGenerateContext, type TestPack, type TestPackContext } from "@jeeves/template-kit";
import {
  buildProject,
  type StartedProject,
  startProject,
  vendorRuntimes,
} from "@jeeves/template-kit/harness";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgresTemplate } from "../template.ts";
import { lookup, sharedDatabaseDesign } from "./fixtures/design.ts";

// Two real http-service elements share the `main-db` postgres element. `links` also gets a
// feature, schema, and migration of its own, as a coding agent would write them.
const modules = [httpServiceTemplate, postgresTemplate];
const design = sharedDatabaseDesign();
const dir = mkdtempSync(join(tmpdir(), "jeeves-service-postgres-"));
let project: StartedProject;

beforeAll(async () => {
  vendorRuntimes(dir, modules);
  buildProject({ dir, design, lookup, modules });
  cpSync(join(import.meta.dirname, "fixtures/notes-service"), join(dir, "services/links"), {
    recursive: true,
  });
  project = await startProject(dir, { projectName: `jeeves-service-postgres-${process.pid}` });
});

afterAll(async () => {
  await project?.down({ volumes: true, images: true });
  rmSync(dir, { recursive: true, force: true });
});

function packContext(subject: string): TestPackContext {
  return {
    projectDir: dir,
    subject: createGenerateContext(design, lookup, subject),
    compose: project.compose,
    service: (name) => project.service(name),
    log: () => {},
  };
}

async function linksUrl(path: string): Promise<string> {
  const { host, port } = await project.service("links").endpoint(8080);
  return `http://${host}:${port}${path}`;
}

const runPack = (pack: TestPack, subject: string) => {
  for (const check of pack.checks) {
    it(check.title, () => check.run(packContext(subject)));
  }
};

describe("conformance: http-service plus postgres", () => {
  it("adds the database runtime and Drizzle to each service's package.json", () => {
    const pkg = JSON.parse(readFileSync(join(dir, "services/stats/package.json"), "utf8"));
    expect(pkg.dependencies).toMatchObject({
      "@jeeves/postgres-runtime": "file:../../vendor/jeeves/jeeves-postgres-runtime-0.1.0.tgz",
      "@jeeves/service-runtime": "file:../../vendor/jeeves/jeeves-service-runtime-0.1.0.tgz",
      "drizzle-orm": "0.45.4",
    });
    expect(pkg.devDependencies["drizzle-kit"]).toBe("0.31.11");
  });

  it("a feature writes to and reads from the service's own database", async () => {
    const created = await fetch(await linksUrl("/notes"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "first" }),
    });
    expect(created.status).toBe(201);
    expect(await (await fetch(await linksUrl("/notes"))).json()).toEqual([
      { id: 1, body: "first" },
    ]);
  });

  describe("postgres test pack (services applied their migrations at startup)", () => {
    runPack(postgresTemplate.testPack, "main-db");
  });

  describe("http-service test pack for links", () => {
    runPack(httpServiceTemplate.testPack, "links");
  });

  describe("http-service test pack for stats", () => {
    runPack(httpServiceTemplate.testPack, "stats");
  });

  it("data written before restarts is still there, and the service reconnected", async () => {
    expect(await (await fetch(await linksUrl("/notes"))).json()).toEqual([
      { id: 1, body: "first" },
    ]);
  });

  it("the service with a database and a feature type-checks", () => {
    const cwd = join(dir, "services/links");
    execFileSync("npm", ["install", "--no-audit", "--no-fund"], { cwd, stdio: "pipe" });
    execFileSync("npm", ["run", "typecheck"], { cwd, stdio: "pipe" });
  });
});

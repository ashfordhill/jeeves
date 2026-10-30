import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResourceConfig } from "@jeeves/spec";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FixedAcceptance } from "../src/acceptance.ts";
import { type CheckOutcome, verifyBehavior } from "../src/baseline/index.ts";
import { generateProject } from "../src/generate.ts";
import type { Lock } from "../src/lock.ts";
import { fixtureDesign } from "../src/test-support.ts";

// A minimal technical fixture, not qrwty: it proves the new fixture controls and browser runner.
const design = fixtureDesign("resources");
const model = design.elements[0]!.attachments[0]!.config.model as ResourceConfig;
model.acceptanceCases.push("HARNESS-01", "HARNESS-02", "HARNESS-03");
// A second operation makes a multi-operation suite only partially due in extension checks.
model.extensions.push({
  ...structuredClone(model.extensions[0]!),
  id: "follow",
  operationId: "followQr",
  path: "/api/qr/{id}/follow",
  acceptance: ["HARNESS-03"],
});

const fixtureSuite = `
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

test("fixture DB seeding and restart", async () => {
  const dir = process.env.JEEVES_TEST_PROJECT_DIR;
  const file = process.env.JEEVES_TEST_COMPOSE_FILE;
  const name = process.env.JEEVES_TEST_COMPOSE_PROJECT;
  const service = process.env.JEEVES_TEST_SERVICE;
  const db = process.env.JEEVES_TEST_DB_SERVICE;
  const url = process.env.JEEVES_TEST_URL;
  const origin = process.env.JEEVES_TEST_PUBLIC_ORIGIN;
  assert.ok(dir && file && name && service && db && url && origin);
  const compose = (...args) => execFileSync("docker", ["compose", "--project-directory", dir, "--env-file", "/dev/null", "-f", file, "-p", name, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const psql = (sql) => compose("exec", "-T", db, "psql", "-U", "postgres", "-d", service, "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", sql).trim();
  assert.equal(psql("SELECT 1"), "1");

  const registration = await fetch(url + "/auth/register", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ email: randomUUID() + "@example.test", password: "fixture-password-123" }) });
  assert.equal(registration.status, 201);
  const identity = await registration.json();
  const cookie = registration.headers.get("set-cookie").split(";")[0];
  const created = await fetch(url + "/api/qr", { method: "POST", headers: { origin, cookie, "x-csrf-token": identity.csrfToken, "content-type": "application/json" }, body: JSON.stringify({ destination: "https://example.test/fixture" }) });
  assert.equal(created.status, 201);
  const qr = await created.json();
  const scan = (await import(pathToFileURL(join(dir, "services/links/src/generated/resources/scan.ts")).href)).default;
  const parent = scan.belongsTo[0];
  const occurred = scan.fields.find((field) => field.type === "timestamp");
  psql("INSERT INTO \\"" + scan.table + "\\" (id, \\"" + parent.column + "\\", \\"" + occurred.column + "\\") VALUES ('" + randomUUID() + "', '" + qr.id + "', '2026-01-01T00:00:00Z')");
  assert.equal(psql("SELECT count(*) FROM \\"" + scan.table + "\\" WHERE \\"" + parent.column + "\\" = '" + qr.id + "'"), "1");

  compose("restart", db);
  const databaseDeadline = Date.now() + 60000;
  for (;;) {
    try {
      if (psql("SELECT 1") === "1") break;
    } catch {}
    if (Date.now() > databaseDeadline) throw new Error("database did not become ready after restart");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  compose("restart", service);
  const currentUrl = "http://127.0.0.1:" + compose("port", service, "8080").trim().split(":").pop();
  const deadline = Date.now() + 60000;
  for (;;) {
    try {
      const ready = await fetch(currentUrl + "/ready");
      if (ready.status === 200) break;
    } catch {}
    if (Date.now() > deadline) throw new Error("service did not become ready after restart");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(psql("SELECT count(*) FROM \\"" + scan.table + "\\" WHERE \\"" + parent.column + "\\" = '" + qr.id + "'"), "1");
});
`;

const browserSuite = `
import { expect, test } from "@playwright/test";

test("browser runner reaches the fixture web app", async ({ page }) => {
  const url = process.env.JEEVES_TEST_WEB_URL;
  expect(url).toBeTruthy();
  await page.goto(url);
  await expect(page.locator("h1")).toHaveText("Shorty");
  await expect(page.locator("h2")).toHaveText("Welcome");
});
`;

const suites: FixedAcceptance[] = [
  {
    id: "fixture",
    service: "links",
    operationIds: ["qrActivity"],
    acceptanceIds: ["ACT-01", "HARNESS-01"],
    requires: "extensions",
    runner: "node",
    source: fixtureSuite,
  },
  {
    id: "pair",
    service: "links",
    operationIds: ["qrActivity", "followQr"],
    acceptanceIds: ["HARNESS-03"],
    requires: "extensions",
    runner: "node",
    source: 'import test from "node:test"; test("pair fixture", () => {});\n',
  },
  {
    id: "browser",
    service: "links",
    operationIds: ["qrActivity"],
    acceptanceIds: ["HARNESS-02"],
    requires: "frontend",
    runner: "playwright",
    dependencies: [{ name: "@playwright/test", version: "1.63.0" }],
    source: browserSuite,
  },
];

const dir = mkdtempSync(join(tmpdir(), "jeeves-p6-harness-"));
let lock: Lock;
const logs: string[] = [];
const fixtureNames: string[] = [];
const log = (line: string) => {
  if (line.startsWith("Disposable fixture: "))
    fixtureNames.push(line.slice("Disposable fixture: ".length));
  logs.push(line);
  if (logs.length > 1000) logs.shift();
};

beforeAll(async () => {
  const result = await generateProject({
    dir,
    design,
    projectName: "Fixture harness",
    git: false,
    fixedAcceptance: suites,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  lock = result.lock;
  execFileSync("pnpm", ["install", "--ignore-scripts"], { cwd: dir, stdio: "pipe" });
  const feature = join(dir, "services/links/src/features/activity/index.ts");
  mkdirSync(join(feature, ".."), { recursive: true });
  writeFileSync(
    feature,
    'import { defineFeature } from "@jeeves/service-runtime"; export default defineFeature({name:"activity",operations:{qrActivity:()=>({status:200,body:{total:0}})}});',
  );
}, 300_000);

afterAll(() => {
  if (existsSync(join(dir, "docker-compose.yml")))
    execFileSync("docker", ["compose", "down", "--volumes", "--rmi", "local"], {
      cwd: dir,
      stdio: "pipe",
      env: {
        ...process.env,
        DB_LINKS_PASSWORD: "isolated-baseline-password",
        LINKS_PUBLIC_ORIGIN: "http://127.0.0.1:1",
      },
    });
  rmSync(dir, { recursive: true, force: true });
}, 300_000);

describe("fixed acceptance fixture controls", () => {
  it("seeds the disposable database, restarts the fixture and runs a browser suite", async () => {
    const checks: CheckOutcome[] = [];
    try {
      await verifyBehavior({
        dir,
        lock,
        required: { links: ["qrActivity"] },
        phase: "frontend",
        log,
        onCheck: (check) => checks.push(check),
      });
    } catch (error) {
      const name = fixtureNames.at(-1);
      let containerLogs = "";
      if (name) {
        try {
          const containers = execFileSync(
            "docker",
            [
              "ps",
              "-a",
              "--filter",
              `label=com.docker.compose.project=${name}`,
              "--format",
              "{{.Names}}",
            ],
            { encoding: "utf8" },
          )
            .trim()
            .split("\n")
            .filter(Boolean);
          containerLogs = containers
            .map((container) => {
              try {
                return `--- ${container} ---\n${execFileSync("docker", ["logs", "--tail", "80", container], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })}`;
              } catch (logsError) {
                return `--- ${container} ---\n${String(logsError)}`;
              }
            })
            .join("\n");
        } catch (logsError) {
          containerLogs = String(logsError);
        }
      }
      throw new Error(`${String(error)}\n${logs.join("\n")}\n${containerLogs}`);
    }
    expect(
      checks
        .filter((check) => check.layer === "application")
        .map((check) => [check.id, check.status, check.acceptanceIds]),
    ).toEqual([
      ["deferred", "skipped", undefined],
      ["fixture", "passed", ["ACT-01", "HARNESS-01"]],
      ["pair", "skipped", ["HARNESS-03"]],
      ["browser", "passed", ["HARNESS-02"]],
    ]);
    const containers = execFileSync(
      "docker",
      ["ps", "-a", "--filter", "label=com.docker.compose.project", "--format", "{{.Names}}"],
      { encoding: "utf8" },
    );
    expect(containers).not.toContain(fixtureNames.at(-1));
  }, 300_000);

  it("skips a frontend suite with a visible reason before the frontend task", async () => {
    const checks: CheckOutcome[] = [];
    await verifyBehavior({
      dir,
      lock,
      required: { links: ["qrActivity"] },
      phase: "extensions",
      log,
      onCheck: (check) => checks.push(check),
    });
    expect(checks.find((check) => check.id === "browser")).toMatchObject({
      status: "skipped",
      acceptanceIds: ["HARNESS-02"],
      reason: expect.stringContaining("Waiting for the frontend"),
    });
    expect(checks.find((check) => check.id === "pair")).toMatchObject({
      status: "skipped",
      acceptanceIds: ["HARNESS-03"],
      reason: "Waiting for operations followQr before running this suite.",
    });
  }, 300_000);
});

/**
 * Verify project-owned qrwty adoption without touching its live Compose project or database.
 * pnpm --filter @jeeves/server exec tsx ../../packages/generator/scripts/verify-qrwty-product.ts /path/to/qrwty
 * Uses two isolated fixtures: current frontend packs/strict journey, then the protected suites.
 */
import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { ComposeFile, TestPackContext } from "../../template-kit/src/index.ts";
import { composeToYaml, createGenerateContext } from "../../template-kit/src/index.ts";
import { acceptancePath } from "../src/acceptance.ts";
import {
  assertGeneratedIntegrity,
  assertPlaywrightTests,
  fixtureCompose,
  freePort,
  verifyBehavior,
} from "../src/baseline/behavior.ts";
import { ComposeCli } from "../src/baseline/compose.ts";
import { pnpmCommand, runCommand } from "../src/exec.ts";
import { readLock } from "../src/lock.ts";
import { templateSet } from "../src/modules.ts";
import { fixtureDesign } from "../src/test-support.ts";

const source = process.argv[2] && resolve(process.argv[2]);
if (!source)
  throw new Error("Pass the qrwty checkout directory. Only a disposable copy is tested.");
const originalLock = readLock(source);
if (!originalLock?.fixedAcceptance?.some((suite) => suite.id === "browser"))
  throw new Error("Expected the generated qrwty project with protected browser acceptance.");
assertGeneratedIntegrity(source, originalLock);
const root = mkdtempSync(join(tmpdir(), "jeeves-qrwty-product-"));
const dir = join(root, "project");
const ignored = new Set([
  ".git",
  "node_modules",
  ".env",
  ".env.local",
  "dist",
  "test-results",
  "playwright-report",
]);
cpSync(source, dir, { recursive: true, filter: (path) => !ignored.has(basename(path)) });
const lock = readLock(dir);
if (!lock) throw new Error("The disposable copy has no generation lock.");
const name = `jeeves-product-${randomUUID()}`;
const file = join(root, "compose.yml");
const webPort = await freePort();
const web = `http://127.0.0.1:${webPort}`;
const fixture = fixtureCompose(
  parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile,
  lock,
  {
    publicOrigin: web,
    webPorts: { "qrwty-web": webPort },
  },
);
writeFileSync(file, composeToYaml(fixture));
const compose = new ComposeCli(dir, undefined, { file, name });
const [pnpm, ...pnpmArgs] = pnpmCommand();
const log = (line: string) => console.log(line);
let failure: unknown;
async function command(args: string[], env?: Record<string, string | undefined>) {
  const result = await runCommand(pnpm, [...pnpmArgs, ...args], {
    cwd: dir,
    onLine: log,
    timeoutMs: 300_000,
    ...(env && { inheritEnv: false, env }),
  });
  if (result.exitCode !== 0)
    throw new Error(`${args.join(" ")} failed: ${result.output.slice(-4000)}`);
  return result.output;
}
try {
  await command(["install", "--frozen-lockfile"]);
  const up = await compose.run(["up", "--build", "--wait", "--wait-timeout", "300"], log);
  if (up.exitCode !== 0)
    throw new Error(`Disposable Compose startup failed: ${up.output.slice(-4000)}`);
  const templates = templateSet();
  const context: TestPackContext = {
    projectDir: dir,
    subject: createGenerateContext(fixtureDesign("qrwty"), templates.lookup, "qrwty-web"),
    compose: fixture,
    service: (id) => compose.service(id),
    log,
  };
  for (const check of templates.module({ id: "web-app", version: "0.1.0" }).testPack.checks) {
    await check.run(context);
    log(`PASS web-app/${check.id}`);
  }
  // Exercise P12's current strict browser journey as supplemental evidence. The consumer's
  // earlier generated tests and lock stay byte-for-byte intact, even in this disposable copy.
  const supplemental = join(dir, "tests/product");
  cpSync(join(dir, "tests/acceptance/qrwty/_support"), join(supplemental, "_support"), {
    recursive: true,
  });
  cpSync(
    fileURLToPath(new URL("../../../fixtures/acceptance/qrwty/browser.test.ts", import.meta.url)),
    join(supplemental, "browser.test.ts"),
  );
  cpSync(
    fileURLToPath(new URL("../../template-kit/src/page-problems.ts", import.meta.url)),
    join(supplemental, "_support/page-problems.ts"),
  );
  const output = await command(
    [
      "exec",
      "playwright",
      "test",
      "tests/product/browser.test.ts",
      "--workers=1",
      "--reporter=line",
    ],
    {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CI: "1",
      TZ: "UTC",
      JEEVES_TEST_WEB_URL: web,
      ...(process.env.PLAYWRIGHT_BROWSERS_PATH && {
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH,
      }),
    },
  );
  assertPlaywrightTests(output);
  assertGeneratedIntegrity(dir, lock);
} catch (error) {
  failure = error;
} finally {
  const down = await compose.run(["down", "--volumes", "--remove-orphans", "--rmi", "local"], log);
  if (down.exitCode !== 0) failure = new Error(`Disposable cleanup failed: ${down.output}`);
}
try {
  if (failure) throw failure;
  log(`Protected acceptance: ${lock.fixedAcceptance?.map(acceptancePath).join(", ")}`);
  await verifyBehavior({
    dir,
    lock,
    phase: "frontend",
    required: Object.fromEntries(
      Object.entries(lock.resourceModels ?? {}).map(([id, model]) => [
        id,
        model.extensions.map((extension) => extension.operationId),
      ]),
    ),
    log,
    onCheck: (check) =>
      log(
        `${check.status.toUpperCase()} ${check.subject}/${check.id} ${check.durationMs}ms${check.error ? `\n${check.error}` : ""}`,
      ),
  });
  assertGeneratedIntegrity(source, originalLock);
  log("PASS product adoption: protected files unchanged; both fixture databases removed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}

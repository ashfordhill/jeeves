/** Prove an additive qrwty upgrade with synthetic old data in one disposable database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parse } from "yaml";
import { assertStatus, Client } from "../../../fixtures/acceptance/qrwty/_support/api.ts";
import { defaultSettings } from "../../qr-artwork/src/settings.ts";
import { type ComposeFile, composeToYaml } from "../../template-kit/src/index.ts";
import { assertGeneratedIntegrity, fixtureCompose, freePort } from "../src/baseline/behavior.ts";
import { ComposeCli } from "../src/baseline/compose.ts";
import { pnpmCommand, runCommand } from "../src/exec.ts";
import { readLock } from "../src/lock.ts";

const [oldArgument, nextArgument] = process.argv.slice(2);
if (!oldArgument || !nextArgument || process.argv.length !== 4)
  throw new Error(
    "Pass old and upgraded generated qrwty checkout paths. Live data is never read or changed.",
  );
const oldSource = resolve(oldArgument),
  nextSource = resolve(nextArgument);
assert.notEqual(oldSource, nextSource);
const oldLock = readLock(oldSource),
  nextLock = readLock(nextSource);
assert.ok(oldLock && nextLock, "Both checkouts must be generated projects");
assertGeneratedIntegrity(oldSource, oldLock);
assertGeneratedIntegrity(nextSource, nextLock);
assert.equal(
  readFileSync(join(oldSource, "docker-compose.yml"), "utf8"),
  readFileSync(join(nextSource, "docker-compose.yml"), "utf8"),
  "This upgrade proof expects unchanged deployment topology",
);
const root = mkdtempSync(join(tmpdir(), "jeeves-qrwty-upgrade-"));
const dir = join(root, "project"),
  file = join(root, "compose.yml");
const name = `jeeves-upgrade-${randomUUID()}`;
const ignored = new Set([
  ".git",
  "node_modules",
  ".env",
  ".env.local",
  "dist",
  "test-results",
  "playwright-report",
  "business-analysis",
]);
const copy = (source: string) =>
  cpSync(source, dir, { recursive: true, filter: (path) => !ignored.has(basename(path)) });
const cancellation = new AbortController();
const cancel = () => cancellation.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const [pnpm, ...prefix] = pnpmCommand();
const log = (line: string) => console.log(line);
let compose: ComposeCli | undefined;
let failure: unknown;
async function install() {
  const result = await runCommand(pnpm, [...prefix, "install", "--frozen-lockfile"], {
    cwd: dir,
    signal: cancellation.signal,
    timeoutMs: 300_000,
    onLine: log,
  });
  if (result.exitCode !== 0)
    throw new Error(`Fixture install failed: ${result.output.slice(-2000)}`);
}
async function run(...args: string[]) {
  cancellation.signal.throwIfAborted();
  assert.ok(compose, "Fixture Compose is initialized before commands run");
  const result = await compose.run(args, log);
  if (result.exitCode !== 0)
    throw new Error(`Disposable Compose failed: ${result.output.slice(-2000)}`);
  return result.output.trim();
}
async function base() {
  const address = await run("port", "qrwty", "8080");
  const port = address.split(":").at(-1);
  assert.match(port ?? "", /^\d+$/);
  return `http://127.0.0.1:${port}`;
}
async function image(client: Client, id: string) {
  const response = await client.image(id);
  assert.equal(response.status, 200);
  return Buffer.from(await response.arrayBuffer());
}
try {
  copy(oldSource);
  const origin = `http://127.0.0.1:${await freePort()}`;
  const fixture = fixtureCompose(
    parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile,
    oldLock,
    { publicOrigin: origin },
  );
  writeFileSync(file, composeToYaml(fixture));
  compose = new ComposeCli(dir, cancellation.signal, { file, name });
  await install();
  await run("up", "--build", "--wait", "--wait-timeout", "180", "qrwty");
  const alice = await Client.register(await base(), origin);
  const created = await alice.createQr("https://example.test/before-studio", "Existing printed QR");
  assertStatus(created, 201);
  const id = (created.body as { id: string }).id;
  const originalImage = await image(alice, id);
  for (let i = 0; i < 2; i++)
    assertStatus(await alice.get(`/q/${id}`, { redirect: "manual" }), 302);
  const from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const activityPath = `/api/qr/${id}/activity?from=${from}&to=${to}`;
  const activity = await alice.get(activityPath);
  assertStatus(activity, 200);
  assert.equal((activity.body as { total: number }).total, 2);
  const databaseBefore = await run("ps", "--quiet", "qrwty-db");
  await run("stop", "qrwty");
  copy(nextSource);
  assertGeneratedIntegrity(dir, nextLock);
  await install();
  await run("up", "--no-deps", "--build", "--wait", "--wait-timeout", "180", "qrwty");
  assert.equal(
    await run("ps", "--quiet", "qrwty-db"),
    databaseBefore,
    "Upgrade must retain the same fixture database",
  );
  const resumed = new Client(await base(), origin);
  resumed.cookie = alice.cookie;
  resumed.csrfToken = alice.csrfToken;
  assertStatus(await resumed.get("/auth/session"), 200);
  const retained = await resumed.get(`/api/qr/${id}`);
  assertStatus(retained, 200);
  assert.deepEqual(retained.body, created.body);
  assert.deepEqual((await resumed.get(activityPath)).body, activity.body);
  assert.deepEqual(await image(resumed, id), originalImage);
  const studio = await resumed.get(`/api/qr/${id}/studio`);
  assertStatus(studio, 200);
  assert.equal((studio.body as { canonicalUrl: string }).canonicalUrl, `${origin}/q/${id}`);
  assert.deepEqual((studio.body as { items: unknown[] }).items, []);
  const saved = await resumed.post(`/api/qr/${id}/artwork`, {
    requestId: randomUUID(),
    settings: { ...defaultSettings },
  });
  assertStatus(saved, 201);
  assertStatus(
    await resumed.updateQr(id, "https://example.test/after-studio", "Still the same QR"),
    200,
  );
  assert.deepEqual(await image(resumed, id), originalImage);
  const redirect = await resumed.get(`/q/${id}`, { redirect: "manual" });
  assertStatus(redirect, 302);
  assert.equal(redirect.headers.get("location"), "https://example.test/after-studio");
  assertGeneratedIntegrity(oldSource, oldLock);
  assertGeneratedIntegrity(nextSource, nextLock);
  log(
    "PASS upgrade: old QR identity, data, two scans, session and legacy PNG retained; new revision saves; destination changes preserve printed output.",
  );
} catch (error) {
  failure = error;
} finally {
  let cleaned = true;
  if (compose) {
    const down = await new ComposeCli(dir, undefined, { file, name }).run(
      ["down", "--volumes", "--remove-orphans", "--rmi", "local"],
      log,
    );
    cleaned = down.exitCode === 0;
    if (!cleaned)
      failure = new Error(
        `Cleanup failed; fixture retained at ${root}: ${down.output.slice(-2000)}`,
      );
  }
  if (cleaned) rmSync(root, { recursive: true, force: true });
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}
if (failure) throw failure;

/** P35: compiled generated apps, real browser cookies, disposable databases only. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ComposeFile, composeToYaml, createGenerateContext } from "@jeeves/template-kit";
import { observePageProblems, type PageProblems, withPage } from "@jeeves/template-kit/browser";
import { expect, type Page } from "@playwright/test";
import { parse } from "yaml";
import { seedPlan } from "../../orchestrator/src/seed.ts";
import { assertGeneratedIntegrity, fixtureCompose, freePort } from "../src/baseline/behavior.ts";
import { ComposeCli } from "../src/baseline/compose.ts";
import { pnpmCommand, runCommand } from "../src/exec.ts";
import { generateProject } from "../src/generate.ts";
import { templateSet } from "../src/modules.ts";
import { createStarterDesign } from "../src/starters.ts";

if (process.argv.length !== 2) throw new Error("session-isolation takes no arguments");
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "jeeves-session-isolation-"));
const evidence = join(repository, ".jeeves-work/evidence/p35");
const cancellation = new AbortController();
let closeBrowser: (() => Promise<void>) | undefined;
const cancel = () => {
  cancellation.abort();
  void closeBrowser?.().catch(() => {});
};
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const log = (line: string) => console.log(line);
const templates = templateSet();
const deployments: { dir: string; isolation: { file: string; name: string } }[] = [];
const [pnpm, ...prefix] = pnpmCommand();
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const nameOf = (origin: string) => `jeeves_session_${sha(new URL(origin).origin).slice(0, 32)}`;
// These credentials exist only in disposable storage; never print cookies, bodies or passwords.
const password = `fixture-${randomUUID()}`;
const email = "owner@example.test";

async function prepare(label: string, port: number, version: string) {
  const dir = join(scratch, label),
    origin = `http://127.0.0.1:${port}`;
  const design = createStarterDesign(
    { id: "resource-workspace", version: "0.1.0" },
    { title: `Session ${label}`, hostPort: port },
  ).design;
  design.elements
    .find((e) => e.id === "inventory")!
    .attachments.find((a) => a.template.id === "rest-api-server")!.template.version = version;
  cancellation.signal.throwIfAborted();
  const generated = await generateProject({
    dir,
    design,
    projectName: `Session ${label}`,
    git: false,
    log,
  });
  if (!generated.ok) throw new Error(`Generation refused ${label}`);
  assert.equal(seedPlan({ design, lock: generated.lock, templates: templates.lookup }).length, 0);
  const runtimeVersion = version === "0.1.0" ? "0.2.0" : "0.3.0";
  const releaseRoot = join(repository, "artifacts/rest-server", runtimeVersion);
  const manifest = JSON.parse(readFileSync(join(releaseRoot, "manifest.json"), "utf8"));
  assert.equal(sha(readFileSync(join(dir, "vendor/jeeves", manifest.archive))), manifest.sha256);
  const environment = readFileSync(join(dir, ".env"));
  const extra = join(dir, "frontends/inventory-web/src/project/ProjectExtras.tsx");
  const extraSource =
    "export function ProjectExtras() { return <p>Disposable session proof</p>; }\n";
  writeFileSync(extra, extraSource);
  for (const args of [
    ["install", "--no-frozen-lockfile"],
    ["-r", "--no-bail", "typecheck"],
    ["--filter", "inventory-web", "build"],
  ]) {
    const result = await runCommand(pnpm, [...prefix, ...args], {
      cwd: dir,
      signal: cancellation.signal,
      timeoutMs: 300000,
      onLine: log,
    });
    if (result.exitCode !== 0) throw new Error(`${label}: consumer ${args.join(" ")} failed`);
  }
  assertGeneratedIntegrity(dir, generated.lock);
  const again = await generateProject({
    dir,
    design,
    projectName: `Session ${label}`,
    git: false,
  });
  if (!again.ok) throw new Error(`${label}: regeneration refused`);
  assert.equal(readFileSync(extra, "utf8"), extraSource);
  assert.ok(readFileSync(join(dir, ".env")).equals(environment), "Private environment retained");
  assertGeneratedIntegrity(dir, again.lock);
  log(
    `PASS ${label}: compiled ${runtimeVersion}, build/types, zero implementation tasks, regeneration/ownership/private setup`,
  );
  return { dir, origin, port, design, generated: again };
}
type Application = Awaited<ReturnType<typeof prepare>>;
async function start(app: Application) {
  const source = parse(readFileSync(join(app.dir, "docker-compose.yml"), "utf8")) as ComposeFile;
  const isolated = fixtureCompose(source, app.generated.lock, {
    publicOrigin: app.origin,
    webPorts: { "inventory-web": app.port },
  });
  const isolation = {
    file: join(scratch, `${app.port}.compose.yml`),
    name: `jeeves-p35-${randomUUID()}`,
  };
  writeFileSync(isolation.file, composeToYaml(isolated), { mode: 0o600 });
  deployments.push({ dir: app.dir, isolation });
  const compose = new ComposeCli(app.dir, cancellation.signal, isolation);
  const up = await compose.run(["up", "--build", "--wait", "--wait-timeout", "300"], log);
  if (up.exitCode !== 0) throw new Error("Disposable application startup failed");
  // Passive existing REST checks: the generated route contract and handler coverage.
  const subject = createGenerateContext(app.design, templates.lookup, "inventory", "inventory-api");
  const pack = templates.module(subject.attachment!.template).testPack;
  for (const check of pack.checks.filter((check) =>
    ["openapi-served", "handlers"].includes(check.id),
  )) {
    await check.run({
      projectDir: app.dir,
      subject,
      compose: isolated,
      service: (id) => compose.service(id),
      log,
    });
    log(`PASS ${subject.manifest.version} REST ${check.id}`);
  }
  return { compose, isolated, isolation };
}
const api = (app: Application) => `${app.origin}/_api/inventory`;
async function anonymous(page: Page, problems: PageProblems, app: Application) {
  const expected = problems.expectHttp({
    scenario: "anonymous application session",
    method: "GET",
    url: `${api(app)}/auth/session`,
    resourceType: "fetch",
    status: 401,
  });
  await page.goto(app.origin);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  expected.finish();
}
async function signIn(page: Page, register: boolean, address = email) {
  if (register) await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(address);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: register ? "Create account" : "Sign in", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}
async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
}
async function createRecord(page: Page, name: string) {
  await page.getByRole("button", { name: "New record", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "New Warehouse", exact: true });
  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByRole("button", { name: "Save record", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: `View ${name}`, exact: true })).toBeVisible();
}
async function retained(page: Page, name: string) {
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `View ${name}`, exact: true })).toBeVisible();
}
async function session(page: Page, app: Application) {
  const response = await page.request.get(`${api(app)}/auth/session`);
  assert.equal(response.status(), 200);
  return (await response.json()) as { id: string; csrfToken: string };
}
async function row(page: Page, app: Application, name: string) {
  const response = await page.request.get(`${api(app)}/api/warehouse?limit=10`);
  assert.equal(response.status(), 200);
  const body = (await response.json()) as { items: { id: string; name: string }[] };
  const found = body.items.find((item) => item.name === name);
  assert.ok(found, "Owned record survives");
  return found;
}
async function schemaIdentity(compose: ComposeCli) {
  // The actual table OIDs must survive the transition; no drop/recreation or reset.
  const result = await compose
    .service("inventory-db")
    .exec([
      "psql",
      "-U",
      "postgres",
      "-d",
      "inventory",
      "-Atc",
      "SELECT relname, oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname",
    ]);
  assert.equal(result.exitCode, 0);
  assert.ok(result.output.includes("app_user"));
  return result.output;
}

let failure: unknown,
  cleanupFailed = false;
try {
  const ports = new Set<number>();
  while (ports.size < 3) ports.add(await freePort());
  const [portA, portB, portLegacy] = [...ports] as [number, number, number];
  const a = await prepare("A", portA, "0.2.0");
  const b = await prepare("B", portB, "0.2.0");
  const old = await prepare("legacy", portLegacy, "0.1.0");
  const adopted = await prepare("transition", portLegacy, "0.2.0");
  // Independent generated outputs have the exact same immutable storage definitions.
  for (const [path, hash] of Object.entries(old.generated.lock.files).filter(([path]) =>
    path.includes("resource-migrations/"),
  ))
    assert.equal(adopted.generated.lock.files[path], hash);
  const runningA = await start(a);
  await start(b);
  const runningOld = await start(old);
  await withPage(
    async (pageA, problemsA) => {
      const context = pageA.context();
      closeBrowser = () => context.browser()!.close();
      cancellation.signal.throwIfAborted();
      const pageB = await context.newPage(),
        pageLegacy = await context.newPage();
      const problemsB = observePageProblems(pageB),
        problemsLegacy = observePageProblems(pageLegacy);
      log(
        `Browser: Playwright 1.63.0 / Firefox ${context.browser()!.version()}; one shared context for A, B and legacy`,
      );
      await anonymous(pageLegacy, problemsLegacy, old);
      await signIn(pageLegacy, true);
      await createRecord(pageLegacy, "Legacy record");
      const legacyIdentity = await session(pageLegacy, old);
      const oldRecord = await row(pageLegacy, old, "Legacy record");
      const legacyCookie = (await context.cookies()).find((c) => c.name === "jeeves_session")!;
      assert.ok(legacyCookie, "Legacy runtime sets the original cookie");
      await anonymous(pageA, problemsA, a);
      await signIn(pageA, true);
      await createRecord(pageA, "Application A record");
      const identityA = await session(pageA, a);
      const recordA = await row(pageA, a, "Application A record");
      await anonymous(pageB, problemsB, b);
      await signIn(pageB, true);
      await createRecord(pageB, "Application B record");
      const identityB = await session(pageB, b);
      await retained(pageA, "Application A record");
      await retained(pageB, "Application B record");
      const cookies = await context.cookies();
      assert.deepEqual(
        cookies.map((c) => c.name).sort(),
        [nameOf(a.origin), nameOf(b.origin), "jeeves_session"].sort(),
      );
      for (const cookie of cookies) {
        assert.ok(cookie.httpOnly && cookie.sameSite === "Strict" && cookie.path === "/");
        assert.ok(cookie.expires > Date.now() / 1000 + 6 * 24 * 60 * 60);
      }
      const cookieA = cookies.find((c) => c.name === nameOf(a.origin))!;
      await signOut(pageB);
      assert.ok(
        (await context.cookies()).find((c) => c.name === cookieA.name)?.value === cookieA.value,
        "B logout preserves A cookie",
      );
      await retained(pageA, "Application A record");
      const incorrect = problemsB.expectHttp({
        scenario: "incorrect returning account password",
        method: "POST",
        url: `${api(b)}/auth/login`,
        resourceType: "fetch",
        status: 401,
      });
      await pageB.getByLabel("Email", { exact: true }).fill(email);
      await pageB.getByLabel("Password", { exact: true }).fill("incorrect-fixture-password");
      await pageB.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(pageB.getByRole("alert")).toContainText("Email or password was not recognized.");
      incorrect.finish();
      await signIn(pageB, false);
      assert.equal((await session(pageB, b)).id, identityB.id);
      await retained(pageB, "Application B record");
      const cookieB = (await context.cookies()).find((c) => c.name === nameOf(b.origin))!;
      await signOut(pageA);
      assert.ok(
        (await context.cookies()).find((c) => c.name === cookieB.name)?.value === cookieB.value,
        "A logout preserves B cookie",
      );
      await retained(pageB, "Application B record");
      await signIn(pageA, false);
      assert.equal((await session(pageA, a)).id, identityA.id);
      await retained(pageA, "Application A record");
      await retained(pageLegacy, "Legacy record");
      assert.ok(
        (await context.cookies()).find((c) => c.name === "jeeves_session")?.value ===
          legacyCookie.value,
        "New registration/login/logout leave legacy cookie intact",
      );
      log(
        "PASS same-browser two-way registration/login/refresh/logout isolation; existing-account re-login retains distinct data; legacy cookie unaffected",
      );

      const current = await session(pageA, a);
      const deniedHeaders: Record<string, string>[] = [
        { Origin: a.origin },
        { Origin: a.origin, "X-CSRF-Token": "wrong" },
        { Origin: b.origin, "X-CSRF-Token": current.csrfToken },
        { "X-CSRF-Token": current.csrfToken },
      ];
      for (const headers of deniedHeaders) {
        assert.equal(
          (await pageA.request.post(`${api(a)}/auth/logout`, { headers })).status(),
          403,
        );
        assert.equal(
          (
            await pageA.request.post(`${api(a)}/api/warehouse`, {
              headers,
              data: { name: "Forbidden" },
            })
          ).status(),
          403,
        );
      }
      assert.equal(
        (
          await pageA.request.post(`${api(a)}/auth/login`, {
            headers: { Origin: b.origin },
            data: { email, password },
          })
        ).status(),
        403,
      );
      assert.equal(
        (
          await pageA.request.post(`${api(a)}/auth/register`, {
            headers: { Origin: b.origin },
            data: { email, password },
          })
        ).status(),
        403,
      );
      const privateContext = await context.browser()!.newContext();
      try {
        const visitor = await privateContext.newPage(),
          visitorProblems = observePageProblems(visitor);
        await anonymous(visitor, visitorProblems, a);
        await anonymous(visitor, visitorProblems, b);
        await anonymous(visitor, visitorProblems, a);
        await signIn(visitor, true, "second-owner@example.test");
        await expect(
          visitor.getByRole("heading", { name: "No warehouses yet", exact: true }),
        ).toBeVisible();
        assert.equal(
          (await visitor.request.get(`${api(a)}/api/warehouse/${recordA.id}`)).status(),
          404,
        );
        const second = await session(visitor, a);
        assert.equal(
          (
            await visitor.request.patch(`${api(a)}/api/warehouse/${recordA.id}`, {
              headers: { Origin: a.origin, "X-CSRF-Token": second.csrfToken },
              data: { name: "Forbidden" },
            })
          ).status(),
          404,
        );
        visitorProblems.assert("Private context and cross-owner access");
      } finally {
        await privateContext.close();
      }
      await retained(pageA, "Application A record");
      log(
        "PASS ordinary authentication: incorrect credentials, anonymous private context, missing/wrong CSRF, wrong/missing Origin and cross-owner read/write refusal",
      );

      const beforeRestart = (await context.cookies()).find((c) => c.name === nameOf(a.origin))!;
      await runningA.compose.service("inventory").restart();
      await retained(pageA, "Application A record");
      assert.ok(
        (await context.cookies()).find((c) => c.name === beforeRestart.name)?.value ===
          beforeRestart.value,
        "Same-origin restart preserves session cookie",
      );
      assert.equal((await session(pageA, a)).id, identityA.id);
      log(
        "PASS API service restart preserves current browser session and data at the same public origin",
      );

      const beforeSchema = await schemaIdentity(runningOld.compose);
      // Change only this disposable fixture's API image build source. Keep its origin,
      // database, volume, credentials and frontend. Neither generated output is edited.
      const build = runningOld.isolated.services.inventory!.build;
      assert.ok(build && typeof build === "object");
      runningOld.isolated.services.inventory!.build = { ...build, context: adopted.dir };
      writeFileSync(runningOld.isolation.file, composeToYaml(runningOld.isolated), { mode: 0o600 });
      const switched = await runningOld.compose.run(
        ["up", "--build", "--no-deps", "--wait", "--wait-timeout", "180", "inventory"],
        log,
      );
      assert.equal(switched.exitCode, 0);
      assert.equal(await schemaIdentity(runningOld.compose), beforeSchema);
      await anonymous(pageLegacy, problemsLegacy, adopted);
      assert.ok(
        (await context.cookies()).find((c) => c.name === "jeeves_session")?.value ===
          legacyCookie.value,
        "Transition does not clear legacy cookie",
      );
      await signIn(pageLegacy, false);
      assert.equal((await session(pageLegacy, adopted)).id, legacyIdentity.id);
      assert.equal((await row(pageLegacy, adopted, "Legacy record")).id, oldRecord.id);
      await retained(pageLegacy, "Legacy record");
      await signOut(pageLegacy);
      assert.ok(
        (await context.cookies()).find((c) => c.name === "jeeves_session")?.value ===
          legacyCookie.value,
        "New logout does not expire legacy cookie",
      );
      await retained(pageA, "Application A record");
      await retained(pageB, "Application B record");
      log(
        "PASS legacy-to-current transition: same origin/storage/table OIDs, legacy cookie anonymous, ordinary login retains account/resource IDs, logout leaves legacy cookie untouched",
      );
      mkdirSync(evidence, { recursive: true });
      await pageA.screenshot({ path: join(evidence, "application-a.png") });
      await pageB.screenshot({ path: join(evidence, "application-b.png") });
      for (const [problems, label] of [
        [problemsA, "A"],
        [problemsB, "B"],
        [problemsLegacy, "legacy transition"],
      ] as const)
        problems.assert(`P35 strict browser diagnostics: ${label}`);
      assertGeneratedIntegrity(a.dir, a.generated.lock);
      assertGeneratedIntegrity(b.dir, b.generated.lock);
      assertGeneratedIntegrity(old.dir, old.generated.lock);
      assertGeneratedIntegrity(adopted.dir, adopted.generated.lock);
    },
    { browser: "firefox" },
  );
} catch (error) {
  failure = error;
} finally {
  for (const deployment of deployments.reverse()) {
    try {
      const result = await new ComposeCli(deployment.dir, undefined, deployment.isolation).run(
        ["down", "--volumes", "--remove-orphans", "--rmi", "local"],
        log,
      );
      assert.equal(result.exitCode, 0, "Disposable cleanup command succeeded");
      for (const kind of ["container", "volume", "network"]) {
        const listed = await runCommand(
          "docker",
          [
            kind,
            "ls",
            "--quiet",
            "--filter",
            `label=com.docker.compose.project=${deployment.isolation.name}`,
          ],
          { cwd: repository },
        );
        assert.equal(listed.exitCode, 0, "Disposable cleanup inventory succeeded");
        assert.equal(listed.output.trim(), "", "No disposable Docker resources remain");
      }
    } catch (error) {
      cleanupFailed = true;
      failure = new AggregateError(
        [failure, error].filter(Boolean),
        `Cleanup failed; inspect ${scratch}`,
      );
    }
  }
  if (!cleanupFailed) {
    rmSync(scratch, { recursive: true, force: true });
    log(
      "PASS disposable containers, volumes, networks, local images and generated directories removed",
    );
  }
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}
if (failure) throw failure;
log(
  "PASS P35 session isolation; no live application or database modified, no implementation-model calls",
);

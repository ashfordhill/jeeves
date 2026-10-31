/** Compiled pool component around a real generated API; fixture topology, never live generation. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type ComposeFile, composeToYaml } from "@jeeves/template-kit";
import { withPage } from "@jeeves/template-kit/browser";
import { parse } from "yaml";
import type { createHttpPool as CreateHttpPool } from "../../http-pool/src/index.ts";
import { seedPlan } from "../../orchestrator/src/seed.ts";
import { proveResourceWorkspace } from "../../resource-workspace/conformance/browser-proof.ts";
import { assertGeneratedIntegrity, fixtureCompose, freePort } from "../src/baseline/behavior.ts";
import { ComposeCli } from "../src/baseline/compose.ts";
import { pnpmCommand, runCommand } from "../src/exec.ts";
import { generateProject } from "../src/generate.ts";
import { templateSet } from "../src/modules.ts";
import { createStarterDesign } from "../src/starters.ts";

if (process.argv.length > 2) throw new Error("Local HTTP pool proof takes no arguments");
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "jeeves-http-pool-")),
  dir = join(scratch, "app"),
  tooling = join(scratch, "tooling");
const cancel = new AbortController(),
  stop = () => cancel.abort();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const log = (line: string) => console.log(line);
const artifactRoot = join(repository, "artifacts/http-pool/0.1.0");
const manifest = JSON.parse(readFileSync(join(artifactRoot, "manifest.json"), "utf8"));
const archive = join(artifactRoot, manifest.archive);
if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== manifest.sha256)
  throw new Error("Pool archive hash mismatch");
const [pnpm, ...prefix] = pnpmCommand();
async function command(args: string[], cwd = dir) {
  const result = await runCommand(pnpm, [...prefix, ...args], {
    cwd,
    timeoutMs: 300000,
    signal: cancel.signal,
    onLine: log,
  });
  if (result.exitCode !== 0) throw new Error(`Consumer ${args.join(" ")} failed`);
}
let compose: ComposeCli | undefined,
  isolation: { file: string; name: string } | undefined,
  failure: unknown,
  cleanupFailed = false;
const webPort = await freePort(),
  origin = `http://127.0.0.1:${webPort}`;
const design = createStarterDesign(
  { id: "resource-workspace", version: "0.1.0" },
  { title: "Fieldwork", hostPort: webPort },
).design;
try {
  mkdirSync(tooling);
  writeFileSync(
    join(tooling, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { "@jeeves/http-pool": `file:${archive}` },
    }),
  );
  await command(["install", "--no-frozen-lockfile"], tooling);
  const { createHttpPool } = (await import(
    pathToFileURL(join(tooling, "node_modules/@jeeves/http-pool/dist/index.js")).href
  )) as { createHttpPool: typeof CreateHttpPool };
  const pool = createHttpPool({ serviceId: "inventory", replicas: 2 });
  let generated = await generateProject({
    dir,
    design,
    projectName: "Pool resource proof",
    git: false,
    log,
  });
  if (!generated.ok) throw new Error(JSON.stringify(generated.problems));
  if (seedPlan({ design, lock: generated.lock, templates: templateSet().lookup }).length)
    throw new Error("Unexpected implementation tasks");
  const feature = join(dir, "services/inventory/src/features/pool-proof/index.ts");
  mkdirSync(dirname(feature), { recursive: true });
  writeFileSync(
    feature,
    readFileSync(join(repository, "packages/http-pool/conformance/proof-feature.ts.txt")),
  );
  writeFileSync(
    join(dir, "frontends/inventory-web/src/project/ProjectExtras.tsx"),
    "export function ProjectExtras() { return <p>Fieldwork inventory help · project content</p>; }\n",
  );
  await command(["install", "--no-frozen-lockfile"]);
  await command(["-r", "--no-bail", "typecheck"]);
  const configuration = join(dir, pool.configurationPath);
  mkdirSync(dirname(configuration), { recursive: true });
  writeFileSync(configuration, pool.configuration);
  const file = fixtureCompose(
    parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile,
    generated.lock,
    { publicOrigin: origin, webPorts: { "inventory-web": webPort } },
  );
  const base = file.services.inventory;
  if (!base?.environment) throw new Error("Generated API is absent");
  for (const name of pool.descriptor.instances) file.services[name] = structuredClone(base);
  // This P31 consumer applies the component explicitly after ordinary generation. P32 owns diagram integration.
  file.services.inventory = pool.proxyCompose;
  delete file.services.inventory.restart;
  isolation = { file: join(scratch, "compose.yml"), name: `jeeves-http-pool-${randomUUID()}` };
  writeFileSync(isolation.file, composeToYaml(file), { mode: 0o600 });
  compose = new ComposeCli(dir, cancel.signal, isolation);
  const syntax = await compose.run(
    [
      "run",
      "--rm",
      "--no-deps",
      "--entrypoint",
      "haproxy",
      "inventory",
      "-c",
      "-f",
      "/usr/local/etc/haproxy/haproxy.cfg",
    ],
    log,
  );
  if (syntax.exitCode !== 0) throw new Error("Proxy configuration rejected");
  if ((await compose.run(["up", "--build", "--wait", "--wait-timeout", "180"], log)).exitCode !== 0)
    throw new Error("Pool consumer startup failed");
  const instanceNames = pool.descriptor.instances;
  const api = async (name = "inventory") => {
    const address = await compose!.service(name).endpoint(8080);
    return `http://${address.host}:${address.port}`;
  };
  const fetchAt = async (name: string, path: string, init: RequestInit = {}) =>
    fetch(`${await api(name)}${path}`, {
      ...init,
      signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(12000)]),
    });
  const responseObject = async (response: Response): Promise<Record<string, unknown>> => {
    const value: unknown = await response.json();
    assert.ok(
      value !== null && typeof value === "object" && !Array.isArray(value),
      "Expected response object",
    );
    return value as Record<string, unknown>;
  };
  const json = async (name: string, path: string, init: RequestInit = {}) => {
    const response = await fetchAt(name, path, init);
    assert.equal(response.status, 200);
    return responseObject(response);
  };
  const eventually = async (check: () => Promise<boolean>, message: string) => {
    const deadline = Date.now() + 18000;
    while (!(await check())) {
      if (Date.now() >= deadline) throw new Error(message);
      await delay(200, undefined, { signal: cancel.signal });
    }
  };
  const body = (data: unknown): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(data),
  });
  const instanceIds = await Promise.all(
    instanceNames.map(async (name) => (await json(name, "/proof/id")).instance as string),
  );
  const observed = new Set<string>();
  for (let i = 0; i < 8; i++) observed.add(String((await json("inventory", "/proof/id")).instance));
  assert.deepEqual([...observed].sort(), [...instanceIds].sort());
  const forwarded = await json("inventory", "/proof/id", {
    headers: { "x-forwarded-for": "203.0.113.1", origin, "x-request-id": "pool-request-proof" },
  });
  assert.equal(forwarded.forwarded, null);
  assert.equal(forwarded.origin, origin);
  assert.equal(forwarded.requestId, "pool-request-proof");
  log(
    "PASS both generated instances receive HTTP requests; untrusted forwarding is removed and Origin/request ID survive",
  );
  const sql = async (statement: string) => {
    const result = await compose!
      .service("inventory-db")
      .exec([
        "psql",
        "-U",
        base.environment!.DATABASE_USER!,
        "-d",
        base.environment!.DATABASE_NAME!,
        "-tAc",
        statement,
      ]);
    assert.equal(result.exitCode, 0);
    return result.output.trim();
  };
  const migrationCount = Number(await sql("SELECT count(*) FROM jeeves_resource_migrations"));
  assert.equal(
    migrationCount,
    JSON.parse(
      readFileSync(join(dir, "services/inventory/resource-migrations/manifest.json"), "utf8"),
    ).length,
  );
  await sql("CREATE TABLE pool_proof_effects (id bigserial PRIMARY KEY, token text NOT NULL)");
  const register = async (suffix: string) => {
    const response = await fetchAt(
      "inventory",
      "/auth/register",
      body({
        email: `${suffix}-${randomUUID()}@example.test`,
        password: "pool-proof-password-123",
      }),
    );
    assert.equal(response.status, 201);
    const cookie = response.headers.get("set-cookie")?.split(";")[0],
      value = await responseObject(response);
    if (!cookie || typeof value.csrfToken !== "string")
      throw new Error("Session credentials missing");
    return {
      headers: {
        cookie,
        origin,
        "x-csrf-token": value.csrfToken,
        "content-type": "application/json",
      },
      id: value.id,
    };
  };
  const owner = await register("owner"),
    stranger = await register("stranger");
  for (const name of instanceNames) {
    const session = await json(name, "/auth/session", { headers: owner.headers });
    assert.equal(session.id, owner.id);
  }
  const created = await fetchAt("inventory", "/api/warehouse", {
    ...body({ name: "Shared warehouse" }),
    headers: owner.headers,
  });
  assert.equal(created.status, 201);
  const record = await responseObject(created);
  for (const name of instanceNames) {
    assert.equal(
      (await json(name, `/api/warehouse/${record.id}`, { headers: owner.headers })).name,
      "Shared warehouse",
    );
    assert.equal(
      (await fetchAt(name, `/api/warehouse/${record.id}`, { headers: stranger.headers })).status,
      404,
    );
  }
  log("PASS shared migrations, cross-instance session/resource continuity and owner isolation");
  const token = randomUUID();
  assert.equal(
    (await fetchAt("inventory", "/proof/commit-then-drop", body({ token }))).status,
    502,
  );
  assert.equal(
    Number(await sql(`SELECT count(*) FROM pool_proof_effects WHERE token='${token}'`)),
    1,
  );
  log(
    "PASS a committed then disconnected mutation produces one database effect, with no proxy replay",
  );
  const first = instanceNames[0]!,
    second = instanceNames[1]!;
  await json(first, "/proof/readiness", body({ ready: false }));
  await eventually(
    async () =>
      (await json("inventory", "/proof/id")).instance === instanceIds[1] &&
      (await json("inventory", "/proof/id")).instance === instanceIds[1],
    "Unready peer remained in routing",
  );
  for (let i = 0; i < 6; i++)
    assert.equal((await json("inventory", "/proof/id")).instance, instanceIds[1]);
  assert.equal((await fetchAt(first, "/ready")).status, 503);
  await json(second, "/proof/readiness", body({ ready: false }));
  await eventually(
    async () => (await fetchAt("inventory", "/ready")).status === 503,
    "Pool stayed ready with no ready peer",
  );
  const unavailableStarted = Date.now();
  assert.equal((await fetchAt("inventory", "/proof/id")).status, 503);
  assert.ok(Date.now() - unavailableStarted < 4000);
  assert.equal((await fetchAt("inventory", "/health")).status, 200);
  await json(first, "/proof/readiness", body({ ready: true }));
  await json(second, "/proof/readiness", body({ ready: true }));
  await eventually(
    async () => (await fetchAt("inventory", "/ready")).status === 200,
    "Readiness did not recover",
  );
  await eventually(async () => {
    const one = await json("inventory", "/proof/id");
    const two = await json("inventory", "/proof/id");
    return new Set([one.instance, two.instance]).size === 2;
  }, "Both ready peers did not rejoin routing");
  log(
    "PASS running unready peers are excluded; all peers unready gives bounded 503 while proxy health stays distinct",
  );
  assert.equal((await compose.service(first).stop()).exitCode, 0);
  await eventually(async () => {
    // Only this intentional-loss GET probe may observe the documented health-detection window.
    for (let attempt = 0; attempt < 4; attempt++) {
      let response: Response;
      try {
        response = await fetchAt("inventory", "/proof/id");
      } catch (error) {
        if (error instanceof TypeError && error.message === "fetch failed") return false;
        throw error;
      }
      if (response.status === 502 || response.status === 503) return false;
      assert.equal(response.status, 200);
      if ((await responseObject(response)).instance !== instanceIds[1]) return false;
    }
    return true;
  }, "Stopped peer did not leave routing");
  assert.equal(
    (await json("inventory", `/api/warehouse/${record.id}`, { headers: owner.headers })).name,
    "Shared warehouse",
  );
  if ((await compose.run(["up", "-d", "--force-recreate", "--no-deps", first], log)).exitCode !== 0)
    throw new Error("Peer recreation failed");
  await compose.waitHealthy(first);
  const replacement = (await json(first, "/proof/id")).instance;
  assert.notEqual(replacement, instanceIds[0]);
  await eventually(
    async () => (await json("inventory", "/proof/id")).instance === replacement,
    "Recreated peer did not rejoin through DNS",
  );
  assert.equal(
    Number(await sql("SELECT count(*) FROM jeeves_resource_migrations")),
    migrationCount,
  );
  log(
    "PASS stopped/recreated peer recovers through Docker DNS; session data and migration history remain shared",
  );
  const proxyId = await compose.containerId("inventory");
  const inspected = await runCommand(
    "docker",
    [
      "inspect",
      "--format",
      '[{{.HostConfig.NanoCpus}},{{.HostConfig.Memory}},{{.HostConfig.PidsLimit}},{{.HostConfig.ReadonlyRootfs}},{{.HostConfig.Init}},"{{.Config.StopSignal}}",{{.Config.StopTimeout}}]',
      proxyId,
    ],
    { cwd: dir, signal: cancel.signal, timeoutMs: 10000 },
  );
  assert.equal(inspected.exitCode, 0);
  assert.deepEqual(JSON.parse(inspected.output.trim()), [
    500000000,
    134217728,
    64,
    true,
    true,
    "SIGUSR1",
    35,
  ]);
  log("PASS installed proxy CPU/memory/PID/read-only/init/soft-stop/grace settings");
  await withPage(async (page, problems) => {
    const groups = await proveResourceWorkspace(
      page,
      problems,
      origin,
      join(repository, ".jeeves-work/evidence/p31"),
      {
        stateLabel: "State",
        beforePaper: async () => {
          design.elements
            .find((element) => element.id === "inventory-web")!
            .attachments.find(
              (attachment) => attachment.template.id === "resource-workspace",
            )!.config.preset = "paper";
          const next = await generateProject({
            dir,
            design,
            projectName: "Pool resource proof",
            git: false,
            log,
          });
          if (!next.ok) throw new Error("Paper regeneration failed");
          generated = next;
          if (
            (
              await compose!.run(
                ["up", "-d", "--build", "--no-deps", "--wait", "inventory-web"],
                log,
              )
            ).exitCode !== 0
          )
            throw new Error("Paper frontend rebuild failed");
        },
      },
    );
    log(`PASS strict resource browser journey through pool: ${groups.join(", ")}`);
  });
  const slow = json("inventory", "/proof/slow", { headers: { connection: "close" } });
  await eventually(
    async () =>
      (await Promise.all(instanceNames.map((name) => json(name, "/proof/state")))).some(
        (value) => value.slowStarted,
      ),
    "Slow request did not enter a backend",
  );
  const stopping = Date.now();
  assert.equal((await compose.run(["stop", "inventory"], log)).exitCode, 0);
  assert.deepEqual(await slow, { completed: true });
  assert.ok(Date.now() - stopping < 35000);
  log("PASS proxy SIGUSR1 drains in-flight response within installed grace");
  if (!generated.ok) throw new Error("Missing generated state");
  assertGeneratedIntegrity(dir, generated.lock);
  assert.equal(createHash("sha256").update(readFileSync(archive)).digest("hex"), manifest.sha256);
  log(
    "PASS compiled local HTTP pool proof; zero implementation-model calls; fixture composition only",
  );
} catch (error) {
  failure = error;
} finally {
  if (isolation) {
    const result = await new ComposeCli(dir, undefined, isolation).run(
      ["down", "--volumes", "--remove-orphans", "--rmi", "local"],
      log,
    );
    if (result.exitCode !== 0) {
      cleanupFailed = true;
      failure = new Error(`Cleanup failed; inspect ${scratch}`);
    }
  }
  if (!cleanupFailed) rmSync(scratch, { recursive: true, force: true });
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
if (failure) throw failure;

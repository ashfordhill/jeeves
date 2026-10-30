import { randomUUID } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ComposeFile, composeToYaml, databasePasswordEnv } from "@jeeves/template-kit";
import { parse } from "yaml";
import { acceptanceCoverageProblems, acceptancePath } from "../acceptance.ts";
import { pnpmCommand, runCommand } from "../exec.ts";
import { hashContents, type Lock } from "../lock.ts";
import { ComposeCli } from "./compose.ts";
import type { CheckOutcome } from "./index.ts";

/** Reject missing, edited, and symlinked expectations before any application tests run. */
export function assertGeneratedIntegrity(dir: string, lock: Lock): void {
  for (const [path, hash] of Object.entries(lock.files)) {
    let current = dir;
    for (const part of path.split("/")) {
      if (!part || part === "." || part === "..") throw new Error(`Unsafe generated path ${path}`);
      current = join(current, part);
      if (lstatSync(current).isSymbolicLink())
        throw new Error(`Protected artifact is a symlink: ${path}`);
    }
    if (hashContents(readFileSync(join(dir, path))) !== hash)
      throw new Error(`Protected artifact changed: ${path}`);
  }
}

/** A loopback port reserved for the fixture web app so its public origin is known before `up`. */
export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (!address || typeof address === "string") throw new Error("Could not reserve a host port");
  return address.port;
}

export interface FixtureComposeOptions {
  /** The browser/public origin every resource service must use. */
  publicOrigin?: string;
  /** Host ports to publish the fixture web apps on, by element ID. */
  webPorts?: Record<string, number>;
}

/** Project names, volumes, credentials and ports are all separate from the running application. */
export function fixtureCompose(
  original: ComposeFile,
  lock: Lock,
  options: FixtureComposeOptions = {},
): ComposeFile {
  const file = structuredClone(original);
  delete file.name;
  if ("networks" in file || "secrets" in file || "configs" in file)
    throw new Error("Disposable verification requires generated local Compose wiring");
  const publicOrigin =
    options.publicOrigin ??
    (Object.keys(options.webPorts ?? {}).length > 0
      ? `http://127.0.0.1:${Object.values(options.webPorts ?? {})[0]}`
      : "http://127.0.0.1:1");
  const values: Record<string, string> = {};
  for (const service of Object.keys(lock.resourceModels ?? {})) {
    values[databasePasswordEnv(service)] = randomUUID();
    values[service.toUpperCase().replaceAll("-", "_") + "_PUBLIC_ORIGIN"] = publicOrigin;
  }
  const webApps = new Set(
    lock.elements.filter((element) => element.template.startsWith("web-app@")).map((e) => e.id),
  );
  for (const [id, service] of Object.entries(file.services)) {
    if (service.container_name || service.network_mode || service.external_links)
      throw new Error(`Unsafe fixture service ${id}`);
    delete service.restart;
    if (service.ports)
      service.ports = service.ports.map((port) => {
        const container = port.split(":").at(-1);
        if (!container || !/^\d+$/.test(container))
          throw new Error(`Unsupported fixture port ${port}`);
        const reserved = webApps.has(id) ? options.webPorts?.[id] : undefined;
        return reserved ? `127.0.0.1:${reserved}:${container}` : `127.0.0.1::${container}`;
      });
    for (const volume of service.volumes ?? []) {
      const source = volume.split(":")[0] ?? "";
      if (!(source in (file.volumes ?? {})) && !volume.endsWith(":ro"))
        throw new Error(`Writable bind mount in fixture: ${volume}`);
    }
    service.environment = Object.fromEntries(
      Object.entries(service.environment ?? {}).map(([key, value]) => [
        key,
        value.replace(/\$\{([^}:]+)(?::[^}]*)?\}/g, (_, name: string) => {
          const replacement = values[name];
          if (replacement === undefined)
            throw new Error(`Fixture needs an explicit isolated value for ${name}`);
          return replacement;
        }),
      ]),
    );
    const host = service.environment.DATABASE_HOST;
    const url = service.environment.DATABASE_URL;
    if ((host && !file.services[host]) || (url && !file.services[new URL(url).hostname]))
      throw new Error(`External database in fixture ${id}`);
  }
  // Named volumes are always new, never externally provisioned or given an application name.
  file.volumes = Object.fromEntries(Object.keys(file.volumes ?? {}).map((name) => [name, {}]));
  return file;
}

export function assertExecutedTests(output: string): void {
  const count = Number(/# tests (\d+)/.exec(output)?.[1]);
  const passed = Number(/# pass (\d+)/.exec(output)?.[1]);
  if (!count || passed !== count || /# (?:skipped|todo) [1-9]/.test(output))
    throw new Error(
      "Independent suite must execute nonempty assertions with no skipped/todo tests",
    );
}

export function assertPlaywrightTests(output: string): void {
  const passed = Number(/(\d+) passed/.exec(output)?.[1] ?? 0);
  if (
    passed < 1 ||
    /\b[1-9]\d* (?:failed|skipped|did not run|flaky|interrupted)\b/.test(output) ||
    /\bno tests found\b/i.test(output)
  )
    throw new Error("Playwright suite must execute nonempty assertions with no skipped tests");
}

/** The environment a fixed suite gets. No ambient application credentials are inherited. */
function testEnvironment(
  dir: string,
  name: string,
  file: string,
  service: string,
  servicePort: number,
  url: string,
  origin: string,
  serviceUrls: Record<string, string>,
  dbService: string | undefined,
  operations: string[],
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TZ: "UTC",
    CI: "1",
    JEEVES_TEST_ISOLATED: "1",
    JEEVES_TEST_URL: url,
    JEEVES_TEST_SERVICE_PORT: String(servicePort),
    JEEVES_TEST_PUBLIC_ORIGIN: origin,
    JEEVES_TEST_WEB_URL: origin,
    JEEVES_TEST_OPERATION_IDS: JSON.stringify(operations),
    JEEVES_TEST_SERVICE: service,
    JEEVES_TEST_SERVICE_URLS: JSON.stringify(serviceUrls),
    JEEVES_TEST_PROJECT_DIR: dir,
    JEEVES_TEST_COMPOSE_PROJECT: name,
    JEEVES_TEST_COMPOSE_FILE: file,
    ...(dbService && { JEEVES_TEST_DB_SERVICE: dbService }),
  };
  for (const key of ["DOCKER_HOST", "DOCKER_CONTEXT", "PLAYWRIGHT_BROWSERS_PATH"])
    if (process.env[key]) env[key] = process.env[key];
  return env;
}

export async function verifyBehavior(options: {
  dir: string;
  lock: Lock;
  required: Record<string, string[]>;
  /** Whether the frontend has been implemented; frontend-phase suites wait until it has. */
  phase?: "extensions" | "frontend";
  signal?: AbortSignal;
  log: (line: string) => void;
  onCheck: (check: CheckOutcome) => void;
}): Promise<void> {
  const { dir, lock, log, onCheck, signal, required, phase = "extensions" } = options;
  assertGeneratedIntegrity(dir, lock);
  const models = lock.resourceModels ?? {};
  const suites = lock.fixedAcceptance ?? [];
  const missing = acceptanceCoverageProblems(models, suites, required);
  const deferred = Object.entries(models).flatMap(([service, model]) =>
    model.extensions
      .filter((e) => !required[service]?.includes(e.operationId))
      .map((e) => `${service}/${e.operationId}`),
  );
  if (deferred.length)
    onCheck({
      subject: "project",
      template: "acceptance",
      layer: "application",
      id: "deferred",
      title: "Remaining extension acceptance",
      status: "skipped",
      durationMs: 0,
      reason: `Deferred until their implementation task: ${deferred.join(", ")}`,
    });
  const failed: string[] = [];
  if (!deferred.length && !Object.values(required).some((ids) => ids.length))
    onCheck({
      subject: "project",
      template: "acceptance",
      layer: "application",
      id: "inapplicable",
      title: "Application acceptance",
      status: "skipped",
      durationMs: 0,
      reason: "No extension operations are declared for project acceptance.",
    });
  for (const error of missing) {
    onCheck({
      subject: "project",
      template: "acceptance",
      layer: "application",
      id: `coverage-${failed.length}`,
      title: "Required operation coverage",
      status: "failed",
      durationMs: 0,
      error,
    });
    failed.push(error);
  }
  const webApps = lock.elements.filter((element) => element.template.startsWith("web-app@"));
  const webPorts = Object.fromEntries(
    await Promise.all(webApps.map(async (element) => [element.id, await freePort()] as const)),
  );
  const webUrl = webApps[0] ? `http://127.0.0.1:${webPorts[webApps[0].id]}` : undefined;
  const fixture = fixtureCompose(
    parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile,
    lock,
    { ...(webUrl && { publicOrigin: webUrl }), webPorts },
  );
  const temp = mkdtempSync(join(tmpdir(), "jeeves-verification-"));
  const file = join(temp, "compose.yml");
  writeFileSync(file, composeToYaml(fixture));
  const name = "jeeves-verify-" + randomUUID();
  log(`Disposable fixture: ${name}`);
  const compose = new ComposeCli(dir, signal, { file, name });
  let failure: unknown;
  try {
    const up = await compose.run(["up", "--build", "--wait", "--wait-timeout", "300"], log);
    if (up.exitCode !== 0)
      throw new Error(`Disposable fixture startup failed: ${up.output.slice(-4000)}`);
    const serviceUrls: Record<string, string> = {};
    for (const element of lock.elements) {
      const env = fixture.services[element.id]?.environment ?? {};
      const port = Number(env.PORT);
      if (!Number.isFinite(port) || port <= 0) continue;
      const endpoint = await compose.service(element.id).endpoint(port);
      serviceUrls[element.id] = `http://${endpoint.host}:${endpoint.port}`;
    }
    const web = webApps[0] ? serviceUrls[webApps[0].id] : undefined;
    if (webApps.length && !web) throw new Error("The fixture web app didn't publish a port");
    const origin = web ?? webUrl ?? "http://127.0.0.1:1";
    const databases = new Set(Object.values(lock.resourceStores ?? {}).map((s) => s.database));
    const dbService = databases.size === 1 ? [...databases][0] : undefined;
    const run = async (
      service: string,
      id: string,
      path: string,
      layer: "template" | "application",
      runner: "node" | "playwright",
      acceptanceIds: string[] = [],
    ) => {
      const started = Date.now();
      let error: string | undefined;
      try {
        if (!lock.files[path])
          throw new Error(`Independent test is not protected by the generation lock: ${path}`);
        const url = serviceUrls[service];
        if (!url) throw new Error(`No fixture URL for service ${service}`);
        const port = Number(fixture.services[service]?.environment?.PORT ?? 0);
        const env = testEnvironment(
          dir,
          name,
          file,
          service,
          port,
          url,
          origin,
          serviceUrls,
          dbService,
          required[service] ?? [],
        );
        if (runner === "playwright") {
          const [pnpm, ...pnpmArgs] = pnpmCommand();
          const result = await runCommand(
            pnpm,
            [...pnpmArgs, "exec", "playwright", "test", path, "--reporter=line", "--workers=1"],
            {
              cwd: dir,
              signal,
              timeoutMs: 180_000,
              inheritEnv: false,
              onLine: log,
              env,
            },
          );
          if (result.exitCode !== 0)
            throw new Error(
              `Playwright suite failed (exit ${result.exitCode}): ${result.output.slice(-4000)}`,
            );
          assertPlaywrightTests(result.output);
        } else {
          const result = await runCommand(
            process.execPath,
            ["--test", "--test-reporter=tap", path],
            {
              cwd: dir,
              signal,
              timeoutMs: 120_000,
              inheritEnv: false,
              onLine: log,
              env,
            },
          );
          if (result.exitCode !== 0)
            throw new Error(
              `Independent suite failed (exit ${result.exitCode}): ${result.output.slice(-4000)}`,
            );
          assertExecutedTests(result.output);
        }
      } catch (failure) {
        error = (failure as Error).message;
      }
      onCheck({
        subject: service,
        template: layer === "application" ? "acceptance" : "resources",
        layer,
        id,
        title: `Independent ${layer === "application" ? "acceptance" : "standard behavior"}: ${id === "_session" ? "sessions" : id}`,
        status: error ? "failed" : "passed",
        durationMs: Date.now() - started,
        ...(acceptanceIds.length > 0 && { acceptanceIds }),
        ...(error && { error }),
      });
      if (error) failed.push(`${service}/${id}: ${error}`);
    };
    for (const [service, model] of Object.entries(models)) {
      await run(
        service,
        "_session",
        `tests/generated/${service}/_session.test.ts`,
        "template",
        "node",
      );
      for (const resource of model.resources.filter(
        (r) => r.access === "owner" && r.operations.length,
      ))
        await run(
          service,
          resource.id,
          `tests/generated/${service}/${resource.id}.test.ts`,
          "template",
          "node",
        );
    }
    for (const suite of suites) {
      if (suite.requires === "frontend" && phase !== "frontend") {
        onCheck({
          subject: suite.service,
          template: "acceptance",
          layer: "application",
          id: suite.id,
          title: `Independent application acceptance: ${suite.id}`,
          status: "skipped",
          durationMs: 0,
          reason: "Waiting for the frontend task before running this browser journey.",
          acceptanceIds: suite.acceptanceIds,
        });
        continue;
      }
      // A multi-operation fixed fixture waits until all of its operations are required.
      if (suite.operationIds.every((id) => required[suite.service]?.includes(id)))
        await run(
          suite.service,
          suite.id,
          acceptancePath(suite),
          "application",
          suite.runner ?? "node",
          suite.acceptanceIds,
        );
      else if (suite.operationIds.some((id) => required[suite.service]?.includes(id)))
        failed.push(
          `${suite.service}/${suite.id}: fixed suite also requires future operations; provide an independently runnable suite for each task`,
        );
    }
    if (failed.length) throw new Error(failed.join("\n"));
  } catch (error) {
    failure = error;
  } finally {
    if (failure) {
      log(`[failure] services: ${Object.keys(fixture.services ?? {}).join(", ")}`);
      for (const id of Object.keys(fixture.services ?? {})) {
        let container = "";
        try {
          container = await compose.containerId(id);
        } catch {
          // No container to inspect.
        }
        log(`[failure] ${id}: container ${container || "(none)"}`);
        const logs = container
          ? await runCommand("docker", ["logs", "--tail", "120", container], { cwd: dir })
          : await new ComposeCli(dir, undefined, { file, name }).run([
              "logs",
              "--no-color",
              "--tail",
              "80",
              id,
            ]);
        for (const line of logs.output.trim().split("\n")) log(`[failure] ${id}: ${line}`);
      }
    }
    const down = await new ComposeCli(dir, undefined, { file, name }).run(
      ["down", "--volumes", "--remove-orphans", "--rmi", "local"],
      log,
    );
    rmSync(temp, { recursive: true, force: true });
    if (down.exitCode !== 0)
      failure = new Error(
        `${failure instanceof Error ? failure.message + "\n" : ""}Disposable fixture cleanup failed: ${down.output.slice(-2000)}`,
      );
  }
  if (failure) throw failure;
}

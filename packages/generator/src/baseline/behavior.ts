import { randomUUID } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ComposeFile, composeToYaml, databasePasswordEnv } from "@jeeves/template-kit";
import { parse } from "yaml";
import { acceptanceCoverageProblems, acceptancePath } from "../acceptance.ts";
import { runCommand } from "../exec.ts";
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

/** Project names, volumes, credentials and ports are all separate from the running application. */
export function fixtureCompose(original: ComposeFile, lock: Lock): ComposeFile {
  const file = structuredClone(original);
  delete file.name;
  if ("networks" in file || "secrets" in file || "configs" in file)
    throw new Error("Disposable verification requires generated local Compose wiring");
  const values: Record<string, string> = {};
  for (const service of Object.keys(lock.resourceModels ?? {})) {
    values[databasePasswordEnv(service)] = randomUUID();
    values[service.toUpperCase().replaceAll("-", "_") + "_PUBLIC_ORIGIN"] = "http://127.0.0.1:1";
  }
  for (const [id, service] of Object.entries(file.services)) {
    if (service.container_name || service.network_mode || service.external_links)
      throw new Error(`Unsafe fixture service ${id}`);
    delete service.restart;
    if (service.ports)
      service.ports = service.ports.map((port) => {
        const container = port.split(":").at(-1);
        if (!container || !/^\d+$/.test(container))
          throw new Error(`Unsupported fixture port ${port}`);
        return `127.0.0.1::${container}`;
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

export async function verifyBehavior(options: {
  dir: string;
  lock: Lock;
  required: Record<string, string[]>;
  signal?: AbortSignal;
  log: (line: string) => void;
  onCheck: (check: CheckOutcome) => void;
}): Promise<void> {
  const { dir, lock, log, onCheck, signal, required } = options;
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
  const fixture = fixtureCompose(
    parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile,
    lock,
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
    const run = async (
      service: string,
      id: string,
      path: string,
      layer: "template" | "application",
    ) => {
      const started = Date.now();
      let error: string | undefined;
      try {
        if (!lock.files[path])
          throw new Error(`Independent test is not protected by the generation lock: ${path}`);
        const env = fixture.services[service]?.environment ?? {};
        const endpoint = await compose.service(service).endpoint(Number(env.PORT ?? 8080));
        const result = await runCommand(process.execPath, ["--test", "--test-reporter=tap", path], {
          cwd: dir,
          signal,
          timeoutMs: 120_000,
          inheritEnv: false,
          onLine: log,
          env: {
            PATH: process.env.PATH,
            TZ: "UTC",
            JEEVES_TEST_ISOLATED: "1",
            JEEVES_TEST_URL: `http://${endpoint.host}:${endpoint.port}`,
            JEEVES_TEST_PUBLIC_ORIGIN: env.PUBLIC_ORIGIN,
            JEEVES_TEST_OPERATION_IDS: JSON.stringify(required[service] ?? []),
          },
        });
        if (result.exitCode !== 0)
          throw new Error(
            `Independent suite failed (exit ${result.exitCode}): ${result.output.slice(-4000)}`,
          );
        assertExecutedTests(result.output);
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
        ...(error && { error }),
      });
      if (error) failed.push(`${service}/${id}: ${error}`);
    };
    for (const [service, model] of Object.entries(models)) {
      await run(service, "_session", `tests/generated/${service}/_session.test.ts`, "template");
      for (const resource of model.resources.filter(
        (r) => r.access === "owner" && r.operations.length,
      ))
        await run(
          service,
          resource.id,
          `tests/generated/${service}/${resource.id}.test.ts`,
          "template",
        );
    }
    for (const suite of suites) {
      // A multi-operation fixed fixture waits until all of its operations are required.
      if (suite.operationIds.every((id) => required[suite.service]?.includes(id)))
        await run(suite.service, suite.id, acceptancePath(suite), "application");
      else if (suite.operationIds.some((id) => required[suite.service]?.includes(id)))
        failed.push(
          `${suite.service}/${suite.id}: fixed suite also requires future operations; provide an independently runnable suite for each task`,
        );
    }
    if (failed.length) throw new Error(failed.join("\n"));
  } catch (error) {
    failure = error;
  } finally {
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

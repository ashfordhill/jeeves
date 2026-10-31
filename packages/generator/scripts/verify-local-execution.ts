/** Proves generated local limits, process failure and bounded shutdown on one disposable service. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { designSchema, localExecutionPolicy } from "@jeeves/spec";
import { type ComposeFile, composeToYaml, createGenerateContext } from "@jeeves/template-kit";
import { parse } from "yaml";
import { assertGeneratedIntegrity, fixtureCompose } from "../src/baseline/behavior.ts";
import { ComposeCli } from "../src/baseline/compose.ts";
import { pnpmCommand, runCommand } from "../src/exec.ts";
import { generateProject } from "../src/generate.ts";
import { templateSet } from "../src/modules.ts";

if (process.argv.length > 2) throw new Error("Local execution proof takes no arguments");
const scratch = mkdtempSync(join(tmpdir(), "jeeves-local-execution-")),
  dir = join(scratch, "app");
const cancellation = new AbortController(),
  cancel = () => cancellation.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const log = (line: string) => console.log(line);
const policy = localExecutionPolicy("balanced");
const design = designSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/local-execution.json", import.meta.url),
      "utf8",
    ),
  ),
);
let isolation: { file: string; name: string } | undefined;
let failure: unknown,
  cleanupFailed = false;
try {
  const generated = await generateProject({
    dir,
    design,
    projectName: "Local execution proof",
    git: false,
    log,
  });
  if (!generated.ok) throw new Error(JSON.stringify(generated.problems));
  const features = join(dir, "services/service/src/features/execution-proof");
  mkdirSync(features, { recursive: true });
  writeFileSync(
    join(features, "index.ts"),
    readFileSync(
      new URL(
        "../../../templates/local-execution/conformance/proof-feature.ts.txt",
        import.meta.url,
      ),
    ),
  );
  const [pnpm, ...prefix] = pnpmCommand();
  for (const args of [
    ["install", "--no-frozen-lockfile"],
    ["-r", "--no-bail", "typecheck"],
  ]) {
    const result = await runCommand(pnpm, [...prefix, ...args], {
      cwd: dir,
      signal: cancellation.signal,
      timeoutMs: 300000,
      onLine: log,
    });
    if (result.exitCode !== 0) throw new Error(`Consumer ${args.join(" ")} failed`);
  }
  const isolated = fixtureCompose(
    parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile,
    generated.lock,
    { publicOrigin: "http://127.0.0.1" },
  );
  // Ordinary fixtures suppress restart. This named proof opts this one isolated service back in.
  isolated.services.service!.restart = policy.restart;
  isolation = { file: join(scratch, "compose.yml"), name: `jeeves-execution-${randomUUID()}` };
  writeFileSync(isolation.file, composeToYaml(isolated), { mode: 0o600 });
  const compose = new ComposeCli(dir, cancellation.signal, isolation);
  const up = await compose.run(["up", "--build", "--wait", "--wait-timeout", "180"], log);
  if (up.exitCode !== 0) throw new Error(`Consumer startup failed: ${up.output.slice(-3000)}`);
  const templates = templateSet();
  let checks = 0;
  for (const subject of generated.plan.subjects) {
    const [id, version] = subject.template.split("@");
    const pack = templates.module({ id: id!, version: version! }).testPack;
    for (const check of pack.checks) {
      await check.run({
        projectDir: dir,
        subject: createGenerateContext(
          design,
          templates.lookup,
          subject.element,
          subject.attachment,
        ),
        compose: isolated,
        service: (name) => compose.service(name),
        log,
      });
      checks++;
      log(`PASS ${subject.template}/${check.id}`);
    }
  }
  const container = await compose.containerId("service");
  const inspect = async (format: string) => {
    const result = await runCommand("docker", ["inspect", "--format", format, container], {
      cwd: dir,
      signal: cancellation.signal,
      timeoutMs: 10000,
    });
    assert.equal(result.exitCode, 0);
    return result.output.trim();
  };
  // Read only these known fields: never print the container environment or secrets.
  assert.deepEqual(
    JSON.parse(
      await inspect(
        '[{{.HostConfig.NanoCpus}},{{.HostConfig.Memory}},{{.HostConfig.PidsLimit}},{{.HostConfig.Init}},"{{.HostConfig.RestartPolicy.Name}}",{{.HostConfig.RestartPolicy.MaximumRetryCount}}]',
      ),
    ),
    [1000000000, 768 * 1024 * 1024, 192, true, "on-failure", 5],
  );
  assert.equal(Number(await inspect("{{.Config.StopTimeout}}")), policy.graceSeconds);
  log("PASS Docker installed exact CPU/memory/PID/init/restart/shutdown-grace configuration");
  const service = compose.service("service");
  const base = async () => {
    const address = await service.endpoint(8080);
    return `http://${address.host}:${address.port}`;
  };
  const request = async (path: string, method = "GET") => {
    const response = await fetch(`${await base()}${path}`, {
      method,
      signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(10000)]),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  // Establish a successful run before exercising Docker's restart policy.
  await delay(11000, undefined, { signal: cancellation.signal });
  const count = Number(await inspect("{{.RestartCount}}"));
  await request("/proof/crash", "POST");
  const restartDeadline = Date.now() + 20000;
  while (Number(await inspect("{{.RestartCount}}")) <= count && Date.now() < restartDeadline)
    await delay(200, undefined, { signal: cancellation.signal });
  assert.equal(Number(await inspect("{{.RestartCount}}")), count + 1);
  await compose.waitHealthy("service");
  await request("/ready");
  log("PASS nonzero process exit restarts once and readiness recovers");
  // Wait until the request is actually in the handler before sending SIGTERM.
  const slow = request("/proof/slow");
  const startedDeadline = Date.now() + 5000;
  while (!((await request("/proof/state")) as { slowStarted?: boolean }).slowStarted) {
    assert.ok(Date.now() < startedDeadline);
    await delay(50, undefined, { signal: cancellation.signal });
  }
  const draining = Date.now();
  assert.equal((await service.stop({ graceSeconds: policy.graceSeconds })).exitCode, 0);
  assert.deepEqual(await slow, { completed: true });
  assert.ok(Date.now() - draining < policy.shutdownMs + 2000);
  await delay(1000, undefined, { signal: cancellation.signal });
  assert.equal(await inspect("{{.State.Status}}"), "exited");
  log("PASS in-flight work drains on SIGTERM; a manual stop stays stopped");
  await service.start();
  await request("/proof/hang-on-stop", "POST");
  const hanging = Date.now();
  // No timeout override: this exercises the installed Compose grace as well as the app deadline.
  assert.equal((await compose.run(["stop", "service"])).exitCode, 0);
  assert.equal(Number(await inspect("{{.State.ExitCode}}")), 1);
  const elapsed = Date.now() - hanging;
  assert.ok(
    elapsed >= policy.shutdownMs - 1000 && elapsed < policy.graceSeconds * 1000,
    `Shutdown took ${elapsed}ms`,
  );
  log(
    `PASS hung shutdown ends at application deadline (${elapsed}ms), before Docker's kill deadline`,
  );
  assertGeneratedIntegrity(dir, generated.lock);
  log(
    `PASS local execution: ${checks} template checks plus exact limits, process restart, request drain and bounded shutdown; zero model calls`,
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
      failure = new Error(`Cleanup failed; inspect ${scratch}: ${result.output.slice(-2000)}`);
    }
  }
  if (!cleanupFailed) rmSync(scratch, { recursive: true, force: true });
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}
if (failure) throw failure;

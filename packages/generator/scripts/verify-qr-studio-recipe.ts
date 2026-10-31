/** Fresh recipe proof: no existing consumer checkout, model calls or live database. */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertGeneratedIntegrity } from "../src/baseline/behavior.ts";
import { ComposeCli } from "../src/baseline/compose.ts";
import { freePort, runBaseline } from "../src/baseline/index.ts";
import { pnpmCommand, runCommand } from "../src/exec.ts";
import { generateProject } from "../src/generate.ts";
import { createRecipeDesign } from "../src/recipes.ts";

if (process.argv.length > 2)
  throw new Error("Fresh recipe proof takes no checkout or output path.");
const dir = mkdtempSync(join(tmpdir(), "jeeves-qr-studio-proof-"));
const cancellation = new AbortController();
const cancel = () => cancellation.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const log = (line: string) => console.log(line);
async function cleanup() {
  if (existsSync(join(dir, "docker-compose.yml"))) {
    const down = await new ComposeCli(dir).run(
      ["down", "--volumes", "--remove-orphans", "--rmi", "local"],
      log,
    );
    if (down.exitCode !== 0)
      throw new Error(
        `Recipe cleanup failed; disposable files retained at ${dir}: ${down.output.slice(-2000)}`,
      );
  }
}

let cleanupFailed = false;
let failure: unknown;
try {
  const { design } = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { title: "QR Studio recipe proof", hostPort: await freePort() },
  );
  const result = await generateProject({
    dir,
    design,
    projectName: "QR Studio recipe proof",
    git: false,
    log,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  log(
    `Recipe ${JSON.stringify(result.lock.recipe)}; ${Object.keys(result.lock.files).length} protected files`,
  );
  const [pnpm, ...prefix] = pnpmCommand();
  for (const args of [
    ["install", "--frozen-lockfile"],
    ["--filter", "qrwty-web", "build"],
  ]) {
    cancellation.signal.throwIfAborted();
    const command = await runCommand(pnpm, [...prefix, ...args], {
      cwd: dir,
      signal: cancellation.signal,
      timeoutMs: 300_000,
      onLine: log,
    });
    if (command.exitCode !== 0)
      throw new Error(`Recipe ${args.join(" ")} failed: ${command.output.slice(-4000)}`);
  }
  const baseline = await runBaseline({
    dir,
    design,
    subjects: result.plan.subjects,
    signal: cancellation.signal,
    onEvent: (event) => {
      if (event.type === "log") log(event.line);
      else if (event.type === "check")
        log(
          `${event.check.status.toUpperCase()} ${event.check.subject}/${event.check.id}${event.check.error ? `: ${event.check.error}` : ""}`,
        );
      else
        log(
          `${event.status.toUpperCase()} ${event.step}${event.message ? `: ${event.message}` : ""}`,
        );
    },
  });
  if (!baseline.ok)
    throw new Error(
      `Recipe baseline failed: ${JSON.stringify(baseline.steps.filter((step) => step.status === "failed"))}`,
    );
  assertGeneratedIntegrity(dir, result.lock);
  const cases = new Set(
    baseline.checks
      .filter((check) => check.status === "passed")
      .flatMap((check) => check.acceptanceIds ?? []),
  );
  for (let i = 1; i <= 16; i++)
    if (!cases.has(`QR-${String(i).padStart(2, "0")}`))
      throw new Error(`Missing passing QR-${i} acceptance`);
  log(
    `PASS fresh recipe: ${baseline.checks.filter((check) => check.status === "passed").length} checks, QR-01–QR-16, protected source unchanged, no consumer checkout or model.`,
  );
} catch (error) {
  failure = error;
} finally {
  try {
    await cleanup();
  } catch (error) {
    cleanupFailed = true;
    failure = failure
      ? new AggregateError([failure, error], "Recipe verification and cleanup failed")
      : error;
  }
  if (!cleanupFailed) rmSync(dir, { recursive: true, force: true });
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}
if (failure) throw failure;

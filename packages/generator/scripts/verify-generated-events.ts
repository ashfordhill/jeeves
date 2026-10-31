/** Generated non-QR consumer; all state and processes are disposable. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { designSchema } from "@jeeves/spec";
import { assertGeneratedIntegrity } from "../src/baseline/behavior.ts";
import { ComposeCli } from "../src/baseline/compose.ts";
import { runBaseline } from "../src/baseline/index.ts";
import { generateProject } from "../src/generate.ts";

if (process.argv.length > 2) throw new Error("Generated event proof takes no arguments");
const dir = mkdtempSync(join(tmpdir(), "jeeves-generated-events-"));
const cancellation = new AbortController();
const cancel = () => cancellation.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const fixture = new URL("../../../templates/durable-events/conformance/fixtures/", import.meta.url);
const design = designSchema.parse(
  JSON.parse(
    readFileSync(new URL("../../../fixtures/designs/event-orders.json", import.meta.url), "utf8"),
  ),
);
const log = (message: string) => console.log(message);
let failure: unknown;
let cleanupFailed = false;
try {
  const generated = await generateProject({
    dir,
    design,
    projectName: "Generated events proof",
    git: false,
    log,
    fixedAcceptance: [
      {
        id: "order-delivery",
        service: "orders",
        operationIds: ["event:order-delivery:order-placed"],
        acceptanceIds: ["ORDER-01"],
        source: readFileSync(new URL("acceptance.test.ts.txt", fixture), "utf8"),
      },
    ],
  });
  if (!generated.ok) throw new Error(JSON.stringify(generated.problems));
  for (const [from, to] of [
    ["order-placed.ts", "src/event-handlers/order-placed.ts"],
    ["producer.ts", "src/features/proof/index.ts"],
  ]) {
    const path = join(dir, "services/orders", to!);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, readFileSync(new URL(from!, fixture)));
  }
  const result = await runBaseline({
    dir,
    design,
    subjects: generated.plan.subjects,
    requiredExtensions: { orders: ["event:order-delivery:order-placed"] },
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
  if (!result.ok)
    throw new Error(
      `Generated event baseline failed: ${JSON.stringify(result.steps.filter((s) => s.status === "failed"))}`,
    );
  assertGeneratedIntegrity(dir, generated.lock);
  if (
    !result.checks.some(
      (check) => check.status === "passed" && check.acceptanceIds?.includes("ORDER-01"),
    )
  )
    throw new Error("Fixed event acceptance did not execute");
  const regenerated = await generateProject({
    dir,
    design,
    projectName: "Generated events proof",
    git: false,
  });
  if (!regenerated.ok) throw new Error("Regeneration refused the verified consumer");
  assertGeneratedIntegrity(dir, regenerated.lock);
  log(
    `PASS generated delivery: ${result.checks.filter((c) => c.status === "passed").length} checks, ORDER-01 restart persistence, regenerated ownership preserved, no model calls`,
  );
} catch (error) {
  failure = error;
} finally {
  if (existsSync(join(dir, "docker-compose.yml"))) {
    const result = await new ComposeCli(dir).run(
      ["down", "--volumes", "--remove-orphans", "--rmi", "local"],
      log,
    );
    if (result.exitCode !== 0) {
      cleanupFailed = true;
      failure = new Error(`Cleanup failed; inspect ${dir}: ${result.output.slice(-2000)}`);
    }
  }
  if (!cleanupFailed) rmSync(dir, { recursive: true, force: true });
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}
if (failure) throw failure;

import { randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Application } from "./harness/application.ts";
import { cleanupRun, type RunRecord } from "./harness/cleanup.ts";
import { runSanitizer, sanitizeArtifacts } from "./harness/evidence.ts";
import { command, json, repository, sourceSnapshot, writeJson } from "./harness/process.ts";

const args = process.argv.slice(2);
if (args[0] === "--cleanup") {
  if (args.length !== 2 || !args[1])
    throw new Error("Usage: test:generated --cleanup /absolute/run.json");
  await cleanupRun(resolve(args[1]));
} else {
  const suites = ["core", "wiring", "identity", "media", "regeneration"];
  let suite = "core";
  let artifacts = "";
  for (const arg of args) {
    if (arg.startsWith("--suite=")) suite = arg.slice(8);
    else if (arg.startsWith("--artifacts=")) artifacts = resolve(arg.slice(12));
    else throw new Error(`Unknown option ${arg}`);
  }
  if (suite !== "all" && !suites.includes(suite))
    throw new Error(`Suite '${suite}' is not implemented. Implemented: ${suites.join(", ")}`);
  const selected = suite === "all" ? suites : [suite];
  const id = `gs-${randomUUID()}`;
  if (!artifacts) artifacts = join(repository, "test-results/generated", id);
  await mkdir(artifacts, { recursive: true });
  if ((await readdir(artifacts)).length)
    throw new Error("Use an empty artifact directory for each run");
  const recordPath = join(artifacts, "run.json");
  const run: RunRecord = {
    version: 1,
    id,
    suite,
    temporary: await mkdtemp(join(tmpdir(), "jeeves-system-")),
    stacks: [],
  };
  await writeJson(recordPath, run);
  const started = Date.now();
  let interrupted: string | undefined;
  const onInterrupt = (signal: string) => {
    interrupted = signal;
  };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);
  let failed: unknown;
  console.log(`Generated system suites: ${selected.join(", ")}; artifacts: ${artifacts}`);
  try {
    await writeJson(join(artifacts, "source.json"), await sourceSnapshot());
    await writeJson(join(artifacts, "identity.json"), {
      id,
      selected,
      commit: (await command("git", ["rev-parse", "HEAD"])).trim(),
      dirty: (
        await command("git", [
          "status",
          "--porcelain",
          "--",
          "jeeves-generator",
          "jeeves/packages/spec",
          "field-projects/generator-system",
          "package.json",
          "pnpm-lock.yaml",
        ])
      ).trim(),
      tools: {
        node: process.version,
        pnpm: (await command("pnpm", ["--version"])).trim(),
        docker: (
          await command("docker", [
            "version",
            "--format",
            "{{.Client.Version}} / {{.Server.Version}}",
          ])
        ).trim(),
        compose: (await command("docker", ["compose", "version", "--short"])).trim(),
      },
    });
    if (interrupted) throw new Error(`Interrupted by ${interrupted}`);
    const output = await command(
      "pnpm",
      ["exec", "vitest", "run", "--config", "jeeves-generator/integration/vitest.config.ts"],
      {
        timeoutMs: 1_200_000,
        env: {
          JEEVES_SYSTEM_RECORD: recordPath,
          JEEVES_SYSTEM_SUITES: selected.join(","),
          JEEVES_SYSTEM_ARTIFACTS: artifacts,
        },
      },
    );
    const record = await json<RunRecord>(recordPath);
    const clean = await runSanitizer(record.stacks.map((stack) => stack.application));
    await writeFile(join(artifacts, "vitest.log"), clean(output));
    console.log(clean(output));
  } catch (error) {
    failed = error;
    const record = await json<RunRecord>(recordPath);
    const clean = await runSanitizer(record.stacks.map((stack) => stack.application));
    await writeFile(join(artifacts, "failure.log"), clean(String(error)));
    console.error(clean(String(error)));
  } finally {
    try {
      const record = await json<RunRecord>(recordPath);
      for (const stack of record.stacks) {
        const resultPath = join(stack.artifacts, "result.json");
        const hasResult = await access(resultPath).then(
          () => true,
          () => false,
        );
        if (!hasResult) {
          const app = new Application(stack, recordPath);
          await app.capture();
          await app.save("result.json", {
            outcome: "failed",
            phase: "interrupted-or-runner",
            signal: interrupted,
          });
        }
      }
      await sanitizeArtifacts(
        artifacts,
        record.stacks.map((stack) => stack.application),
      );
    } catch (error) {
      failed ??= error;
      await writeFile(join(artifacts, "sanitization-failure.log"), String(error));
    }
    try {
      await cleanupRun(recordPath);
    } catch (error) {
      failed ??= error;
      await writeFile(join(artifacts, "cleanup-failure.log"), String(error));
    }
    await writeJson(join(artifacts, "summary.json"), {
      id,
      selected,
      outcome: failed || interrupted ? "failed" : "passed",
      signal: interrupted,
      elapsedMs: Date.now() - started,
      interruptedRunRecovery: `pnpm test:generated --cleanup ${recordPath}`,
    });
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
    if (failed || interrupted) process.exitCode = 1;
  }
}

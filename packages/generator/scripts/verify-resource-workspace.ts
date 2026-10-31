/** Compiled component proof, using only disposable generated service/database/frontend state. */
import { createHash, randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { designSchema } from "@jeeves/spec";
import { type ComposeFile, composeToYaml } from "@jeeves/template-kit";
import { withPage } from "@jeeves/template-kit/browser";
import { parse } from "yaml";
import { proveResourceWorkspace } from "../../resource-workspace/conformance/browser-proof.ts";
import { assertGeneratedIntegrity, fixtureCompose, freePort } from "../src/baseline/behavior.ts";
import { ComposeCli } from "../src/baseline/compose.ts";
import { pnpmCommand, runCommand } from "../src/exec.ts";
import { generateProject } from "../src/generate.ts";

if (process.argv.length > 2) throw new Error("Resource workspace proof takes no arguments");
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "jeeves-resource-workspace-")),
  dir = join(scratch, "app");
const cancellation = new AbortController(),
  cancel = () => cancellation.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const log = (line: string) => console.log(line);
const evidence = join(repository, ".jeeves-work/evidence/p24");
const definition = new URL("../../resource-workspace/conformance/fixtures/", import.meta.url);
const artifacts = ["product-ui/0.3.0", "resource-workspace/0.1.0"].map((path) => {
  const root = join(repository, "artifacts", path);
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
    archive: string;
    sha256: string;
    name: string;
    version: string;
  };
  const data = readFileSync(join(root, manifest.archive));
  if (createHash("sha256").update(data).digest("hex") !== manifest.sha256)
    throw new Error(`Archive hash differs: ${manifest.name}`);
  return { ...manifest, data };
});
const design = designSchema.parse(
  JSON.parse(readFileSync(join(repository, "fixtures/designs/resource-workspace.json"), "utf8")),
);
let compose: ComposeCli | undefined,
  isolation: { file: string; name: string } | undefined,
  failure: unknown,
  cleanupFailed = false;
try {
  const generated = await generateProject({
    dir,
    design,
    projectName: "Resource workspace component proof",
    git: false,
    log,
  });
  if (!generated.ok) throw new Error(JSON.stringify(generated.problems));
  const frontend = join(dir, "frontends/inventory-web");
  const vendor = join(dir, "vendor/jeeves");
  const file = join(frontend, "package.json"),
    pkg = JSON.parse(readFileSync(file, "utf8"));
  for (const artifact of artifacts) {
    writeFileSync(join(vendor, artifact.archive), artifact.data);
    pkg.dependencies[artifact.name] = `file:../../vendor/jeeves/${artifact.archive}`;
  }
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  cpSync(new URL("App.tsx", definition), join(frontend, "src/App.tsx"));
  cpSync(new URL("definition.json", definition), join(frontend, "src/workspace-definition.json"));
  writeFileSync(
    join(frontend, "src/styles.css"),
    "html, body, #root { margin: 0; min-height: 100%; }\n",
  );
  const appSource = readFileSync(join(frontend, "src/App.tsx"));
  const [pnpm, ...prefix] = pnpmCommand();
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
    if (result.exitCode !== 0)
      throw new Error(`Consumer ${args.join(" ")} failed: ${result.output.slice(-4000)}`);
  }
  const webPort = await freePort(),
    origin = `http://127.0.0.1:${webPort}`;
  const isolated = fixtureCompose(
    parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile,
    generated.lock,
    { publicOrigin: origin, webPorts: { "inventory-web": webPort } },
  );
  const composeFile = join(scratch, "compose.yml"),
    name = `jeeves-workspace-${randomUUID()}`;
  writeFileSync(composeFile, composeToYaml(isolated), { mode: 0o600 });
  isolation = { file: composeFile, name };
  compose = new ComposeCli(dir, cancellation.signal, isolation);
  const up = await compose.run(["up", "--build", "--wait", "--wait-timeout", "300"], log);
  if (up.exitCode !== 0) throw new Error(`Consumer startup failed: ${up.output.slice(-5000)}`);
  const journeys = await withPage(async (page, problems) => {
    try {
      return await proveResourceWorkspace(page, problems, origin, evidence);
    } catch (error) {
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: join(evidence, "failure.png") });
      try {
        problems.assert("Resource workspace failure diagnostics");
      } catch (diagnostics) {
        throw new AggregateError(
          [error, diagnostics],
          "Resource workspace behavior and browser diagnostics failed",
        );
      }
      throw error;
    }
  });
  assertGeneratedIntegrity(dir, generated.lock);
  const regenerated = await generateProject({
    dir,
    design,
    projectName: "Resource workspace component proof",
    git: false,
  });
  if (!regenerated.ok) throw new Error("Regeneration refused the consumer");
  if (!readFileSync(join(frontend, "src/App.tsx")).equals(appSource))
    throw new Error("Regeneration changed the project-owned integration");
  for (const artifact of artifacts)
    if (!readFileSync(join(vendor, artifact.archive)).equals(artifact.data))
      throw new Error("Consumer artifact changed");
  assertGeneratedIntegrity(dir, regenerated.lock);
  log(
    `PASS compiled resource workspace (${journeys.join(", ")}); archive hashes preserved, generated API integrity and project integration retained, no model calls`,
  );
} catch (error) {
  failure = error;
} finally {
  if (compose) {
    // Cleanup must run even after the work signal was cancelled.
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

/** Actual diagram generation proof; all service/database/frontend state is disposable. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { applyOperations, designSchema, localExecutionFor } from "@jeeves/spec";
import {
  CheckSkipped,
  type ComposeFile,
  composeToYaml,
  createGenerateContext,
} from "@jeeves/template-kit";
import { withPage } from "@jeeves/template-kit/browser";
import { parse } from "yaml";
import { seedPlan } from "../../orchestrator/src/seed.ts";
import { proveResourceWorkspace } from "../../resource-workspace/conformance/browser-proof.ts";
import { assertGeneratedIntegrity, fixtureCompose, freePort } from "../src/baseline/behavior.ts";
import { ComposeCli, missingComposeEnvironment } from "../src/baseline/compose.ts";
import { pnpmCommand, runCommand } from "../src/exec.ts";
import { generateProject } from "../src/generate.ts";
import { templateSet } from "../src/modules.ts";
import { createStarterDesign } from "../src/starters.ts";

const upgradeMode = process.argv[2] === "--upgrade-starter";
const starterMode = process.argv[2] === "--starter" || upgradeMode;
if (process.argv.length > (starterMode ? 3 : 2))
  throw new Error("Only --starter or --upgrade-starter is supported");
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "jeeves-generated-workspace-")),
  dir = join(scratch, "app");
const cancellation = new AbortController(),
  cancel = () => cancellation.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const log = (line: string) => console.log(line);
const evidence = join(
  repository,
  `.jeeves-work/evidence/${upgradeMode ? "p29" : starterMode ? "p26" : "p25"}`,
);
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
const webPort = await freePort(),
  origin = `http://127.0.0.1:${webPort}`;
let design = starterMode
  ? createStarterDesign(
      { id: "resource-workspace", version: "0.1.0" },
      { title: "Fieldwork", hostPort: webPort },
    ).design
  : designSchema.parse(
      JSON.parse(
        readFileSync(join(repository, "fixtures/designs/generated-workspace.json"), "utf8"),
      ),
    );
let compose: ComposeCli | undefined,
  isolation: { file: string; name: string } | undefined,
  failure: unknown,
  cleanupFailed = false;
try {
  let generated = await generateProject({
    dir,
    design,
    projectName: "Generated resource workspace proof",
    git: false,
    log,
  });
  if (!generated.ok) throw new Error(JSON.stringify(generated.problems));
  const privateEnvironment = starterMode ? readFileSync(join(dir, ".env"), "utf8") : undefined;
  if (
    starterMode &&
    (missingComposeEnvironment(dir, {}).length ||
      (statSync(join(dir, ".env")).mode & 0o777) !== 0o600)
  )
    throw new Error("Starter local environment is incomplete or not private");
  const frontend = join(dir, "frontends/inventory-web");
  const vendor = join(dir, "vendor/jeeves");
  const templates = templateSet();
  if (seedPlan({ design, lock: generated.lock, templates: templates.lookup }).length)
    throw new Error("Generated workspace unexpectedly needs implementation work");
  // Exercise the documented additive seam, without editing any application root or descriptor.
  const extraPath = join(frontend, "src/project/ProjectExtras.tsx");
  const extraSource =
    "export function ProjectExtras() { return <p>Fieldwork inventory help · project content</p>; }\n";
  writeFileSync(extraPath, extraSource);
  if (upgradeMode) {
    const previous = generated;
    const service = design.elements.find((element) => element.id === "inventory")!;
    const upgraded = applyOperations(
      design,
      [
        {
          op: "upgradeTemplate",
          id: service.id,
          from: service.template!,
          to: { id: "http-service", version: "0.3.0" },
          revision: design.revision,
        },
      ],
      templates.lookup,
    );
    if (!upgraded.ok) throw new Error(JSON.stringify(upgraded.errors));
    const expected = structuredClone(design);
    expected.revision++;
    expected.elements.find((element) => element.id === service.id)!.template!.version = "0.3.0";
    assert.deepEqual(upgraded.design, expected);
    design = upgraded.design;
    const next = await generateProject({
      dir,
      design,
      projectName: "Generated resource workspace proof",
      git: false,
      log,
    });
    if (!next.ok) throw new Error("Reviewed starter upgrade was refused");
    assert.deepEqual(next.plan.compose, previous.plan.compose);
    const outputs = (files: typeof next.plan.files) =>
      files.filter(
        (file) =>
          /^(services|frontends|databases|contracts)\//.test(file.path) &&
          !file.path.endsWith("AGENTS.md"),
      );
    assert.deepEqual(outputs(next.plan.files), outputs(previous.plan.files));
    assert.deepEqual(next.lock.runtimes, previous.lock.runtimes);
    assert.equal(readFileSync(extraPath, "utf8"), extraSource);
    if (readFileSync(join(dir, ".env"), "utf8") !== privateEnvironment)
      throw new Error("Reviewed upgrade changed private local setup");
    log(
      "PASS reviewed HTTP upgrade preserves application configuration, wiring, source, runtime/contract/Compose bytes and private setup",
    );
    const policy = applyOperations(
      design,
      [
        {
          op: "addAttachment",
          element: service.id,
          attachment: {
            id: "inventory-execution",
            template: { id: "local-execution", version: "0.1.0" },
            config: { preset: "balanced" },
          },
        },
      ],
      templates.lookup,
    );
    if (!policy.ok) throw new Error(JSON.stringify(policy.errors));
    design = policy.design;
    const configured = await generateProject({
      dir,
      design,
      projectName: "Generated resource workspace proof",
      git: false,
      log,
    });
    if (!configured.ok) throw new Error("Newly available local policy generation was refused");
    generated = configured;
    assert.equal(seedPlan({ design, lock: generated.lock, templates: templates.lookup }).length, 0);
  }
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
  const sourceCompose = parse(readFileSync(join(dir, "docker-compose.yml"), "utf8")) as ComposeFile;
  if (privateEnvironment) {
    // Consume the generated private credentials and origin, then retain fixture port/volume isolation.
    const localValues = parseEnv(privateEnvironment);
    for (const service of Object.values(sourceCompose.services))
      for (const [key, value] of Object.entries(service.environment ?? {}))
        service.environment![key] = value.replace(
          /\$\{([^}:]+)(?::[^}]*)?\}/g,
          (_, name: string) => {
            if (!localValues[name]) throw new Error(`Starter environment is missing ${name}`);
            return localValues[name];
          },
        );
  }
  const isolated = fixtureCompose(sourceCompose, generated.lock, {
    publicOrigin: origin,
    webPorts: { "inventory-web": webPort },
  });
  // Retain explicitly selected local policies on this isolated consumer for their read-only pack.
  for (const element of design.elements) {
    const execution = localExecutionFor(element);
    if (execution) isolated.services[element.id]!.restart = execution.restart;
  }
  const composeFile = join(scratch, "compose.yml"),
    name = `jeeves-workspace-${randomUUID()}`;
  writeFileSync(composeFile, composeToYaml(isolated), { mode: 0o600 });
  isolation = { file: composeFile, name };
  compose = new ComposeCli(dir, cancellation.signal, isolation);
  const up = await compose.run(["up", "--build", "--wait", "--wait-timeout", "300"], log);
  if (up.exitCode !== 0) throw new Error(`Consumer startup failed: ${up.output.slice(-5000)}`);
  let packChecks = 0,
    skippedChecks = 0;
  const order = [
    "web-app",
    "resource-workspace",
    "rest-api-client",
    "rest-api-server",
    "postgres",
    "http-service",
  ];
  for (const subject of [...generated.plan.subjects].sort(
    (a, b) => order.indexOf(a.template.split("@")[0]!) - order.indexOf(b.template.split("@")[0]!),
  )) {
    const [id, version] = subject.template.split("@");
    const pack = templates.module({ id: id!, version: version! }).testPack;
    const context = {
      projectDir: dir,
      subject: createGenerateContext(design, templates.lookup, subject.element, subject.attachment),
      compose: isolated,
      service: (name: string) => compose!.service(name),
      log,
    };
    for (const check of pack.checks) {
      try {
        await check.run(context);
        packChecks++;
        log(`PASS ${subject.template}/${check.id}`);
      } catch (error) {
        if (!(error instanceof CheckSkipped)) throw error;
        skippedChecks++;
        log(`SKIP ${subject.template}/${check.id}: ${error.message}`);
      }
    }
  }
  const journeys = await withPage(async (page, problems) => {
    try {
      return await proveResourceWorkspace(page, problems, origin, evidence, {
        stateLabel: "State",
        beforePaper: async () => {
          design.elements
            .find((element) => element.id === "inventory-web")!
            .attachments.find(
              (attachment) => attachment.id === "inventory-workspace",
            )!.config.preset = "paper";
          const next = await generateProject({
            dir,
            design,
            projectName: "Generated resource workspace proof",
            git: false,
          });
          if (!next.ok) throw new Error("Preset regeneration refused");
          generated = next;
          if (
            JSON.parse(readFileSync(join(frontend, "src/workspace.generated.json"), "utf8"))
              .preset !== "paper"
          )
            throw new Error("Generated descriptor did not adopt the selected preset");
          const rebuild = await compose!.run(
            ["up", "--build", "--no-deps", "--wait", "--wait-timeout", "120", "inventory-web"],
            log,
          );
          if (rebuild.exitCode !== 0)
            throw new Error("Preset deployment failed in disposable fixture");
        },
      });
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
    projectName: "Generated resource workspace proof",
    git: false,
  });
  if (!regenerated.ok) throw new Error("Regeneration refused the consumer");
  if (readFileSync(extraPath, "utf8") !== extraSource)
    throw new Error("Regeneration changed the project-owned extras");
  for (const artifact of artifacts)
    if (!readFileSync(join(vendor, artifact.archive)).equals(artifact.data))
      throw new Error("Consumer artifact changed");
  assertGeneratedIntegrity(dir, regenerated.lock);
  if (privateEnvironment && readFileSync(join(dir, ".env"), "utf8") !== privateEnvironment)
    throw new Error("Starter regeneration changed private local setup");
  log(
    `PASS ${upgradeMode ? "reviewed starter upgrade" : starterMode ? "editable starter" : "generated resource workspace"} (${packChecks} template checks, ${skippedChecks} explicitly inapplicable; zero implementation tasks; ${journeys.join(", ")}); archive hashes preserved, generated composition integrity and project extras retained, no model calls`,
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

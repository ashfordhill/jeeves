import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { architectureViews, localExecutionConfigSchema, validateDesign } from "@jeeves/spec";
import { afterEach, expect, it } from "vitest";
import { generateProject } from "./generate.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const templates = templateSet();
const plan = (design = fixtureDesign("local-execution")) =>
  planProject(design, templates, { projectName: "Execution" });
it("keeps legacy runtime output and limits policy attachment to the explicit new service version", () => {
  const design = fixtureDesign("local-execution");
  expect(validateDesign(design, templates.lookup)).toEqual([]);
  expect(
    localExecutionConfigSchema.safeParse({ preset: "balanced", memory: "unbounded" }).success,
  ).toBe(false);
  design.elements[0]!.template!.version = "0.2.0";
  expect(
    validateDesign(design, templates.lookup).some((f) => f.code === "ATTACHMENT_INCOMPATIBLE"),
  ).toBe(true);
  design.elements[0]!.attachments = [];
  const legacy = plan(design);
  design.elements[0]!.template!.version = "0.3.0";
  const current = plan(design);
  expect(current.compose).toEqual(legacy.compose);
  // Design/provenance documentation intentionally records the selected version.
  const runtime = (files: typeof legacy.files) =>
    files.filter((f) => f.path.startsWith("services/") && !f.path.endsWith("AGENTS.md"));
  expect(runtime(current.files)).toEqual(runtime(legacy.files));
  expect(current.runtimes).toEqual(legacy.runtimes);
});
it("projects limits onto the existing container and preserves strict finite presets", () => {
  const design = fixtureDesign("local-execution");
  const views = architectureViews(design, templates.lookup, "Execution");
  expect(views.containers.nodes[0]?.execution).toMatchObject({
    preset: "balanced",
    cpus: 1,
    memoryMiB: 768,
  });
  expect(views.components[0]?.execution).toMatchObject({ restart: "on-failure:5" });
  expect(views.components[0]?.nodes.some((n) => n.binding?.attachment === "execution")).toBe(false);
  expect(views.components[0]?.edges).toEqual([]);
  for (const [preset, cpus, memory, pids, restart, grace, shutdown] of [
    ["compact", 0.5, "512m", 128, "on-failure:3", "20s", "15000"],
    ["balanced", 1, "768m", 192, "on-failure:5", "25s", "20000"],
    ["expanded", 2, "1536m", 256, "on-failure:5", "35s", "30000"],
  ]) {
    design.elements[0]!.attachments[0]!.config = { preset };
    expect(plan(design).compose.services.service).toMatchObject({
      cpus,
      mem_limit: memory,
      pids_limit: pids,
      init: true,
      restart,
      stop_grace_period: grace,
      environment: { SHUTDOWN_TIMEOUT_MS: shutdown },
    });
  }
});
it("updates and removes generated policy safely while preserving project implementation and refusing edited owned policy", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-execution-unit-"));
  dirs.push(dir);
  const design = fixtureDesign("local-execution");
  const generate = () =>
    generateProject({ dir, design, projectName: "Execution", git: false, vendor: fakeVendor });
  const first = await generate();
  expect(first.ok).toBe(true);
  const main = join(dir, "services/service/src/main.ts"),
    policy = join(dir, "services/service/execution-policy.generated.json");
  writeFileSync(main, "// preserved project implementation\n");
  design.elements[0]!.attachments[0]!.config.preset = "compact";
  expect((await generate()).ok).toBe(true);
  expect(JSON.parse(readFileSync(policy, "utf8")).cpus).toBe(0.5);
  const original = readFileSync(policy, "utf8"),
    lock = readFileSync(join(dir, "jeeves/lock.json"), "utf8");
  writeFileSync(policy, "edited");
  expect(await generate()).toMatchObject({ ok: false, reason: "ownership" });
  expect(readFileSync(join(dir, "jeeves/lock.json"), "utf8")).toBe(lock);
  writeFileSync(policy, original);
  design.elements[0]!.attachments = [];
  const removed = await generate();
  expect(removed.ok).toBe(true);
  if (removed.ok)
    expect(removed.plan.compose.services.service).toMatchObject({
      restart: "unless-stopped",
      stop_grace_period: "15s",
      environment: { SHUTDOWN_TIMEOUT_MS: "10000" },
    });
  expect(readFileSync(main, "utf8")).toBe("// preserved project implementation\n");
});

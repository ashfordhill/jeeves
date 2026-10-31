import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { architectureViews, localHttpPoolProblems, validateDesign } from "@jeeves/spec";
import { createGenerateContext } from "@jeeves/template-kit";
import { afterEach, expect, it } from "vitest";
import { seedPlan } from "../../orchestrator/src/seed.ts";
import { assertGeneratedIntegrity } from "./baseline/behavior.ts";
import { poolCheckContexts } from "./baseline/pool-context.ts";
import { generateProject } from "./generate.ts";
import { lockFor } from "./lock.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { assertPoolSourcePreflight } from "./pool-source.ts";
import { createStarterDesign } from "./starters.ts";
import { fakeVendor } from "./test-support.ts";

const templates = templateSet(),
  dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const designFor = () => {
  const design = createStarterDesign(
    { id: "resource-workspace", version: "0.1.0" },
    { title: "Fieldwork", hostPort: 4412 },
  ).design;
  const service = design.elements.find((e) => e.id === "inventory")!;
  service.template!.version = "0.4.0";
  service.attachments.push(
    {
      id: "execution",
      template: { id: "local-execution", version: "0.1.0" },
      config: { preset: "compact" },
      notes: "",
    },
    {
      id: "pool",
      template: { id: "local-http-pool", version: "0.1.0" },
      config: { replicas: 3 },
      notes: "",
    },
  );
  return design;
};
const plan = (design = designFor()) => planProject(design, templates, { projectName: "Pool" });
it("preserves unpooled output and applies fully merged instance wiring without extra C4 applications or tasks", () => {
  const design = designFor(),
    service = design.elements[0]!;
  expect(validateDesign(design, templates.lookup)).toEqual([]);
  const pooled = plan(design),
    lock = lockFor(pooled, 0);
  expect(plan(design)).toEqual(pooled);
  expect(pooled.httpPools?.inventory?.instances).toHaveLength(3);
  expect(pooled.compose.services.inventory?.image).toContain("@sha256:");
  for (const id of pooled.httpPools!.inventory!.instances)
    expect(pooled.compose.services[id]).toMatchObject({
      cpus: 0.5,
      mem_limit: "512m",
      environment: { DATABASE_HOST: "inventory-db", SHUTDOWN_TIMEOUT_MS: "15000" },
    });
  expect(seedPlan({ design, lock, templates: templates.lookup })).toEqual([]);
  const views = architectureViews(design, templates.lookup, "Pool");
  expect(views.containers.nodes.filter((node) => node.kind === "container")).toHaveLength(3);
  expect(
    views.containers.nodes.find((node) => node.binding?.element === "inventory")?.pool?.replicas,
  ).toBe(3);
  expect(
    views.components
      .find((scope) => scope.container === "inventory")
      ?.nodes.some((node) => node.binding?.attachment === "pool"),
  ).toBe(false);
  service.attachments.pop();
  const unpooled = plan(design);
  service.template!.version = "0.3.0";
  const previous = plan(design);
  expect(unpooled.compose).toEqual(previous.compose);
  expect(unpooled.runtimes).toEqual(previous.runtimes);
  expect(unpooled.compose.services["inventory-web"]).toEqual(
    pooled.compose.services["inventory-web"],
  );
});
it("refuses unsupported state, ports and name collisions rather than treating HTTP as automatically stateless", () => {
  for (const mutate of [
    (design: ReturnType<typeof designFor>) => {
      design.elements[0]!.notes = "Run a timer";
    },
    (design: ReturnType<typeof designFor>) => {
      design.elements[0]!.config.replicas = 2;
    },
    (design: ReturnType<typeof designFor>) => {
      design.elements[0]!.config.port = 80;
    },
    (design: ReturnType<typeof designFor>) => {
      design.elements[0]!.attachments = design.elements[0]!.attachments.filter(
        (a) => a.id !== "execution",
      );
    },
    (design: ReturnType<typeof designFor>) => {
      design.elements[0]!.attachments.push({
        id: "custom",
        template: { id: "durable-events", version: "0.1.0" },
        config: {},
        notes: "",
      });
    },
    (design: ReturnType<typeof designFor>) => {
      design.elements.push({ ...structuredClone(design.elements[0]!), id: "inventory-instance-1" });
    },
  ]) {
    const design = designFor();
    mutate(design);
    expect(localHttpPoolProblems(design, design.elements[0]!)).not.toEqual([]);
    expect(() => plan(design)).toThrow();
  }
});
it("protects the supported project source before writes and verifies it after generation; policy removal preserves files and setup", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-pool-unit-"));
  dirs.push(dir);
  const design = designFor();
  const generate = () =>
    generateProject({ dir, design, projectName: "Pool", vendor: fakeVendor, git: false });
  const first = await generate();
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  assertGeneratedIntegrity(dir, first.lock);
  const previousLock = readFileSync(join(dir, "jeeves/lock.json"), "utf8"),
    env = readFileSync(join(dir, ".env"), "utf8");
  const main = join(dir, "services/inventory/src/main.ts"),
    original = readFileSync(main, "utf8");
  writeFileSync(main, original + "\nsetInterval(() => {}, 1000);\n");
  await expect(generate()).rejects.toThrow("local HTTP pool");
  expect(() => assertGeneratedIntegrity(dir, first.lock)).toThrow("local HTTP pool");
  expect(readFileSync(join(dir, "jeeves/lock.json"), "utf8")).toBe(previousLock);
  writeFileSync(main, original);
  const pkg = join(dir, "services/inventory/package.json"),
    previousPackage = readFileSync(pkg, "utf8"),
    altered = JSON.parse(previousPackage);
  altered.scripts.start = "node custom.ts";
  writeFileSync(pkg, JSON.stringify(altered));
  await expect(generate()).rejects.toThrow("local HTTP pool");
  writeFileSync(pkg, previousPackage);
  const docker = join(dir, "services/inventory/Dockerfile"),
    originalDocker = readFileSync(docker, "utf8");
  writeFileSync(docker, "# syntax=unreviewed/frontend\n" + originalDocker);
  await expect(generate()).rejects.toThrow("local HTTP pool");
  writeFileSync(docker, originalDocker);
  const custom = join(dir, "services/inventory/src/features/dist");
  mkdirSync(custom);
  writeFileSync(join(custom, "index.ts"), "export default {};");
  await expect(generate()).rejects.toThrow("local HTTP pool");
  rmSync(custom, { recursive: true });
  const linked = join(dir, "services/inventory/src/linked.ts");
  symlinkSync(main, linked);
  await expect(generate()).rejects.toThrow("local HTTP pool");
  rmSync(linked);
  const serviceRoot = join(dir, "services/inventory"),
    savedRoot = join(dir, "saved-api");
  renameSync(serviceRoot, savedRoot);
  symlinkSync(join(dir, "missing-api"), serviceRoot);
  expect(() => assertPoolSourcePreflight(dir, first.plan)).toThrow("local HTTP pool");
  expect(await generate()).toMatchObject({ ok: false, reason: "ownership" });
  expect(readFileSync(join(dir, "jeeves/lock.json"), "utf8")).toBe(previousLock);
  expect(readFileSync(join(dir, ".env"), "utf8")).toBe(env);
  rmSync(serviceRoot);
  renameSync(savedRoot, serviceRoot);
  const config = join(dir, "infrastructure/http-pools/inventory/haproxy.cfg"),
    previousConfig = readFileSync(config, "utf8");
  writeFileSync(config, "edited");
  expect(await generate()).toMatchObject({ ok: false, reason: "ownership" });
  writeFileSync(config, previousConfig);
  design.elements[0]!.attachments.find((a) => a.id === "pool")!.config.replicas = 2;
  expect((await generate()).ok).toBe(true);
  design.elements[0]!.attachments = design.elements[0]!.attachments.filter((a) => a.id !== "pool");
  writeFileSync(main, original + "\n// User source retained when opting out\n");
  const removed = await generate();
  expect(removed.ok).toBe(true);
  if (removed.ok) {
    expect(removed.plan.httpPools).toBeUndefined();
    expect(removed.orphaned).toContain("infrastructure/http-pools/inventory/haproxy.cfg");
  }
  expect(readFileSync(main, "utf8")).toContain("User source retained");
  expect(readFileSync(join(dir, ".env"), "utf8")).toBe(env);
});
it("routes physical lifecycle checks to every instance while retaining the logical REST endpoint and database metadata", () => {
  const design = designFor(),
    generated = plan(design);
  const context = (attachment?: string) => ({
    projectDir: "/unused",
    subject: createGenerateContext(design, templates.lookup, "inventory", attachment),
    compose: generated.compose,
    service: (name: string) => ({ name }) as never,
    log() {},
  });
  expect(poolCheckContexts(design, context()).map((ctx) => ctx.service("inventory").name)).toEqual([
    "inventory-instance-1",
    "inventory-instance-2",
    "inventory-instance-3",
  ]);
  const rest = poolCheckContexts(design, context("inventory-api"));
  expect(rest).toHaveLength(1);
  expect(rest[0]!.service("inventory").name).toBe("inventory");
  expect(rest[0]!.compose.services.inventory?.environment?.DATABASE_HOST).toBe("inventory-db");
  const physical = context("pool");
  expect(poolCheckContexts(design, physical)).toEqual([physical]);
});

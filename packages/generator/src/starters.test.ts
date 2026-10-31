import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { designSchema, type ResourceConfig, validateDesign } from "@jeeves/spec";
import { afterEach, expect, it, vi } from "vitest";
import { seedPlan } from "../../orchestrator/src/seed.ts";
import { missingComposeEnvironment } from "./baseline/compose.ts";
import { generateProject } from "./generate.ts";
import { templateSet } from "./modules.ts";
import { starterEnvironment } from "./starter-environment.ts";
import { createStarterDesign, starterCatalog } from "./starters.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const ref = { id: "resource-workspace", version: "0.1.0" };
const fresh = () => createStarterDesign(ref, { title: "Fieldwork", hostPort: 18296 });
const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-starter-unit-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const generate = (dir: string, design = fresh().design) =>
  generateProject({ dir, design, projectName: "Fieldwork", git: false, vendor: fakeVendor });

it("loads pinned editable copies with deliberate context and finite configuration, leaving old documents unchanged", () => {
  const entry = starterCatalog()[0]!;
  expect(entry).toMatchObject({
    ...ref,
    maturity: "experimental",
    manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  const { design, layout } = fresh();
  expect(design.startedFrom).toEqual({ ...ref, manifestSha256: entry.manifestSha256 });
  expect(design.recipe).toBeUndefined();
  expect(design.architecture?.system.name).toBe("Fieldwork");
  expect(design.architecture?.nodes).toHaveLength(1);
  expect(Object.keys(layout.items)).toHaveLength(3);
  expect(validateDesign(design, templateSet().lookup)).toEqual([]);
  (design.elements[0]!.attachments[0]!.config.model as ResourceConfig).resources[0]!
    .fields[0]!.name = "displayName";
  expect(validateDesign(design, templateSet().lookup)).toEqual([]);
  expect(fresh().design).not.toEqual(design);
  expect(() =>
    createStarterDesign({ ...ref, version: "9.0.0" }, { title: "x", hostPort: 12345 }),
  ).toThrow("Unknown architecture starter");
  expect(() =>
    createStarterDesign(ref, { title: "x", hostPort: 12345, config: { pageSize: 100 } }),
  ).toThrow();
  const old = fixtureDesign("qrwty");
  expect(designSchema.parse(old)).toEqual(old);
  expect(old.startedFrom).toBeUndefined();
});

it("generates private complete local setup with no implementation tasks and preserves secrets on regeneration", async () => {
  const dir = temp(),
    design = fresh().design;
  const first = await generate(dir, design);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  expect(seedPlan({ design, lock: first.lock, templates: templateSet().lookup })).toEqual([]);
  const env = readFileSync(join(dir, ".env"), "utf8"),
    values = parseEnv(env);
  expect(statSync(join(dir, ".env")).mode & 0o777).toBe(0o600);
  expect(values.INVENTORY_PUBLIC_ORIGIN).toBe("http://127.0.0.1:18296");
  expect(values.DB_INVENTORY_PASSWORD).toMatch(/^[a-f0-9]{48}$/);
  expect(missingComposeEnvironment(dir, {})).toEqual([]);
  expect(readFileSync(join(dir, ".gitignore"), "utf8")).toMatch(/^\.env$/m);
  for (const path of Object.keys(first.lock.files))
    expect(readFileSync(join(dir, path), "utf8")).not.toContain(values.DB_INVENTORY_PASSWORD);
  expect((await generate(dir, design)).ok).toBe(true);
  expect(readFileSync(join(dir, ".env"), "utf8")).toBe(env);
  const lock = readFileSync(join(dir, "jeeves/lock.json"));
  design.elements.find((element) => element.id === "inventory-web")!.config.hostPort = 18297;
  await expect(generate(dir, design)).rejects.toThrow("Existing INVENTORY_PUBLIC_ORIGIN");
  expect(readFileSync(join(dir, "jeeves/lock.json"))).toEqual(lock);
  expect(readFileSync(join(dir, ".env"), "utf8")).toBe(env);
  rmSync(join(dir, ".env"));
  await expect(generate(dir, fresh().design)).rejects.toThrow("has no .env");
  expect(readFileSync(join(dir, "jeeves/lock.json"))).toEqual(lock);
});

it("refuses unknown origins, ambient credentials, ambiguous mappings and nonempty adoption before creating files", async () => {
  const design = fresh().design,
    dir = temp();
  design.startedFrom!.manifestSha256 = "0".repeat(64);
  expect(() => starterEnvironment(dir, design, { fresh: true })).toThrow("origin does not match");
  const document = fresh().design;
  vi.stubEnv("DB_INVENTORY_PASSWORD", "ambient");
  await expect(generate(dir, document)).rejects.toThrow("Remove ambient DB_INVENTORY_PASSWORD");
  vi.unstubAllEnvs();
  const web = structuredClone(document.elements.find((element) => element.id === "inventory-web")!);
  web.id = "second-web";
  web.config.hostPort = 18298;
  const call = structuredClone(
    document.connections.find((connection) => connection.id === "inventory-call")!,
  );
  call.id = "second-call";
  call.from.element = web.id;
  web.attachments.find(
    (attachment) => attachment.template.id === "resource-workspace",
  )!.config.connection = call.id;
  document.elements.push(web);
  document.connections.push(call);
  expect(() => starterEnvironment(dir, document, { fresh: true })).toThrow(
    "Ambiguous public origin",
  );
  writeFileSync(join(dir, "valuable.txt"), "keep");
  await expect(generate(dir)).rejects.toThrow("new empty output folder");
  expect(readFileSync(join(dir, "valuable.txt"), "utf8")).toBe("keep");
});

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { httpServiceTemplate } from "@jeeves/template-http-service/template";
import { buildProject, vendorRuntimes } from "@jeeves/template-kit/harness";
import {
  restApiServerTemplate,
  restApiServerV02Template,
} from "@jeeves/template-rest-api-server/template";
import { afterEach, expect, it } from "vitest";
import { seedPlan } from "../../orchestrator/src/seed.ts";
import { assertGeneratedIntegrity } from "./baseline/behavior.ts";
import { generateProject } from "./generate.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { createRecipeDesign, loadRecipe } from "./recipes.ts";
import { createStarterDesign } from "./starters.ts";
import { fakeVendor } from "./test-support.ts";

const templates = templateSet();
const fresh = (version = "0.2.0") => {
  const design = createStarterDesign(
    { id: "resource-workspace", version: "0.1.0" },
    { title: "Session proof", hostPort: 18297 },
  ).design;
  design.elements
    .find((e) => e.id === "inventory")!
    .attachments.find((a) => a.template.id === "rest-api-server")!.template.version = version;
  return design;
};
const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-session-generation-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const generate = (dir: string, design = fresh()) =>
  generateProject({ dir, design, projectName: "Session proof", git: false, vendor: fakeVendor });

it("pins each selected REST release, preserving starter/recipe bytes and identical storage contracts", () => {
  const old = planProject(fresh("0.1.0"), templates, { projectName: "Session proof" });
  const current = planProject(fresh(), templates, { projectName: "Session proof" });
  for (const [plan, version] of [
    [old, "0.2.0"],
    [current, "0.3.0"],
  ] as const) {
    expect(plan.runtimes.find((r) => r.name === "@jeeves/rest-server")?.version).toBe(version);
    const file = plan.artifacts!.find((f) => f.path.endsWith(`jeeves-rest-server-${version}.tgz`))!;
    const manifest = JSON.parse(
      readFileSync(
        new URL(`../../../artifacts/rest-server/${version}/manifest.json`, import.meta.url),
        "utf8",
      ),
    );
    expect(createHash("sha256").update(file.contents).digest("hex")).toBe(manifest.sha256);
    expect(plan.packageEdits.find((e) => e.element === "inventory")!.dependencies).toContainEqual({
      name: "@jeeves/rest-server",
      spec: `file:../../vendor/jeeves/jeeves-rest-server-${version}.tgz`,
    });
  }
  const storage = (plan: typeof old) =>
    plan.files.filter((f) => /resource-migrations|src\/generated\/resources/.test(f.path));
  expect(storage(current)).toEqual(storage(old));
  expect(
    current.files.find((f) => f.path === "contracts/inventory.openapi.yaml")!.contents,
  ).toContain("jeeves_session_<origin-sha256>");
  expect(
    old.files.find((f) => f.path === "contracts/inventory.openapi.yaml")!.contents,
  ).not.toContain("origin-sha256");
  const recipe = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { title: "Frozen", hostPort: 18298 },
  ).design;
  const plannedRecipe = planProject(recipe, templates, { projectName: "Frozen" });
  const frozenRecipe = loadRecipe({ id: "qr-studio", version: "0.1.0" });
  for (const file of frozenRecipe.artifacts) {
    const matches = plannedRecipe.artifacts!.filter((f) => f.path === file.path);
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) expect(match.contents).toEqual(file.contents);
  }
  expect(plannedRecipe.runtimes.find((r) => r.name === "@jeeves/rest-server")?.version).toBe(
    "0.2.0",
  );
});

it("generates deterministically without implementation tasks and protects archives, source and private setup", async () => {
  const a = temp(),
    b = temp(),
    design = fresh();
  const first = await generate(a, design),
    second = await generate(b, design);
  if (!first.ok || !second.ok) throw new Error("Expected generation success");
  expect(first.lock).toEqual(second.lock);
  for (const path of Object.keys(first.lock.files))
    expect(readFileSync(join(a, path))).toEqual(readFileSync(join(b, path)));
  expect(seedPlan({ design, lock: first.lock, templates: templates.lookup })).toEqual([]);
  const extra = "frontends/inventory-web/src/project/ProjectExtras.tsx";
  const contents = "export function ProjectExtras() { return <p>Retained</p>; }\n";
  writeFileSync(join(a, extra), contents);
  const environment = readFileSync(join(a, ".env"));
  const again = await generate(a, design);
  expect(again.ok && again.written).toEqual([]);
  expect(readFileSync(join(a, extra), "utf8")).toBe(contents);
  expect(readFileSync(join(a, ".env"))).toEqual(environment);
  assertGeneratedIntegrity(a, first.lock);
  for (const path of [
    "contracts/inventory.openapi.yaml",
    "vendor/jeeves/jeeves-rest-server-0.3.0.tgz",
  ]) {
    const original = readFileSync(join(a, path));
    writeFileSync(join(a, path), "edited");
    expect(await generate(a, design)).toMatchObject({
      ok: false,
      reason: "ownership",
      problems: [expect.objectContaining({ path, kind: "edited" })],
    });
    expect(readFileSync(join(a, ".env"))).toEqual(environment);
    writeFileSync(join(a, path), original);
  }
});

it("refuses mixed bindings before generator or harness writes, in either ordering", async () => {
  for (const reverse of [false, true]) {
    const design = fresh();
    const service = structuredClone(design.elements.find((e) => e.id === "inventory")!);
    service.id = "legacy";
    service.attachments = [
      {
        id: "legacy-api",
        template: { id: "rest-api-server", version: "0.1.0" },
        config: {},
        notes: "",
      },
    ];
    design.elements.push(service);
    if (reverse) design.elements.reverse();
    const dir = temp();
    writeFileSync(join(dir, "keep.txt"), "unrelated");
    await expect(generate(dir, design)).rejects.toThrow(
      "Conflicting runtime bindings for @jeeves/rest-server",
    );
    expect(readdirSync(dir)).toEqual(["keep.txt"]);
    const modules = [httpServiceTemplate, restApiServerTemplate, restApiServerV02Template];
    if (reverse) modules.reverse();
    expect(() => buildProject({ dir, design, lookup: templates.lookup, modules })).toThrow(
      /Conflicting runtime bindings/,
    );
    expect(() => vendorRuntimes(dir, modules)).toThrow(/Conflicting runtime bindings/);
    expect(existsSync(join(dir, "vendor"))).toBe(false);
    expect(readdirSync(dir)).toEqual(["keep.txt"]);
  }
});

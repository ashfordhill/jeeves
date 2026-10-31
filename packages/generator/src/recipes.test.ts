import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { designSchema, type ResourceConfig } from "@jeeves/spec";
import { afterEach, expect, it } from "vitest";
import { generateProject } from "./generate.ts";
import { templateSet } from "./modules.ts";
import {
  createRecipeDesign,
  loadRecipe,
  recipeCatalog,
  recipeCoverage,
  recipeFindings,
} from "./recipes.ts";
import { fixtureDesign } from "./test-support.ts";

const ref = { id: "qr-studio", version: "0.1.0" };
const lookup = templateSet().lookup;
const fresh = () => createRecipeDesign(ref, { title: "Recipe proof", hostPort: 18287 }).design;
const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-recipe-unit-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const generate = (dir: string, design = fresh()) =>
  generateProject({
    dir,
    design,
    projectName: "Recipe proof",
    git: false,
    vendor: async (_dir, runtimes) => {
      expect(runtimes).toEqual([]);
      return [];
    },
  });

it("keeps old documents unchanged and validates bounded recipe configuration/core contracts", () => {
  const old = fixtureDesign("qrwty");
  expect(designSchema.parse(old)).toEqual(old);
  expect(old).not.toHaveProperty("recipe");
  expect(recipeFindings(fresh(), lookup)).toEqual([]);
  expect(() =>
    createRecipeDesign(ref, { title: "x", hostPort: 18287, config: { analyticsDays: 365 } }),
  ).toThrow();
  const changed = fresh();
  changed.elements = changed.elements.filter((e) => e.id !== "qrwty-db");
  expect(recipeFindings(changed, lookup)[0]).toMatchObject({
    code: "RECIPE_INCOMPATIBLE",
    severity: "error",
  });
  expect(() => loadRecipe({ ...ref, version: "9.0.0" })).toThrow(/Unknown recipe/);
});

it("generates pinned implementations/artifacts deterministically, preserves extras and protects private origin", async () => {
  const dir = temp(),
    other = temp();
  const first = await generate(dir),
    second = await generate(other);
  if (!first.ok || !second.ok) throw new Error("Expected generation");
  expect(first.lock).toEqual(second.lock);
  for (const path of Object.keys(first.lock.files))
    expect(readFileSync(join(dir, path))).toEqual(readFileSync(join(other, path)));
  expect(first.lock.recipe).toEqual(loadRecipe(ref).registration);
  expect(recipeCoverage(fresh(), first.lock, lookup)?.operations.qrwty).toContain("ownerAnalytics");
  expect(statSync(join(dir, ".env")).mode & 0o777).toBe(0o600);
  const environment = readFileSync(join(dir, ".env"));
  const seam = "frontends/qrwty-web/src/ProjectExtras.tsx";
  writeFileSync(
    join(dir, seam),
    "// Project customization\nexport function ProjectExtras() { return null; }\n",
  );
  const again = await generate(dir);
  expect(again.ok && again.written).toEqual([]);
  expect(again.ok && again.packages).toEqual([]);
  expect(readFileSync(join(dir, seam), "utf8")).toContain("Project customization");
  expect(readFileSync(join(dir, ".env"))).toEqual(environment);
  const changed = fresh();
  changed.elements.find((e) => e.id === "qrwty-web")!.config.hostPort = 18288;
  await expect(generate(dir, changed)).rejects.toThrow(/origin|ORIGIN/);
  expect(readFileSync(join(dir, ".env"))).toEqual(environment);
});

it("refuses adoption, edited protected source/binaries and recipe detachment before writes", async () => {
  const dir = temp();
  writeFileSync(join(dir, "existing.txt"), "keep");
  await expect(generate(dir)).rejects.toThrow(/new empty/);
  expect(readFileSync(join(dir, "existing.txt"), "utf8")).toBe("keep");
  const output = temp();
  const initial = await generate(output);
  if (!initial.ok) throw new Error("Expected generation");
  const lockBefore = readFileSync(join(output, "jeeves/lock.json"));
  for (const path of [
    "frontends/qrwty-web/src/pages/Home.tsx",
    "vendor/jeeves/jeeves-rest-server-0.2.0.tgz",
  ]) {
    const original = readFileSync(join(output, path));
    writeFileSync(join(output, path), "edited");
    expect(await generate(output)).toMatchObject({
      ok: false,
      reason: "ownership",
      problems: [expect.objectContaining({ path, kind: "edited" })],
    });
    expect(readFileSync(join(output, "jeeves/lock.json"))).toEqual(lockBefore);
    writeFileSync(join(output, path), original);
  }
  const detached = fresh();
  delete detached.recipe;
  await expect(generate(output, detached)).rejects.toThrow(/reviewed ownership/);
});

it("refuses dependency drift and altered core contracts but accepts branding and independent additions", async () => {
  const dir = temp();
  await generate(dir);
  const file = join(dir, "frontends/qrwty-web/package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  pkg.dependencies.react = "99.0.0";
  writeFileSync(file, JSON.stringify(pkg));
  await expect(generate(dir)).rejects.toThrow(/dependency.*react/);
  const changed = fresh();
  changed.recipe!.config.tagline = "An independently configured product";
  changed.elements.find((e) => e.id === "qrwty")!.notes = "Implementation is supplied";
  expect(recipeFindings(changed, lookup)).toEqual([]);
  const altered = fresh();
  altered.connections[0]!.kind = "depends-on";
  expect(recipeFindings(altered, lookup)).toHaveLength(1);
  const existing = temp();
  mkdirSync(join(existing, "src"));
  await expect(generate(existing)).rejects.toThrow(/new empty/);
});

it("publishes protected resource boundaries from the immutable recipe and permits separate additions", () => {
  const metadata = recipeCatalog().find((item) => item.id === ref.id)!;
  const design = fresh();
  const service = design.elements.find((item) => item.id === "qrwty")!;
  const model = service.attachments[0]!.config.model as ResourceConfig;
  expect(metadata.resourceBindings).toEqual([
    {
      element: service.id,
      attachment: service.attachments[0]!.id,
      resourceIds: model.resources.map((item) => item.id),
      storeConnection: model.storeConnection,
    },
  ]);
  model.resources.push({
    id: "independent",
    name: "inventory",
    access: "owner",
    fields: [],
    belongsTo: [],
    operations: ["create", "list"],
  });
  expect(recipeFindings(design, lookup)).toEqual([]);
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyOperations,
  compatibleTemplateUpgrades,
  type DesignDocument,
  reviewTemplateUpgrade,
  subtypeDiscards,
  type TemplateRef,
  upgradeDesign,
} from "@jeeves/spec";
import { afterEach, expect, it } from "vitest";
import { z } from "zod";
import { generateProject } from "./generate.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { createRecipeDesign } from "./recipes.ts";
import { createStarterDesign } from "./starters.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const templates = templateSet();
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const upgrade = (design: DesignDocument, id: string, to: TemplateRef) =>
  applyOperations(
    design,
    [
      {
        op: "upgradeTemplate",
        id,
        from: design.elements.find((e) => e.id === id)!.template!,
        to,
        revision: design.revision,
      },
    ],
    templates.lookup,
  );
const runtimeFiles = (plan: ReturnType<typeof planProject>) =>
  plan.files.filter(
    (file) =>
      /^(services|frontends|databases|contracts)\//.test(file.path) &&
      !file.path.endsWith("AGENTS.md"),
  );
it("every reviewed path retains exact runtime, contracts, Compose and runtime dependencies with only a version reference changed", () => {
  for (const path of compatibleTemplateUpgrades) {
    const design = fixtureDesign("link-shortener");
    const element = design.elements.find((e) => e.template?.id === path.id)!;
    element.template!.version = path.from;
    element.notes = "Keep this business intent";
    const before = planProject(design, templates, { projectName: "Upgrade" });
    const result = upgrade(design, element.id, { id: path.id, version: path.to });
    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    const expected = upgradeDesign(design);
    expected.revision++;
    expected.elements.find((e) => e.id === element.id)!.template!.version = path.to;
    expect(result.design).toEqual(expected);
    const after = planProject(result.design, templates, { projectName: "Upgrade" });
    expect(after.compose).toEqual(before.compose);
    expect(runtimeFiles(after)).toEqual(runtimeFiles(before));
    expect(after.runtimes).toEqual(before.runtimes);
    expect(after.artifacts).toEqual(before.artifacts);
  }
});
it("refuses unknown/reverse/cross-template, stale, recipe and contract-drift upgrades atomically without destructive fallbacks", () => {
  const design = fixtureDesign("local-execution");
  design.elements[0]!.attachments = [];
  design.elements[0]!.template!.version = "0.2.0";
  const to = { id: "http-service", version: "0.3.0" };
  for (const target of [
    { id: "http-service", version: "0.1.0" },
    { id: "http-service", version: "9.0.0" },
    { id: "web-app", version: "0.2.0" },
  ])
    expect(upgrade(design, "service", target).ok).toBe(false);
  expect(
    applyOperations(
      design,
      [
        {
          op: "upgradeTemplate",
          id: "service",
          from: design.elements[0]!.template!,
          to,
          revision: 999,
        },
      ],
      templates.lookup,
    ),
  ).toMatchObject({ ok: false, errors: [{ code: "REVISION_CONFLICT" }] });
  expect(
    applyOperations(
      design,
      [{ op: "updateElement", id: "service", template: to }],
      templates.lookup,
    ).ok,
  ).toBe(false);
  expect(
    applyOperations(
      design,
      [
        {
          op: "changeSubtype",
          id: "service",
          template: to,
          confirmation: {
            revision: design.revision,
            discarded: subtypeDiscards(design, design.elements[0]!),
          },
        },
      ],
      templates.lookup,
    ).ok,
  ).toBe(false);
  const original = structuredClone(design);
  expect(
    applyOperations(
      design,
      [
        { op: "setNotes", id: "service", notes: "Must roll back" },
        {
          op: "upgradeTemplate",
          id: "service",
          from: { id: "http-service", version: "0.1.0" },
          to,
          revision: 0,
        },
      ],
      templates.lookup,
    ).ok,
  ).toBe(false);
  expect(design).toEqual(original);
  const recipe = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { title: "Recipe", hostPort: 5112 },
  ).design;
  const service = recipe.elements.find((e) => e.template?.id === "http-service")!;
  expect(reviewTemplateUpgrade(recipe, service.id, to, templates.lookup)).toMatchObject({
    ok: false,
    reason: expect.stringContaining("protected recipe"),
  });
  expect(
    applyOperations(
      recipe,
      [
        { op: "setRecipe", recipe: null },
        {
          op: "upgradeTemplate",
          id: service.id,
          from: service.template!,
          to,
          revision: recipe.revision,
        },
      ],
      templates.lookup,
    ).ok,
  ).toBe(false);
  for (const drift of ["defaults", "ports"]) {
    const lookup = {
      ...templates.lookup,
      get(ref: TemplateRef) {
        const target = templates.lookup.get(ref);
        if (ref.id !== to.id || ref.version !== to.version || target?.kind !== "element")
          return target;
        return drift === "defaults"
          ? { ...target, config: target.config.extend({ port: z.int().default(9090) }) }
          : { ...target, ports: [] };
      },
    };
    expect(reviewTemplateUpgrade(design, "service", to, lookup).ok).toBe(false);
  }
});
it("regenerates an editable starter upgrade while retaining custom source/private setup and refuses hand-edited owned output", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-upgrade-unit-"));
  dirs.push(dir);
  let design = createStarterDesign(
    { id: "resource-workspace", version: "0.1.0" },
    { title: "Upgrade", hostPort: 5111 },
  ).design;
  const generate = () =>
    generateProject({ dir, design, projectName: "Upgrade", git: false, vendor: fakeVendor });
  const first = await generate();
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  const env = readFileSync(join(dir, ".env"), "utf8");
  const main = join(dir, "services/inventory/src/main.ts");
  writeFileSync(main, "// retained custom source\n");
  const origin = structuredClone(design.startedFrom),
    wiring = structuredClone(design.connections);
  const result = upgrade(design, "inventory", { id: "http-service", version: "0.3.0" });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  design = result.design;
  const second = await generate();
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  expect(second.plan.compose).toEqual(first.plan.compose);
  expect(design.startedFrom).toEqual(origin);
  expect(design.connections).toEqual(wiring);
  expect(readFileSync(main, "utf8")).toBe("// retained custom source\n");
  expect(readFileSync(join(dir, ".env"), "utf8")).toBe(env);
  const owned = join(dir, "docker-compose.yml"),
    lock = readFileSync(join(dir, "jeeves/lock.json"), "utf8");
  writeFileSync(owned, "edited");
  expect(await generate()).toMatchObject({ ok: false, reason: "ownership" });
  expect(readFileSync(join(dir, "jeeves/lock.json"), "utf8")).toBe(lock);
});

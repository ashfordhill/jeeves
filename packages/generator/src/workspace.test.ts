import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  architectureViews,
  type ResourceConfig,
  validateDesign,
  type WorkspaceConfig,
  workspaceModel,
} from "@jeeves/spec";
import { afterEach, expect, it } from "vitest";
import { generateProject } from "./generate.ts";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { fakeVendor, fixtureDesign } from "./test-support.ts";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const design = () => fixtureDesign("generated-workspace");
const parts = (document: ReturnType<typeof design>) => {
  const web = document.elements.find((element) => element.id === "inventory-web")!;
  const attachment = web.attachments.find((item) => item.id === "inventory-workspace")!;
  return {
    web,
    attachment,
    config: attachment.config as WorkspaceConfig,
    resources: document.elements[0]!.attachments[0]!.config.model as ResourceConfig,
  };
};
it("derives workspace responsibility from real API bindings and refuses unsupported resource choices", () => {
  const document = design(),
    templates = templateSet();
  expect(validateDesign(document, templates.lookup)).toEqual([]);
  const view = architectureViews(document, templates.lookup, "Inventory").components.find(
    (item) => item.container === "inventory-web",
  )!;
  const workspace = view.nodes.find((node) => node.name === "Resource workspace")!;
  expect(workspace.support).toBe("template");
  expect(view.edges.find((edge) => edge.from === workspace.id)?.connection).toBe("inventory-call");
  expect(view.nodes.some((node) => node.name === "Application workspace")).toBe(false);
  parts(document).attachment.notes = "Add inventory help.";
  expect(
    architectureViews(document, templates.lookup, "Inventory")
      .components.find((item) => item.container === "inventory-web")!
      .nodes.find((node) => node.name === "Additional workspace content"),
  ).toMatchObject({ support: "extension", description: "Add inventory help." });
  const { web, config, resources } = parts(document);
  config.collections = [config.collections[1]!];
  expect(() => workspaceModel(document, web.id, "inventory-workspace")).toThrow(
    "required parent warehouse",
  );
  config.collections.unshift({
    resource: "warehouse",
    label: "Warehouses",
    singularLabel: "Warehouse",
    primaryField: "name",
    columns: ["name"],
  });
  resources.resources[0]!.operations = ["create", "read"];
  expect(() => workspaceModel(document, web.id, "inventory-workspace")).toThrow(
    "owner resource with list and read",
  );
  resources.resources[0]!.operations.push("list");
  config.collections[0]!.columns = ["missing-field"];
  expect(() => workspaceModel(document, web.id, "inventory-workspace")).toThrow(
    "display field missing-field",
  );
  config.collections[0]!.columns = ["name"];
  config.connection = "inventory-store";
  expect(() => workspaceModel(document, web.id, "inventory-workspace")).toThrow(
    "outgoing REST API",
  );
  config.connection = "inventory-call";
  web.template!.version = "0.1.0";
  expect(
    validateDesign(document, templates.lookup).some(
      (finding) => finding.code === "ATTACHMENT_INCOMPATIBLE",
    ),
  ).toBe(true);
});
it("regenerates safe display changes, preserves additive content, and refuses protected roots, archives, dependencies and binding removal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-workspace-unit-"));
  directories.push(dir);
  const document = design();
  const generate = () =>
    generateProject({
      dir,
      design: document,
      projectName: "Inventory",
      git: false,
      vendor: fakeVendor,
    });
  const first = await generate();
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  const root = "frontends/inventory-web/src/";
  for (const path of ["App.tsx", "main.tsx", "styles.css", "workspace.generated.json"])
    expect(first.lock.files[root + path]).toMatch(/^sha256-/);
  expect(first.plan.artifacts?.map((file) => file.path).sort()).toEqual([
    "vendor/jeeves/jeeves-product-ui-0.3.0.tgz",
    "vendor/jeeves/jeeves-resource-workspace-0.1.0.tgz",
    "vendor/jeeves/jeeves-rest-server-0.2.0.tgz",
  ]);
  const extras = join(dir, root + "project/ProjectExtras.tsx");
  writeFileSync(extras, "// custom additive content\n");
  const again = await generate();
  expect(again.ok && again.lock).toEqual(first.lock);
  const { web, attachment, config, resources } = parts(document);
  config.preset = "paper";
  resources.resources[0]!.fields[0]!.name = "displayName";
  const changed = await generate();
  expect(changed.ok).toBe(true);
  const descriptor = JSON.parse(readFileSync(join(dir, root + "workspace.generated.json"), "utf8"));
  expect(descriptor).toMatchObject({
    preset: "paper",
    collections: [
      { primaryField: "displayName", columns: ["displayName", "website", "createdAt"] },
      {},
    ],
  });
  expect(readFileSync(extras, "utf8")).toBe("// custom additive content\n");
  const published = readFileSync(join(dir, "jeeves/lock.json"), "utf8");
  web.attachments = web.attachments.filter((item) => item.id !== attachment.id);
  await expect(generate()).rejects.toThrow("reviewed ownership migration");
  web.attachments.push(attachment);
  const pkgPath = join(dir, "frontends/inventory-web/package.json"),
    pkgText = readFileSync(pkgPath, "utf8"),
    pkg = JSON.parse(pkgText);
  pkg.dependencies["@jeeves/resource-workspace"] = "9.0.0";
  writeFileSync(pkgPath, JSON.stringify(pkg));
  await expect(generate()).rejects.toThrow("pinned production dependency");
  writeFileSync(pkgPath, pkgText);
  const appPath = join(dir, root + "App.tsx"),
    app = readFileSync(appPath);
  writeFileSync(appPath, "// changed root\n");
  expect(await generate()).toMatchObject({
    ok: false,
    problems: expect.arrayContaining([
      expect.objectContaining({ path: root + "App.tsx", kind: "edited" }),
    ]),
  });
  writeFileSync(appPath, app);
  const archive = join(dir, first.plan.artifacts![0]!.path);
  writeFileSync(archive, "changed");
  expect(await generate()).toMatchObject({ ok: false, reason: "ownership" });
  expect(readFileSync(join(dir, "jeeves/lock.json"), "utf8")).toBe(published);
});
it("retains old web output and refuses implicit adoption of a project-owned frontend", async () => {
  const document = fixtureDesign("resource-workspace"),
    templates = templateSet();
  const old = planProject(document, templates, { projectName: "Inventory" });
  document.elements[2]!.template!.version = "0.2.0";
  const next = planProject(document, templates, { projectName: "Inventory" });
  const webFiles = (plan: typeof old) =>
    plan.files.filter((file) => file.path.startsWith("frontends/"));
  expect(webFiles(next)).toEqual(webFiles(old));
  const dir = mkdtempSync(join(tmpdir(), "jeeves-workspace-adoption-"));
  directories.push(dir);
  const options = {
    dir,
    design: document,
    projectName: "Inventory",
    git: false,
    vendor: fakeVendor,
  };
  expect((await generateProject(options)).ok).toBe(true);
  const root = join(dir, "frontends/inventory-web/src/App.tsx");
  writeFileSync(root, "// valuable project root\n");
  document.elements[2]!.attachments.push(parts(design()).attachment);
  expect(await generateProject(options)).toMatchObject({
    ok: false,
    problems: expect.arrayContaining([
      expect.objectContaining({ path: "frontends/inventory-web/src/App.tsx", kind: "unmanaged" }),
    ]),
  });
  expect(readFileSync(root, "utf8")).toBe("// valuable project root\n");
});

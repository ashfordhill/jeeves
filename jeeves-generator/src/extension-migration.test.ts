import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ownershipDesign } from "../../field-projects/generator-system/fixtures/rg-ownership/design.ts";
import { favoritesStackDesign } from "../../jeeves/packages/spec/src/fixtures/favorites-stack.ts";
import { stubStackDesign } from "../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../templates/local-v2/index.ts";
import { exportNewDirectory } from "./export.ts";
import { canonicalJson, sha256 } from "./json.ts";
import { updateDirectory } from "./update.ts";
import { assembleV2 } from "./v2/assemble.ts";
import { createV2Registry } from "./v2/registry.ts";

const registry = loadLocalV2Registry();
const real = assembleV2({ designJson: canonicalJson(favoritesStackDesign()) }, registry);
const roots: string[] = [];
afterEach(async () => {
  for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true });
});

// An offline existing-module fixture changing its handwritten interface at version 2.
// Real TypeScript checks the kept hook against the new emitted interface, without dependencies.
function fixture(version: number) {
  const record = real.manifest.files[0];
  if (!record) throw new Error("No fixture file record");
  const texts = {
    "tsconfig.json":
      '{"compilerOptions":{"strict":true,"noEmit":true,"types":[],"module":"NodeNext","target":"ES2023"},"include":["src/**/*.ts"]}',
    "src/api.ts": `export type Input = { ${version === 1 ? "old" : "next"}: string };\n`,
    "src/hook.ts":
      'import type { Input } from "./api.js";\nexport const hook = (input: Input) => input.old;\n',
  };
  const files = Object.entries(texts).map(([path, text]) => ({ path, bytes: Buffer.from(text) }));
  const manifest = {
    ...real.manifest,
    extensionApi: { ...real.manifest.extensionApi, version },
    files: files.map((file) => ({
      ...record,
      path: file.path,
      sha256: sha256(file.bytes),
      bytes: file.bytes.length,
      ownership:
        file.path === "src/hook.ts"
          ? ("generated-extension" as const)
          : ("generated-scaffold" as const),
    })),
  };
  return {
    ...real,
    manifest,
    files: [
      ...files,
      { path: ".jeeves/manifest.json", bytes: Buffer.from(JSON.stringify(manifest)) },
    ],
  };
}
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "jeeves-rg01-offline-"));
  roots.push(root);
  const app = join(root, "app");
  await exportNewDirectory(fixture(1).files, app);
  await mkdir(join(app, "node_modules"));
  await symlink(
    fileURLToPath(new URL("../../node_modules/typescript", import.meta.url)),
    join(app, "node_modules/typescript"),
  );
  return app;
}
async function snapshot(root: string): Promise<unknown> {
  const found: Record<string, string> = {};
  async function walk(path: string) {
    for (const file of await readdir(join(root, path), { withFileTypes: true })) {
      if (file.name === "node_modules") continue;
      const relative = path ? `${path}/${file.name}` : file.name;
      if (file.isDirectory()) await walk(relative);
      else found[relative] = sha256(await readFile(join(root, relative)));
    }
  }
  await walk("");
  return found;
}

describe("extension contract migration", () => {
  it("emits the installed capability guide/version and verifies real output responsibility", () => {
    expect(real.manifest.extensionApi.version).toBe(6);
    expect(real.manifest.extensionApi.boundary).toBe("checked-extensions");
    expect(real.report.extensionApi.version).toBe(6);
    expect(real.report.capabilities).toHaveLength(4);
    expect(
      Buffer.from(
        real.files.find((file) => file.path === ".jeeves/extensions.md")?.bytes ?? Buffer.alloc(0),
      ).toString(),
    ).toContain("src/extension-api/index.ts");
    const broken = createV2Registry(
      [{ path: "fixture.ts", bytes: Buffer.from("fixture") }],
      [
        {
          id: "fixture",
          version: "1.0.0",
          status: "implemented",
          description: "missing callable output",
          sourcePaths: ["fixture.ts"],
          provides: {
            ...registry.emitters.find((item) => item.id === "local.favorites")?.provides,
          },
          render: () => ({ files: [] }),
        },
      ],
    );
    expect(() => assembleV2({ designJson: canonicalJson(favoritesStackDesign()) }, broken)).toThrow(
      "MISSING_CONSUMER_OUTPUT at src/runtime/favorites.ts",
    );
  });

  it("preserves every old byte for incompatible updates and dry runs, naming the hook", async () => {
    const app = await setup();
    const hook =
      '// custom body\nimport type { Input } from "./api.js";\nexport const hook = (input: Input) => input.old;\n';
    await writeFile(join(app, "src/hook.ts"), hook);
    const before = await snapshot(app);
    for (const check of [true, false]) {
      const result = await updateDirectory(fixture(2), app, { check });
      expect(result.refused.join("\n")).toContain("--ack-extension-api=2: src/hook.ts");
      expect(await snapshot(app)).toEqual(before);
      expect(await readFile(join(app, "src/hook.ts"), "utf8")).toBe(hook);
    }
    const failed = await updateDirectory(fixture(2), app, {
      check: false,
      acknowledgeExtensionApi: 2,
    });
    expect(failed.refused.join("\n")).toContain("Property 'old' does not exist on type 'Input'");
    expect(await snapshot(app)).toEqual(before);
  });

  it("checks an acknowledged migrated hook against the new staging interface, then keeps its bytes", async () => {
    const app = await setup();
    const hook =
      '// migrated manually\nimport type { Input } from "./api.js";\nexport const hook = (input: Input) => input.next;\n';
    await writeFile(join(app, "src/hook.ts"), hook);
    const before = await snapshot(app);
    expect(
      (await updateDirectory(fixture(2), app, { check: true, acknowledgeExtensionApi: 2 })).refused,
    ).toEqual([]);
    expect(await snapshot(app)).toEqual(before);
    expect(await readFile(join(app, "src/api.ts"), "utf8")).toContain("old: string");
    expect(
      (await updateDirectory(fixture(2), app, { check: false, acknowledgeExtensionApi: 2 }))
        .refused,
    ).toEqual([]);
    expect(await readFile(join(app, "src/api.ts"), "utf8")).toContain("next: string");
    expect(await readFile(join(app, "src/hook.ts"), "utf8")).toBe(hook);
    expect(
      JSON.parse(await readFile(join(app, ".jeeves/manifest.json"), "utf8")).extensionApi.version,
    ).toBe(2);
  });

  it("treats missing metadata as legacy v1, keeps compatible custom hooks, and refuses malformed versions", async () => {
    const app = await setup();
    const path = join(app, ".jeeves/manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    delete manifest.extensionApi;
    await writeFile(path, JSON.stringify(manifest));
    const hook = "// old custom hook\nexport const hook = () => 42;\n";
    await writeFile(join(app, "src/hook.ts"), hook);
    expect((await updateDirectory(fixture(1), app, { check: false })).refused).toEqual([]);
    expect(await readFile(join(app, "src/hook.ts"), "utf8")).toBe(hook);
    manifest.extensionApi = { version: "2" };
    await writeFile(path, JSON.stringify(manifest));
    await expect(updateDirectory(fixture(2), app, { check: false })).rejects.toThrow(
      "Invalid extension API version",
    );
  });
});

it("RG06 refuses a v5-to-v6 update until the exact database access migration is explicitly acknowledged", async () => {
  const root = await mkdtemp(join(tmpdir(), "jeeves-rg05-migration-"));
  roots.push(root);
  const app = join(root, "app");
  await exportNewDirectory(real.files, app);
  const manifest = {
    ...real.manifest,
    extensionApi: { ...real.manifest.extensionApi, version: 5 },
  };
  await writeFile(join(app, ".jeeves/manifest.json"), JSON.stringify(manifest));
  const before = await snapshot(app);
  const result = await updateDirectory(real, app, { check: true });
  expect(result.refused.join("\n")).toContain("Extension API 5 -> 6 requires migration");
  expect(result.refused.join("\n")).toContain("--ack-extension-api=6");
  expect(result.refused.join("\n")).toContain("src/modules/account-api/favorite-items.hooks.ts");
  expect(await snapshot(app)).toEqual(before);
});

it("RG05 refuses same-version identity/namespace replacement and preserves the entire target", async () => {
  const root = await mkdtemp(join(tmpdir(), "jeeves-rg05-identity-"));
  roots.push(root);
  const app = join(root, "app");
  await exportNewDirectory(real.files, app);
  const source = favoritesStackDesign();
  // Import tooling may legitimately introduce IDs. It is not an application/data migration.
  const { rekeyDesign } = await import("../../jeeves/packages/spec/src/studio-rekey.ts");
  rekeyDesign(source, "favorite-items", "saved-items");
  const changed = assembleV2({ designJson: canonicalJson(source) }, registry);
  expect(changed.manifest.extensionApi.version).toBe(real.manifest.extensionApi.version);
  const before = await snapshot(app);
  for (const check of [true, false]) {
    const result = await updateDirectory(changed, app, { check, acknowledgeExtensionApi: 5 });
    expect(result.refused.join("\n")).toContain("Runtime identity/namespace migration required");
    expect(result.refused.join("\n")).toContain("selection:favorite-items");
    expect(result.refused.join("\n")).toContain("favorite-items.hooks.ts");
    expect(await snapshot(app)).toEqual(before);
  }
});

it("RG05 a label-only export update preserves handwritten hook bytes and all identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "jeeves-rg05-label-"));
  roots.push(root);
  const app = join(root, "app");
  await exportNewDirectory(real.files, app);
  const hook = "src/modules/account-api/favorite-items.hooks.ts";
  const own = `${await readFile(join(app, hook), "utf8")}\nexport const applicationNote = "kept";\n`;
  await writeFile(join(app, hook), own);
  const { runStudioCommands } = await import(
    "../../jeeves/packages/spec/src/fixtures/v2-modules.ts"
  );
  const source = runStudioCommands(favoritesStackDesign(), [
    { type: "edit", element: "account-api", name: "Renamed API" },
    { type: "editComponent", component: "favorite-items", name: "Saved items" },
  ]);
  const next = assembleV2({ designJson: canonicalJson(source) }, registry);
  const result = await updateDirectory(next, app, { check: false });
  expect(result.refused).toEqual([]);
  expect(await readFile(join(app, hook), "utf8")).toBe(own);
  expect(next.report.capabilities).toEqual(real.report.capabilities);
});

it("RG06 refuses actual legacy-to-shared product namespace migration even with API acknowledgement", async () => {
  const root = await mkdtemp(join(tmpdir(), "jeeves-rg06-product-migration-"));
  roots.push(root);
  const app = join(root, "app");
  const prior = assembleV2(
    {
      designJson: canonicalJson(
        runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]),
      ),
    },
    registry,
  );
  await exportNewDirectory(prior.files, app);
  const sql =
    "-- application-owned product SQL must survive\nCREATE TABLE items(id text PRIMARY KEY);\n";
  await writeFile(join(app, "infra/postgres/links-db/modules/link-reader.sql"), sql);
  const next = assembleV2({ designJson: canonicalJson(ownershipDesign()) }, registry);
  // Current API and v5 both refuse; acknowledgements cannot authorize moving old product data.
  for (const version of [6, 5]) {
    await writeFile(
      join(app, ".jeeves/manifest.json"),
      JSON.stringify({
        ...prior.manifest,
        extensionApi: { ...prior.manifest.extensionApi, version },
      }),
    );
    const before = await snapshot(app);
    for (const check of [true, false]) {
      const result = await updateDirectory(next, app, { check, acknowledgeExtensionApi: 6 });
      expect(result.refused.join("\n")).toContain("product:links-db.link-reader");
      expect(result.refused.join("\n")).toContain("application/data explicitly");
      expect(await snapshot(app)).toEqual(before);
      expect(
        await readFile(join(app, "infra/postgres/links-db/modules/link-reader.sql"), "utf8"),
      ).toBe(sql);
    }
  }
});

it("RG06 named-view audience edits keep legacy writer schemas and need no namespace migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "jeeves-rg06-view-audience-"));
  roots.push(root);
  const app = join(root, "app");
  const source = runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]);
  const prior = assembleV2({ designJson: canonicalJson(source) }, registry);
  await exportNewDirectory(prior.files, app);
  const design = runStudioCommands(source, [
    {
      type: "setDatabaseAccess",
      role: "visit-worker",
      database: "links-db",
      product: { tables: [], views: ["visible_items"] },
    },
  ]);
  const next = assembleV2({ designJson: canonicalJson(design) }, registry);
  const plan = JSON.parse(
    Buffer.from(
      next.files.find((file) => file.path === "infra/local.json")?.bytes ?? [],
    ).toString(),
  );
  const db = plan.databases.find((db: { resource: string }) => db.resource === "links-db");
  expect(db.productState.schema).toBeUndefined();
  expect(db.modules.map((item: { schema: string }) => item.schema)).toEqual(["m_link_reader"]);
  expect((await updateDirectory(next, app, { check: true })).refused).toEqual([]);
});

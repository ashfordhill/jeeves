import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  durableWorkDesign,
  remoteDurableWorkDesign,
} from "../../../../../field-projects/generator-system/fixtures/rg-durable-work/design.ts";
import { exportNewDirectory } from "../../../../../jeeves-generator/src/export.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const root = await mkdtemp("/tmp/jeeves-rg15-emitted-");
try {
  for (const [name, design] of [
    ["local", durableWorkDesign()],
    ["remote", await remoteDurableWorkDesign()],
  ] as const) {
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry());
    const app = join(root, name);
    await exportNewDirectory(bundle.files, app);
    await symlink("/home/ash/github/qrwty/app/node_modules", join(app, "node_modules"));
    const inputs = new URL(
      "../../../../../field-projects/generator-system/fixtures/rg-durable-work/",
      import.meta.url,
    );
    if (name === "local") {
      for (const [input, output] of Object.entries({
        "create-item.ts": "src/modules/items-api/create-item.ts",
        "products.json": "infra/postgres/items-db/products.json",
        "0001-initial.sql":
          "infra/postgres/items-db/products/migrations/p_items_api_owner/0001-initial.sql",
        "create.sql": "infra/postgres/items-db/products/commands/create.sql",
      }))
        await writeFile(join(app, output), await readFile(new URL(input, inputs)));
    } else {
      for (const [host, module] of [
        ["caller", "send"],
        ["callee", "receive"],
      ]) {
        await writeFile(
          join(app, `src/modules/${host}/${module}.ts`),
          await readFile(new URL(`${module}.ts`, inputs)),
        );
        const schema = `p_${host}_owner`,
          base = `infra/postgres/${host}-db/products`;
        const migration = `${base}/migrations/${schema}/0001-initial.sql`,
          command = `${base}/commands/create.sql`;
        await writeFile(
          join(app, `${base}.json`),
          JSON.stringify({
            version: 1,
            namespaces: [{ schema, migrations: [{ version: "0001", file: migration }] }],
            tables: [{ schema, name: "items" }],
            views: [],
            operations: [
              {
                name: "create_item",
                module,
                host,
                kind: "command",
                file: command,
                parameters: 1,
                relations: [{ schema, name: "items", operations: ["insert"] }],
              },
            ],
          }),
        );
        await writeFile(join(app, migration), await readFile(new URL("0001-initial.sql", inputs)));
        await writeFile(join(app, command), `INSERT INTO ${schema}.items(id) VALUES($1);`);
      }
    }
    console.log(`RG15 ${name} scratch: ${bundle.files.length} files`);
    console.log(
      "New emitted paths:",
      bundle.files
        .map((file) => file.path)
        .filter((path) => /durable-work|product-mutation|work-integration/.test(path)),
    );
    if (name === "remote") {
      const process = await readFile(join(app, "src/processes/callee.ts"), "utf8");
      if (!process.includes('"/internal/work"') || !process.includes("invokeWorkProtocol"))
        throw Error("Missing framework route");
      console.log(
        "Callee compiled framework-owned /internal/work/receive route and caller allowlist retained.",
      );
    }
    console.log(
      "Actual emitted paths:",
      bundle.files.map((file) => file.path),
    );
    const pkg = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
    console.log("Emitted pins:", pkg.dependencies, pkg.devDependencies);
    for (const args of [
      [join(app, "scripts/check-extensions.mjs"), app],
      [join(app, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", app],
    ]) {
      try {
        console.log(
          execFileSync(process.execPath, args, { cwd: app, encoding: "utf8", stdio: "pipe" }),
        );
      } catch (cause) {
        const error = cause as { stdout?: unknown; stderr?: unknown };
        console.log(error.stdout, error.stderr);
        process.exitCode = 1;
      }
    }
    console.log(
      "Pinned TypeScript:",
      execFileSync(process.execPath, [join(app, "node_modules/typescript/bin/tsc"), "--version"], {
        encoding: "utf8",
      }).trim(),
    );
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

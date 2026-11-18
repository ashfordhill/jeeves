import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scheduledDesign } from "../../../../../field-projects/generator-system/fixtures/rg-scheduled/design.ts";
import { designGeneration } from "../../../../../jeeves/packages/spec/src/generation.ts";
import { exportNewDirectory } from "../../../../../jeeves-generator/src/export.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const root = await mkdtemp("/tmp/jeeves-rg16-compile-");
try {
  const design = scheduledDesign();
  const selected = designGeneration(design)?.selections.find((s) => s.id === "service-task");
  if (!selected) throw Error("Missing scheduled binding");
  selected.id = "service-task-binding"; // Selection and stable module identity may differ.
  const bundle = assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry());
  const app = join(root, "app");
  await exportNewDirectory(bundle.files, app);
  console.log(
    "Actual emitted files:",
    bundle.files.length,
    bundle.files.map((f) => f.path),
  );
  const pkg = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
  console.log("Actual dependency pins:", pkg.dependencies, pkg.devDependencies);
  console.log(
    execFileSync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: app,
      encoding: "utf8",
    }),
  );
  for (const host of ["maintenance-api", "maintenance-worker"]) {
    const source = await readFile(join(app, `src/processes/${host}.ts`), "utf8");
    if (!source.includes("await startScheduledTask(") || source.includes("startModuleLoop("))
      throw Error("Missing independent timer mount");
    if (!source.includes(`product-state--${host}`))
      throw Error("Missing distinct product credentials");
    console.log(
      `${host}: awaited scheduled mount; distinct product/framework credential names; no delivery loop`,
    );
  }
  for (const phase of ["scaffold", "product-handler"]) {
    if (phase === "product-handler") {
      for (const [host, module] of [
        ["maintenance-api", "service-task"],
        ["maintenance-worker", "maintenance-worker-scheduled-task"],
      ]) {
        const path = join(app, `src/modules/${host}/${module}.ts`);
        const source = await readFile(path, "utf8");
        // Application-owned completion body; generated process/runtime/scaffold files stay as emitted.
        await writeFile(
          path,
          source.replace(
            /throw new Error\("Not implemented: [^"]+"\);/,
            'await commands.call("reconcile_tick", [tick.tick]);',
          ),
        );
      }
    }
    console.log(`Actual ${phase} extension boundary and pinned TypeScript build:`);
    console.log(execFileSync("pnpm", ["build"], { cwd: app, encoding: "utf8" }));
  }
  console.log(
    "Pinned compiler:",
    execFileSync(process.execPath, [join(app, "node_modules/typescript/bin/tsc"), "--version"], {
      encoding: "utf8",
    }).trim(),
  );
} finally {
  await rm(root, { recursive: true, force: true });
  console.log("Exact scratch directory removed");
}

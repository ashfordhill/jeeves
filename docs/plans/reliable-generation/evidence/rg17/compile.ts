import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { webhookDesign } from "../../../../../field-projects/generator-system/fixtures/rg-webhook/design.ts";
import { designGeneration } from "../../../../../jeeves/packages/spec/src/generation.ts";
import { exportNewDirectory } from "../../../../../jeeves-generator/src/export.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const root = await mkdtemp("/tmp/jeeves-rg17-compile-");
try {
  const design = webhookDesign();
  const selected = designGeneration(design)?.selections.find((s) => s.id === "receive-events");
  if (!selected) throw Error("Missing receiver");
  selected.id = "receiver-binding";
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
  for (const phase of ["scaffold", "product-handler"]) {
    if (phase === "product-handler") {
      const mapper = join(app, "src/modules/events-api/receive-events.mapping.hooks.ts");
      await writeFile(
        mapper,
        (await readFile(mapper, "utf8")).replace(
          'throw new Error("Not implemented: map authenticated webhook event");',
          "const e = input as {id: string;type: string;payload: unknown}; return {id: e.id,type: e.type,payload: e.payload};",
        ),
      );
      const handler = join(app, "src/modules/events-api/receive-events.ts");
      await writeFile(
        handler,
        (await readFile(handler, "utf8")).replace(
          'throw new Error("Not implemented: process authenticated webhook event");',
          'await commands.call("record_event", [event.id, event.type]);',
        ),
      );
    }
    console.log(`Actual ${phase} extension checker / pinned TypeScript:`);
    console.log(execFileSync("pnpm", ["build"], { cwd: app, encoding: "utf8" }));
  }
  const handlerPath = join(app, "src/modules/events-api/receive-events.ts");
  const originalHandler = await readFile(handlerPath, "utf8");
  await writeFile(handlerPath, `${originalHandler}\nvoid durableWork.accept;\n`);
  let unsignedRefused = false;
  try {
    execFileSync("pnpm", ["build"], { cwd: app, encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    unsignedRefused = String((error as { stdout?: string }).stdout).includes(
      "Property 'accept' does not exist on type 'WebhookWork'",
    );
  }
  if (!unsignedRefused) throw Error("Unsigned public acceptance boundary did not refuse");
  await writeFile(handlerPath, originalHandler);
  const mapperPath = join(app, "src/modules/events-api/receive-events.mapping.hooks.ts");
  const originalMapper = await readFile(mapperPath, "utf8");
  await writeFile(mapperPath, `${originalMapper}\nexport const forbidden = () => globalThis;\n`);
  let policyRefused = false;
  try {
    execFileSync(process.execPath, ["scripts/check-extensions.mjs"], {
      cwd: app,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    policyRefused = String((error as { stderr?: string }).stderr).includes("forbidden globalThis");
  }
  if (!policyRefused) throw Error("Pure mapper boundary did not refuse");
  await writeFile(mapperPath, originalMapper);
  console.log(
    "Negative boundary checks: unsigned work.accept refused by actual TypeScript; mapper globalThis refused by actual extension checker",
  );
  console.log(
    "Compiler:",
    execFileSync(process.execPath, [join(app, "node_modules/typescript/bin/tsc"), "--version"], {
      encoding: "utf8",
    }).trim(),
  );
} finally {
  await rm(root, { recursive: true, force: true });
  console.log("Exact scratch directory removed");
}

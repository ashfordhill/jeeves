import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { browserSessionDesign } from "../../../../../field-projects/generator-system/fixtures/rg-browser-session/design.ts";
import { runStudioCommands } from "../../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { exportNewDirectory } from "../../../../../jeeves-generator/src/export.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const parent = await mkdtemp("/tmp/jeeves-rg20-standalone-");
try {
  const design = runStudioCommands(browserSessionDesign(), [
    { type: "removeModule", module: "account" },
  ]);
  const bundle = assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry());
  const root = join(parent, "app");
  await exportNewDirectory(bundle.files, root);
  console.log(
    "Browser-only actual paths",
    bundle.files.length,
    bundle.files.map((f) => f.path),
  );
  console.log(
    execFileSync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  console.log(execFileSync("pnpm", ["build"], { cwd: root, encoding: "utf8" }));
  console.log("Pins", JSON.parse(await readFile(join(root, "package.json"), "utf8")).dependencies);
  console.log(
    "Compiler",
    execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--version"], {
      encoding: "utf8",
    }),
  );
  const forbidden = join(root, "src/modules/browser-api/forbidden.hooks.ts");
  await mkdir(join(root, "src/modules/browser-api"), { recursive: true });
  await writeFile(
    forbidden,
    '// @jeeves-extension: policy\nimport {browserRefresh} from "../../runtime/browser-refresh.ts";\nvoid browserRefresh;\n',
  );
  let refusal = "";
  try {
    execFileSync("pnpm", ["check:extensions"], { cwd: root, encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    refusal = String(error.stdout) + String(error.stderr);
  }
  if (!refusal.includes("private") && !refusal.includes("restricted"))
    throw Error(`Actual checker did not reject session-runtime hook import: ${refusal}`);
  console.log("Actual extension checker refuses product session-runtime imports", refusal.trim());
} finally {
  await rm(parent, { recursive: true, force: true });
  console.log("Exact standalone scratch removed");
}

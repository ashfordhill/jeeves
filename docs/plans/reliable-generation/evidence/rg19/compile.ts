import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { browserSessionDesign } from "../../../../../field-projects/generator-system/fixtures/rg-browser-session/design.ts";
import { exportNewDirectory } from "../../../../../jeeves-generator/src/export.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const parent = await mkdtemp("/tmp/jeeves-rg19-compile-");
const root = join(parent, "app");
await writeFile("/tmp/jeeves-rg19-compile-path", root);
const d = browserSessionDesign();
const bundle = assembleV2({ designJson: JSON.stringify(d) }, loadLocalV2Registry());
await exportNewDirectory(bundle.files, root);
console.log(
  "Actual emitted paths",
  bundle.files.length,
  bundle.files.map((f) => f.path),
);
console.log("Exact dependencies", JSON.parse(await readFile(join(root, "package.json"), "utf8")));
console.log(
  execFileSync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
    cwd: root,
    encoding: "utf8",
  }),
);
console.log(execFileSync("pnpm", ["build"], { cwd: root, encoding: "utf8" }));
console.log(
  execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--version"], {
    encoding: "utf8",
  }),
);
console.log("Scratch retained for exact protocol proof", root);

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sessionForwardingDesign } from "../../../../../field-projects/generator-system/fixtures/rg-session-forwarding/design.ts";
import { exportNewDirectory } from "../../../../../jeeves-generator/src/export.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const parent = await mkdtemp("/tmp/jeeves-rg22-compile-");
const root = join(parent, "app");
try {
  const bundle = assembleV2(
    { designJson: JSON.stringify(sessionForwardingDesign()) },
    loadLocalV2Registry(),
  );
  await exportNewDirectory(bundle.files, root);
  console.log(
    "Actual emitted file count",
    bundle.files.length,
    "API",
    bundle.manifest.extensionApi.version,
    "applicationComplete",
    bundle.report.applicationComplete,
  );
  console.log(
    "Exact generated dependency pins",
    JSON.parse(await readFile(join(root, "package.json"), "utf8")),
  );
  console.log(
    execFileSync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  console.log(execFileSync("pnpm", ["build"], { cwd: root, encoding: "utf8" }));
  await writeFile(
    join(root, "src/contracts/payload.ts"),
    "export interface Payload { readonly async: boolean; }\nexport const payload: Payload = { async: false };\n",
  );
  await writeFile(
    join(root, "src/modules/caller/send.ts"),
    `// @jeeves-extension: operation
import { declareSettings, serviceResponse } from "../../extension-api/index.ts";
import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import { payload } from "../../contracts/payload.ts";
import type { Dependencies } from "./send.slots.ts";
export const settings = declareSettings({});
export async function send(dependencies: Dependencies, _request: ModuleRequest): Promise<ModuleResponse> {
  const operation: string = "receive";
  const prior = await dependencies.callee.call(operation, { method: "GET" });
  const result = await dependencies.callee.operations.receive.read({ accept: "application/json" });
  return serviceResponse(result, { result: result.body, prior: prior.body, async: payload.async });
}
`,
  );
  console.log(execFileSync("pnpm", ["build"], { cwd: root, encoding: "utf8" }));
  console.log(
    execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--version"], {
      encoding: "utf8",
    }),
  );
  for (const [source, reason] of [
    ["export const eligibility = async () => true;", "asynchronous policy"],
    ['import "../runtime/operation.ts"; export {};', "private runtime import"],
  ]) {
    await writeFile(join(root, "src/contracts/payload.ts"), source);
    let refusal = "";
    try {
      execFileSync("pnpm", ["check:extensions"], { cwd: root, encoding: "utf8", stdio: "pipe" });
    } catch (error) {
      refusal = String((error as { stderr: string }).stderr);
    }
    if (!refusal.includes(reason)) throw Error(`Expected actual checker refusal: ${reason}`);
    console.log("Actual checker refused", reason, "at src/contracts/payload.ts");
  }
  console.log(
    "Old API8 dynamic-string call and additive typed operation example compile; API8 retained. Original unfilled hooks compile but report remains partial.",
  );
} finally {
  await rm(parent, { recursive: true, force: true });
  console.log("Own scratch export removed");
}

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sessionForwardingDesign } from "../../../../../field-projects/generator-system/fixtures/rg-session-forwarding/design.ts";
import { exportNewDirectory } from "../../../../../jeeves-generator/src/export.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const parent = await mkdtemp("/tmp/jeeves-rg21-compile-");
const root = join(parent, "app");
await writeFile("/tmp/jeeves-rg21-compile-path", root);
const d = sessionForwardingDesign();
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
await writeFile(
  join(root, "src/modules/caller/send.ts"),
  `// @jeeves-extension: operation
import type {ModuleRequest,ModuleResponse} from "../../extension-api/index.ts";
import {declareSettings} from "../../extension-api/index.ts";
import type {Dependencies} from "./send.slots.ts";
export const settings=declareSettings({});
// Prior public call body intentionally uses a string variable, preserving API8 compatibility.
export async function send(dependencies:Dependencies,_request:ModuleRequest):Promise<ModuleResponse>{
 const operation:string="receive";
 const result=await dependencies.callee.call(operation,{method:"GET"});
 return {status:result.status,body:result.body};
}
`,
);
console.log(execFileSync("pnpm", ["build"], { cwd: root, encoding: "utf8" }));
console.log("Retained API8 dynamic-string body compiled unchanged.");
await writeFile(
  join(root, "src/modules/caller/send.ts"),
  `// @jeeves-extension: operation
import type {ModuleRequest,ModuleResponse} from "../../extension-api/index.ts";
import {declareSettings,serviceResponse} from "../../extension-api/index.ts";
import type {Dependencies} from "./send.slots.ts";
export const settings=declareSettings({});
export async function send(dependencies:Dependencies,request:ModuleRequest):Promise<ModuleResponse>{
 const result=await dependencies.callee.operations.receive.read({accept:"application/json"});
 return serviceResponse(result,{signedIn:request.caller.signedIn,result:result.body});
}
`,
);
console.log(execFileSync("pnpm", ["build"], { cwd: root, encoding: "utf8" }));
console.log("New per-operation handle plus public composite helper compiled with real checker.");
console.log(
  execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--version"], {
    encoding: "utf8",
  }),
);
console.log("Scratch retained for exact protocol proof", root);

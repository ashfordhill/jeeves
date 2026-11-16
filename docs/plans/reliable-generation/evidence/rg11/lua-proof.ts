import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";

// Usage: node .../lua-proof.ts /tmp/<task-owned-build>/lua-5.1.5/src/lua
// Executes the exact private script strings after JS template interpolation, with deterministic
// Redis command/time and cjson.decode doubles. This is not a native Valkey/transport proof.
(async () => {
  const binary = process.argv[2];
  if (!binary) throw Error("Pass the task-owned Lua 5.1 binary");
  const data = (code: string) =>
    `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(code)).toString("base64")}`;
  const redis = data("export class ErrorReply extends Error {} export const createClient=()=>{};");
  const operation = data(
    "export const dependency=()=>{},currentProcess=()=>{},assertNetworkAllowed=()=>{},assertOperation=()=>{}; export class OperationError extends Error {};",
  );
  const source = await readFile(
    "jeeves-generator/templates/local-v2/assets/src/runtime/valkey.ts.template",
    "utf8",
  );
  const runtime = await import(
    data(
      source
        .replace('from "redis"', `from "${redis}"`)
        .replace('from "./operation.ts"', `from "${operation}"`)
        .replace('import { readSecret } from "./local.ts";', "const readSecret=()=>{};") +
        "\nexport {ADMIT_WINDOW, SET_IF_NEWER};",
    )
  );
  const harness = await readFile(
    "docs/plans/reliable-generation/evidence/rg11/lua-proof.lua",
    "utf8",
  );
  const directory = await mkdtemp("/tmp/jeeves-rg11-lua-proof-");
  try {
    const file = join(directory, "proof.lua");
    await writeFile(
      file,
      `local ADMIT_WINDOW=[==[${runtime.ADMIT_WINDOW}]==]\nlocal SET_IF_NEWER=[==[${runtime.SET_IF_NEWER}]==]\n${harness}`,
    );
    console.log(execFileSync(binary, [file], { encoding: "utf8", timeout: 5000 }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
})();

import { readFile } from "node:fs/promises";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { updateDirectory } from "../update.ts";
import { assembleV2 } from "./assemble.ts";

const args = process.argv.slice(2);
const paths = args.filter((arg) => arg !== "--check");
const [source, directory] = paths;
if (!source || !directory || paths.length !== 2 || args.length > 3 || source.startsWith("-"))
  throw new Error(
    "Usage: pnpm --filter @jeeves/generator update:v2 /path/design.json /absolute/existing-directory [--check]",
  );
const registry = loadLocalV2Registry();
const bundle = assembleV2({ designJson: await readFile(source, "utf8") }, registry);
const result = await updateDirectory(bundle, directory, { check: args.length === 3 });
console.log(JSON.stringify(result, null, 2));
if (result.refused.length) process.exitCode = 1;

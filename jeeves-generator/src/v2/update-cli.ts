import { readFile } from "node:fs/promises";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { updateDirectory } from "../update.ts";
import { assembleV2 } from "./assemble.ts";

const args = process.argv.slice(2);
const paths = args.filter((arg) => !arg.startsWith("--"));
const acknowledgements = args.filter((arg) => arg.startsWith("--ack-extension-api="));
const acknowledgement = acknowledgements[0]?.slice("--ack-extension-api=".length);
const [source, directory] = paths;
if (
  !source ||
  !directory ||
  paths.length !== 2 ||
  acknowledgements.length > 1 ||
  (acknowledgement !== undefined && !/^[1-9][0-9]*$/u.test(acknowledgement)) ||
  args.some(
    (arg) => arg.startsWith("--") && arg !== "--check" && !arg.startsWith("--ack-extension-api="),
  ) ||
  source.startsWith("-")
)
  throw new Error(
    "Usage: pnpm --filter @jeeves/generator update:v2 /path/design.json /absolute/existing-directory [--check] [--ack-extension-api=<version>]",
  );
const registry = loadLocalV2Registry();
const bundle = assembleV2({ designJson: await readFile(source, "utf8") }, registry);
const result = await updateDirectory(bundle, directory, {
  check: args.includes("--check"),
  ...(acknowledgement !== undefined && { acknowledgeExtensionApi: Number(acknowledgement) }),
});
console.log(JSON.stringify(result, null, 2));
if (result.refused.length) process.exitCode = 1;

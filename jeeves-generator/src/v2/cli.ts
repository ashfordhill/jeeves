import { readFile } from "node:fs/promises";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { exportNewDirectory } from "../export.ts";
import { assembleV2 } from "./assemble.ts";

const [source, destination] = process.argv.slice(2);
if (!source || !destination || process.argv.length !== 4)
  throw new Error(
    "Usage: pnpm --filter @jeeves/generator export:v2 /path/design.json /absolute/new-directory",
  );
const registry = loadLocalV2Registry();
const bundle = assembleV2({ designJson: await readFile(source, "utf8") }, registry);
console.log({
  ...(await exportNewDirectory(bundle.files, destination)),
  applicationComplete: bundle.report.applicationComplete,
  findings: bundle.report.findings.length,
  requiredGaps: bundle.report.gaps.filter((gap) => gap.required).length,
});

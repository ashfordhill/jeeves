import { applyOperations, buildGenerationPresetCommand, designSchema } from "@jeeves/spec";
import { exportNewDirectory } from "../../src/export.ts";
import { canonicalJson } from "../../src/json.ts";
import { assembleV2 } from "../../src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { createProductAttachmentExample } from "./recipe.ts";

const [destination] = process.argv.slice(2);
if (!destination || process.argv.length !== 3)
  throw Error("Usage: tsx examples/product-attachment/export.ts /absolute/new-directory");
const empty = designSchema.parse({ schemaVersion: 2, revision: 0, elements: [], connections: [] });
const result = applyOperations(
  empty,
  buildGenerationPresetCommand(empty, { preset: "video", prefix: "fitting" }).ops,
);
if (!result.ok) throw Error(JSON.stringify(result.errors));
const registry = loadLocalV2Registry([createProductAttachmentExample()]);
const bundle = assembleV2({ designJson: canonicalJson(result.design) }, registry);
if (!bundle.report.applicationComplete) throw Error(JSON.stringify(bundle.report.gaps));
console.log(await exportNewDirectory(bundle.files, destination));

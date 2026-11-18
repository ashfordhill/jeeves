/** Reproduce RG24 source-loc-v2 from its exact, sanitized immutable snapshot payload. */
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { countSnapshots } from "./harness/rg-regeneration.ts";

const [path, ...extra] = process.argv.slice(2);
if (!path || extra.length) throw Error("Supply one RG24 *-source-loc-inputs.json.gz path");
const snapshots = JSON.parse(gunzipSync(await readFile(path)).toString()) as {
  baseline: Record<string, string>;
  completed: Record<string, string>;
};
console.log(JSON.stringify(await countSnapshots(snapshots.baseline, snapshots.completed), null, 2));

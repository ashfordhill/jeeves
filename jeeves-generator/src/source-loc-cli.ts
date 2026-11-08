import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sourceLocReport } from "./source-loc.ts";

const [app, baseline, completed, scopePath, ...extra] = process.argv.slice(2);
if (!app || !baseline || !completed || !scopePath || extra.length)
  throw new Error(
    "Usage: pnpm benchmark:source <repo-relative-app> <generated-commit> <completed-commit> <repo-relative-scope.json>",
  );
const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const scope: unknown = JSON.parse(readFileSync(resolve(repo, scopePath), "utf8"));
console.log(JSON.stringify(sourceLocReport(repo, app, baseline, completed, scope), null, 2));

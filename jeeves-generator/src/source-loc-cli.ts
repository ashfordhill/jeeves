import { execFileSync } from "node:child_process";
import { sourceLocReport } from "./source-loc.ts";

const [app, baseline, completed, ...extra] = process.argv.slice(2);
if (!app || !baseline || !completed || extra.length)
  throw new Error(
    "Usage: pnpm benchmark:source <repo-relative-app> <generated-commit> <completed-commit>",
  );
const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
console.log(JSON.stringify(sourceLocReport(repo, app, baseline, completed), null, 2));

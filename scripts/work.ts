import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { planWork, profiles, runWork } from "./lib/work.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const [action = "list", name, ...selections] = process.argv.slice(2);
try {
  if (action === "list" && !name) {
    console.log("pnpm work run <profile> [files | all | checkout]\npnpm work status\n");
    for (const [id, description] of Object.entries(profiles)) console.log(`${id}: ${description}`);
  } else if (action === "status" && !name) {
    const directory = join(root, ".jeeves-work", "runs");
    const files = existsSync(directory)
      ? readdirSync(directory)
          .filter((file) => file.endsWith(".json"))
          .sort()
          .slice(-12)
      : [];
    for (const file of files) {
      const result = JSON.parse(readFileSync(join(directory, file), "utf8"));
      console.log(`${result.status.toUpperCase()} ${result.id} ${result.durationMs ?? "?"}ms`);
      if (result.status === "running")
        console.log(`  Incomplete evidence: process ${result.processId}; inspect before resuming.`);
      if (result.sourceChanged) console.log("  Source changed during this run.");
      console.log(`  ${join(directory, file)}`);
    }
    if (!files.length) console.log("No runs recorded.");
  } else if (action === "run" && name) {
    process.exitCode = await runWork(root, planWork(root, name, selections));
  } else {
    throw new Error("Usage: pnpm work list | status | run <profile> [selections]");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

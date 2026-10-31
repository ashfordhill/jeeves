import { fileURLToPath } from "node:url";
import { inspectReference, readReferences } from "./lib/references.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const [action = "list", id, ...extra] = process.argv.slice(2);
try {
  const references = readReferences(root);
  if (action === "list" && !id) {
    console.log("pnpm references fetch|verify <id|all> (verify is offline)\n");
    for (const reference of references)
      console.log(
        `${reference.id} ${reference.commit}\n  ${reference.license.summary}\n  Candidates: ${reference.candidates.join(", ")}`,
      );
  } else if ((action === "fetch" || action === "verify") && id && !extra.length) {
    const selected = references.filter((reference) => id === "all" || reference.id === id);
    if (!selected.length) throw new Error(`Unknown reference: ${id}`);
    for (const reference of selected)
      console.log(JSON.stringify(await inspectReference(root, reference, action === "fetch")));
  } else {
    throw new Error("Usage: pnpm references list | fetch <id|all> | verify <id|all>");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

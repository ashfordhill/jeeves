import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
  type OffPin,
  offDesigns,
  offPin,
} from "../../../../../jeeves-generator/src/v2/fixtures/processes-off.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const path = new URL(
  "../../../../../jeeves-generator/src/v2/fixtures/processes-off.json",
  import.meta.url,
);
const previous = JSON.parse(
  process.argv.includes("--accepted")
    ? execFileSync(
        "git",
        [
          "show",
          "9818976eb45e2aef534fcff35b7bb97f1817b4f8:jeeves-generator/src/v2/fixtures/processes-off.json",
        ],
        { encoding: "utf8" },
      )
    : await readFile(path, "utf8"),
) as Record<string, OffPin>;
const registry = loadLocalV2Registry();
const next = Object.fromEntries(
  Object.entries(offDesigns(registry)).map(([name, source]) => [name, offPin(source, registry)]),
);
const allowed = new Set([
  ".jeeves/extensions.md",
  ".jeeves/inputs/design.json",
  ".jeeves/manifest.json",
  ".jeeves/normalized.json",
  ".jeeves/report.json",
  "diagnostics/generation.json",
  "src/features/application-bindings.ts",
  "src/runtime/amqp.ts",
  "src/runtime/counter-worker.ts",
  "src/runtime/event-counter.ts",
  "src/runtime/delivery.ts",
  "src/runtime/durable-sql.ts",
  "src/runtime/receipts.ts",
  "src/modules/links-api/upload-consumer.slots.ts",
  "src/modules/visit-worker/visit-consumer.slots.ts",
]);
for (const [name, pin] of Object.entries(next)) {
  const old = previous[name];
  if (
    !old ||
    old.files !== pin.files ||
    Object.keys(old.sha256).join() !== Object.keys(pin.sha256).join()
  )
    throw Error("Unexpected paths");
  const changes = Object.keys(pin.sha256).filter((p) => pin.sha256[p] !== old.sha256[p]);
  console.log(name, pin.files, "unchanged paths; changed", changes);
  if (changes.some((p) => !allowed.has(p))) throw Error(`Unreviewed output changes: ${changes}`);
}
if (process.argv.includes("--write")) {
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
  console.log("Reviewed pin changes written; dependencies and paths unchanged");
}

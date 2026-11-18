import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import {
  type OffPin,
  offDesigns,
  offPin,
} from "../../../../../jeeves-generator/src/v2/fixtures/processes-off.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const path = "jeeves-generator/src/v2/fixtures/processes-off.json";
const before = JSON.parse(
  execFileSync("git", ["show", `326e3491fb3830bf9f060fb3b091c9bbfae37198:${path}`], {
    encoding: "utf8",
  }),
) as Record<string, OffPin>;
const registry = loadLocalV2Registry(),
  after = Object.fromEntries(
    Object.entries(offDesigns(registry)).map(([name, source]) => [name, offPin(source, registry)]),
  );
const allowed = new Set([
  ".jeeves/extensions.md",
  ".jeeves/manifest.json",
  ".jeeves/report.json",
  "scripts/check-extensions.mjs",
]);
for (const [name, pin] of Object.entries(after)) {
  const old = before[name];
  if (
    !old ||
    old.files !== pin.files ||
    Object.keys(old.sha256).join() !== Object.keys(pin.sha256).join()
  )
    throw Error("Unexpected paths");
  const changed = Object.keys(pin.sha256).filter((path) => pin.sha256[path] !== old.sha256[path]);
  console.log(name, pin.files, "unchanged paths; reviewed", changed);
  if (changed.some((path) => !allowed.has(path))) throw Error("Unexpected substantive output");
}
if (process.argv.includes("--write"))
  await writeFile(
    new URL(`../../../../../${path}`, import.meta.url),
    `${JSON.stringify(after, null, 2)}\n`,
  );

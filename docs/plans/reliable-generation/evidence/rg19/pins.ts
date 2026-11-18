import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import {
  type OffPin,
  offDesigns,
  offPin,
} from "../../../../../jeeves-generator/src/v2/fixtures/processes-off.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const path = "jeeves-generator/src/v2/fixtures/processes-off.json";
const previous = JSON.parse(
  execFileSync("git", ["show", `ba89ff12822a1e3d07bfe62666e6008a52193d5c:${path}`], {
    encoding: "utf8",
  }),
) as Record<string, OffPin>;
const registry = loadLocalV2Registry();
const next = Object.fromEntries(
  Object.entries(offDesigns(registry)).map(([name, source]) => [name, offPin(source, registry)]),
);
const allowed = new Set([
  ".jeeves/extensions.md",
  ".jeeves/manifest.json",
  ".jeeves/report.json",
  "Dockerfile",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "src/runtime/http.ts",
  "src/runtime/settings.ts",
]);
for (const [name, pin] of Object.entries(next)) {
  const old = previous[name];
  if (
    !old ||
    old.files !== pin.files ||
    Object.keys(old.sha256).join() !== Object.keys(pin.sha256).join()
  )
    throw Error("Unexpected paths");
  const changed = Object.keys(pin.sha256).filter((p) => pin.sha256[p] !== old.sha256[p]);
  console.log(name, pin.files, "unchanged paths; reviewed changes", changed);
  if (changed.some((p) => !allowed.has(p))) throw Error("Unexpected substantive output");
}
if (process.argv.includes("--write")) {
  await writeFile(
    new URL(`../../../../../${path}`, import.meta.url),
    `${JSON.stringify(next, null, 2)}\n`,
  );
  console.log(
    "Reviewed pins written; only new generated dependency pins/Docker copy, private browser credential reader, security header and extension guide.",
  );
}

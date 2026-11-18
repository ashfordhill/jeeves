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
const previous = JSON.parse(await readFile(path, "utf8")) as Record<string, OffPin>;
const registry = loadLocalV2Registry();
const next = Object.fromEntries(
  Object.entries(offDesigns(registry)).map(([name, source]) => [name, offPin(source, registry)]),
);
const allowed = new Set([
  ".jeeves/extensions.md",
  ".jeeves/manifest.json",
  "src/runtime/admission.ts",
  "src/runtime/keys.ts",
  "src/runtime/settings.ts",
]);
for (const [name, pin] of Object.entries(next)) {
  const old = previous[name];
  if (
    !old ||
    old.files !== pin.files ||
    Object.keys(pin.sha256).join() !== Object.keys(old.sha256).join()
  )
    throw Error("Unexpected file-set change");
  const changes = Object.keys(pin.sha256).filter((path) => pin.sha256[path] !== old.sha256[path]);
  if (changes.some((path) => !allowed.has(path)))
    throw Error(`Unexpected emitted changes: ${changes}`);
  console.log(name, pin.files, "unchanged file paths; changed:", changes);
}
await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  "Reviewed pins updated: guide/provenance, private webhook crypto/ring consumer and HMAC challenge classification; normalized report/dependencies unchanged",
);

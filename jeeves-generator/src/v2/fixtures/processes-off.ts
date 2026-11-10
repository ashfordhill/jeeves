/**
 * The processes-off pins (tile process contract, sections 1 and 8): what frozen v2, the v2
 * module design with its useful values and the stub stack export with Runnable processes off.
 * Every payload file is pinned by hash. The two provenance files are pinned with their source and
 * emitter inventory set aside, the only part a code change may move.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stubStackDesign } from "../../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import {
  moduleAuthored,
  tileLevelTwin,
} from "../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { canonicalJson } from "../../json.ts";
import { assembleV2 } from "../assemble.ts";
import type { V2Registry } from "../registry.ts";

export type OffPin = { files: number; sha256: Record<string, string> };
const provenance = [".jeeves/manifest.json", ".jeeves/report.json"];
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

/** An emitter identity becomes its ID: its sources, hashes and version are inventory. */
function withoutInventory(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutInventory);
  if (!value || typeof value !== "object") return value;
  if ("sourceSha256" in value && "sources" in value && "id" in value) return value.id;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, withoutInventory(item)]),
  );
}
const json = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes));

/** The provenance files without their inventory: the registry, implementations, dependencies
 * and each emitter identity's sources, and the report's own hash and size in the manifest. */
export function provenanceWithoutInventory(path: string, bytes: Uint8Array) {
  const value = json(bytes);
  if (path === ".jeeves/report.json") {
    delete value.implementations;
    return canonicalJson(withoutInventory(value));
  }
  delete value.registry;
  delete value.implementations;
  delete value.dependencies;
  for (const file of value.files)
    if (file.path === ".jeeves/report.json") {
      delete file.sha256;
      delete file.bytes;
    }
  return canonicalJson(withoutInventory(value));
}

/** The three designs the off pins cover, as the export receives them. */
export function offDesigns(registry: V2Registry): Record<string, string> {
  return {
    "frozen-v2": readFileSync(
      new URL("../../../../field-projects/youtube/v2/inputs/design.json", import.meta.url),
      "utf8",
    ),
    "v2-module-design": canonicalJson(moduleAuthored(tileLevelTwin(), registry.installed)),
    "stub-stack": canonicalJson(stubStackDesign()),
  };
}

export function offPin(designJson: string, registry: V2Registry): OffPin {
  const bundle = assembleV2({ designJson }, registry);
  return {
    files: bundle.files.length,
    sha256: Object.fromEntries(
      bundle.files.map((file) => [
        file.path,
        sha256(
          provenance.includes(file.path)
            ? provenanceWithoutInventory(file.path, file.bytes)
            : file.bytes,
        ),
      ]),
    ),
  };
}

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { RuntimePackage } from "./contract.ts";
import { runtimeTarballName, VENDOR_DIR } from "./packages.ts";

/** Released components are copied byte-for-byte, never repacked from mutable source. */
export function frozenRuntime(
  runtime: RuntimePackage,
): { path: string; contents: Buffer } | undefined {
  if (!runtime.artifact) return undefined;
  const contents = readFileSync(runtime.artifact.path);
  if (createHash("sha256").update(contents).digest("hex") !== runtime.artifact.sha256)
    throw new Error(`Frozen runtime checksum mismatch: ${runtime.name}@${runtime.version}`);
  return { path: `${VENDOR_DIR}/${runtimeTarballName(runtime.name, runtime.version)}`, contents };
}

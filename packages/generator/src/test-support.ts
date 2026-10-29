import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type DesignDocument, designSchema } from "@jeeves/spec";
import { runtimeTarballName, VENDOR_DIR } from "@jeeves/template-kit";
import type { Vendor } from "./generate.ts";

/** A fixture design from `fixtures/designs/`. */
export function fixtureDesign(name: string): DesignDocument {
  const url = new URL(`../../../fixtures/designs/${name}.json`, import.meta.url);
  return designSchema.parse(JSON.parse(readFileSync(url, "utf8")));
}

/** Stands in for `pnpm pack` in unit tests: writes a small placeholder per runtime. */
export const fakeVendor: Vendor = async (dir, runtimes) => {
  mkdirSync(join(dir, VENDOR_DIR), { recursive: true });
  return runtimes.map((runtime) => {
    const path = `${VENDOR_DIR}/${runtimeTarballName(runtime.name, runtime.version)}`;
    writeFileSync(join(dir, path), `${runtime.name}@${runtime.version}\n`);
    return path;
  });
};

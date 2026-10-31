import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { LocalHttpPoolBinding } from "@jeeves/spec";
import {
  mergePackageDependencies,
  mergePackageScripts,
  type OutputFile,
} from "@jeeves/template-kit";
import type { Lock } from "./lock.ts";
import type { PackageEdit, ProjectPlan } from "./plan.ts";

const ignoredDirectories = new Set([
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
  ".git",
]);
const ignoredFile = (path: string) =>
  path.endsWith(".md") || ["pnpm-lock.yaml", "package-lock.json"].includes(posix.basename(path));
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
/** Comments/display metadata do not change the closed executable shape. */
export function poolSourceHash(path: string, source: string): string {
  let normalized: string;
  if (path.endsWith(".json")) {
    const parsed = JSON.parse(source);
    if (posix.basename(path) === "package.json") {
      delete parsed.name;
      delete parsed.description;
    }
    normalized = JSON.stringify(canonical(parsed));
  } else
    normalized = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line &&
          !line.startsWith("//") &&
          (!line.startsWith("#") || /^#\s*(?:syntax|escape|check)\s*=/i.test(line)),
      )
      .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}
function withPackageEdits(path: string, source: string, edits: PackageEdit[]) {
  const edit = edits.find((item) => item.path === path);
  return edit
    ? mergePackageScripts(mergePackageDependencies(source, edit.dependencies), edit.scripts)
    : source;
}
export function poolSourceHashes(
  bindings: Record<string, LocalHttpPoolBinding>,
  files: OutputFile[],
  edits: PackageEdit[],
): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.keys(bindings).map((id) => [
      id,
      Object.fromEntries(
        files
          .filter(
            (file) =>
              file.path.startsWith(`services/${id}/`) &&
              file.ownership === "scaffold" &&
              !ignoredFile(file.path),
          )
          .map((file) => [
            file.path,
            poolSourceHash(file.path, withPackageEdits(file.path, file.contents, edits)),
          ]),
      ),
    ]),
  );
}
export class PoolSourceError extends Error {}
function inspect(
  dir: string,
  id: string,
  hashes: Record<string, string>,
  owned: Set<string>,
  options?: { edits: PackageEdit[] },
) {
  const fail = (path: string) => {
    throw new PoolSourceError(
      `${path}: local HTTP pool 0.1.0 requires unchanged generated-resource execution source. Remove the pool or use a separately reviewed capability; existing files are preserved.`,
    );
  };
  for (const part of ["services", `services/${id}`])
    if (lstatSync(join(dir, part), { throwIfNoEntry: false })?.isSymbolicLink()) fail(part);
  const visit = (relative: string) => {
    if (!existsSync(join(dir, relative))) return;
    for (const name of readdirSync(join(dir, relative)).sort()) {
      if (relative === `services/${id}` && ignoredDirectories.has(name)) continue;
      const path = posix.join(relative, name),
        stat = lstatSync(join(dir, path));
      if (stat.isSymbolicLink()) fail(path);
      if (stat.isDirectory()) {
        visit(path);
        continue;
      }
      if (!stat.isFile()) fail(path);
      if (ignoredFile(path) || owned.has(path)) continue;
      if (!hashes[path]) fail(path);
      const text = readFileSync(join(dir, path), "utf8");
      if (
        poolSourceHash(path, options ? withPackageEdits(path, text, options.edits) : text) !==
        hashes[path]
      )
        fail(path);
    }
  };
  visit(`services/${id}`);
  if (!options)
    for (const path of Object.keys(hashes)) if (!existsSync(join(dir, path))) fail(path);
}
/** Preflight runs before vending, scaffold writes, environment setup or lock mutation. */
export function assertPoolSourcePreflight(dir: string, plan: ProjectPlan): void {
  const owned = new Set(
    plan.files.filter((file) => file.ownership === "generated").map((file) => file.path),
  );
  for (const id of Object.keys(plan.httpPools ?? {})) {
    const hashes = plan.poolSourceHashes?.[id];
    if (!hashes || !Object.keys(hashes).length)
      throw new PoolSourceError(`Pool ${id} has no reviewed source shape`);
    inspect(dir, id, hashes, owned, { edits: plan.packageEdits });
  }
}
export function assertPoolSourceIntegrity(dir: string, lock: Lock): void {
  for (const id of Object.keys(lock.httpPools ?? {})) {
    const hashes = lock.poolSourceHashes?.[id];
    if (!hashes || !Object.keys(hashes).length)
      throw new PoolSourceError(`Pool ${id} has no reviewed source fingerprints`);
    inspect(dir, id, hashes, new Set(Object.keys(lock.files)));
  }
}

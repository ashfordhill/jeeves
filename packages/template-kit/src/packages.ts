import { posix } from "node:path";

/** Where runtime tarballs live in a generated project (PLAN §8 "Distribution"). */
export const VENDOR_DIR = "vendor/jeeves";

/** The file name `pnpm pack` gives a package: `@jeeves/service-runtime` → `jeeves-service-runtime-0.1.0.tgz`. */
export function runtimeTarballName(name: string, version: string): string {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

/** The `file:` spec an element's `package.json` uses for a vendored runtime. */
export function vendoredRuntimeSpec(elementDir: string, name: string, version: string): string {
  return `file:${posix.relative(elementDir, `${VENDOR_DIR}/${runtimeTarballName(name, version)}`)}`;
}

export interface DependencyEntry {
  name: string;
  /** A version or a `file:` spec. */
  spec: string;
  dev?: boolean;
}

/**
 * Adds dependencies a `package.json` is missing, keeping everything else as it is. A package that
 * is already listed (in either section) is left alone, even at another version: the file is
 * project-owned, and upgrades are deliberate. Returns the text unchanged when nothing was added;
 * otherwise the touched dependency maps are sorted, as npm and pnpm write them.
 */
export function mergePackageDependencies(text: string, entries: DependencyEntry[]): string {
  const pkg = JSON.parse(text) as Record<string, unknown>;
  const section = (key: string) => (pkg[key] ?? {}) as Record<string, string>;
  const listed = new Set([
    ...Object.keys(section("dependencies")),
    ...Object.keys(section("devDependencies")),
  ]);
  let changed = false;
  for (const entry of entries) {
    if (listed.has(entry.name)) continue;
    const key = entry.dev ? "devDependencies" : "dependencies";
    const deps = { ...section(key), [entry.name]: entry.spec };
    pkg[key] = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => (a < b ? -1 : 1)));
    listed.add(entry.name);
    changed = true;
  }
  return changed ? `${JSON.stringify(pkg, null, 2)}\n` : text;
}

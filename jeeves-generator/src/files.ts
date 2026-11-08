import { refuse, sha256 } from "./json.ts";

export interface BundleFile {
  path: string;
  bytes: Uint8Array;
}
/** Portable archive paths only. No normalization that could conceal a collision/traversal. */
export function assertSafeOutputPath(path: string): void {
  if (!path || path.length > 240 || !/^[A-Za-z0-9._/-]+$/u.test(path))
    refuse("UNSAFE_OUTPUT_PATH", path, "Use a bounded portable relative file path.");
  for (const part of path.split("/")) {
    if (
      !part ||
      part === "." ||
      part === ".." ||
      part.endsWith(".") ||
      part.toLowerCase() === ".git" ||
      /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(part)
    )
      refuse(
        "UNSAFE_OUTPUT_PATH",
        path,
        "Traversal, empty/reserved segments and Git internals are forbidden.",
      );
  }
}
export function assertDistinctPaths(paths: readonly string[]): void {
  const seen = new Set<string>();
  for (const path of paths) {
    assertSafeOutputPath(path);
    const key = path.toLowerCase();
    if (seen.has(key))
      refuse(
        "OUTPUT_COLLISION",
        path,
        "Duplicate output paths are refused, even for identical bytes.",
      );
    seen.add(key);
  }
  for (const key of seen) {
    const parts = key.split("/");
    parts.pop();
    while (parts.length) {
      if (seen.has(parts.join("/")))
        refuse("OUTPUT_COLLISION", key, "A file cannot also be an output directory.");
      parts.pop();
    }
  }
}

/** Pure conservative preflight, not a filesystem writer. Existing files are never overwritten.
 * A physical exporter must additionally refuse symlinks and use exclusive file creation.
 */
export function planFileWrites(
  files: readonly BundleFile[],
  existingFiles: readonly BundleFile[] = [],
) {
  assertDistinctPaths(files.map((file) => file.path));
  assertDistinctPaths(existingFiles.map((file) => file.path));
  const existing = new Map(existingFiles.map((file) => [file.path.toLowerCase(), file]));
  assertDistinctPaths([
    ...new Set([...existingFiles.map((file) => file.path), ...files.map((file) => file.path)]),
  ]);
  const create: BundleFile[] = [],
    unchanged: string[] = [];
  for (const file of files) {
    const prior = existing.get(file.path.toLowerCase());
    if (prior) {
      if (prior.path !== file.path || sha256(prior.bytes) !== sha256(file.bytes))
        refuse(
          "EXISTING_OUTPUT_CHANGED",
          file.path,
          "Preserve existing edits. Export to an empty directory and review/integrate changes explicitly.",
        );
      unchanged.push(file.path);
    } else create.push({ path: file.path, bytes: new Uint8Array(file.bytes) });
  }
  return { create, unchanged };
}

import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { assertDistinctPaths, type BundleFile } from "./files.ts";

/** Create ONLY a new private directory. Refuse existing destinations/ancestor symlinks.
 * No merge, rollback or recursive deletion: partial exports remain inspectable on failure.
 * Parent must be owned/trusted; no portable Node API makes hostile ancestor renames safe.
 */
export async function exportNewDirectory(files: readonly BundleFile[], destination: string) {
  assertDistinctPaths(files.map((file) => file.path));
  const root = resolve(destination);
  for (let parent = dirname(root); ; parent = dirname(parent)) {
    const info = await lstat(parent);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error(`Unsafe export ancestor: ${parent}`);
    if (dirname(parent) === parent) break;
  }
  if (!isAbsolute(root) || (await realpath(dirname(root))) !== dirname(root))
    throw new Error("Export parent must be a real directory.");
  await mkdir(root, { mode: 0o700 }); // EEXIST deliberately refuses even an empty directory.
  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop();
    let directory = root;
    for (const part of parts) {
      directory = join(directory, part);
      try {
        await mkdir(directory, { mode: 0o755 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error(`Unsafe export directory: ${directory}`);
    }
    const handle = await open(
      join(root, file.path),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o644,
    );
    try {
      await handle.writeFile(file.bytes);
    } finally {
      await handle.close();
    }
  }
  return { directory: root, files: files.length };
}

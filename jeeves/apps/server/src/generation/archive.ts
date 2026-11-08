import { crc32 } from "node:zlib";
import { assertDistinctPaths, type BundleFile, GeneratorRefusal } from "@jeeves/generator";

/** A small stored ZIP: stable ASCII paths, DOS epoch, no extras/comments/data descriptors.
 * File bytes are exact assembler output. Never touches disk or emits executable/symlink modes.
 */
export function scaffoldArchive(files: readonly BundleFile[]): Buffer {
  const maxTotal = 16 * 1024 * 1024;
  if (!files.length || files.length > 256)
    throw new GeneratorRefusal("ARCHIVE_LIMIT", "/files", "Export requires 1–256 files.");
  assertDistinctPaths(files.map((file) => file.path));
  let total = 22;
  for (const file of files) {
    total += file.bytes.length + 76 + 2 * Buffer.byteLength(file.path);
    if (file.bytes.length > 8 * 1024 * 1024 || total > maxTotal)
      throw new GeneratorRefusal(
        "ARCHIVE_LIMIT",
        file.path,
        "Export exceeds the 16 MiB archive or 8 MiB file limit.",
      );
  }
  const entries: Buffer[] = [],
    directory: Buffer[] = [];
  let offset = 0;
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const name = Buffer.from(file.path);
    const checksum = crc32(file.bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x21, 12); // 1980-01-01, 00:00:00
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file.bytes.length, 18);
    local.writeUInt32LE(file.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // DOS host; normal files, no Unix mode/symlinks
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(file.bytes.length, 20);
    central.writeUInt32LE(file.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    entries.push(local, name, Buffer.from(file.bytes));
    directory.push(central, name);
    offset += local.length + name.length + file.bytes.length;
  }
  const end = Buffer.alloc(22);
  const directoryBytes = directory.reduce((n, part) => n + part.length, 0);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directoryBytes, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, ...directory, end], total);
}

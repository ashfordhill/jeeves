import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type ArchitectureFragment,
  type ArchitectureLibraryEntry,
  architectureLibraryEntrySchema,
  type LibraryMetadata,
  libraryContent,
  libraryMetadataSchema,
  libraryOptionChoices,
} from "@jeeves/spec";
import { z } from "zod";

export class LibraryError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}
const catalogSchema = z.strictObject({
  formatVersion: z.literal(1),
  entries: z.array(architectureLibraryEntrySchema).max(500),
});
const hash = (entry: Pick<ArchitectureLibraryEntry, "fragment" | "metadata">) =>
  createHash("sha256").update(libraryContent(entry)).digest("hex");

/** One local server owns this atomic file. Immutable versions outlive projects and retirement. */
export class ArchitectureLibrary {
  readonly path: string;
  constructor(home: string) {
    this.path = join(home, "architecture-library.json");
  }
  private read() {
    if (!existsSync(this.path)) return [];
    const data = catalogSchema.parse(JSON.parse(readFileSync(this.path, "utf8")));
    const seen = new Set<string>();
    for (const entry of data.entries) {
      const key = `${entry.id}@${entry.version}`;
      if (seen.has(key) || hash(entry) !== entry.contentHash)
        throw new LibraryError(
          "The local architecture catalog has conflicting or modified content.",
          422,
        );
      seen.add(key);
    }
    return data.entries;
  }
  private write(entries: ArchitectureLibraryEntry[]) {
    const content = catalogSchema.parse({ formatVersion: 1, entries });
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(content, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    renameSync(temporary, this.path);
  }
  list(query = "", includeUnavailable = false) {
    return this.read().filter(
      (e) =>
        (includeUnavailable || e.state === "published") &&
        `${e.metadata.name} ${e.metadata.purpose} ${e.id}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  }
  get(id: string, version: string) {
    const entry = this.read().find((e) => e.id === id && e.version === version);
    if (!entry) throw new LibraryError("Architecture version not found.", 404);
    return entry;
  }
  create(fragment: ArchitectureFragment, metadata: LibraryMetadata) {
    const entries = this.read();
    if (entries.some((e) => e.id === fragment.id && e.version === fragment.version))
      throw new LibraryError("This version already exists. Choose a new version.");
    const entry = architectureLibraryEntrySchema.parse({
      id: fragment.id,
      version: fragment.version,
      state: "draft",
      draftRevision: 0,
      fragment,
      metadata,
      contentHash: hash({ fragment, metadata }),
      availability: "architecture only",
    });
    entries.push(entry);
    this.write(entries);
    return entry;
  }
  clone(id: string, version: string, nextVersion: string) {
    const source = this.get(id, version);
    return this.create({ ...source.fragment, version: nextVersion }, source.metadata);
  }
  change(
    id: string,
    version: string,
    revision: number,
    action: "edit" | "publish" | "retire" | "delete",
    metadata?: LibraryMetadata,
  ) {
    const entries = this.read();
    const entry = entries.find((e) => e.id === id && e.version === version);
    if (!entry) throw new LibraryError("Architecture version not found.", 404);
    if (entry.draftRevision !== revision)
      throw new LibraryError("The library draft changed. Reload it before saving.");
    if (action === "retire") {
      if (entry.state !== "published")
        throw new LibraryError("Only published versions can be retired.");
      entry.state = "retired";
    } else {
      if (entry.state !== "draft")
        throw new LibraryError("Published content is immutable. Create a new version.");
      if (action === "delete") {
        this.write(entries.filter((e) => e !== entry));
        return undefined;
      }
      if (action === "edit") {
        entry.metadata = libraryMetadataSchema.parse(metadata);
        for (const point of entry.metadata.extensionPoints)
          if (!entry.fragment.roles.some((r) => r.id === point.role && !r.required))
            throw new LibraryError("Extension points must name copied roles.", 422);
        for (const option of entry.metadata.exposedOptions)
          if (!libraryOptionChoices(entry, option.role, option.field))
            throw new LibraryError(
              "Expose only a copied component's existing finite options.",
              422,
            );
        entry.fragment.name = entry.metadata.name;
        entry.fragment.description = entry.metadata.purpose;
        entry.fragment.invariants = entry.metadata.invariants;
        entry.fragment.extensionPoints = entry.metadata.extensionPoints;
      }
      if (action === "publish") entry.state = "published";
    }
    entry.draftRevision++;
    entry.contentHash = hash(entry);
    this.write(entries);
    return entry;
  }
}

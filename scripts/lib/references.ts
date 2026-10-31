import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type Reference = {
  id: string;
  repository: string;
  commit: string;
  observedAt: string;
  status: "inspected";
  license: { summary: string; evidence: string[]; excluded: string[] };
  candidates: string[];
  files: { path: string; sha256: string }[];
};

export function readReferences(root: string): Reference[] {
  const catalog = JSON.parse(
    readFileSync(join(root, "docs/reference/architecture-sources.json"), "utf8"),
  );
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.references))
    throw new Error("Unsupported architecture source catalog.");
  const ids = new Set<string>();
  for (const item of catalog.references) {
    if (
      !/^[a-z][a-z0-9-]+$/.test(item.id) ||
      ids.has(item.id) ||
      !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(item.repository) ||
      !/^[a-f0-9]{40}$/.test(item.commit) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.observedAt) ||
      item.status !== "inspected" ||
      typeof item.license?.summary !== "string" ||
      !Array.isArray(item.license?.evidence) ||
      !Array.isArray(item.license?.excluded) ||
      !Array.isArray(item.candidates) ||
      !Array.isArray(item.files) ||
      !item.files.length
    )
      throw new Error("Invalid architecture source metadata.");
    ids.add(item.id);
    const paths = new Set<string>();
    for (const file of item.files) {
      if (
        typeof file.path !== "string" ||
        !file.path
          .split("/")
          .every(
            (part: string) => /^[A-Za-z0-9_.[\]@-]+$/.test(part) && part !== "." && part !== "..",
          ) ||
        paths.has(file.path) ||
        !/^[a-f0-9]{64}$/.test(file.sha256)
      )
        throw new Error(`Invalid source path/hash for ${item.id}.`);
      paths.add(file.path);
    }
    if (
      !item.license.evidence.length ||
      item.license.evidence.some((path: string) => !paths.has(path))
    )
      throw new Error(`Missing license evidence for ${item.id}.`);
  }
  return catalog.references;
}

export async function inspectReference(root: string, reference: Reference, allowFetch: boolean) {
  let downloaded = 0;
  const directory = join(root, ".jeeves-work/references", reference.id, reference.commit);
  for (const file of reference.files) {
    const destination = join(directory, file.path);
    let bytes: Buffer;
    if (existsSync(destination)) {
      bytes = readFileSync(destination);
    } else {
      if (!allowFetch) throw new Error(`Missing cached source: ${destination}`);
      const path = file.path.split("/").map(encodeURIComponent).join("/");
      const url = `https://raw.githubusercontent.com/${reference.repository}/${reference.commit}/${path}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
        headers: { "user-agent": "Jeeves-architecture-reference-reader" },
      });
      if (!response.ok) throw new Error(`Source fetch failed (${response.status}): ${url}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5 * 1024 * 1024) throw new Error(`Unexpectedly large source: ${url}`);
      downloaded++;
    }
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
      throw new Error(
        `Source hash mismatch: ${destination}. Inspect; never silently replace provenance.`,
      );
    if (!existsSync(destination)) {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
    }
  }
  return {
    id: reference.id,
    commit: reference.commit,
    files: reference.files.length,
    downloaded,
    directory,
  };
}

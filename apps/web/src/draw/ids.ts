import { type DesignDocument, designIds } from "@jeeves/spec";

/** Lowercase slug that satisfies the spec's `idSchema`. */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return /^[a-z]/.test(slug) ? slug : `x${slug ? `-${slug}` : ""}`;
}

/**
 * An ID based on `base` that no design item uses yet: `base`, then `base-2`, `base-3`, ….
 * `reserved` holds IDs already picked for the same batch.
 */
export function uniqueId(
  design: DesignDocument,
  base: string,
  reserved: ReadonlySet<string> = new Set(),
): string {
  const taken = new Set(Array.from(designIds(design), (entry) => entry.id));
  const root = slugify(base);
  if (!taken.has(root) && !reserved.has(root)) return root;
  for (let n = 2; ; n++) {
    const id = `${root}-${n}`;
    if (!taken.has(id) && !reserved.has(id)) return id;
  }
}

/** A display name not used by another element: `name`, then `name 2`, …. */
export function uniqueName(design: DesignDocument, name: string): string {
  const taken = new Set(design.elements.map((e) => e.name));
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) {
    const next = `${name} ${n}`;
    if (!taken.has(next)) return next;
  }
}

/**
 * Fresh identities for things the canvas and inspector create (tiles, links, modules). Internal to
 * the spec: the lane commands and module helpers share it; the package index does not export it.
 */
import { type DesignDocument, designIds } from "./design.ts";
import { idSchema } from "./ids.ts";

/** Every identity in use, including C1 declarations and components. */
export function usedIds(design: DesignDocument): Set<string> {
  const architecture = design.architecture;
  return new Set([
    "system",
    ...Array.from(designIds(design), (item) => item.id),
    ...(architecture?.nodes ?? []).map((item) => item.id),
    ...(architecture?.relationships ?? []).map((item) => item.id),
    ...(architecture?.studio?.components ?? []).map((item) => item.id),
    ...(architecture?.studio?.componentConnections ?? []).map((item) => item.id),
  ]);
}

/** `base`, or `base-2`, `base-3`…, shortened to fit an ID. */
export function freshId(base: string, taken: (id: string) => boolean): string {
  const fit = (text: string, room: number) => text.slice(0, room).replace(/-+$/, "");
  const stem = idSchema.safeParse(fit(base, 63)).success ? base : "link";
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? "" : `-${n}`;
    const id = `${fit(stem, 63 - suffix.length)}${suffix}`;
    if (!taken(id)) return id;
  }
}

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

import { z } from "zod";
import type { DesignDocument } from "./design.ts";

const cameraSchema = z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() });
const viewIdentity = z.string().min(1).max(300);

/** Per-view presentation hints. Studio coordinates are derived by automatic layout (SG06). */
export const studioLayoutViewSchema = z.strictObject({
  /** Row-order hint: node identities in preferred top-to-bottom order. */
  order: z.array(viewIdentity).max(1000).optional(),
  viewport: cameraSchema.optional(),
});
export type StudioLayoutView = z.output<typeof studioLayoutViewSchema>;

/**
 * Presentation hints, keyed by studio view key. Stored separately from the design so they never
 * change the semantic revision or the blueprint.
 */
export const layoutSchema = z.strictObject({
  schemaVersion: z.literal(1),
  architecture: z.record(viewIdentity, studioLayoutViewSchema).optional(),
});
export type LayoutDocument = z.output<typeof layoutSchema>;

export function emptyLayout(): LayoutDocument {
  return { schemaVersion: 1 };
}

/** Whether a studio node key still names something in the design. */
function alive(design: DesignDocument, key: string): boolean {
  const [, kind, id] = key.split(":");
  if (kind === "system") return !!design.architecture;
  if (kind === "package")
    return !!design.architecture?.studio?.packages.some((item) => item.id === id);
  if (kind === "element") return design.elements.some((item) => item.id === id);
  if (kind === "context")
    return id === "system" || !!design.architecture?.nodes.some((item) => item.id === id);
  if (kind === "component")
    return !!design.architecture?.studio?.components?.some((item) => item.id === id);
  return false;
}

/** Drops row-order entries for identities the design no longer has. */
export function pruneLayout(layout: LayoutDocument, design: DesignDocument): LayoutDocument {
  if (!layout.architecture) return layout;
  const architecture = Object.fromEntries(
    Object.entries(layout.architecture).map(([key, view]) => [
      key,
      { ...view, ...(view.order && { order: view.order.filter((id) => alive(design, id)) }) },
    ]),
  );
  return { ...layout, architecture };
}

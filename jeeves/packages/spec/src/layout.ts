import { z } from "zod";

const cameraSchema = z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() });
const viewIdentity = z.string().min(1).max(300);

/** Per-view presentation hints: a row order and a camera. The lane canvas uses neither. */
const studioLayoutViewSchema = z.strictObject({
  order: z.array(viewIdentity).max(1000).optional(),
  viewport: cameraSchema.optional(),
});

/**
 * Presentation hints, keyed by view. Stored separately from the design so they never change the
 * semantic revision or the blueprint. The server keeps the layout route; the lane canvas lays out
 * automatically and neither reads nor writes it.
 */
export const layoutSchema = z.strictObject({
  schemaVersion: z.literal(1),
  architecture: z.record(viewIdentity, studioLayoutViewSchema).optional(),
});
export type LayoutDocument = z.output<typeof layoutSchema>;

export function emptyLayout(): LayoutDocument {
  return { schemaVersion: 1 };
}

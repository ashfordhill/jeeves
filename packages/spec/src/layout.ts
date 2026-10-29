import { z } from "zod";
import { type DesignDocument, designIds } from "./design.ts";
import { idSchema } from "./ids.ts";

const pointSchema = z.strictObject({ x: z.number(), y: z.number() });

export const layoutItemSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  collapsed: z.boolean().optional(),
  /** Frame annotation this item sits in. */
  parent: idSchema.optional(),
  /** Waypoints for connections and plain arrows; free arrow ends are the first and last. */
  points: z.array(pointSchema).optional(),
});
export type LayoutItem = z.infer<typeof layoutItemSchema>;

/**
 * Positions and sizes, keyed by design ID. Stored separately from the design so moving things
 * never changes the semantic revision or what Generate produces.
 */
export const layoutSchema = z.strictObject({
  schemaVersion: z.literal(1),
  items: z.record(idSchema, layoutItemSchema).default({}),
  viewport: z
    .strictObject({ x: z.number(), y: z.number(), zoom: z.number().positive() })
    .optional(),
});
export type LayoutDocument = z.output<typeof layoutSchema>;

export function emptyLayout(): LayoutDocument {
  return { schemaVersion: 1, items: {} };
}

/** Drops layout entries (and frame parents) for IDs the design no longer has. */
export function pruneLayout(layout: LayoutDocument, design: DesignDocument): LayoutDocument {
  const ids = new Set(Array.from(designIds(design), (entry) => entry.id));
  const items: LayoutDocument["items"] = {};
  for (const [id, item] of Object.entries(layout.items)) {
    if (!ids.has(id)) continue;
    if (item.parent !== undefined && !ids.has(item.parent)) {
      const { parent: _parent, ...rest } = item;
      items[id] = rest;
    } else {
      items[id] = item;
    }
  }
  return { ...layout, items };
}

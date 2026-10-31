import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { idSchema, templateRefSchema } from "./ids.ts";

export const connectionKindSchema = z.enum(["uses-database", "calls", "depends-on"]);
export type ConnectionKind = z.infer<typeof connectionKindSchema>;

/** Template config values as stored. Defaults are not filled in; see `resolveConfig`. */
export const configValuesSchema = z.record(z.string(), z.unknown());
export type ConfigValues = z.infer<typeof configValuesSchema>;

/** A catalog-owned product composition; configuration is validated by its pinned recipe. */
export const recipeBindingSchema = z.strictObject({
  id: idSchema,
  version: templateRefSchema.shape.version,
  config: configValuesSchema.default({}),
});
export type RecipeBinding = z.output<typeof recipeBindingSchema>;

export const notesSchema = z.string().max(20_000);

export const attachmentSchema = z.strictObject({
  id: idSchema,
  template: templateRefSchema,
  config: configValuesSchema.default({}),
  notes: notesSchema.default(""),
});
export type Attachment = z.output<typeof attachmentSchema>;
export type AttachmentInput = z.input<typeof attachmentSchema>;

export const elementSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  /** `null` means "needs a template": a capability the registry can't provide yet. */
  template: templateRefSchema.nullable(),
  config: configValuesSchema.default({}),
  attachments: z.array(attachmentSchema).default([]),
  notes: notesSchema.default(""),
});
export type Element = z.output<typeof elementSchema>;
export type ElementInput = z.input<typeof elementSchema>;

/** One end of a connection: an element, or one of its attachments. */
export const endpointSchema = z.strictObject({
  element: idSchema,
  attachment: idSchema.optional(),
});
export type Endpoint = z.infer<typeof endpointSchema>;

export const connectionSchema = z.strictObject({
  id: idSchema,
  kind: connectionKindSchema,
  from: endpointSchema,
  to: endpointSchema,
  config: z
    .strictObject({ fromCapability: idSchema.optional(), toCapability: idSchema.optional() })
    .optional(),
});
export type Connection = z.infer<typeof connectionSchema>;

export const noteColorSchema = z.enum(["yellow", "blue", "green", "pink", "gray"]);

/** Presentation-only items. They never affect generation. */
export const annotationSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: idSchema, kind: z.literal("text"), text: z.string().max(5_000) }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("note"),
    text: z.string().max(5_000),
    color: noteColorSchema.optional(),
  }),
  z.strictObject({ id: idSchema, kind: z.literal("frame"), title: z.string().max(200) }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("arrow"),
    label: z.string().max(200).optional(),
    /** Optional item IDs the arrow is bound to; free ends are positioned by the layout. */
    from: idSchema.optional(),
    to: idSchema.optional(),
  }),
]);
export type Annotation = z.infer<typeof annotationSchema>;

export const designSchema = z.strictObject({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  /** Semantic revision. Bumped once per applied operation batch, never by layout changes. */
  revision: z.int().nonnegative(),
  recipe: recipeBindingSchema.optional(),
  /** Origin of an editable copy, not a binding or a claim that current behavior is provided. */
  startedFrom: templateRefSchema
    .extend({ manifestSha256: z.string().regex(/^[a-f0-9]{64}$/) })
    .optional(),
  architecture: architectureSchema.optional(),
  elements: z.array(elementSchema).default([]),
  connections: z.array(connectionSchema).default([]),
  annotations: z.array(annotationSchema).default([]),
});
export type DesignDocument = z.output<typeof designSchema>;
export type DesignDocumentInput = z.input<typeof designSchema>;

/** Explicit, lossless v1 conversion. A layout save must never persist this conversion. */
export function upgradeDesign(input: DesignDocument): DesignDocument {
  if (input.schemaVersion === 2) return structuredClone(input);
  return {
    ...structuredClone(input),
    schemaVersion: 2,
    connections: input.connections.map((c) => ({
      ...c,
      from: { element: c.from.element },
      to: { element: c.to.element },
      ...((c.config || c.from.attachment || c.to.attachment) && {
        config: {
          ...c.config,
          ...(c.from.attachment && { fromCapability: c.from.attachment }),
          ...(c.to.attachment && { toCapability: c.to.attachment }),
        },
      }),
    })),
  };
}

/** Effective capability, for validation/generation only; semantic v2 endpoints stay outer. */
export function capabilityEndpoint(c: Connection, side: "from" | "to"): Endpoint {
  const capability = c.config?.[side === "from" ? "fromCapability" : "toCapability"];
  return {
    element: c[side].element,
    ...((capability ?? c[side].attachment) && { attachment: capability ?? c[side].attachment }),
  };
}

export function emptyDesign(): DesignDocument {
  return { schemaVersion: 2, revision: 0, elements: [], connections: [], annotations: [] };
}

/** Every ID in the design with what it names, in document order. */
export function* designIds(
  design: DesignDocument,
): Generator<{ id: string; type: "element" | "attachment" | "connection" | "annotation" }> {
  for (const element of design.elements) {
    yield { id: element.id, type: "element" };
    for (const attachment of element.attachments) yield { id: attachment.id, type: "attachment" };
  }
  for (const connection of design.connections) yield { id: connection.id, type: "connection" };
  for (const annotation of design.annotations) yield { id: annotation.id, type: "annotation" };
}

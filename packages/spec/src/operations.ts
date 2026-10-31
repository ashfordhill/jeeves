import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import {
  annotationSchema,
  attachmentSchema,
  configValuesSchema,
  connectionSchema,
  elementSchema,
  noteColorSchema,
  notesSchema,
  recipeBindingSchema,
} from "./design.ts";
import { idSchema, templateRefSchema } from "./ids.ts";

/**
 * Every design edit, from the canvas or from chat, is one of these. IDs are chosen by the caller
 * so a batch can add an element and connect it in one go.
 */
export const operationSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("setArchitecture"), architecture: architectureSchema.nullable() }),
  z.strictObject({ op: z.literal("setRecipe"), recipe: recipeBindingSchema.nullable() }),
  z.strictObject({ op: z.literal("addElement"), element: elementSchema }),
  z.strictObject({
    op: z.literal("updateElement"),
    id: idSchema,
    name: elementSchema.shape.name.optional(),
    /** `null` turns the element into a "needs a template" placeholder. */
    template: templateRefSchema.nullable().optional(),
    /** Replaces the whole stored config. */
    config: configValuesSchema.optional(),
  }),
  /** A reviewed same-template upgrade preserves configuration, capabilities and wiring. */
  z.strictObject({
    op: z.literal("upgradeTemplate"),
    id: idSchema,
    from: templateRefSchema,
    to: templateRefSchema,
    revision: z.int().nonnegative(),
  }),
  /** Also removes the element's connections and unbinds arrows pointing at it. */
  z.strictObject({ op: z.literal("removeElement"), id: idSchema }),
  z.strictObject({
    op: z.literal("changeSubtype"),
    id: idSchema,
    template: templateRefSchema.nullable(),
    confirmation: z
      .strictObject({ revision: z.int().nonnegative(), discarded: z.array(z.string()) })
      .optional(),
  }),
  z.strictObject({
    op: z.literal("addAttachment"),
    element: idSchema,
    attachment: attachmentSchema,
  }),
  z.strictObject({
    op: z.literal("updateAttachment"),
    id: idSchema,
    template: templateRefSchema.optional(),
    config: configValuesSchema.optional(),
  }),
  /** Also removes connections to or from the attachment. */
  z.strictObject({ op: z.literal("removeAttachment"), id: idSchema }),
  z.strictObject({ op: z.literal("connect"), connection: connectionSchema }),
  z.strictObject({ op: z.literal("disconnect"), id: idSchema }),
  /** Implementation notes of an element or an attachment. */
  z.strictObject({ op: z.literal("setNotes"), id: idSchema, notes: notesSchema }),
  z.strictObject({ op: z.literal("addAnnotation"), annotation: annotationSchema }),
  z.strictObject({
    op: z.literal("updateAnnotation"),
    id: idSchema,
    text: z.string().optional(),
    title: z.string().optional(),
    label: z.string().optional(),
    color: noteColorSchema.optional(),
    /** `null` unbinds that end of an arrow. */
    from: idSchema.nullable().optional(),
    to: idSchema.nullable().optional(),
  }),
  /** Also unbinds arrows pointing at it. */
  z.strictObject({ op: z.literal("removeAnnotation"), id: idSchema }),
]);
export type Operation = z.output<typeof operationSchema>;
export type OperationInput = z.input<typeof operationSchema>;
export type OperationType = Operation["op"];

export const operationTypes = operationSchema.options.map(
  (option) => option.shape.op.value,
) as OperationType[];

/** Body of `POST /projects/:id/operations`. Applied all-or-nothing. */
export const operationBatchSchema = z.strictObject({
  baseRevision: z.int().nonnegative(),
  ops: z.array(operationSchema).min(1).max(500),
});
export type OperationBatch = z.output<typeof operationBatchSchema>;
export type OperationBatchInput = z.input<typeof operationBatchSchema>;

/** JSON Schema for model tools (e.g. the chat agent's `applyOperations`). */
export function operationBatchJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(operationBatchSchema, { io: "input" });
}

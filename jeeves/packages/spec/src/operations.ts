import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { connectionSchema, elementSchema, plannedConnectionSchema } from "./design.ts";
import { designScopeSchema } from "./design-scope.ts";
import { generationSchema } from "./generation.ts";
import { idSchema } from "./ids.ts";
import { operationContractsSchema } from "./operation-contracts.ts";
import { ownershipSchema } from "./ownership.ts";
import { studioModelSchema } from "./studio-model.ts";

/**
 * Every design edit, from the studio or from chat, is one of these. Studio commands
 * (`buildStudioCommand`) expand into them. IDs are chosen by the caller so a batch can add an
 * element and connect it in one go.
 */
export const operationSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("upgradeDesign"), scope: designScopeSchema }),
  z.strictObject({ op: z.literal("setDesignScope"), scope: designScopeSchema }),
  z.strictObject({ op: z.literal("setOwnership"), ownership: ownershipSchema }),
  z.strictObject({ op: z.literal("setOperations"), operations: operationContractsSchema }),
  z.strictObject({ op: z.literal("setGeneration"), generation: generationSchema.nullable() }),
  z.strictObject({ op: z.literal("setArchitecture"), architecture: architectureSchema.nullable() }),
  /** Canonical system text only. */
  z.strictObject({
    op: z.literal("updateArchitectureSystem"),
    name: architectureSchema.shape.system.shape.name.optional(),
    description: architectureSchema.shape.system.shape.description.optional(),
  }),
  /** Replaces only studio intent; the C1 context is retained. */
  z.strictObject({ op: z.literal("setStudio"), studio: studioModelSchema.nullable() }),
  z.strictObject({ op: z.literal("addElement"), element: elementSchema }),
  z.strictObject({
    op: z.literal("updateElement"),
    id: idSchema,
    name: elementSchema.shape.name.optional(),
    description: elementSchema.shape.description,
    classification: elementSchema.shape.classification,
  }),
  /** Also removes the element's connections. */
  z.strictObject({ op: z.literal("removeElement"), id: idSchema }),
  z.strictObject({ op: z.literal("connect"), connection: connectionSchema }),
  z.strictObject({
    op: z.literal("updatePlannedConnection"),
    id: idSchema,
    label: plannedConnectionSchema.shape.label.optional(),
    protocol: plannedConnectionSchema.shape.protocol.unwrap().optional(),
    interaction: plannedConnectionSchema.shape.interaction.unwrap().optional(),
    security: plannedConnectionSchema.shape.security.unwrap().optional(),
  }),
  z.strictObject({ op: z.literal("disconnect"), id: idSchema }),
  /**
   * Changes a tile's or a module's ID to `to`, a free ID, and every reference to it (IDs follow
   * names: `planRename`). Link IDs are never re-keyed.
   */
  z.strictObject({ op: z.literal("rekey"), from: idSchema, to: idSchema }),
]);
export type Operation = z.output<typeof operationSchema>;
export type OperationInput = z.input<typeof operationSchema>;

/** Body of `POST /projects/:id/operations`. Applied all-or-nothing. */
export const operationBatchSchema = z.strictObject({
  baseRevision: z.int().nonnegative(),
  ops: z.array(operationSchema).min(1).max(500),
});
export type OperationBatchInput = z.input<typeof operationBatchSchema>;

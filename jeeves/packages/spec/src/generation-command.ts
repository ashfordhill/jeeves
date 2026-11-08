/** One explicit source batch, including any reviewed ownership changes. Reads create no defaults. */
import { z } from "zod";
import { applyOperations } from "./apply.ts";
import { canonicalJson } from "./content-hash.ts";
import type { DesignDocument } from "./design.ts";
import { emptyDesignScope } from "./design-scope.ts";
import { isStructural } from "./findings.ts";
import { designGeneration, generationSchema } from "./generation.ts";
import type { OperationInput } from "./operations.ts";
import { ownershipSchema, previewOwnership } from "./ownership.ts";
import { validateDesign } from "./validate.ts";

export const generationCommandSchema = z.strictObject({
  generation: generationSchema.nullable(),
  /** Full explicit declarations, not grants inferred or silently supplied by the command. */
  ownership: ownershipSchema.optional(),
  upgrade: z.boolean().default(false),
});
export type GenerationCommandInput = z.input<typeof generationCommandSchema>;
export function buildGenerationCommand(
  design: DesignDocument,
  input: GenerationCommandInput,
): { ops: OperationInput[] } {
  const command = generationCommandSchema.parse(input);
  if (design.schemaVersion === 2 && !command.upgrade)
    throw new Error(
      "Preview and explicitly upgrade to schema v3 before saving template selections.",
    );
  const ops: OperationInput[] =
    design.schemaVersion === 2 ? [{ op: "upgradeDesign", scope: emptyDesignScope() }] : [];
  if (
    command.ownership &&
    canonicalJson(design.schemaVersion === 3 ? design.ownership : undefined) !==
      canonicalJson(command.ownership)
  )
    ops.push({ op: "setOwnership", ownership: command.ownership });
  if (canonicalJson(designGeneration(design) ?? null) !== canonicalJson(command.generation))
    ops.push({ op: "setGeneration", generation: command.generation });
  return { ops };
}
export function previewGeneration(design: DesignDocument, input: GenerationCommandInput) {
  const command = generationCommandSchema.parse(input);
  // Preview may show the explicit cross-version result; apply still requires upgrade=true.
  const { ops } = buildGenerationCommand(design, { ...command, upgrade: true });
  const result = ops.length
    ? applyOperations(design, ops)
    : { ok: true as const, design, findings: validateDesign(design) };
  return {
    fromSchema: design.schemaVersion,
    toSchema: 3,
    generation: command.generation,
    before: structuredClone(designGeneration(design) ?? null),
    ownershipChanges: command.ownership ? previewOwnership(design, command.ownership).changes : [],
    operationChanges: command.ownership
      ? previewOwnership(design, command.ownership).operationChanges
      : [],
    findings: result.ok ? result.findings : result.errors,
    canApply: result.ok && !result.findings.some(isStructural),
    note: "Source declarations only. Catalog presence installs no implementation. Saving the complete batch is one Undo step; schema2 requires an explicit upgrade.",
  };
}

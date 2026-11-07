/** Chat keeps canonical graph IDs distinct from a selected logical owner. Historical strings stay intact. */
import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { idSchema } from "./ids.ts";
import { designOperations } from "./operation-contracts.ts";
import { designOwnership } from "./ownership.ts";

export const ownerSelectionReference = (owner: string) => `owner:${idSchema.parse(owner)}`;
const ownerReferenceSchema = z
  .string()
  .max(69)
  .regex(/^owner:[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
export const operationSelectionReference = (id: string) => `operation:${idSchema.parse(id)}`;
const operationReferenceSchema = z
  .string()
  .max(73)
  .regex(/^operation:[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
/** Existing short selection strings remain compatible; the new owner namespace is validated. */
export const chatSelectionReferenceSchema = z.union([
  z
    .string()
    .max(63)
    .refine(
      (value) => !value.startsWith("owner:") && !value.startsWith("operation:"),
      "Use a valid owner:<slug> or operation:<slug> reference.",
    ),
  ownerReferenceSchema,
  operationReferenceSchema,
]);
export function selectedLogicalOwners(design: DesignDocument, selection: readonly string[]) {
  return selection
    .filter((ref) => ref.startsWith("owner:"))
    .map((ref) => {
      const parsed = ownerReferenceSchema.safeParse(ref);
      const owner = parsed.success
        ? designOwnership(design).owners.find((x) => ownerSelectionReference(x.id) === ref)
        : undefined;
      return owner
        ? { reference: ref, status: "present" as const, owner }
        : { reference: ref, status: "missing-or-invalid" as const };
    });
}
export function selectedOperationBindings(design: DesignDocument, selection: readonly string[]) {
  return selection
    .filter((ref) => ref.startsWith("operation:"))
    .map((ref) => {
      const parsed = operationReferenceSchema.safeParse(ref),
        binding = parsed.success
          ? designOperations(design).receivers.find(
              (x) => operationSelectionReference(x.id) === ref,
            )
          : undefined;
      return binding
        ? { reference: ref, status: "present" as const, binding }
        : { reference: ref, status: "missing-or-invalid" as const };
    });
}

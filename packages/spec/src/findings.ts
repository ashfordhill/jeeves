import { z } from "zod";
import { idSchema } from "./ids.ts";

/**
 * Every finding code, with its category and severity.
 *
 * - `structural` problems make a design unusable; an operation batch that introduces one is
 *   rejected.
 * - `readiness` findings are saved with the design and shown in the studio.
 * - `operation` codes only ever come back from `applyOperations`.
 */
export const findingCatalog = {
  DUPLICATE_ID: { category: "structural", severity: "error" },
  UNKNOWN_REFERENCE: { category: "structural", severity: "error" },
  CONFIG_INVALID: { category: "structural", severity: "error" },
  DUPLICATE_CONNECTION: { category: "structural", severity: "error" },
  NEEDS_TEMPLATE: { category: "readiness", severity: "error" },
  CONFIG_REQUIRED: { category: "readiness", severity: "error" },
  ARCHITECTURE_UNBOUND: { category: "readiness", severity: "warning" },
  INVALID_OPERATION: { category: "operation", severity: "error" },
  REVISION_CONFLICT: { category: "operation", severity: "error" },
} as const satisfies Record<
  string,
  {
    category: "structural" | "readiness" | "operation";
    severity: "error" | "warning" | "info";
  }
>;

export type FindingCode = keyof typeof findingCatalog;
export const findingCodes = Object.keys(findingCatalog) as [FindingCode, ...FindingCode[]];

export const findingSchema = z.strictObject({
  code: z.enum(findingCodes),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  /** What the finding is about. `op` is the index of the offending operation in a batch. */
  target: z
    .strictObject({
      element: idSchema.optional(),
      connection: idSchema.optional(),
      op: z.int().nonnegative().optional(),
      /** Config path, for config findings. */
      path: z.array(z.union([z.string(), z.number()])).optional(),
    })
    .default({}),
});
export type Finding = z.output<typeof findingSchema>;
export type FindingTarget = Finding["target"];

export function finding(code: FindingCode, message: string, target: FindingTarget = {}): Finding {
  return { code, severity: findingCatalog[code].severity, message, target };
}

export function isStructural(f: Finding): boolean {
  return findingCatalog[f.code].category === "structural";
}

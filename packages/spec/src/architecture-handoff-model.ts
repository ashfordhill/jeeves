/** Review scope and ownership are architecture intent; recording approval never enables Generate. */
import { z } from "zod";

export const handoffScopeSchema = z
  .strictObject({
    description: z.string().trim().min(1).max(1200),
    partial: z.boolean(),
    excludedScope: z.string().trim().max(1200),
    assignments: z
      .array(
        z.strictObject({
          kind: z.enum(["decision", "objective", "finding"]),
          id: z.string().min(1).max(160),
          owner: z.string().trim().min(1).max(240),
          blocks: z.string().trim().min(1).max(1200),
        }),
      )
      .max(500),
    review: z
      .strictObject({
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        approval: z.string().trim().min(1).max(1200),
      })
      .optional(),
  })
  .superRefine((scope, ctx) => {
    if (scope.partial && !scope.excludedScope)
      ctx.addIssue({
        code: "custom",
        path: ["excludedScope"],
        message: "A partial review needs an explicit excluded scope.",
      });
    const keys = scope.assignments.map((a) => `${a.kind}:${a.id}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["assignments"],
        message: "Assign each unresolved identity once.",
      });
  });
export type HandoffScope = z.output<typeof handoffScopeSchema>;

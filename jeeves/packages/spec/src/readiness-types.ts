import { z } from "zod";
import { idSchema } from "./ids.ts";
import { exactContractRefSchema } from "./operation-records.ts";

export const readinessTargetSchema = z.strictObject({
  element: idSchema.optional(),
  connection: idSchema.optional(),
  owner: idSchema.optional(),
  operation: idSchema.optional(),
  path: z.array(z.union([z.string(), z.number()])).optional(),
});
export const readinessIssueSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  target: readinessTargetSchema,
});
export type ReadinessIssue = z.infer<typeof readinessIssueSchema>;
export type ReadinessTarget = z.infer<typeof readinessTargetSchema>;
const stage = <T extends readonly [string, ...string[]]>(statuses: T) =>
  z.strictObject({ status: z.enum(statuses), blockers: z.array(readinessIssueSchema) });
export const designReadinessSchema = z.strictObject({
  report: z.literal(1),
  composition: z.strictObject({
    domain: z.literal("jeeves.tinyurl.composition.v1"),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    profile: exactContractRefSchema.nullable(),
    subject: z.json(),
  }),
  designValidity: stage(["valid", "invalid"]),
  contractCompleteness: stage(["complete", "incomplete"]),
  implementationAvailability: stage(["available", "unavailable"]),
  runtimeEvidence: stage(["verified", "none", "insufficient"]),
  generationEligible: z.boolean(),
  advisories: z.array(readinessIssueSchema),
  limits: z.array(z.string()),
});
export type DesignReadiness = z.infer<typeof designReadinessSchema>;

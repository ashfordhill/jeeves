/** Historical expansion provenance; declarations are design intent, never runtime evidence. */
import { z } from "zod";
import { contractCanonical } from "./architecture-contracts.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema, versionSchema } from "./ids.ts";

export const patternConfigSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  tenant: z.enum(["Tenant scoped", "Public", "Cross tenant"]).default("Tenant scoped"),
  channel: z.string().trim().min(1).max(80).default("Work items"),
  maxAgeSeconds: z.int().min(0).max(86400).default(30),
  lossWindowSeconds: z.int().min(0).max(86400).default(60),
});
export const patternInstanceSchema = z.strictObject({
  id: idSchema,
  pattern: idSchema,
  version: versionSchema,
  variant: z.enum(["standard", "best-effort", "transactional-outbox"]),
  baseRevision: z.int().nonnegative(),
  libraryOptions: z.record(z.string(), z.string()).optional(),
  libraryContentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  config: patternConfigSchema,
  /** Fragment-local identity → expanded identity, including explicitly reused roles. */
  identities: z.record(idSchema, idSchema),
  invariants: z.array(z.string().min(1).max(1200)).max(20),
});
export type PatternInstance = z.output<typeof patternInstanceSchema>;

/** Graph customizations are editable; the recorded source of an existing expansion stays pinned. */
export function validatePatternTransition(
  before: DesignDocument,
  after: DesignDocument,
): Finding[] {
  return (after.architecture?.patternInstances ?? []).flatMap((next) => {
    const prior = before.architecture?.patternInstances?.find((item) => item.id === next.id);
    return prior && contractCanonical(prior) !== contractCanonical(next)
      ? [
          finding(
            "CONFIG_INVALID",
            "Pattern provenance is pinned. Edit the expanded architecture, or create a fresh pattern instance.",
            { path: ["architecture", "patternInstances", next.id] },
          ),
        ]
      : [];
  });
}

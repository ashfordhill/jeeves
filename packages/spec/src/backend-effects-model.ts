/** Exact effect and extension intent. No handler, network call or task is executed here. */
import { z } from "zod";
import { backendValueSourceSchema, backendWriteSchema } from "./backend-behavior-model.ts";
import { contractTypeReferenceSchema as exact } from "./contract-shapes.ts";
import { idSchema } from "./ids.ts";

const named = { ...exact.shape, name: z.string().trim().min(1).max(120) };
export const backendRecoverySchema = z.strictObject({
  trigger: z.enum([
    "uncertain-commit",
    "lost-acknowledgement",
    "partial-bytes",
    "external-timeout",
    "hook-failure",
  ]),
  strategy: z.enum([
    "same-command-key",
    "same-delivery-identity",
    "reconcile-before-retry",
    "cleanup-unattached-bytes",
    "confirmed-rollback",
  ]),
  operation: exact,
  outcome: idSchema,
  scenario: z.strictObject({ id: idSchema, outcome: idSchema }),
  invariants: z
    .array(z.strictObject({ aggregate: exact, invariant: idSchema }))
    .min(1)
    .max(20),
  reconcileOperation: exact.optional(),
});
export type BackendRecovery = z.output<typeof backendRecoverySchema>;
export const backendEffectSchema = z.strictObject({
  ...named,
  source: exact,
  when: z.array(idSchema).min(1).max(20).optional(),
  target: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("event"), contract: exact, consumer: exact.optional() }),
    z.strictObject({ kind: z.literal("operation"), operation: exact }),
    z.strictObject({ kind: z.literal("dataset"), dataset: idSchema, contract: exact }),
    z.strictObject({ kind: z.literal("projection"), dataset: idSchema, query: exact }),
    z.strictObject({ kind: z.literal("notification"), operation: exact, recipients: exact }),
    z.strictObject({ kind: z.literal("audit"), dataset: idSchema, contract: exact }),
    z.strictObject({ kind: z.literal("hook"), hook: exact }),
  ]),
  boundary: z.enum(["before-commit", "atomic-intent", "after-commit"]),
  execution: z.enum(["local", "durable-intent", "external"]),
  /** The persisted event/delivery payload; never an opaque JSON/config string. */
  payload: exact,
  values: z.array(z.strictObject({ field: idSchema, value: backendValueSourceSchema })).max(40),
  relationshipBinding: idSchema.optional(),
  required: z.boolean(),
  loss: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("forbidden") }),
    z.strictObject({ kind: z.literal("permitted"), reason: z.string().trim().min(1).max(1200) }),
  ]),
  after: z.array(exact).max(20),
  delivery: z.strictObject({
    identity: z.literal("operation-version-scope-command-effect-recipient"),
    context: z.enum(["source-transaction-context", "verified-service-actor-provenance-only"]),
    recheck: z.literal("current-policy-before-effect"),
    recipient: z.enum(["single-target", "each-eligible-recipient"]),
    guarantee: z.enum(["local-atomic", "at-least-once", "best-effort"]),
    acknowledgement: z.enum(["same-commit", "durable-terminal-result", "unknown-is-reconcile"]),
    attempts: z.int().min(1).max(100),
    backoffSeconds: z.int().min(0).max(86400),
    timeoutSeconds: z.int().min(1).max(3600),
    exhausted: z.literal("operator-visible"),
    duplicates: z.enum(["deduplicated-local-effect", "destination-key", "possible"]),
  }),
  recovery: z.array(backendRecoverySchema).max(10),
});
export type BackendEffect = z.output<typeof backendEffectSchema>;
export const backendHookSchema = z.strictObject({
  ...named,
  operation: exact,
  owner: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("element"), id: idSchema }),
    z.strictObject({ kind: z.literal("component"), id: idSchema }),
  ]),
  kind: z.enum(["pure", "effectful"]),
  boundary: z.enum(["before-commit", "after-commit"]),
  contracts: z.strictObject({ input: exact, output: exact, error: exact }),
  context: z
    .array(
      z.enum([
        "principal-provenance",
        "authorized-scope",
        "correlation",
        "service-purpose",
        "cancellation",
        "deadline",
      ]),
    )
    .max(6),
  authority: z.literal("current-policy-at-observation"),
  dependencies: z.array(exact).max(20),
  /** Read access is through exact bounded queries, never unrestricted entity repositories. */
  repositories: z.array(exact).max(20),
  services: z.array(exact).max(20),
  allowedWrites: z.array(backendWriteSchema).max(100),
  writeMode: z.literal("validated-proposals-only"),
  allowedEffects: z.array(exact).max(20),
  result: z.literal("validate-exact-contract-before-use"),
  privateData: z.enum(["none", "authorized-input-only", "current-policy-recheck"]),
  required: z.boolean(),
  readiness: z.literal("before-mutation"),
  timeoutSeconds: z.int().min(1).max(3600),
  cancellation: z.literal("cooperative-no-forced-termination"),
  unavailable: z.strictObject({
    outcome: idSchema,
    status: z.union([z.literal(501), z.literal(503)]),
    writes: z.literal("none"),
  }),
  failure: z.strictObject({
    operation: exact,
    scope: z.enum(["source-transaction", "separate-delivery-attempt"]),
    error: idSchema,
    invalidResult: idSchema,
    timeout: idSchema,
    cancelled: idSchema,
  }),
  acceptance: z.array(z.string().trim().min(1).max(160)).min(1).max(60),
  seam: z.strictObject({
    file: z
      .string()
      .max(240)
      .regex(/^(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_-]+\.ts$/),
    ownership: z.literal("scaffold-once-project-owned"),
  }),
  recovery: z.array(backendRecoverySchema).max(10),
});
export type BackendHook = z.output<typeof backendHookSchema>;

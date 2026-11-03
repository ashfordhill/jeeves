/** Finite command intent. These schemas neither evaluate expressions nor execute commands. */
import { z } from "zod";
import { backendPolicySelectionSchema } from "./backend-policy-model.ts";
import { backendProtocolPlanSchema } from "./backend-protocol-model.ts";
import { contractTypeReferenceSchema } from "./contract-shapes.ts";
import { idSchema } from "./ids.ts";

const exact = contractTypeReferenceSchema;
const named = { ...exact.shape, name: z.string().trim().min(1).max(120) };
const path = z.array(idSchema).min(1).max(5);
export const backendWriteSchema = z.strictObject({ entity: exact, field: idSchema });
export const backendValueSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("query-result") }),
  z.strictObject({ kind: z.literal("input"), path }),
  z.strictObject({ kind: z.literal("current"), ...backendWriteSchema.shape }),
  z.strictObject({
    kind: z.literal("context"),
    value: z.enum(["principal", "scope", "correlation"]),
  }),
  z.strictObject({
    kind: z.literal("server"),
    factory: z.enum([
      "uuid",
      "clock",
      "initial-version",
      "next-version",
      "insert-or-next-version",
      "upsert-from-one-version",
      "delivery-identity",
    ]),
  }),
  z.strictObject({
    kind: z.literal("literal"),
    value: z.union([z.string().max(16000), z.number().int().safe(), z.boolean(), z.null()]),
  }),
  z.strictObject({ kind: z.literal("result"), action: idSchema, path }),
]);
export type BackendValueSource = z.output<typeof backendValueSourceSchema>;
const mapping = z.strictObject({ field: idSchema, value: backendValueSourceSchema });
export const backendGuardSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    id: idSchema,
    kind: z.literal("compare"),
    left: backendValueSourceSchema,
    operator: z.enum(["eq", "ne", "lt", "lte", "gt", "gte"]),
    right: backendValueSourceSchema,
  }),
  z.strictObject({ id: idSchema, kind: z.literal("present"), value: backendValueSourceSchema }),
]);
export type BackendGuard = z.output<typeof backendGuardSchema>;
const stateValue = z.string().max(120);
export const backendLifecycleSchema = z.strictObject({
  ...named,
  aggregate: exact,
  state: backendWriteSchema,
  states: z.array(stateValue).min(1).max(40),
  initial: stateValue,
  guards: z.array(backendGuardSchema).max(20),
  transitions: z
    .array(
      z.strictObject({
        id: idSchema,
        from: stateValue,
        to: stateValue,
        guards: z.array(idSchema).max(20),
      }),
    )
    .max(30),
});
export type BackendLifecycle = z.output<typeof backendLifecycleSchema>;
/** Registered design algorithms have finite options. Registration does not imply runtime availability. */
export const backendDomainStrategySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("registered"),
    name: z.literal("checkout-order"),
    version: z.literal("v1"),
    options: z.strictObject({ maximumLines: z.int().min(1).max(1000) }),
    result: exact,
  }),
  z.strictObject({ kind: z.literal("unsupported"), reference: exact, result: exact }),
]);
export type BackendDomainStrategy = z.output<typeof backendDomainStrategySchema>;
const writeAction = <K extends string>(kind: K) =>
  z.strictObject({
    id: idSchema,
    kind: z.literal(kind),
    entity: exact,
    relation: idSchema.optional(),
    key: z.array(mapping).max(10).optional(),
    values: z.array(mapping).min(1).max(100),
  });
export const backendActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    id: idSchema,
    kind: z.literal("hook"),
    hook: exact,
    input: z.array(mapping).max(40),
  }),
  writeAction("create"),
  writeAction("create-child"),
  writeAction("patch"),
  writeAction("append-revision"),
  writeAction("add-relation"),
  writeAction("remove-relation"),
  z.strictObject({
    id: idSchema,
    kind: z.literal("transition"),
    lifecycle: exact,
    transition: idSchema,
    key: z.array(mapping).max(10).optional(),
  }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("capability"),
    strategy: backendDomainStrategySchema,
    input: z.array(mapping).max(20),
  }),
]);
export type BackendAction = z.output<typeof backendActionSchema>;
const transaction = z.strictObject({
  kind: z.enum(["local", "read-only"]),
  store: idSchema,
  participants: z.array(exact).min(1).max(31),
  connection: z.literal("single"),
  externalIO: z.literal("forbidden"),
  access: z.literal("current-state-in-transaction"),
  concurrency: z.literal("aggregate-policy"),
  failure: z.literal("rollback"),
  commit: z.literal("disconnect-is-unknown"),
});
export const backendOperationSchema = z.strictObject({
  ...named,
  protocol: backendProtocolPlanSchema.optional(),
  target: z.strictObject({
    contract: exact,
    operation: idSchema,
    owner: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("element"), id: idSchema }),
      z.strictObject({ kind: z.literal("component"), id: idSchema }),
    ]),
  }),
  kind: z.enum(["command", "query"]),
  aggregate: exact,
  identity: z.array(mapping).max(10).optional(),
  access: z.strictObject({
    policy: backendPolicySelectionSchema,
    action: idSchema,
    readProjection: idSchema.optional(),
    writeProjection: idSchema.optional(),
    participants: z
      .array(
        z.strictObject({
          entity: exact,
          policy: backendPolicySelectionSchema,
          action: idSchema,
          readProjection: idSchema.optional(),
          writeProjection: idSchema.optional(),
        }),
      )
      .max(30)
      .optional(),
  }),
  query: exact.optional(),
  queryInputs: z
    .array(
      z.strictObject({
        filter: idSchema,
        operator: z.enum(["eq", "ne", "lt", "lte", "gt", "gte", "in", "is-null", "prefix"]),
        value: backendValueSourceSchema.optional(),
      }),
    )
    .max(20)
    .optional(),
  guards: z.array(backendGuardSchema).max(20),
  actions: z.array(backendActionSchema).max(20),
  writes: z.array(backendWriteSchema).max(100),
  expectedVersion: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("input"), path }),
    z.strictObject({ kind: z.literal("none") }),
  ]),
  transaction,
  idempotency: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("read-only") }),
    z.strictObject({
      kind: z.literal("source-message"),
      message: path,
      identity: z.literal("source-scope-message"),
      hash: z.literal("canonical-normalized-source-content-sha256"),
      replay: z.literal("current-policy-before-result"),
    }),
    z.strictObject({
      kind: z.literal("command-key"),
      key: path,
      identity: z.literal("operation-version-scope-principal-key"),
      hash: z.literal("canonical-normalized-input-sha256"),
      hashInputs: z.array(path).max(40),
      retentionSeconds: z.int().min(1).max(31_536_000).default(604800),
      publishedWindow: z.literal(true),
      expired: z.literal("new-command"),
      receipt: z.literal("terminal-result-in-same-transaction"),
      concurrent: z.literal("one-writer-bounded-wait-or-retry"),
      replay: z.literal("current-policy-before-result"),
      cleanup: z.literal("separate-controlled-policy"),
    }),
  ]),
  cancellation: z.strictObject({
    kind: z.literal("cooperative"),
    startsWork: z.boolean(),
    deadlineSeconds: z.int().min(1).max(3600),
    beforeCommit: z.literal("rollback"),
    afterCommit: z.literal("committed-or-unknown"),
  }),
  outcomes: z
    .array(
      z.strictObject({
        outcome: idSchema,
        trigger: z.enum([
          "success",
          "unchanged",
          "conflict",
          "rejected",
          "failed",
          "unavailable",
          "cancelled",
          "uncertain",
        ]),
        values: z.array(mapping).max(40),
      }),
    )
    .min(1)
    .max(20),
});
export type BackendOperation = z.output<typeof backendOperationSchema>;

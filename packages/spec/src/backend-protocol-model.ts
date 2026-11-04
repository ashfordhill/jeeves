/** Finite orchestration intent for protocols that cannot be expressed as scalar row actions.
 * These plans describe algorithms; they neither execute them nor assert template support. */
import { z } from "zod";
import {
  backendCommerceHookSettingsSchema,
  backendCommerceProtocolSchema,
  commerceProcedures,
} from "./backend-commerce-protocol-model.ts";
import { contractTypeReferenceSchema as exact } from "./contract-shapes.ts";
import { idSchema } from "./ids.ts";

export const backendProtocolProcedures = [
  ...commerceProcedures,
  "membership-upsert",
  "grant-upsert",
  "discussion-create",
  "discussion-reply",
  "post-revise",
  "lifecycle-dispatch",
  "subscription-upsert",
  "bounded-read",
  "file-stage",
  "file-inspect",
  "file-associate",
  "private-download",
  "flag-submit",
  "flag-review",
  "trust-evaluate",
  "abuse-adjudicate",
  "digest-schedule",
  "safe-render",
  "topic-restructure",
  "privacy-plan",
  "inbound-reply",
  "discovery-rank",
  "notification-materialize",
  "external-delivery",
  "delivery-reconcile",
  "projection-rebuild",
  "orphan-cleanup",
  "digest-deliver",
  "privacy-resume",
] as const;
const path = z.array(idSchema).min(1).max(5);
export const backendProtocolPlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  procedure: z.enum(backendProtocolProcedures),
  commerce: backendCommerceProtocolSchema.optional(),
  hookSettings: backendCommerceHookSettingsSchema.optional(),
  locking: z
    .literal("all-selected-existing-rows-stable-order-then-recheck")
    .default("all-selected-existing-rows-stable-order-then-recheck"),
  execution: z.enum(["authority-owner", "authorized-worker"]).optional(),
  provider: z
    .strictObject({ contract: exact, operation: idSchema, interface: idSchema, binding: idSchema })
    .optional(),
  /** Every normalized wire input is bound, including path/header/query fields. */
  inputs: z
    .array(
      z.strictObject({
        path,
        use: z.enum([
          "scope",
          "command-key",
          "selector",
          "expected-version",
          "accepted-value",
          "bounded-query",
          "provider-original-bytes",
          "authorized-choice",
        ]),
      }),
    )
    .max(40),
  records: z
    .array(
      z.strictObject({
        entity: exact,
        policy: exact,
        action: idSchema,
        authority: z.literal("source-authorized-module").optional(),
        readProjection: idSchema,
        writeProjection: idSchema.optional(),
        selection: z.enum([
          "input-key",
          "scoped-unique-key",
          "authorized-parent",
          "server-created",
          "bounded-plan",
          "current-recipient",
          "local-effect",
        ]),
        onMissing: z.enum(["reject", "insert-before-cas-from-one", "insert-at-one"]).optional(),
        keys: z
          .array(z.strictObject({ field: idSchema, input: path, selector: path.optional() }))
          .max(10),
        delete: z.literal(true).optional(),
        writes: z
          .array(
            z.strictObject({
              field: idSchema,
              when: z.literal("create-only").optional(),
              source: z.discriminatedUnion("kind", [
                z.strictObject({ kind: z.literal("input"), path }),
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
                z.strictObject({ kind: z.literal("current"), entity: exact, field: idSchema }),
                z.strictObject({
                  kind: z.literal("literal"),
                  value: z.union([z.string().max(16000), z.int(), z.boolean(), z.null()]),
                }),
                z.strictObject({ kind: z.literal("hook"), path }),
                z.strictObject({
                  kind: z.literal("derived"),
                  rule: z.enum([
                    "commerce-validated-plan",
                    "inbox-channel-membership",
                    "email-channel-membership",
                    "validated-bytes",
                    "new-object-key",
                    "active-review-discriminator",
                    "validated-move-plan",
                    "merged-subscription-preferences",
                    "privacy-tombstone-plan",
                    "privacy-progress-plan",
                    "verified-message-identity",
                    "window-delivery-identity",
                    "selected-lifecycle-transition",
                    "metadata-only-audit",
                    "post-created-event",
                    "previous-revision",
                    "accepted-adjudication-revision",
                  ]),
                }),
              ]),
            }),
          )
          .max(100),
      }),
    )
    .min(1)
    .max(31),
  queries: z.array(exact).max(20),
  hook: exact.optional(),
  /** Trusted snapshots are assembled by the owner, never supplied as body authority. */
  hookInputs: z
    .array(
      z.strictObject({
        field: idSchema,
        source: z.enum(["input", "record", "query", "trusted-context", "owner-derived"]),
        input: path.optional(),
        entity: exact.optional(),
        query: exact.optional(),
        fields: z.array(idSchema).max(100),
        literal: z.union([z.string().max(200), z.int(), z.boolean(), z.null()]).optional(),
        derivation: z
          .enum([
            "commerce-authorized-snapshot",
            "recorded-activity-count",
            "trust-window-start",
            "server-clock",
            "adjudication-history",
            "current-moderator-authority",
            "public-digest-candidates",
            "eligible-mention-principals",
            "restructure-subscriptions",
            "subject-owned-posts",
            "authoritative-retention-holds",
            "pending-subject-deliveries",
            "durable-privacy-progress",
            "verified-source-identity",
            "original-body-sha256",
            "confirmed-sender-candidates",
            "configured-topic-candidates",
            "authorized-ranking-features",
            "projection-as-of",
            "projection-version",
            "selected-policy-version",
          ])
          .optional(),
      }),
    )
    .max(40),
  transitions: z
    .array(
      z.strictObject({
        lifecycle: exact,
        transition: idSchema,
        action: z.string().max(120),
        selector: path.optional(),
      }),
    )
    .max(30),
  versionChecks: z
    .array(
      z.discriminatedUnion("kind", [
        z.strictObject({
          kind: z.literal("entity").optional(),
          entity: exact,
          field: idSchema,
          input: path,
          selector: path.optional(),
        }),
        z.strictObject({
          kind: z.literal("session-subject"),
          subject: path,
          input: path,
          boundary: z.literal("existing-session-owner"),
        }),
      ]),
    )
    .max(10),
  outputs: z
    .array(
      z.strictObject({
        path,
        source: z.enum([
          "record",
          "query-page",
          "validated-hook",
          "owner-result",
          "private-stream",
        ]),
        entity: exact.optional(),
        query: exact.optional(),
        selector: path.optional(),
        renames: z
          .array(z.strictObject({ field: idSchema, source: idSchema }))
          .max(40)
          .optional(),
        derivation: z
          .enum([
            "catalog-assets-page",
            "catalog-search-page",
            "shipment-quantity-page",
            "order-snapshot-page",
            "commerce-operation-result",
            "safe-response-headers",
            "query-cursor",
            "subscription-channels",
            "digest-delivery-state",
            "privacy-result-status",
            "cancelled-delivery-count",
            "search-snippet",
            "revision-version",
          ])
          .optional(),
        fields: z.array(idSchema).max(100),
      }),
    )
    .max(40),
  limits: z.strictObject({
    batch: z.int().min(1).max(100),
    deadlineSeconds: z.int().min(1).max(3600),
  }),
  replay: z.enum([
    "current-policy-before-receipt-before-version",
    "source-message-current-policy",
    "read-current-policy",
  ]),
  progress: z
    .strictObject({
      kind: z.literal("privacy-erasure"),
      store: idSchema,
      state: exact,
      key: idSchema,
      input: exact,
      result: exact,
      continuation: exact,
      checkpoint: idSchema,
      terminal: idSchema,
      batchSize: z.int().min(1).max(100),
      maximumItems: z.literal(100),
      overflow: z.literal("reject-before-mutation"),
      snapshot: z.literal("validated-plan-persisted-before-batches"),
      holds: z.literal("current-hold-overrides-plan-before-each-batch"),
    })
    .optional(),
  failure: z.literal("no-partial-domain-writes"),
  externalIO: z.enum([
    "none",
    "stage-verify-before-sql",
    "authorized-proxy-after-read",
    "verified-source-before-sql",
    "committed-intent-provider-call",
  ]),
  receipt: z.enum(["atomic-terminal-command", "atomic-source-message-and-command", "none"]),
  preconditions: z.array(z.string().min(1).max(1200)).min(1).max(20),
  postconditions: z.array(z.string().min(1).max(1200)).min(1).max(20),
  acceptance: z.array(z.string().min(1).max(160)).min(1).max(66),
});
export type BackendProtocolPlan = z.output<typeof backendProtocolPlanSchema>;

/** Exact references shared by extraction, version protection and remapping. */
export function protocolReferences(p: BackendProtocolPlan) {
  return [
    ...p.records.flatMap((r) => [
      r.entity,
      r.policy,
      ...r.writes.flatMap((w) => (w.source.kind === "current" ? [w.source.entity] : [])),
    ]),
    ...(p.provider ? [p.provider.contract] : []),
    ...p.queries,
    ...(p.progress
      ? [p.progress.state, p.progress.input, p.progress.result, p.progress.continuation]
      : []),
    ...(p.hook ? [p.hook] : []),
    ...p.hookInputs.flatMap((v) => [
      ...(v.entity ? [v.entity] : []),
      ...(v.query ? [v.query] : []),
    ]),
    ...p.transitions.map((v) => v.lifecycle),
    ...p.versionChecks.flatMap((v) => (v.kind === "session-subject" ? [] : [v.entity])),
    ...p.outputs.flatMap((v) => [...(v.entity ? [v.entity] : []), ...(v.query ? [v.query] : [])]),
  ];
}
export function mapProtocolPlan(
  p: BackendProtocolPlan,
  ids: Record<string, string>,
): BackendProtocolPlan {
  const ref = <T extends { id: string }>(v: T): T => ({ ...v, id: ids[v.id] ?? v.id });
  return {
    ...p,
    records: p.records.map((r) => ({
      ...r,
      entity: ref(r.entity),
      policy: ref(r.policy),
      writes: r.writes.map((w) => ({
        ...w,
        source:
          w.source.kind === "current" ? { ...w.source, entity: ref(w.source.entity) } : w.source,
      })),
    })),
    ...(p.provider
      ? {
          provider: {
            ...p.provider,
            contract: ref(p.provider.contract),
            interface: ids[p.provider.interface] ?? p.provider.interface,
            binding: ids[p.provider.binding] ?? p.provider.binding,
          },
        }
      : {}),
    queries: p.queries.map(ref),
    ...(p.progress
      ? {
          progress: {
            ...p.progress,
            store: ids[p.progress.store] ?? p.progress.store,
            state: ref(p.progress.state),
            input: ref(p.progress.input),
            result: ref(p.progress.result),
            continuation: ref(p.progress.continuation),
          },
        }
      : {}),
    ...(p.hook ? { hook: ref(p.hook) } : {}),
    hookInputs: p.hookInputs.map((v) => ({
      ...v,
      ...(v.entity ? { entity: ref(v.entity) } : {}),
      ...(v.query ? { query: ref(v.query) } : {}),
    })),
    transitions: p.transitions.map((v) => ({ ...v, lifecycle: ref(v.lifecycle) })),
    versionChecks: p.versionChecks.map((v) =>
      v.kind === "session-subject" ? v : { ...v, entity: ref(v.entity) },
    ),
    outputs: p.outputs.map((v) => ({
      ...v,
      ...(v.entity ? { entity: ref(v.entity) } : {}),
      ...(v.query ? { query: ref(v.query) } : {}),
    })),
  };
}

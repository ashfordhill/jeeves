/** Strict design options only. No provider, scheduler, clock or expression is executed. */
import { z } from "zod";
import { contractTypeReferenceSchema as exact } from "./contract-shapes.ts";
import { idSchema } from "./ids.ts";

const owner = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("element"), id: idSchema }),
  z.strictObject({ kind: z.literal("component"), id: idSchema }),
]);
const named = {
  ...exact.shape,
  schemaVersion: z.literal(1),
  name: z.string().trim().min(1).max(120),
  owner,
};
const field = z.strictObject({ entity: exact, field: idSchema });
const ids = z.array(idSchema).min(1).max(100);
const seconds = z.int().min(1).max(31_536_000);
const observation = z.strictObject({ policy: exact, action: idSchema, projection: idSchema });
/** Deployment identity selects private configuration elsewhere; URLs and secrets are never design fields. */
export const backendProviderReferenceSchema = z.strictObject({
  contract: exact,
  interface: idSchema,
  operation: idSchema,
  binding: idSchema,
  environment: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("fixture"), id: idSchema }),
    z.strictObject({ kind: z.literal("deployment"), id: idSchema, credentialRef: idSchema }),
  ]),
  deduplication: z.enum(["destination-key", "none"]),
});
export const backendDeliveryConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("delivery"),
  effect: exact,
  queue: z.strictObject({ channel: idSchema, event: exact }),
  due: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("immediate") }),
    z.strictObject({ kind: z.literal("event-time"), field: idSchema }),
    z.strictObject({ kind: z.literal("business-deadline"), config: exact }),
  ]),
  attempts: z.int().min(1).max(100),
  backoff: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("fixed"), seconds: z.int().min(0).max(86400) }),
    z.strictObject({
      kind: z.literal("exponential"),
      initialSeconds: seconds,
      maximumSeconds: seconds,
    }),
  ]),
  leaseSeconds: z.int().min(1).max(86400),
  timeoutSeconds: z.int().min(1).max(3600),
  deadlineSeconds: seconds,
  claim: z.literal("atomic-fenced-token"),
  staleAcknowledgement: z.literal("reject"),
  shutdown: z.literal("stop-claiming-cooperative-cancellation"),
  acknowledgement: z.literal("persist-terminal-before-ack"),
  unknown: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("same-delivery-identity") }),
    z.strictObject({ kind: z.literal("reconcile"), operation: exact, outcome: idSchema }),
  ]),
  exhausted: z.literal("operator-visible"),
  duplicates: z.enum(["deduplicated-local-effect", "destination-key", "possible"]),
  provider: backendProviderReferenceSchema.optional(),
});
export const backendFileConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("files"),
  entity: exact,
  parent: exact,
  store: backendProviderReferenceSchema,
  maximumBytes: z.int().min(1).max(1_073_741_824),
  acceptedTypes: z
    .array(
      z
        .string()
        .max(120)
        .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/),
    )
    .min(1)
    .max(30),
  inspection: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("mime-signature"), mismatch: z.literal("quarantine") }),
    z.strictObject({ kind: z.literal("hook"), hook: exact, unavailable: z.literal("quarantine") }),
  ]),
  parentAccess: observation,
  lifecycle: exact,
  states: z.strictObject({
    staged: idSchema,
    quarantined: idSchema,
    attached: idSchema,
    deleted: idSchema,
  }),
  bytes: z.literal("current-parent-policy-attached-only"),
  association: z.literal("same-scope-authorized-parent"),
  cleanup: z.strictObject({
    delivery: exact,
    unattachedAfterSeconds: seconds,
    batchSize: z.int().min(1).max(100),
    race: z.literal("recheck-unattached-version-before-delete"),
    partialBytes: z.literal("durable-cleanup-intent"),
    attached: z.literal("preserve"),
  }),
});
export const backendNotificationConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("notifications"),
  effect: exact,
  recipients: exact,
  cutoff: z.strictObject({
    event: exact,
    field: idSchema,
    subscriptions: z.literal("created-at-or-before-event"),
    filter: idSchema,
  }),
  preferences: z.strictObject({
    query: exact,
    principal: idSchema,
    principalFilter: idSchema,
    enabled: idSchema,
    missing: z.enum(["deny", "allow-explicit-default"]),
  }),
  recipient: idSchema,
  access: observation,
  fields: ids,
  redaction: z.literal("current-policy-projection-before-materialization-and-delivery"),
  pageSize: z.int().min(1).max(100),
  maximumRecipients: z.int().min(1).max(100000),
  continuation: z.literal("durable-keyset-cutoff-no-loss"),
  identity: z.literal("operation-version-scope-command-effect-recipient-channel"),
  channels: z
    .array(
      z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("inbox"), operation: exact }),
        z.strictObject({
          kind: z.literal("external"),
          channel: idSchema,
          delivery: exact,
          provider: backendProviderReferenceSchema,
        }),
      ]),
    )
    .min(1)
    .max(10),
});
export const backendSearchConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("search"),
  source: exact,
  fields: ids,
  query: exact,
  strategy: z.strictObject({
    id: z.literal("postgresql-full-text"),
    version: z.literal("v1"),
    language: z.enum(["simple", "english", "german", "french"]),
  }),
  projection: z.strictObject({ dataset: idSchema, version: z.int().min(1).max(1000000) }),
  access: observation,
  authorization: z.literal("current-policy-before-pagination-counts-snippets"),
  maximumQueryLength: z.int().min(1).max(2000),
  maximumResults: z.int().min(1).max(100),
  freshness: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("synchronous") }),
    z.strictObject({
      kind: z.literal("bounded-staleness"),
      maximumLagSeconds: seconds,
      delivery: exact,
    }),
  ]),
  rebuild: z.strictObject({
    operation: exact,
    batchSize: z.int().min(1).max(100),
    swap: z.literal("atomic-projection-version"),
    deletion: z.literal("current-authority-tombstone-filter"),
  }),
});
const interval = z.strictObject({
  startMinute: z.int().min(0).max(1439),
  endMinute: z.int().min(1).max(1440),
});
export const backendCalendarConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("calendar"),
  timezone: z.string().min(1).max(120),
  weekly: z
    .array(
      z.strictObject({ day: z.int().min(1).max(7), intervals: z.array(interval).min(1).max(10) }),
    )
    .max(7),
  holidays: z
    .array(
      z.strictObject({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        intervals: z.array(interval).max(10),
      }),
    )
    .max(366),
  intervalMeaning: z.literal("local-half-open-no-overnight"),
  daylightSaving: z.literal("elapsed-real-minutes-in-local-open-intervals"),
});
export const backendBusinessTimeConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("business-time"),
  calendar: exact,
  entity: exact,
  durationMinutes: z.int().min(1).max(5256000),
  startEvents: z.array(exact).min(1).max(20),
  stopEvents: z.array(exact).min(1).max(20),
  restart: z.enum(["never", "preserve-elapsed", "reset-on-reopen"]),
  calendarChange: z.literal("existing-clocks-pin-version"),
  due: field,
  clockVersion: field,
  lifecycle: exact,
  runningStates: z.array(idSchema).min(1).max(30),
  staleJob: z.literal("recheck-clock-version-state-and-current-policy"),
});
export const backendRoutingConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("routing"),
  operation: exact,
  match: z.enum(["first", "all"]),
  rules: z
    .array(
      z.strictObject({
        id: idSchema,
        priority: z.int().min(0).max(1000000),
        predicates: z.array(idSchema).min(1).max(20),
        condition: z.enum(["all", "any"]),
        actions: z.array(idSchema).min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
  maximumActions: z.int().min(1).max(20),
  deduplication: z.literal("source-command-rule-action"),
  audit: exact,
  repeat: z.literal("no-recursive-rule-execution"),
});
export const backendCapabilityConfigSchema = z.discriminatedUnion("kind", [
  backendDeliveryConfigSchema,
  backendFileConfigSchema,
  backendNotificationConfigSchema,
  backendSearchConfigSchema,
  backendCalendarConfigSchema,
  backendBusinessTimeConfigSchema,
  backendRoutingConfigSchema,
]);
export type BackendCapabilityConfig = z.output<typeof backendCapabilityConfigSchema>;
export type BackendProviderReference = z.output<typeof backendProviderReferenceSchema>;

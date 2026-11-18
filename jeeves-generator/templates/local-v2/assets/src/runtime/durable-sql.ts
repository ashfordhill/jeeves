import { quoteSqlIdentifier } from "./local.ts";

export type SqlRelation = { schema: string; table: string };
export type OutboxTable = SqlRelation & { destinations: readonly string[] };
export const qualifiedRelation = (binding: SqlRelation) =>
  `${quoteSqlIdentifier(binding.schema)}.${quoteSqlIdentifier(binding.table)}`;
export function durableIdentity(value: string): string {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > 512 ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new Error("Invalid durable identity");
  return value;
}
export function validateOutboxTable(binding: OutboxTable): void {
  qualifiedRelation(binding);
  if (
    !binding.destinations.length ||
    new Set(binding.destinations).size !== binding.destinations.length ||
    binding.destinations.some((d) => !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,254}$/.test(d))
  )
    throw new Error("Invalid outbox destinations");
}
/** Compiled codecs must return JSON data. No source-supplied callbacks or code evaluation. */
export function jsonPayload(value: unknown): string {
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("Invalid JSON payload");
  return result;
}
export function outboxSchema(binding: OutboxTable): string {
  validateOutboxTable(binding);
  const table = qualifiedRelation(binding);
  return `CREATE SCHEMA IF NOT EXISTS ${quoteSqlIdentifier(binding.schema)};
REVOKE ALL ON SCHEMA ${quoteSqlIdentifier(binding.schema)} FROM PUBLIC;
CREATE TABLE ${table} (
 event_id text PRIMARY KEY CHECK(length(event_id) BETWEEN 1 AND 512),
 destination text NOT NULL CHECK(destination IN (${binding.destinations.map((d) => `'${d}'`).join(",")})),
 intent_key text NOT NULL UNIQUE CHECK(length(intent_key) BETWEEN 1 AND 512),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), sent_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON ${table}(destination,next_attempt_at,created_at,event_id) WHERE sent_at IS NULL;
`;
}
export function receiptSchema(binding: SqlRelation): string {
  const table = qualifiedRelation(binding);
  return `CREATE SCHEMA IF NOT EXISTS ${quoteSqlIdentifier(binding.schema)};
REVOKE ALL ON SCHEMA ${quoteSqlIdentifier(binding.schema)} FROM PUBLIC;
CREATE TABLE ${table} (
 scope_key text NOT NULL CHECK(length(scope_key) BETWEEN 1 AND 512),
 event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 512),
 payload jsonb NOT NULL, result jsonb,
 handled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_key,event_id)
);
`;
}

/** Append-only upgrade. Existing completed receipts start a fresh conservative retention window.
 * No event-provided timestamp participates in identity or expiry. */
export function receiptLifecycleSchema(
  binding: SqlRelation,
  legacyRetentionSeconds = 2592000,
): string {
  if (
    !Number.isSafeInteger(legacyRetentionSeconds) ||
    legacyRetentionSeconds < 1 ||
    legacyRetentionSeconds > 2592000
  )
    throw new Error("Invalid legacy receipt retention");
  const table = qualifiedRelation(binding);
  const maintenance = qualifiedRelation({ ...binding, table: `${binding.table}_maintenance` });
  const workers = qualifiedRelation({ ...binding, table: `${binding.table}_workers` });
  return `ALTER TABLE ${table} ADD COLUMN completed_at timestamptz, ADD COLUMN retain_until timestamptz;
UPDATE ${table} SET completed_at=clock_timestamp(),retain_until=clock_timestamp()+interval '${legacyRetentionSeconds} seconds' WHERE result IS NOT NULL;
CREATE INDEX ON ${table}(retain_until,scope_key,event_id) WHERE result IS NOT NULL AND completed_at IS NOT NULL;
CREATE TABLE ${maintenance} (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 last_success_at timestamptz NOT NULL,
 backlog boolean NOT NULL,
 removed integer NOT NULL CHECK(removed>=0)
);
CREATE TABLE ${workers} (
 worker_id text PRIMARY KEY,
 consumer_id text NOT NULL CHECK(length(consumer_id) BETWEEN 1 AND 512),
 heartbeat_at timestamptz NOT NULL,
 last_progress_at timestamptz,
 in_flight integer NOT NULL CHECK(in_flight>=0),
 backlog bigint CHECK(backlog>=0),
 state text NOT NULL CHECK(state IN ('running','storage-unavailable','unknown','stopped'))
);
CREATE INDEX ON ${workers}(heartbeat_at DESC,worker_id);
CREATE INDEX ON ${workers}(consumer_id,heartbeat_at DESC,worker_id);
`;
}

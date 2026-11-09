CREATE SCHEMA IF NOT EXISTS "count_private";
REVOKE ALL ON SCHEMA "count_private" FROM PUBLIC;
CREATE TABLE "count_private"."receipts" (
 scope_key text NOT NULL CHECK(length(scope_key) BETWEEN 1 AND 512),
 event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 512),
 payload jsonb NOT NULL, result jsonb,
 handled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_key,event_id)
);

CREATE SCHEMA IF NOT EXISTS "count_private";
REVOKE ALL ON SCHEMA "count_private" FROM PUBLIC;
CREATE TABLE "count_private"."totals" (
 aggregate_key text PRIMARY KEY CHECK(length(aggregate_key) BETWEEN 1 AND 512),
 total bigint NOT NULL CHECK(total>=0)
);
CREATE SCHEMA IF NOT EXISTS "count_public";
REVOKE ALL ON SCHEMA "count_public" FROM PUBLIC;

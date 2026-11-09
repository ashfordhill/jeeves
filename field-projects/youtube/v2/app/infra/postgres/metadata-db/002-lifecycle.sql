CREATE SCHEMA IF NOT EXISTS "asset_private";
REVOKE ALL ON SCHEMA "asset_private" FROM PUBLIC;
CREATE TABLE "asset_private"."assets" (
 asset_id uuid PRIMARY KEY, upload_id uuid NOT NULL UNIQUE,
 metadata jsonb NOT NULL,
 state text NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','pending','processing','ready','failed','aborted','expired')),
 state_version integer NOT NULL DEFAULT 1 CHECK(state_version>0),
 job_id uuid UNIQUE, attempt_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 queued_at timestamptz, started_at timestamptz, deadline_at timestamptz,
 failure_code text CHECK(length(failure_code) BETWEEN 1 AND 80),
 result jsonb, ready_at timestamptz, publication_version integer CHECK(publication_version=1),
 CHECK((job_id IS NULL)=(attempt_id IS NULL)),
 CHECK(state NOT IN ('pending','processing','ready') OR (job_id IS NOT NULL AND deadline_at IS NOT NULL)),
 CHECK(state<>'ready' OR (result IS NOT NULL AND ready_at IS NOT NULL AND publication_version=1))
);
CREATE INDEX ON "asset_private"."assets"(deadline_at,asset_id) WHERE state IN ('pending','processing');
CREATE SCHEMA IF NOT EXISTS "asset_private";
REVOKE ALL ON SCHEMA "asset_private" FROM PUBLIC;
CREATE TABLE "asset_private"."receipts" (
 scope_key text NOT NULL CHECK(length(scope_key) BETWEEN 1 AND 512),
 event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 512),
 payload jsonb NOT NULL, result jsonb,
 handled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_key,event_id)
);
CREATE SCHEMA IF NOT EXISTS "asset_private";
REVOKE ALL ON SCHEMA "asset_private" FROM PUBLIC;
CREATE TABLE "asset_private"."outbox" (
 event_id text PRIMARY KEY CHECK(length(event_id) BETWEEN 1 AND 512),
 destination text NOT NULL CHECK(destination IN ('jobs','publication')),
 intent_key text NOT NULL UNIQUE CHECK(length(intent_key) BETWEEN 1 AND 512),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), sent_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON "asset_private"."outbox"(destination,next_attempt_at,created_at,event_id) WHERE sent_at IS NULL;

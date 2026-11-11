CREATE SCHEMA IF NOT EXISTS "upload_api_multipart_uploads";
REVOKE ALL ON SCHEMA "upload_api_multipart_uploads" FROM PUBLIC;
CREATE TABLE "upload_api_multipart_uploads"."uploads" (
 upload_id uuid PRIMARY KEY, asset_id uuid NOT NULL UNIQUE,
 owner_subject text NOT NULL CHECK(length(owner_subject) BETWEEN 1 AND 255),
 original_key text NOT NULL UNIQUE CHECK(octet_length(original_key) BETWEEN 1 AND 1024),
 provider_upload_id text CHECK(length(provider_upload_id) BETWEEN 1 AND 2048),
 state text NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','completed','failed','aborted','expired')),
 phase text NOT NULL DEFAULT 'initiating' CHECK(phase IN ('initiating','active','completing','closed')),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
 size bigint NOT NULL CHECK(size BETWEEN 1 AND 268435456),
 content_type text NOT NULL CHECK(length(content_type) BETWEEN 1 AND 255),
 last_modified bigint NOT NULL CHECK(last_modified BETWEEN 0 AND 9007199254740991),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), metadata jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
 complete_response jsonb, original_etag text CHECK(length(original_etag) BETWEEN 1 AND 1024),
 failure_code text CHECK(failure_code IN ('INITIATION_FAILED','UPLOAD_MISMATCH')),
 cleanup_needed boolean NOT NULL DEFAULT false,
 CHECK((state='uploading')=(phase<>'closed')),
 CHECK(phase NOT IN ('active','completing') OR provider_upload_id IS NOT NULL),
 CHECK((state='completed')=(complete_response IS NOT NULL)),
 CHECK(state<>'completed' OR original_etag IS NOT NULL),
 CHECK((state='failed')=(failure_code IS NOT NULL))
);
CREATE INDEX ON "upload_api_multipart_uploads"."uploads"(owner_subject,created_at DESC);
CREATE INDEX ON "upload_api_multipart_uploads"."uploads"(expires_at) WHERE cleanup_needed OR state='uploading';
CREATE SCHEMA IF NOT EXISTS "upload_api_multipart_uploads";
REVOKE ALL ON SCHEMA "upload_api_multipart_uploads" FROM PUBLIC;
CREATE TABLE "upload_api_multipart_uploads"."outbox" (
 event_id text PRIMARY KEY CHECK(length(event_id) BETWEEN 1 AND 512),
 destination text NOT NULL CHECK(destination IN ('jobs','publication')),
 intent_key text NOT NULL UNIQUE CHECK(length(intent_key) BETWEEN 1 AND 512),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), sent_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON "upload_api_multipart_uploads"."outbox"(destination,next_attempt_at,created_at,event_id) WHERE sent_at IS NULL;

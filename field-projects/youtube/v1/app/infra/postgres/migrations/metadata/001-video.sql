CREATE SCHEMA video_private AUTHORIZATION metadata_owner;
CREATE SCHEMA video_public AUTHORIZATION metadata_owner;
REVOKE ALL ON SCHEMA video_private, video_public FROM PUBLIC;
CREATE TABLE video_private.videos (
 video_id uuid PRIMARY KEY, creator_sub text NOT NULL CHECK(length(creator_sub) BETWEEN 1 AND 255),
 channel text NOT NULL CHECK(length(channel) BETWEEN 1 AND 200), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200 AND title=btrim(title)),
 description text NOT NULL CHECK(length(description)<=5000), expected_size bigint NOT NULL CHECK(expected_size BETWEEN 1 AND 268435456),
 expected_sha256 text NOT NULL CHECK(expected_sha256 ~ '^[0-9a-f]{64}$'),
 state text NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','pending','processing','ready','failed','aborted','expired')),
 state_version integer NOT NULL DEFAULT 1 CHECK(state_version>0), job_id uuid UNIQUE, attempt_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
 queued_at timestamptz, started_at timestamptz, deadline_at timestamptz,
 failure_code text CHECK(failure_code IN ('INITIATION_FAILED','UPLOAD_MISMATCH','INVALID_MEDIA','PROCESSING_FAILED','QUEUE_DEADLINE','PROCESSING_DEADLINE')),
 failure_message text CHECK(length(failure_message)<=200), media jsonb,
 publication_version integer CHECK(publication_version=1), published_at timestamptz,
 CHECK((job_id IS NULL)=(attempt_id IS NULL)),
 CHECK(state NOT IN ('pending','processing','ready') OR (job_id IS NOT NULL AND deadline_at IS NOT NULL)),
 CHECK(state<>'ready' OR (media IS NOT NULL AND publication_version=1 AND published_at IS NOT NULL))
);
CREATE TABLE video_private.uploads (
 upload_id uuid PRIMARY KEY, video_id uuid NOT NULL UNIQUE REFERENCES video_private.videos(video_id),
 original_key text NOT NULL UNIQUE CHECK(original_key ~ '^originals/[0-9a-f-]{36}/[0-9a-f-]{36}/source.mp4$'), provider_upload_id text CHECK(length(provider_upload_id)<=2048),
 phase text NOT NULL DEFAULT 'initiating' CHECK(phase IN ('initiating','active','completing','closed')),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255), size bigint NOT NULL CHECK(size BETWEEN 1 AND 268435456),
 content_type text NOT NULL CHECK(content_type='video/mp4'), last_modified bigint NOT NULL CHECK(last_modified>=0),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), expires_at timestamptz NOT NULL,
 complete_response jsonb, original_etag text CHECK(length(original_etag)<=1024), cleanup_needed boolean NOT NULL DEFAULT false
);
CREATE TABLE video_private.inbox (
 event_id uuid PRIMARY KEY, video_id uuid NOT NULL, job_id uuid NOT NULL, attempt_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('started','ready','failed','stale','terminal','unknown')),
 handled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE video_private.outbox (
 event_id uuid PRIMARY KEY, destination text NOT NULL CHECK(destination IN ('upload-jobs','publication-events')),
 intent_key text NOT NULL UNIQUE, payload jsonb NOT NULL CHECK(payload->>'schemaVersion'='1' AND payload->>'eventId'=event_id::text),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), sent_at timestamptz, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX outbox_due ON video_private.outbox(destination,next_attempt_at) WHERE sent_at IS NULL;
CREATE INDEX videos_due ON video_private.videos(deadline_at) WHERE state IN ('pending','processing');
CREATE VIEW video_public.ready_videos AS SELECT video_id, title, description, channel,
 (media->>'durationSeconds')::double precision AS duration_seconds, media->>'manifest' AS manifest,
 media->>'thumbnail' AS thumbnail, published_at, publication_version
 FROM video_private.videos WHERE state='ready';
GRANT USAGE ON SCHEMA video_private TO metadata_upload, metadata_lifecycle;
GRANT SELECT,INSERT,UPDATE ON video_private.videos,video_private.uploads,video_private.outbox TO metadata_upload,metadata_lifecycle;
GRANT SELECT,INSERT ON video_private.inbox TO metadata_lifecycle;
GRANT USAGE ON SCHEMA video_public TO metadata_reader;
GRANT SELECT ON video_public.ready_videos TO metadata_reader;

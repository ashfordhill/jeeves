import { qualifiedRelation, type SqlRelation } from "./durable-sql.ts";
import { quoteSqlIdentifier } from "./local.ts";

/** No application table, foreign key, product metadata or implicit runtime grants. */
export function ownedUploadSchema(binding: SqlRelation): string {
  const table = qualifiedRelation(binding);
  return `CREATE SCHEMA IF NOT EXISTS ${quoteSqlIdentifier(binding.schema)};
REVOKE ALL ON SCHEMA ${quoteSqlIdentifier(binding.schema)} FROM PUBLIC;
CREATE TABLE ${table} (
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
CREATE INDEX ON ${table}(owner_subject,created_at DESC);
CREATE INDEX ON ${table}(expires_at) WHERE cleanup_needed OR state='uploading';
`;
}

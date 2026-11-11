import { qualifiedRelation, type SqlRelation } from "./durable-sql.ts";
import { quoteSqlIdentifier } from "./local.ts";

/** Private generic lifecycle only. Public fields/reader grants belong to the application recipe. */
export function assetLifecycleSchema(binding: SqlRelation): string {
  const table = qualifiedRelation(binding);
  return `CREATE SCHEMA IF NOT EXISTS ${quoteSqlIdentifier(binding.schema)};
REVOKE ALL ON SCHEMA ${quoteSqlIdentifier(binding.schema)} FROM PUBLIC;
CREATE TABLE ${table} (
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
CREATE INDEX ON ${table}(deadline_at,asset_id) WHERE state IN ('pending','processing');
`;
}
/** Authoritative committed-ready source contract, not a browser projection. A compiled adapter
 * selects its public fields from this relation. No view or reader permission is implicit. */
export function assetReadySelect(binding: SqlRelation): string {
  return `SELECT asset_id,job_id,attempt_id,state_version,metadata,result,ready_at,publication_version FROM ${qualifiedRelation(binding)} WHERE state='ready'`;
}

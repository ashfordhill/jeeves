import { assetReadySelect } from "../runtime/asset-sql.ts";
import { qualifiedRelation, type SqlRelation } from "../runtime/durable-sql.ts";
import { quoteSqlIdentifier } from "../runtime/local.ts";

/** Explicit public-only projection over committed ready lifecycle state. No owner/provider/file,
 * job identity, failure, upload state or counter total is projected into immutable metadata. */
export function youtubeReadySelect(assets: SqlRelation): string {
  return `SELECT asset_id AS video_id, metadata->>'title' AS title, metadata->>'description' AS description,
 metadata->>'channel' AS channel, (result->>'durationSeconds')::double precision AS duration_seconds,
 result->>'manifest' AS manifest, result->>'thumbnail' AS thumbnail,
 ready_at AS published_at, publication_version FROM (${assetReadySelect(assets)}) AS ready`;
}
export function youtubeReadyView(assets: SqlRelation, view: SqlRelation): string {
  return `CREATE SCHEMA IF NOT EXISTS ${quoteSqlIdentifier(view.schema)};
REVOKE ALL ON SCHEMA ${quoteSqlIdentifier(view.schema)} FROM PUBLIC;
CREATE VIEW ${qualifiedRelation(view)} AS ${youtubeReadySelect(assets)};
`;
}

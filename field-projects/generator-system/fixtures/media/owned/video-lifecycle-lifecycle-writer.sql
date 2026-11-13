-- Application-owned ready-only public projection.
CREATE OR REPLACE VIEW published.videos WITH (security_barrier = true) AS
SELECT asset_id AS video_id,
  metadata->>'title' AS title,
  metadata->>'description' AS description,
  metadata->>'channel' AS channel,
  (result->>'durationSeconds')::double precision AS duration_seconds,
  result->>'manifest' AS manifest,
  result->>'thumbnail' AS thumbnail,
  ready_at AS published_at,
  publication_version
FROM upload_api_multipart_uploads.assets
WHERE state = 'ready';

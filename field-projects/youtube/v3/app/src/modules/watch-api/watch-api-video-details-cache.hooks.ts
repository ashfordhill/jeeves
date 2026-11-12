// Video details cache (Cache reader) in Watch API: the product hooks its cache read template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type pg from "pg";
import { HttpError } from "../../runtime/http.ts";
import type { PositiveReadAdapter } from "../../runtime/positive-cache.ts";
import { type PublishedVideoRow, type WatchedVideo, videoUuid, watched, watchedVideo } from "../video-contract.ts";

/** What GET /modules/watch-api-video-details-cache/:key reads: the path's key. */
export type WatchApiVideoDetailsCacheInput = { key: string };
/** The template's generic resources: a pool on the source database's login. */
export type WatchApiVideoDetailsCacheResources = { source: pg.Pool };

/** The path's video ID, canonical (lower case); anything else is 400, as v2's details route. */
function videoId(input: WatchApiVideoDetailsCacheInput): string {
  const id = videoUuid.safeParse(input.key);
  if (!id.success) throw new HttpError(400, "VIDEO_ID", "Invalid video identity.");
  return id.data;
}

/** YouTube's watch details (V3-15), v1/v2's ready reader: only a ready video's immutable public
 * record is answered and cached, at `ready-video:v1:<videoId>` for the cache tile's TTL. A
 * pending, failed or unknown video loads null, which is never cached, so it answers 404 until it
 * is ready. No count is in it: the View count reader reads them fresh. */
export function watchApiVideoDetailsCacheHooks(resources: WatchApiVideoDetailsCacheResources): PositiveReadAdapter<WatchApiVideoDetailsCacheInput, WatchedVideo> {
  return {
    /** The cache key for a request. */
    key(input) {
      return `ready-video:v1:${videoId(input)}`;
    },
    /** Parses a cached or loaded record. */
    codec: watchedVideo,
    /** Whether a record may be answered for this request. */
    eligible(record, input) {
      return record.videoId === videoId(input);
    },
    /** Reads the record from the source database: null when there is none. */
    async load(input) {
      const result = await resources.source.query<PublishedVideoRow>(
        `SELECT video_id, title, description, channel, duration_seconds, manifest, thumbnail,
  published_at, publication_version FROM published.videos WHERE video_id = $1`,
        [videoId(input)],
      );
      const row = result.rows[0];
      return row ? watched(row) : null;
    },
    /** When a record stops being valid, in UTC milliseconds, or null. */
    expiresAt() {
      return null;
    },
  };
}

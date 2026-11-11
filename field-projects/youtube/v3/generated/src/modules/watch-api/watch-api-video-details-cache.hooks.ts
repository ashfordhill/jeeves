// Video details cache (Cache reader) in Watch API: the product hooks its cache read template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type pg from "pg";
import type { PositiveReadAdapter } from "../../runtime/positive-cache.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";

/** What GET /modules/watch-api-video-details-cache/:key reads: the path's key. */
export type WatchApiVideoDetailsCacheInput = { key: string };
/** The template's generic resources: a pool on the source database's login. */
export type WatchApiVideoDetailsCacheResources = { source: pg.Pool };

/** Each hook throws "Not implemented" until written; the first one a route reaches answers 501. */
export function watchApiVideoDetailsCacheHooks(resources: WatchApiVideoDetailsCacheResources): PositiveReadAdapter<WatchApiVideoDetailsCacheInput, unknown> {
  return {
    /** The cache key for a request. */
    key(input) {
      throw new NotImplemented("key for Video details cache");
    },
    /** Parses a cached or loaded record. */
    codec: {
      parse(value) {
        throw new NotImplemented("codec for Video details cache");
      },
    },
    /** Whether a record may be answered for this request. */
    eligible(record, input) {
      throw new NotImplemented("eligible for Video details cache");
    },
    /** Reads the record from the source database: null when there is none. */
    async load(input) {
      throw new NotImplemented("load for Video details cache");
    },
    /** When a record stops being valid, in UTC milliseconds, or null. */
    expiresAt(record) {
      throw new NotImplemented("expiresAt for Video details cache");
    },
  };
}

// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import type pg from "pg";
import { HttpError } from "../../runtime/http.ts";
import type { PositiveReadAdapter } from "../../runtime/positive-cache.ts";
import {
  type PublishedVideoRow,
  videoUuid,
  type WatchedVideo,
  watched,
  watchedVideo,
} from "../video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";

export type WatchApiVideoDetailsCacheInput = { key: string };
export type WatchApiVideoDetailsCacheResources = { source: pg.Pool };

function videoId(input: WatchApiVideoDetailsCacheInput): string {
  const id = videoUuid.safeParse(input.key);
  if (!id.success) throw new HttpError(400, "VIDEO_ID", "Invalid video identity.");
  return id.data;
}

export function watchApiVideoDetailsCacheHooks(
  resources: WatchApiVideoDetailsCacheResources,
): PositiveReadAdapter<WatchApiVideoDetailsCacheInput, WatchedVideo> {
  return {
    key(input) {
      return `ready-video:v1:${videoId(input)}`;
    },
    codec: watchedVideo,
    eligible(record, input) {
      return record.videoId === videoId(input);
    },
    async load(input) {
      const result = await resources.source.query<PublishedVideoRow>(
        `SELECT video_id, title, description, channel, duration_seconds, manifest, thumbnail,
  published_at, publication_version FROM published.videos WHERE video_id = $1`,
        [videoId(input)],
      );
      const row = result.rows[0];
      return row ? watched(row) : null;
    },
    expiresAt() {
      return null;
    },
  };
}

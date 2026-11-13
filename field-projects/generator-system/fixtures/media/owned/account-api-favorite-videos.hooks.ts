// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import type pg from "pg";
import type { FavoritesHooks } from "../../runtime/favorites.ts";
import { videoUuid } from "../video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";

export type AccountApiFavoriteVideosResources = { items: pg.Pool };

export function accountApiFavoriteVideosHooks(
  resources: AccountApiFavoriteVideosResources,
): FavoritesHooks {
  return {
    async eligible(itemId) {
      const id = videoUuid.safeParse(itemId);
      if (!id.success || id.data !== itemId) return false;
      const result = await resources.items.query(
        "SELECT 1 FROM published.videos WHERE video_id = $1",
        [id.data],
      );
      return result.rowCount === 1;
    },
  };
}

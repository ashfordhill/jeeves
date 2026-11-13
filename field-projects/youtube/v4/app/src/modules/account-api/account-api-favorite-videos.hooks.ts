// Favorite videos (Favorites) in Account API: the product hooks its favorites template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type pg from "pg";
import type { FavoritesHooks } from "../../runtime/favorites.ts";
import { videoUuid } from "../video-contract.ts";

/** The template's generic resources: a pool on metadata, the database its items Data access reads. This tile's login there sees that database's published views. */
export type AccountApiFavoriteVideosResources = { items: pg.Pool };

/** YouTube's favorites (V3-15, contract §3): only a ready, public video may be added. */
export function accountApiFavoriteVideosHooks(resources: AccountApiFavoriteVideosResources): FavoritesHooks {
  return {
    /** Whether an item may be added to favorites; only adding asks. A video ID in its canonical
     * (lower-case) form, in published.videos; so a pending, failed or unknown video is refused. */
    async eligible(itemId) {
      const id = videoUuid.safeParse(itemId);
      if (!id.success || id.data !== itemId) return false;
      const result = await resources.items.query("SELECT 1 FROM published.videos WHERE video_id = $1", [id.data]);
      return result.rowCount === 1;
    },
  };
}

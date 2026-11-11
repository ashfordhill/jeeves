// Favorite videos (Favorites) in Account API: the product hooks its favorites template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type pg from "pg";
import type { FavoritesHooks } from "../../runtime/favorites.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";

/** The template's generic resources: a pool on metadata, the database its items Data access reads. This tile's login there sees that database's published views. */
export type AccountApiFavoriteVideosResources = { items: pg.Pool };

/** Each hook throws "Not implemented" until written; adding an item answers 501 until `eligible` is. */
export function accountApiFavoriteVideosHooks(resources: AccountApiFavoriteVideosResources): FavoritesHooks {
  return {
    /** Whether an item may be added to favorites; only adding asks. */
    async eligible(itemId) {
      throw new NotImplemented("eligible for Favorite videos");
    },
  };
}

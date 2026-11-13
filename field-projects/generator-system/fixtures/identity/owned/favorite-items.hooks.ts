import type pg from "pg";
import type { FavoritesHooks } from "../../runtime/favorites.ts";

export type FavoriteItemsResources = { items: pg.Pool };
export function favoriteItemsHooks(resources: FavoriteItemsResources): FavoritesHooks {
  return {
    async eligible(itemId) {
      const result = await resources.items.query("SELECT id FROM published.items WHERE id=$1", [
        itemId,
      ]);
      return result.rows.length === 1;
    },
  };
}

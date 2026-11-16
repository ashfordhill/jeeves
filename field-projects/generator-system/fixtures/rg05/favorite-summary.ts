// Application-owned operation; only its generated typed dependency is needed.

import type { FavoriteSummary } from "../../contracts/index.ts";
import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./favorite-summary.slots.ts";
export async function favoriteSummary(
  dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  const page = await dependencies.favoriteItems.list({});
  const body: FavoriteSummary = {
    count: page.items.length,
    target: dependencies.favoriteItems.targets.list,
  };
  return { status: 200, body };
}

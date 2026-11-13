import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./find-item.slots.ts";
export async function findItem(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const q = String(request.query.q ?? "");
  return {
    body: {
      q,
      hits: await dependencies.itemsIndex.search({
        query: { match: { title: q } },
      }),
    },
  };
}

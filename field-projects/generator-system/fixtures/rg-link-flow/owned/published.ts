import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./published.slots.ts";
export async function published(
  dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  return { body: (await dependencies.itemsDb.call("published_items", [])).rows };
}

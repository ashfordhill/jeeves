// @jeeves-extension: operation
import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./catalog-writer.slots.ts";
// Published immutable records remain product-owned.
export async function catalogWriter(
  dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  return { body: (await dependencies.catalog.call("list_records", [])).rows };
}

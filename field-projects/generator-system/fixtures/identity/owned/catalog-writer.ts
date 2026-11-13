import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./catalog-writer.slots.ts";

// Product SQL owns this tiny immutable catalog; the stub exposes the eligible items.
export async function catalogWriter(
  dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  return {
    body: await dependencies.catalog.query("SELECT id, title FROM published.items ORDER BY id"),
  };
}

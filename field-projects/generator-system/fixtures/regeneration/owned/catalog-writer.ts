import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./catalog-writer.slots.ts";
// Published immutable records are seeded by product SQL, never modified by this application.
export async function catalogWriter(
  dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  return {
    body: await dependencies.catalog.query(
      "SELECT id, title, state FROM published.catalog ORDER BY id",
    ),
  };
}

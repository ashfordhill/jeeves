// @jeeves-extension: operation
import type { ModuleRequest } from "../../extension-api/index.ts";
import type { Dependencies } from "./echo.slots.ts";
export async function echo(_dependencies: Dependencies, request: ModuleRequest) {
  const mode = request.query.mode ?? "default";
  return { body: { mode } };
}

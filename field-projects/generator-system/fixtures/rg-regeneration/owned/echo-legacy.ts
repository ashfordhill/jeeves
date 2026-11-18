import type { ModuleRequest } from "../entry.ts";
import type { Dependencies } from "./echo.slots.ts";
export async function echo(_dependencies: Dependencies, request: ModuleRequest) {
  request.query.mode ??= "default";
  return { body: { mode: request.query.mode } };
}

import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./forbidden.slots.ts";
export const allowedCallers: string[] = [];
export async function forbidden(
  _dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  throw Error("Forbidden handler must never be reached");
}

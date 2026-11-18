import {
  declareSettings,
  type ModuleRequest,
  type ModuleResponse,
} from "../../extension-api/index.ts";
import type { Dependencies } from "./echo.slots.ts";

export const settings = declareSettings({});
/** Acceptance hook: no effects or secret authority, only the bounded request projection. */
export async function echo(
  _dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  return { status: 200, body: { ok: true, headers: request.headers } };
}

import {
  declareSettings,
  type ModuleRequest,
  type ModuleResponse,
} from "../../extension-api/index.ts";
import type { Dependencies } from "./receive.slots.ts";

export const settings = declareSettings({});
/** Only valid workload and end-user authorization can reach this product operation. */
export async function receive(
  _dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  return { status: 200, body: { ok: true } };
}

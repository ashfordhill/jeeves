import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import { declareSettings, sealingKeys } from "../../extension-api/index.ts";
import type { Dependencies } from "./receipt.slots.ts";
export const settings = declareSettings({ VALUE_KEYS: sealingKeys("receipt.items") });
export async function receipt(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  return {
    status: 200,
    body: dependencies.settings.VALUE_KEYS.seal("receipt:3", {
      scope: request.context.caller.subject ?? "anonymous",
      context: "items.receipt.v1",
    }),
  };
}

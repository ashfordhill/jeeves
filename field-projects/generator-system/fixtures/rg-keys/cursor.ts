import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import { declareSettings, signingKeys } from "../../extension-api/index.ts";
import type { Dependencies } from "./cursor.slots.ts";
export const settings = declareSettings({ VALUE_KEYS: signingKeys("cursor.items") });
export async function cursor(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  return {
    status: 200,
    body: dependencies.settings.VALUE_KEYS.sign("next:3", {
      scope: request.context.caller.subject ?? "anonymous",
      context: "items.list.v1",
    }),
  };
}

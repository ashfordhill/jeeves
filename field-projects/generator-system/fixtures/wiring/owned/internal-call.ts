import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./internal-call.slots.ts";
export async function internalCall(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const response = await dependencies.internalApi.call("transform", {
    method: "POST",
    body: request.body,
  });
  return { status: response.status, body: response.body };
}

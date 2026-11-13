import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./internal-call.slots.ts";
export async function internalCall(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const response = await dependencies.internalApi.request("/modules/transform", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(2000),
  });
  return { status: response.status, body: await response.json() };
}

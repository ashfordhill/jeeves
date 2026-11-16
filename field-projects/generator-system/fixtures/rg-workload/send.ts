import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./send.slots.ts";
export async function send(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const result = await dependencies.callee.call("receive", {
    method: request.method === "POST" ? "POST" : "GET",
    ...(request.method === "POST" ? { body: request.body } : {}),
  });
  return { status: result.status, body: result.body };
}

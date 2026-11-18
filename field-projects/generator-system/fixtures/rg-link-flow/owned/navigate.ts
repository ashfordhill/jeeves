// @jeeves-extension: operation
import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./navigate.slots.ts";
export async function navigate(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  if (request.method === "GET") return dependencies.itemsApi.call("read-record", { method: "GET" });
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string") return { status: 400 };
  return dependencies.itemsApi.call("create", { method: "POST", key, body: request.body });
}

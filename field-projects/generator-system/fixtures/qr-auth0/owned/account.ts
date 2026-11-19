import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./account.slots.ts";

export async function account(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  if (request.path === "/link") return dependencies.linkApi.call("link-data", { method: "GET" });
  return dependencies.accountApi.call("account-data", { method: "GET" });
}

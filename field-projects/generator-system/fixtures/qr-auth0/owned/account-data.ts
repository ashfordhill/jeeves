import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./account-data.slots.ts";

export async function accountData(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  // A product-owned fixture record belongs to Alice.
  if (!request.caller.signedIn || request.caller.principal.subject !== "auth0|alice")
    return { status: 404, body: { found: false } };
  return dependencies.billingApi.call("billing-data", { method: "GET" });
}

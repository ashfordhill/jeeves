// Q03 probe body (application-owned file): a route meant to be internal-only.
import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./front-internal-grant.slots.ts";

export async function frontInternalGrant(_d: Dependencies, request: ModuleRequest): Promise<ModuleResponse> {
  return { body: { internalOnlyRoute: true, path: request.path, caller: request.caller.signedIn } };
}

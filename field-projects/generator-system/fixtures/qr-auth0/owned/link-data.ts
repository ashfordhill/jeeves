import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./link-data.slots.ts";

export async function linkData(
  _dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  return { body: { subject: request.caller.signedIn ? request.caller.principal.subject : null } };
}

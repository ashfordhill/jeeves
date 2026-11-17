import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./read-record.slots.ts";
export const allowedCallers = ["gateway"];
export async function readRecord(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const input = request.body as { key: string };
  const result = await dependencies.recordReader.read({ key: input.key });
  if (!result || (result.validUntil !== null && Date.now() >= result.validUntil))
    return { status: 404, body: { error: "NOT_FOUND" } };
  return { body: result };
}

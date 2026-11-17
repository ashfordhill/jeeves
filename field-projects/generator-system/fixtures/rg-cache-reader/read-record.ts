import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./read-record.slots.ts";
export async function readRecord(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const result = await dependencies.previewReader.read({
    key: request.path.split("/").at(-1) ?? "",
  });
  if (!result) return { status: 404, body: { error: "NOT_FOUND" } };
  // A later operation must finish before this final source-validity check.
  await Promise.resolve();
  if (result.validUntil !== null && Date.now() >= result.validUntil)
    return { status: 404, body: { error: "EXPIRED" } };
  return { status: 200, body: result.record };
}

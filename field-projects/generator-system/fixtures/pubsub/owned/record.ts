import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./record.slots.ts";
export async function record(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const { messageId, value } = (request.body ?? {}) as { messageId?: unknown; value?: unknown };
  if (request.method !== "POST" || typeof messageId !== "string" || !messageId)
    return { status: 400 };
  if (typeof value !== "string") return { status: 400 };
  await dependencies.clicks.publish(Buffer.from(JSON.stringify({ value })), { messageId });
  return { status: 202, body: { messageId, value } };
}

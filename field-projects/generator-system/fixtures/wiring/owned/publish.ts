import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./publish.slots.ts";
export async function publish(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const { channel, messageId, value } = request.body as {
    channel: "broadcasts" | "jobs";
    messageId: string;
    value: string;
  };
  if (!["broadcasts", "jobs"].includes(channel) || !messageId || typeof value !== "string")
    return { status: 400 };
  await dependencies[channel].publish(Buffer.from(JSON.stringify({ value })), {
    messageId,
  });
  return { status: 202, body: { channel, messageId, value } };
}

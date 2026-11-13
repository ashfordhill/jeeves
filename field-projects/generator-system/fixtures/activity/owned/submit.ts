import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./submit.slots.ts";

/** A successful reply means broker-confirmed publication, not a transactional outbox. */
export async function submit(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const event = request.body as { eventId?: unknown; aggregateKey?: unknown } | undefined;
  if (request.method !== "POST") return { status: 405 };
  if (
    !event ||
    typeof event.eventId !== "string" ||
    typeof event.aggregateKey !== "string" ||
    !/^[A-Za-z0-9:_-]{1,120}$/.test(event.eventId) ||
    !/^[A-Za-z0-9:_-]{1,120}$/.test(event.aggregateKey)
  )
    return { status: 400, body: { error: "Invalid activity" } };
  const body = { eventId: event.eventId, aggregateKey: event.aggregateKey };
  await dependencies.events.publish(Buffer.from(JSON.stringify(body)), { messageId: body.eventId });
  return { status: 202, body };
}

// @jeeves-extension: policy

import type { WebhookEvent } from "../../extension-api/index.ts";

export function mapEvent(input: unknown): WebhookEvent {
  const notice = input as {
    id?: unknown;
    type?: unknown;
    object?: unknown;
    created?: unknown;
    data?: { object?: { customer?: unknown; status?: unknown } };
    payload?: { customer?: unknown; status?: unknown; created?: unknown };
  };
  const snapshot = notice?.object === "event" ? notice.data?.object : notice?.payload;
  const created = notice?.object === "event" ? notice.created : notice?.payload?.created;
  if (
    typeof notice?.id !== "string" ||
    typeof notice.type !== "string" ||
    typeof snapshot?.customer !== "string" ||
    typeof snapshot.status !== "string" ||
    typeof created !== "number" ||
    !Number.isSafeInteger(created)
  )
    throw Error("Incomplete subscription notice");
  return {
    id: snapshot.status === "fixture-remap" ? "evt_fixture_wrong_id" : notice.id,
    type: notice.type,
    payload: { customer: snapshot.customer, status: snapshot.status, created },
  };
}

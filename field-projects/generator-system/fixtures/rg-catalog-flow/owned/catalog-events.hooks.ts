// @jeeves-extension: policy

import { catalogItem } from "../../contracts/catalog.ts";
import type { WebhookEvent } from "../../extension-api/index.ts";
export function mapEvent(input: unknown): WebhookEvent {
  const e = input as WebhookEvent;
  if (!e || typeof e.id !== "string" || !["catalog.changed", "catalog.failed"].includes(e.type))
    throw Error("Invalid catalog event");
  return { id: e.id, type: e.type, payload: catalogItem(e.payload) };
}

// @jeeves-extension: operation

import { catalogItem } from "../../contracts/catalog.ts";
import { defineWebhookWork } from "../../extension-api/index.ts";
import type { Dependencies } from "./catalog-events.slots.ts";
export const durableWork = defineWebhookWork<Dependencies>({
  database: "callerDb",
  id: "catalog-inbox",
  version: 1,
  integration: null,
  async complete(event, commands) {
    if (event.type === "catalog.failed") throw Error("Catalog terminal fixture");
    const item = catalogItem(event.payload);
    await commands.call("accept_event", [event.id, item.id, item.title]);
  },
});

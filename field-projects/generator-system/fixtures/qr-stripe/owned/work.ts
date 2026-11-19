// @jeeves-extension: operation

import { defineWebhookWork } from "../../extension-api/index.ts";
import type { Dependencies } from "./verified-payment-event.slots.ts";

export const durableWork = defineWebhookWork<Dependencies>({
  database: "billing",
  id: "subscription-inbox",
  version: 1,
  integration: null,
  async complete(event, commands) {
    const { customer, status, created } = event.payload as {
      customer: string;
      status: string;
      created: number;
    };
    if (status === "fixture-failure") throw Error("Fixture failed before applying a subscription");
    await commands.call("record_subscription_event", [event.id, customer, status, created]);
    await commands.call("apply_subscription", [customer, status, created]);
  },
});

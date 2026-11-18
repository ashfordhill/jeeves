// @jeeves-extension: operation

import { catalogItem } from "../../contracts/catalog.ts";
import { defineReceiptConsumer, type ModuleMessage } from "../../extension-api/index.ts";
import type { Dependencies } from "./apply-catalog.slots.ts";
export const receiptConsumer = defineReceiptConsumer<Dependencies>({
  database: "callerDb",
  deliveryHorizonSeconds: 60,
  retentionSeconds: 60,
  map(input, messageId) {
    return { id: messageId, payload: catalogItem(input) };
  },
  async complete(event, commands) {
    const item = catalogItem(event.payload);
    await commands.call("apply_catalog", [event.id, item.id, item.title]);
  },
});
export async function applyCatalog(
  _dependencies: Dependencies,
  _message: ModuleMessage,
): Promise<void> {
  throw Error("Receipt adapter required");
}

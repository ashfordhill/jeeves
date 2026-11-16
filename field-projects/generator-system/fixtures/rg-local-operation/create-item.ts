import { type ItemInput, itemInput } from "../../contracts/item.ts";
import { defineLocalOperation, type ModuleRequest } from "../../extension-api/index.ts";
import type { Dependencies } from "./create-item.slots.ts";
export const localOperation = defineLocalOperation<ItemInput, Dependencies>({
  database: "itemsDb",
  id: "create-item",
  version: 1,
  retentionSeconds: 86400,
  secret: true,
  validate: itemInput,
  admit: async () => {},
  async mutate(input, commands) {
    await commands.call("create_item", [input.id]);
    return { status: 201, body: { id: input.id, receipt: "private-fixture-receipt" } };
  },
});
export function createItem(dependencies: Dependencies, request: ModuleRequest) {
  return localOperation.route(dependencies, request);
}

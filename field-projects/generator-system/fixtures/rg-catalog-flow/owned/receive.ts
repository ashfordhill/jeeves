// @jeeves-extension: operation

import { type CatalogItem, catalogItem } from "../../contracts/catalog.ts";
import {
  defineWorkloadOperation,
  type ModuleRequest,
  type ModuleResponse,
} from "../../extension-api/index.ts";
import type { Dependencies } from "./receive.slots.ts";
export const allowedCallers = ["caller"];
export const localOperation = defineWorkloadOperation<CatalogItem, Dependencies>({
  database: "calleeDb",
  id: "catalog-provider-apply",
  version: 1,
  retentionSeconds: 86400,
  secret: false,
  validate: catalogItem,
  admit: async () => {},
  async mutate(input, commands, caller) {
    if (caller.processId !== "caller") throw Error("Unexpected catalog caller");
    await commands.call("provider_apply", [input.id, input.title]);
    return { status: 201, body: input };
  },
});
export async function receive(
  _dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  return { status: 405 };
}

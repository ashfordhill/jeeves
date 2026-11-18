// @jeeves-extension: operation

import { type CatalogItem, catalogItem } from "../../contracts/catalog.ts";
import { defineDurableWork, type ModuleRequest } from "../../extension-api/index.ts";
import type { Dependencies } from "./send.slots.ts";
export const durableWork = defineDurableWork<CatalogItem, Dependencies>({
  database: "callerDb",
  id: "catalog-replicate",
  version: 1,
  retentionSeconds: 86400,
  maxAttempts: 4,
  integration: { target: "callee", operation: "receive", map: catalogItem },
  validate: catalogItem,
  async complete(input, commands, _caller, remote) {
    if (remote?.status !== 201) throw Error("Unexpected catalog result");
    await commands.call("catalog_sync", [input.id, input.title]);
  },
});
export async function send(dependencies: Dependencies, request: ModuleRequest) {
  const key = request.headers["idempotency-key"];
  if (request.method !== "POST" || typeof key !== "string") return { status: 400 };
  return {
    status: 202,
    body: await durableWork.accept(dependencies, { key, input: request.body }),
  };
}

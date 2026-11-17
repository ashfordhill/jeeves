import { defineDurableWork, type ModuleRequest } from "../../extension-api/index.ts";
import type { Dependencies } from "./create-item.slots.ts";

interface ItemInput {
  readonly id: string;
}
export const durableWork = defineDurableWork<ItemInput, Dependencies>({
  database: "itemsDb",
  id: "apply-item",
  version: 1,
  retentionSeconds: 86400,
  maxAttempts: 3,
  integration: null,
  validate(input) {
    const value = input as Partial<ItemInput>;
    if (!value || typeof value.id !== "string" || !/^[a-z0-9-]{1,32}$/.test(value.id))
      throw Error("Invalid item");
    return { id: value.id };
  },
  async complete(input, commands) {
    await commands.call("create_item", [input.id]);
  },
});
export async function createItem(dependencies: Dependencies, request: ModuleRequest) {
  const key = request.headers["idempotency-key"];
  if (request.method !== "POST" || typeof key !== "string")
    return { status: 400, body: { error: "WORK_INPUT" } };
  return {
    status: 202,
    body: await durableWork.accept(dependencies, { key, input: request.body }),
  };
}

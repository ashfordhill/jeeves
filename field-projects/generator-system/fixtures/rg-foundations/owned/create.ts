import { defineLocalOperation, type ModuleRequest } from "../../extension-api/index.ts";
import type { Dependencies } from "./create.slots.ts";
export const allowedCallers = ["gateway"];
export const localOperation = defineLocalOperation<{ id: string }, Dependencies>({
  database: "itemsDb",
  id: "create",
  version: 1,
  retentionSeconds: 60,
  secret: true,
  validate(value) {
    if (
      !value ||
      typeof value !== "object" ||
      !("id" in value) ||
      typeof value.id !== "string" ||
      !/^[a-z0-9-]{1,60}$/.test(value.id)
    )
      throw Error("Invalid item");
    return { id: value.id };
  },
  async admit(_input, dependencies) {
    await dependencies.createLimit.admit({});
  },
  async mutate(input, commands) {
    const result = await commands.call("create_item", [input.id]);
    if ((result.rows[0] as { product_role?: boolean } | undefined)?.product_role !== true)
      throw Error("Local callback must execute under its product role");
    return { status: 201, body: { id: input.id, receipt: "sealed-foundation-receipt" } };
  },
});
export function create(dependencies: Dependencies, request: ModuleRequest) {
  return localOperation.route(dependencies, request);
}

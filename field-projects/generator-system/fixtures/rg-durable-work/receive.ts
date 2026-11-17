import {
  defineWorkloadOperation,
  type ModuleRequest,
  type ModuleResponse,
  NotImplemented,
} from "../../extension-api/index.ts";
import type { Dependencies } from "./receive.slots.ts";
export const localOperation = defineWorkloadOperation<{ id: string }, Dependencies>({
  database: "calleeDb",
  id: "receive-item",
  version: 1,
  retentionSeconds: 86400,
  secret: false,
  validate(input) {
    const value = input as { id: string };
    if (!value || typeof value.id !== "string") throw Error("Invalid item");
    return { id: value.id };
  },
  admit: async () => {},
  async mutate(input, commands, caller) {
    if (caller.processId !== "caller") throw Error("Unexpected caller");
    await commands.call("create_item", [input.id]);
    return { status: 201, body: { id: input.id } };
  },
});
// The generated framework protocol enforces tickets and replay independently of this stub.
export async function receive(
  _dependencies: Dependencies,
  _request: ModuleRequest,
): Promise<ModuleResponse> {
  throw new NotImplemented("ordinary module entry");
}

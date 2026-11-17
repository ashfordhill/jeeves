import { defineDurableWork, type ModuleRequest } from "../../extension-api/index.ts";
import type { Dependencies } from "./send.slots.ts";
export const durableWork = defineDurableWork<{ id: string }, Dependencies>({
  database: "callerDb",
  id: "replicate",
  version: 1,
  retentionSeconds: 86400,
  maxAttempts: 4,
  integration: { target: "callee", operation: "receive", map: (input) => ({ id: input.id }) },
  validate(input) {
    const value = input as { id: string };
    if (!value || typeof value.id !== "string") throw Error("Invalid item");
    return { id: value.id };
  },
  async complete(input, commands, _caller, remote) {
    if (remote?.status !== 201) throw Error("Unexpected remote result");
    await commands.call("create_item", [input.id]);
  },
});
export async function send(dependencies: Dependencies, request: ModuleRequest) {
  const key = request.headers["idempotency-key"];
  if (request.method !== "POST" || typeof key !== "string") return { status: 400, body: null };
  return {
    status: 202,
    body: await durableWork.accept(dependencies, { key, input: request.body }),
  };
}

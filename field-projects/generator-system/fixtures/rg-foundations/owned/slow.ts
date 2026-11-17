import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./slow.slots.ts";
export const allowedCallers = ["gateway"];
export async function slow(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  if ((request.body as { hang?: boolean } | undefined)?.hang) {
    console.log(JSON.stringify({ event: "rg14-hung-entered" }));
    await new Promise<never>(() => {});
  }
  await dependencies.itemsDb.call("slow_read", []);
  return { body: { finished: true, remainingMs: request.context.remainingMs() } };
}

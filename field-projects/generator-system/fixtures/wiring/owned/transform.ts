import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./transform.slots.ts";
export async function transform(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const { value } = request.body as { value: string };
  // A separate bucket establishes a real, valid credential whose scope excludes Objects.
  await dependencies.vault.put("private-record", Buffer.from(value), "text/plain");
  return {
    body: {
      received: value,
      result: `internal:${value.split("").reverse().join("")}`,
    },
  };
}

import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./echo.slots.ts";
export async function echo(
  _dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const { value } = request.body as { value: string };
  return { body: { received: value, result: `echo:${value.toUpperCase()}` } };
}

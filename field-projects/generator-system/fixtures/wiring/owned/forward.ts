import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./forward.slots.ts";
export async function forward(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  return (await dependencies.echo(request)) as ModuleResponse;
}

import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./external-call.slots.ts";
/** External adapters are custom: the generator deliberately supplies no partner client.
 * The disposable harness supplies this endpoint; no endpoint is added to generated config. */
export async function externalCall(
  _dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const { endpoint, value } = request.body as {
    endpoint: string;
    value: string;
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value }),
    signal: AbortSignal.timeout(2000),
  });
  return { status: response.status, body: await response.json() };
}

import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./external-call.slots.ts";
/** A custom external adapter: the generated partner client (`dependencies.partner`, QG20) reads
 * JEEVES_EXTERNAL_PARTNER_URL, which this fixture's compose.override.yaml sets, but this body keeps
 * its own bounded fetch to the endpoint the disposable harness supplies in the request. */
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

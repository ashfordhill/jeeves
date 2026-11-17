import type { ModuleRequest, ModuleResponse } from "../../extension-api/index.ts";
import type { Dependencies } from "./forward.slots.ts";
export async function forward(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const body = request.body as { operation?: string; input?: unknown } | undefined;
  const operation = body?.operation ?? "create";
  if (!["create", "read-record", "slow", "forbidden"].includes(operation)) return { status: 400 };
  const key = request.headers["idempotency-key"];
  return dependencies.itemsApi.call(operation, {
    method: "POST",
    body: body?.input,
    ...(typeof key === "string" ? { key } : {}),
  });
}

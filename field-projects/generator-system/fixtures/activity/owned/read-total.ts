import type { ModuleRequest, ModuleResponse } from "../entry.ts";
import type { Dependencies } from "./read-total.slots.ts";

export async function readTotal(
  dependencies: Dependencies,
  request: ModuleRequest,
): Promise<ModuleResponse> {
  const aggregateKey = request.query.aggregate;
  if (request.method !== "GET") return { status: 405 };
  if (typeof aggregateKey !== "string" || !/^[A-Za-z0-9:_-]{1,120}$/.test(aggregateKey))
    return { status: 400, body: { error: "Invalid aggregate" } };
  const rows = await dependencies.totals.query<{ total: string }>(
    "SELECT total::text AS total FROM increment_public.totals WHERE aggregate_key=$1",
    [aggregateKey],
  );
  return { body: { aggregateKey, total: rows[0]?.total ?? "0" } };
}

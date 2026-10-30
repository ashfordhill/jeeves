import type { RunUsage } from "../db/schema.ts";

export type UsageTotals = RunUsage & {
  records: number;
  tokenRecords: number;
  costRecords: number;
  knownCostUsd: number;
};

/** Sum leaf records once. Unknown records retain the known subtotal and its coverage. */
export function usageTotals(parts: (RunUsage | null)[]): UsageTotals {
  const total: UsageTotals = {
    inputTokens: 0,
    outputTokens: 0,
    known: true,
    records: parts.length,
    tokenRecords: 0,
    costRecords: 0,
    knownCostUsd: 0,
  };
  for (const part of parts) {
    if (!part) {
      total.known = false;
      continue;
    }
    total.inputTokens += part.inputTokens;
    total.outputTokens += part.outputTokens;
    if (part.known) total.tokenRecords++;
    else total.known = false;
    if (part.costUsd !== undefined) {
      total.knownCostUsd += part.costUsd;
      total.costRecords++;
    }
  }
  if (total.records > 0 && total.costRecords === total.records) total.costUsd = total.knownCostUsd;
  return total;
}

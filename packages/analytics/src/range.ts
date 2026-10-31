/** UTC calendar dates; range endpoints are inclusive in the UI and half-open in storage. */
export const MAX_RANGE_DAYS = 90;
const dayMs = 86_400_000;
export type DateRange = { from: string; to: string };
export type UtcRange = DateRange & { start: string; endExclusive: string; days: number };
export type DailyCount = { date: string; count: number };

function midnight(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const year = Number(value.slice(0, 4));
  if (year < 1900 || year > 9998) return NaN;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export function utcRange(from: unknown, to: unknown): UtcRange {
  const first = midnight(from),
    last = midnight(to);
  const days = (last - first) / dayMs + 1;
  if (!Number.isInteger(days) || days < 1 || days > MAX_RANGE_DAYS)
    throw new Error(`Choose valid UTC dates, in order, spanning at most ${MAX_RANGE_DAYS} days.`);
  return {
    from: String(from),
    to: String(to),
    days,
    start: new Date(first).toISOString(),
    endExclusive: new Date(last + dayMs).toISOString(),
  };
}

export function recentRange(days: 7 | 30 | 90, now = new Date()): DateRange {
  if (![7, 30, 90].includes(days) || !Number.isFinite(now.getTime()))
    throw new Error("Invalid range preset");
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    from: new Date(end - (days - 1) * dayMs).toISOString().slice(0, 10),
    to: new Date(end).toISOString().slice(0, 10),
  };
}

/** PostgreSQL bigint counts arrive as strings; fail closed before losing integer precision. */
export function safeCount(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+$/.test(String(value)))
    throw new Error("Aggregate count is not a nonnegative integer");
  const count = Number(value);
  if (!Number.isSafeInteger(count))
    throw new Error("Aggregate count exceeds safe integer precision");
  return count;
}

export function dailyCounts(
  range: DateRange,
  rows: readonly { date: unknown; count: unknown }[],
): DailyCount[] {
  const validated = utcRange(range.from, range.to);
  const counts = new Map<string, number>();
  if (rows.length > validated.days) throw new Error("Aggregate returned too many daily buckets");
  for (const row of rows) {
    const date = String(row.date);
    if (
      !Number.isFinite(midnight(date)) ||
      date < range.from ||
      date > range.to ||
      counts.has(date)
    )
      throw new Error("Aggregate returned a duplicate or out-of-range date");
    counts.set(date, safeCount(row.count));
  }
  return Array.from({ length: validated.days }, (_, index) => {
    const date = new Date(Date.parse(validated.start) + index * dayMs).toISOString().slice(0, 10);
    return { date, count: counts.get(date) ?? 0 };
  });
}

/** A trusted adapter supplies only immutable eligible positive records, never totals,
 * private status or not-ready state. Schema validation cannot authenticate a poisoned cache. */
export interface PositiveCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiry: { PXAT: number }): Promise<unknown>;
}
export interface PositiveReadAdapter<I, R> {
  /** Validate/canonicalize the request here. Include every input affecting loader/eligibility
   * semantics in the key: same-key calls share one result. Caller/adapter owns canonical input. */
  key(input: I): string;
  codec: { parse(value: unknown): R };
  /** Check requested identity AND domain eligibility on both cached and loaded records. */
  eligible(record: R, input: I): boolean;
  /** Application-bound authoritative lookup; null is never cached. */
  load(input: I): Promise<unknown | null>;
  /** Absolute UTC milliseconds; null means no record expiry. */
  expiresAt?(record: R): number | null;
}

export function createPositiveReader<I, R>(options: {
  adapter: PositiveReadAdapter<I, R>;
  /** Required: pass the emitted binding's authoritative cache tile setting. No default. */
  ttlSeconds: number;
  cache?: PositiveCache;
}) {
  const { adapter, cache, ttlSeconds } = options;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 604800)
    throw new Error("Invalid positive cache TTL");
  const fills = new Map<string, Promise<R | null>>();
  let usable = !!cache;
  // Bound even an injected adapter. After a stalled phase disable this reader's cache so
  // repeated requests cannot accumulate stalled cache calls. The real client also destroys
  // its socket; arbitrary injected adapters must own cancellation/late completion themselves.
  async function phase<T>(effect: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(effect),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            usable = false;
            reject(new Error("Cache deadline"));
          }, 150);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  function expiry(record: R): number | null {
    const value = adapter.expiresAt?.(record) ?? null;
    if (value !== null && (!Number.isSafeInteger(value) || value < 0))
      throw new Error("Invalid positive record expiry");
    return value;
  }
  const alive = (until: number | null) => until === null || until > Date.now();
  async function read(input: I, key: string): Promise<R | null> {
    if (cache && usable)
      try {
        const raw = await phase(() => cache.get(key));
        if (raw !== null) {
          const record = adapter.codec.parse(JSON.parse(raw));
          if (adapter.eligible(record, input) && alive(expiry(record))) return record;
        }
      } catch {
        // Corrupt/unavailable cache is optional. The authoritative loader owns its errors.
      }
    const raw = await adapter.load(input);
    if (raw === null) return null;
    const record = adapter.codec.parse(raw);
    if (!adapter.eligible(record, input)) return null;
    const until = expiry(record);
    if (!alive(until)) return null;
    if (cache && usable)
      try {
        const value = JSON.stringify(record);
        if (value === undefined) throw new Error("Invalid positive record encoding");
        await phase(async () => {
          const now = Date.now();
          const PXAT = Math.min(now + ttlSeconds * 1000, until ?? Number.MAX_SAFE_INTEGER);
          // No upward rounding. Skip subsecond remaining life; the valid record may still
          // be returned. Absolute atomic expiry prevents transport delay extending its life.
          if (PXAT - now >= 1000) await cache.set(key, value, { PXAT });
        });
      } catch {
        // A failed optional fill must preserve a successful authoritative lookup.
      }
    // Expiry can cross during fill. No expired result is returned, even after fill failure.
    return alive(until) ? record : null;
  }
  return (input: I): Promise<R | null> => {
    const key = adapter.key(input);
    if (!key || key.length > 512) throw new Error("Invalid positive cache key");
    const existing = fills.get(key);
    if (existing) return existing;
    const fill = read(input, key).finally(() => fills.delete(key));
    fills.set(key, fill);
    return fill;
  };
}

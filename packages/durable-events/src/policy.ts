/** Browser-safe versioned policy contracts. No clocks, random values or Node imports. */
export interface DeliveryPolicy {
  schemaVersion: 1;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  leaseMs: number;
  deadlineMs: number;
  pollMs: number;
}
export const deliveryPresets = {
  standard: {
    label: "Standard delivery",
    description: "Five attempts with longer backoff for background work.",
    policy: Object.freeze({
      schemaVersion: 1,
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
      leaseMs: 30_000,
      deadlineMs: 10_000,
      pollMs: 500,
    } satisfies DeliveryPolicy),
  },
  responsive: {
    label: "Responsive delivery",
    description: "Three attempts and shorter delays for brief handlers.",
    policy: Object.freeze({
      schemaVersion: 1,
      maxAttempts: 3,
      baseDelayMs: 250,
      maxDelayMs: 5000,
      leaseMs: 15_000,
      deadlineMs: 5000,
      pollMs: 250,
    } satisfies DeliveryPolicy),
  },
} as const;
export type DeliveryPreset = keyof typeof deliveryPresets;

export function deliveryPolicy(preset: DeliveryPreset = "standard"): DeliveryPolicy {
  if (!Object.hasOwn(deliveryPresets, preset)) throw new Error("Unknown delivery preset");
  return { ...deliveryPresets[preset].policy };
}

/** Stored snapshots remain interpretable if a later version adds presets. */
export function parsePolicy(value: unknown): DeliveryPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid delivery policy");
  const policy = value as Record<string, unknown>;
  const bounds = {
    maxAttempts: [1, 10],
    baseDelayMs: [250, 60_000],
    maxDelayMs: [250, 300_000],
    leaseMs: [5000, 300_000],
    deadlineMs: [1000, 60_000],
    pollMs: [250, 5000],
  } as const;
  if (policy.schemaVersion !== 1 || Object.keys(policy).length !== 7)
    throw new Error("Unsupported delivery policy version");
  for (const [field, [min, max]] of Object.entries(bounds)) {
    const number = policy[field];
    if (typeof number !== "number" || !Number.isInteger(number) || number < min || number > max)
      throw new Error(`Invalid delivery policy ${field}`);
  }
  const parsed = policy as unknown as DeliveryPolicy;
  if (parsed.baseDelayMs > parsed.maxDelayMs || parsed.deadlineMs * 2 > parsed.leaseMs)
    throw new Error("Incompatible delivery policy bounds");
  return { ...parsed };
}

/** Stable bounded jitter spreads retries without making generated policy nondeterministic. */
export function retryDelay(policy: DeliveryPolicy, id: string, attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 10)
    throw new Error("Invalid delivery attempt");
  let hash = 2166136261;
  for (const char of `${id}:${attempt}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const jitter = 0.75 + (hash % 501) / 1000;
  return Math.min(
    policy.maxDelayMs,
    Math.max(1, Math.round(policy.baseDelayMs * 2 ** (attempt - 1) * jitter)),
  );
}

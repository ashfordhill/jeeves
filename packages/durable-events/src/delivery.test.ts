import { describe, expect, it, vi } from "vitest";
import { canonicalPayload } from "./json.ts";
import { deliveryPolicy, parsePolicy, retryDelay } from "./policy.ts";
import { type DeliveryLease, defineEvent, type Outbox } from "./postgres.ts";
import { DeliveryWorker, defineHandler, PermanentDeliveryFailure } from "./worker.ts";

it("normalizes only bounded lossless JSON without invoking getters or accepting prototype keys", () => {
  expect(canonicalPayload({ b: [2, "🧭"], a: 1 }).hash).toBe(
    canonicalPayload({ a: 1, b: [2, "🧭"] }).hash,
  );
  const getter = vi.fn(() => "must not run");
  const cycle: unknown[] = [];
  cycle.push(cycle);
  const hole = Object.assign(new Array(1), { extra: "hidden" });
  for (const value of [
    hole,
    undefined,
    NaN,
    new Date(),
    [undefined],
    new Array(2),
    cycle,
    { a: Infinity },
    {
      get secret() {
        return getter();
      },
    },
    JSON.parse('{"__proto__":1}'),
    "\u0000",
    "\ud800",
    "x".repeat(65_537),
  ])
    expect(() => canonicalPayload(value)).toThrow();
  expect(getter).not.toHaveBeenCalled();
});

it("keeps policy defaults and deterministic jitter bounded and rejects incompatible snapshots", () => {
  for (const name of ["standard", "responsive"] as const) {
    const policy = deliveryPolicy(name);
    expect(parsePolicy(policy)).toEqual(policy);
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      const ms = retryDelay(policy, "example-delivery", attempt);
      expect(ms).toBe(retryDelay(policy, "example-delivery", attempt));
      expect(ms).toBeGreaterThanOrEqual(1);
      expect(ms).toBeLessThanOrEqual(policy.maxDelayMs);
    }
  }
  expect(() => parsePolicy({ ...deliveryPolicy(), deadlineMs: 30_000 })).toThrow();
  expect(() => parsePolicy({ ...deliveryPolicy(), arbitraryRetry: true })).toThrow();
  expect(() => defineEvent({ type: "bad type", version: 1, parse: (v) => v })).toThrow();
});

const event = defineEvent({
  type: "inventory.changed",
  version: 1,
  parse(value: unknown) {
    if (value !== "widget") throw new Error("private payload must not reach persisted error");
    return value;
  },
});
function fixture(payload: unknown = "widget") {
  const delivery: DeliveryLease = {
    id: "00000000-0000-4000-8000-000000000001",
    type: event.type,
    version: 1,
    state: "running",
    attempts: 1,
    availableAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    completedAt: null,
    lastError: null,
    effectCommitted: false,
    tenantId: "warehouse-a",
    payload,
    token: "00000000-0000-4000-8000-000000000002",
    leaseUntil: "2026-01-01T00:00:30Z",
    policy: deliveryPolicy(),
  };
  const store = {
    policy: deliveryPolicy(),
    definitions: () => [event],
    definition: () => event,
    claim: vi.fn(async () => ({ kind: "claimed" as const, delivery })),
    acknowledge: vi.fn(async () => true),
    fail: vi.fn(async () => true),
    effect: vi.fn(async () => true),
  } satisfies Pick<
    Outbox,
    "policy" | "definitions" | "definition" | "claim" | "acknowledge" | "fail" | "effect"
  >;
  return { store, delivery };
}
describe("worker ownership and cancellation", () => {
  it("signals a deadline but waits for an ignoring handler, prevents overlap and never acknowledges it", async () => {
    vi.useFakeTimers();
    try {
      const { store } = fixture();
      let finish: (() => void) | undefined;
      let signal: AbortSignal | undefined;
      const worker = new DeliveryWorker(store, [
        defineHandler(event, async (_payload, context) => {
          signal = context.signal;
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        }),
      ]);
      const task = worker.once();
      await vi.advanceTimersByTimeAsync(10_001);
      expect(signal?.aborted).toBe(true);
      expect(store.acknowledge).not.toHaveBeenCalled();
      await expect(worker.once()).rejects.toThrow("in-flight");
      expect(store.claim).toHaveBeenCalledTimes(1);
      finish?.();
      expect(await task).toMatchObject({ state: "pending", error: "deadline-exceeded" });
      expect(store.fail).toHaveBeenCalledWith(expect.anything(), "deadline-exceeded", false);
    } finally {
      vi.useRealTimers();
    }
  });
  it("distinguishes permanent/invalid payload failures and rejects missing handlers", async () => {
    const { store } = fixture();
    expect(() => new DeliveryWorker(store, [])).toThrow("Every registered event");
    const worker = new DeliveryWorker(store, [
      defineHandler(event, async () => {
        throw new PermanentDeliveryFailure();
      }),
    ]);
    expect(await worker.once()).toMatchObject({ state: "exhausted", error: "permanent-failure" });
    const invalid = fixture("secret");
    const handler = vi.fn(async () => {});
    expect(
      await new DeliveryWorker(invalid.store, [defineHandler(event, handler)]).once(),
    ).toMatchObject({ state: "exhausted", error: "invalid-payload" });
    expect(handler).not.toHaveBeenCalled();
    expect(JSON.stringify(invalid.store.fail.mock.calls)).not.toContain("private payload");
  });
  it("does no new work after shutdown and reports lost ownership instead of success", async () => {
    const { store } = fixture();
    const controller = new AbortController();
    const worker = new DeliveryWorker(store, [defineHandler(event, async () => {})]);
    controller.abort();
    expect(await worker.once(controller.signal)).toEqual({ state: "idle" });
    expect(store.claim).not.toHaveBeenCalled();
    store.acknowledge.mockResolvedValue(false);
    expect(await worker.once()).toMatchObject({ state: "lost-lease" });
  });
});

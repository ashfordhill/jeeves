import { setTimeout as delay } from "node:timers/promises";
import type { DeliveryErrorCode, DeliveryLease, EventDefinition, Outbox, Sql } from "./postgres.ts";

export interface DeliveryContext {
  /** Stable across retries. Pass this identity to idempotent external destinations. */
  readonly id: string;
  readonly tenantId: string;
  readonly attempt: number;
  readonly signal: AbortSignal;
  /** Database-only effect and receipt in one transaction; false means already committed. */
  effect(work: (tx: Sql) => Promise<void>): Promise<boolean>;
}
export interface EventHandler {
  readonly event: EventDefinition;
  readonly handle: (payload: unknown, context: DeliveryContext) => Promise<void>;
}
export function defineHandler<T>(
  event: EventDefinition<T>,
  handle: (payload: T, context: DeliveryContext) => Promise<void>,
): EventHandler {
  return { event, handle: (payload, context) => handle(payload as T, context) };
}
export class PermanentDeliveryFailure extends Error {
  constructor() {
    super("Delivery cannot be completed by this handler");
  }
}
export type DeliveryOutcome =
  | { state: "idle" }
  | {
      state: "succeeded" | "pending" | "exhausted" | "lost-lease";
      id: string;
      attempt: number;
      error?: DeliveryErrorCode;
    };
type Store = Pick<
  Outbox,
  "policy" | "definitions" | "definition" | "claim" | "acknowledge" | "fail" | "effect"
>;

export class DeliveryWorker {
  private readonly handlers = new Map<string, EventHandler>();
  private busy = false;
  constructor(
    private readonly store: Store,
    handlers: readonly EventHandler[],
  ) {
    for (const handler of handlers) {
      const { event } = handler;
      const key = `${event.type}@${event.version}`;
      if (store.definition(event.type, event.version) !== event || this.handlers.has(key))
        throw new Error("Duplicate or unregistered delivery handler");
      this.handlers.set(key, handler);
    }
    if (this.handlers.size !== store.definitions().length)
      throw new Error("Every registered event needs a delivery handler");
  }

  /** One in-flight handler per worker, including a handler that ignores cooperative cancellation. */
  async once(signal?: AbortSignal): Promise<DeliveryOutcome> {
    if (this.busy) throw new Error("This worker already has an in-flight delivery");
    if (signal?.aborted) return { state: "idle" };
    this.busy = true;
    try {
      const claim = await this.store.claim();
      if (!claim) return { state: "idle" };
      if (claim.kind === "exhausted")
        return {
          state: "exhausted",
          id: claim.delivery.id,
          attempt: claim.delivery.attempts,
          error: "lease-expired",
        };
      return await this.deliver(claim.delivery, signal);
    } finally {
      this.busy = false;
    }
  }

  private async deliver(delivery: DeliveryLease, parent?: AbortSignal): Promise<DeliveryOutcome> {
    const identity = { id: delivery.id, attempt: delivery.attempts };
    const failed = async (code: DeliveryErrorCode, permanent = false): Promise<DeliveryOutcome> => {
      const saved = await this.store.fail(delivery, code, permanent);
      return {
        ...identity,
        state: !saved
          ? "lost-lease"
          : permanent || delivery.attempts >= delivery.policy.maxAttempts
            ? "exhausted"
            : "pending",
        error: code,
      };
    };
    const handler = this.handlers.get(`${delivery.type}@${delivery.version}`);
    if (!handler) return failed("unsupported-event", true);
    let payload: unknown;
    try {
      payload = handler.event.parse(delivery.payload);
    } catch {
      return failed("invalid-payload", true);
    }
    const deadline = new AbortController();
    const signal = parent ? AbortSignal.any([parent, deadline.signal]) : deadline.signal;
    const timer = setTimeout(() => deadline.abort(), delivery.policy.deadlineMs);
    timer.unref();
    try {
      signal.throwIfAborted();
      await handler.handle(payload, {
        ...identity,
        tenantId: delivery.tenantId,
        signal,
        effect: (work) =>
          this.store.effect(delivery, async (tx) => {
            signal.throwIfAborted();
            await work(tx);
            signal.throwIfAborted();
          }),
      });
      if (signal.aborted) return failed(parent?.aborted ? "cancelled" : "deadline-exceeded");
      const saved = await this.store.acknowledge(delivery);
      return { ...identity, state: saved ? "succeeded" : "lost-lease" };
    } catch (error) {
      if (signal.aborted) return failed(parent?.aborted ? "cancelled" : "deadline-exceeded");
      return failed(
        error instanceof PermanentDeliveryFailure ? "permanent-failure" : "handler-failed",
        error instanceof PermanentDeliveryFailure,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async run(signal: AbortSignal, observe?: (outcome: DeliveryOutcome) => void): Promise<void> {
    while (!signal.aborted) {
      const outcome = await this.once(signal);
      observe?.(outcome);
      if (outcome.state === "idle" && !signal.aborted) {
        try {
          await delay(this.store.policy.pollMs, undefined, { signal });
        } catch (error) {
          if (!signal.aborted) throw error;
        }
      }
    }
  }
}

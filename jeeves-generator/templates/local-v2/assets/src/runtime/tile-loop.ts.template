import { AsyncLocalStorage } from "node:async_hooks";
import { createConsumer, type BrokerBinding } from "./amqp.ts";
import {
  NonRetryable,
  type ConsumerHooks,
  type Delivery,
  type MessageHandler,
} from "./delivery.ts";
import type { ProcessScope } from "./process.ts";
import {
  createNotImplementedLog,
  createProcessLog,
  isNotImplemented,
  notImplementedWhat,
  type NotImplementedLog,
} from "./tile-process.ts";
import type { ModuleMessage } from "../modules/entry.ts";

/** The local broker's runtime login, as the template consumers use it. */
export const loopBroker: BrokerBinding = {
  hostname: "local-broker",
  port: 5672,
  username: "runtime",
  passwordSecret: "broker-password",
  heartbeatSeconds: 10,
  confirmTimeoutMs: 5000,
};

/** One loop: the module it calls, the queue it consumes, that queue's .failed and its bounds. */
export type ModuleLoop = {
  module: string;
  queue: string;
  failedQueue: string;
  retryLimit: number;
  concurrency: number;
};

/** A process's loop log: "Not implemented" lines, and one line per other failed message. Each is
 * at most once a second per module and hook (or queue), the next line counting what it held back. */
export type LoopLog = {
  notImplemented: NotImplementedLog;
  failed(entry: {
    module: string;
    queue: string;
    messageId?: string;
    attempt: number;
    error: string;
    action: string;
  }): void;
};
export function createLoopLog(tile: string): LoopLog {
  const failed = createProcessLog(tile, "error", "loop-error");
  return {
    notImplemented: createNotImplementedLog(tile),
    failed: (entry) => failed(`${entry.module}\u0000${entry.queue}`, entry),
  };
}

/** The wait before retry `attempt` (1 for the first retry): 250 ms doubling, at most 10 s. */
export function retryDelay(attempt: number): number {
  return Math.min(250 * 2 ** Math.max(0, attempt - 1), 10000);
}
/** Resolves after `ms`, or at once when `signal` aborts. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}
const describe = (error: unknown) =>
  (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300);
const messageId = (delivery: Delivery) =>
  delivery.messageId === undefined ? {} : { messageId: delivery.messageId };
/** What the delivery runner does with a failed message: retry it, or send it to .failed. */
function outcome(loop: Pick<ModuleLoop, "failedQueue" | "retryLimit">, error: unknown, delivery: Delivery) {
  const code =
    error instanceof NonRetryable
      ? error.code
      : delivery.deliveryCount > loop.retryLimit
        ? "RETRY_EXHAUSTED"
        : undefined;
  return code
    ? { retry: false, action: `sent to ${loop.failedQueue} (${code})` }
    : { retry: true, action: `retry ${delivery.deliveryCount} of ${loop.retryLimit}` };
}

/**
 * A module's handler (tile process contract, section 5): each message calls its entry point.
 * "Not implemented" is terminal at once (NOT_IMPLEMENTED: the message goes to .failed) with one
 * log line. Any other error is retried within the loop's limit after `retryDelay(attempt)`, then
 * ends in .failed as RETRY_EXHAUSTED; `stopping` cuts a wait short.
 */
export function moduleHandler(
  log: LoopLog,
  loop: ModuleLoop,
  entry: (message: ModuleMessage) => Promise<void>,
  stopping: AbortSignal,
): MessageHandler {
  return async (body, delivery) => {
    try {
      await entry({
        body,
        ...messageId(delivery),
        headers: delivery.headers,
        attempt: delivery.deliveryCount,
        source: loop.queue,
      });
    } catch (error) {
      if (isNotImplemented(error)) {
        log.notImplemented({
          module: loop.module,
          what: notImplementedWhat(error),
          queue: loop.queue,
          ...messageId(delivery),
          action: `sent to ${loop.failedQueue} (NOT_IMPLEMENTED)`,
        });
        throw new NonRetryable("NOT_IMPLEMENTED");
      }
      const next = outcome(loop, error, delivery);
      const delay = next.retry ? retryDelay(delivery.deliveryCount) : 0;
      log.failed({
        module: loop.module,
        queue: loop.queue,
        ...messageId(delivery),
        attempt: delivery.deliveryCount,
        error: describe(error),
        action: next.retry ? `${next.action} in ${delay} ms` : next.action,
      });
      if (next.retry) await wait(delay, stopping);
      throw error;
    }
  };
}

/**
 * Starts a module's loop on its queue: manual ack, prefetch equal to its concurrency, bounded
 * retry and `<queue>.failed`. Stopping cancels the subscription, cuts a retry wait short and
 * drains the message in hand. A lost broker connection fails the process; nothing else does.
 */
export async function startModuleLoop(
  scope: ProcessScope,
  log: LoopLog,
  loop: ModuleLoop,
  entry: (message: ModuleMessage) => Promise<void>,
  broker: BrokerBinding = loopBroker,
) {
  const stopping = new AbortController();
  const consumer = await createConsumer(broker, {
    queue: loop.queue,
    failedQueue: loop.failedQueue,
    concurrency: loop.concurrency,
    retryLimit: loop.retryLimit,
    handle: moduleHandler(log, loop, entry, stopping.signal),
    onFatal: scope.fail,
  });
  scope.own(() => {
    stopping.abort();
    return consumer.close();
  });
  scope.transport(consumer);
  return consumer;
}

/**
 * A mounted template's consumer on its loop row: the queue, `.failed`, concurrency and retry limit
 * the process config names, so each consuming module of a tile reads its own subscriber queue.
 */
export function loopConsumer(
  loop: Omit<ModuleLoop, "module">,
  handle: MessageHandler,
  hooks: ConsumerHooks = {},
  broker: BrokerBinding = loopBroker,
) {
  return createConsumer(broker, {
    ...hooks,
    queue: loop.queue,
    failedQueue: loop.failedQueue,
    concurrency: loop.concurrency,
    retryLimit: loop.retryLimit,
    handle,
  });
}

const reached = new AsyncLocalStorage<{ what?: string }>();
/**
 * A mounted template's hooks, unchanged except that a hook throwing "Not implemented" is noted
 * for the message it was reached for (or logged at once outside a message).
 */
export function watchHooks<T extends object>(hooks: T, log: LoopLog, module: string): T {
  const note = (error: unknown): never => {
    if (isNotImplemented(error)) {
      const store = reached.getStore();
      if (store) store.what ??= notImplementedWhat(error);
      else log.notImplemented({ module, what: notImplementedWhat(error), action: "thrown" });
    }
    throw error;
  };
  const wrap = (value: unknown): unknown => {
    if (typeof value === "function")
      return function (this: unknown, ...args: unknown[]) {
        try {
          const result: unknown = value.apply(this, args);
          return result instanceof Promise ? result.catch(note) : result;
        } catch (error) {
          return note(error);
        }
      };
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wrap(item)]));
    return value;
  };
  return wrap(hooks) as T;
}
/** A template's own terminal code (such as INVALID_MEDIA) is kept; MALFORMED_MESSAGE is the
 * generic answer to any codec or parse failure, including a codec that isn't written. */
const specific = (error: unknown) =>
  error instanceof NonRetryable && error.code !== "MALFORMED_MESSAGE";
/**
 * A mounted template's handler: the template decides what a failure does, with its own retry
 * limit and terminal codes. Each failed message logs one line, naming the hook it reached when
 * that hook is not implemented. A message that reached such a hook goes to .failed at once as
 * NOT_IMPLEMENTED, as a stub's does (a retry can't write it), unless the template gave a code of
 * its own.
 */
export function templateHandler(
  log: LoopLog,
  loop: Pick<ModuleLoop, "module" | "queue" | "failedQueue" | "retryLimit">,
  handle: MessageHandler,
): MessageHandler {
  return async (body, delivery) => {
    const store: { what?: string } = {};
    try {
      await reached.run(store, () => handle(body, delivery));
    } catch (error) {
      const next = outcome(loop, error, delivery);
      const unwritten = store.what !== undefined && !specific(error);
      if (store.what)
        log.notImplemented({
          module: loop.module,
          what: store.what,
          queue: loop.queue,
          ...messageId(delivery),
          action: unwritten ? `sent to ${loop.failedQueue} (NOT_IMPLEMENTED)` : next.action,
        });
      else
        log.failed({
          module: loop.module,
          queue: loop.queue,
          ...messageId(delivery),
          attempt: delivery.deliveryCount,
          error: describe(error),
          action: next.action,
        });
      throw unwritten ? new NonRetryable("NOT_IMPLEMENTED") : error;
    }
  };
}

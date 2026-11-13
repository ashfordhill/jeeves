import { NonRetryable, type MessageHandler } from "./delivery.ts";
import type { CounterEvent } from "./event-counter.ts";
import { transaction, type TransactionPool, type Tx } from "./transaction.ts";

export interface CounterConsumer {
  close(): Promise<void>;
  closed: Promise<{ fatal: boolean }>;
}
/** Factory owns the opened YV2-05 consumer. Caller owns the pool and ends it after close.
 * Bind actual queue/failed queue/concurrency/retry and terminal handling in openConsumer. */
export async function startCounterWorker(options: {
  pool: TransactionPool;
  counter: {
    parse(input: unknown, messageId?: string): CounterEvent;
    record(tx: Tx, event: CounterEvent): Promise<boolean>;
  };
  openConsumer(handle: MessageHandler): Promise<CounterConsumer>;
}) {
  const handle: MessageHandler = async (body, delivery) => {
    let event: CounterEvent;
    try {
      if (!delivery.messageId || body.byteLength > 65536) throw new Error("Invalid envelope");
      event = options.counter.parse(JSON.parse(body.toString("utf8")), delivery.messageId);
    } catch {
      throw new NonRetryable("MALFORMED_MESSAGE");
    }
    await transaction(options.pool, (tx) => options.counter.record(tx, event));
  };
  const consumer = await options.openConsumer(handle);
  let closing: Promise<void> | undefined;
  return {
    closed: consumer.closed,
    close(): Promise<void> {
      return (closing ??= consumer.close());
    },
  };
}

import { NonRetryable, type MessageHandler } from "./delivery.ts";
import { startRelay, type ConfirmedPublisher, type createOutbox } from "./outbox.ts";
import { transaction, type TransactionPool, type Tx } from "./transaction.ts";

export interface LifecycleConsumer {
  closed: Promise<{ fatal: boolean }>;
  close(): Promise<void>;
}
export interface LifecyclePublisher extends ConfirmedPublisher, LifecycleConsumer {}
export interface LifecycleWorkerRepository {
  parse(input: unknown, messageId?: string): unknown;
  apply(tx: Tx, input: unknown, messageId?: string): Promise<unknown>;
  sweep(tx: Tx): Promise<number>;
}
/** Installs no service/credentials. A compiled recipe opens the actual YV2-05 consumer and
 * optional confirmed publisher here. Worker owns those transports; caller owns the SQL pool.
 * Startup sweep and each 30-second sweep enforce fixed DB policy; close drains all work. */
export async function startAssetLifecycleWorker<Publication>(options: {
  pool: TransactionPool;
  lifecycle: LifecycleWorkerRepository;
  openConsumer(handle: MessageHandler): Promise<LifecycleConsumer>;
  publication?: {
    outbox: ReturnType<typeof createOutbox<Publication>>;
    openPublisher(): Promise<LifecyclePublisher>;
  };
  onSweepError?: (error: unknown) => void;
}) {
  let input: LifecycleConsumer | undefined, publisher: LifecyclePublisher | undefined;
  let relay: ReturnType<typeof startRelay<Publication>> | undefined;
  let stopped = false,
    fatal = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  let sweeping: Promise<unknown> = Promise.resolve(),
    closing: Promise<void> | undefined;
  let finish!: (result: { fatal: boolean }) => void;
  const closed = new Promise<{ fatal: boolean }>((resolve) => {
    finish = resolve;
  });
  function close(): Promise<void> {
    if (closing) return closing;
    stopped = true;
    clearTimeout(timer);
    return (closing = (async () => {
      // Attempt every owned drain even when one close rejects; caller still owns the pool.
      for (const drain of [
        () => input?.close(),
        () => sweeping,
        () => relay?.close(),
        () => publisher?.close(),
      ]) {
        try {
          await drain();
        } catch {
          fatal = true;
        }
      }
      finish({ fatal });
    })());
  }
  function notify(error: unknown) {
    try {
      options.onSweepError?.(error);
    } catch {
      /* Drain continues. */
    }
  }
  function tick() {
    sweeping = transaction(options.pool, (tx) => options.lifecycle.sweep(tx))
      .catch(notify)
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, 30000);
      });
  }
  const handle: MessageHandler = async (body, delivery) => {
    let event: unknown;
    try {
      if (!delivery.messageId || body.byteLength > 65536) throw new Error("Invalid envelope");
      event = JSON.parse(body.toString("utf8"));
      options.lifecycle.parse(event, delivery.messageId);
    } catch {
      throw new NonRetryable("MALFORMED_MESSAGE");
    }
    await transaction(options.pool, (tx) => options.lifecycle.apply(tx, event, delivery.messageId));
  };
  try {
    await transaction(options.pool, (tx) => options.lifecycle.sweep(tx));
    if (options.publication) {
      publisher = await options.publication.openPublisher();
      relay = startRelay(options.publication.outbox, options.pool, publisher, {
        onError: notify,
      });
    }
    input = await options.openConsumer(handle);
    timer = setTimeout(tick, 30000);
    void Promise.race([input.closed, ...(publisher ? [publisher.closed] : [])]).then((result) => {
      fatal ||= result.fatal;
      void close();
    });
    return { close, closed };
  } catch (error) {
    fatal = true;
    await close();
    throw error;
  }
}

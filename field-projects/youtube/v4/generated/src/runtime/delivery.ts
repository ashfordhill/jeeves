export interface Delivery {
  messageId: string | undefined;
  headers: Record<string, unknown>;
  deliveryCount: number;
  redelivered: boolean;
}
export type MessageHandler = (body: Buffer, delivery: Delivery) => Promise<void>;
export class NonRetryable extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(code)) throw new Error("Invalid terminal code");
    this.code = code;
  }
}
export interface ConsumerHooks {
  onTerminal?: (body: Buffer, delivery: Delivery, error: unknown) => Promise<void>;
  /** Notification only; do not await close from a handler or terminal hook in its own drain. */
  onFatal?: (error: unknown) => void;
}
export interface DeliveryMessage<Receipt> {
  body: Buffer;
  messageId?: string;
  headers: Record<string, unknown>;
  redelivered: boolean;
  receipt: Receipt;
}
export interface DeliveryTransport<Receipt> {
  cancel(): Promise<void>;
  /** Must resolve only after the destination broker confirms persistence. */
  republish(
    destination: string,
    message: DeliveryMessage<Receipt>,
    headers: Record<string, unknown>,
  ): Promise<void>;
  ack(receipt: Receipt): void;
  /** Close channel before connection, after cancellation and admitted work. */
  close(): Promise<void>;
}

/** Durable effects remain the handler's responsibility. This provides at-least-once
 * delivery, bounded retry and drain on one channel; `createConsumer` reconnects with a new
 * runner. It makes no exactly-once promise. */
export interface DeliveryBinding {
  queue: string;
  failedQueue: string;
  retryLimit: number;
}
export function validateDeliveryBinding(options: DeliveryBinding): void {
  if (
    !options.queue ||
    !options.failedQueue ||
    options.queue === options.failedQueue ||
    !Number.isSafeInteger(options.retryLimit) ||
    options.retryLimit < 0 ||
    options.retryLimit > 10000
  )
    throw new Error("Invalid delivery binding");
}
export function createDeliveryRunner<Receipt>(
  options: ConsumerHooks &
    DeliveryBinding & {
      handle: MessageHandler;
      transport: DeliveryTransport<Receipt>;
    },
) {
  validateDeliveryBinding(options);
  let closing = false;
  let fatalClosure = false;
  let shutdown: Promise<void> | undefined;
  const inFlight = new Set<Promise<void>>();
  let finishClosed!: (result: { fatal: boolean }) => void;
  const closed = new Promise<{ fatal: boolean }>((resolve) => {
    finishClosed = resolve;
  });
  function fatal(error: unknown) {
    if (!fatalClosure) {
      fatalClosure = true;
      try {
        options.onFatal?.(error);
      } catch {
        /* Notification cannot interrupt the drain. */
      }
    }
    // Never await here: the initiating delivery is itself included in the drain.
    void close();
  }
  function close(): Promise<void> {
    if (shutdown) return shutdown;
    closing = true;
    return (shutdown = (async () => {
      await options.transport.cancel().catch(() => {});
      await Promise.allSettled([...inFlight]);
      await options.transport.close().catch(() => {});
      finishClosed({ fatal: fatalClosure });
    })());
  }
  return {
    closed,
    close,
    fatal,
    accept(message: DeliveryMessage<Receipt>) {
      if (closing) return; // Unacked deliveries return to the broker when the channel closes.
      const task = Promise.resolve().then(async () => {
        const headers = { ...message.headers };
        const raw = headers["x-delivery-attempt"] ?? 0;
        const attempts =
          typeof raw === "number" &&
          Number.isSafeInteger(raw) &&
          raw >= 0 &&
          raw <= options.retryLimit
            ? raw
            : options.retryLimit;
        const delivery: Delivery = {
          messageId: message.messageId,
          headers,
          deliveryCount: attempts + 1,
          redelivered: message.redelivered,
        };
        try {
          await options.handle(message.body, delivery);
          if (!fatalClosure) options.transport.ack(message.receipt);
        } catch (error) {
          if (fatalClosure) return;
          const terminal = error instanceof NonRetryable || attempts >= options.retryLimit;
          try {
            if (terminal) await options.onTerminal?.(message.body, delivery, error);
            if (fatalClosure) return;
            await options.transport.republish(
              terminal ? options.failedQueue : options.queue,
              message,
              {
                ...headers,
                "x-delivery-attempt": attempts + 1,
                ...(terminal
                  ? {
                      "x-terminal-code":
                        error instanceof NonRetryable ? error.code : "RETRY_EXHAUSTED",
                    }
                  : {}),
              },
            );
            if (!fatalClosure) options.transport.ack(message.receipt);
          } catch (failure) {
            fatal(failure);
          }
        }
      });
      inFlight.add(task);
      void task.finally(() => inFlight.delete(task)).catch(fatal);
    },
  };
}

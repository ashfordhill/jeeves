import amqp from "amqplib";
import { secret } from "./env.ts";
async function confirmed(send: (done: (error?: Error | null) => void) => unknown) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AMQP confirm deadline")), 5000);
    try {
      send((error) => {
        clearTimeout(timer);
        error ? reject(error) : resolve();
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}
export async function broker() {
  const connection = await amqp.connect({
    hostname: process.env.BROKER_HOST ?? "broker",
    port: Number(process.env.BROKER_PORT ?? 5672),
    username: "youtube",
    password: secret("broker_password"),
    heartbeat: 15,
  });
  connection.on("error", () => console.error("AMQP connection unavailable"));
  return connection;
}
export async function publisher(exchange: string, routingKey: string) {
  const connection = await broker(),
    channel = await connection.createConfirmChannel();
  channel.on("error", () => console.error("AMQP publisher channel unavailable"));
  let closing = false;
  let finishClosed!: (result: { fatal: boolean }) => void;
  const closed = new Promise<{ fatal: boolean }>((resolve) => {
    finishClosed = resolve;
  });
  const lost = () => {
    if (!closing) finishClosed({ fatal: true });
  };
  channel.once("close", lost);
  connection.once("close", lost);
  return {
    connection,
    channel,
    closed,
    async publish(body: Uint8Array, messageId: string) {
      await confirmed((done) =>
        channel.publish(
          exchange,
          routingKey,
          Buffer.from(body),
          { persistent: true, messageId, contentType: "application/json" },
          done,
        ),
      );
    },
    async close() {
      closing = true;
      await channel.close().catch(() => {});
      await connection.close().catch(() => {});
      finishClosed({ fatal: false });
    },
  };
}
export interface Delivery {
  messageId: string | undefined;
  headers: Record<string, unknown>;
  deliveryCount: number;
  redelivered: boolean;
}
export class NonRetryable extends Error {
  constructor(readonly code: "INVALID_MEDIA" | "MALFORMED_MESSAGE") {
    super(code);
  }
}
export interface ConsumerOptions {
  onTerminal?: (body: Buffer, delivery: Delivery, error: unknown) => Promise<void>;
  onFatal?: () => void;
}
export type MessageHandler = (body: Buffer, delivery: Delivery) => Promise<void>;
export async function consume(
  queue: string,
  concurrency: number,
  retryLimit: number,
  handle: MessageHandler,
  options: ConsumerOptions = {},
) {
  const connection = await broker(),
    channel = await connection.createConfirmChannel();
  let closing = false;
  let fatalClosure = false;
  let shutdown: Promise<void> | undefined;
  let consumerTag: string | undefined;
  let onSignal: () => void = () => {};
  let finishClosed!: (result: { fatal: boolean }) => void;
  const closed = new Promise<{ fatal: boolean }>((resolve) => {
    finishClosed = resolve;
  });
  const removeSignals = () => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.removeListener(signal, onSignal);
  };
  const inFlight = new Set<Promise<void>>();
  channel.on("error", () => console.error("AMQP consumer channel unavailable"));
  await channel.prefetch(concurrency, false);
  // Initiate fatal closure without awaiting from an admitted task: that task is
  // itself part of the drain. closed resolves only after all admitted work settles.
  const fatal = () => {
    fatalClosure = true;
    process.exitCode = 1;
    options.onFatal?.();
    void close();
  };
  channel.once("close", () => {
    if (!closing) void fatal();
  });
  connection.once("close", () => {
    if (!closing) void fatal();
  });
  const consumer = await channel.consume(
    queue,
    (message) => {
      if (!message) {
        fatal();
        return;
      }
      if (closing) return;
      const task = (async () => {
        const headers = message.properties.headers ?? {},
          raw = headers["x-delivery-attempt"] ?? headers["x-scaffold-attempt"] ?? 0,
          attempts =
            typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? raw : retryLimit;
        const delivery: Delivery = {
          messageId: message.properties.messageId,
          headers,
          deliveryCount: attempts + 1,
          redelivered: message.fields.redelivered,
        };
        try {
          await handle(message.content, delivery);
          if (!fatalClosure) channel.ack(message);
        } catch (error) {
          if (fatalClosure) return;
          const terminal = error instanceof NonRetryable || attempts >= retryLimit,
            destination = terminal ? `${queue}.failed` : queue;
          try {
            if (terminal) await options.onTerminal?.(message.content, delivery, error);
            await confirmed((done) =>
              channel.sendToQueue(
                destination,
                message.content,
                {
                  ...message.properties,
                  persistent: true,
                  headers: {
                    ...headers,
                    "x-delivery-attempt": attempts + 1,
                    ...(terminal
                      ? {
                          "x-terminal-code":
                            error instanceof NonRetryable ? error.code : "RETRY_EXHAUSTED",
                        }
                      : {}),
                  },
                },
                done,
              ),
            );
            if (!fatalClosure) channel.ack(message);
            console.error(`AMQP delivery deferred to ${destination}`);
          } catch {
            fatal();
          }
        }
      })();
      inFlight.add(task);
      void task.finally(() => inFlight.delete(task)).catch(() => fatal());
    },
    { noAck: false },
  );
  consumerTag = consumer.consumerTag;
  function close() {
    if (shutdown) return shutdown;
    closing = true;
    shutdown = (async () => {
      if (consumerTag) await channel.cancel(consumerTag).catch(() => {});
      await Promise.allSettled([...inFlight]);
      await channel.close().catch(() => {});
      await connection.close().catch(() => {});
      removeSignals();
      finishClosed({ fatal: fatalClosure });
    })();
    return shutdown;
  }
  onSignal = () => {
    void close().catch(() => fatal());
  };
  for (const s of ["SIGINT", "SIGTERM"] as const) process.once(s, onSignal);
  return { connection, channel, close, closed };
}

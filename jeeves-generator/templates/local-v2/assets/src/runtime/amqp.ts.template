import amqp, { type ConsumeMessage } from "amqplib";
import { readSecret } from "./local.ts";
import {
  createDeliveryRunner,
  validateDeliveryBinding,
  type ConsumerHooks,
  type MessageHandler,
} from "./delivery.ts";
export {
  NonRetryable,
  type Delivery,
  type MessageHandler,
  type ConsumerHooks,
} from "./delivery.ts";

export interface BrokerBinding {
  hostname: string;
  port: number;
  username: string;
  passwordSecret: string;
  heartbeatSeconds: number;
  confirmTimeoutMs: number;
  credential?: (secret: string) => string;
}
async function broker(binding: BrokerBinding) {
  if (
    !Number.isSafeInteger(binding.confirmTimeoutMs) ||
    binding.confirmTimeoutMs < 1 ||
    !Number.isSafeInteger(binding.heartbeatSeconds) ||
    binding.heartbeatSeconds < 1
  )
    throw new Error("Invalid broker limits");
  const connection = await amqp.connect({
    hostname: binding.hostname,
    port: binding.port,
    username: binding.username,
    password: (binding.credential ?? readSecret)(binding.passwordSecret),
    heartbeat: binding.heartbeatSeconds,
  });
  // Consume emitter errors; channel/connection close initiates the fatal hook and drain.
  connection.on("error", () => {});
  return connection;
}
async function confirmed(
  timeoutMs: number,
  send: (done: (error?: Error | null) => void) => unknown,
) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AMQP confirm deadline")), timeoutMs);
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
export async function createPublisher(
  binding: BrokerBinding,
  destination: { exchange: string; routingKey: string },
  hooks: Pick<ConsumerHooks, "onFatal"> = {},
) {
  const connection = await broker(binding);
  const channel = await connection.createConfirmChannel().catch(async (error) => {
    await connection.close().catch(() => {});
    throw error;
  });
  channel.on("error", () => {});
  let closing = false;
  let fatalClosure = false;
  let shutdown: Promise<void> | undefined;
  const pending = new Set<Promise<void>>();
  let finishClosed!: (result: { fatal: boolean }) => void;
  const closed = new Promise<{ fatal: boolean }>((resolve) => {
    finishClosed = resolve;
  });
  function close(): Promise<void> {
    if (shutdown) return shutdown;
    closing = true;
    return (shutdown = (async () => {
      await Promise.allSettled([...pending]);
      await channel.close().catch(() => {});
      await connection.close().catch(() => {});
      finishClosed({ fatal: fatalClosure });
    })());
  }
  const lost = () => {
    if (closing) return;
    fatalClosure = true;
    try {
      hooks.onFatal?.(new Error("AMQP publisher unavailable"));
    } catch {
      /* Drain still runs. */
    }
    void close();
  };
  channel.once("close", lost);
  connection.once("close", lost);
  return {
    closed,
    close,
    async publish(body: Uint8Array, messageId: string): Promise<void> {
      if (closing) throw new Error("AMQP publisher is draining");
      const work = confirmed(binding.confirmTimeoutMs, (done) =>
        channel.publish(
          destination.exchange,
          destination.routingKey,
          Buffer.from(body),
          { persistent: true, messageId, contentType: "application/json" },
          done,
        ),
      );
      pending.add(work);
      try {
        await work;
      } finally {
        pending.delete(work);
      }
    },
  };
}

export async function createConsumer(
  binding: BrokerBinding,
  options: ConsumerHooks & {
    queue: string;
    failedQueue: string;
    concurrency: number;
    retryLimit: number;
    handle: MessageHandler;
  },
) {
  validateDeliveryBinding(options);
  if (
    !Number.isSafeInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 100000
  )
    throw new Error("Invalid consumer concurrency");
  const connection = await broker(binding);
  const channel = await connection.createConfirmChannel().catch(async (error) => {
    await connection.close().catch(() => {});
    throw error;
  });
  channel.on("error", () => {});
  let consumerTag: string | undefined;
  let subscribed!: () => void;
  const subscription = new Promise<void>((resolve) => {
    subscribed = resolve;
  });
  const runner = createDeliveryRunner<ConsumeMessage>({
    ...options,
    transport: {
      async cancel() {
        await subscription;
        if (consumerTag) await channel.cancel(consumerTag);
      },
      republish(destination, message, headers) {
        return confirmed(binding.confirmTimeoutMs, (done) =>
          channel.sendToQueue(
            destination,
            message.body,
            { ...message.receipt.properties, persistent: true, headers },
            done,
          ),
        );
      },
      ack(message) {
        channel.ack(message);
      },
      async close() {
        await channel.close().catch(() => {});
        await connection.close().catch(() => {});
      },
    },
  });
  // A normal local close emits these too; runner.close is already idempotent and must not
  // mark a normal close fatal. Remove listeners just before the intentional transport close.
  const lost = () => {
    runner.fatal(new Error("AMQP consumer unavailable"));
  };
  channel.once("close", lost);
  connection.once("close", lost);
  const originalClose = runner.close;
  const close = () => {
    channel.removeListener("close", lost);
    connection.removeListener("close", lost);
    return originalClose();
  };
  try {
    await channel.prefetch(options.concurrency, false);
    const consumer = await channel.consume(
      options.queue,
      (message) => {
        if (!message) {
          runner.fatal(new Error("AMQP subscription cancelled"));
          return;
        }
        runner.accept({
          body: message.content,
          messageId: message.properties.messageId,
          headers: message.properties.headers ?? {},
          redelivered: message.fields.redelivered,
          receipt: message,
        });
      },
      { noAck: false },
    );
    consumerTag = consumer.consumerTag;
    subscribed();
    return { close, closed: runner.closed };
  } catch (error) {
    subscribed();
    runner.fatal(error);
    await close();
    throw error;
  }
}

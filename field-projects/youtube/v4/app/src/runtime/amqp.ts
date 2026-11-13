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
/** Told when a broker client's connection changes: `available` once a generation is open
 * (startup reports it once), `unavailable` with the error once that generation is lost. */
export type BrokerState = (state: "available" | "unavailable", error?: unknown) => void;
/** The wait after a lost generation, and between failed attempts to open the next one. */
const reconnectMs = 5000;

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
  // Consume emitter errors; a channel or connection close loses that generation.
  connection.on("error", () => {});
  return connection;
}
type Connection = Awaited<ReturnType<typeof broker>>;
type Channel = Awaited<ReturnType<Connection["createConfirmChannel"]>>;
/** Opens one connection and its confirm channel; a channel that fails to open closes the
 * connection. `cause` is the first error either emitted, which comes before their `close`. */
async function confirmChannel(binding: BrokerBinding) {
  const connection = await broker(binding);
  const channel = await connection.createConfirmChannel().catch(async (error) => {
    await quietly(connection);
    throw error;
  });
  let first: unknown;
  const failed = (error: unknown) => {
    first ??= error;
  };
  connection.on("error", failed);
  channel.on("error", failed);
  return { connection, channel, cause: () => first };
}
/** Closes a channel or connection that may be closed already; never throws. */
async function quietly(target: { close(): Promise<void> }) {
  try {
    await target.close();
  } catch {
    /* Already closed. */
  }
}
/** A state hook called only when the state changes; a hook that throws changes nothing. */
function stateReport(onState?: BrokerState) {
  let reported: "available" | "unavailable" | undefined;
  return (state: "available" | "unavailable", error?: unknown) => {
    if (state === reported) return;
    reported = state;
    try {
      onState?.(state, error);
    } catch {
      /* The client goes on as it would without the report. */
    }
  };
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

/**
 * A confirmed publisher on one connection generation at a time. A lost connection or channel is
 * reported and a new generation opens 5 s later, again every 5 s until one opens; meanwhile
 * `publish` rejects at once. A first connect that fails rejects. `closed` resolves only after
 * `close()`.
 */
export async function createPublisher(
  binding: BrokerBinding,
  destination: { exchange: string; routingKey: string },
  hooks: { onState?: BrokerState } = {},
) {
  type Generation = { connection: Connection; channel: Channel; lost: boolean };
  const report = stateReport(hooks.onState);
  let current: Generation | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closing = false;
  let shutdown: Promise<void> | undefined;
  const pending = new Set<Promise<void>>();
  let finishClosed!: (result: { fatal: boolean }) => void;
  const closed = new Promise<{ fatal: boolean }>((resolve) => {
    finishClosed = resolve;
  });
  const end = async (generation: Generation) => {
    await quietly(generation.channel);
    await quietly(generation.connection);
  };
  // Events of a generation that is no longer current, or after close(), change nothing.
  function lose(generation: Generation, error: unknown) {
    if (closing || generation.lost) return;
    generation.lost = true;
    if (generation !== current) return;
    current = undefined;
    report("unavailable", error);
    void end(generation);
    later();
  }
  async function open(): Promise<Generation> {
    const { connection, channel, cause } = await confirmChannel(binding);
    const generation: Generation = { connection, channel, lost: false };
    const lost = (error?: unknown) =>
      lose(generation, error ?? cause() ?? new Error("AMQP publisher unavailable"));
    channel.once("close", lost);
    connection.once("close", lost);
    return generation;
  }
  function later() {
    if (closing || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      void reconnect();
    }, reconnectMs);
  }
  async function reconnect() {
    if (closing) return;
    let generation: Generation;
    try {
      generation = await open();
    } catch {
      later();
      return;
    }
    // Closed while it opened: it is closed as soon as it opens.
    if (closing) return void end(generation);
    current = generation;
    report("available");
  }
  function close(): Promise<void> {
    if (shutdown) return shutdown;
    closing = true;
    clearTimeout(retry);
    retry = undefined;
    return (shutdown = (async () => {
      await Promise.allSettled([...pending]);
      const generation = current;
      current = undefined;
      if (generation) await end(generation);
      finishClosed({ fatal: false });
    })());
  }
  current = await open();
  report("available");
  return {
    closed,
    close,
    async publish(body: Uint8Array, messageId: string): Promise<void> {
      if (closing) throw new Error("AMQP publisher is draining");
      const generation = current;
      if (!generation) throw new Error("Broker unavailable");
      const work = confirmed(binding.confirmTimeoutMs, (done) =>
        generation.channel.publish(
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

/**
 * A consumer on one connection generation at a time: a connection, a confirm channel with its
 * prefetch, one subscription and its own delivery runner. A lost connection or channel, a
 * cancelled subscription or a failed republish or ack is reported, and its runner stops
 * acknowledging and drains the deliveries in hand (their messages return to the queue). The next
 * generation opens 5 s later and only after that drain, again every 5 s until one opens. A first
 * connect that fails rejects. `onFatal` is not called; `closed` resolves only after `close()`.
 */
export async function createConsumer(
  binding: BrokerBinding,
  options: ConsumerHooks & {
    queue: string;
    failedQueue: string;
    concurrency: number;
    retryLimit: number;
    handle: MessageHandler;
    onState?: BrokerState;
  },
) {
  validateDeliveryBinding(options);
  if (
    !Number.isSafeInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 100000
  )
    throw new Error("Invalid consumer concurrency");
  type Generation = {
    runner: ReturnType<typeof createDeliveryRunner<ConsumeMessage>>;
    lost: boolean;
  };
  const report = stateReport(options.onState);
  let current: Generation | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closing = false;
  let shutdown: Promise<void> | undefined;
  // The lost generation's drain: the next one opens only after it, so the deliveries in hand
  // never exceed the concurrency.
  let draining: Promise<unknown> = Promise.resolve();
  let finishClosed!: (result: { fatal: boolean }) => void;
  const closed = new Promise<{ fatal: boolean }>((resolve) => {
    finishClosed = resolve;
  });
  // A generation lost while it opens fails that attempt; events after close() change nothing.
  function lose(generation: Generation, error: unknown) {
    if (closing || generation.lost) return;
    generation.lost = true;
    generation.runner.fatal(error);
    if (generation !== current) return;
    current = undefined;
    report("unavailable", error);
    draining = generation.runner.closed;
    later();
  }
  async function open(): Promise<Generation> {
    const { connection, channel, cause } = await confirmChannel(binding);
    let consumerTag: string | undefined;
    let subscribed!: () => void;
    const subscription = new Promise<void>((resolve) => {
      subscribed = resolve;
    });
    const generation: Generation = {
      lost: false,
      runner: createDeliveryRunner<ConsumeMessage>({
        queue: options.queue,
        failedQueue: options.failedQueue,
        retryLimit: options.retryLimit,
        handle: options.handle,
        onTerminal: options.onTerminal,
        // A failed republish or ack loses this generation, not the consumer.
        onFatal: (error) => lose(generation, error),
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
            await quietly(channel);
            await quietly(connection);
          },
        },
      }),
    };
    const lost = (error?: unknown) =>
      lose(generation, error ?? cause() ?? new Error("AMQP consumer unavailable"));
    channel.once("close", lost);
    connection.once("close", lost);
    try {
      if (closing) throw new Error("AMQP consumer is closing");
      await channel.prefetch(options.concurrency, false);
      const consumer = await channel.consume(
        options.queue,
        (message) => {
          if (!message) {
            lose(generation, new Error("AMQP subscription cancelled"));
            return;
          }
          generation.runner.accept({
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
      if (generation.lost) throw new Error("AMQP consumer unavailable");
      return generation;
    } catch (error) {
      generation.lost = true;
      // Its drain acknowledges nothing, then closes the channel and the connection.
      generation.runner.fatal(error);
      throw error;
    } finally {
      subscribed();
      if (generation.lost) await generation.runner.closed;
    }
  }
  function later() {
    if (closing || retry) return;
    const drained = draining;
    retry = setTimeout(() => {
      retry = undefined;
      void drained.then(reconnect);
    }, reconnectMs);
  }
  async function reconnect() {
    if (closing) return;
    let generation: Generation;
    try {
      generation = await open();
    } catch {
      later();
      return;
    }
    // Closed while it opened: cancel, drain and close it at once.
    if (closing) return void generation.runner.close();
    current = generation;
    report("available");
  }
  function close(): Promise<void> {
    if (shutdown) return shutdown;
    closing = true;
    clearTimeout(retry);
    retry = undefined;
    return (shutdown = (async () => {
      const generation = current;
      current = undefined;
      // Cancel, drain, then close the channel and the connection; during an outage, the lost
      // generation's drain.
      if (generation) await generation.runner.close();
      await draining;
      finishClosed({ fatal: false });
    })());
  }
  current = await open();
  report("available");
  return { close, closed };
}

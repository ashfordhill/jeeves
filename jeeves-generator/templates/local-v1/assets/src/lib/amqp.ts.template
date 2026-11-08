import amqp from "amqplib";
import { secret } from "./env.ts";
export async function broker() {
  return amqp.connect({
    hostname: "broker",
    username: "youtube",
    password: secret("broker_password"),
    heartbeat: 15,
  });
}
export async function publisher(exchange: string, routingKey: string) {
  const connection = await broker();
  const channel = await connection.createConfirmChannel();
  return {
    connection,
    channel,
    async publish(body: Uint8Array, messageId: string) {
      await new Promise<void>((resolve, reject) => {
        channel.publish(
          exchange,
          routingKey,
          Buffer.from(body),
          { persistent: true, messageId },
          (error) => (error ? reject(error) : resolve()),
        );
      });
    },
  };
}
export async function consume(
  queue: string,
  concurrency: number,
  retryLimit: number,
  handle: (body: Buffer) => Promise<void>,
) {
  const connection = await broker();
  const channel = await connection.createConfirmChannel();
  // One consumer per channel; per-consumer prefetch bounds concurrent unacknowledged callbacks.
  await channel.prefetch(concurrency, false);
  await channel.consume(
    queue,
    async (message) => {
      if (!message) return;
      try {
        await handle(message.content);
        channel.ack(message);
      } catch {
        const attempts = Number(message.properties.headers?.["x-scaffold-attempt"] ?? 0);
        const destination = attempts < retryLimit ? queue : `${queue}.failed`;
        // Confirm the copy before ack; crashes may duplicate. G03 must deduplicate side effects.
        try {
          await new Promise<void>((resolve, reject) => {
            channel.sendToQueue(
              destination,
              message.content,
              {
                ...message.properties,
                persistent: true,
                headers: { ...message.properties.headers, "x-scaffold-attempt": attempts + 1 },
              },
              (error) => (error ? reject(error) : resolve()),
            );
          });
          channel.ack(message);
          console.error(`Handler failed; message moved to ${destination}`);
        } catch {
          await channel.close();
          await connection.close();
          process.exitCode = 1;
        }
      }
    },
    { noAck: false },
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void connection.close();
    });
  return connection;
}

import { readdirSync, readFileSync } from "node:fs";
import amqp from "amqplib";

const connection = await amqp.connect({
  hostname: "broker",
  username: "youtube",
  password: readFileSync("/run/secrets/broker_password", "utf8").trim(),
});
const channel = await connection.createChannel();
// Upgrade existing installations: asserting new bindings does not remove old fanout.
// RabbitMQ queue.unbind is idempotent when the exchange exists.
await channel.assertExchange("completion-events", "fanout", { durable: true });
await channel.assertQueue("search-indexer", { durable: true });
await channel.assertQueue("completion-handler", { durable: true });
for (const queue of ["search-indexer", "completion-handler"])
  await channel.unbindQueue(queue, "completion-events", "");
await channel.assertExchange("processing-events", "fanout", { durable: true });
await channel.unbindQueue("search-indexer", "processing-events", "");
for (const file of readdirSync("infra/broker").sort()) {
  const resource = JSON.parse(readFileSync(`infra/broker/${file}`, "utf8"));
  if (resource.exchange)
    await channel.assertExchange(resource.exchange, "fanout", { durable: true });
  for (const queue of resource.queues) {
    await channel.assertQueue(queue, { durable: true });
    await channel.assertQueue(`${queue}.failed`, { durable: true });
    if (resource.exchange) await channel.bindQueue(queue, resource.exchange, "");
  }
}
await connection.close();
console.log(
  "Durable processing→lifecycle, publication→indexer and view→counter topology asserted; obsolete completion/indexer bindings removed.",
);

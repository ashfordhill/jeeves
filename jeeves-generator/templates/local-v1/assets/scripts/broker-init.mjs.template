import { readdirSync, readFileSync } from "node:fs";
import amqp from "amqplib";

const connection = await amqp.connect({
  hostname: "broker",
  username: "youtube",
  password: readFileSync("/run/secrets/broker_password", "utf8").trim(),
});
const channel = await connection.createChannel();
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
  "Durable queues/fanout subscriptions configured; no application message schemas or side effects supplied.",
);

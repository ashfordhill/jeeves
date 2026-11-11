import amqp from "amqplib";
import { plan, secret } from "./common.mjs";

const connection = await amqp.connect({
  hostname: "local-broker",
  username: "runtime",
  password: secret("broker-password"),
});
try {
  const channel = await connection.createChannel();
  for (const binding of plan.broker) {
    if (binding.exchange)
      await channel.assertExchange(binding.exchange, "fanout", { durable: true });
    for (const queue of binding.queues) {
      await channel.assertQueue(queue, { durable: true });
      await channel.assertQueue(`${queue}.failed`, { durable: true });
      if (binding.exchange) await channel.bindQueue(queue, binding.exchange, "");
    }
  }
} finally {
  await connection.close();
}
console.log("Selected durable broker declarations asserted without reset.");

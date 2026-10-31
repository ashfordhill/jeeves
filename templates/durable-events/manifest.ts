import { defineTemplate, deliveryConfigSchema } from "@jeeves/spec";
export default defineTemplate({
  id: "durable-events",
  version: "0.1.0",
  kind: "attachment",
  displayName: "Durable events",
  description:
    "Transactional outbox, fenced retries and database effects. One worker in this service process; domain handlers are project work.",
  config: deliveryConfigSchema,
  ports: [],
  card: { icon: "repeat", chips: ["preset"] },
});

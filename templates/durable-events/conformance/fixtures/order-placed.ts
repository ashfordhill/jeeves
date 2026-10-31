import { defineHandler } from "@jeeves/durable-events";
import { events } from "../delivery/contracts.ts";
export default defineHandler(events["order-placed"], async (payload, context) => {
  await context.effect(async (tx) => {
    await tx.query(
      "INSERT INTO inventory_reservations (delivery_id, tenant_id, order_id, quantity) VALUES ($1,$2,$3,$4)",
      [context.id, context.tenantId, payload.orderId, payload.quantity],
    );
  });
});

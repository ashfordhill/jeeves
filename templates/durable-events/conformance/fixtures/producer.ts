// Disposable proof only. Real producers establish tenant identity through authentication.
import { defineFeature, z } from "@jeeves/service-runtime";
import { database, delivery } from "../../jeeves.generated.ts";
export default defineFeature({
  name: "proof",
  async start() {
    await database.pool.query(
      "CREATE TABLE IF NOT EXISTS inventory_reservations (delivery_id uuid PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL, quantity integer NOT NULL)",
    );
  },
  register(app) {
    app.post("/proof/orders", async (request, reply) => {
      const parsed = z
        .strictObject({ key: z.string(), orderId: z.string(), quantity: z.int() })
        .parse(request.body);
      const { id } = await delivery.transaction("fixture-tenant", (tx) =>
        tx.emit("order-placed", parsed.key, { orderId: parsed.orderId, quantity: parsed.quantity }),
      );
      return reply.code(202).send({ id });
    });
    app.get<{ Params: { id: string } }>("/proof/events/:id", async (request, reply) => {
      const status = await delivery.status("fixture-tenant", request.params.id);
      if (!status) return reply.code(404).send({ error: "not found" });
      const effect = await database.pool.query(
        "SELECT tenant_id,order_id,quantity FROM inventory_reservations WHERE delivery_id=$1",
        [request.params.id],
      );
      return { status, reservations: effect.rows };
    });
  },
});

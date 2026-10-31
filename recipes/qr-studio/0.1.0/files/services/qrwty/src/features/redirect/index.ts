import { withTransaction } from "@jeeves/postgres-runtime";
import { defineFeature } from "@jeeves/service-runtime";
import qr from "../../generated/resources/qr.ts";
import scan from "../../generated/resources/scan.ts";
import { database } from "../../jeeves.generated.ts";

// Acceptance: QR-03, QR-04, QR-07
const destinationColumn = qr.fields.find((field) => field.name === "destination")!.column;
const qrColumn = scan.belongsTo.find((relation) => relation.resource === qr.id)!.column;

export default defineFeature({
  name: "redirect",
  operations: {
    followQr: async (request) => {
      const id = String(request.params.id);
      const {
        rows: [row],
      } = await database.pool.query<{ destination: string }>(
        `SELECT "${destinationColumn}" AS "destination" FROM "${qr.table}" WHERE "id" = $1`,
        [id],
      );
      if (!row) {
        return { status: 404, body: { error: "NOT_FOUND", message: "No such QR" } };
      }

      // Fastify also dispatches HEAD to this handler; only GET records a scan.
      if (request.request.method !== "HEAD") {
        await withTransaction(database.pool, async (client) => {
          await client.query(
            `INSERT INTO "${scan.table}" ("id", "${qrColumn}") VALUES (gen_random_uuid(), $1)`,
            [id],
          );
        });
      }

      return {
        status: 302,
        headers: { location: row.destination, "cache-control": "no-store" },
      };
    },
  },
});

import { sessionPrincipal } from "@jeeves/rest-server";
import { defineFeature } from "@jeeves/service-runtime";
import qr from "../../generated/resources/qr.ts";
import scan from "../../generated/resources/scan.ts";
import { database } from "../../jeeves.generated.ts";

const dayMs = 86_400_000;
const occurredAt = scan.fields.find((field) => field.name === "occurredAt")!.column;
const qrId = scan.belongsTo.find((relation) => relation.resource === qr.id)!.column;

function utcDate(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

// Acceptance: QR-05, QR-06
export default defineFeature({
  name: "activity",
  operations: {
    qrActivity: async (request) => {
      const principal = sessionPrincipal(request.request);
      if (!principal) {
        return { status: 401, body: { error: "UNAUTHENTICATED", message: "Sign in required" } };
      }

      const from = utcDate(request.query.from);
      const to = utcDate(request.query.to);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 365 * dayMs) {
        return {
          status: 400,
          body: {
            error: "INVALID_DATE_RANGE",
            message: "Require UTC dates with to >= from and at most 365 days apart",
          },
        };
      }

      const id = String(request.params.id);
      const owner = await database.pool.query(
        `SELECT "id" FROM "${qr.table}" WHERE "id" = $1 AND "owner_id" = $2`,
        [id, principal.id],
      );
      if (!owner.rows.length) {
        return { status: 404, body: { error: "NOT_FOUND", message: "No such QR" } };
      }

      // Explicit UTC bounds and buckets keep results independent of the database timezone.
      // The exclusive next-day bound includes the entire final date.
      const { rows } = await database.pool.query(
        `SELECT to_char(date_trunc('day', "${occurredAt}" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS "date",
                count(*)::int AS "count"
         FROM "${scan.table}"
         WHERE "${qrId}" = $1
           AND "${occurredAt}" >= ($2::date::timestamp AT TIME ZONE 'UTC')
           AND "${occurredAt}" < (($3::date + 1)::timestamp AT TIME ZONE 'UTC')
         GROUP BY 1 ORDER BY 1`,
        [id, request.query.from, request.query.to],
      );
      const counts = new Map<string, number>(
        rows.map((row: { date: string; count: number }) => [row.date, row.count]),
      );
      const days: { date: string; count: number }[] = [];
      let total = 0;
      for (let time = from; time <= to; time += dayMs) {
        const date = new Date(time).toISOString().slice(0, 10);
        const count = counts.get(date) ?? 0;
        days.push({ date, count });
        total += count;
      }
      return { status: 200, body: { total, days } };
    },
  },
});

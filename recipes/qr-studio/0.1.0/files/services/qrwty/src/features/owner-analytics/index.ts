import { utcRange } from "@jeeves/analytics";
import { ownedEventCounter } from "@jeeves/analytics/postgres";
import { sessionPrincipal } from "@jeeves/rest-server";
import { defineFeature } from "@jeeves/service-runtime";
import qr from "../../generated/resources/qr.ts";
import scan from "../../generated/resources/scan.ts";
import { database } from "../../jeeves.generated.ts";

const count = ownedEventCounter({
  parent: qr,
  events: scan,
  timestampField: "occurredAt",
  labelField: "title",
});
export default defineFeature({
  name: "owner-analytics",
  operations: {
    ownerAnalytics: async (request) => {
      const principal = sessionPrincipal(request.request);
      if (!principal)
        return { status: 401, body: { error: "UNAUTHENTICATED", message: "Sign in required" } };
      let range: ReturnType<typeof utcRange>;
      try {
        range = utcRange(request.query.from, request.query.to);
      } catch (cause) {
        return {
          status: 400,
          body: {
            error: "INVALID_DATE_RANGE",
            message: cause instanceof Error ? cause.message : "Invalid date range",
          },
        };
      }
      return {
        status: 200,
        headers: { "cache-control": "no-store" },
        body: await count(database.pool, principal.id, range),
      };
    },
  },
});

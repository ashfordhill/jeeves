import { expect, test } from "vitest";
import { withApplication } from "../harness/application.ts";
import { poll } from "../harness/process.ts";

test("B01: edge publication commits exactly one counter increment and a matching receipt", async () => {
  await withApplication(
    "activity",
    ["module-stub", "event-counter", "module-stub"],
    async (app) => {
      const aggregateKey = "Activity:A";
      const eventId = "activity:one";
      const read = () =>
        app.request(`/api/totals-api/modules/read-total?aggregate=${aggregateKey}`);
      expect(await read()).toEqual({ status: 200, body: { aggregateKey, total: "0" } });
      const submitted = await app.request("/api/activity-api/modules/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aggregateKey, eventId }),
      });
      expect(submitted).toEqual({ status: 202, body: { aggregateKey, eventId } });
      const result = await poll(
        "committed total becomes one",
        read,
        (result) => result.status === 200 && (result.body as { total: string }).total === "1",
        30_000,
        (value) => app.record(value),
      );
      expect(result).toEqual({ status: 200, body: { aggregateKey, total: "1" } });
      expect(
        await app.sql(
          "SELECT scope_key || '|' || event_id || '|' || (result->>'value') FROM increment.receipts ORDER BY event_id",
        ),
      ).toBe(`${aggregateKey}|${eventId}|true`);
      expect(
        await app.sql("SELECT aggregate_key || '|' || total::text FROM increment.totals"),
      ).toBe(`${aggregateKey}|1`);
    },
  );
});

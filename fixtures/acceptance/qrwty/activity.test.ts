import assert from "node:assert/strict";
import test from "node:test";
import { assertStatus, Client, publicOrigin, today } from "./_support/api.ts";
import { countScans, insertScan } from "./_support/db.ts";

test("QR-05/QR-06: fixed UTC buckets, zero days, bounds and owner isolation", async () => {
  const alice = await Client.register();
  const bob = await Client.register();
  const created = await alice.createQr("https://example.test/activity", "Activity acceptance");
  assertStatus(created, 201);
  const id = (created.body as { id: string }).id;

  await insertScan(id, "2026-01-01T23:59:59Z");
  await insertScan(id, "2026-01-02T00:00:00Z");
  await insertScan(id, "2026-01-02T12:00:00Z");
  assert.equal(await countScans(id), 3);

  const fixed = await alice.activity(id, "2026-01-01", "2026-01-04");
  assertStatus(fixed, 200);
  assert.deepEqual(fixed.body, {
    total: 3,
    days: [
      { date: "2026-01-01", count: 1 },
      { date: "2026-01-02", count: 2 },
      { date: "2026-01-03", count: 0 },
      { date: "2026-01-04", count: 0 },
    ],
  });

  // Computed once per test. A run that crosses 00:00 UTC can flake, so treat this as a known limit.
  const day = today();
  const emptyToday = await alice.activity(id, day, day);
  assertStatus(emptyToday, 200);
  assert.deepEqual(emptyToday.body, { total: 0, days: [{ date: day, count: 0 }] });

  for (let i = 0; i < 2; i++) {
    const redirect = await fetch(`${publicOrigin}/q/${id}`, { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("cache-control"), "no-store");
    await redirect.arrayBuffer();
  }
  const afterTwo = await alice.activity(id, day, day);
  assertStatus(afterTwo, 200);
  assert.deepEqual(afterTwo.body, { total: 2, days: [{ date: day, count: 2 }] });

  const third = await fetch(`${publicOrigin}/q/${id}`, { redirect: "manual" });
  assert.equal(third.status, 302);
  await third.arrayBuffer();
  const afterThree = await alice.activity(id, day, day);
  assertStatus(afterThree, 200);
  assert.equal((afterThree.body as { total: number }).total, 3);

  assertStatus(await alice.activity(id, "2026-01-04", "2026-01-01"), 400);
  assertStatus(await alice.activity(id, "2025-01-01", "2027-01-01"), 400);
  assertStatus(await alice.activity(id, "2025-01-01", "2026-01-01"), 200);
  assertStatus(await alice.activity(id, "2025-01-01", "2026-01-02"), 400);
  assertStatus(await alice.activity(id, "not-a-date", "2026-01-01"), 400);

  assertStatus(await bob.activity(id, "2026-01-01", "2026-01-04"), 404);
  assertStatus(await new Client().get(`/api/qr/${id}/activity?from=2026-01-01&to=2026-01-04`), 401);
  const beforeUnknown = await countScans(id);
  assertStatus(
    await alice.activity("00000000-0000-4000-8000-000000000000", "2026-01-01", "2026-01-04"),
    404,
  );
  assert.equal(await countScans(id), beforeUnknown, "an unknown activity query adds no scans");
});

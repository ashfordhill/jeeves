import assert from "node:assert/strict";
import test from "node:test";
import { assertStatus, Client } from "./_support/api.ts";
import { insertScan } from "./_support/db.ts";

type Summary = {
  from: string;
  to: string;
  total: number;
  totalResources: number;
  activeResources: number;
  days: { date: string; count: number }[];
  top: { id: string; label: string | null; count: number }[];
};
const path = "/api/analytics?from=2026-01-01&to=2026-01-03";
test("QR-15: owner-wide UTC analytics is bounded, zero-filled and isolated", async () => {
  assertStatus(await new Client().get(path), 401);
  const alice = await Client.register(),
    bob = await Client.register();
  const empty = await alice.get(path);
  assertStatus(empty, 200);
  assert.deepEqual(empty.body, {
    from: "2026-01-01",
    to: "2026-01-03",
    total: 0,
    totalResources: 0,
    activeResources: 0,
    days: [
      { date: "2026-01-01", count: 0 },
      { date: "2026-01-02", count: 0 },
      { date: "2026-01-03", count: 0 },
    ],
    top: [],
  });
  const make = async (client: Client, title: string) => {
    const result = await client.createQr("https://example.test/analytics", title);
    assertStatus(result, 201);
    return (result.body as { id: string }).id;
  };
  const hot = await make(alice, "Most scanned"),
    foreign = await make(bob, "Other owner");
  await make(alice, "No scans yet");
  for (const time of [
    "2025-12-31T23:59:59.999Z",
    "2026-01-01T00:00:00Z",
    "2026-01-02T00:00:00Z",
    "2026-01-03T23:59:59.999Z",
    "2026-01-04T00:00:00Z",
  ])
    await insertScan(hot, time);
  for (let i = 0; i < 5; i++) await insertScan(foreign, "2026-01-02T12:00:00Z");
  const ties: string[] = [];
  for (let i = 0; i < 12; i++) {
    const id = await make(alice, `Link ${i}`);
    ties.push(id);
    await insertScan(id, "2026-01-02T12:00:00Z");
  }
  const response = await alice.get(path);
  assertStatus(response, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = response.body as Summary;
  assert.equal(result.total, 15);
  assert.equal(result.totalResources, 14);
  assert.equal(result.activeResources, 13);
  assert.deepEqual(result.days, [
    { date: "2026-01-01", count: 1 },
    { date: "2026-01-02", count: 13 },
    { date: "2026-01-03", count: 1 },
  ]);
  assert.deepEqual(
    result.top.map((row) => row.id),
    [hot, ...ties.sort().slice(0, 9)],
  );
  assert.equal(result.top[0]?.label, "Most scanned");
  assert.equal(result.top[0]?.count, 3);
  const otherOwner = await bob.get(path);
  assertStatus(otherOwner, 200);
  assert.equal((otherOwner.body as Summary).total, 5);
  for (const query of [
    "from=2026-01-03&to=2026-01-01",
    "from=2025-02-29&to=2025-03-01",
    "from=2026-01-01&to=2026-04-01",
    "from=no&to=2026-01-01",
    "from=2026-01-01",
  ])
    assertStatus(await alice.get(`/api/analytics?${query}`), 400);
  const max = await alice.get("/api/analytics?from=2026-01-01&to=2026-03-31");
  assertStatus(max, 200);
  assert.equal((max.body as Summary).days.length, 90);
  const single = await alice.get("/api/analytics?from=2026-01-03&to=2026-01-03");
  assertStatus(single, 200);
  assert.equal((single.body as Summary).total, 1);
});

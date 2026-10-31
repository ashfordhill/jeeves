import assert from "node:assert/strict";
import test from "node:test";
import { assertStatus, Client, publicOrigin } from "./_support/api.ts";

const destination = "https://example.test/core-destination";

test("QR-01: accounts, sessions and owner-scoped CRUD", async () => {
  assert.ok(publicOrigin, "JEEVES_TEST_PUBLIC_ORIGIN is required");
  const alice = await Client.register();
  const bob = await Client.register();

  const created = await alice.createQr(destination, "Core acceptance");
  assertStatus(created, 201);
  const row = created.body as { id: string; destination: string; title: string };
  assert.match(row.id, /^[0-9a-f-]{36}$/i);
  assert.equal(row.destination, destination);
  assert.equal(row.title, "Core acceptance");

  const read = await alice.get(`/api/qr/${row.id}`);
  assertStatus(read, 200);
  assert.equal((read.body as { id: string }).id, row.id);

  const list = await alice.get("/api/qr?limit=25");
  assertStatus(list, 200);
  assert.ok(
    (list.body as { items: { id: string }[] }).items.some((item) => item.id === row.id),
    "Alice's list contains her resource",
  );

  const bobList = await bob.get("/api/qr?limit=25");
  assertStatus(bobList, 200);
  assert.ok(
    !(bobList.body as { items: { id: string }[] }).items.some((item) => item.id === row.id),
    "Bob's list does not contain Alice's resource",
  );

  const anonymous = new Client();
  assertStatus(
    await anonymous.request("POST", "/api/qr", {
      body: { destination },
      csrf: false,
    }),
    401,
  );
  assertStatus(await anonymous.get(`/api/qr/${row.id}`), 401);
  assertStatus(
    await anonymous.request("PATCH", `/api/qr/${row.id}`, {
      body: { destination },
      csrf: false,
    }),
    401,
  );
  assertStatus(await anonymous.get(`/api/qr/${row.id}/image`), 401);
  assertStatus(
    await anonymous.get(`/api/qr/${row.id}/activity?from=2026-01-01&to=2026-01-01`),
    401,
  );

  const logout = await alice.logout();
  assertStatus(logout, 204);
  assertStatus(await alice.get("/api/qr/" + row.id), 401);
});

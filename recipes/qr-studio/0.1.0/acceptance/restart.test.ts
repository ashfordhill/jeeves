import assert from "node:assert/strict";
import test from "node:test";
import { assertStatus, Client, publicOrigin, today } from "./_support/api.ts";
import { countScans } from "./_support/db.ts";
import { Destination } from "./_support/destinations.ts";
import { restartFixture, serviceUrl } from "./_support/fixture.ts";
import { decodeQr, sha256 } from "./_support/qr.ts";

test("QR-08: service and database restart preserve storage, image identity and scans", async () => {
  const destination = await Destination.start("/after-restart");
  try {
    const alice = await Client.register();
    const created = await alice.createQr(destination.url, "Restart acceptance");
    assertStatus(created, 201);
    const id = (created.body as { id: string }).id;

    const before = await alice.image(id);
    assert.equal(before.status, 200);
    const bytes = Buffer.from(await before.arrayBuffer());
    const digest = sha256(bytes);

    const redirect = await fetch(`${publicOrigin}/q/${id}`, { redirect: "manual" });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), destination.url);
    await redirect.arrayBuffer();
    assert.equal(await countScans(id), 1);

    await restartFixture();

    const again = await Client.login(alice.email, alice.password, serviceUrl());
    const read = await again.get(`/api/qr/${id}`);
    assertStatus(read, 200);
    assert.equal((read.body as { destination: string }).destination, destination.url);

    const after = await again.image(id);
    assert.equal(after.status, 200);
    const afterBytes = Buffer.from(await after.arrayBuffer());
    assert.equal(sha256(afterBytes), digest, "the image is unchanged after restart");
    assert.equal(decodeQr(afterBytes), `${publicOrigin}/q/${id}`);

    const second = await fetch(`${publicOrigin}/q/${id}`, { redirect: "manual" });
    assert.equal(second.status, 302);
    assert.equal(second.headers.get("location"), destination.url);
    await second.arrayBuffer();
    assert.equal(await countScans(id), 2, "the existing scan remains and exactly one is added");
    assert.equal(destination.requests(), 0, "the server never follows the destination");

    const activity = await again.activity(id, today(), today());
    assertStatus(activity, 200);
    assert.equal((activity.body as { total: number }).total, 2);
  } finally {
    await destination.close();
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { assertStatus, Client, publicOrigin } from "./_support/api.ts";
import { countScans } from "./_support/db.ts";
import { Destination, fetchDestination } from "./_support/destinations.ts";
import { decodeQr, sha256 } from "./_support/qr.ts";

test("QR-03/QR-04/QR-07: redirect, destination edit, scan counts and errors", async () => {
  const destinationA = await Destination.start("/a");
  const destinationB = await Destination.start("/b");
  try {
    const alice = await Client.register();
    const created = await alice.createQr(destinationA.url, "Redirect acceptance");
    assertStatus(created, 201);
    const id = (created.body as { id: string }).id;

    const first = await fetch(`${publicOrigin}/q/${id}`, { redirect: "manual" });
    assert.equal(first.status, 302);
    assert.equal(first.headers.get("location"), destinationA.url);
    assert.equal(first.headers.get("cache-control"), "no-store");
    await first.arrayBuffer();
    assert.equal(await fetchDestination(destinationA.url), 204);
    assert.equal(destinationA.requests(), 1);
    assert.equal(await countScans(id), 1);

    const second = await fetch(`${publicOrigin}/q/${id}`, { redirect: "manual" });
    assert.equal(second.status, 302);
    await second.arrayBuffer();
    assert.equal(destinationA.requests(), 2);
    assert.equal(await countScans(id), 2, "every redirect request is one scan");

    const before = await alice.image(id);
    assert.equal(before.status, 200);
    const imageBefore = Buffer.from(await before.arrayBuffer());
    assertStatus(await alice.updateQr(id, destinationB.url, "Redirect acceptance"), 200);
    const after = await alice.image(id);
    const imageAfter = Buffer.from(await after.arrayBuffer());
    assert.equal(sha256(imageAfter), sha256(imageBefore));
    assert.equal(decodeQr(imageAfter), `${publicOrigin}/q/${id}`);

    const third = await fetch(`${publicOrigin}/q/${id}`, { redirect: "manual" });
    assert.equal(third.status, 302);
    assert.equal(third.headers.get("location"), destinationB.url);
    await third.arrayBuffer();
    assert.equal(destinationB.requests(), 1);
    assert.equal(destinationA.requests(), 2, "the original destination is not contacted again");
    assert.equal(await countScans(id), 3);

    const unknown = await fetch(`${publicOrigin}/q/00000000-0000-4000-8000-000000000000`, {
      redirect: "manual",
    });
    assert.equal(unknown.status, 404);
    assert.equal(await countScans(id), 3, "an unknown redirect adds no event");

    const malformed = await fetch(`${publicOrigin}/q/not-a-uuid`, { redirect: "manual" });
    assert.equal(malformed.status, 400);

    const anonymous = new Client();
    assert.equal(
      (
        await anonymous.request("PATCH", `/api/qr/${id}`, {
          body: { destination: destinationA.url },
          csrf: false,
        })
      ).status,
      401,
    );
    const stillB = await fetch(`${publicOrigin}/q/${id}`, { redirect: "manual" });
    assert.equal(stillB.status, 302);
    assert.equal(stillB.headers.get("location"), destinationB.url);
    await stillB.arrayBuffer();
    assert.equal(destinationB.requests(), 2);
  } finally {
    await destinationA.close();
    await destinationB.close();
  }
});

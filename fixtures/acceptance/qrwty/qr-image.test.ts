import assert from "node:assert/strict";
import test from "node:test";
import { assertStatus, Client, publicOrigin } from "./_support/api.ts";
import { Destination } from "./_support/destinations.ts";
import { decodeQr, pngSize, sha256 } from "./_support/qr.ts";

test("QR-02/QR-06: decoded image URL, deterministic bytes and owner isolation", async () => {
  const destinationA = await Destination.start("/a");
  const destinationB = await Destination.start("/b");
  try {
    const alice = await Client.register();
    const bob = await Client.register();
    const created = await alice.createQr(destinationA.url, "Image acceptance");
    assertStatus(created, 201);
    const id = (created.body as { id: string }).id;

    const image = await alice.image(id);
    assert.equal(image.status, 200);
    assert.match(image.headers.get("content-type") ?? "", /^image\/png/);
    assert.match(image.headers.get("content-disposition") ?? "", /^attachment/i);
    const first = Buffer.from(await image.arrayBuffer());
    assert.ok(first.length > 0);
    assert.equal(decodeQr(first), `${publicOrigin}/q/${id}`);
    assert.deepEqual(pngSize(first), { width: 512, height: 512 });
    assert.ok(!decodeQr(first).includes(destinationA.url), "the destination is never encoded");
    const digest = sha256(first);

    assertStatus(await alice.updateQr(id, destinationB.url, "Image acceptance"), 200);
    const secondImage = await alice.image(id);
    assert.equal(secondImage.status, 200);
    const second = Buffer.from(await secondImage.arrayBuffer());
    assert.equal(sha256(second), digest, "the downloaded image stays byte-identical");
    assert.equal(decodeQr(second), `${publicOrigin}/q/${id}`);

    assert.equal((await bob.image(id)).status, 404);
    assert.equal((await alice.image("00000000-0000-4000-8000-000000000000")).status, 404);
    assert.equal((await alice.image("not-a-uuid")).status, 400);
  } finally {
    await destinationA.close();
    await destinationB.close();
  }
});

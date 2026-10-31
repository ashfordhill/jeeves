import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { assertStatus, Client, publicOrigin } from "./_support/api.ts";
import { restartFixture } from "./_support/fixture.ts";
import { decodeQr, pngSize, sha256 } from "./_support/qr.ts";

const settings = {
  foreground: "#15345A",
  background: "#FFFFFF",
  moduleStyle: "square",
  finderStyle: "square",
  size: 512,
  quietZone: 4,
  errorCorrection: "M",
};
type Revision = {
  id: string;
  canonicalUrl: string;
  rendererVersion: string;
  savedAt: string;
  settings: typeof settings;
  pngSha256: string;
  svgSha256: string;
};
type Artifact = {
  bytesBase64: string;
  contentType: string;
  sha256: string;
  canonicalUrl: string;
  filename: string;
};
type History = { canonicalUrl: string; items: Revision[]; nextCursor: string | null };

test("QR-10–QR-13: immutable Studio revisions, authorized exports and persistence", async () => {
  const alice = await Client.register();
  const bob = await Client.register();
  const created = await alice.createQr("https://example.test/studio-original", "Studio acceptance");
  assertStatus(created, 201);
  const id = (created.body as { id: string }).id;
  const url = `${publicOrigin}/q/${id}`;
  const root = `/api/qr/${id}`;
  const legacy = Buffer.from(await (await alice.image(id)).arrayBuffer());
  const empty = await alice.get(`${root}/studio`);
  assertStatus(empty, 200);
  assert.deepEqual((empty.body as History).items, []);
  assert.equal((empty.body as History).canonicalUrl, url);

  const requestId = randomUUID();
  const body = { requestId, settings };
  assertStatus(await new Client().get(`${root}/studio`), 401);
  assertStatus(await bob.get(`${root}/studio`), 404);
  assertStatus(await bob.post(`${root}/artwork/preview`, { settings }), 404);
  assertStatus(await bob.post(`${root}/artwork`, body), 404);
  assertStatus(await alice.request("POST", `${root}/artwork`, { body, csrf: false }), 403);
  assertStatus(await alice.post(`${root}/artwork`, { ...body, ownerId: randomUUID() }), 400);
  assertStatus(
    await alice.post(`${root}/artwork`, {
      ...body,
      settings: { ...settings, foreground: "#EEEEEE" },
    }),
    400,
  );
  assertStatus(
    await alice.post(`${root}/artwork/preview`, { settings: { ...settings, size: 300 } }),
    400,
  );
  assertStatus(
    await alice.post(`${root}/artwork/preview`, { settings: { ...settings, quietZone: 3 } }),
    400,
  );
  const foreign = new Client(alice.base, "https://untrusted.example.test");
  foreign.cookie = alice.cookie;
  foreign.csrfToken = alice.csrfToken;
  assertStatus(await foreign.post(`${root}/artwork`, body), 403);

  const preview = await alice.post(`${root}/artwork/preview`, { settings });
  assertStatus(preview, 200);
  const png = preview.body as Artifact;
  const previewBytes = Buffer.from(png.bytesBase64, "base64");
  assert.equal(decodeQr(previewBytes), url);
  assert.deepEqual(pngSize(previewBytes), { width: 512, height: 512 });
  assert.equal(sha256(previewBytes), png.sha256);
  assert.deepEqual(((await alice.get(`${root}/studio`)).body as History).items, []);

  const saved = await alice.post(`${root}/artwork`, body);
  assertStatus(saved, 201);
  const revision = saved.body as Revision;
  assert.equal(revision.id, requestId);
  assert.equal(revision.canonicalUrl, url);
  assert.equal(revision.rendererVersion, "qr-artwork@0.1.0");
  assert.equal(revision.pngSha256, png.sha256);
  const retry = await alice.post(`${root}/artwork`, {
    ...body,
    settings: { ...settings, foreground: "#15345a" },
  });
  assertStatus(retry, 200);
  assert.deepEqual(retry.body, revision);
  assertStatus(
    await alice.post(`${root}/artwork`, { ...body, settings: { ...settings, size: 1024 } }),
    409,
  );

  const exportPath = `${root}/artwork/${requestId}/export`;
  const exported: Record<string, string> = {};
  for (const format of ["png", "svg"] as const) {
    const response = await alice.get(`${exportPath}?format=${format}`);
    assertStatus(response, 200);
    const artifact = response.body as Artifact;
    const bytes = Buffer.from(artifact.bytesBase64, "base64");
    assert.equal(sha256(bytes), revision[`${format}Sha256`]);
    assert.equal(artifact.sha256, revision[`${format}Sha256`]);
    assert.equal(artifact.contentType, format === "png" ? "image/png" : "image/svg+xml");
    assert.equal(artifact.canonicalUrl, url);
    assert.ok(artifact.filename.endsWith(`.${format}`));
    if (format === "png") assert.equal(decodeQr(bytes), url);
    else {
      assert.match(bytes.toString(), /^<svg /);
      assert.doesNotMatch(bytes.toString(), /<script|<image|href=|onload=/);
    }
    exported[format] = artifact.bytesBase64;
    assertStatus(await bob.get(`${exportPath}?format=${format}`), 404);
    assertStatus(await new Client().get(`${exportPath}?format=${format}`), 401);
  }
  assertStatus(await alice.get(`${exportPath}?format=pdf`), 400);
  const other = await alice.createQr("https://example.test/other", "Other QR");
  const otherId = (other.body as { id: string }).id;
  assertStatus(await alice.get(`/api/qr/${otherId}/artwork/${requestId}/export?format=png`), 404);
  assertStatus(await alice.post(`/api/qr/${otherId}/artwork`, body), 409);
  assertStatus(await alice.get(`/api/qr/${otherId}/studio?cursor=${requestId}`), 400);
  assertStatus(await alice.get(`${root}/studio?limit=26`), 400);
  const second = await alice.post(`${root}/artwork`, {
    requestId: randomUUID(),
    settings: { ...settings, moduleStyle: "rounded" },
  });
  assertStatus(second, 201);
  const firstPage = (await alice.get(`${root}/studio?limit=1`)).body as History;
  assert.equal(firstPage.items.length, 1);
  assert.equal(firstPage.items[0]?.id, (second.body as Revision).id);
  assert.ok(firstPage.nextCursor);
  const nextPage = (await alice.get(`${root}/studio?limit=1&cursor=${firstPage.nextCursor}`))
    .body as History;
  assert.equal(nextPage.items[0]?.id, requestId);
  assert.equal(nextPage.nextCursor, null);
  assertStatus(
    await alice.updateQr(id, "https://example.test/studio-changed", "Changed destination"),
    200,
  );
  assert.deepEqual(Buffer.from(await (await alice.image(id)).arrayBuffer()), legacy);

  // Existing cookies, old PNGs and both revision encodings survive real process/database restart.
  const base = await restartFixture();
  const resumed = new Client(base);
  resumed.cookie = alice.cookie;
  resumed.csrfToken = alice.csrfToken;
  const history = await resumed.get(`${root}/studio`);
  assertStatus(history, 200);
  assert.equal((history.body as History).items.length, 2);
  for (const format of ["png", "svg"]) {
    const response = await resumed.get(`${exportPath}?format=${format}`);
    assertStatus(response, 200);
    assert.equal((response.body as Artifact).bytesBase64, exported[format]);
  }
  assert.deepEqual(Buffer.from(await (await resumed.image(id)).arrayBuffer()), legacy);
});

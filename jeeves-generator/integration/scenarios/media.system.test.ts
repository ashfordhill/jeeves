import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import {
  brokerProbe,
  controlContainer,
  healthyCopies,
  serviceContainers,
} from "../harness/activity.ts";
import { withApplication } from "../harness/application.ts";
import { IdentityClient } from "../harness/identity.ts";
import {
  api,
  assetBecomes,
  counts,
  delivery,
  details,
  failedJob,
  favorites,
  mediaTemplates,
  multipartParts,
  originalHash,
  plays,
  putPart,
  replayPublication,
  search,
  searchDocuments,
  startUpload,
  syntheticVideo,
  uploads,
} from "../harness/media.ts";
import { hash, poll } from "../harness/process.ts";

test("B08: signed multipart bytes become real published HLS, searchable once with counts and favorites", async () => {
  await withApplication("media", mediaTemplates, async (app) => {
    expect(app.report.applicationComplete).toBe(false);
    expect(app.report.gaps.filter((row) => row.required && row.status === "custom")).toHaveLength(
      9,
    );
    const identity = new IdentityClient(app);
    const [a, b] = await identity.provision();
    if (!a || !b) throw new Error("Two disposable accounts required");
    const token = await identity.signIn(a),
      other = await identity.signIn(b);
    expect(
      (
        await app.request(uploads, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(401);
    const bytes = await syntheticVideo(app);
    const invalid = Buffer.from("This is deliberately invalid media.\n".repeat(256));
    await app.save("invalid-input.json", { bytes: invalid.length, sha256: hash(invalid) });

    const [worker] = await serviceContainers(app, "app-transcoder");
    expect(worker).toBeDefined();
    if (!worker) throw Error("Transcoder missing");
    await controlContainer(app, "app-transcoder", worker.Id, "stop");
    const good = await startUpload(app, token, bytes, "ready");
    expect(good.partCount).toBeGreaterThanOrEqual(2);
    const part = await putPart(app, token, good, bytes, 1);
    // A new status request must read the provider's actual ListParts, then resume without resending part 1.
    const status = await api(app, token, `${uploads}/${good.uploadId}`);
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      uploadId: good.uploadId,
      state: "uploading",
      partCount: good.partCount,
      parts: [{ partNumber: 1, size: part.size, etag: part.etag }],
    });
    expect((await api(app, other, `${uploads}/${good.uploadId}`)).status).toBe(404);
    expect((await api(app, token, uploads)).body).toMatchObject({
      uploads: [{ uploadId: good.uploadId, assetId: good.assetId, state: "uploading" }],
    });
    for (let n = 2; n <= good.partCount; n++) await putPart(app, token, good, bytes, n);
    const completed = await api(app, token, `${uploads}/${good.uploadId}/complete`, "POST");
    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({
      uploadId: good.uploadId,
      videoId: good.assetId,
      state: "pending",
    });
    expect(await api(app, token, `${uploads}/${good.uploadId}/complete`, "POST")).toEqual(
      completed,
    );
    // A completed, provider-verified original is pending until the real consumer runs.
    expect((await assetBecomes(app, good.assetId, "pending")).started_at).toBeNull();
    expect((await app.request(details(good.assetId))).status).toBe(404);
    expect((await search(app)).body).toMatchObject({ total: 0, hits: [] });
    expect((await api(app, token, `${favorites}/${good.assetId}`, "PUT")).status).toBe(404);

    const aborted = await startUpload(app, token, bytes, "aborted");
    const abortedPart = await putPart(app, token, aborted, bytes, 1);
    expect(await multipartParts(app, aborted, abortedPart.providerUploadId)).toEqual({
      status: 200,
      truncated: false,
      parts: [{ partNumber: 1, size: abortedPart.size, etag: abortedPart.etag }],
    });
    expect(await api(app, token, `${uploads}/${aborted.uploadId}/abort`, "POST")).toEqual({
      status: 200,
      body: { uploadId: aborted.uploadId, state: "aborted" },
    });
    expect(await multipartParts(app, aborted, abortedPart.providerUploadId)).toEqual({
      status: 404,
      code: "NoSuchUpload",
    });
    expect(await api(app, token, `${uploads}/${aborted.uploadId}/complete`, "POST")).toMatchObject({
      status: 410,
      body: { error: "UPLOAD_CLOSED" },
    });
    await assetBecomes(app, aborted.assetId, "aborted");

    await controlContainer(app, "app-transcoder", worker.Id, "start");
    await healthyCopies(app, "app-transcoder", 1);
    expect(await originalHash(app, good)).toEqual({ bytes: bytes.length, sha256: hash(bytes) });
    const ready = await assetBecomes(app, good.assetId, "ready");
    expect(ready.started_at).toBeTruthy();
    expect(ready.ready_at).toBeTruthy();
    expect(Date.parse(ready.started_at as string)).toBeLessThanOrEqual(
      Date.parse(ready.ready_at as string),
    );
    const view = await app.request(details(good.assetId));
    expect(view.status).toBe(200);
    const publicVideo = view.body as {
      videoId: string;
      manifest: string;
      thumbnail: string;
      manifestUrl: string;
      thumbnailUrl: string;
    };
    expect(publicVideo.videoId).toBe(good.assetId);
    expect(publicVideo.manifestUrl).toBe(`/cdn/video-delivery/${publicVideo.manifest}`);
    expect(publicVideo.thumbnailUrl).toBe(`/cdn/video-delivery/${publicVideo.thumbnail}`);
    await delivery(app, publicVideo.manifest, publicVideo.thumbnail);

    const bad = await startUpload(app, token, invalid, "failed");
    await putPart(app, token, bad, invalid, 1);
    expect(
      (await api(app, token, `${uploads}/${bad.uploadId}/complete`, "POST")).body,
    ).toMatchObject({ state: "pending", videoId: bad.assetId });
    expect(await originalHash(app, bad)).toEqual({ bytes: invalid.length, sha256: hash(invalid) });
    const failed = await assetBecomes(app, bad.assetId, "failed");
    expect(failed.failure_code).toBe("INVALID_MEDIA");
    for (const id of [bad.assetId, aborted.assetId]) {
      expect((await app.request(details(id))).status).toBe(404);
      expect((await api(app, token, `${favorites}/${id}`, "PUT")).body).toMatchObject({
        error: "NOT_ELIGIBLE",
      });
      expect((await api(app, token, plays(id), "POST", { eventId: randomUUID() })).status).toBe(
        404,
      );
    }
    await poll(
      "one ready search hit, failed and aborted excluded",
      () => search(app),
      (value) => value.status === 200 && (value.body as { total: number }).total === 1,
      30_000,
      (value) => app.record(value),
    );
    const result = await search(app);
    expect(result.body).toMatchObject({
      total: 1,
      hits: [{ videoId: good.assetId, title: "saffronfixture ready" }],
    });
    const before = await searchDocuments(app);
    expect(before.total.value).toBe(1);
    expect(before.hits.map((row) => row._id)).toEqual([good.assetId]);

    // Pause just the real subscriber, observe one actual replay queued, then its consumption.
    const [indexer] = await serviceContainers(app, "app-search-indexer");
    if (!indexer) throw Error("Search indexer missing");
    await controlContainer(app, "app-search-indexer", indexer.Id, "stop");
    const queue = "publication-events--search-indexer";
    expect(await brokerProbe(app, "state", queue)).toMatchObject({
      consumerCount: 0,
      messageCount: 0,
      unacknowledged: 0,
    });
    expect(await replayPublication(app, good.assetId)).toMatchObject({ confirmed: true });
    expect(await brokerProbe(app, "state", queue)).toMatchObject({
      consumerCount: 0,
      messageCount: 1,
      unacknowledged: 0,
    });
    await controlContainer(app, "app-search-indexer", indexer.Id, "start");
    await healthyCopies(app, "app-search-indexer", 1);
    await poll(
      "replayed publication consumed",
      () => brokerProbe(app, "state", queue),
      (value) =>
        !!value &&
        "messageCount" in value &&
        value.messageCount === 0 &&
        value.unacknowledged === 0 &&
        value.consumerCount === 1,
      30_000,
      (value) => app.record(value),
    );
    const after = await searchDocuments(app);
    expect(after).toEqual(before);
    expect((await search(app)).body).toEqual(result.body);

    expect(await app.request(counts(good.assetId))).toEqual({ status: 200, body: { views: "0" } });
    const eventId = randomUUID();
    for (let n = 0; n < 2; n++)
      expect((await api(app, token, plays(good.assetId), "POST", { eventId })).status).toBe(202);
    await poll(
      "one counted play after duplicate accepted reports",
      () => app.request(counts(good.assetId)),
      (value) => (value.body as { views: string }).views === "1",
      30_000,
      (value) => app.record(value),
    );
    await poll(
      "view deliveries committed and acknowledged",
      () => brokerProbe(app, "state", "view-events--view-counter"),
      (value) =>
        !!value &&
        "messageCount" in value &&
        value.messageCount === 0 &&
        value.unacknowledged === 0,
      30_000,
      (value) => app.record(value),
    );
    expect(
      await app.sql(
        `SELECT aggregate_key||'|'||total FROM view_counter_receipt_and_increment.totals`,
        "d_view_counts",
      ),
    ).toBe(`${good.assetId}|1`);
    expect(
      await app.sql(
        `SELECT scope_key||'|'||event_id FROM view_counter_receipt_and_increment.receipts`,
        "d_view_counts",
      ),
    ).toBe(`${good.assetId}|${eventId}`);
    const first = await api(app, token, `${favorites}/${good.assetId}`, "PUT");
    expect(first.status).toBe(200);
    expect(await api(app, token, `${favorites}/${good.assetId}`, "PUT")).toEqual(first);
    expect((await api(app, token, favorites)).body).toEqual({ items: [first.body], next: null });
    expect((await api(app, other, `${favorites}/${good.assetId}`)).status).toBe(404);
    expect((await api(app, other, `${favorites}/${good.assetId}`, "DELETE")).status).toBe(204);
    expect(await api(app, token, `${favorites}/${good.assetId}`)).toEqual(first);
    expect(
      await app.sql(
        `SELECT account||'|'||item FROM account_api_favorite_videos.favorites`,
        "d_favorites",
      ),
    ).toBe(`${a.subject}|${good.assetId}`);
    expect((await api(app, token, `${favorites}/${good.assetId}`, "DELETE")).status).toBe(204);
    expect(
      await app.sql("SELECT count(*) FROM account_api_favorite_videos.favorites", "d_favorites"),
    ).toBe("0");
    expect(await app.sql("SELECT video_id FROM published.videos", "d_metadata")).toBe(good.assetId);
    const state = await app.sql(
      "SELECT json_agg(a ORDER BY state) FROM (SELECT asset_id,state,started_at IS NOT NULL AS started,failure_code,publication_version FROM upload_api_multipart_uploads.assets) a",
      "d_metadata",
    );
    const intents = await app.sql(
      "SELECT json_agg(a ORDER BY event_id) FROM (SELECT event_id,destination,intent_key,sent_at IS NOT NULL AS sent,attempts,payload FROM upload_api_multipart_uploads.outbox) a",
      "d_metadata",
    );
    const receipts = await app.sql(
      "SELECT json_agg(a ORDER BY event_id) FROM (SELECT scope_key,event_id,payload,result FROM upload_api_multipart_uploads.receipts) a",
      "d_metadata",
    );
    await app.save("pipeline-durable.json", {
      assets: JSON.parse(state),
      outbox: JSON.parse(intents),
      receipts: JSON.parse(receipts),
      searchBefore: before,
      searchAfterReplay: after,
    });
    const assetRows = JSON.parse(state) as { state: string }[];
    expect(assetRows.map((row) => row.state)).toEqual(["aborted", "failed", "ready"]);
    expect((JSON.parse(intents) as { sent: boolean }[]).every((row) => row.sent)).toBe(true);
    const outboxRows = JSON.parse(intents) as {
      destination: string;
      sent: boolean;
      event_id: string;
      payload: { videoId: string };
    }[];
    expect(outboxRows.map((row) => `${row.destination}:${row.payload.videoId}`).sort()).toEqual(
      [`jobs:${good.assetId}`, `jobs:${bad.assetId}`, `publication:${good.assetId}`].sort(),
    );
    const lifecycleRows = JSON.parse(receipts) as { payload: { kind: string; assetId: string } }[];
    expect(lifecycleRows.map((row) => `${row.payload.assetId}:${row.payload.kind}`).sort()).toEqual(
      [
        `${good.assetId}:started`,
        `${good.assetId}:succeeded`,
        `${bad.assetId}:started`,
        `${bad.assetId}:failed`,
      ].sort(),
    );
    expect(await brokerProbe(app, "state", "upload-jobs.failed")).toMatchObject({
      messageCount: 1,
      unacknowledged: 0,
    });
    expect(await failedJob(app)).toMatchObject({
      messageId: outboxRows.find(
        (row) => row.destination === "jobs" && row.payload.videoId === bad.assetId,
      )?.event_id,
      body: { videoId: bad.assetId, expectedSize: invalid.length, expectedSha256: hash(invalid) },
      headers: { "x-terminal-code": "INVALID_MEDIA", "x-delivery-attempt": 1 },
    });
    for (const queue of [
      "upload-jobs.failed",
      "processing-events--video-lifecycle.failed",
      "publication-events--search-indexer.failed",
      "view-events--view-counter.failed",
    ])
      expect(await brokerProbe(app, "state", queue)).toMatchObject({
        messageCount: 0,
        unacknowledged: 0,
      });
  });
});

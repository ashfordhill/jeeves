import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  logicalEventId,
  processingRequested,
  processingEvent,
  resultPrefix,
  parseMessage,
  nextProcessingState,
} from "../dist/contracts/v1.js";
import { createHttpService } from "../dist/lib/http.js";
test("bounded destination envelopes bind stable identity and result paths", () => {
  const videoId = randomUUID(),
    jobId = randomUUID(),
    attemptId = randomUUID(),
    at = new Date().toISOString(),
    type = "VideoProcessingRequested",
    eventId = logicalEventId(jobId, attemptId, type);
  const job = {
    schemaVersion: 1,
    type,
    eventId,
    occurredAt: at,
    videoId,
    jobId,
    attemptId,
    originalKey: `originals/${videoId}/${randomUUID()}/source.mp4`,
    expectedSize: 1,
    expectedSha256: "a".repeat(64),
  };
  assert.equal(processingRequested.parse(job).eventId, eventId);
  assert.equal(logicalEventId(jobId, attemptId, type), eventId);
  assert.throws(() => processingRequested.parse({ ...job, eventId: randomUUID() }));
  assert.throws(() =>
    processingRequested.parse({
      ...job,
      originalKey: `originals/${randomUUID()}/${randomUUID()}/source.mp4`,
    }),
  );
  assert.throws(() => parseMessage("processing-events", Buffer.from(JSON.stringify(job)), eventId));
  assert.throws(() => parseMessage("upload-jobs", Buffer.alloc(65537)));
  assert.throws(() => parseMessage("upload-jobs", Buffer.from(JSON.stringify(job)), randomUUID()));
  const prefix = resultPrefix(videoId, jobId, attemptId);
  const result = {
    prefix,
    manifest: prefix + "master.m3u8",
    thumbnail: prefix + "thumbnail.jpg",
    marker: prefix + "_complete.json",
    durationSeconds: 20,
    renditions: [
      {
        height: 360,
        width: 640,
        playlist: prefix + "360/index.m3u8",
        videoCodec: "h264",
        audioCodec: "aac",
      },
      {
        height: 720,
        width: 1280,
        playlist: prefix + "720/index.m3u8",
        videoCodec: "h264",
        audioCodec: "aac",
      },
    ],
  };
  const e = {
    schemaVersion: 1,
    type: "ProcessingSucceeded",
    eventId: logicalEventId(jobId, attemptId, "ProcessingSucceeded"),
    occurredAt: at,
    videoId,
    jobId,
    attemptId,
    result,
  };
  assert.ok(processingEvent.parse(e));
  assert.throws(() =>
    processingEvent.parse({ ...e, result: { ...result, manifest: prefix + "../master.m3u8" } }),
  );
  for (const state of ["ready", "failed", "aborted", "expired"])
    assert.equal(nextProcessingState(state, "ProcessingSucceeded", true), "terminal");
  assert.equal(nextProcessingState("pending", "ProcessingSucceeded", true), "ready");
  assert.equal(nextProcessingState("pending", "ProcessingSucceeded", false), "stale");
});
test("HTTP config precedes listen; deadline retains actual admission until work settles", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const service = await createHttpService(
    "probe",
    { requestTimeoutMs: 20, concurrencyLimit: 1 },
    (app) => {
      app.get("/bounded", async () => {
        await gate;
        return { ok: true };
      });
    },
  );
  assert.equal((await service.app.inject("/healthz")).statusCode, 503);
  // In-process injection exercises configured routes without any network listener.
  assert.equal((await service.app.inject("/bounded")).statusCode, 503);
  const overloaded = await service.app.inject("/bounded");
  assert.equal(overloaded.json().error, "OVERLOADED");
  release();
  await new Promise((r) => setImmediate(r));
  assert.equal((await service.app.inject("/bounded")).statusCode, 200);
  await service.close();
});

test("HTTP shutdown awaits admitted work even after its response deadline", async () => {
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const service = await createHttpService(
    "drain",
    { requestTimeoutMs: 10, concurrencyLimit: 1 },
    (app) => {
      app.get("/write", async () => {
        await gate;
        return { done: true };
      });
    },
  );
  assert.equal((await service.app.inject("/write")).statusCode, 503);
  let closed = false;
  const closing = service.close().then(() => {
    closed = true;
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(closed, false);
  release();
  await closing;
  assert.equal(closed, true);
});

test("multipart inventory requires exact acknowledged parts and safe file bounds", async () => {
  const { PART_SIZE, validateParts, parseUpload, uploadView } = await import(
    "../dist/extensions/upload-multipart.js"
  );
  const size = PART_SIZE * 2 + 17;
  const parts = [PART_SIZE, PART_SIZE, 17].map((size, i) => ({
    partNumber: i + 1,
    size,
    etag: `etag-${i}`,
  }));
  assert.doesNotThrow(() => validateParts(parts, size));
  for (const bad of [
    parts.slice(1),
    [...parts, parts[2]],
    parts.map((p, i) => (i === 1 ? { ...p, size: 1 } : p)),
    parts.map((p) => ({ ...p, etag: "" })),
    parts.map((p) => ({ ...p, partNumber: p.partNumber + 1 })),
  ])
    assert.throws(
      () => validateParts(bad, size),
      (e) => e.statusCode === 409,
    );
  const input = {
    fileName: "fixture.mp4",
    contentType: "video/mp4",
    size,
    lastModified: 0,
    sha256: "a".repeat(64),
    title: "  A video  ",
    description: "",
  };
  assert.equal(parseUpload(input).title, "A video");
  assert.throws(
    () => parseUpload({ ...input, size: 256 * 1024 * 1024 + 1 }),
    (e) => e.statusCode === 413,
  );
  assert.throws(
    () => parseUpload({ ...input, contentType: "text/plain" }),
    (e) => e.statusCode === 422,
  );
  assert.throws(
    () => parseUpload({ ...input, originalKey: "arbitrary" }),
    (e) => e.statusCode === 400,
  );
  const publicRow = uploadView({
    ...Object.fromEntries(
      [
        "provider_upload_id",
        "original_key",
        "creator_sub",
        "expected_sha256",
        "cleanup_needed",
        "media",
        "complete_response",
      ].map((k) => [k, "private"]),
    ),
    size: String(size),
    last_modified: "0",
  });
  for (const key of [
    "provider_upload_id",
    "original_key",
    "creator_sub",
    "expected_sha256",
    "cleanup_needed",
    "media",
    "complete_response",
  ])
    assert.equal(key in publicRow, false);
});

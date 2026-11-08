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

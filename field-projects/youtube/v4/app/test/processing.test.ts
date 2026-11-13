// YouTube v3's processing and publication hooks, offline (V3-14). Node's own runner, no setup:
// after `pnpm install`, run `node --test "test/*.test.ts"` in this folder.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createAssetLifecycle } from "../src/runtime/asset-lifecycle.ts";
import { videoHlsJob } from "../src/runtime/video-result.ts";
import { transcoderSegmenterAndEncoderHooks } from "../src/modules/transcoder/transcoder-segmenter-and-encoder.hooks.ts";
import { videoLifecycleLifecycleWriterHooks } from "../src/modules/video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";
import {
  originalKey,
  publicationEventId,
  requestEventId,
  requestedJob,
  resultPrefix,
  type ProcessingEvent,
} from "../src/modules/video-contract.ts";

const VIDEO = "9cf3ea9a-0037-4598-8782-554903f0af3a";
const UPLOAD = "9de9fd5f-30f7-4a6f-a246-cb201a5933d3";
const JOB = "83a61e58-1ce1-41b3-8c60-56557a119dba";
const ATTEMPT = "22cd0479-4e27-4baf-80a2-6a420fb239a4";
const OTHER = "756340b8-430b-44ec-a621-c90f23c42e2f";
const SHA = "1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9";
const AT = "2026-11-11T12:00:00.000Z";
const id = { assetId: VIDEO, jobId: JOB, attemptId: ATTEMPT };

const transcoder = transcoderSegmenterAndEncoderHooks({
  originals: "original-videos",
  outputs: "transcoded-videos",
});
const lifecycleHooks = videoLifecycleLifecycleWriterHooks();
// The compiled binding of src/processes/video-lifecycle.ts; parse needs no database.
const relation = (table: string) => ({ schema: "upload_api_multipart_uploads", table });
const lifecycle = createAssetLifecycle(
  {
    relation: relation("assets"),
    receipts: relation("receipts"),
    receiptScope: "video-lifecycle-lifecycle-writer",
    outbox: { ...relation("outbox"), destinations: ["jobs", "publication"] },
    jobsDestination: "jobs",
    identities: lifecycleHooks.identities,
  },
  { ...lifecycleHooks, publication: { ...lifecycleHooks.publication, destination: "publication" } },
);

const jobWire = {
  schemaVersion: 1,
  type: "VideoProcessingRequested",
  eventId: requestEventId(JOB, ATTEMPT),
  occurredAt: AT,
  videoId: VIDEO,
  jobId: JOB,
  attemptId: ATTEMPT,
  originalKey: originalKey(VIDEO, UPLOAD),
  expectedSize: 15584953,
  expectedSha256: SHA,
};
const prefix = resultPrefix(VIDEO, JOB, ATTEMPT);
const result = {
  prefix,
  manifest: `${prefix}master.m3u8`,
  thumbnail: `${prefix}thumbnail.jpg`,
  marker: `${prefix}_complete.json`,
  durationSeconds: 20,
  renditions: [360, 720].map((height) => ({
    height,
    width: height === 360 ? 640 : 1280,
    playlist: `${prefix}${height}/index.m3u8`,
    videoCodec: "h264",
    audioCodec: "aac",
  })),
};
const job = transcoder.codecs.job(jobWire, jobWire.eventId);
const wire = (kind: "started" | "succeeded" | "failed", extra: object = {}) =>
  transcoder.codecs.event(job, {
    kind,
    eventId: transcoder.codecs.eventId(job, kind),
    occurredAt: AT,
    ...extra,
  } as Parameters<typeof transcoder.codecs.event>[1]) as ProcessingEvent;
const publicationId = (videoId: string) => lifecycleHooks.identities.publication!(videoId);

test("the Transcoder reads the job and binds its source and its attempt's own result prefix", () => {
  assert.throws(() => transcoder.codecs.job(jobWire, OTHER));
  const video = videoHlsJob.parse(transcoder.codecs.video(job));
  assert.deepEqual(video, {
    ...id,
    source: { key: jobWire.originalKey, size: 15584953, sha256: SHA },
    resultPrefix: `videos/${VIDEO}/${JOB}/${ATTEMPT}/`,
  });
  assert.equal(transcoder.source.owns(video), true);
  assert.equal(transcoder.results.owns(video), true);
  assert.equal(transcoder.source.owns({ ...video, source: { ...video.source, key: `originals/${VIDEO}/${UPLOAD}/source.mp4` } }), false);
  assert.equal(transcoder.source.owns({ ...video, assetId: OTHER }), false);
  assert.equal(transcoder.results.owns({ ...video, resultPrefix: `videos/${VIDEO}/${JOB}/${OTHER}/` }), false);
  assert.deepEqual(transcoder.codecs.result(result, job), result);
  assert.throws(() => transcoder.codecs.result({ ...result, prefix: `videos/${OTHER}/${JOB}/${ATTEMPT}/` }, job));
});

test("each kind has one stable event ID, the same in the Transcoder and the lifecycle", () => {
  const ids = (["started", "succeeded", "failed"] as const).map((kind) => {
    const eventId = transcoder.codecs.eventId(job, kind);
    assert.equal(eventId, lifecycleHooks.identities.result(id, kind));
    assert.equal(eventId, transcoder.codecs.eventId(transcoder.codecs.job(jobWire, jobWire.eventId), kind));
    return eventId;
  });
  assert.equal(new Set([...ids, jobWire.eventId]).size, 4);
  assert.equal(publicationId(VIDEO.toUpperCase()), publicationEventId(VIDEO));
  assert.notEqual(publicationEventId(VIDEO), publicationEventId(OTHER));
});

test("the lifecycle parses what the Transcoder sends: started, succeeded and failed", () => {
  const started = wire("started");
  assert.deepEqual(lifecycle.parse(started, started.eventId), { ...id, eventId: started.eventId, occurredAt: AT, kind: "started" });
  const succeeded = wire("succeeded", { result });
  assert.equal(succeeded.type, "ProcessingSucceeded");
  assert.deepEqual(lifecycle.parse(succeeded, succeeded.eventId), { ...id, eventId: succeeded.eventId, occurredAt: AT, kind: "succeeded", result });
  const failed = wire("failed", { code: "INVALID_MEDIA" });
  assert.equal(lifecycle.parse(failed, failed.eventId).kind, "failed");
  assert.throws(() => lifecycle.parse(started, failed.eventId), /Unbound processing event identity/);
  assert.throws(() => wire("failed", { code: "QUEUE_DEADLINE" }));
  assert.throws(() => wire("succeeded", { result: { ...result, prefix: `videos/${VIDEO}/${JOB}/${OTHER}/` } }));
  assert.throws(() => lifecycle.parse({ ...succeeded, attemptId: OTHER }));
  assert.throws(() => lifecycleHooks.failure("PROCESSING_DEADLINE"));
  assert.equal(lifecycleHooks.failure("PROCESSING_FAILED"), "PROCESSING_FAILED");
});

test("a ready video publishes its public record once, bound to its event ID", async () => {
  const ready = {
    ...id,
    state: "ready" as const,
    stateVersion: 4,
    metadata: { title: "A title", description: "A tone.", channel: "creator" },
    result,
    readyAt: AT,
    publicationVersion: 1 as const,
  };
  const eventId = publicationId(VIDEO);
  const tx = {} as Parameters<typeof lifecycleHooks.publication.construct>[0];
  const published = await lifecycleHooks.publication.construct(tx, ready, eventId);
  assert.deepEqual(published, {
    schemaVersion: 1,
    type: "VideoPublished",
    eventId,
    occurredAt: AT,
    videoId: VIDEO,
    publicationVersion: 1,
    title: "A title",
    description: "A tone.",
    channel: "creator",
    durationSeconds: 20,
    manifest: result.manifest,
    thumbnail: result.thumbnail,
    publishedAt: AT,
    visibility: "public",
    state: "ready",
  });
  assert.deepEqual(lifecycleHooks.publication.codec(published, eventId), published);
  assert.throws(() => lifecycleHooks.publication.codec(published, requestEventId(JOB, ATTEMPT)));
  await assert.rejects(lifecycleHooks.publication.construct(tx, ready, requestEventId(JOB, ATTEMPT)));
  await assert.rejects(lifecycleHooks.publication.construct(tx, { ...ready, attemptId: OTHER }, eventId));
  assert.throws(() =>
    lifecycleHooks.publication.codec({ ...(published as object), thumbnail: `videos/${VIDEO}/${JOB}/${OTHER}/thumbnail.jpg` }, eventId),
  );
  assert.equal(requestedJob(jobWire).videoId, VIDEO);
});

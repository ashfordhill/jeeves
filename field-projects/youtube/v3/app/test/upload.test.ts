// YouTube v3's upload hooks, offline (V3-13). Node's own runner, no setup: after
// `pnpm install`, run `node --test "test/*.test.ts"` in this folder (Node 24 runs TypeScript directly).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyRequest } from "fastify";
import { HttpError } from "../src/runtime/http.ts";
import type { VerifiedPrincipal } from "../src/runtime/identity.ts";
import type { TileGuard } from "../src/runtime/tile-guard.ts";
import { assetUuid } from "../src/runtime/asset-identity.ts";
import {
  creatorChannel,
  uploadApiMultipartUploadsHooks,
} from "../src/modules/upload-api/upload-api-multipart-uploads.hooks.ts";
import { videoLifecycleLifecycleWriterHooks } from "../src/modules/video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";
import { ORIGINALS_PREFIX, originalIdentity, originalKey, requestEventId } from "../src/modules/video-contract.ts";

const VIDEO = "68CF7642-EC59-442C-A443-57AAB47A19B7";
const UPLOAD = "225158a0-da7f-4bc7-8dfd-5b778b5ec70a";
const JOB = "8b1d365d-e5e8-4845-bee3-27d856a9e1af";
const ATTEMPT = "2920b760-a76a-4cb8-af21-2919c5c927a9";
const SHA = "1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9";

const person = (roles: string[], username?: string): VerifiedPrincipal => ({
  subject: "9c4991fe-778d-4eea-9e6b-852d3863477f",
  claims: { realm_access: { roles }, ...(username === undefined ? {} : { preferred_username: username }) },
});
const creator = person(["creator", "offline_access"], " creator ");
const viewer = person(["offline_access"], "viewer");
const refusal = (status: number, code: string) => (error: unknown) =>
  error instanceof HttpError && error.statusCode === status && error.code === code;
function hooks(signedIn: VerifiedPrincipal | null = creator) {
  const guard: TileGuard = {
    caller: async () => (signedIn ? { signedIn: true, principal: signedIn } : { signedIn: false }),
    require: async () => {
      if (!signedIn) throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in to continue.");
      return signedIn;
    },
  };
  const lifecycle = { reserve: async () => {}, complete: async () => ({}), closed: async () => {} };
  return uploadApiMultipartUploadsHooks({ prefix: ORIGINALS_PREFIX, guard, lifecycle });
}
const start = {
  fileName: "youtube-v1-fixture.mp4",
  size: 15584953,
  contentType: "video/mp4",
  lastModified: 1762555020000,
  sha256: SHA,
  title: "  A title  ",
  description: "",
};
const request = {} as FastifyRequest;

test("only a signed-in creator passes principal: 401, then 403 CREATOR_REQUIRED", async () => {
  assert.equal(await hooks(creator).principal(request), creator);
  await assert.rejects(hooks(viewer).principal(request), refusal(403, "CREATOR_REQUIRED"));
  await assert.rejects(hooks(null).principal(request), refusal(401, "SIGN_IN_REQUIRED"));
  assert.equal(creatorChannel(creator), "creator");
  assert.equal(creatorChannel(person(["creator"])), creator.subject);
});

test("validate keeps v1's bounds: 413 size, 422 not MP4, 400 otherwise", () => {
  const { upload } = hooks();
  assert.deepEqual(upload.validate(start, creator), {
    file: {
      fileName: start.fileName,
      size: start.size,
      contentType: "video/mp4",
      lastModified: start.lastModified,
      sha256: SHA,
    },
    metadata: { title: "A title", description: "", channel: "creator" },
  });
  assert.throws(() => upload.validate({ ...start, size: 268435457 }, creator), refusal(413, "FILE_SIZE"));
  assert.throws(() => upload.validate({ ...start, size: 0 }, creator), refusal(413, "FILE_SIZE"));
  assert.throws(() => upload.validate({ ...start, contentType: "video/quicktime" }, creator), refusal(422, "UNSUPPORTED_FILE"));
  assert.throws(() => upload.validate({ ...start, fileName: "clip.mov" }, creator), refusal(422, "UNSUPPORTED_FILE"));
  for (const bad of [{ title: " " }, { title: "x".repeat(201) }, { description: "x".repeat(5001) }, { sha256: "nope" }, { extra: 1 }])
    assert.throws(() => upload.validate({ ...start, ...bad }, creator), refusal(400, "INVALID_UPLOAD"));
  assert.throws(() => upload.validate(start, viewer), refusal(403, "CREATOR_REQUIRED"));
});

test("an original's key is under the template's prefix and names its video and upload", () => {
  const key = hooks().originalKey({ assetId: VIDEO, uploadId: UPLOAD, file: {} as never });
  assert.equal(key, `upload-api-multipart-uploads/${VIDEO.toLowerCase()}/${UPLOAD}/source.mp4`);
  assert.deepEqual(originalIdentity(key), { videoId: VIDEO.toLowerCase(), uploadId: UPLOAD });
  assert.throws(() => originalIdentity(`${key}x`));
  assert.throws(() =>
    uploadApiMultipartUploadsHooks({ prefix: "elsewhere/", guard: {} as TileGuard, lifecycle: {} as never }),
  );
});

test("completion builds the job that Upload jobs carries, and both codecs agree on it", async () => {
  const lifecycle = videoLifecycleLifecycleWriterHooks();
  const identity = { assetId: assetUuid(VIDEO), jobId: JOB, attemptId: ATTEMPT };
  const eventId = lifecycle.identities.request(identity);
  assert.equal(eventId, requestEventId(JOB, ATTEMPT));
  assert.equal(eventId, lifecycle.identities.request(identity), "stable");
  const input = {
    ...identity,
    uploadId: UPLOAD,
    metadata: { title: "A title", description: "", channel: "creator" },
    original: { key: originalKey(VIDEO, UPLOAD), size: 15584953, sha256: SHA, etag: '"e-3"' },
    occurredAt: "2026-11-11T22:06:07.589Z",
    eventId,
  };
  const job = await lifecycle.job.construct({} as never, input);
  assert.deepEqual(job, {
    schemaVersion: 1,
    type: "VideoProcessingRequested",
    eventId,
    occurredAt: input.occurredAt,
    videoId: identity.assetId,
    jobId: JOB,
    attemptId: ATTEMPT,
    originalKey: input.original.key,
    expectedSize: 15584953,
    expectedSha256: SHA,
  });
  assert.deepEqual(lifecycle.job.codec(job, eventId), job);
  assert.deepEqual(hooks().job(job, eventId), job);
  assert.throws(() => hooks().job(job, JOB), /Broker identity/);
  assert.throws(() => lifecycle.job.codec({ ...job, eventId: JOB }, JOB));
  await assert.rejects(
    lifecycle.job.construct({} as never, { ...input, original: { ...input.original, key: originalKey(JOB, UPLOAD) } }),
    /Unbound completed original/,
  );
});

test("completing answers the video and its job; a repeat parses the stored answer", () => {
  const response = videoLifecycleLifecycleWriterHooks().response({
    assetId: assetUuid(VIDEO),
    jobId: JOB,
    attemptId: ATTEMPT,
    uploadId: UPLOAD,
    state: "pending",
  });
  assert.deepEqual(response, { uploadId: UPLOAD, videoId: assetUuid(VIDEO), jobId: JOB, attemptId: ATTEMPT, state: "pending" });
  const { upload } = hooks();
  assert.deepEqual(upload.response(JSON.parse(JSON.stringify(response))), response);
  assert.throws(() => upload.response({ ...response, state: "ready" }));
  const metadata = { title: "A title", description: "", channel: "creator" };
  assert.deepEqual(upload.metadata(metadata), metadata);
  assert.deepEqual(videoLifecycleLifecycleWriterHooks().metadata(metadata), metadata);
  assert.throws(() => upload.metadata({ ...metadata, owner: "x" }));
});

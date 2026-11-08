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

test("ready cache coalesces fills, never stores misses or totals, and falls back on cache errors", async () => {
  const { readyReader } = await import("../dist/state/watch.js");
  const videoId = randomUUID(),
    prefix = resultPrefix(videoId, randomUUID(), randomUUID()),
    values = new Map();
  let queries = 0,
    row = null;
  const pool = {
    query: async () => {
      queries++;
      await new Promise((r) => setImmediate(r));
      return { rows: row ? [row] : [] };
    },
  };
  const writes = [];
  const cache = {
    get: async (k) => values.get(k) ?? null,
    set: async (k, v, options) => {
      writes.push({ k, v: JSON.parse(v), options });
      values.set(k, v);
    },
  };
  const read = readyReader(pool, cache);
  assert.deepEqual(await Promise.all([read(videoId), read(videoId)]), [null, null]);
  assert.equal(queries, 1);
  assert.equal(writes.length, 0);
  row = {
    video_id: videoId,
    title: "Actual ready",
    description: "",
    channel: "creator",
    duration_seconds: 20,
    manifest: prefix + "master.m3u8",
    thumbnail: prefix + "thumbnail.jpg",
    published_at: new Date(),
    publication_version: 1,
  };
  assert.equal((await read(videoId)).title, "Actual ready");
  assert.equal(queries, 2);
  assert.equal((await read(videoId)).title, "Actual ready");
  assert.equal(queries, 2);
  assert.deepEqual(writes[0].options, { EX: 3600 });
  assert.equal("views" in writes[0].v, false);
  const failedCache = {
    get: async () => {
      throw Error("offline");
    },
    set: async () => {
      throw Error("offline");
    },
  };
  assert.equal((await readyReader(pool, failedCache)(videoId)).videoId, videoId);
});

test("canceled subprocess is force-terminated and awaited before cleanup", async () => {
  const { run } = await import("../dist/lib/media.js"),
    fs = await import("node:fs/promises"),
    os = await import("node:os"),
    path = await import("node:path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "youtube-process-check-")),
    pidPath = path.join(dir, "pid"),
    abort = new AbortController();
  try {
    const work = run(
      process.execPath,
      [
        "-e",
        'const fs=require("node:fs");process.on("SIGTERM",()=>{});fs.writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)',
        pidPath,
      ],
      abort.signal,
      5000,
    );
    let pid;
    for (let i = 0; i < 100; i++) {
      try {
        pid = Number(await fs.readFile(pidPath, "utf8"));
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    assert.ok(pid);
    abort.abort();
    await assert.rejects(work);
    assert.throws(
      () => process.kill(pid, 0),
      (e) => e.code === "ESRCH",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("packager accepts a one-segment short VOD and binds its marker inventory", async () => {
  const { handle, bindMarker } = await import("../dist/extensions/transcoder-packager.js"),
    fs = await import("node:fs/promises"),
    os = await import("node:os"),
    path = await import("node:path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "youtube-package-check-"));
  const videoId = randomUUID(),
    jobId = randomUUID(),
    attemptId = randomUUID(),
    job = {
      schemaVersion: 1,
      type: "VideoProcessingRequested",
      eventId: logicalEventId(jobId, attemptId, "VideoProcessingRequested"),
      occurredAt: new Date().toISOString(),
      videoId,
      jobId,
      attemptId,
      originalKey: `originals/${videoId}/${randomUUID()}/source.mp4`,
      expectedSize: 1,
      expectedSha256: "a".repeat(64),
    };
  try {
    for (const height of [360, 720]) {
      await fs.mkdir(path.join(dir, String(height)));
      await fs.writeFile(
        path.join(dir, String(height), "index.m3u8"),
        "#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:1,\nsegment00000.ts\n#EXT-X-ENDLIST\n",
      );
      await fs.writeFile(path.join(dir, String(height), "segment00000.ts"), "segment");
    }
    await fs.writeFile(path.join(dir, "thumbnail.jpg"), "thumbnail");
    const marker = await handle(dir, job, 1);
    assert.equal(marker.inventory.length, 6);
    assert.throws(() => bindMarker({ ...marker, originalSha256: "b".repeat(64) }, job));
    assert.throws(() =>
      bindMarker(
        {
          ...marker,
          inventory: marker.inventory.map((i, n) => (n === 0 ? { ...i, path: "../escape.ts" } : i)),
        },
        job,
      ),
    );
    await fs.writeFile(
      path.join(dir, "360", "index.m3u8"),
      "#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n../escape.ts\n#EXT-X-ENDLIST\n",
    );
    await assert.rejects(handle(dir, job, 1));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("playback threshold ignores seek/suspension/background/rate samples and survives pause", async () => {
  const { PlaybackPolicy } = await import("../dist-public/playback-policy.js");
  const p = new PlaybackPolicy();
  p.sample(0, 0, true);
  for (let i = 1; i <= 4; i++) assert.equal(p.sample(i / 4, i * 250, true), false);
  assert.equal(p.seconds, 1);
  p.reset(); // actual seek event before a large jump
  assert.equal(p.sample(15, 1250, true), false);
  assert.equal(p.sample(19, 5250, true), false); // suspended callback
  assert.equal(p.seconds, 1);
  p.sample(19.25, 5500, false); // background/paused/waiting/non-normal rate
  p.sample(19.5, 5750, false);
  assert.equal(p.seconds, 1);
  p.reset(); // resume retains qualifying time
  p.sample(10, 6000, true);
  for (let i = 1; i <= 3; i++) assert.equal(p.sample(10 + i / 4, 6000 + i * 250, true), false);
  assert.equal(p.sample(11, 7000, true), true);
  p.reset();
  p.sample(0, 8000, true);
  for (let i = 1; i <= 12; i++) assert.equal(p.sample(i / 4, 8000 + i * 250, true), false);
  assert.equal(p.seconds, 2); // one latch for this mounted page
  const seek = new PlaybackPolicy();
  seek.sample(0, 0, true);
  seek.sample(12, 250, true);
  assert.equal(seek.seconds, 0); // jump also refused if a browser misses a seek event
});

test("search public projection imports with path validation; empty mapping upgrades preserve data", async () => {
  const { assertSearch, mapping, publicDocument } = await import("../dist/lib/search-schema.js");
  const { searchInput, handle } = await import("../dist/extensions/search-query.js");
  assert.equal(publicDocument.safeParse({}).success, false);
  for (const q of [
    { q: "" },
    { q: "a", page: "0" },
    { q: "a", page: "101" },
    { q: "a", page: "1", size: "500" },
  ])
    assert.equal(searchInput.safeParse(q).success, false);
  assert.deepEqual(searchInput.parse({ q: " title " }), { q: "title", page: 1 });
  let existing = {},
    changed = 0,
    nonempty = false;
  const client = {
    indices: {
      exists: async () => ({ body: true }),
      getSettings: async () => ({
        body: {
          videos: { settings: { index: { number_of_shards: "1", number_of_replicas: "0" } } },
        },
      }),
      getMapping: async () => ({ body: { videos: { mappings: existing } } }),
      putMapping: async (input) => {
        assert.deepEqual(input.body, mapping);
        changed++;
      },
    },
    count: async () => ({ body: { count: nonempty ? 1 : 0 } }),
  };
  await assertSearch(client);
  assert.equal(changed, 1);
  existing = { properties: { title: { type: "keyword" } } };
  await assert.rejects(assertSearch(client), /properties.title.type/);
  existing = {};
  nonempty = true;
  await assert.rejects(assertSearch(client), /nonempty index/);
  existing = mapping;
  await assertSearch(client);
  assert.equal(changed, 2);
  await assert.rejects(
    handle({ search: async () => ({ body: { timed_out: true } }) }, { q: "title", page: 1 }),
    /Incomplete/,
  );
});

test("implemented HTTP service returns finite 404 for unknown routes", async () => {
  const service = await createHttpService(
    "real",
    { requestTimeoutMs: 1000, concurrencyLimit: 1 },
    () => {},
  );
  const r = await service.app.inject({ method: "GET", url: "/unknown" });
  assert.equal(r.statusCode, 404);
  assert.equal(r.json().error, "NOT_FOUND");
  await service.close();
});

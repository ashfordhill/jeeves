// YouTube v3's watch, count and favorites code, offline (V3-15). Node's own runner, no setup:
// after `pnpm install`, run `node --test "test/*.test.ts"` in this folder.
import assert from "node:assert/strict";
import { test } from "node:test";
import type pg from "pg";
import { HttpError } from "../src/runtime/http.ts";
import { createEventCounter } from "../src/runtime/event-counter.ts";
import { createPositiveReader } from "../src/runtime/positive-cache.ts";
import type { Caller, ModuleRequest } from "../src/modules/entry.ts";
import type { DatabaseReadWriter, QueuePublisher } from "../src/modules/dependencies.ts";
import { accountApiFavoriteVideosHooks } from "../src/modules/account-api/account-api-favorite-videos.hooks.ts";
import { viewCounterReceiptAndIncrementHooks } from "../src/modules/view-counter/view-counter-receipt-and-increment.hooks.ts";
import { watchApiVideoDetailsCacheHooks } from "../src/modules/watch-api/watch-api-video-details-cache.hooks.ts";
import { watchApiViewCountReader } from "../src/modules/watch-api/watch-api-view-count-reader.ts";
import { watchApiViewPublisher } from "../src/modules/watch-api/watch-api-view-publisher.ts";
import { resultPrefix, viewPlayed } from "../src/modules/video-contract.ts";

const VIDEO = "0f6e53ad-79bd-4ebc-85cb-9e4cb09a3678";
const JOB = "90a284aa-6f0f-4c47-9b8f-3e2c33e1f0a1";
const ATTEMPT = "72aa8a13-0b5a-4d7f-8f55-2a0f2d6d1c11";
const OTHER = "71e8c353-0000-4000-8000-000000000001";
const PLAY = "5d5c8a42-6c1e-4d2b-9a43-0e7c1b9f4a10";
const SUBJECT = "6b0f5f8e-2b2c-4b7e-9f1a-3d6e9c0b7a55";
const prefix = resultPrefix(VIDEO, JOB, ATTEMPT);
const row = {
  video_id: VIDEO,
  title: "A title",
  description: "A tone.",
  channel: "creator",
  duration_seconds: 20,
  manifest: `${prefix}master.m3u8`,
  thumbnail: `${prefix}thumbnail.jpg`,
  published_at: new Date("2026-11-11T23:02:45.681Z"),
  publication_version: 1,
};
const refusal = (status: number, code: string) => (error: unknown) =>
  error instanceof HttpError && error.statusCode === status && error.code === code;
/** A pool whose published.videos holds `rows`, counting its queries. */
function source(rows: (typeof row)[]) {
  const queries: unknown[][] = [];
  const pool = {
    async query(_sql: string, values: unknown[]) {
      queries.push(values);
      const found = rows.filter((r) => r.video_id === values[0]);
      return { rows: found, rowCount: found.length };
    },
  };
  return { pool: pool as unknown as pg.Pool, queries };
}

test("details: a ready video is loaded once, then answered from the cache; others are never cached", async () => {
  const db = source([row]);
  const cache = new Map<string, { value: string; PXAT: number }>();
  const read = createPositiveReader({
    adapter: watchApiVideoDetailsCacheHooks({ source: db.pool }),
    ttlSeconds: 3601,
    cache: {
      get: async (key) => cache.get(key)?.value ?? null,
      set: async (key, value, expiry) => cache.set(key, { value, ...expiry }),
    },
  });
  const first = await read({ key: VIDEO.toUpperCase() });
  assert.deepEqual(first, {
    videoId: VIDEO,
    publicationVersion: 1,
    title: "A title",
    description: "A tone.",
    channel: "creator",
    durationSeconds: 20,
    manifest: row.manifest,
    thumbnail: row.thumbnail,
    publishedAt: "2026-11-11T23:02:45.681Z",
    visibility: "public",
    state: "ready",
    manifestUrl: `/cdn/video-delivery/${row.manifest}`,
    thumbnailUrl: `/cdn/video-delivery/${row.thumbnail}`,
  });
  assert.deepEqual([...cache.keys()], [`ready-video:v1:${VIDEO}`]);
  const ttl = (cache.get(`ready-video:v1:${VIDEO}`)?.PXAT ?? 0) - Date.now();
  assert.ok(ttl > 3599_000 && ttl <= 3601_000);
  assert.deepEqual(await read({ key: VIDEO }), first);
  assert.equal(db.queries.length, 1);
  assert.equal(await read({ key: OTHER }), null);
  assert.equal(await read({ key: OTHER }), null);
  assert.equal(db.queries.length, 3);
  assert.equal(cache.size, 1);
  assert.throws(() => read({ key: "not-a-video" }), refusal(400, "VIDEO_ID"));
});

test("details: a cached record must parse, be this video's and keep its delivery URLs", () => {
  const hooks = watchApiVideoDetailsCacheHooks({ source: source([]).pool });
  const record = hooks.codec.parse({
    videoId: VIDEO,
    publicationVersion: 1,
    title: "A title",
    description: "",
    channel: "creator",
    durationSeconds: 20,
    manifest: row.manifest,
    thumbnail: row.thumbnail,
    publishedAt: "2026-11-11T23:02:45.681Z",
    visibility: "public",
    state: "ready",
    manifestUrl: `/cdn/video-delivery/${row.manifest}`,
    thumbnailUrl: `/cdn/video-delivery/${row.thumbnail}`,
  });
  assert.equal(hooks.eligible(record, { key: VIDEO }), true);
  assert.equal(hooks.eligible(record, { key: OTHER }), false);
  assert.throws(() => hooks.codec.parse({ ...record, thumbnailUrl: "https://elsewhere.example/x.jpg" }));
  assert.throws(() => hooks.codec.parse({ ...record, views: "3" }));
  assert.equal(hooks.expiresAt?.(record), null);
});

const caller = (signedIn: boolean): Caller =>
  signedIn ? { signedIn: true, principal: { subject: SUBJECT, claims: {} } } : { signedIn: false };
const request = (method: string, path: string, body?: unknown, signedIn = false): ModuleRequest => ({
  method,
  path,
  query: {},
  headers: {},
  body,
  caller: caller(signedIn),
});
function metadata(ready: string[]): DatabaseReadWriter {
  return {
    query: async <Row>(_sql: string, values?: readonly unknown[]) =>
      (ready.includes(String(values?.[0])) ? [{ publication_version: 1 }] : []) as Row[],
    execute: async () => ({ rowCount: 0 }),
  };
}

test("a play of a ready video sends one ViewPlayed with its viewer, its event ID as message ID", async () => {
  const sent: { body: unknown; messageId?: string }[] = [];
  const viewEvents: QueuePublisher = {
    publish: async (message, options) => {
      sent.push({ body: JSON.parse(Buffer.from(message).toString()), messageId: options?.messageId });
    },
  };
  const dependencies = { viewEvents, metadata: metadata([VIDEO]) };
  const anonymous = await watchApiViewPublisher(dependencies, request("POST", `/${VIDEO}`, { eventId: PLAY.toUpperCase() }));
  assert.equal(anonymous.status, 202);
  assert.deepEqual(Object.keys(anonymous.body as object), ["eventId", "accepted", "acceptedAt", "publicationVersion"]);
  const signedIn = await watchApiViewPublisher(dependencies, request("POST", `/${VIDEO}`, { eventId: OTHER }, true));
  assert.equal(signedIn.status, 202);
  assert.equal(sent.length, 2);
  const [first, second] = sent.map((m) => ({ ...m, event: viewPlayed.parse(m.body) }));
  assert.equal(first?.messageId, PLAY);
  assert.equal(first?.event.eventId, PLAY);
  assert.equal(first?.event.viewer, null);
  assert.equal(second?.messageId, OTHER);
  assert.equal(second?.event.viewer, SUBJECT);
  assert.equal(first?.event.videoId, VIDEO);
  await assert.rejects(
    watchApiViewPublisher(dependencies, request("POST", `/${OTHER}`, { eventId: PLAY })),
    refusal(404, "VIDEO_NOT_READY"),
  );
  for (const body of [undefined, {}, { eventId: "x" }, { eventId: PLAY, playedSeconds: 2 }])
    await assert.rejects(watchApiViewPublisher(dependencies, request("POST", `/${VIDEO}`, body)), refusal(400, "VIEW_REQUEST"));
  await assert.rejects(watchApiViewPublisher(dependencies, request("POST", "/nope", { eventId: PLAY })), refusal(400, "VIEW_REQUEST"));
  await assert.rejects(watchApiViewPublisher(dependencies, request("POST", "/", { eventId: PLAY })), refusal(404, "NOT_FOUND"));
  assert.equal((await watchApiViewPublisher(dependencies, request("GET", `/${VIDEO}`))).status, 405);
  assert.equal(sent.length, 2);
});

test("the counter counts a play once towards its video, whatever its accept time", () => {
  const counter = createEventCounter(
    {
      receipts: { schema: "view_counter_receipt_and_increment", table: "receipts" },
      totals: { schema: "view_counter_receipt_and_increment", table: "totals" },
    },
    viewCounterReceiptAndIncrementHooks(),
  );
  const play = (acceptedAt: string, viewer: string | null = SUBJECT) => ({
    schemaVersion: 1,
    type: "ViewPlayed",
    eventId: PLAY,
    occurredAt: acceptedAt,
    videoId: VIDEO,
    acceptedAt,
    publicationVersion: 1,
    viewer,
  });
  const first = counter.parse(play("2026-11-11T23:10:00.000Z"), PLAY);
  const retry = counter.parse(play("2026-11-11T23:10:03.000Z"), PLAY);
  assert.deepEqual(first, retry);
  assert.equal(first.aggregateKey, VIDEO);
  assert.equal(first.eventId, PLAY);
  assert.deepEqual(first.identity, { schemaVersion: 1, type: "ViewPlayed", videoId: VIDEO, eventId: PLAY, publicationVersion: 1, viewer: SUBJECT });
  assert.equal((counter.parse(play("2026-11-11T23:10:00.000Z", null), PLAY).identity as { viewer: null }).viewer, null);
  assert.throws(() => counter.parse(play("2026-11-11T23:10:00.000Z"), OTHER));
  assert.throws(() => counter.parse({ ...play("2026-11-11T23:10:00.000Z"), views: 2 }, PLAY));
});

test("a view count is the counter's public total, read fresh", async () => {
  const totals: Record<string, string> = { [VIDEO]: "3" };
  const viewCounts: DatabaseReadWriter = {
    query: async <Row>(sql: string, values?: readonly unknown[]) => {
      assert.match(sql, /FROM view_counter_receipt_and_increment_public\.totals /);
      const total = totals[String(values?.[0])];
      return (total === undefined ? [] : [{ total }]) as Row[];
    },
    execute: async () => ({ rowCount: 0 }),
  };
  const read = (method: string, path: string) => watchApiViewCountReader({ viewCounts }, request(method, path));
  assert.deepEqual(await read("GET", `/${VIDEO.toUpperCase()}`), { body: { views: "3" } });
  totals[VIDEO] = "4";
  assert.deepEqual(await read("GET", `/${VIDEO}`), { body: { views: "4" } });
  assert.deepEqual(await read("GET", `/${OTHER}`), { body: { views: "0" } });
  await assert.rejects(read("GET", "/nope"), refusal(400, "VIDEO_ID"));
  await assert.rejects(read("GET", `/${VIDEO}/more`), refusal(404, "NOT_FOUND"));
  assert.equal((await read("POST", `/${VIDEO}`)).status, 405);
});

test("only a ready video, by its canonical ID, may be a favorite", async () => {
  const hooks = accountApiFavoriteVideosHooks({ items: source([row]).pool });
  assert.equal(await hooks.eligible(VIDEO), true);
  assert.equal(await hooks.eligible(OTHER), false);
  assert.equal(await hooks.eligible(VIDEO.toUpperCase()), false);
  assert.equal(await hooks.eligible("video-1"), false);
});

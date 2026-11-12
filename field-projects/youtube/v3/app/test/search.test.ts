// YouTube v3's search hooks, offline (V3-16). Node's own runner, no setup: after `pnpm install`,
// run `node --test "test/*.test.ts"` in this folder. The template's real index assertion,
// projection worker and query run on an in-memory OpenSearch.
import assert from "node:assert/strict";
import { test } from "node:test";
import { NonRetryable, type MessageHandler } from "../src/runtime/delivery.ts";
import {
  createSearchHandler,
  openSearchIndex,
  startSearchIndexWorker,
} from "../src/runtime/tile-search.ts";
import {
  publicVideoMapping,
  searchIndexerIndexWriterHooks,
} from "../src/modules/search-indexer/search-indexer-index-writer.hooks.ts";
import {
  publicVideoQueryPreset,
  searchApiVideoSearchHooks,
} from "../src/modules/search-api/search-api-video-search.hooks.ts";
import { videoLifecycleLifecycleWriterHooks } from "../src/modules/video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";
import { publicationEventId, resultPrefix } from "../src/modules/video-contract.ts";

const VIDEO = "9cf3ea9a-0037-4598-8782-554903f0af3a";
const JOB = "83a61e58-1ce1-41b3-8c60-56557a119dba";
const ATTEMPT = "22cd0479-4e27-4baf-80a2-6a420fb239a4";
const OTHER = "756340b8-430b-44ec-a621-c90f23c42e2f";
const AT = "2026-11-11T12:00:00.000Z";
const prefix = resultPrefix(VIDEO, JOB, ATTEMPT);

/** What the lifecycle publishes for a ready video (V3-14's real construct). */
async function published(videoId = VIDEO) {
  const p = resultPrefix(videoId, JOB, ATTEMPT);
  const ready = {
    assetId: videoId,
    jobId: JOB,
    attemptId: ATTEMPT,
    metadata: { title: "Test card", description: "A 440 Hz tone.", channel: "creator" },
    result: {
      prefix: p,
      manifest: `${p}master.m3u8`,
      thumbnail: `${p}thumbnail.jpg`,
      marker: `${p}_complete.json`,
      durationSeconds: 20,
      renditions: [360, 720].map((height) => ({
        height,
        width: height === 360 ? 640 : 1280,
        playlist: `${p}${height}/index.m3u8`,
        videoCodec: "h264",
        audioCodec: "aac",
      })),
    },
    readyAt: AT,
    publicationVersion: 1 as const,
  };
  const hooks = videoLifecycleLifecycleWriterHooks();
  const tx = {} as Parameters<typeof hooks.publication.construct>[0];
  return hooks.publication.construct(tx, ready, publicationEventId(videoId)) as Promise<Record<string, unknown>>;
}

/** An OpenSearch with one node: indices, external versions and the search requests it saw. */
function openSearch() {
  const indices = new Map<string, { settings: unknown; mappings: Record<string, unknown> }>();
  const docs = new Map<string, { version: number; body: Record<string, unknown> }>();
  const searches: Record<string, unknown>[] = [];
  let answer: (body: Record<string, unknown>) => { _id: string; _source: unknown }[] = () =>
    [...docs].map(([id, doc]) => ({ _id: id, _source: doc.body }));
  return {
    docs,
    indicesMap: indices,
    searches,
    answer(f: typeof answer) {
      answer = f;
    },
    indices: {
      async exists({ index }: { index: string }) {
        return { body: indices.has(index) };
      },
      async create({ index, body }: { index: string; body: { settings: unknown; mappings: Record<string, unknown> } }) {
        indices.set(index, structuredClone(body));
      },
      async getMapping({ index }: { index: string }) {
        return { body: { [index]: { mappings: indices.get(index)?.mappings } } };
      },
      async getSettings({ index }: { index: string }) {
        return { body: { [index]: { settings: { index: { number_of_shards: "1", number_of_replicas: "0" } } } } };
      },
    },
    async index(request: { id: string; version: number; version_type: string; body: Record<string, unknown> }) {
      assert.equal(request.version_type, "external_gte");
      const prior = docs.get(request.id);
      if (prior && prior.version > request.version)
        throw Object.assign(new Error("version_conflict_engine_exception"), { meta: { statusCode: 409 } });
      docs.set(request.id, { version: request.version, body: structuredClone(request.body) });
      return { body: {} };
    },
    async search(request: { index: string; body: Record<string, unknown> }) {
      searches.push(request.body);
      const hits = answer(request.body);
      return { body: { timed_out: false, _shards: { failed: 0 }, hits: { total: { value: hits.length, relation: "eq" }, hits } } };
    },
  };
}

/** The Index writer's loop with a consumer whose handler the test calls, as the broker would. */
async function indexer(client: ReturnType<typeof openSearch>) {
  const hooks = searchIndexerIndexWriterHooks();
  const index = await openSearchIndex(client as never, "videos", hooks);
  let handle: MessageHandler | undefined;
  await startSearchIndexWorker({
    client: client as never,
    index,
    hooks,
    openConsumer: async (h) => {
      handle = h;
      return { close: async () => {}, closed: new Promise(() => {}) };
    },
  });
  return (body: unknown, messageId: string) =>
    handle!(Buffer.from(JSON.stringify(body)), { messageId } as Parameters<MessageHandler>[1]);
}

test("the index is created at start from the Index writer's mapping: v2's public video mapping, strict", async () => {
  assert.deepEqual(publicVideoMapping, {
    version: 1,
    properties: {
      videoId: { type: "keyword" },
      publicationVersion: { type: "integer" },
      visibility: { type: "keyword" },
      state: { type: "keyword" },
      title: { type: "text" },
      description: { type: "text" },
      channel: { type: "text" },
      durationSeconds: { type: "double" },
      manifest: { type: "keyword", index: false },
      thumbnail: { type: "keyword", index: false },
      publishedAt: { type: "date" },
    },
  });
  const client = openSearch();
  const index = await openSearchIndex(client as never, "videos", searchIndexerIndexWriterHooks());
  assert.ok(index);
  assert.deepEqual(client.indicesMap.get("videos")?.mappings, {
    dynamic: "strict",
    _meta: { version: 1 },
    properties: publicVideoMapping.properties,
  });
  // The query process opens the same index and finds it compatible.
  assert.ok(await openSearchIndex(client as never, "videos", searchIndexerIndexWriterHooks()));
});

test("a VideoPublished indexes its public record, without the envelope, at its version", async () => {
  const client = openSearch();
  const deliver = await indexer(client);
  const event = await published();
  await deliver(event, publicationEventId(VIDEO));
  assert.deepEqual(client.docs.get(VIDEO), {
    version: 1,
    body: {
      videoId: VIDEO,
      publicationVersion: 1,
      title: "Test card",
      description: "A 440 Hz tone.",
      channel: "creator",
      durationSeconds: 20,
      manifest: `${prefix}master.m3u8`,
      thumbnail: `${prefix}thumbnail.jpg`,
      publishedAt: AT,
      visibility: "public",
      state: "ready",
    },
  });
  // A repeat is the same document again; nothing else changes.
  await deliver(event, publicationEventId(VIDEO));
  assert.equal(client.docs.size, 1);
});

test("a message that isn't a bound, public VideoPublished is MALFORMED_MESSAGE and indexes nothing", async () => {
  const client = openSearch();
  const deliver = await indexer(client);
  const event = await published();
  const refused = async (body: unknown, messageId = publicationEventId(VIDEO)) => {
    await assert.rejects(deliver(body, messageId), (error) => error instanceof NonRetryable && error.code === "MALFORMED_MESSAGE");
  };
  await refused(event, OTHER); // another message's ID
  await refused({ ...event, visibility: "private" });
  await refused({ ...event, state: "processing" });
  await refused({ ...event, owner: "someone" }); // a field the index doesn't map
  await refused({ ...event, thumbnail: `${resultPrefix(VIDEO, JOB, OTHER)}thumbnail.jpg` });
  await refused({ ...event, type: "ProcessingSucceeded" });
  assert.equal(client.docs.size, 0);
});

test("a search uses v1/v2's preset and bounds, and answers each hit with its CDN thumbnail", async () => {
  const client = openSearch();
  const deliver = await indexer(client);
  await deliver(await published(), publicationEventId(VIDEO));
  const indexHooks = searchIndexerIndexWriterHooks();
  const search = createSearchHandler({
    client: client as never,
    index: await openSearchIndex(client as never, "videos", indexHooks),
    indexHooks,
    hooks: searchApiVideoSearchHooks(),
  });
  const answer = await search({ q: "  test card ", page: "2" });
  assert.deepEqual(client.searches[0], {
    from: 20,
    size: 20,
    track_total_hits: true,
    timeout: "750ms",
    query: {
      bool: {
        filter: [{ term: { state: "ready" } }, { term: { visibility: "public" } }],
        must: [{ multi_match: { query: "test card", fields: ["title^3", "description", "channel^2"], type: "best_fields" } }],
      },
    },
    sort: [{ _score: "desc" }, { publishedAt: "desc" }, { videoId: "asc" }],
  });
  assert.deepEqual(answer, {
    q: "test card",
    page: 2,
    pageSize: 20,
    total: 1,
    hits: [
      {
        videoId: VIDEO,
        title: "Test card",
        description: "A 440 Hz tone.",
        channel: "creator",
        durationSeconds: 20,
        publishedAt: AT,
        thumbnailUrl: `/cdn/video-delivery/${prefix}thumbnail.jpg`,
      },
    ],
  });
  assert.equal(publicVideoQueryPreset.query({ q: "x", page: 1 }).bool?.filter?.length, 2);
  // The template's bounds: 1–200 characters, pages 1–100, nothing else in the query.
  for (const bad of [{ q: "" }, { q: "x".repeat(201) }, { q: "x", page: "101" }, { q: "x", page: "0" }, { q: "x", sort: "views" }])
    await assert.rejects(search(bad));
  // A hit that isn't its own document's ID, or isn't a public ready record, is refused.
  const doc = client.docs.get(VIDEO)!.body;
  client.answer(() => [{ _id: OTHER, _source: doc }]);
  await assert.rejects(search({ q: "test" }));
  client.answer(() => [{ _id: VIDEO, _source: { ...doc, visibility: "private" } }]);
  await assert.rejects(search({ q: "test" }));
});

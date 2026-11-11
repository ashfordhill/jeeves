import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The exact emitted search scaffold (V3-08) with the generic search libraries it composes, on an
// in-memory OpenSearch. `createConsumer` (amqplib) is replaced by the delivery runner over an
// in-memory transport, as in tile-loop.test.ts.
const urls = new Map<string, string>();
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
function moduleUrl(name: string): string {
  const old = urls.get(name);
  if (old) return old;
  if (name === "amqp") {
    const url = dataUrl(`
      import { createDeliveryRunner } from "${moduleUrl("delivery")}";
      export async function createConsumer(binding, options) {
        const events = [];
        const runner = createDeliveryRunner({
          ...options,
          transport: {
            async cancel() {},
            async republish(destination, message, headers) {
              events.push({ republish: destination, receipt: message.receipt, headers });
            },
            ack(receipt) { events.push({ ack: receipt }); },
            async close() {},
          },
        });
        return {
          options, events, close: runner.close, closed: runner.closed,
          deliver: (receipt, body, messageId = receipt) =>
            runner.accept({ body: Buffer.from(body), messageId, headers: {}, redelivered: false, receipt }),
        };
      }`);
    urls.set(name, url);
    return url;
  }
  const base = new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts`, import.meta.url);
  const source = readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8");
  const js = stripTypeScriptTypes(source).replace(
    /from "\.\/(.+)\.ts"/g,
    (_match, dependency: string) => `from "${moduleUrl(dependency)}"`,
  );
  const url = dataUrl(js);
  urls.set(name, url);
  return url;
}
const search = await import(moduleUrl("tile-search"));
const loop = await import(moduleUrl("tile-loop"));
const { NotImplemented } = await import(moduleUrl("tile-process"));

type Doc = { itemId: string; title: string; version: number };
/** An OpenSearch with one node: indices, versioned documents and a title search. */
function openSearch(options: { racing?: boolean } = {}) {
  const indices = new Map<string, { mappings: Record<string, unknown> }>();
  const docs = new Map<string, { version: number; body: Doc }>();
  const created: string[] = [];
  let racing = options.racing ?? false;
  return {
    created,
    docs,
    indices: {
      async exists({ index }: { index: string }) {
        return { body: indices.has(index) };
      },
      async create({
        index,
        body,
      }: {
        index: string;
        body: { mappings: Record<string, unknown> };
      }) {
        // Another process created it between this one's check and its create.
        if (racing) {
          racing = false;
          indices.set(index, { mappings: body.mappings });
          throw new Error("resource_already_exists_exception");
        }
        if (indices.has(index)) throw new Error("resource_already_exists_exception");
        created.push(index);
        indices.set(index, { mappings: body.mappings });
      },
      async getMapping({ index }: { index: string }) {
        return { body: { [index]: { mappings: indices.get(index)?.mappings } } };
      },
      async getSettings({ index }: { index: string }) {
        return {
          body: {
            [index]: { settings: { index: { number_of_shards: "1", number_of_replicas: "0" } } },
          },
        };
      },
    },
    async index(request: { id: string; version: number; body: Doc }) {
      const prior = docs.get(request.id);
      // `external_gte`: an older version is a conflict, as OpenSearch answers it.
      if (prior && prior.version > request.version)
        throw Object.assign(new Error("version_conflict_engine_exception"), {
          meta: { statusCode: 409 },
        });
      docs.set(request.id, { version: request.version, body: request.body });
      return { body: {} };
    },
    async search(request: { body: { query: { match: { title: string } }; from: number } }) {
      const hits = [...docs]
        .filter(([, doc]) => doc.body.title.includes(request.body.query.match.title))
        .map(([id, doc]) => ({ _id: id, _source: doc.body }));
      return {
        body: {
          timed_out: false,
          _shards: { failed: 0 },
          hits: { total: { value: hits.length, relation: "eq" }, hits },
        },
      };
    },
  };
}
const unwritten = (what: string) => () => {
  throw new NotImplemented(`${what} for Index writer`);
};
/** The Index writer's hooks, written as a product would (contract section 5's shape). */
const mapping = {
  version: 1,
  properties: {
    itemId: { type: "keyword" },
    title: { type: "text" },
    version: { type: "integer" },
  },
};
const indexHooks = () => ({
  mapping: () => mapping,
  document: {
    parse(input: unknown) {
      const value = input as Doc;
      if (typeof value.itemId !== "string" || typeof value.title !== "string")
        throw new Error("Not an item");
      return value;
    },
    id: (document: Doc) => document.itemId,
    version: (document: Doc) => document.version,
  },
  event(raw: unknown) {
    const value = raw as { eventId: string; item: Doc };
    return { eventId: value.eventId, document: value.item };
  },
});
const queryHooks = () => ({
  preset: () => ({
    query: ({ q }: { q: string }) => ({ match: { title: q } }),
    sort: [{ _score: "desc" }],
  }),
  hit: (document: Doc) => ({ itemId: document.itemId, title: document.title }),
});
const item = (version: number, title = "Hello there") => ({
  eventId: "e1",
  item: { itemId: "item-1", title, version },
});

let lines: Record<string, unknown>[] = [];
beforeEach(() => {
  lines = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(JSON.parse(line));
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("emitted search scaffold (v3 contract, section 5)", () => {
  it("opens no index while mapping isn't written, and asserts it once it is", async () => {
    const client = openSearch();
    const hooks = { ...indexHooks(), mapping: unwritten("mapping") };
    expect(await search.openSearchIndex(client, "items-index", hooks)).toBeUndefined();
    expect(client.created).toEqual([]);
    const opened = await search.openSearchIndex(client, "items-index", indexHooks());
    expect(opened.binding).toEqual({ index: "items-index", ...mapping });
    expect(client.created).toEqual(["items-index"]);
    // The query's process opening it next finds it there, with the same mapping.
    expect(await search.openSearchIndex(client, "items-index", indexHooks())).toBeTruthy();
    expect(client.created).toEqual(["items-index"]);
    // A different mapping is refused: data is kept, and the start fails.
    const other = { ...indexHooks(), mapping: () => ({ ...mapping, version: 2 }) };
    await expect(search.openSearchIndex(client, "items-index", other)).rejects.toThrow(
      "Search mapping items-index incompatible",
    );
  });

  it("opens the index another process created at the same moment", async () => {
    const client = openSearch({ racing: true });
    expect(await search.openSearchIndex(client, "items-index", indexHooks())).toBeTruthy();
    // A create that fails while the index is still missing still fails the start.
    const broken = openSearch();
    broken.indices.create = async () => {
      throw new Error("cluster read-only");
    };
    await expect(search.openSearchIndex(broken, "items-index", indexHooks())).rejects.toThrow(
      "cluster read-only",
    );
  });

  it("sends an event to .failed as NOT_IMPLEMENTED naming the hook it reached, on the real runner", async () => {
    // Lines are rate limited per module and hook a second: the clock moves on between them.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const log = loop.createLoopLog("indexer");
    const row = {
      module: "index-writer",
      queue: "item-events--indexer",
      failedQueue: "item-events--indexer.failed",
      retryLimit: 5,
      concurrency: 4,
    };
    type Fake = {
      options: { queue: string; concurrency: number };
      events: unknown[];
      deliver(receipt: string, body: string): void;
    };
    /** The Index writer's process: its hooks watched, its index opened, its loop subscribed. */
    const start = async (hooks: object) => {
      const client = openSearch();
      const watched = loop.watchHooks(hooks, log, "index-writer");
      const index = await search.openSearchIndex(client, "items-index", watched);
      let consumer: Fake | undefined;
      const worker = await search.startSearchIndexWorker({
        client,
        index,
        hooks: watched,
        openConsumer: async (handle: unknown) => {
          consumer = await loop.loopConsumer(row, loop.templateHandler(log, row, handle), {});
          return consumer;
        },
      });
      if (!consumer) throw new Error("No consumer");
      return { client, worker, consumer };
    };
    const dead = (receipt: string) => [
      {
        republish: row.failedQueue,
        receipt,
        headers: { "x-delivery-attempt": 1, "x-terminal-code": "NOT_IMPLEMENTED" },
      },
      { ack: receipt },
    ];
    // Mapping unwritten: the start logs it once and goes on; each event is dead at once.
    const first = await start({ ...indexHooks(), mapping: unwritten("mapping") });
    expect(first.consumer.options).toMatchObject({ queue: "item-events--indexer", concurrency: 4 });
    expect(lines).toEqual([
      expect.objectContaining({ what: "mapping for Index writer", action: "thrown" }),
    ]);
    vi.setSystemTime(5000);
    first.consumer.deliver("e1", JSON.stringify(item(1)));
    await vi.waitFor(() => expect(first.consumer.events).toEqual(dead("e1")));
    expect(lines.at(-1)).toMatchObject({
      what: "mapping for Index writer",
      action: "sent to item-events--indexer.failed (NOT_IMPLEMENTED)",
    });
    await first.worker.close();
    // Mapping written, event unwritten: the message names `event`, and nothing is indexed.
    const second = await start({ ...indexHooks(), event: unwritten("event") });
    second.consumer.deliver("e2", JSON.stringify({ ...item(1), eventId: "e2" }));
    await vi.waitFor(() => expect(second.consumer.events).toEqual(dead("e2")));
    expect(lines.at(-1)).toMatchObject({ what: "event for Index writer" });
    expect(second.client.docs.size).toBe(0);
    await second.worker.close();
  });

  it("upserts each event's document at its version, and the query finds it as its hit", async () => {
    const client = openSearch();
    const index = await search.openSearchIndex(client, "items-index", indexHooks());
    let handle: ((body: Buffer, delivery: unknown) => Promise<void>) | undefined;
    await search.startSearchIndexWorker({
      client,
      index,
      hooks: indexHooks(),
      openConsumer: async (value: typeof handle) => {
        handle = value;
        return { close: async () => {}, closed: new Promise(() => {}) };
      },
    });
    const deliver = (body: unknown, messageId = "e1") =>
      handle?.(Buffer.from(JSON.stringify(body)), {
        messageId,
        headers: {},
        deliveryCount: 1,
        redelivered: false,
      });
    await deliver(item(2));
    // A repeat and an older version keep the newer document; the older one is done, not retried.
    await deliver(item(2));
    await expect(deliver(item(1, "Stale"))).resolves.toBeUndefined();
    expect(client.docs.get("item-1")?.body.title).toBe("Hello there");
    // Any other failure of the index is retried by the loop.
    const index2 = client.index;
    client.index = async () => {
      throw Object.assign(new Error("cluster_block_exception"), { meta: { statusCode: 429 } });
    };
    await expect(deliver(item(3))).rejects.toThrow("cluster_block_exception");
    client.index = index2;
    // A message whose ID isn't its event's, or a document outside the mapping, is malformed.
    await expect(deliver(item(3), "e2")).rejects.toMatchObject({ code: "MALFORMED_MESSAGE" });
    await expect(
      deliver({ eventId: "e1", item: { itemId: "item-2", title: "x", version: 1, secret: "y" } }),
    ).rejects.toMatchObject({ code: "MALFORMED_MESSAGE" });
    const query = search.createSearchHandler({
      client,
      index,
      indexHooks: indexHooks(),
      hooks: queryHooks(),
    });
    expect(await query({ q: "Hello" })).toEqual({
      q: "Hello",
      page: 1,
      pageSize: 20,
      total: 1,
      hits: [{ itemId: "item-1", title: "Hello there" }],
    });
    expect(await query({ q: "nothing", page: "2" })).toMatchObject({ page: 2, total: 0, hits: [] });
  });

  it("answers a search with the first hook it reaches: mapping, then preset, then hit", async () => {
    const client = openSearch();
    const closed = search.createSearchHandler({
      client,
      index: undefined,
      indexHooks: { mapping: unwritten("mapping") },
      hooks: queryHooks(),
    });
    await expect(closed({ q: "Hello" })).rejects.toThrow(
      "Not implemented: mapping for Index writer",
    );
    const index = await search.openSearchIndex(client, "items-index", indexHooks());
    const preset = search.createSearchHandler({
      client,
      index,
      indexHooks: indexHooks(),
      hooks: {
        ...queryHooks(),
        preset: () => {
          throw new NotImplemented("preset for Item search");
        },
      },
    });
    await expect(preset({ q: "Hello" })).rejects.toThrow("Not implemented: preset for Item search");
    const hit = search.createSearchHandler({
      client,
      index,
      indexHooks: indexHooks(),
      hooks: {
        ...queryHooks(),
        hit: () => {
          throw new NotImplemented("hit for Item search");
        },
      },
    });
    // No document yet: no hit to answer.
    expect(await hit({ q: "Hello" })).toMatchObject({ total: 0, hits: [] });
    await client.index({ id: "item-1", version: 1, body: item(1).item });
    await expect(hit({ q: "Hello" })).rejects.toThrow("Not implemented: hit for Item search");
  });
});

import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkServerIdentity, type PeerCertificate } from "node:tls";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

// The exact emitted module-clients.ts of the stub stack (every section a stub can use), with its
// providers' libraries replaced by in-memory fakes that record what each client asks of them.
const bundle = assembleV2(
  {
    designJson: canonicalJson(
      runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]),
    ),
  },
  loadLocalV2Registry(),
);
const emitted = new TextDecoder().decode(
  bundle.files.find((file) => file.path === "src/runtime/module-clients.ts")?.bytes,
);
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
/** Each fake records what it is asked for in `calls`; the database and broker fakes also record
 * the endpoint they were given in `endpoints`, and the database fake its transport in
 * `transports`. The Pub/Sub client's topic exists unless `pubsub` says not, and `pubsub.publish`
 * answers its publishes when it is set. */
type Calls = {
  calls: unknown[][];
  endpoints: unknown[][];
  transports: unknown[];
  fail?: string;
  hang?: boolean;
  pubsub?: { exists?: boolean; publish?: () => Promise<string> };
};
const fake: Calls = { calls: [], endpoints: [], transports: [] };
(globalThis as { moduleClientsFake?: Calls }).moduleClientsFake = fake;
const check = `
  const fake = globalThis.moduleClientsFake;
  const record = (...call) => fake.calls.push(call);
  const outcome = async (what, value) => {
    record(what);
    if (fake.hang && fake.fail === what) return new Promise(() => {});
    if (fake.fail === what) throw new Error(what + " refused");
    return value;
  };`;
const fakes: Record<string, string> = {
  "../features/local-bindings.ts": `export const localLogins = [{ resource: "links-db", host: "links-api", database: "d_links_db", user: "r_links_db__links_api", secret: "sql-links-db--links-api" }];`,
  "./postgres.ts": `${check}
    export function createPostgres(options) {
      fake.endpoints.push(["postgres", options.hostname, options.port]);
      fake.transports.push(options.tls);
      record("createPostgres", options.login.user, options.poolSize, options.statementTimeoutMs);
      return {
        on: (event) => record("on", event),
        end: async () => record("end"),
        query: (sql, values) => outcome(sql, { rows: [{ sql, values }], rowCount: 3 }),
      };
    }`,
  "./amqp.ts": `${check}
    export async function createPublisher(binding, destination, hooks) {
      fake.endpoints.push(["broker", binding.hostname, binding.port]);
      await outcome("open", undefined);
      record("createPublisher", binding.passwordSecret, destination, hooks.onState);
      return {
        closed: new Promise(() => {}),
        close: async () => record("close"),
        publish: async (body, messageId) => record("publish", Buffer.from(body).toString(), messageId),
      };
    }`,
  redis: `${check}
    export function createClient(options) {
      record("createClient", options);
      // A command records its arguments, then answers, fails or (with hang) never answers.
      const reply = (name, value) => (...args) => {
        record(name, ...args);
        if (fake.hang && fake.fail === name) return new Promise(() => {});
        if (fake.fail === name) return Promise.reject(new Error(name + " refused"));
        return Promise.resolve(typeof value === "function" ? value(...args) : value);
      };
      return {
        on: (event) => record("on", event),
        connect: () => outcome("connect", undefined),
        ping: () => outcome("PING", "PONG"),
        destroy: () => record("destroy"),
        get: reply("get", (key) => (key === "missing" ? null : "value")),
        set: reply("set", "OK"),
        del: reply("del", 1),
      };
    }`,
  "./local.ts": 'export const readSecret = (name) => "secret of " + name;',
  "@google-cloud/pubsub": `${check}
    export class PubSub {
      constructor(options) { record("PubSub", options); }
      topic(name, options) {
        record("topic", name, options);
        return {
          exists: () => outcome("exists", [fake.pubsub?.exists ?? true]),
          publishMessage: (message) => {
            record("publishMessage", Buffer.from(message.data).toString(), message.attributes);
            return fake.pubsub?.publish ? fake.pubsub.publish() : Promise.resolve("1");
          },
        };
      }
      async close() { record("close"); }
    }`,
  "@aws-sdk/client-s3": [
    "AbortMultipartUpload",
    "CreateMultipartUpload",
    "GetObject",
    "HeadBucket",
    "PutObject",
  ]
    .map(
      (name) =>
        `export class ${name}Command { constructor(input) { this.name = "${name}"; this.input = input; } }`,
    )
    .join("\n"),
  "./objects.ts": `${check}
    export function createObjects(options) {
      record("createObjects", options.credentialSecret, options.endpoint);
      return {
        destroy: () => record("destroy"),
        send: async (command) => {
          await outcome(command.name, undefined);
          fake.calls.at(-1).push(command.input);
          if (command.name === "CreateMultipartUpload") return { UploadId: "u1" };
          if (command.name === "GetObject" && command.input.Key === "missing")
            throw Object.assign(new Error("gone"), { name: "NoSuchKey" });
          if (command.name === "GetObject")
            return { Body: { transformToByteArray: async () => new TextEncoder().encode("bytes") } };
          return {};
        },
      };
    }`,
  "./search.ts": `${check}
    export function createSearch(options) {
      record("createSearch", options.endpoint);
      return {
        close: async () => record("close"),
        cluster: { health: () => outcome("health", {}) },
        search: async (request) => (record("search", request), { body: { hits: { hits: [{ _source: { id: 1 } }] } } }),
        index: async (request) => record("index", request),
        delete: async (request) => record("delete", request),
      };
    }`,
};
// The stub cache's bounded client: the exact emitted valkey.ts, on the same fake redis.
fakes["./valkey.ts"] = stripTypeScriptTypes(
  new TextDecoder().decode(
    bundle.files.find((file) => file.path === "src/runtime/valkey.ts")?.bytes,
  ),
).replace(/from "([^"]+)"/g, (match, from: string) =>
  fakes[from] ? `from "${dataUrl(fakes[from])}"` : match,
);
// A stub loop's Pub/Sub subscriber (QG08) shares the loop's runtime: the exact delivery.ts, and a
// stand-in for tile-loop.ts, whose subscriber tile-loop.test.ts runs.
fakes["./delivery.ts"] = stripTypeScriptTypes(
  readFileSync(
    new URL("../../templates/local-v2/assets/src/runtime/delivery.ts.template", import.meta.url),
    "utf8",
  ),
);
fakes["./tile-loop.ts"] =
  'export const failureStep = () => { throw new Error("Not used by these tests"); };';
const tileProcess = dataUrl(
  stripTypeScriptTypes(
    readFileSync(
      new URL(
        "../../templates/local-v2/assets/src/runtime/tile-process.ts.template",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const js = stripTypeScriptTypes(emitted).replace(/from "([^"]+)"/g, (match, from: string) =>
  from === "./tile-process.ts"
    ? `from "${tileProcess}"`
    : fakes[from]
      ? `from "${dataUrl(fakes[from])}"`
      : match,
);
const clients = await import(dataUrl(js));
const { NotImplemented } = await import(tileProcess);
const valkey = await import(dataUrl(String(fakes["./valkey.ts"])));

// The endpoints each process reads, as the stub stack's emitted compose.yaml sets them (QG06):
// every client here is built with exactly those, so a variable Compose doesn't set fails.
const compose = JSON.parse(
  new TextDecoder().decode(bundle.files.find((file) => file.path === "compose.yaml")?.bytes),
) as { services: Record<string, { environment?: Record<string, string> }> };
const localEnvironment: Record<string, string> = Object.assign(
  {},
  ...Object.entries(compose.services)
    .filter(([name]) => name.startsWith("app-"))
    .map(([, service]) =>
      Object.fromEntries(
        Object.entries(service.environment ?? {}).filter(([name]) => name.startsWith("JEEVES_")),
      ),
    ),
);
const touched = new Map<string, string | undefined>();
/** Sets (or, with undefined, unsets) environment variables until the test ends. */
function environment(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) {
    if (!touched.has(name)) touched.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
function restoreEnvironment() {
  for (const [name, value] of touched)
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  touched.clear();
}

function testScope() {
  const owned: (() => unknown)[] = [];
  const transports: unknown[] = [];
  return {
    owned,
    transports,
    own: (drain: () => unknown) => owned.push(drain),
    transport: (value: unknown) => transports.push(value),
    fail: () => {},
    ready: () => {},
  };
}
const lines: Record<string, unknown>[] = [];
const probe = Object.assign((entry: Record<string, unknown>) => lines.push(entry), {
  tile: "links-api",
});
/** What a client wrote to stdout itself (its failure and state lines), parsed. */
function stdout() {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  return {
    lines: () => spy.mock.calls.map(([line]) => JSON.parse(String(line))),
    restore: () => spy.mockRestore(),
  };
}

describe("emitted module-clients.ts (tile process contract, sections 4 and 6)", () => {
  beforeEach(() => environment(localEnvironment));
  afterEach(() => {
    fake.calls.length = 0;
    fake.endpoints.length = 0;
    fake.fail = undefined;
    fake.hang = undefined;
    lines.length = 0;
    vi.useRealTimers();
    restoreEnvironment();
  });

  it("answers Not implemented for what isn't provisioned, called or through a member", async () => {
    const target = clients.unavailable(
      "Partner API for Partner caller (an External API isn't provisioned locally)",
    );
    await expect(target()).rejects.toBeInstanceOf(NotImplemented);
    await expect(target.request("/x")).rejects.toThrow(
      "Not implemented: Partner API for Partner caller (an External API isn't provisioned locally)",
    );
    // It isn't a thenable, so awaiting it doesn't hang.
    expect(target.then).toBeUndefined();
  });

  it("reads and writes a database through the tile's login, after SELECT 1", async () => {
    const scope = testScope();
    const db = await clients.databaseClient(scope, probe, {
      tile: "links-api",
      resource: "links-db",
    });
    expect(fake.calls.slice(0, 3)).toEqual([
      ["createPostgres", "r_links_db__links_api", 10, 2000],
      ["on", "error"],
      ["SELECT 1"],
    ]);
    expect(lines).toEqual([
      { level: "info", client: "links-db", kind: "database", check: "SELECT 1", result: "ok" },
    ]);
    expect(await db.query("SELECT $1", [1])).toEqual([{ sql: "SELECT $1", values: [1] }]);
    expect(await db.execute("DELETE FROM t")).toEqual({ rowCount: 3 });
    expect(scope.owned).toHaveLength(1);
    await expect(
      clients.databaseClient(scope, probe, { tile: "visit-worker", resource: "links-db" }),
    ).rejects.toThrow("No runtime login for links-db");
    // A failed probe logs why and fails startup.
    fake.fail = "SELECT 1";
    await expect(
      clients.databaseClient(scope, probe, { tile: "links-api", resource: "links-db" }),
    ).rejects.toThrow("Startup probe failed: database links-db");
    expect(lines.at(-1)).toEqual({
      level: "error",
      client: "links-db",
      kind: "database",
      check: "SELECT 1",
      result: "failed",
      error: "Error: SELECT 1 refused",
    });
  });

  it("publishes to a topic's exchange or a work queue, with confirms and a fresh message ID", async () => {
    const scope = testScope();
    const onState = () => {};
    const topic = await clients.queuePublisher(
      scope,
      probe,
      { queue: "visits", mode: "topic" },
      onState,
    );
    const work = await clients.queuePublisher(
      scope,
      probe,
      { queue: "uploaded", mode: "work-queue" },
      onState,
    );
    await topic.publish(new TextEncoder().encode("a"), { key: "ignored" });
    await work.publish(new TextEncoder().encode("b"));
    const calls = fake.calls.filter((call) => call[0] !== "open");
    expect(calls.slice(0, 2)).toEqual([
      ["createPublisher", "broker-password", { exchange: "visits", routingKey: "" }, onState],
      ["createPublisher", "broker-password", { exchange: "", routingKey: "uploaded" }, onState],
    ]);
    expect(calls[2]?.slice(0, 2)).toEqual(["publish", "a"]);
    expect(calls[3]?.slice(0, 2)).toEqual(["publish", "b"]);
    expect(calls[2]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[2]?.[2]).not.toBe(calls[3]?.[2]);
    // The publisher drains with the process; a lost broker is told to its state hook.
    expect(scope.owned).toHaveLength(2);
    expect(scope.transports).toHaveLength(2);
    expect(lines.map((line) => [line.client, line.check, line.result])).toEqual([
      ["visits", "open the broker and a confirm channel", "ok"],
      ["uploaded", "open the broker and a confirm channel", "ok"],
    ]);
  });

  it("sends the module's own message ID when it names one, so a repeat is the same message", async () => {
    // YouTube v3 template gap 6: an event counter's receipt is keyed on the message ID, so a
    // retried play must go out as the same message.
    const views = await clients.queuePublisher(testScope(), probe, {
      queue: "view-events",
      mode: "topic",
    });
    const play = new TextEncoder().encode("play");
    await views.publish(play, { messageId: "event-1" });
    await views.publish(play, { messageId: "event-1" });
    await views.publish(play, { key: "ignored" });
    const sent = fake.calls.filter((call) => call[0] === "publish");
    expect(sent.slice(0, 2)).toEqual([
      ["publish", "play", "event-1"],
      ["publish", "play", "event-1"],
    ]);
    expect(sent[2]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    const dependencies = new TextDecoder().decode(
      bundle.files.find((file) => file.path === "src/modules/dependencies.ts")?.bytes,
    );
    expect(dependencies).toContain(
      "publish(message: Uint8Array, options?: { key?: string; messageId?: string }): Promise<void>;",
    );
  });

  it("uses a cache with its password, after PING", async () => {
    const out = stdout();
    try {
      const cache = await clients.cacheClient(testScope(), probe, { cache: "links-cache" });
      // The cache read's bounded client: no offline queue or client reconnect, 32 queued at
      // most, a 500 ms connect.
      expect(fake.calls.slice(0, 4)).toEqual([
        [
          "createClient",
          {
            password: "secret of cache-links-cache",
            disableOfflineQueue: true,
            commandsQueueMaxLength: 32,
            socket: {
              host: "cache-links-cache",
              port: 6379,
              connectTimeout: 500,
              reconnectStrategy: false,
            },
          },
        ],
        ["on", "error"],
        ["connect"],
        ["PING"],
      ]);
      expect(lines).toEqual([
        { level: "info", client: "links-cache", kind: "cache", check: "PING", result: "ok" },
      ]);
      expect(out.lines()).toEqual([
        {
          level: "info",
          event: "cache",
          tile: "links-api",
          cache: "links-cache",
          state: "available",
        },
      ]);
      expect(await cache.get("key")).toBe("value");
      expect(await cache.get("missing")).toBeUndefined();
      await cache.set("key", "value", 60);
      await cache.set("key", "value");
      await cache.delete("key");
      expect(fake.calls.slice(4)).toEqual([
        ["get", "key"],
        ["get", "missing"],
        ["set", "key", "value", { EX: 60 }],
        ["set", "key", "value", undefined],
        ["del", "key"],
      ]);
    } finally {
      out.restore();
    }
  });

  it("settles a stalled cache command at 150 ms, then fails at once until a new client connects 5 s later", async () => {
    vi.useFakeTimers();
    const out = stdout();
    try {
      const cache = await clients.cacheClient(testScope(), probe, { cache: "links-cache" });
      const created = () => fake.calls.filter((call) => call[0] === "createClient").length;
      const destroyed = () => fake.calls.filter((call) => call[0] === "destroy").length;
      // Each of get, set and delete: a command that never answers rejects at its deadline and
      // destroys the client; until the next one connects, every call fails at once.
      const stalls = [
        ["get", () => cache.get("key")],
        ["set", () => cache.set("key", "value", 30)],
        ["del", () => cache.delete("key")],
      ] as const;
      for (const [index, [name, call]] of stalls.entries()) {
        fake.fail = name;
        fake.hang = true;
        let settled: unknown;
        const pending = call().catch((error: Error) => {
          settled = error.message;
        });
        await vi.advanceTimersByTimeAsync(149);
        expect(settled).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1);
        await pending;
        expect(settled).toBe("Cache deadline");
        expect(destroyed()).toBe(index + 1);
        fake.fail = undefined;
        fake.hang = undefined;
        await expect(cache.get("key")).rejects.toThrow("Cache unavailable");
        await expect(cache.set("key", "value")).rejects.toThrow("Cache unavailable");
        await expect(cache.delete("key")).rejects.toThrow("Cache unavailable");
        await vi.advanceTimersByTimeAsync(4999);
        expect(created()).toBe(index + 1);
        await vi.advanceTimersByTimeAsync(1);
        expect(created()).toBe(index + 2);
        expect(await cache.get("key")).toBe("value");
      }
      // Each loss is one failure line through the failure log, each return one info line.
      const lost = {
        level: "error",
        event: "failure",
        tile: "links-api",
        what: "cache links-cache",
        error: "Error: Cache deadline",
      };
      const back = {
        level: "info",
        event: "cache",
        tile: "links-api",
        cache: "links-cache",
        state: "available",
      };
      expect(out.lines()).toEqual([back, lost, back, lost, back, lost, back]);
    } finally {
      out.restore();
    }
  });

  it("starts without a cache that is down at startup, logs unavailable and connects 5 s later", async () => {
    vi.useFakeTimers();
    const out = stdout();
    try {
      // Refused: the first connect fails at once. Stalled (a paused cache): at its 500 ms bound.
      for (const hang of [false, true]) {
        fake.calls.length = 0;
        lines.length = 0;
        fake.fail = "connect";
        fake.hang = hang;
        let started: { get(key: string): Promise<string | undefined> } | undefined;
        const starting = clients
          .cacheClient(testScope(), probe, { cache: "links-cache" })
          .then((cache: typeof started) => {
            started = cache;
          });
        await vi.advanceTimersByTimeAsync(hang ? 499 : 0);
        if (hang) expect(started).toBeUndefined();
        await vi.advanceTimersByTimeAsync(hang ? 1 : 0);
        await starting;
        if (!started) throw new Error("cacheClient did not start");
        expect(lines).toEqual([
          {
            level: "warn",
            client: "links-cache",
            kind: "cache",
            check: "PING",
            result: "unavailable",
          },
        ]);
        expect(fake.calls.filter((call) => call[0] === "PING")).toEqual([]);
        expect(fake.calls.filter((call) => call[0] === "destroy")).toHaveLength(1);
        await expect(started.get("key")).rejects.toThrow("Cache unavailable");
        fake.fail = undefined;
        fake.hang = undefined;
        await vi.advanceTimersByTimeAsync(5000);
        expect(fake.calls.filter((call) => call[0] === "createClient")).toHaveLength(2);
        expect(await started.get("key")).toBe("value");
      }
      const back = {
        level: "info",
        event: "cache",
        tile: "links-api",
        cache: "links-cache",
        state: "available",
      };
      expect(out.lines()).toEqual([
        {
          level: "error",
          event: "failure",
          tile: "links-api",
          what: "cache links-cache",
          error: "Error: connect refused",
        },
        back,
        {
          level: "error",
          event: "failure",
          tile: "links-api",
          what: "cache links-cache",
          error: "Error: Cache deadline",
        },
        back,
      ]);
    } finally {
      out.restore();
    }
  });

  it("destroys the cache client when the process drains, and tries no new one", async () => {
    vi.useFakeTimers();
    const out = stdout();
    try {
      const scope = testScope();
      await clients.cacheClient(scope, probe, { cache: "links-cache" });
      expect(scope.owned).toHaveLength(1);
      await scope.owned[0]?.();
      expect(fake.calls.at(-1)).toEqual(["destroy"]);
      // Closed while lost: the retry is cancelled.
      fake.calls.length = 0;
      fake.fail = "connect";
      const down = testScope();
      await clients.cacheClient(down, probe, { cache: "links-cache" });
      fake.fail = undefined;
      await down.owned[0]?.();
      await vi.advanceTimersByTimeAsync(20000);
      expect(fake.calls.filter((call) => call[0] === "createClient")).toHaveLength(1);
    } finally {
      out.restore();
    }
  });

  it("checks a bucket with what its key allows, and reads and writes objects", async () => {
    const store = await clients.objectClient(testScope(), probe, {
      tile: "upload-api",
      bucket: "archive",
      access: "read-write",
    });
    expect(fake.calls.slice(0, 2)).toEqual([
      ["createObjects", "s3-upload-api", "http://local-objects:3900"],
      ["HeadBucket", { Bucket: "archive" }],
    ]);
    expect(new TextDecoder().decode(await store.get("k"))).toBe("bytes");
    expect(await store.get("missing")).toBeUndefined();
    await store.put("k", new Uint8Array([1]), "text/plain");
    expect(fake.calls.at(-1)).toEqual([
      "PutObject",
      { Bucket: "archive", Key: "k", Body: new Uint8Array([1]), ContentType: "text/plain" },
    ]);
    // A write-only key can't HeadBucket: it opens and aborts a multipart upload instead.
    fake.calls.length = 0;
    await clients.objectClient(testScope(), probe, {
      tile: "visit-worker",
      bucket: "exports",
      access: "write",
    });
    expect(fake.calls.slice(1)).toEqual([
      ["CreateMultipartUpload", { Bucket: "exports", Key: ".probe/visit-worker" }],
      ["AbortMultipartUpload", { Bucket: "exports", Key: ".probe/visit-worker", UploadId: "u1" }],
    ]);
    expect(lines.at(-1)).toMatchObject({
      check: "open and abort a multipart upload",
      result: "ok",
    });
  });

  it("queries and writes a search index after cluster health, and reaches another tile", async () => {
    const index = await clients.searchClient(testScope(), probe, { index: "stats-index" });
    expect(fake.calls.slice(0, 2)).toEqual([
      ["createSearch", "http://search-stats-index:9200"],
      ["health"],
    ]);
    expect(await index.search({ query: { match_all: {} } })).toEqual([{ id: 1 }]);
    await index.index("1", { id: 1 });
    await index.remove("1");
    expect(fake.calls.slice(2)).toEqual([
      ["search", { index: "stats-index", body: { query: { match_all: {} } } }],
      ["index", { index: "stats-index", id: "1", body: { id: 1 } }],
      ["delete", { index: "stats-index", id: "1" }],
    ]);
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    try {
      const target = clients.httpTarget({ tile: "stats-api" });
      await target.request("/modules/stats-search", { method: "POST" });
      expect(fetch).toHaveBeenCalledWith(
        new URL("http://app-stats-api:3000/modules/stats-search"),
        {
          method: "POST",
        },
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("marks a failed call to another tile as internal and passes a response through", async () => {
    const internalCall = Symbol.for("jeeves.internal-call");
    const response = new Response("ok");
    const refused = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED 10.0.0.3:3000"), {
        code: "ECONNREFUSED",
      }),
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(refused)
      .mockRejectedValueOnce("not an object");
    vi.stubGlobal("fetch", fetch);
    try {
      const target = clients.httpTarget({ tile: "stats-api" });
      expect(await target.request("/modules/stats-search")).toBe(response);
      expect(Reflect.get(refused, internalCall)).toBeUndefined();
      await expect(target.request("/modules/stats-search")).rejects.toBe(refused);
      expect(Reflect.get(refused, internalCall)).toBe(true);
      // Only an object can carry the mark; anything else is rethrown as it was.
      await expect(target.request("/modules/stats-search")).rejects.toBe("not an object");
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("bounds each probe to 5 s", async () => {
    vi.useFakeTimers();
    fake.fail = "health";
    fake.hang = true;
    const started = clients.searchClient(testScope(), probe, { index: "stats-index" });
    const failed = expect(started).rejects.toThrow("Startup probe failed: search stats-index");
    await vi.advanceTimersByTimeAsync(5000);
    await failed;
    expect(lines.at(-1)).toMatchObject({ result: "failed", error: "Error: Probe deadline (5 s)" });
  });
});

describe("store and tile endpoints come from the environment (QG06)", () => {
  beforeEach(() => environment(localEnvironment));
  afterEach(() => {
    fake.calls.length = 0;
    fake.endpoints.length = 0;
    fake.fail = undefined;
    lines.length = 0;
    restoreEnvironment();
    vi.unstubAllGlobals();
  });
  const links = { tile: "links-api", resource: "links-db" };
  /** What a client's construction rejects or throws with, for each case's `values` over `base`. */
  async function refusals(
    build: () => unknown,
    cases: readonly [Record<string, string | undefined>, string][],
    base: Record<string, string> = localEnvironment,
  ) {
    const seen: [string, string][] = [];
    for (const [values, variable] of cases) {
      environment(base);
      environment(values);
      const error = await Promise.resolve()
        .then(build)
        .then(
          () => new Error("built"),
          (thrown: Error) => thrown,
        );
      seen.push([error.message, variable]);
      // The message names the variable, never its value.
      for (const value of Object.values(values))
        if (value) expect(error.message).not.toContain(value);
    }
    return seen;
  }
  const expected = (cases: readonly [unknown, string][]) =>
    cases.map(([, variable]) => [`Invalid endpoint ${variable}`, variable]);

  it("passes a database's host and port from its environment to its pool, a Unix socket directory too", async () => {
    environment({
      JEEVES_DATABASE_LINKS_DB_HOST: "db.internal",
      JEEVES_DATABASE_LINKS_DB_PORT: "6432",
    });
    await clients.databaseClient(testScope(), probe, links);
    // A Cloud SQL socket directory, as `pg` reads a host that is an absolute path.
    environment({ JEEVES_DATABASE_LINKS_DB_HOST: "/cloudsql/p:r:i" });
    await clients.databaseClient(testScope(), probe, links);
    environment({
      JEEVES_DATABASE_LINKS_DB_HOST: "a".repeat(253),
      JEEVES_DATABASE_LINKS_DB_PORT: "65535",
    });
    await clients.databaseClient(testScope(), probe, links);
    expect(fake.endpoints).toEqual([
      ["postgres", "db.internal", 6432],
      ["postgres", "/cloudsql/p:r:i", 6432],
      ["postgres", "a".repeat(253), 65535],
    ]);
    expect(lines.map((line) => line.result)).toEqual(["ok", "ok", "ok"]);
  });

  it("fails a database client naming its missing or invalid variable, before any probe", async () => {
    const host = "JEEVES_DATABASE_LINKS_DB_HOST";
    const port = "JEEVES_DATABASE_LINKS_DB_PORT";
    const cases: [Record<string, string | undefined>, string][] = [
      [{ [host]: undefined }, host],
      [{ [host]: "" }, host],
      [{ [host]: "db internal" }, host],
      [{ [host]: "db_internal" }, host],
      [{ [host]: "a".repeat(254) }, host],
      [{ [host]: "cloudsql/p:r:i" }, host],
      [{ [port]: undefined }, port],
      [{ [port]: "0" }, port],
      [{ [port]: "65536" }, port],
      [{ [port]: "05432" }, port],
      [{ [port]: "5432x" }, port],
      [{ [port]: "-1" }, port],
    ];
    expect(await refusals(() => clients.databaseClient(testScope(), probe, links), cases)).toEqual(
      expected(cases),
    );
    // No pool was created and no probe ran or logged.
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("connects a cache at its environment's host and port; a cache's host is never a path", async () => {
    const out = stdout();
    try {
      environment({
        JEEVES_CACHE_LINKS_CACHE_HOST: "10.1.2.3",
        JEEVES_CACHE_LINKS_CACHE_PORT: "6380",
      });
      const scope = testScope();
      await clients.cacheClient(scope, probe, { cache: "links-cache" });
      expect(fake.calls[0]).toEqual([
        "createClient",
        expect.objectContaining({
          password: "secret of cache-links-cache",
          socket: expect.objectContaining({ host: "10.1.2.3", port: 6380 }),
        }),
      ]);
      await scope.owned[0]?.();
      fake.calls.length = 0;
      lines.length = 0;
      const host = "JEEVES_CACHE_LINKS_CACHE_HOST";
      const port = "JEEVES_CACHE_LINKS_CACHE_PORT";
      const cases: [Record<string, string | undefined>, string][] = [
        [{ [host]: undefined }, host],
        [{ [host]: "/run/valkey" }, host],
        [{ [host]: "cache-links-cache:6379" }, host],
        [{ [port]: undefined }, port],
        [{ [port]: "70000" }, port],
      ];
      expect(
        await refusals(
          () => clients.cacheClient(testScope(), probe, { cache: "links-cache" }),
          cases,
        ),
      ).toEqual(expected(cases));
      expect(fake.calls).toEqual([]);
      expect(lines).toEqual([]);
    } finally {
      out.restore();
    }
  });

  it("opens the broker at its environment's host and port, for a publisher and a stub's loop", async () => {
    environment({ JEEVES_BROKER_HOST: "mq.internal", JEEVES_BROKER_PORT: "5673" });
    // What a stub's loop passes to startModuleLoop.
    expect(clients.brokerBinding()).toEqual({
      hostname: "mq.internal",
      port: 5673,
      username: "runtime",
      passwordSecret: "broker-password",
      heartbeatSeconds: 10,
      confirmTimeoutMs: 5000,
    });
    await clients.queuePublisher(testScope(), probe, { queue: "visits", mode: "topic" });
    expect(fake.endpoints).toEqual([["broker", "mq.internal", 5673]]);
    fake.calls.length = 0;
    lines.length = 0;
    const cases: [Record<string, string | undefined>, string][] = [
      [{ JEEVES_BROKER_HOST: undefined }, "JEEVES_BROKER_HOST"],
      [{ JEEVES_BROKER_HOST: "amqp://mq.internal" }, "JEEVES_BROKER_HOST"],
      [{ JEEVES_BROKER_PORT: "" }, "JEEVES_BROKER_PORT"],
    ];
    expect(
      await refusals(
        () => clients.queuePublisher(testScope(), probe, { queue: "visits", mode: "topic" }),
        cases,
      ),
    ).toEqual(expected(cases));
    expect(await refusals(() => clients.brokerBinding(), cases)).toEqual(expected(cases));
    // Refused before the probe: no broker opened and no probe line.
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("calls another tile at its environment's URL: absolute http or https, no credentials, query or fragment", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    environment({ JEEVES_TILE_STATS_API_URL: "https://stats.internal:8443" });
    await clients.httpTarget({ tile: "stats-api" }).request("/modules/stats-search");
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://stats.internal:8443/modules/stats-search"),
      undefined,
    );
    const name = "JEEVES_TILE_STATS_API_URL";
    const credentials = ["http://", ["user", "pass"].join(":"), "@stats.internal"].join("");
    const cases: [Record<string, string | undefined>, string][] = [
      [{ [name]: undefined }, name],
      [{ [name]: "" }, name],
      [{ [name]: "/modules" }, name],
      [{ [name]: "stats.internal:8443" }, name],
      [{ [name]: "ftp://stats.internal" }, name],
      [{ [name]: credentials }, name],
      [{ [name]: "http://user@stats.internal" }, name],
      [{ [name]: "http://stats.internal/?a=1" }, name],
      [{ [name]: "http://stats.internal/?" }, name],
      [{ [name]: "http://stats.internal/#top" }, name],
    ];
    expect(await refusals(() => clients.httpTarget({ tile: "stats-api" }), cases)).toEqual(
      expected(cases),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("checks a cache endpoint by the same host rule in createValkeyCache, and reads a cache read's by name", async () => {
    const binding = (hostname: string) => ({ hostname, port: 6379, secret: "cache-hot-routes" });
    // R3: an address, upper case and the longest name pass the bounded client's own check.
    for (const hostname of ["10.1.2.3", "Cache-1.Internal", "a".repeat(253)]) {
      const cache = await valkey.createValkeyCache({ binding: binding(hostname) });
      cache.close();
    }
    expect(
      fake.calls
        .filter((call) => call[0] === "createClient")
        .map((call) => (call[1] as { socket: { host: string } }).socket.host),
    ).toEqual(["10.1.2.3", "Cache-1.Internal", "a".repeat(253)]);
    for (const hostname of ["", "a".repeat(254), "cache_hot", "/run/valkey"])
      await expect(valkey.createValkeyCache({ binding: binding(hostname) })).rejects.toThrow(
        /^Invalid cache endpoint$/,
      );
    // A cache read's process reads its cache's endpoint by the cache's ID (`hot-routes` is
    // HOT_ROUTES).
    const hotRoutes = {
      JEEVES_CACHE_HOT_ROUTES_HOST: "cache.internal",
      JEEVES_CACHE_HOT_ROUTES_PORT: "6380",
      JEEVES_CACHE_HOT_ROUTES_TLS: "disable",
    };
    environment(hotRoutes);
    expect(valkey.cacheEndpoint("hot-routes")).toEqual({
      hostname: "cache.internal",
      port: 6380,
      tls: { mode: "disable" },
    });
    const cases: [Record<string, string | undefined>, string][] = [
      [{ JEEVES_CACHE_HOT_ROUTES_HOST: undefined }, "JEEVES_CACHE_HOT_ROUTES_HOST"],
      [{ JEEVES_CACHE_HOT_ROUTES_HOST: "/run/valkey" }, "JEEVES_CACHE_HOT_ROUTES_HOST"],
      [{ JEEVES_CACHE_HOT_ROUTES_PORT: "6380.5" }, "JEEVES_CACHE_HOT_ROUTES_PORT"],
    ];
    expect(await refusals(() => valkey.cacheEndpoint("hot-routes"), cases, hotRoutes)).toEqual(
      expected(cases),
    );
  });
});

// The loops' own test for an unreachable store (delivery.ts, as emitted).
const delivery = await import(dataUrl(String(fakes["./delivery.ts"])));

describe("an External API's and the Identity's HTTP clients (QG20)", () => {
  afterEach(() => {
    restoreEnvironment();
    vi.unstubAllGlobals();
  });
  const internalCall = Symbol.for("jeeves.internal-call");
  const external = "JEEVES_EXTERNAL_PARTNER_URL";
  /** A `fetch` that lost its connection, as undici rejects it. */
  const lost = () =>
    new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED 10.0.0.9:443"), {
        code: "ECONNREFUSED",
      }),
    });
  /** What building a client throws, or "built". */
  const outcome = (build: () => unknown) => {
    try {
      build();
      return "built";
    } catch (error) {
      return (error as Error).message;
    }
  };
  it("calls an External API at its JEEVES_EXTERNAL_<ID>_URL, passing the stub's init through as it is", async () => {
    const response = new Response(null, { status: 402 });
    const fetch = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetch);
    environment({ [external]: "https://api.partner.example/v1/" });
    const target = clients.externalTarget(external);
    // The stub's own init: its signal bounds the call and its header carries its own credential.
    const init = {
      method: "POST",
      headers: { authorization: ["Bearer", randomUUID()].join(" ") },
      signal: AbortSignal.timeout(1000),
    };
    expect(await target.request("charges", init)).toBe(response);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      new URL("https://api.partner.example/v1/charges"),
      init,
    );
    expect((fetch.mock.calls[0] as unknown[])[1]).toBe(init);
    // Without one the client adds nothing: it reads no credential.
    await target.request("/status");
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      new URL("https://api.partner.example/status"),
      undefined,
    );
  });

  it("never marks an External API's failed call, so a loop keeps the normal retries; the Identity's is marked", async () => {
    const refused = lost();
    const fetch = vi.fn().mockRejectedValueOnce(refused).mockRejectedValueOnce("not an object");
    vi.stubGlobal("fetch", fetch);
    environment({ [external]: "https://api.partner.example" });
    const target = clients.externalTarget(external);
    await expect(target.request("/v1/x")).rejects.toBe(refused);
    expect(Reflect.get(refused, internalCall)).toBeUndefined();
    expect(delivery.unreachable(refused)).toBe(false);
    await expect(target.request("/v1/x")).rejects.toBe("not an object");
    // The Identity is a provisioned service: its lost connection waits as a store's does.
    const away = lost();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(away));
    environment({ OIDC_ISSUER: "https://issuer.example/realms/identity" });
    await expect(clients.identityTarget().request("/realms/identity")).rejects.toBe(away);
    expect(Reflect.get(away, internalCall)).toBe(true);
    expect(delivery.unreachable(away)).toBe(true);
  });

  it("calls the Identity at OIDC_ISSUER, as a sign-in reads it", async () => {
    const response = new Response("{}");
    const fetch = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetch);
    environment({ OIDC_ISSUER: "http://127.0.0.1:47922/realms/identity" });
    const init = { headers: { accept: "application/json" } };
    expect(
      await clients
        .identityTarget()
        .request("/realms/identity/.well-known/openid-configuration", init),
    ).toBe(response);
    expect(fetch).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:47922/realms/identity/.well-known/openid-configuration"),
      init,
    );
  });

  it("fails naming JEEVES_EXTERNAL_<ID>_URL or OIDC_ISSUER when unset or invalid, never its value", () => {
    const credentials = ["https://", ["user", "pass"].join(":"), "@api.partner.example"].join("");
    const invalid = [
      undefined,
      "",
      "/v1",
      "api.partner.example",
      "ftp://api.partner.example",
      credentials,
      "https://api.partner.example/?key=1",
      "https://api.partner.example/#top",
    ];
    for (const [name, build] of [
      [external, () => clients.externalTarget(external)],
      ["OIDC_ISSUER", () => clients.identityTarget()],
    ] as const)
      for (const value of invalid) {
        environment({ [name]: value });
        const message = outcome(build);
        expect(message, `${name} ${value}`).toBe(`Invalid endpoint ${name}`);
        if (value) expect(message).not.toContain(value);
      }
  });

  it("with JEEVES_REQUIRE_TLS=true needs an https: External API and issuer, naming the variable", () => {
    environment({
      JEEVES_REQUIRE_TLS: "true",
      [external]: "http://api.partner.example",
      OIDC_ISSUER: "http://127.0.0.1:47922/realms/identity",
    });
    expect(outcome(() => clients.externalTarget(external))).toBe(`Insecure endpoint ${external}`);
    expect(outcome(() => clients.identityTarget())).toBe("Insecure endpoint OIDC_ISSUER");
    environment({
      [external]: "https://api.partner.example",
      OIDC_ISSUER: "https://issuer.example/realms/identity",
    });
    expect(outcome(() => clients.externalTarget(external))).toBe("built");
    expect(outcome(() => clients.identityTarget())).toBe("built");
    // Without the switch, http: passes as before; another switch value fails naming it.
    environment({ JEEVES_REQUIRE_TLS: undefined, [external]: "http://api.partner.example" });
    expect(outcome(() => clients.externalTarget(external))).toBe("built");
    environment({ JEEVES_REQUIRE_TLS: "1" });
    expect(outcome(() => clients.externalTarget(external))).toBe(
      "Invalid endpoint JEEVES_REQUIRE_TLS",
    );
  });
});

// The exact emitted postgres.ts, which both pools (a stub's `databaseClient` and a template's
// `pool`) are built through, with a fake `pg.Pool` constructor that records its options.
// QG07: the stub stack with Visits on Google Cloud, so its module-clients.ts has the Pub/Sub
// publisher beside RabbitMQ's (Uploaded's), on the same fakes and a fake official client.
const pubsubBundle = assembleV2(
  {
    designJson: canonicalJson(
      runStudioCommands(stubStackDesign(), [
        { type: "setRunnableProcesses", on: true },
        {
          type: "edit",
          element: "visits",
          settings: { kind: "queue", mode: "topic", provider: "google-cloud" },
        },
      ]),
    ),
  },
  loadLocalV2Registry(),
);
const pubsubClients = await import(
  dataUrl(
    stripTypeScriptTypes(
      new TextDecoder().decode(
        pubsubBundle.files.find((file) => file.path === "src/runtime/module-clients.ts")?.bytes,
      ),
    ).replace(/from "([^"]+)"/g, (match, from: string) =>
      from === "./tile-process.ts"
        ? `from "${tileProcess}"`
        : fakes[from]
          ? `from "${dataUrl(fakes[from])}"`
          : match,
    ),
  )
);

describe("emitted pubsubPublisher: a stub's Pub/Sub topic (QG07)", () => {
  beforeEach(() => environment({ ...localEnvironment, JEEVES_PUBSUB_PROJECT: "local" }));
  afterEach(() => {
    fake.calls.length = 0;
    fake.fail = undefined;
    fake.pubsub = undefined;
    lines.length = 0;
    vi.useRealTimers();
    restoreEnvironment();
  });
  const visits = { topic: "visits" };
  const payload = new TextEncoder().encode("visit");
  /** Publishes that Pub/Sub acknowledges only when the test calls their `ack`. */
  function held() {
    const acks: ((id: string) => void)[] = [];
    fake.pubsub = { publish: () => new Promise<string>((resolve) => acks.push(resolve)) };
    return acks;
  }

  it("resolves only once Pub/Sub acknowledges, with the module's messageId as its attribute", async () => {
    const scope = testScope();
    const publisher = await pubsubClients.pubsubPublisher(scope, probe, visits);
    expect(fake.calls).toEqual([
      [
        "PubSub",
        {
          projectId: "local",
          "grpc.initial_reconnect_backoff_ms": 500,
          "grpc.max_reconnect_backoff_ms": 2000,
        },
      ],
      ["topic", "visits", { gaxOpts: { timeout: 2000 } }],
      ["exists"],
    ]);
    expect(lines).toEqual([
      {
        level: "info",
        client: "visits",
        kind: "queue",
        check: "the Pub/Sub topic exists",
        result: "ok",
      },
    ]);
    const acks = held();
    let settled = false;
    const sent = publisher
      .publish(payload, { messageId: "a", key: "ignored" })
      .then((value: unknown) => {
        settled = true;
        return value;
      });
    expect(fake.calls.at(-1)).toEqual(["publishMessage", "visit", { messageId: "a" }]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    acks[0]?.("server-1");
    await expect(sent).resolves.toBeUndefined();
    // Without one, each message gets a fresh ID.
    fake.pubsub = undefined;
    await publisher.publish(payload);
    await publisher.publish(payload);
    const ids = fake.calls.slice(-2).map((call) => (call[2] as { messageId: string }).messageId);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids[0]).not.toBe(ids[1]);
    // It drains with the process; it is no broker transport.
    expect(scope.owned).toHaveLength(1);
    expect(scope.transports).toHaveLength(0);
    // RabbitMQ's publisher is emitted beside it, for Uploaded.
    expect(pubsubClients.queuePublisher).toBeTypeOf("function");
  });

  it("rejects a publish at 2000 ms, and the next at once while 1000 are outstanding", async () => {
    vi.useFakeTimers();
    const publisher = await pubsubClients.pubsubPublisher(testScope(), probe, visits);
    fake.pubsub = { publish: () => new Promise<string>(() => {}) };
    let settled = false;
    const late = publisher.publish(payload).finally(() => {
      settled = true;
    });
    const rejected = expect(late).rejects.toThrow("Publish deadline (2000 ms)");
    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    const outstanding = Array.from({ length: 1000 }, () =>
      publisher.publish(payload).catch((error: Error) => error.message),
    );
    await expect(publisher.publish(payload)).rejects.toThrow("Publisher queue full");
    // The refused one never reached Pub/Sub.
    expect(fake.calls.filter((call) => call[0] === "publishMessage")).toHaveLength(1001);
    await vi.advanceTimersByTimeAsync(2000);
    expect(new Set(await Promise.all(outstanding))).toEqual(
      new Set(["Publish deadline (2000 ms)"]),
    );
    // Settled publishes free their places.
    fake.pubsub = undefined;
    await expect(publisher.publish(payload)).resolves.toBeUndefined();
  });

  it("waits for outstanding publishes when the process drains, then closes the client", async () => {
    const scope = testScope();
    const publisher = await pubsubClients.pubsubPublisher(scope, probe, visits);
    const acks = held();
    const sent = publisher.publish(payload, { messageId: "b" });
    let drained = false;
    const drain = Promise.resolve(scope.owned[0]?.()).then(() => {
      drained = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(drained).toBe(false);
    expect(fake.calls.map((call) => call[0])).not.toContain("close");
    // Draining, it takes no new publish.
    await expect(publisher.publish(payload)).rejects.toThrow("Publisher closed");
    acks[0]?.("server-2");
    await sent;
    await drain;
    expect(fake.calls.at(-1)).toEqual(["close"]);
  });

  it("fails startup when its topic is missing or can't be checked, and reads its project from the environment", async () => {
    fake.pubsub = { exists: false };
    await expect(pubsubClients.pubsubPublisher(testScope(), probe, visits)).rejects.toThrow(
      "Startup probe failed: queue visits",
    );
    expect(lines.at(-1)).toEqual({
      level: "error",
      client: "visits",
      kind: "queue",
      check: "the Pub/Sub topic exists",
      result: "failed",
      error: "Error: Pub/Sub topic visits not found",
    });
    fake.pubsub = undefined;
    fake.fail = "exists";
    await expect(pubsubClients.pubsubPublisher(testScope(), probe, visits)).rejects.toThrow(
      "Startup probe failed: queue visits",
    );
    expect(lines.at(-1)).toMatchObject({ result: "failed", error: "Error: exists refused" });
    fake.fail = undefined;
    // A project ID, optionally domain-scoped; anything else fails by name before any client.
    for (const value of ["local", "my-project-123", "example.com:my-project"]) {
      environment({ JEEVES_PUBSUB_PROJECT: value });
      fake.calls.length = 0;
      await pubsubClients.pubsubPublisher(testScope(), probe, visits);
      expect(fake.calls[0]).toEqual([
        "PubSub",
        {
          projectId: value,
          "grpc.initial_reconnect_backoff_ms": 500,
          "grpc.max_reconnect_backoff_ms": 2000,
        },
      ]);
    }
    for (const value of [
      undefined,
      "",
      "Local",
      "1project",
      "my_project",
      "a b",
      `p${"x".repeat(30)}`,
    ]) {
      environment({ JEEVES_PUBSUB_PROJECT: value });
      fake.calls.length = 0;
      const error = await pubsubClients.pubsubPublisher(testScope(), probe, visits).then(
        () => new Error("built"),
        (thrown: Error) => thrown,
      );
      expect(error.message).toBe("Invalid endpoint JEEVES_PUBSUB_PROJECT");
      expect(fake.calls).toEqual([]);
    }
  });
});

describe("verified TLS bindings and an insecure-endpoint refusal (QG10)", () => {
  // A CA file is a PEM file the process reads as it builds the client; these tests check only that
  // its exact bytes reach the client, so its content is a marker made at run time.
  const directory = mkdtempSync(join(tmpdir(), "jeeves-qg10-"));
  const caFile = join(directory, "ca.pem");
  const caText = `test CA ${randomUUID()}\n`;
  writeFileSync(caFile, caText);
  mkdirSync(join(directory, "folder"));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));
  beforeEach(() => {
    fake.calls.length = 0;
    fake.transports.length = 0;
    environment({ ...localEnvironment, JEEVES_REQUIRE_TLS: undefined });
  });
  afterEach(() => {
    fake.calls.length = 0;
    fake.endpoints.length = 0;
    fake.transports.length = 0;
    lines.length = 0;
    restoreEnvironment();
    vi.unstubAllGlobals();
  });
  const links = { tile: "links-api", resource: "links-db" };
  const db = (part: string) => `JEEVES_DATABASE_LINKS_DB_${part}`;
  const cache = (part: string) => `JEEVES_CACHE_LINKS_CACHE_${part}`;
  const tcp = {
    host: "cache-links-cache",
    port: 6379,
    connectTimeout: 500,
    reconnectStrategy: false,
  };
  /** The socket the cache's client was created with, after the client is closed. */
  async function cacheSocket() {
    const scope = testScope();
    await clients.cacheClient(scope, probe, { cache: "links-cache" });
    for (const drain of scope.owned) await drain();
    const created = fake.calls.filter((call) => call[0] === "createClient");
    const options = created.at(-1)?.[1] as { socket: unknown } | undefined;
    if (!options) throw new Error("No cache client was created");
    return options.socket;
  }
  /** What building a client rejects or throws with, or "built". */
  const outcome = (build: () => unknown) =>
    Promise.resolve()
      .then(build)
      .then(
        () => "built",
        (thrown: Error) => thrown.message,
      );

  it("passes a database's and a cache's transport to its client: disable, verify-full, a CA file and a certificate name", async () => {
    // Compose's local value.
    await clients.databaseClient(testScope(), probe, links);
    environment({ [db("TLS")]: "verify-full" });
    await clients.databaseClient(testScope(), probe, links);
    environment({ [db("CA_FILE")]: caFile, [db("TLS_SERVERNAME")]: "links-db.example" });
    await clients.databaseClient(testScope(), probe, links);
    // With disable, a CA file and a name are not read.
    environment({ [db("TLS")]: "disable", [db("CA_FILE")]: join(directory, "missing.pem") });
    await clients.databaseClient(testScope(), probe, links);
    expect(fake.transports).toEqual([
      { mode: "disable" },
      { mode: "verify-full" },
      { mode: "verify-full", ca: caText, servername: "links-db.example" },
      { mode: "disable" },
    ]);
    // A cache: plain TCP as before for disable; TLS that rejects an unverified certificate, with
    // the CA's PEM and the certificate's name, for verify-full.
    expect(await cacheSocket()).toEqual(tcp);
    environment({ [cache("TLS")]: "verify-full" });
    expect(await cacheSocket()).toEqual({ ...tcp, tls: true, rejectUnauthorized: true });
    environment({ [cache("CA_FILE")]: caFile, [cache("TLS_SERVERNAME")]: "cache.example" });
    expect(await cacheSocket()).toEqual({
      ...tcp,
      tls: true,
      rejectUnauthorized: true,
      ca: caText,
      servername: "cache.example",
    });
    environment({ [cache("TLS")]: "disable" });
    expect(await cacheSocket()).toEqual(tcp);
  });

  it("fails a database or cache naming a missing or invalid transport, name or switch, before any client", async () => {
    const cases: [Record<string, string | undefined>, string][] = [];
    for (const [kind, name] of [
      ["database", db],
      ["cache", cache],
    ] as const) {
      for (const value of [undefined, "", "require", "verify-ca", "VERIFY-FULL", "verify-full "])
        cases.push([{ [name("TLS")]: value, kind }, name("TLS")]);
      // A name by the host rule: Node's own check refuses others, `project:instance` included.
      for (const value of ["", "db example", "db_example", "p:i", "a".repeat(254)])
        cases.push([
          { [name("TLS")]: "verify-full", [name("TLS_SERVERNAME")]: value, kind },
          name("TLS_SERVERNAME"),
        ]);
      for (const value of ["", "1", "TRUE", "false", "yes"])
        cases.push([{ JEEVES_REQUIRE_TLS: value, kind }, "JEEVES_REQUIRE_TLS"]);
    }
    const seen: string[][] = [];
    for (const [{ kind, ...values }, variable] of cases) {
      environment(localEnvironment);
      environment(values);
      const message = await outcome(() =>
        kind === "database"
          ? clients.databaseClient(testScope(), probe, links)
          : clients.cacheClient(testScope(), probe, { cache: "links-cache" }),
      );
      seen.push([message, variable]);
      for (const value of Object.values(values)) if (value) expect(message).not.toContain(value);
      environment({
        JEEVES_REQUIRE_TLS: undefined,
        [db("TLS_SERVERNAME")]: undefined,
        [cache("TLS_SERVERNAME")]: undefined,
      });
    }
    expect(seen).toEqual(cases.map(([, variable]) => [`Invalid endpoint ${variable}`, variable]));
    // No pool or cache client was created and no probe ran or logged.
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("fails startup naming a CA file that can't be read, and its error code, never its path", async () => {
    const seen: string[] = [];
    for (const name of [db, cache])
      for (const path of [join(directory, "missing.pem"), join(directory, "folder"), ""]) {
        environment({ [name("TLS")]: "verify-full", [name("CA_FILE")]: path });
        const message = await outcome(() =>
          name === db
            ? clients.databaseClient(testScope(), probe, links)
            : clients.cacheClient(testScope(), probe, { cache: "links-cache" }),
        );
        seen.push(message);
        if (path) expect(message).not.toContain(path);
        environment(localEnvironment);
      }
    expect(seen).toEqual([
      `Unreadable CA file ${db("CA_FILE")} (ENOENT)`,
      `Unreadable CA file ${db("CA_FILE")} (EISDIR)`,
      `Unreadable CA file ${db("CA_FILE")} (ENOENT)`,
      `Unreadable CA file ${cache("CA_FILE")} (ENOENT)`,
      `Unreadable CA file ${cache("CA_FILE")} (EISDIR)`,
      `Unreadable CA file ${cache("CA_FILE")} (ENOENT)`,
    ]);
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("with JEEVES_REQUIRE_TLS=true refuses a plain-text database, cache or tile and a Pub/Sub emulator, by name", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    const tile = "JEEVES_TILE_STATS_API_URL";
    environment({ JEEVES_REQUIRE_TLS: "true", [tile]: "http://stats.internal:3000" });
    expect(await outcome(() => clients.databaseClient(testScope(), probe, links))).toBe(
      `Insecure endpoint ${db("TLS")}`,
    );
    expect(
      await outcome(() => clients.cacheClient(testScope(), probe, { cache: "links-cache" })),
    ).toBe(`Insecure endpoint ${cache("TLS")}`);
    expect(await outcome(() => clients.httpTarget({ tile: "stats-api" }))).toBe(
      `Insecure endpoint ${tile}`,
    );
    // Refused before any client: no pool, cache client or probe.
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
    // Pub/Sub's emulator is plain text: any PUBSUB_EMULATOR_HOST is refused before a client.
    environment({ JEEVES_PUBSUB_PROJECT: "local" });
    for (const emulator of ["local-pubsub:8085", ""]) {
      environment({ PUBSUB_EMULATOR_HOST: emulator });
      expect(
        await outcome(() => pubsubClients.pubsubPublisher(testScope(), probe, { topic: "visits" })),
      ).toBe("Insecure endpoint PUBSUB_EMULATOR_HOST");
    }
    expect(fake.calls).toEqual([]);
    // Verified TLS, https: and no emulator pass; so does a database's Unix socket directory,
    // which is local transport.
    environment({
      PUBSUB_EMULATOR_HOST: undefined,
      [db("TLS")]: "verify-full",
      [cache("TLS")]: "verify-full",
      [tile]: "https://stats.internal:8443",
    });
    expect(await outcome(() => clients.databaseClient(testScope(), probe, links))).toBe("built");
    expect(await cacheSocket()).toEqual({ ...tcp, tls: true, rejectUnauthorized: true });
    await clients.httpTarget({ tile: "stats-api" }).request("/x");
    expect(fetch).toHaveBeenCalledWith(new URL("https://stats.internal:8443/x"), undefined);
    expect(
      await outcome(() => pubsubClients.pubsubPublisher(testScope(), probe, { topic: "visits" })),
    ).toBe("built");
    environment({ [db("HOST")]: "/cloudsql/p:r:i", [db("TLS")]: "disable" });
    expect(await outcome(() => clients.databaseClient(testScope(), probe, links))).toBe("built");
    expect(fake.transports).toEqual([{ mode: "verify-full" }, { mode: "disable" }]);
  });

  it("without JEEVES_REQUIRE_TLS refuses nothing: Compose's local values pass as before", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    expect(localEnvironment).toMatchObject({ [db("TLS")]: "disable", [cache("TLS")]: "disable" });
    expect(Object.keys(localEnvironment)).not.toContain("JEEVES_REQUIRE_TLS");
    expect(await outcome(() => clients.databaseClient(testScope(), probe, links))).toBe("built");
    expect(await cacheSocket()).toEqual(tcp);
    await clients.httpTarget({ tile: "stats-api" }).request("/x");
    expect(fetch).toHaveBeenCalledWith(new URL("http://app-stats-api:3000/x"), undefined);
    environment({ JEEVES_PUBSUB_PROJECT: "local", PUBSUB_EMULATOR_HOST: "local-pubsub:8085" });
    expect(
      await outcome(() => pubsubClients.pubsubPublisher(testScope(), probe, { topic: "visits" })),
    ).toBe("built");
  });

  it("reads a cache read's transport in cacheEndpoint, and createValkeyCache connects verify-full with TLS", async () => {
    const name = (part: string) => `JEEVES_CACHE_HOT_ROUTES_${part}`;
    const hotRoutes = {
      [name("HOST")]: "10.1.2.3",
      [name("PORT")]: "6378",
      [name("TLS")]: "verify-full",
      [name("CA_FILE")]: caFile,
      [name("TLS_SERVERNAME")]: "cache.example",
    };
    environment(hotRoutes);
    const endpoint = valkey.cacheEndpoint("hot-routes");
    expect(endpoint).toEqual({
      hostname: "10.1.2.3",
      port: 6378,
      tls: { mode: "verify-full", ca: caText, servername: "cache.example" },
    });
    const opened = await valkey.createValkeyCache({
      binding: { ...endpoint, secret: "cache-hot-routes" },
    });
    opened.close();
    expect(fake.calls[0]).toEqual([
      "createClient",
      {
        password: "secret of cache-hot-routes",
        disableOfflineQueue: true,
        commandsQueueMaxLength: 32,
        socket: {
          host: "10.1.2.3",
          port: 6378,
          connectTimeout: 500,
          reconnectStrategy: false,
          tls: true,
          rejectUnauthorized: true,
          ca: caText,
          servername: "cache.example",
        },
      },
    ]);
    const cases: [Record<string, string | undefined>, string][] = [
      [{ [name("TLS")]: undefined }, `Invalid endpoint ${name("TLS")}`],
      [{ [name("TLS")]: "no-verify" }, `Invalid endpoint ${name("TLS")}`],
      [{ [name("TLS_SERVERNAME")]: "cache example" }, `Invalid endpoint ${name("TLS_SERVERNAME")}`],
      [
        { [name("CA_FILE")]: join(directory, "missing.pem") },
        `Unreadable CA file ${name("CA_FILE")} (ENOENT)`,
      ],
      [{ JEEVES_REQUIRE_TLS: "1" }, "Invalid endpoint JEEVES_REQUIRE_TLS"],
      [
        { JEEVES_REQUIRE_TLS: "true", [name("TLS")]: "disable" },
        `Insecure endpoint ${name("TLS")}`,
      ],
    ];
    const seen: string[][] = [];
    for (const [values, message] of cases) {
      environment({ ...hotRoutes, JEEVES_REQUIRE_TLS: undefined });
      environment(values);
      seen.push([await outcome(() => valkey.cacheEndpoint("hot-routes")), message]);
    }
    expect(seen).toEqual(cases.map(([, message]) => [message, message]));
    // Verified TLS passes the switch; without it, disable gives plain TCP as before.
    environment({ ...hotRoutes, JEEVES_REQUIRE_TLS: "true" });
    expect(valkey.cacheEndpoint("hot-routes").tls.mode).toBe("verify-full");
    environment({ JEEVES_REQUIRE_TLS: undefined, [name("TLS")]: "disable" });
    expect(valkey.cacheEndpoint("hot-routes").tls).toEqual({ mode: "disable" });
  });
});

describe("emitted postgres.ts: a query settles while PostgreSQL stalls", () => {
  const source = new TextDecoder().decode(
    bundle.files.find((file) => file.path === "src/runtime/postgres.ts")?.bytes,
  );
  const pools: Record<string, unknown>[] = [];
  (globalThis as { postgresPoolsFake?: unknown[] }).postgresPoolsFake = pools;
  const pgFake = `export default { Pool: class { constructor(options) { globalThis.postgresPoolsFake.push(options); } } };`;
  const loaded = import(
    dataUrl(
      stripTypeScriptTypes(source).replace(/from "([^"]+)"/g, (match, from: string) =>
        from === "pg"
          ? `from "${dataUrl(pgFake)}"`
          : from === "./local.ts"
            ? `from "${dataUrl(String(fakes["./local.ts"]))}"`
            : match,
      ),
    )
  );
  afterEach(() => {
    pools.length = 0;
  });

  it("passes the client a query timeout 500 ms past the statement timeout", () => {
    expect(source).toContain("statement_timeout: options.statementTimeoutMs,");
    expect(source).toContain("query_timeout: options.statementTimeoutMs + 500,");
  });

  it("gives pg.Pool a 2500 ms query timeout for a 2000 ms statement timeout, and changes nothing else", async () => {
    const { createPostgres } = await loaded;
    createPostgres({
      hostname: "local-postgres",
      port: 5432,
      tls: { mode: "disable" },
      login: { database: "d_links_db", user: "r_links_db__links_api", secret: "sql-links-db" },
      poolSize: 10,
      statementTimeoutMs: 2000,
      connectionTimeoutMs: 2000,
    });
    expect(pools).toEqual([
      {
        host: "local-postgres",
        port: 5432,
        // QG10: Compose's transport, which PGSSLMODE can't change.
        ssl: false,
        database: "d_links_db",
        user: "r_links_db__links_api",
        password: "secret of sql-links-db",
        max: 10,
        statement_timeout: 2000,
        query_timeout: 2500,
        connectionTimeoutMillis: 2000,
      },
    ]);
  });
});

// QG10: the exact emitted postgres.ts on the pg the Jeeves server pins, which is the version the
// export pins: what `ssl` each transport gives the pool, and what pg then does with it. Nothing
// connects.
describe("emitted postgres.ts: a database's transport (QG10)", () => {
  const serverRequire = createRequire(
    new URL("../../../jeeves/apps/server/package.json", import.meta.url),
  );
  const pgEntry = serverRequire.resolve("pg");
  const pools: Record<string, unknown>[] = [];
  (globalThis as { qg10PoolsFake?: unknown[] }).qg10PoolsFake = pools;
  const realPg = `import pg from ${JSON.stringify(pathToFileURL(pgEntry).href)};
    export default { Pool: class extends pg.Pool { constructor(options) { super(options); globalThis.qg10PoolsFake.push(this); } } };`;
  const source = new TextDecoder().decode(
    bundle.files.find((file) => file.path === "src/runtime/postgres.ts")?.bytes,
  );
  const loaded = import(
    dataUrl(
      stripTypeScriptTypes(source).replace(/from "([^"]+)"/g, (match, from: string) =>
        from === "pg"
          ? `from "${dataUrl(realPg)}"`
          : from === "./local.ts"
            ? `from "${dataUrl(String(fakes["./local.ts"]))}"`
            : match,
      ),
    )
  );
  const options = (tls: unknown) => ({
    hostname: "db.internal",
    port: 5432,
    tls,
    login: { database: "d_links_db", user: "r_links_db__links_api", secret: "sql-links-db" },
    poolSize: 10,
    statementTimeoutMs: 2000,
    connectionTimeoutMs: 2000,
  });
  let mode: string | undefined;
  beforeEach(() => {
    mode = process.env.PGSSLMODE;
  });
  afterEach(async () => {
    if (mode === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = mode;
    for (const pool of pools.splice(0)) await (pool as { end(): Promise<void> }).end();
  });
  /** The `ssl` a pool's clients connect with, as pg works it out from the pool's options. */
  const clientSsl = (pool: Record<string, unknown>) => {
    const pg = serverRequire("pg");
    return new pg.Client((pool as { options: unknown }).options).connectionParameters.ssl;
  };

  it("uses the pg version the export pins", () => {
    const manifest = JSON.parse(
      readFileSync(join(pgEntry.slice(0, pgEntry.lastIndexOf("/lib/")), "package.json"), "utf8"),
    ) as { version: string };
    const pins = JSON.parse(
      readFileSync(
        new URL("../../templates/local-v2/assets/package.json", import.meta.url),
        "utf8",
      ),
    ) as { dependencies: Record<string, string> };
    expect(manifest.version).toBe(pins.dependencies.pg);
  });

  it("gives disable ssl: false, so PGSSLMODE can't turn TLS on or off", async () => {
    const { createPostgres } = await loaded;
    process.env.PGSSLMODE = "verify-full";
    const pool = createPostgres(options({ mode: "disable" }));
    expect(pool.options.ssl).toBe(false);
    expect(clientSsl(pool)).toBe(false);
    // Without an ssl option (before QG10), pg followed the environment.
    const pg = serverRequire("pg");
    const { ssl: _, ...unset } = pool.options;
    expect(new pg.Client(unset).connectionParameters.ssl).toBe(true);
  });

  it("gives verify-full verified TLS whatever PGSSLMODE says, with its CA and its certificate's name", async () => {
    const { createPostgres } = await loaded;
    for (const environment of ["disable", "no-verify", undefined]) {
      if (environment === undefined) delete process.env.PGSSLMODE;
      else process.env.PGSSLMODE = environment;
      const pool = createPostgres(options({ mode: "verify-full" }));
      expect(pool.options.ssl).toEqual({ rejectUnauthorized: true });
      expect(clientSsl(pool)).toEqual({ rejectUnauthorized: true });
    }
    const ca = `test CA ${randomUUID()}`;
    expect(createPostgres(options({ mode: "verify-full", ca })).options.ssl).toEqual({
      rejectUnauthorized: true,
      ca,
    });
    const named = createPostgres(
      options({ mode: "verify-full", ca, servername: "links-db.example" }),
    ).options.ssl;
    expect(named).toEqual({
      rejectUnauthorized: true,
      ca,
      servername: "links-db.example",
      checkServerIdentity: expect.any(Function),
    });
    // pg puts a host name in place of `servername`, so the given name is checked here instead:
    // a certificate for that name passes whatever the host, and one for the host does not.
    const certificate = (name: string, altNames?: string) =>
      ({ subject: { CN: name }, ...(altNames && { subjectaltname: altNames }) }) as PeerCertificate;
    expect(named.checkServerIdentity("db.internal", certificate("links-db.example"))).toBe(
      undefined,
    );
    expect(named.checkServerIdentity("10.1.2.3", certificate("links-db.example"))).toBe(undefined);
    expect(named.checkServerIdentity("db.internal", certificate("db.internal"))).toBeInstanceOf(
      Error,
    );
    const dns = createPostgres(options({ mode: "verify-full", servername: "db.example" })).options
      .ssl;
    expect(dns.checkServerIdentity("10.1.2.3", certificate("x", "DNS:db.example"))).toBe(
      checkServerIdentity("db.example", certificate("x", "DNS:db.example")),
    );
    expect(
      dns.checkServerIdentity("db.example", certificate("x", "DNS:other.example")),
    ).toBeInstanceOf(Error);
  });

  it("has no option that turns verification off", async () => {
    const { createPostgres } = await loaded;
    expect(source).not.toMatch(/rejectUnauthorized:\s*false/);
    // Anything but verify-full is plain text, never unverified TLS.
    for (const mode of ["disable", "no-verify", "require", "prefer"])
      expect(createPostgres(options({ mode })).options.ssl).toBe(false);
  });
});

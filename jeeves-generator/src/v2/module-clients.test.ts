import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
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
type Calls = { calls: unknown[][]; fail?: string; hang?: boolean };
const fake: Calls = { calls: [] };
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
      record("createPostgres", options.login.user, options.poolSize, options.statementTimeoutMs);
      return {
        on: (event) => record("on", event),
        end: async () => record("end"),
        query: (sql, values) => outcome(sql, { rows: [{ sql, values }], rowCount: 3 }),
      };
    }`,
  "./amqp.ts": `${check}
    export async function createPublisher(binding, destination, hooks) {
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
  afterEach(() => {
    fake.calls.length = 0;
    fake.fail = undefined;
    fake.hang = undefined;
    lines.length = 0;
    vi.useRealTimers();
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
      const target = clients.httpTarget("http://app-stats-api:3000");
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
      const target = clients.httpTarget("http://app-stats-api:3000");
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

// The exact emitted postgres.ts, which both pools (a stub's `databaseClient` and a template's
// `pool`) are built through, with a fake `pg.Pool` constructor that records its options.
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
      login: { database: "d_links_db", user: "r_links_db__links_api", secret: "sql-links-db" },
      poolSize: 10,
      statementTimeoutMs: 2000,
      connectionTimeoutMs: 2000,
    });
    expect(pools).toEqual([
      {
        host: "local-postgres",
        port: 5432,
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

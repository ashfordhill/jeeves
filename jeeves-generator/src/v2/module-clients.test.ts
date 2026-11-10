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
      record("createPublisher", binding.passwordSecret, destination, typeof hooks.onFatal);
      return {
        closed: new Promise(() => {}),
        close: async () => record("close"),
        publish: async (body, messageId) => record("publish", Buffer.from(body).toString(), messageId),
      };
    }`,
  redis: `${check}
    export function createClient(options) {
      record("createClient", options.password, options.socket.host, options.disableOfflineQueue);
      return {
        isOpen: true,
        on: (event) => record("on", event),
        connect: () => outcome("connect", undefined),
        ping: () => outcome("PING", "PONG"),
        destroy: () => record("destroy"),
        get: async (key) => (key === "missing" ? null : "value"),
        set: async (...args) => record("set", ...args),
        del: async (key) => record("del", key),
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
const probe = (entry: Record<string, unknown>) => lines.push(entry);

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
    const topic = await clients.queuePublisher(scope, probe, { queue: "visits", mode: "topic" });
    const work = await clients.queuePublisher(scope, probe, {
      queue: "uploaded",
      mode: "work-queue",
    });
    await topic.publish(new TextEncoder().encode("a"), { key: "ignored" });
    await work.publish(new TextEncoder().encode("b"));
    const calls = fake.calls.filter((call) => call[0] !== "open");
    expect(calls.slice(0, 2)).toEqual([
      ["createPublisher", "broker-password", { exchange: "visits", routingKey: "" }, "function"],
      ["createPublisher", "broker-password", { exchange: "", routingKey: "uploaded" }, "function"],
    ]);
    expect(calls[2]?.slice(0, 2)).toEqual(["publish", "a"]);
    expect(calls[3]?.slice(0, 2)).toEqual(["publish", "b"]);
    expect(calls[2]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[2]?.[2]).not.toBe(calls[3]?.[2]);
    // The publisher drains with the process, and a lost broker fails it.
    expect(scope.owned).toHaveLength(2);
    expect(scope.transports).toHaveLength(2);
    expect(lines.map((line) => [line.client, line.check, line.result])).toEqual([
      ["visits", "open the broker and a confirm channel", "ok"],
      ["uploaded", "open the broker and a confirm channel", "ok"],
    ]);
  });

  it("uses a cache with its password, after PING", async () => {
    const cache = await clients.cacheClient(testScope(), probe, { cache: "links-cache" });
    expect(fake.calls.slice(0, 4)).toEqual([
      ["createClient", "secret of cache-links-cache", "cache-links-cache", true],
      ["on", "error"],
      ["connect"],
      ["PING"],
    ]);
    expect(await cache.get("key")).toBe("value");
    expect(await cache.get("missing")).toBeUndefined();
    await cache.set("key", "value", 60);
    await cache.set("key", "value");
    await cache.delete("key");
    expect(fake.calls.slice(4)).toEqual([
      ["set", "key", "value", { EX: 60 }],
      ["set", "key", "value", undefined],
      ["del", "key"],
    ]);
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

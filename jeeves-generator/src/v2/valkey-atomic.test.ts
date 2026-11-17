import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { operationImports, operationUrl } from "./operation.test.helpers.ts";

const operation = await import(operationUrl);
const source = readFileSync(
  new URL("../../templates/local-v2/assets/src/runtime/valkey.ts.template", import.meta.url),
  "utf8",
);
const url = (code: string) =>
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(operationImports(code))).toString("base64")}`;
const redis = url(
  `export class ErrorReply extends Error {} export const createClient = options => globalThis.rg11Open(options);`,
);
const { ErrorReply } = await import(redis);
const runtime = await import(
  url(
    source
      .replace('from "redis"', `from "${redis}"`)
      .replace(
        'import { readSecret } from "./local.ts";',
        'const readSecret = () => {throw Error("Unexpected credential read")};',
      ),
  )
);
type Cache = Awaited<ReturnType<typeof runtime.createValkeyCache>>;
const clients: ReturnType<typeof fake>[] = [];
const scopes: AbortController[] = [];
const caches: Cache[] = [];
const connects: (() => Promise<void>)[] = [];
const fake = () => {
  const listeners = new Map<string, ((error?: unknown) => void)[]>();
  const client = {
    on: vi.fn((name: string, listener: (error?: unknown) => void) => {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    }),
    emit: (name: string, error?: unknown) => {
      for (const listener of listeners.get(name) ?? []) listener(error);
    },
    connect: vi.fn(() => (connects.shift() ?? (() => Promise.resolve()))()),
    destroy: vi.fn(),
    get: vi.fn(async (_key: string): Promise<unknown> => null),
    set: vi.fn(async (): Promise<unknown> => "OK"),
    del: vi.fn(async (): Promise<unknown> => 1),
    ping: vi.fn(async (): Promise<unknown> => "PONG"),
    eval: vi.fn(
      async (_script: string, _input: { keys: string[]; arguments: string[] }): Promise<unknown> =>
        1,
    ),
  };
  return client;
};
function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(1700000000000);
  vi.stubGlobal("rg11Open", (options: unknown) => {
    const c = fake();
    clients.push(c);
    configured.push(options);
    return c;
  });
}
const configured: unknown[] = [];
async function open() {
  const abort = new AbortController();
  scopes.push(abort);
  const tracked: Promise<unknown>[] = [];
  const onState = vi.fn();
  const scope = { signal: abort.signal, track: (work: Promise<unknown>) => tracked.push(work) };
  const cache = await operation.withProcess(scope, () =>
    runtime.createValkeyCache({
      binding: {
        hostname: "cache-test",
        port: 6379,
        secret: "cache-test",
        tls: { mode: "disable" },
      },
      credential: () => "unit-password",
      onState,
    }),
  );
  caches.push(cache);
  const client = clients.at(-1);
  if (!client) throw Error("Client missing");
  return { cache, client, tracked, onState, abort };
}
afterEach(() => {
  for (const cache of caches.splice(0)) cache.close();
  for (const scope of scopes.splice(0)) scope.abort();
  clients.length = 0;
  connects.length = 0;
  configured.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const record = (version = "9007199254740993", validUntil = Date.now() + 10000) => ({
  version,
  value: "payload",
  validUntil,
});
const envelope = (value = record()) => JSON.stringify({ v: 1, ...value });

describe("RG11 finite atomic cache primitives", () => {
  it("uses one key and fixed script/arguments, unique admission identities, immutable typed results", async () => {
    setup();
    const { cache, client } = await open();
    const now = Date.now();
    client.eval
      .mockResolvedValueOnce([1, 1, now, now + 60000])
      .mockResolvedValueOnce([0, 1, now + 5, now + 60000]);
    const a = await cache.admit("admission:policy:trusted", { limit: 1, windowMs: 60000 });
    const b = await cache.admit("admission:policy:trusted", { limit: 1, windowMs: 60000 });
    expect(a).toEqual({ admitted: true, count: 1, resetAt: now + 60000 });
    expect(b).toEqual({ admitted: false, count: 1, resetAt: now + 60000 });
    expect(Object.isFrozen(a)).toBe(true);
    const first = client.eval.mock.calls[0];
    const second = client.eval.mock.calls[1];
    expect(first?.[1].keys).toEqual(["admission:policy:trusted"]);
    expect(first?.[1].arguments.slice(0, 2)).toEqual(["60000", "1"]);
    expect(first?.[1].arguments[2]).not.toBe(second?.[1].arguments[2]);
    expect(first?.[0]).toBe(second?.[0]);
    const value = record("18446744073709551615");
    expect(await cache.setIfNewer("versioned:item", value)).toEqual({
      status: "stored",
      validUntil: value.validUntil,
    });
    const call = client.eval.mock.calls[2];
    expect(call?.[1]).toEqual({
      keys: ["versioned:item"],
      arguments: [envelope(value), value.version, String(value.validUntil), value.value],
    });
    expect(call?.[0]).not.toBe(first?.[0]);
    for (const name of ["eval", "sendCommand", "socket", "client", "scriptLoad", "duplicate"])
      expect(cache[name]).toBeUndefined();
    expect(configured[0]).toMatchObject({
      disableOfflineQueue: true,
      commandsQueueMaxLength: 32,
      socket: { reconnectStrategy: false },
    });
  });

  it("preserves absolute validity on delayed read/write responses; expired writes do not become fresh", async () => {
    setup();
    const { cache, client } = await open();
    const value = record("10", Date.now() + 50);
    let answer!: (value: unknown) => void;
    client.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const reading = cache.getVersioned("versioned:item");
    await vi.advanceTimersByTimeAsync(51);
    answer(envelope(value));
    expect(await reading).toBeNull();
    let written!: (value: unknown) => void;
    const next = record("11", Date.now() + 50);
    client.eval.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          written = resolve;
        }),
    );
    const writing = cache.setIfNewer("versioned:item", next);
    await vi.advanceTimersByTimeAsync(51);
    written(1);
    expect(await writing).toEqual({ status: "expired", validUntil: next.validUntil });
    expect(client.eval.mock.calls[0]?.[1].arguments[2]).toBe(String(next.validUntil));
    client.eval.mockResolvedValueOnce(2);
    expect(await cache.setIfNewer("versioned:item", next)).toEqual({
      status: "expired",
      validUntil: next.validUntil,
    });
    const alive = record("12");
    client.get.mockResolvedValue(envelope(alive));
    const read = await cache.getVersioned("versioned:item");
    expect(read).toEqual(alive);
    expect(Object.isFrozen(read)).toBe(true);
    expect(client.destroy).not.toHaveBeenCalled();
  });

  it("round-trips valid non-BMP Unicode keys and versioned values", async () => {
    setup();
    const { cache, client } = await open();
    const value = { ...record(), value: "\u{1f642}漢字\ufffd" };
    expect(await cache.setIfNewer("item:\u{1f642}", value)).toMatchObject({ status: "stored" });
    expect(client.eval.mock.calls[0]?.[1].keys).toEqual(["item:\u{1f642}"]);
    expect(client.eval.mock.calls[0]?.[1].arguments[0]).toBe(envelope(value));
    client.get.mockResolvedValueOnce(envelope(value));
    expect(await cache.getVersioned("item:\u{1f642}")).toEqual(value);
  });

  it("returns distinct older/equal/conflicting-version decisions without fabricating successful storage", async () => {
    setup();
    const { cache, client } = await open();
    for (const [reply, status] of [
      [0, "not-newer"],
      [3, "version-conflict"],
      [2, "expired"],
    ] as const) {
      client.eval.mockResolvedValueOnce(reply);
      expect(await cache.setIfNewer("item", record())).toMatchObject({ status });
    }
  });

  it("refuses invalid versions, values, keys and finite window bounds before any dispatch", async () => {
    setup();
    const { cache, client } = await open();
    for (const version of [
      "",
      "01",
      "-1",
      "1.0",
      "1e3",
      "18446744073709551616",
      "999999999999999999999",
      1,
    ])
      await expect(cache.setIfNewer("item", { ...record(), version })).rejects.toMatchObject({
        outcome: "refused",
        code: "INVALID_CACHE_RECORD",
      });
    for (const validUntil of [Infinity, NaN, 0, 1.5, Number.MAX_SAFE_INTEGER + 1])
      await expect(cache.setIfNewer("item", { ...record(), validUntil })).rejects.toMatchObject({
        outcome: "refused",
      });
    await expect(
      cache.setIfNewer("item", record("1", Date.now() + 604800001)),
    ).rejects.toMatchObject({ outcome: "refused", code: "INVALID_CACHE_EXPIRY" });
    await expect(
      cache.setIfNewer("item", { ...record(), value: "é".repeat(32769) }),
    ).rejects.toMatchObject({ outcome: "refused" });
    await expect(cache.setIfNewer("item", { ...record(), value: "\ud800" })).rejects.toMatchObject({
      outcome: "refused",
      code: "INVALID_CACHE_RECORD",
    });
    await expect(cache.getVersioned("\udfff")).rejects.toMatchObject({
      outcome: "refused",
      code: "INVALID_CACHE_KEY",
    });
    for (const policy of [
      { limit: 0, windowMs: 1 },
      { limit: 10001, windowMs: 1 },
      { limit: 1.5, windowMs: 1 },
      { limit: 1, windowMs: 0 },
      { limit: 1, windowMs: 604800001 },
    ])
      await expect(cache.admit("item", policy)).rejects.toMatchObject({
        outcome: "refused",
        code: "INVALID_CACHE_WINDOW",
      });
    await expect(cache.admit("é".repeat(257), { limit: 1, windowMs: 1 })).rejects.toMatchObject({
      outcome: "refused",
      code: "INVALID_CACHE_KEY",
    });
    expect(client.eval).not.toHaveBeenCalled();
    expect(client.get).not.toHaveBeenCalled();
    expect(client.destroy).not.toHaveBeenCalled();
  });

  it("classifies every malformed atomic reply as unknown and malformed reads as definite, preserving healthy connection", async () => {
    setup();
    const { cache, client, onState } = await open();
    const now = Date.now();
    for (const reply of [
      null,
      "1",
      [1, 1, now, now + 100, 0],
      [2, 1, now, now + 100],
      [1, 0, now, now + 100],
      [0, 1, now, now + 100],
      [1, 3, now, now + 100],
      [1, 1, now, now + 101],
      [1, 1, now, now],
      [1, 1, "now", now + 100],
    ]) {
      client.eval.mockResolvedValueOnce(reply);
      await expect(cache.admit("item", { limit: 2, windowMs: 100 })).rejects.toMatchObject({
        outcome: "unknown",
        code: "CACHE_REPLY_INVALID",
      });
    }
    for (const reply of [null, "1", [1], -1, 4, 1.5]) {
      client.eval.mockResolvedValueOnce(reply);
      await expect(cache.setIfNewer("item", record())).rejects.toMatchObject({
        outcome: "unknown",
        code: "CACHE_REPLY_INVALID",
      });
    }
    for (const reply of [
      1,
      "not json",
      envelope({ ...record(), version: "01" }),
      envelope(record("1", Date.now() + 604800001)),
    ]) {
      client.get.mockResolvedValueOnce(reply);
      await expect(cache.getVersioned("item")).rejects.toMatchObject({
        outcome: "definite-failure",
        code: "CACHE_REPLY_INVALID",
      });
    }
    client.set.mockResolvedValueOnce(null);
    await expect(cache.set("item", "value")).rejects.toMatchObject({
      outcome: "unknown",
      code: "CACHE_REPLY_INVALID",
    });
    expect(client.destroy).not.toHaveBeenCalled();
    expect(onState).toHaveBeenCalledTimes(1);
    await expect(cache.ping()).resolves.toBe("PONG");
  });

  it("bounds actual pending work at 32 and keeps a saturated healthy client available", async () => {
    setup();
    const { cache, client, tracked, onState } = await open();
    const finish: ((value: unknown) => void)[] = [];
    client.eval.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish.push(resolve);
        }),
    );
    const calls = Array.from({ length: 32 }, () =>
      cache.admit("item", { limit: 32, windowMs: 1000 }),
    );
    await expect(cache.admit("item", { limit: 32, windowMs: 1000 })).rejects.toMatchObject({
      outcome: "refused",
      code: "CACHE_SATURATED",
    });
    expect(client.eval).toHaveBeenCalledTimes(32);
    expect(tracked).toHaveLength(33);
    expect(client.destroy).not.toHaveBeenCalled();
    expect(onState).toHaveBeenCalledTimes(1);
    finish.forEach((resolve, i) => {
      resolve([1, i + 1, Date.now(), Date.now() + 1000]);
    });
    expect((await Promise.all(calls)).every((x) => x.admitted)).toBe(true);
    await expect(cache.ping()).resolves.toBe("PONG");
    expect(clients).toHaveLength(1);
    expect(client.destroy).not.toHaveBeenCalled();
  });

  it("recognizes the pinned driver's queue-full refusal without losing connectivity or retrying", async () => {
    setup();
    const { cache, client, onState } = await open();
    client.eval.mockRejectedValueOnce(new Error("The queue is full"));
    await expect(cache.admit("item", { limit: 1, windowMs: 1000 })).rejects.toMatchObject({
      outcome: "refused",
      code: "CACHE_SATURATED",
    });
    expect(client.eval).toHaveBeenCalledTimes(1);
    expect(client.destroy).not.toHaveBeenCalled();
    await expect(cache.ping()).resolves.toBe("PONG");
    expect(onState).toHaveBeenCalledTimes(1);
  });

  it("classifies a synchronous driver queue refusal before dispatch without losing the client", async () => {
    setup();
    const { cache, client } = await open();
    client.eval.mockImplementationOnce(() => {
      throw new Error("The queue is full");
    });
    await expect(cache.setIfNewer("item", record())).rejects.toMatchObject({
      outcome: "refused",
      code: "CACHE_SATURATED",
    });
    expect(client.destroy).not.toHaveBeenCalled();
    await expect(cache.ping()).resolves.toBe("PONG");
  });

  it("keeps server script errors unknown (Lua can partially mutate), and never disconnects or retries them", async () => {
    setup();
    const { cache, client } = await open();
    for (const message of ["ERR script after write", "The queue is full"]) {
      client.eval.mockRejectedValueOnce(new ErrorReply(message));
      await expect(cache.setIfNewer("item", record())).rejects.toMatchObject({
        outcome: "unknown",
        code: "CACHE_COMMAND_FAILED",
      });
    }
    client.get.mockRejectedValueOnce(new ErrorReply("WRONGTYPE"));
    await expect(cache.getVersioned("item")).rejects.toMatchObject({
      outcome: "definite-failure",
      code: "CACHE_COMMAND_FAILED",
    });
    expect(client.eval).toHaveBeenCalledTimes(2);
    expect(client.destroy).not.toHaveBeenCalled();
  });

  it("tracks and counts actual unknown work until settlement across recovery; no blind retry", async () => {
    setup();
    const { cache, client, tracked } = await open();
    let finish!: (value: unknown) => void;
    client.eval.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let actualSettled = false;
    const call = expect(cache.setIfNewer("item", record())).rejects.toMatchObject({
      outcome: "unknown",
      code: "INTERRUPTED",
    });
    tracked[1]?.finally(() => {
      actualSettled = true;
    });
    await vi.advanceTimersByTimeAsync(150);
    await call;
    expect(actualSettled).toBe(false);
    expect(client.destroy).toHaveBeenCalledOnce();
    await expect(cache.admit("item", { limit: 1, windowMs: 1000 })).rejects.toMatchObject({
      outcome: "refused",
      code: "CACHE_UNAVAILABLE",
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(clients).toHaveLength(2);
    expect(clients[1]?.eval).not.toHaveBeenCalled();
    finish(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(actualSettled).toBe(true);
    await expect(cache.ping()).resolves.toBe("PONG");
    expect(clients[1]?.destroy).not.toHaveBeenCalled();
    expect(client.eval).toHaveBeenCalledTimes(1);
  });

  it("retains all unsettled slots across destruction and never revives an old generation", async () => {
    setup();
    const { cache, client, onState } = await open();
    const finish: ((value: unknown) => void)[] = [];
    client.eval.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish.push(resolve);
        }),
    );
    const results = Promise.allSettled(
      Array.from({ length: 32 }, () => cache.setIfNewer("item", record())),
    );
    await vi.advanceTimersByTimeAsync(150);
    expect(
      (await results).every(
        (result) => result.status === "rejected" && result.reason.outcome === "unknown",
      ),
    ).toBe(true);
    expect(client.destroy).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5000);
    await expect(cache.ping()).rejects.toMatchObject({
      outcome: "refused",
      code: "CACHE_SATURATED",
    });
    expect(clients[1]?.destroy).not.toHaveBeenCalled();
    finish[0]?.(1);
    await vi.advanceTimersByTimeAsync(0);
    await expect(cache.ping()).resolves.toBe("PONG");
    for (const resolve of finish.slice(1)) resolve(1);
    client.emit("error", Error("old generation"));
    await vi.advanceTimersByTimeAsync(10000);
    expect(clients).toHaveLength(2);
    expect(clients[1]?.destroy).not.toHaveBeenCalled();
    expect(onState.mock.calls.map((call) => call[0])).toEqual([
      "available",
      "unavailable",
      "available",
    ]);
  });

  it("distinguishes actual socket disconnect and end events, recovering once after bounded backoff", async () => {
    setup();
    const { cache, client, onState } = await open();
    client.emit("error", Error("Socket closed unexpectedly"));
    client.emit("end");
    expect(client.destroy).toHaveBeenCalledOnce();
    await expect(cache.admit("item", { limit: 1, windowMs: 1000 })).rejects.toMatchObject({
      outcome: "refused",
      code: "CACHE_UNAVAILABLE",
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(clients).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(clients).toHaveLength(2);
    expect(onState.mock.calls.map((x) => x[0])).toEqual(["available", "unavailable", "available"]);
    client.emit("error", Error("late"));
    await expect(cache.ping()).resolves.toBe("PONG");
    clients[1]?.emit("end");
    await vi.advanceTimersByTimeAsync(5000);
    expect(clients).toHaveLength(3);
    await expect(cache.ping()).resolves.toBe("PONG");
  });

  it("bounds unresolved connection attempts and closes reconnect on lifecycle cancellation", async () => {
    setup();
    let finish!: () => void;
    connects.push(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const starting = open();
    await vi.advanceTimersByTimeAsync(500);
    const { cache, client, tracked, abort } = await starting;
    expect(tracked).toHaveLength(1);
    expect(client.destroy).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(30000);
    expect(clients).toHaveLength(1);
    finish();
    await vi.advanceTimersByTimeAsync(5000);
    expect(clients).toHaveLength(2);
    await expect(cache.ping()).resolves.toBe("PONG");
    abort.abort();
    expect(clients[1]?.destroy).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(30000);
    expect(clients).toHaveLength(2);
    await expect(cache.ping()).rejects.toMatchObject({ outcome: "refused" });
  });

  it("uses remaining budget/cancellation: expired contexts dispatch nothing and midflight mutation stays unknown", async () => {
    setup();
    const { cache, client, tracked } = await open();
    const request = operation.operation({ maximumMs: 20 });
    await operation.withOperation(request.context, async () => {
      let finish!: (reply: unknown) => void;
      client.eval.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const pending = expect(
        cache.admit("item", { limit: 1, windowMs: 1000 }),
      ).rejects.toMatchObject({ outcome: "unknown" });
      await vi.advanceTimersByTimeAsync(20);
      await pending;
      const before = client.eval.mock.calls.length;
      for (const call of [
        () => cache.admit("item", { limit: 1, windowMs: 1000 }),
        () => cache.setIfNewer("item", record()),
        () => cache.getVersioned("item"),
      ])
        await expect(call()).rejects.toMatchObject({ outcome: "refused", code: "CONTEXT_EXPIRED" });
      expect(client.eval).toHaveBeenCalledTimes(before);
      finish([1, 1, Date.now(), Date.now() + 1000]);
      await tracked[1];
    });
    request.close();
  });

  it("guards captured primitives through nested local effects; only private coordination may mutate in a read", async () => {
    setup();
    const { cache, client } = await open();
    for (const call of [
      () => cache.admit("item", { limit: 1, windowMs: 1000 }),
      () => cache.setIfNewer("item", record()),
      () => cache.getVersioned("item"),
      () => cache.get("item"),
      () => cache.ping(),
    ])
      await expect(async () =>
        operation.withLocalMutation(() => operation.withEffect("read", call)),
      ).rejects.toMatchObject({ outcome: "refused", code: "EFFECT_NOT_ALLOWED" });
    for (const call of [
      () => cache.set("item", "value"),
      () => cache.delete("item"),
      () => cache.setIfNewer("item", record()),
    ])
      await expect(async () => operation.withEffect("read", call)).rejects.toMatchObject({
        outcome: "refused",
        code: "EFFECT_NOT_ALLOWED",
      });
    expect(client.eval).not.toHaveBeenCalled();
    expect(client.get).not.toHaveBeenCalled();
    expect(client.ping).not.toHaveBeenCalled();
    expect(client.destroy).not.toHaveBeenCalled();
    client.eval.mockResolvedValue([1, 1, Date.now(), Date.now() + 1000]);
    expect(
      await operation.withEffect("read", () => cache.admit("item", { limit: 1, windowMs: 1000 })),
    ).toMatchObject({ admitted: true });
    expect(client.eval).toHaveBeenCalledTimes(1);
  });
});

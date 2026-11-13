import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it, vi } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Dependencies as loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { positiveCacheReadAccess } from "./positive-cache.ts";
import type { V2Emitter } from "./registry.ts";

const source = (name: string) =>
  readFileSync(
    new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
    "utf8",
  );
const moduleUrl = (code: string) =>
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(code)).toString("base64")}`;
const { createPositiveReader } = await import(moduleUrl(source("positive-cache")));
type Document = { slug: string; url: string; public: boolean; expires: number | null };
const document = (slug = "guide"): Document => ({
  slug,
  url: "/manuals/revision-7.pdf",
  public: true,
  expires: null,
});
const codec = {
  parse(value: unknown): Document {
    const v = value as Document;
    if (
      !v ||
      typeof v.slug !== "string" ||
      typeof v.url !== "string" ||
      typeof v.public !== "boolean" ||
      !(v.expires === null || Number.isSafeInteger(v.expires))
    )
      throw new Error("Invalid immutable manual");
    return { slug: v.slug, url: v.url, public: v.public, expires: v.expires };
  },
};
const adapter = (load = vi.fn(async (_slug: string): Promise<unknown | null> => document())) => ({
  key: (slug: string) => `manual:v1:${slug}`,
  codec,
  eligible: (record: Document, slug: string) => record.slug === slug && record.public,
  load,
  expiresAt: (record: Document) => record.expires,
});
const emptyCache = () => ({
  get: vi.fn(async (_key: string): Promise<string | null> => null),
  set: vi.fn(async (_key: string, _value: string, _expiry: { PXAT: number }) => "OK"),
});

describe("emitted positive cache reader", () => {
  it("coalesces same-key fills, uses validated hits and serves a non-video immutable lookup", async () => {
    let release!: (value: Document) => void;
    const a = adapter(
      vi.fn(
        () =>
          new Promise<Document>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const cache = emptyCache();
    const read = createPositiveReader({ adapter: a, ttlSeconds: 3600, cache });
    const first = read("guide");
    expect(read("guide")).toBe(first);
    await vi.waitFor(() => expect(a.load).toHaveBeenCalledTimes(1));
    release(document());
    expect(await first).toEqual(document());
    expect(cache.set).toHaveBeenCalledTimes(1);
    cache.get.mockResolvedValue(JSON.stringify(document()));
    expect(await read("guide")).toEqual(document());
    expect(a.load).toHaveBeenCalledTimes(1);
    expect(cache.get).toHaveBeenCalledWith("manual:v1:guide");
  });

  it("falls back on corrupt, wrong-identity, ineligible and failed cache reads", async () => {
    const a = adapter(),
      cache = emptyCache();
    const read = createPositiveReader({ adapter: a, ttlSeconds: 60, cache });
    for (const raw of [
      "{",
      "{}",
      JSON.stringify(document("other")),
      JSON.stringify({ ...document(), public: false }),
    ]) {
      cache.get.mockResolvedValueOnce(raw);
      expect(await read("guide")).toEqual(document());
    }
    cache.get.mockRejectedValueOnce(new Error("Unavailable"));
    expect(await read("guide")).toEqual(document());
    expect(a.load).toHaveBeenCalledTimes(5);
  });

  it("never caches absence or ineligible records, preserves primary errors and releases fills", async () => {
    const a = adapter(),
      cache = emptyCache();
    const read = createPositiveReader({ adapter: a, ttlSeconds: 60, cache });
    a.load
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...document(), public: false })
      .mockResolvedValueOnce(document("other"));
    for (let i = 0; i < 3; i++) expect(await read("guide")).toBeNull();
    expect(cache.set).not.toHaveBeenCalled();
    a.load.mockRejectedValueOnce(new Error("Primary unavailable"));
    await expect(read("guide")).rejects.toThrow("Primary unavailable");
    expect(await read("guide")).toEqual(document());
    expect(a.load).toHaveBeenCalledTimes(5);
  });

  it("preserves successful primary reads on failed fills and bounds stalled read/fill phases", async () => {
    vi.useFakeTimers();
    try {
      const a = adapter(),
        cache = emptyCache();
      cache.set.mockRejectedValueOnce(new Error("Fill unavailable"));
      const read = createPositiveReader({ adapter: a, ttlSeconds: 60, cache });
      expect(await read("guide")).toEqual(document());
      await vi.advanceTimersByTimeAsync(5000); // The failed fill skips the cache for 5 s.
      cache.get.mockImplementationOnce(() => new Promise(() => {}));
      const stalledRead = read("guide");
      await vi.advanceTimersByTimeAsync(150);
      expect(await stalledRead).toEqual(document());
      expect(await read("guide")).toEqual(document());
      expect(cache.get).toHaveBeenCalledTimes(2); // A second read within 5 s doesn't call the cache.
      // A get that never settles keeps the cache unused across three 5 s intervals.
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(5000);
        expect(await read("guide")).toEqual(document());
      }
      expect(cache.get).toHaveBeenCalledTimes(2);
      // A stalled get that settles at 7 s lets a read after that call the cache again.
      const lateCache = emptyCache();
      lateCache.get.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 7000)),
      );
      const lateReader = createPositiveReader({ adapter: a, ttlSeconds: 60, cache: lateCache });
      const late = lateReader("guide");
      await vi.advanceTimersByTimeAsync(150);
      expect(await late).toEqual(document());
      await vi.advanceTimersByTimeAsync(5350); // 5.5 s: past the five seconds, still unsettled.
      expect(await lateReader("guide")).toEqual(document());
      expect(lateCache.get).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1500); // 7 s: the stalled get settles.
      expect(await lateReader("guide")).toEqual(document());
      expect(lateCache.get).toHaveBeenCalledTimes(2);
      const fillCache = emptyCache();
      fillCache.set.mockImplementationOnce(() => new Promise(() => {}));
      const fillReader = createPositiveReader({ adapter: a, ttlSeconds: 60, cache: fillCache });
      const stalledFill = fillReader("guide");
      await vi.advanceTimersByTimeAsync(150);
      expect(await stalledFill).toEqual(document());
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads the database alone for 5 s after a cache get rejects, and keeps the cache after a bad entry", async () => {
    vi.useFakeTimers();
    try {
      const failures: string[] = [];
      const a = adapter(vi.fn(async (slug: string): Promise<unknown | null> => document(slug)));
      const cache = emptyCache();
      cache.get.mockRejectedValue(new Error("Cache unavailable"));
      const read = createPositiveReader({
        adapter: a,
        ttlSeconds: 60,
        cache,
        onFailure: (what: string) => failures.push(what),
      });
      for (let i = 0; i < 10; i++) {
        expect(await read(`video-${i}`)).toEqual(document(`video-${i}`));
        await vi.advanceTimersByTimeAsync(400);
      }
      expect(cache.get).toHaveBeenCalledTimes(1);
      expect(cache.get).toHaveBeenCalledWith("manual:v1:video-0");
      expect(cache.set).not.toHaveBeenCalled();
      expect(failures).toEqual(["cache read"]);
      expect(a.load).toHaveBeenCalledTimes(10);
      await vi.advanceTimersByTimeAsync(1000); // 5 s after the rejected get.
      expect(await read("video-10")).toEqual(document("video-10"));
      expect(cache.get).toHaveBeenCalledTimes(2);
      // A cached value that fails to decode is one bad entry: the next read calls the cache.
      const bad = emptyCache();
      bad.get.mockResolvedValueOnce("{not json");
      const badReader = createPositiveReader({ adapter: a, ttlSeconds: 60, cache: bad });
      expect(await badReader("guide")).toEqual(document());
      expect(await badReader("guide")).toEqual(document());
      expect(bad.get).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells onFailure of a corrupt cached value and a failed fill, and still answers from the loader", async () => {
    const failures: [string, unknown][] = [];
    const a = adapter(),
      cache = emptyCache();
    cache.get.mockResolvedValue("{not json");
    cache.set.mockRejectedValue(new Error("Fill unavailable"));
    const read = createPositiveReader({
      adapter: a,
      ttlSeconds: 60,
      cache,
      onFailure: (what: string, error: unknown) => failures.push([what, error]),
    });
    expect(await read("guide")).toEqual(document());
    expect(a.load).toHaveBeenCalledTimes(1);
    expect(failures.map(([what]) => what)).toEqual(["cache read", "cache fill"]);
    expect(failures[0]?.[1]).toBeInstanceOf(SyntaxError);
    expect(failures[1]?.[1]).toEqual(new Error("Fill unavailable"));
    // An onFailure that throws changes nothing.
    const guarded = createPositiveReader({
      adapter: a,
      ttlSeconds: 60,
      cache,
      onFailure: () => {
        throw new Error("Log unavailable");
      },
    });
    expect(await guarded("guide")).toEqual(document());
  });

  it("clamps absolute expiry without rounding up, skips subsecond fills and rechecks after filling", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    try {
      const a = adapter(),
        cache = emptyCache();
      const read = createPositiveReader({ adapter: a, ttlSeconds: 60, cache });
      await read("guide");
      expect(cache.set.mock.calls.at(-1)?.[2]).toEqual({ PXAT: 160000 });
      a.load.mockResolvedValue({ ...document(), expires: 102345 });
      await read("guide");
      expect(cache.set.mock.calls.at(-1)?.[2]).toEqual({ PXAT: 102345 });
      cache.set.mockClear();
      a.load.mockResolvedValue({ ...document(), expires: 100999 });
      expect(await read("guide")).toMatchObject({ expires: 100999 });
      expect(cache.set).not.toHaveBeenCalled();
      a.load.mockResolvedValue({ ...document(), expires: 100000 });
      expect(await read("guide")).toBeNull();
      cache.get.mockResolvedValueOnce(JSON.stringify({ ...document(), expires: 100000 }));
      a.load.mockResolvedValue(document());
      expect(await read("guide")).toEqual(document()); // Expired hit reloads authority.
      a.load.mockResolvedValue({ ...document(), expires: 101000 });
      cache.set.mockImplementationOnce(async () => {
        vi.setSystemTime(101000);
        return "OK";
      });
      expect(await read("guide")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits authoritative TTL/resources, refuses mirrors and grants only an explicitly contributed view", () => {
    const generation = generationSelectionsFixture();
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: {
        ...generation,
        preset: undefined,
        selections: generation.selections.filter((s) => s.binding.kind === "positive-cache-read"),
      },
    });
    const emit = (features: readonly V2Emitter[] = []) =>
      assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry(features));
    const get = (bundle: ReturnType<typeof emit>, path: string) =>
      new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
    const bundle = emit();
    expect(bundle.report.applicationComplete).toBe(false);
    expect(loadLocalV2Registry().installed.templates).toEqual([]);
    expect(JSON.parse(get(bundle, "infra/local.json")).logins).toEqual([]);
    expect(get(bundle, "src/features/positive-cache-bindings.ts")).toContain('"ttlSeconds":3600');
    if (design.schemaVersion !== 3) throw new Error();
    const cache = design.architecture?.studio?.elements.find((e) => e.element === "metadata-cache");
    if (cache?.settings.kind !== "cache") throw new Error();
    cache.settings.ttlSeconds = 7200;
    const reader = design.architecture?.studio?.components?.find(
      (c) => c.id === "watch-cache-reader",
    );
    if (reader?.settings.kind !== "cache-reader") throw new Error();
    expect(() => emit()).toThrow(); // Existing mirror must agree; no hidden default.
    reader.settings.l2TtlSeconds = 7200;
    expect(get(emit(), "src/features/positive-cache-bindings.ts")).toContain('"ttlSeconds":7200');
    const feature: V2Emitter = {
      id: "probe.public-view",
      version: "0.1.0",
      status: "implemented",
      description: "Trusted explicit projection probe",
      sourcePaths: ["jeeves-generator/src/v2/positive-cache.ts"],
      render: () => ({ files: [] }),
      local: () => ({
        ...positiveCacheReadAccess({
          resource: "metadata-db",
          host: "watch",
          view: { schema: "public_read", name: "manuals" },
          sourcePaths: ["/generation/selections/0"],
        }),
        views: [
          {
            resource: "metadata-db",
            schema: "public_read",
            name: "manuals",
            selectSql: "SELECT 'manual'::text AS slug",
          },
        ],
      }),
    };
    const plan = JSON.parse(get(emit([feature]), "infra/local.json"));
    expect(plan.logins).toHaveLength(1);
    expect(plan.grants).toEqual([
      {
        resource: "metadata-db",
        host: "watch",
        schema: "public_read",
        relation: "manuals",
        kind: "view",
        privileges: ["SELECT"],
      },
    ]);
  });

  it("uses bound Valkey credentials/endpoint, fixed queue bounds and destructive command/startup deadlines", async () => {
    vi.useFakeTimers();
    const configs: unknown[] = [];
    let stalledConnect = false;
    const clients: {
      isOpen: boolean;
      destroy: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    }[] = [];
    vi.stubGlobal("__positiveCacheClient", (config: unknown) => {
      configs.push(config);
      const client = {
        isOpen: false,
        on: vi.fn(),
        destroy: vi.fn(() => {
          client.isOpen = false;
        }),
        connect: vi.fn(() => {
          client.isOpen = true;
          return stalledConnect ? new Promise(() => {}) : Promise.resolve();
        }),
        get: vi.fn(async () => "value"),
        set: vi.fn(async () => "OK"),
      };
      clients.push(client);
      return client;
    });
    try {
      const fakeRedis = moduleUrl("export const createClient = globalThis.__positiveCacheClient;");
      const code = source("valkey")
        .replace('from "redis"', `from "${fakeRedis}"`)
        .replace(
          'import { readSecret } from "./local.ts";',
          'const readSecret = () => { throw new Error("Unexpected secret read"); };',
        );
      const { createValkeyCache } = await import(moduleUrl(code));
      const binding = { hostname: "cache-manuals", port: 6379, secret: "cache-manuals" };
      const credential = vi.fn(() => "probe-password");
      const cache = await createValkeyCache({ binding, credential });
      expect(configs[0]).toEqual({
        password: "probe-password",
        disableOfflineQueue: true,
        commandsQueueMaxLength: 32,
        socket: {
          host: binding.hostname,
          port: 6379,
          connectTimeout: 500,
          reconnectStrategy: false,
        },
      });
      expect(credential).toHaveBeenCalledWith(binding.secret);
      await cache.set("key", "value", { PXAT: 120000 });
      expect(clients[0]?.set).toHaveBeenCalledWith("key", "value", { PXAT: 120000 });
      clients[0]?.get.mockImplementationOnce(() => new Promise(() => {}));
      const command = expect(cache.get("key")).rejects.toThrow("Cache deadline");
      await vi.advanceTimersByTimeAsync(150);
      await command;
      await expect(cache.get("key")).rejects.toThrow("Cache unavailable");
      expect(clients[0]?.destroy).toHaveBeenCalledTimes(1);
      cache.close();
      stalledConnect = true;
      const startup = createValkeyCache({ binding, credential });
      await vi.advanceTimersByTimeAsync(500);
      const unavailable = await startup;
      await expect(unavailable.get("key")).rejects.toThrow("Cache unavailable");
      expect(clients[1]?.destroy).toHaveBeenCalledTimes(1);
      unavailable.close();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

type FakeValkeyClient = {
  connect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  /** Emits the client's `error` event. */
  fail(error: unknown): void;
};
/** The Valkey template on a fake redis, with fake timers. Each new client's connect takes the
 * next of `connects` and resolves when none is queued. */
async function withFakeValkey(
  test: (valkey: {
    clients: FakeValkeyClient[];
    connects: (() => Promise<void>)[];
    open(onState: (state: string, error?: unknown) => void): Promise<{
      get(key: string): Promise<string | null>;
      close(): void;
    }>;
  }) => Promise<void>,
) {
  vi.useFakeTimers();
  const clients: FakeValkeyClient[] = [];
  const connects: (() => Promise<void>)[] = [];
  vi.stubGlobal("__valkeyClient", () => {
    const listeners: ((error: unknown) => void)[] = [];
    const client = {
      isOpen: false,
      on: vi.fn((event: string, listener: (error: unknown) => void) => {
        if (event === "error") listeners.push(listener);
        return client;
      }),
      fail: (error: unknown) => {
        for (const listener of listeners) listener(error);
      },
      destroy: vi.fn(() => {
        client.isOpen = false;
      }),
      connect: vi.fn(() => {
        client.isOpen = true;
        return (connects.shift() ?? (() => Promise.resolve()))();
      }),
      get: vi.fn(async () => "value"),
      set: vi.fn(async () => "OK"),
    };
    clients.push(client);
    return client;
  });
  try {
    const fakeRedis = moduleUrl(
      "export const createClient = (options) => globalThis.__valkeyClient(options);",
    );
    const code = source("valkey")
      .replace('from "redis"', `from "${fakeRedis}"`)
      .replace(
        'import { readSecret } from "./local.ts";',
        'const readSecret = () => { throw new Error("Unexpected secret read"); };',
      );
    const { createValkeyCache } = await import(moduleUrl(code));
    const binding = { hostname: "cache-manuals", port: 6379, secret: "cache-manuals" };
    await test({
      clients,
      connects,
      open: (onState) =>
        createValkeyCache({ binding, credential: () => "probe-password", onState }),
    });
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
}
const recorder = () => {
  const states: [string, unknown][] = [];
  return { states, onState: (state: string, error?: unknown) => states.push([state, error]) };
};
const client = (clients: FakeValkeyClient[], index: number) => {
  const found = clients[index];
  if (!found) throw new Error(`No client ${index}`);
  return found;
};

describe("emitted Valkey cache reconnects", () => {
  it("reports the first connect's result once and retries a failed first connect 5 s later", () =>
    withFakeValkey(async ({ clients, connects, open }) => {
      const up = recorder();
      const cache = await open(up.onState);
      await vi.advanceTimersByTimeAsync(10000);
      expect(up.states).toEqual([["available", undefined]]);
      expect(clients).toHaveLength(1);
      cache.close();
      const refused = new Error("connect ECONNREFUSED");
      connects.push(() => Promise.reject(refused));
      const down = recorder();
      const unavailable = await open(down.onState);
      expect(down.states).toEqual([["unavailable", refused]]);
      expect(client(clients, 1).destroy).toHaveBeenCalledTimes(1);
      await expect(unavailable.get("key")).rejects.toThrow("Cache unavailable");
      await vi.advanceTimersByTimeAsync(4999);
      expect(clients).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(clients).toHaveLength(3);
      expect(client(clients, 2).connect).toHaveBeenCalledTimes(1);
      expect(down.states.map(([state]) => state)).toEqual(["unavailable", "available"]);
      unavailable.close();
    }));

  it("rejects as unavailable after an error event and connects a new client 5 s later", () =>
    withFakeValkey(async ({ clients, open }) => {
      const { states, onState } = recorder();
      const cache = await open(onState);
      const lost = new Error("Socket closed unexpectedly");
      client(clients, 0).fail(lost);
      await expect(cache.get("key")).rejects.toThrow("Cache unavailable");
      expect(states).toEqual([
        ["available", undefined],
        ["unavailable", lost],
      ]);
      expect(client(clients, 0).destroy).toHaveBeenCalledTimes(1);
      expect(client(clients, 0).get).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5000);
      expect(clients).toHaveLength(2);
      expect(client(clients, 1).connect).toHaveBeenCalledTimes(1);
      expect(states).toHaveLength(3);
      expect(states[2]).toEqual(["available", undefined]);
      await expect(cache.get("key")).resolves.toBe("value");
      expect(client(clients, 1).get).toHaveBeenCalledWith("key");
      cache.close();
    }));

  it("reports no further unavailable for three failed reconnects in a row", () =>
    withFakeValkey(async ({ clients, connects, open }) => {
      const { states, onState } = recorder();
      const cache = await open(onState);
      client(clients, 0).fail(new Error("Socket closed unexpectedly"));
      for (let i = 0; i < 3; i++) connects.push(() => Promise.reject(new Error("ECONNREFUSED")));
      for (let i = 1; i <= 3; i++) {
        await vi.advanceTimersByTimeAsync(5000);
        expect(clients).toHaveLength(i + 1);
        expect(client(clients, i).destroy).toHaveBeenCalledTimes(1);
      }
      expect(states.map(([state]) => state)).toEqual(["available", "unavailable"]);
      await expect(cache.get("key")).rejects.toThrow("Cache unavailable");
      await vi.advanceTimersByTimeAsync(5000);
      expect(states.map(([state]) => state)).toEqual(["available", "unavailable", "available"]);
      await expect(cache.get("key")).resolves.toBe("value");
      cache.close();
    }));

  it("ignores the old client's error event and late command result once a new client is active", () =>
    withFakeValkey(async ({ clients, open }) => {
      const { states, onState } = recorder();
      const cache = await open(onState);
      let rejectOld!: (error: unknown) => void;
      client(clients, 0).get.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectOld = reject;
          }),
      );
      const old = expect(cache.get("key")).rejects.toThrow("Cache deadline");
      client(clients, 0).fail(new Error("Socket closed unexpectedly"));
      await vi.advanceTimersByTimeAsync(5000);
      await old;
      expect(states.map(([state]) => state)).toEqual(["available", "unavailable", "available"]);
      rejectOld(new Error("Connection reset"));
      client(clients, 0).fail(new Error("Late error"));
      await vi.advanceTimersByTimeAsync(10000);
      expect(states).toHaveLength(3);
      expect(clients).toHaveLength(2);
      expect(client(clients, 1).destroy).not.toHaveBeenCalled();
      await expect(cache.get("key")).resolves.toBe("value");
      cache.close();
    }));

  it("reports one unavailable and starts one timer when two commands fail together", () =>
    withFakeValkey(async ({ clients, open }) => {
      const { states, onState } = recorder();
      const cache = await open(onState);
      const reset = new Error("Connection reset");
      client(clients, 0).get.mockRejectedValue(reset);
      const results = await Promise.allSettled([cache.get("a"), cache.get("b")]);
      expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
      expect(client(clients, 0).get).toHaveBeenCalledTimes(2);
      expect(states).toEqual([
        ["available", undefined],
        ["unavailable", reset],
      ]);
      expect(client(clients, 0).destroy).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(10000);
      expect(clients).toHaveLength(2);
      cache.close();
    }));

  it("destroys a reconnect still connecting on close, and nothing follows", () =>
    withFakeValkey(async ({ clients, connects, open }) => {
      const { states, onState } = recorder();
      const cache = await open(onState);
      client(clients, 0).fail(new Error("Socket closed unexpectedly"));
      let connected!: () => void;
      connects.push(
        () =>
          new Promise<void>((resolve) => {
            connected = resolve;
          }),
      );
      await vi.advanceTimersByTimeAsync(5000);
      expect(clients).toHaveLength(2);
      expect(client(clients, 1).connect).toHaveBeenCalledTimes(1);
      cache.close();
      expect(client(clients, 1).destroy).toHaveBeenCalled();
      connected();
      await vi.advanceTimersByTimeAsync(20000);
      expect(states.map(([state]) => state)).toEqual(["available", "unavailable"]);
      expect(clients).toHaveLength(2);
      await expect(cache.get("key")).rejects.toThrow("Cache unavailable");
    }));

  it("keeps get and the reconnect working when onState throws", () =>
    withFakeValkey(async ({ clients, open }) => {
      const onState = vi.fn((_state: string, _error?: unknown) => {
        throw new Error("Log unavailable");
      });
      const cache = await open(onState);
      await expect(cache.get("key")).resolves.toBe("value");
      expect(() => client(clients, 0).fail(new Error("Socket closed unexpectedly"))).not.toThrow();
      await expect(cache.get("key")).rejects.toThrow("Cache unavailable");
      await vi.advanceTimersByTimeAsync(5000);
      await expect(cache.get("key")).resolves.toBe("value");
      expect(onState.mock.calls.map(([state]) => state)).toEqual([
        "available",
        "unavailable",
        "available",
      ]);
      cache.close();
    }));
});

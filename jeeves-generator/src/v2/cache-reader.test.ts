import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import { cacheReaderDesign } from "../../../field-projects/generator-system/fixtures/rg-cache-reader/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { operationImports, operationUrl } from "./operation.test.helpers.ts";
import { productContractUrl } from "./product-sql.test.helpers.ts";

const source = (name: string) =>
  readFileSync(
    new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
    "utf8",
  );
const url = (code: string) =>
  `data:text/javascript;base64,${Buffer.from(operationImports(stripTypeScriptTypes(code))).toString("base64")}`;
const runtime = await import(
  url(
    source("positive-cache").replace(
      'from "./hook-boundary.ts"',
      `from "${url(source("hook-boundary"))}"`,
    ),
  )
);
const op = await import(operationUrl);
type RecordDto = {
  key: string;
  public: boolean;
  version: string;
  until: number;
  destination: string;
};
const record = (version = "1", until = Date.now() + 60000): RecordDto => ({
  key: "guide",
  public: true,
  version,
  until,
  destination: `/v${version}`,
});
const hooks = (load = vi.fn(async (_input: { key: string }) => record())) => ({
  key: (input: { key: string }) => `product:${input.key}`,
  codec: { parse: (value: unknown) => value as RecordDto },
  eligible: (value: RecordDto, input: { key: string }) => value.public && value.key === input.key,
  load,
  expiresAt: (value: RecordDto) => value.until,
  version: (value: RecordDto) => value.version,
});
// Independent store oracle; native Valkey/competing process checkpoint is RG14.
function store() {
  const entries = new Map<string, { version: string; value: string; validUntil: number }>();
  return {
    entries,
    get: vi.fn(async (): Promise<string | null> => null),
    fillImmutable: vi.fn(async () => "OK"),
    getVersioned: vi.fn(async (key: string) => {
      const v = entries.get(key);
      return v && v.validUntil > Date.now() ? v : null;
    }),
    setIfNewer: vi.fn(
      async (key: string, value: { version: string; value: string; validUntil: number }) => {
        const previous = entries.get(key);
        if (value.validUntil <= Date.now())
          return { status: "expired", validUntil: value.validUntil };
        if (previous && BigInt(previous.version) > BigInt(value.version))
          return { status: "not-newer", validUntil: value.validUntil };
        if (previous?.version === value.version && previous.value !== value.value)
          return { status: "version-conflict", validUntil: value.validUntil };
        if (previous?.version === value.version && previous.validUntil >= value.validUntil)
          return { status: "not-newer", validUntil: value.validUntil };
        entries.set(key, { ...value });
        return { status: "stored", validUntil: value.validUntil };
      },
    ),
  };
}
const reader = (
  adapter: ReturnType<typeof hooks>,
  cache?: ReturnType<typeof store>,
  freshness = "versioned",
) => runtime.createCacheReader({ adapter, cache, freshness, ttlSeconds: 60 });
const within = (subject: string, action: () => Promise<unknown>) => {
  const operation = op.operation({ maximumMs: 2000, caller: { subject } });
  return op.withOperation(operation.context, action).finally(() => operation.close());
};

describe("RG13 callable freshness", () => {
  it("uses a generated registered SELECT binding under product grants, refusing commands", async () => {
    const bundle = assembleV2(
      { designJson: JSON.stringify(cacheReaderDesign()) },
      loadLocalV2Registry(),
    );
    const text = (path: string) =>
      new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
    const maximum = JSON.parse(text("infra/local.json")).databases.find(
      (db: { resource: string }) => db.resource === "previews-db",
    );
    expect(maximum.productSql.bindings).toContainEqual({
      host: "preview-api",
      module: "preview-reader",
      access: "read",
    });
    const fixture = (name: string) =>
      readFileSync(
        new URL(
          `../../../field-projects/generator-system/fixtures/rg-cache-reader/${name}`,
          import.meta.url,
        ),
        "utf8",
      );
    const declaration = fixture("products.json"),
      query = fixture("read.sql");
    const operations = await import(
      url(
        text("src/runtime/product-operations.ts")
          .replace('from "./product-contract.ts"', `from "${productContractUrl}"`)
          .replace('from "./hook-boundary.ts"', `from "${url(source("hook-boundary"))}"`),
      )
    );
    const pg = new PGlite();
    try {
      await pg.exec(`CREATE SCHEMA p_preview_api_owner;${fixture("0001-initial.sql")}`);
      const value = record();
      await pg.query("INSERT INTO p_preview_api_owner.records VALUES ($1,$2)", [
        "guide",
        JSON.stringify(value),
      ]);
      const executed = vi.fn(async (sql: string, values: unknown[], readOnly: boolean) => {
        expect(readOnly).toBe(true);
        const result = await pg.query(sql, values);
        return { rows: result.rows, rowCount: result.rows.length };
      });
      const reads = operations.registeredProductOperations(
        maximum,
        { tile: "preview-api", module: "preview-reader" },
        (sql: string, values: unknown[], readOnly: boolean) => {
          op.assertDatabaseAllowed();
          return executed(sql, values, readOnly);
        },
        (path: string) => (path.endsWith("products.json") ? declaration : query),
      );
      const adapter = hooks(
        vi.fn(async (input: { key: string }) => {
          const result = await reads.call("read_record", [input.key]);
          return result.rows[0]?.payload ?? null;
        }),
      );
      expect(await reader(adapter)({ key: "guide" })).toMatchObject({ record: value });
      expect(await reader(adapter)({ key: "missing" })).toBeNull();
      await expect(
        op.withLocalPolicy(() => reads.call("read_record", ["guide"])),
      ).rejects.toMatchObject({ code: "EFFECT_NOT_ALLOWED" });
      expect(executed).toHaveBeenCalledTimes(2);
      const invalid = JSON.parse(declaration);
      invalid.operations[0].kind = "command";
      expect(() =>
        operations.registeredProductOperations(
          maximum,
          { tile: "preview-api", module: "preview-reader" },
          executed,
          (path: string) => (path.endsWith("products.json") ? JSON.stringify(invalid) : query),
        ),
      ).toThrow(/exceeds module link access/);
    } finally {
      await pg.close();
    }
  });
  it("refuses a known-superseded fill when rereading fails or returns malformed/private data", async () => {
    for (const failure of ["offline", "malformed", "private"] as const) {
      const cache = store();
      cache.setIfNewer.mockResolvedValue({ status: "not-newer", validUntil: Date.now() + 1000 });
      if (failure === "offline")
        cache.getVersioned.mockResolvedValueOnce(null).mockRejectedValueOnce(Error("down"));
      else
        cache.getVersioned.mockResolvedValueOnce(null).mockResolvedValueOnce({
          version: "2",
          value: failure === "malformed" ? "{" : JSON.stringify({ ...record("2"), public: false }),
          validUntil: Date.now() + 1000,
        });
      await expect(reader(hooks(), cache)({ key: "guide" })).rejects.toMatchObject({
        code: "CACHE_SUPERSEDED",
      });
    }
  });
  it("observes rejected async pure hooks without dispatching captured effects or leaking records into logs", async () => {
    for (const name of ["key", "parse", "eligible", "expiresAt", "version"]) {
      const a = hooks();
      const reject = async () => {
        op.assertNetworkAllowed();
        throw Error("secret payload");
      };
      const adapter =
        name === "parse" ? { ...a, codec: { parse: reject } } : { ...a, [name]: reject };
      await expect(
        runtime.createCacheReader({ adapter, freshness: "versioned", ttlSeconds: 60 })({
          key: "guide",
        }),
      ).rejects.toMatchObject({ code: "CACHE_POLICY_ASYNC" });
      await Promise.resolve();
    }
    const failures: Error[] = [],
      cache = store();
    cache.get.mockResolvedValue('{"sensitive-record');
    const a = hooks();
    const read = runtime.createCacheReader({
      adapter: a,
      cache,
      freshness: "immutable-positive",
      ttlSeconds: 60,
      onFailure: (_what: string, error: Error) => failures.push(error),
    });
    await read({ key: "guide" });
    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toBe("Operation definite-failure: CACHE_READ_FAILED");
    expect(JSON.stringify(failures)).not.toContain("sensitive-record");
    cache.get.mockResolvedValue(JSON.stringify({ ...record(), destination: "sensitive-record" }));
    const bad = {
      ...a,
      codec: {
        parse: () => {
          throw Error("sensitive-record");
        },
      },
    };
    await expect(
      runtime.createCacheReader({
        adapter: bad,
        cache,
        freshness: "immutable-positive",
        ttlSeconds: 60,
        onFailure: (_what: string, error: Error) => failures.push(error),
      })({ key: "guide" }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILED" });
    expect(failures).toHaveLength(2);
    expect(failures[1]?.message).not.toContain("sensitive-record");
  });
  it("keeps unknown optional-fill outcomes and bounds global waiters without abandoning actual work", async () => {
    vi.useFakeTimers();
    try {
      const cache = store(),
        failures: unknown[] = [];
      cache.setIfNewer.mockImplementationOnce(() => new Promise(() => {}));
      const read = runtime.createCacheReader({
        adapter: hooks(),
        cache,
        ttlSeconds: 60,
        freshness: "versioned",
        onFailure: (_what: string, error: unknown) => failures.push(error),
      });
      const call = read({ key: "guide" });
      await vi.advanceTimersByTimeAsync(150);
      expect(await call).toMatchObject({ source: "authoritative" });
      expect(failures).toMatchObject([{ outcome: "unknown", code: "CACHE_FILL_FAILED" }]);
      await vi.advanceTimersByTimeAsync(10000);
      await read({ key: "guide" });
      expect(cache.setIfNewer).toHaveBeenCalledTimes(1);
      const a = hooks(vi.fn(() => new Promise<RecordDto>(() => {}))),
        shared = reader(a);
      const waiting = Array.from({ length: 128 }, (_, i) =>
        shared({ key: `key${Math.floor(i / 32)}` }),
      );
      const checked = waiting.map((p) => expect(p).rejects.toMatchObject({ code: "INTERRUPTED" }));
      await expect(shared({ key: "fifth" })).rejects.toMatchObject({
        code: "CACHE_READER_SATURATED",
      });
      expect(a.load).toHaveBeenCalledTimes(4);
      await vi.advanceTimersByTimeAsync(2000);
      await Promise.all(checked);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fences a slow old fill across independent readers, including uint64 versions", async () => {
    const cache = store();
    let release!: (value: RecordDto) => void;
    const a = hooks(
      vi.fn(
        () =>
          new Promise<RecordDto>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const slow = reader(a, cache)({ key: "guide" });
    await vi.waitFor(() => expect(a.load).toHaveBeenCalledTimes(1));
    const newer = record("18446744073709551615");
    const b = reader(hooks(vi.fn(async () => newer)), cache);
    expect(await b({ key: "guide" })).toMatchObject({
      version: newer.version,
      record: newer,
      source: "authoritative",
    });
    release(record("9007199254740993"));
    expect(await slow).toMatchObject({ version: newer.version, source: "cache" });
    expect([...cache.entries.values()][0]?.version).toBe(newer.version);
  });
  it("keeps absolute validity through query, fill, hit and a later awaited operation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    try {
      const cache = store(),
        value = record("1", 101000);
      const a = hooks(
        vi
          .fn(async () => value)
          .mockImplementationOnce(async () => {
            vi.setSystemTime(100400);
            return value;
          }),
      );
      const read = reader(a, cache);
      const answer = await read({ key: "guide" });
      expect(answer).toMatchObject({ validUntil: 101000, version: "1" });
      expect(cache.setIfNewer.mock.calls[0]?.[1].validUntil).toBe(101000);
      vi.setSystemTime(100800);
      expect(await read({ key: "guide" })).toMatchObject({ validUntil: 101000, source: "cache" });
      expect(cache.setIfNewer).toHaveBeenCalledTimes(1); // Serving never renews.
      await Promise.resolve();
      vi.setSystemTime(101000);
      expect(Date.now() < answer.validUntil).toBe(false);
      expect(await read({ key: "guide" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it("normalizes equal-version bytes and rejects conflicting contents", async () => {
    const cache = store(),
      value = record();
    await reader(hooks(vi.fn(async () => value)), cache)({ key: "guide" });
    cache.getVersioned.mockResolvedValueOnce(null);
    const reordered = Object.fromEntries(Object.entries(value).reverse()) as RecordDto;
    expect(await reader(hooks(vi.fn(async () => reordered)), cache)({ key: "guide" })).toBeTruthy();
    expect(cache.setIfNewer.mock.calls[0]?.[1].value).toBe(
      cache.setIfNewer.mock.calls[1]?.[1].value,
    );
    cache.getVersioned.mockResolvedValueOnce(null);
    await expect(
      reader(
        hooks(vi.fn(async () => ({ ...value, destination: "/changed" }))),
        cache,
      )({ key: "guide" }),
    ).rejects.toMatchObject({ code: "CACHE_VERSION_CONFLICT" });
  });
  it("does not share authorization across inputs/callers and rechecks every waiter", async () => {
    const releases: ((value: RecordDto) => void)[] = [];
    const a = hooks(
      vi.fn(
        () =>
          new Promise<RecordDto>((resolve) => {
            releases.push(resolve);
          }),
      ),
    );
    a.key = () => "colliding-key";
    const eligible = vi.spyOn(a, "eligible");
    const read = reader(a),
      one = within("a", () => read({ key: "guide" }));
    const same = within("a", () => read({ key: "guide" }));
    const other = within("b", () => read({ key: "guide" }));
    const wrong = within("a", () => read({ key: "private" }));
    expect(a.load).toHaveBeenCalledTimes(3);
    // This case compares authorization/results across independent fills. Make the common source
    // bound decisive, so millisecond differences in each fill's TTL start cannot change metadata.
    const sharedValue = record("1", Date.now() + 30000);
    for (const release of releases) release(sharedValue);
    const results = await Promise.all([one, same, other, wrong]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).not.toBe(results[1]);
    expect(Object.isFrozen(results[0])).toBe(true);
    expect(results[2]).toEqual(results[0]);
    expect(results[3]).toBeNull();
    expect(eligible).toHaveBeenCalledTimes(6);
  });
  it("bounds actual fills and same-key waiters after caller timeout; cancellation releases only waiters", async () => {
    vi.useFakeTimers();
    try {
      const a = hooks(vi.fn(() => new Promise<RecordDto>(() => {}))),
        read = reader(a);
      const pending = Array.from({ length: 32 }, (_, i) => read({ key: `k${i}` }));
      const checked = pending.map((p) => expect(p).rejects.toMatchObject({ code: "INTERRUPTED" }));
      await expect(read({ key: "excess" })).rejects.toMatchObject({
        code: "CACHE_READER_SATURATED",
      });
      await vi.advanceTimersByTimeAsync(2000);
      await Promise.all(checked);
      await expect(read({ key: "still-excess" })).rejects.toMatchObject({
        code: "CACHE_READER_SATURATED",
      });
      expect(a.load).toHaveBeenCalledTimes(32);
      const single = reader(hooks(vi.fn(() => new Promise<RecordDto>(() => {}))));
      const shared = Array.from({ length: 32 }, () => single({ key: "guide" }));
      const checkedShared = shared.map((p) =>
        expect(p).rejects.toMatchObject({ code: "INTERRUPTED" }),
      );
      await expect(single({ key: "guide" })).rejects.toMatchObject({
        code: "CACHE_READER_SATURATED",
      });
      await vi.advanceTimersByTimeAsync(2000);
      await Promise.all(checkedShared);
    } finally {
      vi.useRealTimers();
    }
  });
  it("recovers optional cache failure without restart and does not back off healthy saturation", async () => {
    vi.useFakeTimers();
    try {
      const cache = store(),
        a = hooks(),
        read = reader(a, cache);
      cache.getVersioned.mockRejectedValueOnce(Error("offline"));
      expect(await read({ key: "guide" })).toMatchObject({ source: "authoritative" });
      expect(await read({ key: "guide" })).toMatchObject({ source: "authoritative" });
      expect(cache.getVersioned).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5000);
      await read({ key: "guide" });
      expect(cache.getVersioned).toHaveBeenCalledTimes(2);
      expect(cache.setIfNewer).toHaveBeenCalledTimes(1);
      cache.getVersioned.mockRejectedValueOnce(new op.OperationError("refused", "CACHE_SATURATED"));
      await read({ key: "guide" });
      await read({ key: "guide" });
      expect(cache.getVersioned).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });
  it("guards getter snapshots, captured effects, async policies and reserved keys before load", async () => {
    const a = hooks(),
      read = reader(a);
    await expect(op.withLocalPolicy(() => read({ key: "guide" }))).rejects.toMatchObject({
      code: "EFFECT_NOT_ALLOWED",
    });
    await expect(op.withLocalMutation(() => read({ key: "guide" }))).rejects.toMatchObject({
      code: "EFFECT_NOT_ALLOWED",
    });
    expect(a.load).not.toHaveBeenCalled();
    const accessor = {
      ...a,
      get key() {
        op.assertNetworkAllowed();
        return a.key;
      },
    };
    expect(() => reader(accessor)).toThrow(/EFFECT_NOT_ALLOWED/);
    const invalid = hooks();
    invalid.key = () => "jeeves:admission:private";
    await expect(reader(invalid)({ key: "guide" })).rejects.toMatchObject({
      code: "INVALID_CACHE_KEY",
    });
    const asyncPolicy = { ...a, eligible: async () => true };
    await expect(
      runtime.createCacheReader({ adapter: asyncPolicy, freshness: "versioned", ttlSeconds: 60 })({
        key: "guide",
      }),
    ).rejects.toMatchObject({ code: "CACHE_POLICY_ASYNC" });
    expect(() =>
      runtime.createCacheReader({
        adapter: { ...a, version: undefined },
        freshness: "versioned",
        ttlSeconds: 60,
      }),
    ).toThrow(/requires version/);
    await expect(
      cacheReaderCapability(read, "x").read({ key: "guide", extra: true }),
    ).rejects.toMatchObject({ code: "CACHE_READER_INPUT" });
  });
  it("generates common callable bindings with explicit exposure and finite freshness", () => {
    const registry = loadLocalV2Registry();
    for (const freshness of ["immutable-positive", "versioned"] as const) {
      const design = cacheReaderDesign(freshness);
      const bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
      const text = (path: string) =>
        Buffer.from(bundle.files.find((f) => f.path === path)?.bytes ?? []).toString();
      const entry = text("src/processes/preview-api.ts");
      expect(entry).toContain('cacheReaderCapability(() => previewReader.read, "preview-reader")');
      expect(entry).toContain(`freshness: "${freshness}"`);
      expect(entry).not.toContain('url: "/modules/preview-reader/:key"');
      expect(text("src/modules/preview-api/read-record.slots.ts")).toContain(
        "CacheReaderCapability",
      );
      expect(bundle.report.applicationComplete).toBe(false);
      const http = assembleV2(
        { designJson: JSON.stringify(cacheReaderDesign(freshness, "http")) },
        registry,
      );
      expect(
        Buffer.from(
          http.files.find((f) => f.path === "src/processes/preview-api.ts")?.bytes ?? [],
        ).toString(),
      ).toContain('url: "/modules/preview-reader/:key"');
      const unsupported = structuredClone(design);
      const module = unsupported.architecture?.studio?.components?.find(
        (c) => c.id === "preview-reader",
      );
      if (!module) throw Error("Missing reader");
      Object.assign(module.settings, { freshness: "eventual" });
      expect(() => assembleV2({ designJson: JSON.stringify(unsupported) }, registry)).toThrow();
    }
  });
});
function cacheReaderCapability(read: (input: { key: string }) => Promise<unknown>, module: string) {
  return runtime.cacheReaderCapability(() => read, module);
}

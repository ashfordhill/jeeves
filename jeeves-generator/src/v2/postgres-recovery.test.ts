import { readFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { pathToFileURL } from "node:url";
import { expect, test, vi } from "vitest";
import { operationImports, operationUrl } from "./operation.test.helpers.ts";

const data = (source: string) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const source = (name: string) =>
  operationImports(
    stripTypeScriptTypes(
      readFileSync(
        new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
        "utf8",
      ),
    ),
  );
const require = createRequire(new URL("../../../jeeves/apps/server/package.json", import.meta.url));
const pgPath = pathToFileURL(require.resolve("pg")).href;
const pg = require("pg");
const operation = await import(operationUrl);
type Client = EventEmitter & { query(sql: string): Promise<unknown> };
type Pool = EventEmitter & { connect(): Promise<Client>; end(): Promise<void> };
const factorySource = () =>
  source("postgres")
    .replace(
      'from "pg"',
      `from "${data(`import pg from ${JSON.stringify(pgPath)};export default {Pool:class extends pg.Pool {constructor(options){super(options);globalThis.rg14Pg.pool=this;}}};`)}"`,
    )
    .replace('from "./local.ts"', `from "${data('export const readSecret=()=>"fixture";')}"`);

test("RG14: checked-out client errors stay observed after unknown COMMIT and the next transaction can recover", async () => {
  const state: { pool?: Pool } = {};
  (globalThis as { rg14Pg?: unknown }).rg14Pg = state;
  const { createPostgres } = await import(data(factorySource()));
  const { transaction } = await import(data(source("transaction")));
  const pool = createPostgres({
    hostname: "127.0.0.1",
    port: 1,
    tls: { mode: "disable" },
    login: { database: "fixture", user: "runtime", secret: "fixture" },
    poolSize: 1,
    statementTimeoutMs: 1000,
    connectionTimeoutMs: 1000,
  });
  const raw = state.pool;
  if (!raw) throw Error("factory pool");
  const releases: boolean[] = [],
    clients: Client[] = [];
  let unknown = true;
  vi.spyOn(raw, "connect").mockImplementation((async () => {
    const client = new pg.Client();
    clients.push(client);
    client.query = vi.fn(async (sql: string) => {
      if (sql === "COMMIT" && unknown) throw Error("Connection terminated unexpectedly");
      return { rows: [], rowCount: 0 };
    }) as unknown as typeof client.query;
    Object.assign(client, { release: (discard: boolean) => releases.push(discard) });
    raw.emit("connect", client);
    return client;
  }) as typeof raw.connect);
  try {
    await expect(
      transaction(pool, async (tx: { query(sql: string): Promise<unknown> }) => {
        await tx.query("INSERT INTO product VALUES (1)");
        return "stored";
      }),
    ).rejects.toMatchObject({ outcome: "unknown", code: "COMMIT_RESPONSE_LOST" });
    expect(releases).toEqual([true]);
    // The actual pinned pg.Client's later EventEmitter error must not crash Node, even after
    // discard. The query rejection above remains observable and no transaction was retried.
    expect(() =>
      clients[0]?.emit("error", Error("Connection terminated unexpectedly")),
    ).not.toThrow();
    expect(clients).toHaveLength(1);
    unknown = false;
    await expect(transaction(pool, async () => "durable replay")).resolves.toBe("durable replay");
    expect(clients).toHaveLength(2);
    expect(releases).toEqual([true, false]);
    const healthy = clients[1];
    if (!healthy) throw Error("recovered client");
    expect(healthy.listenerCount("error")).toBe(1);
    vi.mocked(raw.connect).mockResolvedValue(healthy);
    for (let checkout = 0; checkout < 3; checkout++) await transaction(pool, async () => "read");
    expect(healthy.listenerCount("error")).toBe(1);
    expect(clients).toHaveLength(2);
  } finally {
    await raw.end();
    delete (globalThis as { rg14Pg?: unknown }).rg14Pg;
  }
});

test("RG14: known-down PG has one tracked process-scoped SELECT 1 recovery probe and no late recovery after close", async () => {
  vi.useFakeTimers();
  const state: { pool?: Pool } = {};
  (globalThis as { rg14Pg?: unknown }).rg14Pg = state;
  const abort = new AbortController(),
    dependencyReady = vi.fn(),
    stops: (() => void)[] = [],
    tracked: Promise<unknown>[] = [];
  const scope = {
    signal: abort.signal,
    dependencyReady,
    admission: (stop: () => void) => stops.push(stop),
    track: (work: Promise<unknown>) => tracked.push(work),
  };
  const { createPostgres } = await import(data(factorySource()));
  const pool = operation.withProcess(scope, () =>
    createPostgres({
      hostname: "127.0.0.1",
      port: 1,
      tls: { mode: "disable" },
      login: { database: "fixture", user: "runtime", secret: "fixture" },
      poolSize: 1,
      statementTimeoutMs: 1000,
      connectionTimeoutMs: 1000,
    }),
  );
  const raw = state.pool;
  if (!raw) throw Error("factory pool");
  vi.spyOn(raw, "connect").mockRejectedValue(Error("connection lost"));
  let settle!: (value: unknown) => void;
  const query = vi.fn(() => {
    expect(operation.currentProcess()).toBe(scope);
    expect(operation.currentOperation()).toBeUndefined();
    return new Promise((resolve) => {
      settle = resolve;
    });
  });
  Object.assign(raw, { query });
  const request = operation.operation({ maximumMs: 10 });
  try {
    await expect(operation.withOperation(request.context, () => pool.connect())).rejects.toThrow(
      "connection lost",
    );
    expect(dependencyReady).toHaveBeenLastCalledWith(expect.any(Object), false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(query).toHaveBeenCalledExactlyOnceWith({ text: "SELECT 1", query_timeout: 2000 });
    expect(tracked).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15000);
    expect(query).toHaveBeenCalledTimes(1);
    settle({ rows: [{ value: 1 }], rowCount: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(dependencyReady).toHaveBeenLastCalledWith(expect.any(Object), true);
    raw.emit("error", Error("connection lost again"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(query).toHaveBeenCalledTimes(2);
    for (const stop of stops) stop();
    abort.abort();
    const calls = dependencyReady.mock.calls.length;
    settle({ rows: [], rowCount: 0 });
    await vi.advanceTimersByTimeAsync(20000);
    expect(query).toHaveBeenCalledTimes(2);
    expect(dependencyReady).toHaveBeenCalledTimes(calls);
  } finally {
    request.close();
    for (const stop of stops) stop();
    abort.abort();
    await raw.end();
    vi.useRealTimers();
    delete (globalThis as { rg14Pg?: unknown }).rg14Pg;
  }
});

import type { EventEmitter } from "node:events";

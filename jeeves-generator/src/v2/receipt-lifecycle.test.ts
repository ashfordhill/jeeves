import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumerReceiptMigration } from "./client-wiring.ts";
import { counterReceiptUpgrade, counterSchema } from "./event-counter.ts";
import {
  databases,
  fixture,
  operation,
  transaction,
  withOperation,
} from "./local-operation.test.helpers.ts";
import { operationImports } from "./operation.test.helpers.ts";

const urls = new Map<string, string>();
function load(name: string): string {
  const old = urls.get(name);
  if (old) return old;
  const base = new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts`, import.meta.url);
  const source = operationImports(
    stripTypeScriptTypes(
      readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8"),
    ),
  ).replace(/from "\.\/(.+)\.ts"/g, (_match, child: string) => `from "${load(child)}"`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const runtime = await import(load("receipt-consumer"));
const { createReceipts } = await import(load("receipts"));
const { createDeliveryRunner, consumerLiveness, requeueQuarantinedDelivery } = await import(
  load("delivery")
);
const { createEventCounter } = await import(load("event-counter"));
const { createProcessLifecycle } = await import(load("process"));
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((db) => db.close()));
});
const policy = { deliveryHorizonSeconds: 86400, retentionSeconds: 604800 };
async function receiptsFixture() {
  const f = await fixture();
  await f.pg.exec(`${consumerReceiptMigration.sql}
 GRANT SELECT,INSERT,UPDATE,DELETE ON jeeves.consumer_receipts,jeeves.consumer_receipts_maintenance,jeeves.consumer_receipts_workers TO runtime;
 CREATE SCHEMA test_clock; CREATE TABLE test_clock.time(value timestamptz NOT NULL);
 INSERT INTO test_clock.time VALUES('2026-11-17T12:00:00Z');
 CREATE FUNCTION test_clock.now() RETURNS timestamptz LANGUAGE SQL AS 'SELECT value FROM test_clock.time';
 GRANT USAGE ON SCHEMA test_clock TO runtime; GRANT SELECT ON test_clock.time TO runtime;`);
  const pool = {
    async connect() {
      const client = await f.pool.connect();
      return {
        ...client,
        query: (sql: string, values?: unknown[]) =>
          client.query(sql.replaceAll("clock_timestamp()", "test_clock.now()"), values),
      };
    },
  };
  const store = createReceipts(
    { schema: "jeeves", table: "consumer_receipts" },
    { payload: (value: unknown) => value, result: (value: unknown) => value },
    policy,
  );
  const run = async <T>(action: () => Promise<T>, maximumMs = 10000) => {
    const execution = operation({ maximumMs });
    try {
      return await withOperation(execution.context, action);
    } finally {
      execution.close();
    }
  };
  return { ...f, pool, store, run };
}
describe("RG18 receipt lifecycle", () => {
  it("uses immutable store-time deadlines, refuses insufficient retention and sweeps bounded indexed backlog without arrivals", async () => {
    const f = await receiptsFixture();
    const mutable = { ...policy };
    const store = createReceipts(
      { schema: "jeeves", table: "consumer_receipts" },
      { payload: (v: unknown) => v, result: (v: unknown) => v },
      mutable,
    );
    mutable.retentionSeconds = 1;
    for (let i = 0; i < 4; i++)
      await transaction(f.pool, (tx: unknown) =>
        store.withEffect(
          tx,
          {
            scopeKey: "consumer",
            eventId: `e${i}`,
            payload: { date: i === 0 ? "1900-01-01" : "2099-12-31" },
          },
          async () => true,
        ),
      );
    expect(
      (
        await f.pg.query(
          "SELECT DISTINCT retain_until='2026-11-24T12:00:00Z'::timestamptz valid FROM jeeves.consumer_receipts",
        )
      ).rows,
    ).toEqual([{ valid: true }]);
    expect(() =>
      createReceipts(
        { schema: "jeeves", table: "consumer_receipts" },
        {},
        { deliveryHorizonSeconds: 86400, retentionSeconds: 60 },
      ),
    ).toThrow("Insufficient");
    await f.pg.exec(
      "INSERT INTO jeeves.consumer_receipts(scope_key,event_id,payload,retain_until) VALUES('consumer','active','{}','2000-01-01')",
    );
    await f.pg.exec("UPDATE test_clock.time SET value='2026-11-24T12:00:00Z'");
    expect(await transaction(f.pool, (tx: unknown) => store.sweep(tx, 1))).toEqual({
      removed: 0,
      backlog: false,
    });
    // Even a new process declaring a shorter policy cannot shorten accepted receipt promises.
    const short = createReceipts(
      { schema: "jeeves", table: "consumer_receipts" },
      {},
      { deliveryHorizonSeconds: 1, retentionSeconds: 1 },
    );
    expect(await transaction(f.pool, (tx: unknown) => short.sweep(tx, 1))).toEqual({
      removed: 0,
      backlog: false,
    });
    await f.pg.exec("UPDATE test_clock.time SET value='2026-11-24T12:00:00.001Z'");
    expect(await transaction(f.pool, (tx: unknown) => short.sweep(tx, 1))).toEqual({
      removed: 1,
      backlog: true,
    });
    let status = await transaction(f.pool, (tx: unknown) => store.status(tx));
    expect(status.cleanup).toMatchObject({ backlog: true, removed: 1 });
    expect(status.cleanup.last_success_at).toBeTruthy();
    for (let i = 0; i < 3; i++) await transaction(f.pool, (tx: unknown) => short.sweep(tx, 1));
    status = await transaction(f.pool, (tx: unknown) => store.status(tx));
    expect(status.cleanup.backlog).toBe(false);
    expect((await f.pg.query("SELECT event_id FROM jeeves.consumer_receipts")).rows).toEqual([
      { event_id: "active" },
    ]);
    expect(consumerReceiptMigration.sql).toContain("(retain_until,scope_key,event_id)");
    for (const batch of [0, 1001, 1.5])
      await expect(transaction(f.pool, (tx: unknown) => store.sweep(tx, batch))).rejects.toThrow(
        "Invalid receipt retention batch",
      );
  });
  it("migrates legacy counter scope conservatively and refuses ambiguous cross-date legacy duplicates", async () => {
    const f = await fixture();
    const tables = {
      receipts: { schema: "legacy", table: "receipts" },
      totals: { schema: "legacy", table: "totals" },
    };
    await f.pg.exec(counterSchema(tables, { schema: "legacy_public", table: "totals" }));
    await f.pg.exec(
      `INSERT INTO legacy.receipts(scope_key,event_id,payload,result) VALUES('2026-01-01','same','{}','{"value":true}'),('2026-01-02','same','{}','{"value":true}')`,
    );
    await expect(f.pg.exec(counterReceiptUpgrade(tables))).rejects.toThrow(
      "COUNTER_LEGACY_DUPLICATE_ID_REQUIRES_RECONCILIATION",
    );
    expect(
      (await f.pg.query("SELECT scope_key FROM legacy.receipts ORDER BY scope_key")).rows,
    ).toHaveLength(2);
    await f.pg.exec("DELETE FROM legacy.receipts WHERE scope_key='2026-01-02'");
    await f.pg.exec(counterReceiptUpgrade(tables));
    expect(
      (
        await f.pg.query(
          "SELECT scope_key,retain_until>clock_timestamp()+interval '6 days' valid FROM legacy.receipts",
        )
      ).rows,
    ).toEqual([{ scope_key: "event-counter-v2", valid: true }]);
  });
  it("keeps counter identity stable when timestamps change aggregate partitions, with explicit content conflict", async () => {
    const f = await fixture();
    const tables = {
      receipts: { schema: "partitioned", table: "receipts" },
      totals: { schema: "partitioned", table: "totals" },
    };
    await f.pg.exec(counterSchema(tables, { schema: "partitioned_public", table: "totals" }));
    const counter = createEventCounter(tables, {
      event: (e: unknown) => e,
      aggregateKey: (e: { date: string }) => e.date,
      eventId: () => "stable-id",
      identity: (e: unknown) => e,
    });
    // Private fixture connection uses setup authority solely for this controlled SQL adapter proof.
    const pool = {
      async connect() {
        return {
          query: async (sql: string, values?: unknown[]) => {
            const r = await f.pg.query(sql, values);
            return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
          },
          release() {},
        };
      },
    };
    await transaction(pool, (tx: unknown) =>
      counter.record(tx, counter.parse({ date: "2026-11-17", value: 1 })),
    );
    await expect(
      transaction(pool, (tx: unknown) =>
        counter.record(tx, counter.parse({ date: "2026-11-18", value: 1 })),
      ),
    ).rejects.toMatchObject({ code: "RECEIPT_IDENTITY_CONFLICT" });
    expect(
      (await f.pg.query("SELECT aggregate_key,total::text total FROM partitioned.totals")).rows,
    ).toEqual([{ aggregate_key: "2026-11-17", total: "1" }]);
  });
  it("separates heartbeat, durable progress, unknown backlog and stale workers; bounds reads and stale-row cleanup", async () => {
    const f = await receiptsFixture();
    const beat = (progressed = false) =>
      transaction(f.pool, (tx: unknown) =>
        f.store.heartbeat(tx, {
          workerId: "worker",
          inFlight: 0,
          progressed,
          state: "running",
          backlog: null,
        }),
      );
    await beat();
    let status = await transaction(f.pool, (tx: unknown) => f.store.status(tx));
    expect(status.workers[0]).toMatchObject({
      last_progress_at: null,
      backlog: null,
      stale: false,
    });
    await f.pg.exec("UPDATE test_clock.time SET value=value+interval '46 seconds'");
    status = await transaction(f.pool, (tx: unknown) => f.store.status(tx));
    expect(status.workers[0].stale).toBe(true);
    await beat();
    status = await transaction(f.pool, (tx: unknown) => f.store.status(tx));
    expect(status.workers[0]).toMatchObject({ last_progress_at: null, stale: false });
    await beat(true);
    expect(
      (await transaction(f.pool, (tx: unknown) => f.store.status(tx))).workers[0].last_progress_at,
    ).toBeTruthy();
    await f.pg.exec(
      "INSERT INTO jeeves.consumer_receipts_workers(worker_id,consumer_id,heartbeat_at,last_progress_at,in_flight,backlog,state) SELECT 'old-'||n,'old-consumer',test_clock.now()-interval '2 days',NULL,0,NULL,'running' FROM generate_series(1,105) n",
    );
    status = await transaction(f.pool, (tx: unknown) => f.store.status(tx));
    expect(status.workers).toHaveLength(100);
    expect(status.workersTruncated).toBe(true);
    await transaction(f.pool, (tx: unknown) => f.store.sweep(tx, 100));
    expect((await transaction(f.pool, (tx: unknown) => f.store.status(tx))).workers).toHaveLength(
      6,
    );
  });
});

describe("RG18 scoped generic consumer", () => {
  async function bound(overrides: Record<string, unknown> = {}) {
    const f = await receiptsFixture();
    let effects = 0;
    const declaration = runtime.defineReceiptConsumer({
      database: "db",
      ...policy,
      map: (input: unknown, messageId: string) => ({ id: messageId, payload: input }),
      complete: async (
        event: { id: string; payload: unknown },
        commands: { call(name: string, args: unknown[]): Promise<unknown> },
      ) => {
        effects++;
        expect(Object.isFrozen(event)).toBe(true);
        expect(Object.keys(commands)).toEqual(["call"]);
        void commands.call("insert", [event.id, "projection"]);
      },
      ...overrides,
    });
    runtime.validateReceiptConsumerBinding(declaration, ["db"], true);
    const engine = runtime.bindReceiptConsumer(
      f.dependencies.db,
      runtime.receiptConsumerDefinition(declaration, "db", true),
      {
        namespace: '["db","owner","consumer-v1","project"]',
        consumerId: "project",
        pool: f.pool,
        productRole: "product",
        commands: f.commands,
      },
    );
    const invoke = (id = "stable", input: unknown = { value: 1 }) =>
      f.run(() =>
        runtime.invokeReceiptConsumer(
          declaration,
          f.dependencies,
          { body: Buffer.from(JSON.stringify(input)), messageId: id },
          async () => {
            throw Error("Legacy entry must not run");
          },
        ),
      );
    return { ...f, declaration, engine, invoke, effects: () => effects };
  }
  it("commits registered product effect/receipt/progress together, safely redelivers after lost COMMIT and conflicts on changed content", async () => {
    const f = await bound();
    f.lose();
    await expect(f.invoke()).rejects.toMatchObject({ outcome: "unknown" });
    await f.invoke();
    expect(f.effects()).toBe(1);
    expect((await f.pg.query("SELECT id,account FROM p_app.items")).rows).toEqual([
      { id: "stable", account: "projection" },
    ]);
    expect(
      (
        await f.pg.query(
          "SELECT last_progress_at IS NOT NULL progress FROM jeeves.consumer_receipts_workers",
        )
      ).rows,
    ).toEqual([{ progress: true }]);
    await expect(f.invoke("stable", { value: 2 })).rejects.toMatchObject({
      code: "RECEIPT_IDENTITY_CONFLICT",
    });
    expect(
      f.trace.some((row) => row.sql.startsWith("INSERT INTO p_app") && row.role === "product"),
    ).toBe(true);
    expect(
      f.trace.some((row) => row.sql.includes("consumer_receipts") && row.role === "product"),
    ).toBe(false);
  });
  it("preserves quarantine identity and one effect while cleanup remains inside the declared total replay window", async () => {
    const f = await bound();
    await f.invoke();
    // A later broker retry/quarantine must fit inside the declared total horizon, not restart it.
    await f.pg.exec("UPDATE test_clock.time SET value=value+interval '12 hours'");
    expect(await transaction(f.pool, (tx: unknown) => f.store.sweep(tx))).toEqual({
      removed: 0,
      backlog: false,
    });
    const message = {
      body: Buffer.from('{"value":1}'),
      messageId: "stable",
      headers: { "x-terminal-code": "RETRY_EXHAUSTED" },
      redelivered: true,
      receipt: 1,
    };
    let acknowledged = false;
    await requeueQuarantinedDelivery({
      queue: "q",
      failedQueue: "q.failed",
      sourceQueue: "q.failed",
      retryLimit: 4,
      message,
      transport: {
        async cancel() {},
        async close() {},
        async republish(_queue: string, original: typeof message) {
          expect(original.messageId).toBe("stable");
          await f.invoke(original.messageId, JSON.parse(original.body.toString()));
        },
        ack() {
          acknowledged = true;
        },
      },
    });
    expect(acknowledged).toBe(true);
    expect(f.effects()).toBe(1);
    expect((await f.pg.query("SELECT count(*)::int n FROM p_app.items")).rows).toEqual([{ n: 1 }]);
  });
  it("refuses startup before readiness when required receipt schema or grants are absent", async () => {
    const f = await fixture();
    const declaration = runtime.defineReceiptConsumer({
      database: "db",
      ...policy,
      map: (_input: unknown, id: string) => ({ id, payload: {} }),
      async complete() {},
    });
    const bound = runtime.bindReceiptConsumer(
      f.dependencies.db,
      runtime.receiptConsumerDefinition(declaration, "db", true),
      {
        namespace: "startup",
        consumerId: "startup",
        pool: f.pool,
        productRole: "product",
        commands: f.commands,
      },
    );
    await expect(bound.ready()).rejects.toThrow("consumer_receipts");
    await f.pg.exec(consumerReceiptMigration.sql);
    await expect(bound.ready()).rejects.toThrow("permission denied");
  });
  it("attributes two consumers sharing a store and filters their bounded worker observations", async () => {
    const f = await bound();
    await f.invoke();
    const handle = {};
    const declaration = runtime.defineReceiptConsumer({
      database: "db",
      ...policy,
      map: (_input: unknown, id: string) => ({ id, payload: {} }),
      async complete() {},
    });
    const other = runtime.bindReceiptConsumer(
      handle,
      runtime.receiptConsumerDefinition(declaration, "db", true),
      {
        namespace: "other",
        consumerId: "other-consumer",
        pool: f.pool,
        productRole: "product",
        commands: f.commands,
      },
    );
    await other.ready();
    const first = await f.engine.status();
    const second = await other.status();
    expect(first).toMatchObject({
      workerScope: "project",
      cleanupScope: "database-consumer-receipts",
      workersTruncated: false,
    });
    expect(first.workers).toHaveLength(1);
    expect(first.workers[0].consumer_id).toBe("project");
    expect(second.workers).toHaveLength(1);
    expect(second.workers[0].consumer_id).toBe("other-consumer");
    expect((await transaction(f.pool, (tx: unknown) => f.store.status(tx))).workers).toHaveLength(
      2,
    );
  });
  it("classifies maintenance failure with compiled operation and generated correlation identity", async () => {
    const f = await bound();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(f.pool, "connect").mockRejectedValue(
      Object.assign(new Error("private payload and SQL"), { code: "ECONNREFUSED" }),
    );
    const lifecycle = createProcessLifecycle({ mark: () => {}, terminate: () => {} });
    await lifecycle.start(async (scope: unknown) => {
      runtime.startReceiptConsumer(f.declaration, f.dependencies, scope);
    });
    try {
      await vi.waitFor(() => expect(logged).toHaveBeenCalled());
      const entry = JSON.parse(String(logged.mock.calls[0]?.[0]));
      expect(entry).toMatchObject({
        event: "receipt-maintenance-unavailable",
        operation: "project",
      });
      expect(entry.correlationId).toMatch(/^[a-f0-9-]{36}$/);
      expect(JSON.stringify(entry)).not.toContain("private payload");
      expect(JSON.stringify(entry)).not.toContain("namespace");
    } finally {
      await lifecycle.close();
    }
  });
  it("refuses getter/async mapping, captured handles, wrong binding and poison without raw ACK or SQL access", async () => {
    let getter = 0;
    const access = await bound({
      map: () =>
        Object.defineProperty({ id: "stable" }, "payload", {
          enumerable: true,
          get() {
            getter++;
            return {};
          },
        }),
    });
    await expect(access.invoke()).rejects.toMatchObject({ code: "MALFORMED_MESSAGE" });
    expect(getter).toBe(0);
    const asyncMap = await bound({ map: async () => ({ id: "stable", payload: {} }) });
    await expect(asyncMap.invoke()).rejects.toMatchObject({ code: "MALFORMED_MESSAGE" });
    const captured = await bound({
      complete: async () => {
        await captured.dependencies.db.call("insert", ["illegal", "x"]);
      },
    });
    await expect(captured.invoke()).rejects.toMatchObject({ code: "EFFECT_NOT_ALLOWED" });
    expect((await captured.pg.query("SELECT * FROM jeeves.consumer_receipts")).rows).toEqual([]);
    expect(() =>
      runtime.validateReceiptConsumerBinding(captured.declaration, ["db"], false),
    ).toThrow("delivery loop");
    expect(() => runtime.validateReceiptConsumerBinding(captured.declaration, [], true)).toThrow(
      "writable owned state",
    );
    expect(() =>
      runtime.invokeReceiptConsumer(
        captured.declaration,
        {},
        { body: Buffer.from("{}"), messageId: "stable" },
        async () => {},
      ),
    ).toThrow("binding unavailable");
  });
  it("holds the actual transaction after caller timeout and never releases the slot at an uncertain COMMIT", async () => {
    const f = await bound();
    let open!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const admission = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = f.pool.connect.bind(f.pool);
    vi.spyOn(f.pool, "connect").mockImplementation(async () => {
      const c = await original();
      return {
        ...c,
        query: async (sql: string, values?: unknown[]) => {
          const result = await c.query(sql, values);
          if (sql === "COMMIT") {
            entered();
            await gate;
          }
          return result;
        },
      };
    });
    const cancellation = new AbortController();
    const execution = operation({ maximumMs: 10000, signals: [cancellation.signal] });
    let settled = false;
    const running = withOperation(execution.context, () =>
      runtime.invokeReceiptConsumer(
        f.declaration,
        f.dependencies,
        { body: Buffer.from("{}"), messageId: "slow" },
        async () => {},
      ),
    )
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true;
        execution.close();
      });
    await admission;
    cancellation.abort();
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    open();
    expect(await running).toMatchObject({ outcome: "unknown" });
    expect(settled).toBe(true);
    await f.invoke("slow", {});
    expect(f.effects()).toBe(1);
  });
  it("runs actual lifecycle cleanup and idle heartbeat without deliveries, then exposes stale stopped observation", async () => {
    const f = await bound();
    await f.pg.exec(`INSERT INTO jeeves.consumer_receipts(scope_key,event_id,payload,result,completed_at,retain_until)
   VALUES('old','expired','{}','{"value":true}','2000-01-01','2000-01-02')`);
    const lifecycle = createProcessLifecycle({
      mark: () => {},
      terminate: () => {
        throw Error("Unexpected shutdown deadline");
      },
    });
    await lifecycle.start(async (scope: unknown) => {
      runtime.startReceiptConsumer(f.declaration, f.dependencies, scope);
    });
    try {
      await vi.waitFor(async () =>
        expect(
          (await f.pg.query("SELECT count(*)::int n FROM jeeves.consumer_receipts")).rows,
        ).toEqual([{ n: 0 }]),
      );
      const status = await transaction(f.pool, (tx: unknown) => f.store.status(tx));
      expect(status.cleanup).toMatchObject({ removed: 1, backlog: false });
      expect(status.workers[0]).toMatchObject({
        in_flight: 0,
        backlog: null,
        last_progress_at: null,
        state: "running",
        stale: false,
      });
      expect(f.effects()).toBe(0);
    } finally {
      await lifecycle.close();
    }
    await f.pg.exec("UPDATE test_clock.time SET value=value+interval '46 seconds'");
    expect((await transaction(f.pool, (tx: unknown) => f.store.status(tx))).workers[0].stale).toBe(
      true,
    );
  });
});

describe("RG18 delivery observations and explicit quarantine operation", () => {
  it("heartbeats an idle live worker, leaves legacy durable progress/backlog unknown and becomes stale when ticks stop", async () => {
    vi.useFakeTimers();
    const observed: unknown[] = [];
    const runner = createDeliveryRunner({
      queue: "q",
      failedQueue: "q.failed",
      retryLimit: 1,
      onProgress: (s: unknown) => observed.push(s),
      handle: async () => {},
      transport: { async cancel() {}, async close() {}, async republish() {}, ack() {} },
    });
    const before = runner.progress();
    await vi.advanceTimersByTimeAsync(16000);
    const idle = runner.progress();
    expect(idle.heartbeatAt).toBeGreaterThan(before.heartbeatAt);
    expect(idle).toMatchObject({ lastDurableProgressAt: null, backlog: null, inFlight: 0 });
    expect(consumerLiveness(idle, idle.heartbeatAt + 46000)).toBe("stale");
    runner.accept({
      body: Buffer.from("{}"),
      messageId: "e",
      headers: {},
      redelivered: false,
      receipt: 1,
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(runner.progress().lastDurableProgressAt).toBe(null);
    await runner.close();
    expect(consumerLiveness(runner.progress())).toBe("stopped");
    expect(observed.length).toBeGreaterThan(1);
  });
  it("requeues only explicit quarantine identity after confirmed persistence, preserves bytes/ID and refuses unknown effects", async () => {
    const actions: string[] = [];
    let confirm!: () => void;
    const gate = new Promise<void>((resolve) => {
      confirm = resolve;
    });
    const message = {
      body: Buffer.from('{ "n":1.0 }'),
      messageId: "original",
      headers: { "x-terminal-code": "MALFORMED_MESSAGE", "x-delivery-attempt": 4 },
      redelivered: true,
      receipt: 1,
    };
    const transport = {
      async cancel() {},
      async close() {},
      async republish(queue: string, original: unknown, headers: Record<string, unknown>) {
        expect(queue).toBe("q");
        expect(original).toBe(message);
        expect(headers).toEqual({ "x-delivery-attempt": 0 });
        actions.push("publish");
        await gate;
      },
      ack() {
        actions.push("ack");
      },
    };
    const requeue = requeueQuarantinedDelivery({
      queue: "q",
      failedQueue: "q.failed",
      sourceQueue: "q.failed",
      retryLimit: 4,
      message,
      transport,
    });
    await Promise.resolve();
    expect(actions).toEqual(["publish"]);
    confirm();
    await requeue;
    expect(actions).toEqual(["publish", "ack"]);
    await expect(
      requeueQuarantinedDelivery({
        queue: "q",
        failedQueue: "q.failed",
        sourceQueue: "q.failed",
        retryLimit: 4,
        message: { ...message, headers: { "x-terminal-code": "OUTCOME_UNKNOWN" } },
        transport,
      }),
    ).rejects.toThrow("QUARANTINE_REQUEUE_REFUSED");
    await expect(
      requeueQuarantinedDelivery({
        queue: "q",
        failedQueue: "q.failed",
        sourceQueue: "q.failed",
        retryLimit: 4,
        message: { ...message, headers: { "x-terminal-code": "RECEIPT_IDENTITY_CONFLICT" } },
        transport,
      }),
    ).rejects.toThrow("QUARANTINE_REQUEUE_REFUSED");
    await expect(
      requeueQuarantinedDelivery({
        queue: "q",
        failedQueue: "q.failed",
        sourceQueue: "q",
        retryLimit: 4,
        message,
        transport,
      }),
    ).rejects.toThrow("QUARANTINE_REQUEUE_REFUSED");
    expect(message.body.toString()).toBe('{ "n":1.0 }');
    expect(message.messageId).toBe("original");
  });
});

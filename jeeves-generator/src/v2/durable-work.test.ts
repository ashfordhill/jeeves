import { afterEach, describe, expect, it, vi } from "vitest";
import { durableWorkMigration } from "./client-wiring.ts";
import {
  assertNetworkAllowed,
  databases,
  fixture,
  load,
  operation,
  withEffect,
  withOperation,
} from "./local-operation.test.helpers.ts";

const runtime = await import(load("durable-work"));
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.close()));
  vi.restoreAllMocks();
});

async function workFixture(overrides: Record<string, unknown> = {}) {
  const f = await fixture();
  await f.pg.exec(
    `${durableWorkMigration.sql} ${durableWorkMigration.sql} GRANT SELECT,INSERT,UPDATE,DELETE ON jeeves.work_records TO runtime;`,
  );
  const definition = {
    database: "db",
    id: "apply-item",
    version: 1,
    retentionSeconds: 60,
    maxAttempts: 3,
    integration: null,
    validate: (input: unknown) => input,
    complete: async (
      input: { id: string },
      commands: { call(name: string, values: unknown[]): Promise<unknown> },
      caller: { subject?: string },
    ) => {
      await commands.call("insert", [input.id, caller.subject ?? "background"]);
    },
    ...overrides,
  };
  const work = runtime.defineDurableWork(definition);
  const store = runtime.bindDurableWork(
    f.dependencies.db,
    runtime.durableWorkDefinition(work, "db", true),
    {
      namespace: '["db","owner","apply-item"]',
      process: "worker",
      pool: f.pool,
      productRole: "product",
      commands: f.commands,
    },
  );
  async function run<T>(effect: () => Promise<T>, subject?: string) {
    const execution = operation({
      maximumMs: 10000,
      caller: subject ? { subject } : undefined,
    });
    try {
      return await withOperation(execution.context, effect);
    } finally {
      execution.close();
    }
  }
  const accept = (key = "key", input: unknown = { id: "one" }, subject?: string) =>
    run(() => work.accept(f.dependencies, { key, input }), subject);
  return { ...f, work, store, definition, run, accept };
}

/** Trusted SQL failure point after product callback AND actual command drain, before final fencing. */
function expireAfterProduct(f: Awaited<ReturnType<typeof workFixture>>) {
  const connect = f.pool.connect.bind(f.pool);
  vi.spyOn(f.pool, "connect").mockImplementation(async () => {
    const client = await connect();
    return {
      ...client,
      query: async (sql: string, values?: unknown[]) => {
        const result = await client.query(sql, values);
        if (sql === "SET LOCAL ROLE NONE")
          await client.query(
            "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second'",
          );
        return result;
      },
    };
  });
}

describe("RG15 durable local work", () => {
  it("persists canonical stable identity before acknowledgement, dedupes across replicas and conflicts on changed input", async () => {
    const f = await workFixture();
    expect(await f.accept("key", { id: "one", a: 1 })).toEqual({
      state: "accepted",
      attempts: 0,
      error: null,
    });
    const other = runtime.bindDurableWork({}, runtime.durableWorkDefinition(f.work, "db", true), {
      namespace: '["db","owner","apply-item"]',
      pool: f.pool,
      productRole: "product",
      commands: f.commands,
    });
    expect(await other.accept("{}", "key", { a: 1, id: "one" })).toEqual({
      state: "accepted",
      attempts: 0,
      error: null,
    });
    await expect(f.accept("key", { id: "changed" })).rejects.toMatchObject({
      code: "WORK_IDENTITY_CONFLICT",
    });
    expect((await f.pg.query("SELECT count(*)::int n FROM jeeves.work_records")).rows).toEqual([
      { n: 1 },
    ]);
    expect(
      await f.run(() => f.work.status(f.dependencies, "key"), "another-account"),
    ).toBeUndefined();
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    const [localClaim] = await other.claim(1);
    await other.complete(localClaim); // local work stays shareable across compatible logical-owner roles
    expect(await f.work.status(f.dependencies, "key")).toMatchObject({ state: "completed" });
  });
  it("a crash before dispatch is reclaimable; renewed and expired holders have monotonic exact fences and stable identities", async () => {
    const f = await workFixture();
    await f.accept();
    const [old] = await f.store.claim(1);
    expect(await f.store.claim(1)).toEqual([]);
    expect(await f.store.renew(old)).toBe(true);
    await f.pg.exec(
      "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second', fence=9007199254740992",
    );
    expect(await f.store.renew(old)).toBe(false);
    const [next] = await f.store.claim(1);
    expect(next.identity).toBe(old.identity);
    expect((await f.pg.query("SELECT fence::text FROM jeeves.work_records")).rows).toEqual([
      { fence: "9007199254740993" },
    ]);
    await expect(f.store.complete(old)).rejects.toMatchObject({
      code: "WORK_LEASE_LOST",
    });
    expect(await f.store.fail(old)).toBe(false);
    await f.store.complete(next);
    expect(await f.work.status(f.dependencies, "key")).toEqual({
      state: "completed",
      attempts: 2,
      error: null,
    });
    expect((await f.pg.query("SELECT id,account FROM p_app.items")).rows).toEqual([
      { id: "one", account: "background" },
    ]);
    await expect(f.store.complete({ ...next })).rejects.toMatchObject({
      code: "WORK_LEASE_LOST",
    });
  });
  it("lease expiry after product mutation rolls back both the product effect and completion", async () => {
    const f = await workFixture({
      complete: async (
        _input: unknown,
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        await commands.call("insert", ["late", "background"]);
      },
    });
    await f.accept();
    const [claim] = await f.store.claim();
    expireAfterProduct(f);
    await expect(f.store.complete(claim)).rejects.toMatchObject({
      code: "WORK_LEASE_LOST",
    });
    expect(
      f.trace.filter((row) => row.sql.startsWith("INSERT INTO p_app")).map((row) => row.role),
    ).toEqual(["product"]);
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    expect((await f.pg.query("SELECT state FROM jeeves.work_records")).rows).toEqual([
      { state: "running" },
    ]);
  });
  it("keeps every issued command under the product role, drains unawaited commands, and refuses retained/captured handles", async () => {
    let retained: { call(name: string, values: unknown[]): Promise<unknown> } | undefined;
    const f = await workFixture({
      complete: async (_input: unknown, commands: NonNullable<typeof retained>) => {
        retained = commands;
        commands.call("insert", ["unawaited", "background"]);
        await commands.call("insert", ["awaited", "background"]);
      },
    });
    await f.accept();
    const [claim] = await f.store.claim();
    await f.store.complete(claim);
    expect(
      f.trace.filter((row) => row.sql.startsWith("INSERT INTO p_app")).map((row) => row.role),
    ).toEqual(["product", "product"]);
    expect(f.trace.find((row) => row.sql.includes("SET state='completed'"))?.role).toBe("runtime");
    await expect(retained?.call("insert", ["retained", "background"])).rejects.toThrow("closed");
    for (const effect of [
      () => f.dependencies.db.call("read", []),
      () => withEffect("read", () => assertNetworkAllowed()),
    ]) {
      const g = await workFixture({
        complete: async () => {
          await effect();
        },
      });
      await g.accept();
      const [c] = await g.store.claim();
      await expect(g.store.complete(c)).rejects.toMatchObject({
        code: "EFFECT_NOT_ALLOWED",
      });
    }
    await f.pg.exec("SET SESSION AUTHORIZATION product");
    await expect(f.pg.query("SELECT * FROM jeeves.work_records")).rejects.toThrow(
      /permission denied/,
    );
    await f.pg.exec("SET SESSION AUTHORIZATION postgres");
  });
  it("checks expiry after the actual unawaited command drain and rolls back the restricted-role product effect", async () => {
    let entered!: () => void, release!: () => void;
    const executed = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = await workFixture({
      complete: async (
        _input: unknown,
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        void commands.call("insert", ["drained", "background"]);
      },
    });
    const store = runtime.bindDurableWork(
      f.dependencies.db,
      runtime.durableWorkDefinition(f.work, "db", true),
      {
        namespace: '["db","owner","apply-item"]',
        pool: f.pool,
        productRole: "product",
        commands: (
          execute: (sql: string, values: unknown[], readOnly: boolean) => Promise<unknown>,
        ) =>
          f.commands(async (sql: string, values: unknown[], readOnly: boolean) => {
            const result = await execute(sql, values, readOnly);
            entered();
            await blocked;
            return result;
          }),
      },
    );
    await f.accept();
    const [claim] = await store.claim(1);
    expireAfterProduct(f);
    const completion = store.complete(claim);
    void completion.catch(() => {});
    await executed;
    expect(f.trace.some((row) => row.sql === "SET LOCAL ROLE NONE")).toBe(false);
    release();
    await expect(completion).rejects.toMatchObject({ code: "WORK_LEASE_LOST" });
    expect(
      f.trace.filter((row) => row.sql.startsWith("INSERT INTO p_app")).map((row) => row.role),
    ).toEqual(["product"]);
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    expect(await f.work.status(f.dependencies, "key")).toMatchObject({
      state: "running",
      attempts: 1,
    });
  });
  it("caught/unawaited command failures poison completion, finite retry backs off and terminal failures remain visible", async () => {
    const f = await workFixture({
      complete: async (
        _input: unknown,
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        await commands.call("insert", ["rolledback", "background"]);
        commands.call("unregistered", []).catch(() => {});
      },
    });
    await f.accept();
    const events: string[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      await f.store.runBatch((event: string) => events.push(event));
      expect(await f.work.status(f.dependencies, "key")).toEqual({
        state: attempt === 3 ? "failed" : "retry",
        attempts: attempt,
        error: attempt === 3 ? "WORK_ATTEMPTS_EXHAUSTED" : "WORK_HANDLER_FAILED",
      });
      const row = (
        await f.pg.query<{ ms: number }>(
          "SELECT extract(epoch FROM next_attempt_at-clock_timestamp())*1000 AS ms FROM jeeves.work_records",
        )
      ).rows[0];
      expect(Number(row?.ms)).toBeGreaterThan(100 * 2 ** (attempt - 1));
      await f.pg.exec(
        "UPDATE jeeves.work_records SET next_attempt_at=clock_timestamp()-interval '1 second'",
      );
    }
    expect(await f.store.claim()).toEqual([]);
    expect(events).toEqual(["work handler failed", "work handler failed", "work handler failed"]);
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
  });
  it("exhausted crashed claims terminate; unknown and unfinished records survive completed-only bounded retention", async () => {
    const f = await workFixture({ maxAttempts: 1 });
    await f.accept("crashed");
    await f.store.claim();
    await f.pg.exec(
      "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second'",
    );
    expect(await f.store.claim()).toEqual([]);
    expect(await f.work.status(f.dependencies, "crashed")).toMatchObject({
      state: "failed",
      attempts: 1,
    });
    await f.accept("unknown");
    const [unknown] = await f.store.claim();
    expect(await f.store.fail(unknown, true)).toBe(true);
    await f.accept("complete", { id: "done" });
    const claims = await f.store.claim();
    for (const claim of claims) await f.store.complete(claim);
    await f.accept("unfinished");
    await f.pg.exec(
      "UPDATE jeeves.work_records SET expires_at=clock_timestamp()-interval '1 second'",
    );
    expect(await f.store.sweep(1)).toBe(1);
    expect(
      (await f.pg.query("SELECT work_key,state FROM jeeves.work_records ORDER BY work_key")).rows,
    ).toEqual([
      { work_key: "crashed", state: "failed" },
      { work_key: "unfinished", state: "accepted" },
      { work_key: "unknown", state: "unknown" },
    ]);
    expect(await f.store.claim()).toHaveLength(1); // unfinished intent remains runnable
  });
  it("lost acceptance/completion COMMIT responses recover durable identity/state without another effect", async () => {
    const f = await workFixture();
    f.lose();
    await expect(f.accept()).rejects.toMatchObject({
      outcome: "unknown",
      code: "COMMIT_RESPONSE_LOST",
    });
    expect(await f.accept()).toMatchObject({ state: "accepted", attempts: 0 });
    const [claim] = await f.store.claim();
    f.lose();
    await expect(f.store.complete(claim)).rejects.toMatchObject({
      outcome: "unknown",
      code: "COMMIT_RESPONSE_LOST",
    });
    expect(await f.work.status(f.dependencies, "key")).toMatchObject({
      state: "completed",
      attempts: 1,
    });
    expect(await f.store.claim()).toEqual([]);
    expect((await f.pg.query("SELECT count(*)::int n FROM p_app.items")).rows).toEqual([{ n: 1 }]);
  });
  it("preserves unresolved dispatches as unknown when a crashed or later failing attempt exhausts its bound", async () => {
    for (const crash of [true, false]) {
      const f = await workFixture({ maxAttempts: 1 });
      await f.accept();
      const [claim] = await f.store.claim();
      await f.pg.exec("UPDATE jeeves.work_records SET external_state='dispatched'");
      if (crash) {
        await f.pg.exec(
          "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second'",
        );
        expect(await f.store.claim()).toEqual([]);
      } else expect(await f.store.fail(claim)).toBe(true);
      expect(await f.work.status(f.dependencies, "key")).toEqual({
        state: "unknown",
        attempts: 1,
        error: "WORK_OUTCOME_UNKNOWN",
      });
      expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    }
  });
  it("rejects malformed DTOs, async policies, unsupported external declarations and cross-database claims before acquisition", async () => {
    const f = await workFixture();
    for (const input of [() => {}, { a: undefined }])
      await expect(f.accept("invalid", input)).rejects.toMatchObject({
        code: "WORK_INPUT",
      });
    await expect(f.accept("bad key")).rejects.toMatchObject({
      code: "WORK_INPUT",
    });
    expect(f.trace).toEqual([]);
    expect(() =>
      runtime.defineDurableWork({
        ...f.definition,
        integration: { target: "http", idempotencyHeader: true },
      }),
    ).toThrow(/restart-safe/);
    expect(() => runtime.validateDurableWorkBinding(f.work, ["otherDatabase"])).toThrow(
      /cross-database/,
    );
    expect(() => runtime.durableWorkDefinition(f.work, "db", false)).toThrow(/writable database/);
    const asyncWork = await workFixture({
      validate: async () => {
        throw Error("private");
      },
    });
    await expect(asyncWork.accept()).rejects.toMatchObject({
      code: "WORK_INPUT",
    });
    expect(asyncWork.trace).toEqual([]);
  });
  it("retains the actual completion slot through a timed-out COMMIT, then recovers without poisoning work", async () => {
    let dispatches = 0;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = await workFixture({
      complete: async (
        _input: unknown,
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        dispatches++;
        await commands.call("insert", ["committed", "background"]);
      },
    });
    await f.accept("first");
    await f.accept("second");
    const connect = f.pool.connect.bind(f.pool);
    vi.spyOn(f.pool, "connect").mockImplementation(async () => {
      const client = await connect();
      return {
        ...client,
        query: async (sql: string, values?: unknown[]) => {
          if (sql === "COMMIT" && dispatches === 1) await blocked;
          return client.query(sql, values);
        },
      };
    });
    const execution = operation({ maximumMs: 250 });
    const events: string[] = [];
    try {
      await withOperation(execution.context, () =>
        f.store.runBatch((event: string) => events.push(event)),
      );
    } finally {
      execution.close();
    }
    expect(events).toEqual(["work outcome unknown"]);
    const before = f.trace.length;
    await f.store.runBatch((event: string) => events.push(event));
    expect(f.trace).toHaveLength(before); // actual COMMIT still owns the sole execution slot
    expect(dispatches).toBe(1);
    release();
    expect(await f.work.status(f.dependencies, "first")).toMatchObject({
      state: "completed",
      attempts: 1,
    });
    expect(await f.work.status(f.dependencies, "second")).toMatchObject({
      state: "accepted",
      attempts: 0,
    });
    expect((await f.pg.query("SELECT count(*)::int n FROM p_app.items")).rows).toEqual([{ n: 1 }]);
  });
  it("keeps storage loss distinct from poison and preserves a reclaimable row without logging private errors", async () => {
    const f = await workFixture();
    await f.accept();
    const connect = f.pool.connect.bind(f.pool);
    let connections = 0;
    vi.spyOn(f.pool, "connect").mockImplementation(async () => {
      if (++connections === 2)
        throw Object.assign(Error("private storage endpoint"), { code: "ECONNRESET" });
      return connect();
    });
    const events: string[] = [];
    await expect(f.store.runBatch((event: string) => events.push(event))).rejects.toMatchObject({
      code: "ECONNRESET",
    });
    expect(events).toEqual([]);
    expect(await f.work.status(f.dependencies, "key")).toEqual({
      state: "running",
      attempts: 1,
      error: null,
    });
    await f.pg.exec(
      "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second'",
    );
    await f.store.runBatch((event: string) => events.push(event));
    expect(await f.work.status(f.dependencies, "key")).toMatchObject({
      state: "completed",
      attempts: 2,
    });
    expect(events).toEqual([]);
  });
  it("uses the existing process lifecycle to stop, drain and reclaim after shutdown without a live request bearer", async () => {
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let dispatches = 0;
    const f = await workFixture({
      complete: async (
        input: { id: string },
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
        caller: { subject?: string },
      ) => {
        dispatches++;
        await commands.call("insert", [input.id, caller.subject ?? "background"]);
        if (dispatches === 1) {
          entered();
          await blocked;
        }
      },
    });
    await f.accept("key", { id: "one" }, "alice");
    const controller = new AbortController(),
      closes: (() => Promise<void>)[] = [],
      stops: (() => void)[] = [],
      events: string[] = [];
    const tracked: Promise<unknown>[] = [];
    const scope = {
      track: (actual: Promise<unknown>) => tracked.push(actual),
      signal: controller.signal,
      own: (close: () => Promise<void>) => closes.push(close),
      admission: (stop: () => void) => stops.push(stop),
    };
    const { withProcess } = await import(load("operation"));
    withProcess(scope, () =>
      runtime.startDurableWork(f.work, f.dependencies, scope, (event: string) =>
        events.push(event),
      ),
    );
    await started;
    for (const stop of stops) stop();
    controller.abort();
    release();
    for (const close of closes) await close();
    await Promise.allSettled(tracked);
    expect(events).toEqual(["work outcome unknown"]);
    expect(dispatches).toBe(1);
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    expect(await f.run(() => f.work.status(f.dependencies, "key"), "alice")).toMatchObject({
      state: "running",
      attempts: 1,
    });
    await f.pg.exec(
      "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second'",
    );
    await f.store.runBatch((event: string) => events.push(event));
    expect((await f.pg.query("SELECT id,account FROM p_app.items")).rows).toEqual([
      { id: "one", account: "alice" },
    ]);
    expect(dispatches).toBe(2);
  });
  it("logs actual generated safe operation/correlation/work identifiers for poison and storage failure", async () => {
    const { createFailureLog } = await import(load("tile-process"));
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(line);
    });
    for (const unavailable of [false, true]) {
      const f = await workFixture({
        complete: async () => {
          throw Error("private product payload");
        },
      });
      await f.accept("private-key", { id: "private-input" }, "private-subject");
      if (unavailable)
        vi.spyOn(f.pool, "connect").mockRejectedValue(
          Object.assign(Error("private storage endpoint"), { code: "ECONNRESET" }),
        );
      const controller = new AbortController(),
        closes: (() => Promise<void>)[] = [],
        stops: (() => void)[] = [];
      const scope = {
        signal: controller.signal,
        own: (close: () => Promise<void>) => closes.push(close),
        admission: (stop: () => void) => stops.push(stop),
      };
      const failure = createFailureLog("worker");
      let logged!: () => void;
      const done = new Promise<void>((resolve) => {
        logged = resolve;
      });
      runtime.startDurableWork(
        f.work,
        f.dependencies,
        scope,
        (event: string, fields: Record<string, unknown>) => {
          failure(event, Error(event), fields);
          logged();
        },
      );
      await done;
      for (const stop of stops) stop();
      controller.abort();
      for (const close of closes) await close();
    }
    const entries = lines.map((line) => JSON.parse(line));
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.what)).toEqual([
      "work handler failed",
      "work storage unavailable",
    ]);
    for (const entry of entries) {
      expect(entry.operation).toBe("apply-item");
      expect(entry.correlationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(entry.error).toBe(`Error: ${entry.what}`);
    }
    expect(entries[0].work).toMatch(/^[0-9a-f]{64}$/);
    expect(entries[1].work).toBeUndefined();
    expect(lines.join()).not.toMatch(
      /private-key|private-input|private-subject|private product|private storage/,
    );
  });
  it("preserves safe HTTP conflicts/input errors and refuses cross-scope/batch/configuration misuse", async () => {
    const { classifyHttpError } = await import(load("admission"));
    const f = await workFixture();
    await f.accept();
    for (const [key, input, code, status] of [
      ["bad key", {}, "WORK_INPUT", 400],
      ["key", { id: "changed" }, "WORK_IDENTITY_CONFLICT", 409],
    ] as const) {
      const error = await f.accept(key, input).catch((error: unknown) => error);
      expect(classifyHttpError(error)).toMatchObject({
        status,
        code,
        headers: { "Cache-Control": "no-store" },
      });
    }
    await expect(withEffect("read", () => f.accept("denied"))).rejects.toMatchObject({
      code: "EFFECT_NOT_ALLOWED",
    });
    for (const value of [0, 26, 1.1])
      await expect(f.store.claim(value)).rejects.toThrow("Invalid work batch");
    for (const value of [0, 1001, 1.1])
      await expect(f.store.sweep(value)).rejects.toThrow("Invalid work retention batch");
    const migrated = runtime.createWorkStore({
      namespace: '["db","owner","apply-item"]',
      definition: { ...f.definition, version: 2 },
      pool: f.pool,
      productRole: "product",
      commands: f.commands,
    });
    expect(await migrated.claim()).toEqual([]);
    await expect(migrated.accept("{}", "key", { id: "one" })).rejects.toMatchObject({
      code: "WORK_CONFIGURATION_CONFLICT",
    });
    expect(await f.work.status(f.dependencies, "key")).toMatchObject({
      state: "accepted",
      attempts: 0,
    });
  });
});

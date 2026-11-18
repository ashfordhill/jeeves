import {
  applyOperations,
  buildStudioCommand,
  designBlueprintV3,
  designGeneration,
  designOwnership,
  laneFindings,
  normalGenerationControls,
  resolveGeneration,
} from "@jeeves/spec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduledDesign } from "../../../field-projects/generator-system/fixtures/rg-scheduled/design.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";
import { durableWorkMigration } from "./client-wiring.ts";
import {
  databases,
  fixture,
  load,
  operation,
  withOperation,
} from "./local-operation.test.helpers.ts";

const runtime = await import(load("durable-work"));
function must<T>(value: T | undefined | null): T {
  if (value == null) throw Error("Missing fixture value");
  return value;
}
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((db) => db.close()));
});
async function scheduledFixture(
  complete?: (
    input: { tick: string; intervalSeconds: number },
    commands: { call(name: string, values: unknown[]): Promise<unknown> },
  ) => Promise<void>,
) {
  const f = await fixture();
  await f.pg.exec(
    `${durableWorkMigration.sql} GRANT SELECT,INSERT,UPDATE,DELETE ON jeeves.work_records TO runtime`,
  );
  let clock = 1800000000;
  await f.pg.exec(
    `ALTER TABLE jeeves.work_records ALTER COLUMN next_attempt_at SET DEFAULT to_timestamp(${clock})`,
  );
  const connect = f.pool.connect.bind(f.pool);
  let connections = 0;
  vi.spyOn(f.pool, "connect").mockImplementation(async () => {
    connections++;
    const client = await connect();
    return {
      ...client,
      query: (sql: string, values?: unknown[]) =>
        client.query(sql.replaceAll("clock_timestamp()", `to_timestamp(${clock})`), values),
    };
  });
  const definition = {
    database: "db",
    id: "reconcile",
    version: 1,
    retentionSeconds: 604800,
    maxAttempts: 4,
    integration: null,
    validate: (input: unknown) => input,
    complete:
      complete ??
      (async (
        input: { tick: string; intervalSeconds: number },
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        await commands.call("insert", [`${input.intervalSeconds}:${input.tick}`, "background"]);
      }),
  };
  const work = runtime.defineDurableWork(definition);
  const options = {
    namespace: '["db","owner","reconcile"]',
    process: "worker",
    pool: f.pool,
    productRole: "product",
    commands: f.commands,
  };
  const store = runtime.bindDurableWork(
    f.dependencies.db,
    runtime.durableWorkDefinition(work, "db", true),
    options,
  );
  const other = runtime.createWorkStore({ ...options, definition });
  async function run<T>(effect: () => Promise<T>, maximumMs = 10000) {
    const execution = operation({ maximumMs });
    try {
      return await withOperation(execution.context, effect);
    } finally {
      execution.close();
    }
  }
  const records = async () =>
    (
      await f.pg.query<{
        work_key: string;
        work_id: string;
        state: string;
        input: { value: { intervalSeconds: number; tick: string } };
        expires_at: Date;
      }>(
        "SELECT work_key,work_id,state,input,expires_at FROM jeeves.work_records ORDER BY created_at,work_key",
      )
    ).rows;
  return {
    ...f,
    definition,
    work,
    store,
    other,
    run,
    records,
    now: () => clock,
    clock: (seconds: number) => {
      clock = seconds;
    },
    connections: () => connections,
    options,
  };
}

describe("RG16 database-time scheduled reconciliation", () => {
  it("competing copies dedupe a database tick despite different process clocks; completed retention cannot reopen the current interval", async () => {
    const f = await scheduledFixture();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2040-01-01"));
    await Promise.all([f.store.schedule(604800), f.other.schedule(604800)]);
    const [accepted] = await f.records();
    expect(accepted?.work_key).toBe(`s:604800:${Math.floor(f.now() / 604800)}`);
    await f.store.runBatch(() => {});
    const [completed] = await f.records();
    expect(completed?.state).toBe("completed");
    expect(new Date(must(completed).expires_at).getTime() / 1000).toBeGreaterThanOrEqual(
      (Math.floor(f.now() / 604800) + 1) * 604800,
    );
    vi.setSystemTime(new Date("2001-01-01"));
    f.clock((Math.floor(f.now() / 604800) + 1) * 604800 - 1);
    expect(await f.other.sweep()).toBe(0);
    await f.other.schedule(604800);
    expect((await f.records()).map((r) => r.work_id)).toEqual([must(accepted).work_id]);
    expect((await f.pg.query("SELECT count(*)::int n FROM p_app.items")).rows).toEqual([{ n: 1 }]);
  });
  it("downtime coalesces to one current reconciliation tick without replaying missed intervals", async () => {
    const f = await scheduledFixture();
    await f.store.schedule(10);
    await f.store.runBatch(() => {});
    f.clock(f.now() + 10000);
    await Promise.all([f.store.schedule(10), f.other.schedule(10)]);
    const records = await f.records();
    expect(records).toHaveLength(2);
    expect(records.filter((r) => r.state === "accepted").map((r) => r.work_key)).toEqual([
      `s:10:${Math.floor(f.now() / 10)}`,
    ]);
  });
  it("many intervals and replicas retain one outstanding intent; expired holders recover that intent before a fresh tick", async () => {
    const f = await scheduledFixture();
    await f.store.schedule(1);
    const [old] = await f.store.claim(1);
    const id = must((await f.records())[0]).work_id;
    for (let i = 0; i < 100; i++) {
      f.clock(f.now() + 10);
      await Promise.all([f.store.schedule(1), f.other.schedule(1)]);
    }
    expect((await f.records()).map((r) => r.work_id)).toEqual([id]);
    const [replacement] = await f.other.claim(1);
    expect(replacement).toBeDefined();
    await expect(f.store.complete(old)).rejects.toMatchObject({ code: "WORK_LEASE_LOST" });
    await f.other.complete(replacement);
    await f.store.schedule(1);
    expect((await f.records()).map((r) => r.state)).toEqual(["completed", "accepted"]);
    expect((await f.pg.query("SELECT count(*)::int n FROM p_app.items")).rows).toEqual([{ n: 1 }]);
  });
  it("shortening and lengthening the interval drains accepted old work without a configuration conflict or stranded rows", async () => {
    const f = await scheduledFixture();
    for (const [before, after] of [
      [60, 1],
      [1, 604800],
    ] as const) {
      f.clock(f.now() + 604800);
      await f.store.schedule(before);
      const old = must((await f.records()).find((r) => r.state === "accepted"));
      await f.other.schedule(after);
      expect(
        (await f.records()).filter((r) => r.state !== "completed").map((r) => r.work_id),
      ).toEqual([old.work_id]);
      await f.other.runBatch(() => {});
      await f.other.schedule(after);
      const pending = (await f.records()).filter((r) => r.state !== "completed");
      expect(pending).toHaveLength(1);
      expect(must(pending[0]).input.value.intervalSeconds).toBe(after);
      await f.store.runBatch(() => {});
    }
    expect((await f.records()).every((r) => r.state === "completed")).toBe(true);
  });
  it("actual hung callbacks retain their execution/admission slots after deadlines across many intervals", async () => {
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((r) => {
      entered = r;
    });
    const blocked = new Promise<void>((r) => {
      release = r;
    });
    let calls = 0;
    const f = await scheduledFixture(async (_input, commands) => {
      calls++;
      await commands.call("insert", ["one", "background"]);
      entered();
      await blocked;
    });
    await f.store.schedule(1);
    const running = f.run(() => f.store.runBatch(() => {}), 250);
    await started;
    await running;
    await expect(f.run(() => f.other.schedule(1), 250)).rejects.toMatchObject({
      outcome: "unknown",
    });
    const connections = f.connections();
    for (let i = 0; i < 100; i++) {
      f.clock(f.now() + 10);
      await Promise.all([f.store.schedule(1), f.other.schedule(1)]);
    }
    expect(f.connections()).toBe(connections);
    expect(calls).toBe(1);
    release();
    await f.run(() => f.store.status("{}", "settlement-barrier"));
    const rows = await f.records(); // actual rollback and queued acquisition have settled
    expect(rows).toHaveLength(1);
    expect(must(rows[0]).state).toBe("running");
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
  });
  it("failed/unknown ticks halt admission observably and incompatible definitions refuse startup before scheduling", async () => {
    const f = await scheduledFixture();
    await f.store.schedule(1);
    const [claim] = await f.store.claim(1);
    await f.store.fail(claim, true);
    f.clock(f.now() + 1000);
    expect(await f.other.schedule(60)).toBe("unknown");
    expect(await f.records()).toHaveLength(1);
    const controller = new AbortController(),
      stops: (() => void)[] = [],
      closes: (() => Promise<void>)[] = [];
    const scope = {
      signal: controller.signal,
      admission: (stop: () => void) => stops.push(stop),
      own: (close: () => Promise<void>) => closes.push(close),
    };
    let logged!: () => void;
    const done = new Promise<void>((r) => {
      logged = r;
    });
    const events: string[] = [];
    await runtime.startScheduledTask(
      f.work,
      f.dependencies,
      scope,
      (event: string) => {
        events.push(event);
        logged();
      },
      1,
    );
    await done;
    for (const stop of stops) stop();
    controller.abort();
    await Promise.all(closes.map((close) => close()));
    expect(events).toEqual(["scheduled task halted unknown"]);
    const migrated = runtime.defineDurableWork({ ...f.definition, version: 2 });
    runtime.bindDurableWork(
      f.dependencies.db,
      runtime.durableWorkDefinition(migrated, "db", true),
      f.options,
    );
    await expect(
      runtime.startScheduledTask(
        migrated,
        f.dependencies,
        { ...scope, signal: new AbortController().signal },
        () => {},
        1,
      ),
    ).rejects.toMatchObject({ code: "WORK_SCHEDULE_MIGRATION_REQUIRED" });
    expect(() =>
      runtime.validateScheduledTaskBinding(
        runtime.defineDurableWork({ ...f.definition, retentionSeconds: 60 }),
        ["db"],
      ),
    ).toThrow(/seven-day/);
  });
  it("scheduled remote input is durably mapped and another process identity cannot take over the selected workload", async () => {
    const f = await scheduledFixture();
    const definition = {
      ...f.definition,
      integration: {
        target: "callee",
        operation: "reconcile",
        map: (input: { tick: string; intervalSeconds: number }) => ({ tick: input.tick }),
      },
    };
    const first = runtime.createWorkStore({ ...f.options, definition });
    const otherRole = runtime.createWorkStore({
      ...f.options,
      process: "other-worker",
      definition,
    });
    await first.schedule(60);
    expect((await f.pg.query("SELECT remote_input FROM jeeves.work_records")).rows).toEqual([
      { remote_input: { present: true, value: { tick: String(Math.floor(f.now() / 60)) } } },
    ]);
    await expect(otherRole.schedule(60)).rejects.toMatchObject({
      code: "WORK_SCHEDULE_MIGRATION_REQUIRED",
    });
    expect(await otherRole.claim()).toEqual([]);
    expect(await first.claim(1)).toHaveLength(1);
  });

  it("idle process lifecycle runs without HTTP/messages and shutdown cancels, drains and leaves recoverable work", async () => {
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((r) => {
      entered = r;
    });
    const blocked = new Promise<void>((r) => {
      release = r;
    });
    const f = await scheduledFixture(async (_input, commands) => {
      await commands.call("insert", ["one", "background"]);
      entered();
      await blocked;
    });
    const controller = new AbortController(),
      stops: (() => void)[] = [],
      closes: (() => Promise<void>)[] = [],
      tracked: Promise<unknown>[] = [];
    const scope = {
      signal: controller.signal,
      track: (p: Promise<unknown>) => tracked.push(p),
      admission: (stop: () => void) => stops.push(stop),
      own: (close: () => Promise<void>) => closes.push(close),
    };
    const { withProcess } = await import(load("operation"));
    await withProcess(scope, () =>
      runtime.startScheduledTask(f.work, f.dependencies, scope, () => {}, 1),
    );
    await started;
    for (const stop of stops) stop();
    controller.abort();
    release();
    await Promise.all(closes.map((close) => close()));
    await Promise.allSettled(tracked);
    expect(must((await f.records())[0]).state).toBe("running");
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    f.clock(f.now() + 31);
    const [claim] = await f.other.claim(1);
    await f.other.complete(claim);
    expect(must((await f.records())[0]).state).toBe("completed");
  });
});

const registry = loadLocalV2Registry();
describe("RG16 scheduled authoring and emitted composition", () => {
  it("both hosts, interval inspector/blueprint/export and explicit precise Worker ownership agree without a fake queue", () => {
    const design = scheduledDesign();
    expect(laneFindings(design)).toEqual([]);
    expect(
      must(design.architecture?.studio).elements.some((e) => e.settings.kind === "queue"),
    ).toBe(false);
    const resolved = resolveGeneration(design, registry.installed);
    expect(resolved.findings).toEqual([]);
    const controls = normalGenerationControls(design, registry.installed).filter(
      (c) => c.input === "task.intervalSeconds",
    );
    expect(controls).toHaveLength(2);
    expect(controls.every((c) => c.normalControl)).toBe(true);
    expect(
      normalGenerationControls(design, registry.installed).some(
        (c) => c.process === "maintenance-worker" && c.input === "process.concurrency",
      ),
    ).toBe(false);
    const blueprint = designBlueprintV3(design);
    expect(JSON.stringify(blueprint)).toContain('"intervalSeconds":60');
    const selected = must(designGeneration(design)).selections.find((s) => s.id === "service-task");
    must(selected).id = "service-task-binding";
    const bundle = assembleV2({ designJson: canonicalJson(design) }, registry);
    const text = (path: string) =>
      new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
    for (const host of ["maintenance-api", "maintenance-worker"]) {
      expect(text(`src/processes/${host}.ts`)).toContain("await startScheduledTask(");
      expect(text(`src/processes/${host}.ts`)).toContain("scheduledTasks[");
    }
    expect(text("src/processes/maintenance-api.ts")).toContain(
      'scheduledTasks["service-task-binding"].intervalSeconds',
    );
    expect(text("src/processes/maintenance-worker.ts")).not.toContain("startModuleLoop");
    expect(text("src/modules/maintenance-worker/maintenance-worker-scheduled-task.ts")).toContain(
      "retentionSeconds: 604800",
    );
    expect(text("src/extension-api/index.ts")).not.toContain("startScheduledTask");
    const infra = JSON.parse(text("infra/local.json"));
    const serialized = JSON.stringify(infra);
    expect(serialized).toContain("product-state--maintenance-api");
    expect(serialized).toContain("product-state--maintenance-worker");
    const owner = designOwnership(design);
    expect(owner.roles.find((r) => r.element === "maintenance-worker")?.sharedWith).toBe(
      "maintenance-api",
    );
    expect(
      owner.grants.find((g) => g.role === "maintenance-worker" && g.resource === "state")?.product
        ?.tables,
    ).toEqual([{ name: "items", operations: ["SELECT", "UPDATE"] }]);
  });
  it("missing writable state stays a scaffold; wrong-owner writes, read-only state and disabling runnable lifecycle refuse", () => {
    const design = scheduledDesign();
    const batch = buildStudioCommand(design, {
      type: "disconnectModule",
      link: must(
        must(design.architecture?.studio).componentConnections?.find(
          (c) => c.from === "service-task" && c.to.id === "state",
        ),
      ).id,
    });
    const result = applyOperations(design, batch.ops, { baseRevision: design.revision });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      must(designGeneration(result.design)).selections.find((s) => s.id === "service-task")?.binding
        .kind,
    ).toBe("module-stub");
    const stopped = runStudioCommands(design, [{ type: "setRunnableProcesses", on: false }]);
    expect(
      resolveGeneration(stopped, registry.installed).findings.some((f) =>
        f.message.includes("Runnable processes"),
      ),
    ).toBe(true);
    const foreign = runStudioCommands(design, [
      {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        tile: { id: "foreign-api", name: "Foreign API", kind: "service" },
        linkId: "foreign-entry",
      },
      { type: "addModule", host: "foreign-api", kind: "scheduled-task", id: "foreign-task" },
    ]);
    expect(() =>
      buildStudioCommand(foreign, {
        type: "connectModule",
        module: "foreign-task",
        slot: "state",
        target: { tile: "state" },
      }),
    ).toThrow(/owner/i);
    const invalid = structuredClone(design);
    must(designOwnership(invalid).roles.find((r) => r.element === "maintenance-worker")).owner =
      "foreign";
    expect(resolveGeneration(invalid, registry.installed).model).toBeUndefined();
    const readOnly = structuredClone(design);
    must(
      designOwnership(readOnly).grants.find(
        (g) => g.role === "maintenance-worker" && g.resource === "state",
      ),
    ).access = "read";
    expect(resolveGeneration(readOnly, registry.installed).model).toBeUndefined();
  });
});

import { expect, test } from "vitest";
import {
  activityTemplates,
  brokerProbe,
  controlContainer,
  counterQueue,
  healthyCopies,
  inApplication,
  queueBecomes,
  readTotal,
  receiptIds,
  submit,
  totalBecomes,
} from "../harness/activity.ts";
import { type Application, withApplication } from "../harness/application.ts";
import {
  assertNoProcessExited,
  brokerSignals,
  faultContainer,
  logsSince,
  onlyContainer,
  processStates,
  rawLogsSince,
  SqlSession,
  until,
} from "../harness/faults.ts";
import { poll } from "../harness/process.ts";
import { published, regenerationTemplates } from "../harness/regeneration.ts";
import { cacheHitCount, cacheObservation, catalogLoads } from "../harness/wiring.ts";

// Scenario contract: each fixture API answers within its configured 1 s request deadline;
// allow the single edge hop on top of that.
const answerBoundMs = 1500;
// Durations use the monotonic clock: this host steps its wall clock (WSL2 time sync).
const timed = async (request: () => Promise<{ status: number; body: unknown }>) => {
  const started = performance.now();
  const value = await request();
  return { ...value, elapsedMs: Math.round(performance.now() - started) };
};

/** Harness cache injection: the application's own cache credential, used only to clear a key. */
async function clearCacheKey(app: Application, key: string) {
  const removed = await inApplication<number>(
    app,
    "app-catalog-api",
    `
    import {createClient} from 'redis';import {readFileSync} from 'node:fs';
    const client=createClient({password:readFileSync('/run/secrets/cache-catalog-cache','utf8').trim(),
      socket:{host:'cache-catalog-cache',port:6379,connectTimeout:2000,reconnectStrategy:false}});
    client.on('error',()=>{});
    try{await client.connect();console.log(JSON.stringify(await client.del(${JSON.stringify(key)})));}
    finally{client.destroy();}
  `,
  );
  app.record({ cacheKeyCleared: { key, removed } });
  return removed;
}

test("B06 recovery: immutable reads fall back while the cache is stopped or stalled, then fill and hit again without an API restart", async () => {
  await withApplication("regeneration", regenerationTemplates, async (app) => {
    const key = "catalog:published-a";
    const read = () =>
      timed(() => app.request(`/api/catalog-api/modules/catalog-read/${published.id}`));
    const cache = await onlyContainer(app, "cache-catalog-cache");
    const before = await processStates(app);
    expect(before.map((row) => row.service)).toEqual(["app-catalog-api", "app-edge"]);
    expect(await read()).toMatchObject({ status: 200, body: published });
    expect(JSON.parse((await cacheObservation(app, key)).value ?? "null")).toEqual(published);

    /** Restoration: a cleared key is refilled by one read, then a second read is a real hit. */
    const fillAndHit = async (label: string, lastFallback: number) => {
      expect(await clearCacheKey(app, key)).toBeLessThanOrEqual(1);
      expect(await cacheObservation(app, key)).toMatchObject({ value: null, pttl: -2 });
      // The reader leaves its cache unused for 5 s after a failed call (documented contract).
      await until(lastFallback + 5250);
      const loads = await catalogLoads(app, published.id);
      expect(await read()).toMatchObject({ status: 200, body: published });
      const filled = await cacheObservation(app, key);
      expect(JSON.parse(filled.value ?? "null")).toEqual(published);
      expect(filled.pttl).toBeGreaterThan(2000);
      expect(filled.pttl).toBeLessThanOrEqual(4000);
      expect(await catalogLoads(app, published.id)).toBe(loads + 1);
      const hits = await cacheHitCount(app);
      expect(await read()).toMatchObject({ status: 200, body: published });
      expect((await cacheHitCount(app)) - hits).toBe(1);
      expect(await catalogLoads(app, published.id)).toBe(loads + 1);
      app.record({ cacheRestored: label, filled });
    };
    const signals: Record<string, unknown> = {};

    // Case 1: the cache stops, then starts.
    const stopped = await faultContainer(app, "cache-catalog-cache", cache.Id, "stop");
    signals.stopLost = await poll(
      "catalog API logged the stopped cache",
      () => logsSince(app, "app-catalog-api", stopped.at),
      (lines) =>
        lines.some(
          (line) => line.entry.event === "failure" && line.entry.what === "cache catalog-read",
        ),
      10_000,
      (value) => app.record(value),
    );
    let loads = await catalogLoads(app, published.id);
    const stoppedReads = [];
    const outageStart = Date.now();
    // Spread over eight seconds so at least one 5 s reconnect attempt meets the stopped cache.
    for (let n = 0; n < 8; n++) {
      await until(outageStart + n * 1000);
      stoppedReads.push(await read());
    }
    let lastFallback = Date.now();
    app.record({ stoppedReads });
    for (const row of stoppedReads) {
      expect(row).toMatchObject({ status: 200, body: published });
      expect(row.elapsedMs).toBeLessThan(answerBoundMs);
    }
    // Every read during the outage was answered by the authoritative database.
    expect(await catalogLoads(app, published.id)).toBe(loads + 8);
    const restarted = await faultContainer(app, "cache-catalog-cache", cache.Id, "start");
    await healthyCopies(app, "cache-catalog-cache", 1);
    signals.stop = await poll(
      "catalog API logged the cache available again",
      () => logsSince(app, "app-catalog-api", stopped.at),
      (lines) =>
        lines.some(
          (line) =>
            line.entry.event === "cache" &&
            line.entry.state === "available" &&
            Date.parse(line.at) >= Date.parse(restarted.at),
        ),
      15_000,
      (value) => app.record(value),
    );
    await fillAndHit("after stop/start", lastFallback);

    // Case 2: the cache stalls (its process is frozen; connections stay open), then resumes.
    const paused = await faultContainer(app, "cache-catalog-cache", cache.Id, "pause");
    let frozen = true;
    try {
      loads = await catalogLoads(app, published.id);
      const stalledReads = [];
      const start = Date.now();
      // Spread over eight seconds so at least one 5 s reconnect attempt meets the frozen cache.
      for (let n = 0; n < 8; n++) {
        await until(start + n * 1000);
        stalledReads.push(await read());
      }
      lastFallback = Date.now();
      app.record({ stalledReads });
      for (const row of stalledReads) {
        expect(row).toMatchObject({ status: 200, body: published });
        expect(row.elapsedMs).toBeLessThan(answerBoundMs);
      }
      expect(await catalogLoads(app, published.id)).toBe(loads + 8);
      const lines = await logsSince(app, "app-catalog-api", paused.at);
      for (const what of ["cache catalog-read", "cache read catalog-read"])
        expect(
          lines.some((line) => line.entry.event === "failure" && line.entry.what === what),
        ).toBe(true);
      const resumed = await faultContainer(app, "cache-catalog-cache", cache.Id, "unpause");
      frozen = false;
      signals.stall = await poll(
        "catalog API logged the resumed cache available again",
        () => logsSince(app, "app-catalog-api", paused.at),
        (rows) =>
          rows.some(
            (line) =>
              line.entry.event === "cache" &&
              line.entry.state === "available" &&
              Date.parse(line.at) >= Date.parse(resumed.at),
          ),
        15_000,
        (value) => app.record(value),
      );
    } finally {
      if (frozen) await faultContainer(app, "cache-catalog-cache", cache.Id, "unpause");
    }
    await fillAndHit("after stall", lastFallback);
    await app.save("cache-signals.json", signals);
    await assertNoProcessExited(app, before, "cache faults");
  });
});

test("B09 counter: a worker killed before its SQL commit yields one increment; a committed event delivered again stays one", async () => {
  await withApplication("activity", activityTemplates, async (app) => {
    const aggregate = "Fault:counter";
    const eventId = "counter:killed";
    expect((await submit(app, aggregate, "counter:seed")).status).toBe(202);
    await totalBecomes(app, aggregate, 1);
    const worker = await onlyContainer(app, "app-counter");
    const workerAddresses = Object.values(worker.NetworkSettings.Networks).map(
      (network) => network.IPAddress,
    );
    await queueBecomes(app, 1, 0);
    type Backend = {
      pid: number;
      client: string;
      xact_start: string;
      query_start: string;
      state: string;
      wait_event_type: string | null;
      wait_event: string | null;
      waited_ms: number;
    };
    const backend = (where: string) =>
      `SELECT pid,host(client_addr) AS client,xact_start::text,query_start::text,state,wait_event_type,wait_event,
        (extract(epoch FROM clock_timestamp()-query_start)*1000)::int AS waited_ms
       FROM pg_stat_activity WHERE ${where}`;
    const holder = await SqlSession.open(app, "d_totals", "total row holder");
    const observer = await SqlSession.open(app, "d_totals", "observer");
    let holding = false;
    try {
      expect(
        await holder.run(
          `BEGIN; SELECT total FROM increment.totals WHERE aggregate_key='${aggregate}' FOR UPDATE;`,
        ),
      ).toBe("1");
      holding = true;
      expect((await submit(app, aggregate, eventId)).status).toBe(202);
      const [blocked] = await poll(
        "the worker's increment waits behind the held total row",
        () =>
          observer.json<Backend[]>(
            backend(
              "usename='r_totals__counter' AND state='active' AND wait_event_type='Lock' AND position('DO UPDATE SET total=counts.total+1' in query)>0",
            ),
          ),
        (rows) => rows.length === 1,
        5_000,
        (value) => app.record(value),
      );
      if (!blocked) throw new Error("Blocked increment missing");
      expect(workerAddresses).toContain(blocked.client);
      const delivery = await brokerProbe(app, "state");
      expect(delivery).toMatchObject({ messageCount: 0, unacknowledged: 1, consumerCount: 1 });
      const killed = await faultContainer(app, "app-counter", worker.Id, "kill");
      // Same backend, transaction and statement, still waiting: the kill came before any commit.
      const [still] = await observer.json<Backend[]>(backend(`pid=${blocked.pid}`));
      expect(still).toMatchObject({
        pid: blocked.pid,
        xact_start: blocked.xact_start,
        query_start: blocked.query_start,
        state: "active",
        wait_event_type: "Lock",
      });
      await app.save("counter-kill-boundary.json", { blocked, delivery, killed, still });
      await holder.run("ROLLBACK;");
      holding = false;
      await poll(
        "the killed worker's database backend ends",
        () => observer.json<Backend[]>(backend(`pid=${blocked.pid}`)),
        (rows) => rows.length === 0,
        30_000,
        (value) => app.record(value),
      );
      expect(await receiptIds(app, aggregate)).toEqual(["counter:seed"]);
      expect(
        await app.sql(`SELECT total FROM increment.totals WHERE aggregate_key='${aggregate}'`),
      ).toBe("1");
      // The unacknowledged delivery returned to the queue when its consumer died.
      await queueBecomes(app, 0, 1);
    } finally {
      if (holding) await holder.run("ROLLBACK;");
      await holder.close();
      await observer.close();
    }
    await faultContainer(app, "app-counter", worker.Id, "start");
    await healthyCopies(app, "app-counter", 1);
    await totalBecomes(app, aggregate, 2);
    await queueBecomes(app, 1, 0);
    expect(await receiptIds(app, aggregate)).toEqual([eventId, "counter:seed"]);
    expect(await brokerProbe(app, "state", `${counterQueue}.failed`)).toMatchObject({
      messageCount: 0,
      unacknowledged: 0,
    });

    // Duplicate-delivery proof (not a crash between commit and ack): replay the committed event.
    await controlContainer(app, "app-counter", worker.Id, "stop");
    await queueBecomes(app, 0, 0);
    const envelope = JSON.stringify({ eventId, aggregateKey: aggregate });
    const replay = await inApplication(
      app,
      "app-activity-api",
      `
      import amqp from 'amqplib'; import {readFileSync} from 'node:fs';
      const connection=await amqp.connect({hostname:'local-broker',username:'runtime',
        password:readFileSync('/run/secrets/broker-password','utf8').trim(),heartbeat:10});
      const channel=await connection.createConfirmChannel();
      try {channel.publish('events','',Buffer.from(${JSON.stringify(envelope)}),
          {persistent:true,messageId:${JSON.stringify(eventId)},contentType:'application/json'});
        await channel.waitForConfirms();console.log(JSON.stringify({confirmed:true}));
      } finally {await channel.close();await connection.close();}
    `,
    );
    app.record({ committedEventReplay: { envelope, replay } });
    expect(replay).toEqual({ confirmed: true });
    await queueBecomes(app, 0, 1);
    await controlContainer(app, "app-counter", worker.Id, "start");
    await healthyCopies(app, "app-counter", 1);
    await queueBecomes(app, 1, 0);
    expect(await readTotal(app, aggregate)).toEqual({
      status: 200,
      body: { aggregateKey: aggregate, total: "2" },
    });
    expect(await receiptIds(app, aggregate)).toEqual([eventId, "counter:seed"]);
    expect(await brokerProbe(app, "state", `${counterQueue}.failed`)).toMatchObject({
      messageCount: 0,
      unacknowledged: 0,
    });
  });
});

test("B09 broker: confirmed queued work survives a broker restart; running publishers and consumers reconnect without a process restart", async () => {
  await withApplication("activity", activityTemplates, async (app) => {
    const aggregate = "Fault:broker";
    const broker = await onlyContainer(app, "local-broker");
    const worker = await onlyContainer(app, "app-counter");
    expect((await submit(app, aggregate, "broker:before")).status).toBe(202);
    await totalBecomes(app, aggregate, 1);
    const publisher = [{ service: "app-activity-api", what: "broker publish events" }];
    const consumer = [{ service: "app-counter", what: `broker consume ${counterQueue}` }];
    /** Publication fails at once and reads keep answering, at the outage's start and after
     * two failed 5 s reconnect attempts; no running process exits. */
    const duringOutage = async (
      label: string,
      since: string,
      eventId: string,
      total: number,
      running: Awaited<ReturnType<typeof processStates>>,
    ) => {
      for (const instant of [Date.now(), Date.parse(since) + 12_000]) {
        await until(instant);
        const publication = await timed(() => submit(app, aggregate, eventId));
        expect(publication).toMatchObject({ status: 503, body: { error: "UNAVAILABLE" } });
        expect(publication.elapsedMs).toBeLessThan(answerBoundMs);
        const read = await timed(() => readTotal(app, aggregate));
        expect(read).toMatchObject({
          status: 200,
          body: { aggregateKey: aggregate, total: String(total) },
        });
        expect(read.elapsedMs).toBeLessThan(answerBoundMs);
      }
      await assertNoProcessExited(app, running, label);
    };

    // Phase 1. Precondition: consumers stopped before the fault, so accepted work waits queued.
    await controlContainer(app, "app-counter", worker.Id, "stop");
    await queueBecomes(app, 0, 0);
    const queued = Array.from({ length: 5 }, (_, index) => `broker:queued:${index}`);
    for (const id of queued) expect((await submit(app, aggregate, id)).status).toBe(202);
    await queueBecomes(app, 0, 5);
    const running = await processStates(app);
    const first = await faultContainer(app, "local-broker", broker.Id, "stop");
    await brokerSignals(app, publisher, first.at, false, 15_000);
    await duringOutage("broker down, consumers stopped", first.at, "broker:outage", 1, running);
    await faultContainer(app, "local-broker", broker.Id, "start");
    await healthyCopies(app, "local-broker", 1);
    await app.save(
      "broker-phase-1-signals.json",
      await brokerSignals(app, publisher, first.at, true, 30_000),
    );
    await assertNoProcessExited(app, running, "broker restarted, consumers stopped");
    // The accepted messages survived the restart in the durable queue.
    await queueBecomes(app, 0, 5);
    // The 503's outcome is uncertain to its caller: retry the same stable identity.
    expect((await submit(app, aggregate, "broker:outage")).status).toBe(202);
    expect((await submit(app, aggregate, "broker:after")).status).toBe(202);
    await queueBecomes(app, 0, 7);
    await assertNoProcessExited(app, running, "publisher reconnected by itself");
    // Resume the consumer stopped by the precondition; it lost no broker connection.
    await controlContainer(app, "app-counter", worker.Id, "start");
    await healthyCopies(app, "app-counter", 1);
    const phase1 = ["broker:before", ...queued, "broker:outage", "broker:after"].sort();
    await totalBecomes(app, aggregate, phase1.length);
    await queueBecomes(app, 1, 0);
    expect(await receiptIds(app, aggregate)).toEqual(phase1);

    // Phase 2. A running consumer and publisher lose the broker and regain it by themselves.
    const subscribed = await processStates(app);
    const second = await faultContainer(app, "local-broker", broker.Id, "stop");
    await brokerSignals(app, [...publisher, ...consumer], second.at, false, 15_000);
    await duringOutage(
      "broker down, consumer running",
      second.at,
      "broker:missed",
      phase1.length,
      subscribed,
    );
    await faultContainer(app, "local-broker", broker.Id, "start");
    await healthyCopies(app, "local-broker", 1);
    await app.save(
      "broker-phase-2-signals.json",
      await brokerSignals(app, [...publisher, ...consumer], second.at, true, 30_000),
    );
    await queueBecomes(app, 1, 0);
    expect((await submit(app, aggregate, "broker:missed")).status).toBe(202);
    expect((await submit(app, aggregate, "broker:resubscribed")).status).toBe(202);
    const all = [...phase1, "broker:missed", "broker:resubscribed"].sort();
    await totalBecomes(app, aggregate, all.length);
    await queueBecomes(app, 1, 0);
    expect(await receiptIds(app, aggregate)).toEqual(all);
    expect(await brokerProbe(app, "state", `${counterQueue}.failed`)).toMatchObject({
      messageCount: 0,
      unacknowledged: 0,
    });
    await assertNoProcessExited(app, subscribed, "consumer resubscribed by itself");
  });
});

test("B09 database: PostgreSQL stopping during work gives bounded failures; after restore and the documented restart, accepted work completes once", async () => {
  await withApplication("activity", activityTemplates, async (app) => {
    const aggregate = "Fault:database";
    const postgres = await onlyContainer(app, "local-postgres");
    // Work in progress immediately before the outage.
    const earlier = ["database:earlier:0", "database:earlier:1", "database:earlier:2"];
    for (const id of earlier) expect((await submit(app, aggregate, id)).status).toBe(202);
    await totalBecomes(app, aggregate, earlier.length);
    const before = await processStates(app);
    const stopped = await faultContainer(app, "local-postgres", postgres.Id, "stop");
    const during = ["database:during:0", "database:during:1", "database:during:2"];
    // Publication needs only the broker: these are accepted (confirmed) during the outage.
    for (const id of during) expect((await submit(app, aggregate, id)).status).toBe(202);
    const reads = [];
    for (let n = 0; n < 3; n++) reads.push(await timed(() => readTotal(app, aggregate)));
    app.record({ readsDuringOutage: reads });
    for (const row of reads) {
      expect(row.status).toBe(503);
      expect(row.elapsedMs).toBeLessThan(answerBoundMs);
    }
    const workerFailure = await poll(
      "the Counter's failure is observed (process exit or failed deliveries)",
      async () => {
        const states = await processStates(app);
        const counter = states.find((row) => row.service === "app-counter");
        const lines = await logsSince(app, "app-counter", stopped.at);
        return {
          counter,
          loopErrors: lines.filter((line) => line.entry.event === "loop-error"),
          queue: await brokerProbe(app, "state"),
          failed: await brokerProbe(app, "state", `${counterQueue}.failed`),
        };
      },
      (value) => value.counter?.status === "exited" || value.loopErrors.length > 0,
      15_000,
      (value) => app.record(value),
    );
    const totalsApi = (await processStates(app)).find((row) => row.service === "app-totals-api");
    await app.save("database-outage.json", {
      stopped,
      reads,
      workerFailure,
      totalsApi,
      before,
      counterOutput: await rawLogsSince(app, "app-counter", stopped.at),
    });
    await faultContainer(app, "local-postgres", postgres.Id, "start");
    await healthyCopies(app, "local-postgres", 1);
    // Documented recovery: a failed process stays exited until `pnpm start` (generated README).
    await app.execute("documented-recovery", "pnpm", ["start"], 600_000);
    await healthyCopies(app, "app-counter", 1);
    const accepted = [...earlier, ...during].sort();
    await totalBecomes(app, aggregate, accepted.length);
    expect(await receiptIds(app, aggregate)).toEqual(accepted);
    expect((await submit(app, aggregate, "database:after")).status).toBe(202);
    await totalBecomes(app, aggregate, accepted.length + 1);
    expect(await receiptIds(app, aggregate)).toEqual([...accepted, "database:after"].sort());
    await queueBecomes(app, 1, 0);
    expect(await brokerProbe(app, "state", `${counterQueue}.failed`)).toMatchObject({
      messageCount: 0,
      unacknowledged: 0,
    });
  });
});

import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
  serviceContainers,
  submit,
  totalBecomes,
} from "../harness/activity.ts";
import { withApplication } from "../harness/application.ts";
import { command, hash, poll } from "../harness/process.ts";

test("B02: competing copies commit each repeated identity once and both public APIs survive either copy stopping", async () => {
  await withApplication("activity", activityTemplates, async (app) => {
    const services = ["app-counter", "app-activity-api", "app-totals-api"];
    await app.compose(
      [
        "up",
        "-d",
        "--no-recreate",
        "--no-deps",
        ...services.flatMap((service) => ["--scale", `${service}=2`]),
        ...services,
      ],
      180_000,
    );
    const counters = await healthyCopies(app, "app-counter", 2);
    await healthyCopies(app, "app-activity-api", 2);
    await healthyCopies(app, "app-totals-api", 2);
    expect(await serviceContainers(app, "app-edge")).toHaveLength(1);
    await queueBecomes(app, 2);

    // Observe each connection while that worker has just committed work; idle pools may close.
    const addresses = counters
      .flatMap((row) =>
        Object.values(row.NetworkSettings.Networks).map((network) => network.IPAddress),
      )
      .sort();
    const connectionProofs: { container: string; aggregate: string; connections: string[] }[] = [];

    for (const [index, stopped] of counters.entries()) {
      const aggregate = `Worker:alone:${1 - index}`;
      await controlContainer(app, "app-counter", stopped.Id, "stop");
      try {
        await queueBecomes(app, 1);
        expect((await submit(app, aggregate, `${aggregate}:event`)).status).toBe(202);
        await totalBecomes(app, aggregate, 1);
        const survivor = counters.find((row) => row.Id !== stopped.Id);
        if (!survivor) throw new Error("Surviving Counter missing");
        const connections = (
          await app.sql(
            "SELECT DISTINCT host(client_addr) FROM pg_stat_activity WHERE usename='r_totals__counter' ORDER BY 1",
          )
        ).split("\n");
        expect(connections).toEqual(
          Object.values(survivor.NetworkSettings.Networks)
            .map((network) => network.IPAddress)
            .sort(),
        );
        connectionProofs.push({ container: survivor.Id, aggregate, connections });
        expect(await receiptIds(app, aggregate)).toEqual([`${aggregate}:event`]);
      } finally {
        await controlContainer(app, "app-counter", stopped.Id, "start");
      }
      await healthyCopies(app, "app-counter", 2);
    }
    expect([...new Set(connectionProofs.flatMap((proof) => proof.connections))].sort()).toEqual(
      addresses,
    );
    await app.save("worker-connections.json", { addresses, proofs: connectionProofs });
    await queueBecomes(app, 2);

    const aggregate = "Activity:contention";
    const identities = Array.from(
      { length: 50 },
      (_, index) => `burst:${String(index).padStart(2, "0")}`,
    );
    // One initial submission plus three repeats per identity. No fixture-side suppression.
    const submissions = identities.flatMap((eventId) => Array.from({ length: 4 }, () => eventId));
    let next = 0;
    const confirmed: string[] = [],
      transportFailures: unknown[] = [],
      responseFailures: unknown[] = [];
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (next < submissions.length) {
          const eventId = submissions[next++];
          if (eventId === undefined) throw new Error("Submission index outside burst");
          try {
            const response = await submit(app, aggregate, eventId);
            if (response.status === 202) confirmed.push(eventId);
            else responseFailures.push({ eventId, response });
          } catch (error) {
            transportFailures.push({ eventId, error: String(error) });
          }
        }
      }),
    );
    await app.save("burst.json", {
      distinct: identities,
      requests: submissions.length,
      concurrency: 8,
      confirmed: confirmed.length,
      transportFailures,
      responseFailures,
    });
    expect(transportFailures).toEqual([]);
    expect(responseFailures).toEqual([]);
    expect(confirmed).toHaveLength(200);
    expect(new Set(confirmed).size).toBe(50);
    await totalBecomes(app, aggregate, 50);
    await queueBecomes(app, 2, 0);
    expect(await receiptIds(app, aggregate)).toEqual(identities);
    expect(
      await app.sql("SELECT total FROM increment.totals WHERE aggregate_key='Activity:contention'"),
    ).toBe("50");

    // DNS is cached for 10 s; allow one bounded 5 s request beyond that refresh window.
    const routingBoundMs = 15_000;
    for (const service of ["app-activity-api", "app-totals-api"]) {
      const copies = await healthyCopies(app, service, 2);
      for (const [index, target] of copies.entries()) {
        const key = `Failover:${service}:${index}`;
        await controlContainer(app, service, target.Id, "stop");
        try {
          const started = Date.now();
          await poll(
            `${service} edge submission and read after copy ${index} stop`,
            () => Promise.all([submit(app, key, `${key}:event`), readTotal(app, key)]),
            ([publication, read]) => publication.status === 202 && read.status === 200,
            routingBoundMs,
            (value) => app.record(value),
          );
          const observedMs = Date.now() - started;
          app.record({
            failover: service,
            stopped: target.Id,
            routingBoundMs,
            observedMs,
          });
          expect(observedMs).toBeLessThanOrEqual(routingBoundMs);
          await totalBecomes(app, key, 1);
          expect(await receiptIds(app, key)).toEqual([`${key}:event`]);
        } finally {
          await controlContainer(app, service, target.Id, "start");
        }
        await healthyCopies(app, service, 2);
      }
    }
    await totalBecomes(app, aggregate, 50);
    expect(await receiptIds(app, aggregate)).toEqual(identities);
  });
});

test("B03: completed totals and confirmed queued events survive ordinary stop/start on the same runtime and volumes", async () => {
  await withApplication("activity", activityTemplates, async (app) => {
    const aggregate = "Activity:restart";
    const earlier = ["restart:old:1", "restart:old:2", "restart:old:3"];
    for (const event of earlier) expect((await submit(app, aggregate, event)).status).toBe(202);
    await totalBecomes(app, aggregate, 3);
    expect(await receiptIds(app, aggregate)).toEqual(earlier);
    const [worker] = await healthyCopies(app, "app-counter", 1);
    if (!worker) throw new Error("Counter missing");
    await controlContainer(app, "app-counter", worker.Id, "stop");
    await queueBecomes(app, 0, 0);
    const queued = Array.from({ length: 5 }, (_, index) => `restart:queued:${index}`);
    for (const event of queued) expect((await submit(app, aggregate, event)).status).toBe(202);
    await queueBecomes(app, 0, 5);
    expect(await readTotal(app, aggregate)).toEqual({
      status: 200,
      body: { aggregateKey: aggregate, total: "3" },
    });

    const historyPath = join(app.directory, ".runtime/local-setup.json");
    const historyBefore = hash(await readFile(historyPath));
    const volumeIdentity = async () => {
      const ids = (
        await command("docker", [
          "volume",
          "ls",
          "-q",
          "--filter",
          `label=com.docker.compose.project=${app.stack.project}`,
        ])
      )
        .trim()
        .split("\n");
      const rows = JSON.parse(await command("docker", ["volume", "inspect", ...ids])) as {
        Name: string;
        CreatedAt: string;
        Labels: Record<string, string>;
      }[];
      expect(rows).toHaveLength(2);
      return rows
        .map((row) => {
          expect(row.Labels["com.docker.compose.project"]).toBe(app.stack.project);
          return { name: row.Name, createdAt: row.CreatedAt, labels: row.Labels };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    };
    const volumesBefore = await volumeIdentity();
    await app.execute("ordinary-stop", "pnpm", ["stop"], 180_000);
    const stopped = await app.compose(["ps", "--status", "running", "-q"]);
    expect(stopped.trim()).toBe("");
    await app.execute("ordinary-start", "pnpm", ["start"], 600_000);
    await healthyCopies(app, "app-counter", 1);
    const volumesAfter = await volumeIdentity();
    const historyAfter = hash(await readFile(historyPath));
    expect(volumesAfter).toEqual(volumesBefore);
    expect(historyAfter).toBe(historyBefore);
    await app.save("restart-preservation.json", {
      historyBefore,
      historyAfter,
      volumesBefore,
      volumesAfter,
      queued,
      earlier,
    });
    await totalBecomes(app, aggregate, 8);
    expect(await receiptIds(app, aggregate)).toEqual([...earlier, ...queued].sort());
    expect((await submit(app, aggregate, "restart:new")).status).toBe(202);
    await totalBecomes(app, aggregate, 9);
    expect(await receiptIds(app, aggregate)).toEqual([...earlier, ...queued, "restart:new"].sort());
    await queueBecomes(app, 1, 0);
  });
});

test("B04: malformed delivery is terminal, the next event succeeds and the real reader login cannot access private tables", async () => {
  await withApplication("activity", activityTemplates, async (app) => {
    await queueBecomes(app, 1, 0);
    await brokerProbe(app, "malformed");
    const failed = await poll(
      "malformed delivery reaches the exact failed queue",
      () => brokerProbe(app, "failed", `${counterQueue}.failed`),
      (value) => value !== null,
      30_000,
      (value) => app.record(value),
    );
    expect(failed).toEqual({
      messageId: "malformed:one",
      body: '{"aggregateKey":',
      headers: { "x-delivery-attempt": 1, "x-terminal-code": "MALFORMED_MESSAGE" },
    });
    expect(await app.sql("SELECT count(*) FROM increment.receipts")).toBe("0");
    expect(await app.sql("SELECT count(*) FROM increment.totals")).toBe("0");
    expect((await submit(app, "Activity:security", "security:valid")).status).toBe(202);
    await totalBecomes(app, "Activity:security", 1);
    const permissions = await inApplication<{
      user: string;
      published: unknown[];
      denied: { sql: string; code: string }[];
    }>(
      app,
      "app-totals-api",
      `
      import pg from 'pg'; import {readFileSync} from 'node:fs';
      const pool=new pg.Pool({host:'local-postgres',database:'d_totals',user:'r_totals__totals_api',
        password:readFileSync('/run/secrets/sql-totals--totals-api','utf8').trim(),connectionTimeoutMillis:2000,statement_timeout:2000});
      try {
        const user=(await pool.query('SELECT current_user AS name')).rows[0].name;
        const published=(await pool.query('SELECT aggregate_key,total::text FROM increment_public.totals')).rows;
        const denied=[];
        for(const sql of ['SELECT * FROM increment.receipts','SELECT * FROM increment.totals',
          "INSERT INTO increment.totals(aggregate_key,total) VALUES('forbidden',1)",
          "DELETE FROM increment.receipts WHERE event_id='security:valid'"]) {
          try { await pool.query(sql); denied.push({sql,code:'UNEXPECTED_SUCCESS'}); }
          catch(error) { denied.push({sql,code:error.code}); }
        }
        console.log(JSON.stringify({user,published,denied}));
      } finally { await pool.end(); }
    `,
    );
    await app.save("reader-permissions.json", permissions);
    expect(permissions.user).toBe("r_totals__totals_api");
    expect(permissions.published).toEqual([{ aggregate_key: "Activity:security", total: "1" }]);
    expect(permissions.denied.map((row) => row.code)).toEqual(Array(4).fill("42501"));
    expect(await receiptIds(app, "Activity:security")).toEqual(["security:valid"]);
    expect(await app.sql("SELECT aggregate_key||'|'||total FROM increment.totals")).toBe(
      "Activity:security|1",
    );
  });
});

import assert from "node:assert/strict";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test } from "vitest";
import { retentionDesign } from "../../../field-projects/generator-system/fixtures/qr-retention/design.ts";
import { brokerProbe, healthyCopies, serviceContainers } from "../harness/activity.ts";
import { type Application, withApplication } from "../harness/application.ts";
import { faultContainer } from "../harness/faults.ts";
import { poll, repository } from "../harness/process.ts";
import { finish, native } from "../harness/rg-foundations.ts";
import { adoptFresh, publicUpdate } from "../harness/rg-regeneration.ts";

const worker = "app-click-processor";
const topic = "click-events";
const sql = (app: Application, query: string) => app.sql(query, "d_analytics");
const clock = (app: Application, instant: string) =>
  sql(app, `UPDATE test_clock.time SET instant='${instant}'::timestamptz`);
const latest = (app: Application) =>
  sql(
    app,
    "SELECT interval_seconds||'|'||months||'|'||cutoff_day FROM p_click_processor_owner.sweeps ORDER BY observed_at DESC LIMIT 1",
  );
const waitFor = (label: string, action: () => Promise<string>, result: string) =>
  poll(label, action, (value) => value === result, 20000);
const proxyDirectory = (app: Application) => join(app.directory, "../retention-proxy");
const ackMode = (app: Application, holdAck: boolean) =>
  writeFile(join(proxyDirectory(app), "control.json"), JSON.stringify({ holdAck }));

async function provision(app: Application) {
  await mkdir(proxyDirectory(app));
  await ackMode(app, false);
  await copyFile(
    join(repository, "jeeves-generator/integration/harness/rg-provider.mjs"),
    join(proxyDirectory(app), "provider.mjs"),
  );
  await writeFile(
    join(app.directory, "compose.override.yaml"),
    JSON.stringify({
      services: {
        "retention-proxy": {
          image: `${app.stack.project}-app`,
          command: ["node", "/rg/provider.mjs"],
          volumes: ["../retention-proxy:/rg:ro"],
          depends_on: { "local-broker": { condition: "service_healthy" } },
          healthcheck: {
            test: [
              "CMD",
              "node",
              "-e",
              "fetch('http://127.0.0.1:8080/stats').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
            ],
            interval: "1s",
            timeout: "2s",
            retries: 30,
          },
        },
        [worker]: {
          environment: { JEEVES_BROKER_HOST: "retention-proxy", JEEVES_BROKER_PORT: "5673" },
          depends_on: { "retention-proxy": { condition: "service_healthy" } },
        },
      },
    }),
  );
}

async function workerCopies(app: Application) {
  await app.compose(["up", "-d", "--no-deps", "--scale", `${worker}=2`, worker]);
  return healthyCopies(app, worker, 2);
}

async function version(app: Application, options: Parameters<typeof retentionDesign>[0]) {
  const source = join(app.directory, "../variant.json");
  await writeFile(source, JSON.stringify(retentionDesign(options)));
  const name = `retention-${options?.replayDays ?? 31}-${options?.receiptDays ?? 35}-${options?.keepDailyTotalsMonths ?? 13}-${options?.intervalSeconds ?? 60}`;
  await publicUpdate(app, source, name);
  await adoptFresh(app, source, name);
  await app.compose(
    ["up", "-d", "--build", "--force-recreate", "--no-deps", "--scale", `${worker}=2`, worker],
    180000,
  );
  await healthyCopies(app, worker, 2);
}

async function publish(app: Application, queue: string, id: string, payload: object) {
  const copy = (await serviceContainers(app, worker)).find(
    (entry) => entry.State.Status === "running",
  );
  assert(copy);
  return native<{ confirmed: boolean }>(
    app,
    worker,
    `
import amqp from 'amqplib';
import {readSecret} from './dist/runtime/local.js';
const connection=await amqp.connect({hostname:'local-broker',username:'runtime',password:readSecret('broker-password'),heartbeat:10});
try {
  const channel=await connection.createConfirmChannel();
  channel.sendToQueue(${JSON.stringify(queue)}, Buffer.from(${JSON.stringify(JSON.stringify(payload))}), {persistent:true,messageId:${JSON.stringify(id)},contentType:'application/json'});
  await channel.waitForConfirms();
  await channel.close();
  ${finish("{confirmed:true}")}
} finally { await connection.close(); }
`,
    copy.Id,
  );
}

const stats = (app: Application) =>
  native<{ acks: { from: string; held: boolean }[] }>(
    app,
    worker,
    `const result=await(await fetch('http://retention-proxy:8080/stats')).json();${finish("result")}`,
  );
const policy = (app: Application, id: string) =>
  sql(
    app,
    `SELECT extract(epoch FROM retain_until-completed_at)::int FROM jeeves.consumer_receipts WHERE event_id='${id}'`,
  );
const total = (app: Application, day: string) =>
  sql(app, `SELECT coalesce(sum(total),0) FROM p_click_processor_owner.daily WHERE day='${day}'`);

test("QR retention: native two-copy receipts and idle UTC cleanup across policy changes", async () => {
  await withApplication(
    "qr-retention",
    ["module-stub", "scheduled-task"],
    async (app) => {
      const loop = app.report.processes?.tiles
        .find((tile) => tile.tile === "click-processor")
        ?.loops.find((row) => row.module === "aggregate-click");
      assert(loop);
      const queue = loop.queue;
      const failedQueue = `${queue}.failed`;
      expect(queue).toContain(topic);
      // Keep the generated SQL intact. Only this isolated database resolves the test clock function
      // before the builtin, on new connections. Framework and product transaction roles can read it.
      await sql(
        app,
        `
      CREATE SCHEMA test_clock;
      CREATE TABLE test_clock.time(instant timestamptz NOT NULL);
      INSERT INTO test_clock.time VALUES('2026-12-31T23:59:00Z');
      CREATE FUNCTION test_clock.clock_timestamp() RETURNS timestamptz
        LANGUAGE sql STABLE AS 'SELECT instant FROM test_clock.time';
      GRANT USAGE ON SCHEMA test_clock TO PUBLIC;
      GRANT SELECT ON test_clock.time TO PUBLIC;
      ALTER DATABASE d_analytics SET search_path = test_clock, pg_catalog, public;
      ALTER DATABASE d_analytics SET TimeZone = 'Pacific/Kiritimati';
      ALTER TABLE jeeves.work_records ALTER COLUMN next_attempt_at SET DEFAULT test_clock.clock_timestamp();
    `,
      );
      await app.compose(["restart", worker]);
      const copies = await workerCopies(app);
      await waitFor("month-end cutoff from the clock", () => latest(app), "60|13|2025-11-30");
      await ackMode(app, true);
      const firstClick = { day: "2026-12-31", agent: "mobile" };
      expect(await publish(app, queue, "click-one", firstClick)).toEqual({ confirmed: true });
      const held = await poll(
        "real AMQP acknowledgement withheld",
        () => stats(app),
        (r) => r.acks.some((a) => a.held),
        15000,
      );
      expect(await policy(app, "click-one")).toBe("3024000");
      expect(await total(app, firstClick.day)).toBe("1");
      expect(
        await sql(
          app,
          "SELECT total FROM p_click_processor_owner.breakdowns WHERE day='2026-12-31' AND agent='mobile'",
        ),
      ).toBe("1");
      const ack = held.acks.find((row) => row.held);
      const hit = copies.find((copy) =>
        Object.values(copy.NetworkSettings.Networks).some(
          (network) => network.IPAddress === ack?.from.replace("::ffff:", ""),
        ),
      );
      assert(hit);
      const beforeLoss = await brokerProbe(app, "state", queue);
      expect(beforeLoss).toMatchObject({ unacknowledged: 1, consumerCount: 2 });
      await ackMode(app, false);
      await faultContainer(app, worker, hit.Id, "kill");
      await poll(
        "second copy acknowledges the redelivery",
        () => brokerProbe(app, "state", queue),
        (state) =>
          !!state &&
          "unacknowledged" in state &&
          state.messageCount === 0 &&
          state.unacknowledged === 0,
        20000,
      );
      expect(await total(app, firstClick.day)).toBe("1");
      await faultContainer(app, worker, hit.Id, "start");
      await healthyCopies(app, worker, 2);
      app.record({
        phase: "lost acknowledgement",
        receiverCopies: copies.map((copy) => copy.Id),
        beforeLoss,
        aggregate: 1,
        receiptSeconds: 3024000,
      });

      expect(
        await publish(app, queue, "atomic-rejected", {
          day: "2027-01-02",
          agent: "mobile",
          rejectBreakdown: true,
        }),
      ).toEqual({ confirmed: true });
      await poll(
        "failed effect reaches quarantine",
        () => brokerProbe(app, "state", failedQueue),
        (state) => !!state && "messageCount" in state && state.messageCount === 1,
        25000,
      );
      expect(await total(app, "2027-01-02")).toBe("0");
      expect(await policy(app, "atomic-rejected")).toBe("");
      app.record({ phase: "atomic rollback", aggregate: 0, receipts: 0 });

      await sql(
        app,
        `
      INSERT INTO p_click_processor_owner.daily(day,total)
      VALUES ('2025-11-30',10), ('2025-12-01',10), ('2025-12-02',10), ('2026-01-02',10);
      INSERT INTO p_click_processor_owner.breakdowns(day,agent,total)
      VALUES ('2025-11-30','idle',10), ('2025-12-01','idle',10), ('2025-12-02','idle',10), ('2026-01-02','idle',10);
    `,
      );
      await clock(app, "2027-01-01T00:00:00Z");
      await waitFor("new year UTC cutoff", () => latest(app), "60|13|2025-12-01");
      expect(
        await sql(
          app,
          "SELECT string_agg(to_char(day,'YYYY-MM-DD'),',' ORDER BY day) FROM p_click_processor_owner.daily",
        ),
      ).toBe("2025-12-01,2025-12-02,2026-01-02,2026-12-31");
      expect(
        await sql(
          app,
          "SELECT string_agg(to_char(day,'YYYY-MM-DD'),',' ORDER BY day) FROM p_click_processor_owner.breakdowns",
        ),
      ).toBe("2025-12-01,2025-12-02,2026-01-02,2026-12-31");
      expect(await policy(app, "click-one")).toBe("3024000");
      app.record({
        phase: "idle cleanup",
        monthEndCutoff: "2025-11-30",
        newYearCutoff: "2025-12-01",
        boundarySurvived: true,
        breakdownsMatched: true,
        receiptsUnchanged: true,
      });

      await clock(app, "2027-01-31T23:59:00Z");
      await waitFor("day 31 cutoff", () => latest(app), "60|13|2025-12-31");
      const previous = (await stats(app)).acks.length;
      await publish(app, queue, "click-one", firstClick);
      await poll(
        "day 31 replay leaves one effect",
        () => stats(app),
        (r) => r.acks.length > previous,
      );
      expect(await total(app, firstClick.day)).toBe("1");
      expect(await policy(app, "click-one")).toBe("3024000");
      await publish(app, queue, "exact-replay-window", {
        day: "2027-01-31",
        agent: "web",
        verifiedAgeSeconds: 2678400,
      });
      await waitFor("31-day age accepted", () => policy(app, "exact-replay-window"), "3024000");
      app.record({
        phase: "day 31 replay",
        originalTotal: 1,
        verifiedAgeSeconds: 2678400,
        originalReceiptRetained: true,
      });

      await version(app, { replayDays: 30 });
      await publish(app, queue, "above-new-replay", {
        day: "2027-02-01",
        agent: "web",
        verifiedAgeSeconds: 2678400,
      });
      await poll(
        "shorter replay rejects the formerly admitted age",
        () => brokerProbe(app, "state", failedQueue),
        (state) => !!state && "messageCount" in state && state.messageCount === 2,
        20000,
      );
      expect(await policy(app, "above-new-replay")).toBe("");
      await publish(app, queue, "new-replay-boundary", {
        day: "2027-02-01",
        agent: "web",
        verifiedAgeSeconds: 2592000,
      });
      await waitFor(
        "changing only replay keeps 35-day receipts",
        () => policy(app, "new-replay-boundary"),
        "3024000",
      );
      await version(app, { replayDays: 30, receiptDays: 30 });
      await publish(app, queue, "shorter-receipt", { day: "2027-02-01", agent: "mobile" });
      await waitFor(
        "new receipt expires after 30 days",
        () => policy(app, "shorter-receipt"),
        "2592000",
      );
      expect(await policy(app, "click-one")).toBe("3024000");

      await version(app, { replayDays: 30, receiptDays: 30, keepDailyTotalsMonths: 12 });
      await clock(app, "2027-02-01T00:00:00Z");
      await waitFor(
        "changing only months changes product deletion",
        () => latest(app),
        "60|12|2026-02-01",
      );
      expect(await total(app, "2026-01-02")).toBe("0");
      expect(await total(app, firstClick.day)).toBe("1");
      expect(await policy(app, "click-one")).toBe("3024000");
      await version(app, {
        replayDays: 30,
        receiptDays: 30,
        keepDailyTotalsMonths: 12,
        intervalSeconds: 120,
      });
      await waitFor(
        "changing only interval preserves cutoff",
        () => latest(app),
        "120|12|2026-02-01",
      );
      const countTicks = await sql(app, "SELECT count(*) FROM p_click_processor_owner.sweeps");
      await clock(app, "2027-02-01T00:01:00Z");
      // Let more than two scheduler polls run while the database is still in the same bucket.
      await delay(2500);
      expect(await sql(app, "SELECT count(*) FROM p_click_processor_owner.sweeps")).toBe(
        countTicks,
      );
      await clock(app, "2027-02-01T00:02:00Z");
      await waitFor(
        "next 120-second bucket runs",
        () => sql(app, "SELECT count(*) FROM p_click_processor_owner.sweeps"),
        String(Number(countTicks) + 1),
      );
      app.record({
        phase: "independent edits",
        replayBeforeDays: 31,
        replayAfterDays: 30,
        newReceiptSeconds: 2592000,
        previousReceiptSeconds: 3024000,
        newCutoff: "2026-02-01",
        intervalSeconds: 120,
      });

      const deadline = "2027-02-04T23:59:00Z";
      expect(
        await sql(
          app,
          `SELECT retain_until = '${deadline}'::timestamptz FROM jeeves.consumer_receipts WHERE event_id='click-one'`,
        ),
      ).toBe("t");
      await clock(app, deadline);
      await app.compose(["restart", worker]);
      await healthyCopies(app, worker, 2);
      expect(await policy(app, "click-one")).toBe("3024000");
      await clock(app, "2027-02-04T23:59:00.000001Z");
      await waitFor(
        "receipt cleanup after the promised exact deadline",
        () => policy(app, "click-one"),
        "",
      );
      expect(await policy(app, "shorter-receipt")).toBe("2592000");
      expect(await total(app, firstClick.day)).toBe("1");
      app.record({
        phase: "exact receipt expiry",
        expiry: deadline,
        retainedAtExpiry: true,
        sweptAt: "2027-02-04T23:59:00.000001Z",
        receiptGone: true,
        aggregateRetained: true,
      });
    },
    "design.json",
    { beforeStart: provision },
  );
}, 360000);

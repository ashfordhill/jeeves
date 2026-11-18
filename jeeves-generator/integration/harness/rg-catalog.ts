import assert from "node:assert/strict";
import { createHmac, hkdfSync, randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";
import { brokerProbe, healthyCopies, serviceContainers } from "./activity.ts";
import { type Application, withApplication } from "./application.ts";
import { rememberSecrets } from "./evidence.ts";
import { faultContainer, SqlSession } from "./faults.ts";
import { command, poll, repository } from "./process.ts";
import { finish, native } from "./rg-foundations.ts";

import { prepareTransactionPooler, verifyTransactionPooler } from "./wd-pooler.ts";

const infra = (app: Application) => join(app.directory, "../rg-catalog-infra");
async function control(app: Application, patch: Record<string, boolean>) {
  const path = join(infra(app), "control.json");
  await writeFile(path, JSON.stringify({ ...JSON.parse(await readFile(path, "utf8")), ...patch }));
}
async function prepare(app: Application) {
  await mkdir(infra(app));
  const key = randomBytes(32).toString("base64url"),
    ring = JSON.stringify([{ id: "rg23", key }]);
  await rememberSecrets(app.directory, key, ring);
  await writeFile(join(infra(app), "webhook-ring"), ring, { mode: 0o644 });
  await writeFile(
    join(infra(app), "control.json"),
    JSON.stringify({ holdAck: false, holdExecute: false, holdIngress: false }),
  );
  await copyFile(
    join(repository, "jeeves-generator/integration/harness/rg-provider.mjs"),
    join(infra(app), "provider.mjs"),
  );
  const services = {
    "rg-provider": {
      image: `${app.stack.project}-app`,
      command: ["node", "/rg/provider.mjs"],
      volumes: ["../rg-catalog-infra:/rg:ro"],
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
    "app-caller": {
      environment: {
        JEEVES_TILE_CALLEE_URL: "http://rg-provider:8080",
        JEEVES_DATABASE_CALLER_DB_HOST: "rg-provider",
        JEEVES_DATABASE_CALLER_DB_PORT: "5433",
        JEEVES_SECRET_JEEVES_WEBHOOK_CATALOG_EVENTS_KEYS_FILE: "/rg/webhook-ring",
      },
      volumes: ["../rg-catalog-infra:/rg:ro"],
      depends_on: { "rg-provider": { condition: "service_healthy" } },
    },
    "app-projector": {
      environment: { JEEVES_BROKER_HOST: "rg-provider", JEEVES_BROKER_PORT: "5673" },
      depends_on: { "rg-provider": { condition: "service_healthy" } },
    },
    "setup-migrate": {
      volumes: ["caller-db", "callee-db"].flatMap((db) => [
        `./infra/postgres/${db}/products.json:/app/infra/postgres/${db}/products.json:ro`,
        `./infra/postgres/${db}/products:/app/infra/postgres/${db}/products:ro`,
      ]),
    },
  };
  await writeFile(
    join(app.directory, "compose.override.yaml"),
    JSON.stringify({ services }, null, 2),
  );
  await prepareTransactionPooler(app);
}
type ProxyStats = {
  commits: { released: boolean; from: string }[];
  events: { phase: string; key: string; from: string; status: number | null }[];
  acks: { from: string; held: boolean }[];
  ingress: number;
};
const stats = async (app: Application) => {
  const result = await native<ProxyStats>(
    app,
    "app-callee",
    `const result=await(await fetch('http://rg-provider:8080/stats')).json();${finish("result")}`,
  );
  app.record({ proxy: result });
  return result;
};
const count = (app: Application, table: string, id: string) =>
  app.sql(`SELECT count(*) FROM p_caller_owner.${table} WHERE id='${id}'`, "d_caller_db");
const effects = (
  app: Application,
  table: string,
  id: string,
  database = "d_caller_db",
  schema = "p_caller_owner",
) => app.sql(`SELECT effects FROM ${schema}.${table} WHERE id='${id}'`, database);
const waitRow = (app: Application, sql: string, expected: string, timeoutMs = 45000) =>
  poll(
    expected,
    () => app.sql(sql, "d_caller_db"),
    (value) => value === expected,
    timeoutMs,
  );
async function send(app: Application, id: string, title = id) {
  return native<{ status: number }>(
    app,
    "app-callee",
    `const r=await fetch('http://app-caller:3000/modules/send',{method:'POST',headers:{'content-type':'application/json','idempotency-key':${JSON.stringify(id)}},body:JSON.stringify({id:${JSON.stringify(id)},title:${JSON.stringify(title)}})});await r.arrayBuffer();${finish("{status:r.status}")}`,
  );
}
async function webhook(
  app: Application,
  id: string,
  type = "catalog.changed",
  title = id,
  viaProxy = false,
) {
  const ring = JSON.parse(await readFile(join(infra(app), "webhook-ring"), "utf8"));
  const raw = JSON.stringify({ id, type, payload: { id, title } }),
    timestamp = String(Math.floor(Date.now() / 1000));
  const signing = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(ring[0].key, "base64url"),
      "jeeves.keys.v1",
      '["sign","jeeves.webhook.v1"]',
      32,
    ),
  );
  const signature = `v1=${createHmac("sha256", signing).update(`jeeves-webhook-v1\ncatalog-events\n${timestamp}\n`).update(raw).digest("hex")}`;
  return native<{ status: number }>(
    app,
    "app-callee",
    `const r=await fetch(${JSON.stringify(viaProxy ? "http://rg-provider:8080/inbox" : "http://app-caller:3000/modules/catalog-events")},{method:'POST',headers:{'content-type':'application/json','x-jeeves-timestamp':${JSON.stringify(timestamp)},'x-jeeves-signature':${JSON.stringify(signature)}},body:${JSON.stringify(raw)}});await r.arrayBuffer();${finish("{status:r.status}")}`,
  );
}
async function publish(app: Application, id: string, date: string) {
  const worker = (await serviceContainers(app, "app-projector")).find(
    (row) => row.State.Status === "running",
  );
  assert(worker);
  return native<{ confirmed: boolean }>(
    app,
    "app-projector",
    `import amqp from 'amqplib';import {readSecret} from './dist/runtime/local.js';const connection=await amqp.connect({hostname:'local-broker',username:'runtime',password:readSecret('broker-password'),heartbeat:10});try{const channel=await connection.createConfirmChannel();channel.sendToQueue('events',Buffer.from(JSON.stringify({id:'video-one',title:'Catalog video',date:${JSON.stringify(date)}})),{persistent:true,messageId:${JSON.stringify(id)},contentType:'application/json'});await channel.waitForConfirms();await channel.close();${finish("{confirmed:true}")}}finally{await connection.close();}`,
    worker.Id,
  );
}

/** Reuse this test-owned setup/protocol in the bounded regeneration checkpoint. */
export const catalogUpdateTools = { prepare, control, stats, send, webhook };
/** Test-only native probe of the emitted store, actual compiled hook, scoped SQL and real logins.
 * Retain an opaque old claim across OS pause; completion receives a fresh runtime context. */
async function fenceProbe(app: Application, container: string, hold: boolean) {
  return native<{ code: string; identity: string }>(
    app,
    "app-caller",
    `
import {readFileSync} from 'node:fs';
import * as Product from './dist/modules/caller/catalog-events.js';
import {webhookWorkEngine} from './dist/runtime/webhook.js';
import {prepareProductDatabase} from './dist/runtime/module-clients.js';
import {createPostgres} from './dist/runtime/postgres.js';
import {createWorkStore} from './dist/runtime/durable-work.js';
import {operation,withOperation} from './dist/runtime/operation.js';
const prepared=prepareProductDatabase({tile:'caller',resource:'caller-db',module:'catalog-events',property:'callerDb',writable:true,work:webhookWorkEngine(Product.durableWork),owner:'caller-owner'});
const pool=createPostgres({...prepared.configuration,login:prepared.runtimeLogin});pool.on('error',()=>{});
const store=createWorkStore({namespace:'["caller-db","caller-owner","rg23-fence-proof"]',process:'caller',definition:prepared.work.definition,pool,productRole:prepared.configuration.login.user,commands:prepared.operations});
const run=async effect=>{const execution=operation({maximumMs:5000});try{return await withOperation(execution.context,effect);}finally{execution.close();}};
try{
 if(${hold})await run(()=>store.accept('{}','fence-one',{id:'fence-one',type:'catalog.changed',payload:{id:'fenced-catalog',title:'Fenced catalog'},contentHash:'0'.repeat(64)}));
 const [claim]=await run(()=>store.claim(1));if(!claim)throw Error('Native opaque claim missing');
 if(${hold})while(!JSON.parse(readFileSync('/rg/control.json','utf8')).resumeFence)await new Promise(resolve=>setTimeout(resolve,25));
 let code='COMPLETED';try{await run(()=>store.complete(claim));}catch(error){code=error.code??error.name;}
 ${finish("{code,identity:claim.identity}")}
}finally{await pool.end();}
`,
    container,
    90000,
  );
}

export async function catalogScenario() {
  await withApplication(
    "rg-catalog-flow",
    ["module-stub", "module-stub", "webhook-receiver", "module-stub"],
    async (app) => {
      const receiptsOnly = process.env.JEEVES_RG23_CASES === "receipts";
      const previouslyProved = [
        "HMAC durable acceptance survives process death",
        "paused stale holder and stable remote identity",
        "fresh-context stale fence rejection",
      ];
      await app.save("selected-cases.json", {
        mode: receiptsOnly ? "receipt/retention/broker targeted" : "all",
        notRerun: receiptsOnly ? previouslyProved : [],
        priorEvidence: receiptsOnly ? "native-5/2-rg-catalog-flow/named-assertions.json" : null,
      });
      const assertions: { name: string; expected: string; outcome: string; actual?: unknown }[] =
        [];
      const check = async (name: string, expected: string, run: () => Promise<unknown>) => {
        if (receiptsOnly && previouslyProved.includes(name)) return;
        const row = { name, expected, outcome: "running" } as (typeof assertions)[number];
        assertions.push(row);
        try {
          row.actual = await run();
          row.outcome = "passed";
        } catch (error) {
          row.outcome = "failed";
          throw error;
        } finally {
          await app.save("named-assertions.json", assertions);
        }
      };
      await app.compose([
        "up",
        "-d",
        "--no-deps",
        "--scale",
        "app-caller=2",
        "--scale",
        "app-projector=2",
        "app-caller",
        "app-projector",
      ]);
      let api = await healthyCopies(app, "app-caller", 2);
      const workers = await healthyCopies(app, "app-projector", 2);
      await app.save("independent-copies.json", {
        api: api.map((r) => r.Id),
        workers: workers.map((r) => r.Id),
      });
      await verifyTransactionPooler(app, "app-caller");
      await check(
        "HMAC durable acceptance survives process death",
        "stored work exists while ACK withheld; another same Service processor completes once; changed content409, terminal failure visible",
        async () => {
          const old = api[0],
            replacement = api[1];
          assert(old && replacement);
          await faultContainer(app, "app-caller", replacement.Id, "stop");
          const lock = await SqlSession.open(app, "d_caller_db", "inbox-product-lock");
          const acceptance = await SqlSession.open(app, "d_caller_db", "inbox-acceptance-gate");
          let response: Promise<{ status: number }> | undefined;
          try {
            await lock.run("BEGIN; LOCK TABLE p_caller_owner.inbox IN ACCESS EXCLUSIVE MODE;");
            await acceptance.run("BEGIN; LOCK TABLE jeeves.work_records IN ACCESS EXCLUSIVE MODE;");
            await control(app, { holdIngress: true, holdCommit: true });
            response = webhook(app, "inbox-one", "catalog.changed", "Webhook catalog", true);
            void response.catch(() => {});
            let acknowledged = false;
            void response.then(() => {
              acknowledged = true;
            });
            await poll(
              "actual acceptance INSERT waits on owned SQL gate",
              () =>
                app.sql(
                  "SELECT count(*) FROM pg_stat_activity WHERE datname='d_caller_db' AND wait_event_type='Lock' AND query LIKE 'INSERT INTO jeeves.work_records%'",
                  "d_caller_db",
                ),
              (value) => Number(value) > 0,
              4000,
            );
            const blocked = (await stats(app)).events.filter((e) => e.phase === "ingress");
            expect(blocked).toHaveLength(1);
            expect(blocked[0]?.status).toBeNull();
            expect(acknowledged).toBe(false);
            await acceptance.run("COMMIT;");
            await poll(
              "actual acceptance COMMIT held before database dispatch",
              () => stats(app),
              (value) => value.commits.some((c) => !c.released),
              4000,
            );
            expect(
              await app.sql(
                "SELECT count(*) FROM jeeves.work_records WHERE work_key='inbox-one'",
                "d_caller_db",
              ),
            ).toBe("0");
            expect(
              (await stats(app)).events.filter((e) => e.phase === "ingress")[0]?.status,
            ).toBeNull();
            expect(acknowledged).toBe(false);
            const ackBeforeCommit = acknowledged;
            await control(app, { holdCommit: false });
            await waitRow(
              app,
              "SELECT count(*) FROM jeeves.work_records WHERE work_key='inbox-one'",
              "1",
            );
            await poll(
              "real upstream202 observed after committed acceptance",
              () => stats(app),
              (value) => value.events.some((e) => e.phase === "ingress" && e.status === 202),
              4000,
            );
            expect(acknowledged).toBe(false);
            const persisted = await app.sql(
              "SELECT state FROM jeeves.work_records WHERE work_key='inbox-one'",
              "d_caller_db",
            );
            await faultContainer(app, "app-caller", old.Id, "kill");
            await control(app, { holdIngress: false });
            expect((await response).status).toBe(202);
            await lock.run("COMMIT;");
            await faultContainer(app, "app-caller", replacement.Id, "start");
            await waitRow(
              app,
              "SELECT state FROM jeeves.work_records WHERE work_key='inbox-one'",
              "completed",
            );
            expect(await count(app, "inbox", "inbox-one")).toBe("1");
            expect(
              (await webhook(app, "inbox-one", "catalog.changed", "Webhook catalog")).status,
            ).toBe(202);
            expect(
              (await webhook(app, "inbox-one", "catalog.changed", "Changed catalog")).status,
            ).toBe(409);
            expect(await effects(app, "inbox", "inbox-one")).toBe("1");
            expect((await webhook(app, "terminal-one", "catalog.failed")).status).toBe(202);
            await waitRow(
              app,
              "SELECT state||'|'||error FROM jeeves.work_records WHERE work_key='terminal-one'",
              "failed|WORK_ATTEMPTS_EXHAUSTED",
            );
            await faultContainer(app, "app-caller", old.Id, "start");
            api = await healthyCopies(app, "app-caller", 2);
            return {
              acceptanceInsertBlocked: true,
              upstream202BeforeAcceptance: false,
              upstream202BeforeCommit: false,
              persistedBeforeAck: persisted,
              acknowledgedBeforeCommit: ackBeforeCommit,
              old: old.Id,
              replacement: replacement.Id,
              effects: 1,
              duplicate: 202,
              conflict: 409,
              terminal: "failed",
            };
          } finally {
            await control(app, { holdIngress: false, holdCommit: false });
            await acceptance.close();
            await lock.close();
          }
        },
      );
      await check(
        "paused stale holder and stable remote identity",
        "lease expires with first process paused; second executes same selected ticket/identity; old completion/product mutation refused",
        async () => {
          await control(app, { holdExecute: true });
          expect((await send(app, "replicate-one", "Native catalog")).status).toBe(202);
          const observed = await poll(
            "actual remote execute committed behind held reply",
            () => stats(app),
            (s) => s.events.some((e) => e.phase === "execute" && e.status === 200),
            15000,
          );
          const first = observed.events.find((e) => e.phase === "execute");
          assert(first);
          const old = api.find((row) =>
            Object.values(row.NetworkSettings.Networks).some(
              (n) => n.IPAddress === first.from.replace("::ffff:", ""),
            ),
          );
          assert(old, "request belongs to a real generated API copy");
          const other = api.find((row) => row.Id !== old.Id);
          assert(other);
          const before = await app.sql(
            "SELECT fence||'|'||work_id FROM jeeves.work_records WHERE work_key='replicate-one'",
            "d_caller_db",
          );
          expect(
            await app.sql(
              "SELECT count(*) FROM p_callee_owner.items WHERE id='replicate-one'",
              "d_callee_db",
            ),
          ).toBe("1");
          const oldDeadline = await app.sql(
            "SELECT lease_until::text FROM jeeves.work_records WHERE work_key='replicate-one'",
            "d_caller_db",
          );
          await faultContainer(app, "app-caller", old.Id, "pause");
          try {
            await waitRow(
              app,
              `SELECT (clock_timestamp()>'${oldDeadline}'::timestamptz)::text`,
              "true",
              35000,
            );
            await control(app, { holdExecute: false });
            await waitRow(
              app,
              "SELECT state FROM jeeves.work_records WHERE work_key='replicate-one'",
              "completed",
              20000,
            );
          } finally {
            await faultContainer(app, "app-caller", old.Id, "unpause");
            await control(app, { holdExecute: false });
          }
          const completed = await app.sql(
            "SELECT fence||'|'||work_id FROM jeeves.work_records WHERE work_key='replicate-one'",
            "d_caller_db",
          );
          expect(Number(completed.split("|")[0])).toBeGreaterThan(Number(before.split("|")[0]));
          expect(completed.split("|")[1]).toBe(before.split("|")[1]);
          await poll(
            "stale holder logged refusal",
            () => command("docker", ["logs", "--tail", "100", old.Id]),
            (s) =>
              s
                .split("\n")
                .some(
                  (line) =>
                    line.includes('"operation":"catalog-replicate"') &&
                    ["work lease lost", "work outcome unknown", "work storage unavailable"].some(
                      (name) => line.includes(name),
                    ),
                ),
            12000,
          );
          const final = await stats(app);
          const executes = final.events.filter((e) => e.phase === "execute");
          expect(executes.length).toBeGreaterThanOrEqual(2);
          expect(new Set(executes.map((e) => e.key)).size).toBe(1);
          expect(final.events.filter((e) => e.phase === "prepare")).toHaveLength(1);
          expect(await effects(app, "items", "replicate-one")).toBe("1");
          expect(
            await effects(app, "items", "replicate-one", "d_callee_db", "p_callee_owner"),
          ).toBe("1");
          expect(await count(app, "items", "replicate-one")).toBe("1");
          expect(
            await app.sql(
              "SELECT count(*) FROM p_callee_owner.items WHERE id='replicate-one'",
              "d_callee_db",
            ),
          ).toBe("1");
          return {
            old: old.Id,
            new: other.Id,
            before,
            completed,
            remoteDispatches: executes.length,
            stableIdentity: executes[0]?.key,
            preparations: 1,
            localEffects: 1,
            remoteEffects: 1,
            staleRefused: true,
          };
        },
      );
      await check(
        "fresh-context stale fence rejection",
        "emitted store uses actual compiled webhook hook/SQL/roles; stale opaque claim cannot invoke non-idempotent product effect after another copy completes",
        async () => {
          const [old, replacement] = api;
          assert(old && replacement);
          await control(app, { resumeFence: false });
          const stale = fenceProbe(app, old.Id, true);
          void stale.catch(() => {});
          await waitRow(
            app,
            "SELECT state||'|'||fence FROM jeeves.work_records WHERE work_key='fence-one'",
            "running|1",
          );
          const until = await app.sql(
            "SELECT lease_until::text FROM jeeves.work_records WHERE work_key='fence-one'",
            "d_caller_db",
          );
          await faultContainer(app, "app-caller", old.Id, "pause");
          let winner: Awaited<ReturnType<typeof fenceProbe>>;
          try {
            await waitRow(
              app,
              `SELECT (clock_timestamp()>'${until}'::timestamptz)::text`,
              "true",
              35000,
            );
            winner = await fenceProbe(app, replacement.Id, false);
            expect(winner.code).toBe("COMPLETED");
          } finally {
            await faultContainer(app, "app-caller", old.Id, "unpause");
            await control(app, { resumeFence: true });
          }
          const loser = await stale;
          expect(loser.code).toBe("WORK_LEASE_LOST");
          expect(loser.identity).toBe(winner.identity);
          expect(await count(app, "inbox", "fence-one")).toBe("1");
          expect(await effects(app, "inbox", "fence-one")).toBe("1");
          return {
            old: old.Id,
            replacement: replacement.Id,
            winner,
            loser,
            freshContext: true,
            nonIdempotentEffects: 1,
          };
        },
      );
      await check(
        "receipt commit precedes ACK and survives redelivery",
        "withheld real AMQP Basic.Ack, committed receipt/effect, kill that consumer, another copy redelivers once; dates cannot bypass ID",
        async () => {
          await control(app, { holdAck: true });
          expect(await publish(app, "delivery-one", "1900-01-01")).toEqual({ confirmed: true });
          const held = await poll(
            "real ACK withheld",
            () => stats(app),
            (s) => s.acks.some((a) => a.held),
            10000,
          );
          const ack = held.acks.find((a) => a.held);
          assert(ack);
          expect(await count(app, "deliveries", "delivery-one")).toBe("1");
          expect(
            await app.sql(
              "SELECT count(*) FROM jeeves.consumer_receipts WHERE event_id='delivery-one' AND result IS NOT NULL AND retain_until>=completed_at+interval '60 seconds'",
              "d_caller_db",
            ),
          ).toBe("1");
          const old = workers.find((row) =>
            Object.values(row.NetworkSettings.Networks).some(
              (n) => n.IPAddress === ack.from.replace("::ffff:", ""),
            ),
          );
          assert(old);
          const before = await brokerProbe(app, "state", "events");
          assert(before && "unacknowledged" in before);
          expect(before.unacknowledged).toBe(1);
          await control(app, { holdAck: false });
          await faultContainer(app, "app-projector", old.Id, "kill");
          await poll(
            "redelivery acknowledged",
            () => brokerProbe(app, "state", "events"),
            (s) => !!s && "unacknowledged" in s && s.unacknowledged === 0 && s.messageCount === 0,
            15000,
          );
          expect(await count(app, "deliveries", "delivery-one")).toBe("1");
          await publish(app, "delivery-one", "2099-12-31");
          await poll(
            "date duplicate acknowledged",
            () => stats(app),
            (s) => s.acks.filter((a) => !a.held).length >= 2,
            10000,
          );
          expect(await count(app, "deliveries", "delivery-one")).toBe("1");
          expect(await effects(app, "deliveries", "delivery-one")).toBe("1");
          await faultContainer(app, "app-projector", old.Id, "start");
          await healthyCopies(app, "app-projector", 2);
          return {
            killed: old.Id,
            unacknowledgedBeforeKill: before.unacknowledged,
            committedReceipt: true,
            effectsAfterRedeliveryAndDateChange: 1,
          };
        },
      );
      await check(
        "retention, idle maintenance and stopped heartbeat",
        "receipt remains before immutable DB deadline then idle indexed cleanup deletes after it; stopped/crashed heartbeat becomes stale while live idle heartbeat advances",
        async () => {
          expect(
            await app.sql(
              "SELECT count(*) FROM jeeves.consumer_receipts WHERE event_id='delivery-one' AND retain_until>clock_timestamp()",
              "d_caller_db",
            ),
          ).toBe("1");
          const deadline = await app.sql(
            "SELECT (retain_until>=completed_at+interval '60 seconds')::text FROM jeeves.consumer_receipts WHERE event_id='delivery-one'",
            "d_caller_db",
          );
          expect(deadline).toBe("true");
          const retainUntil = await app.sql(
            "SELECT retain_until::text FROM jeeves.consumer_receipts WHERE event_id='delivery-one'",
            "d_caller_db",
          );
          const copies = await healthyCopies(app, "app-projector", 2);
          assert(copies[0]);
          await faultContainer(app, "app-projector", copies[0].Id, "stop");
          await waitRow(
            app,
            "SELECT count(*) FROM jeeves.consumer_receipts_workers WHERE state='running' AND in_flight=0 AND heartbeat_at>clock_timestamp()-interval '30 seconds'",
            "1",
          );
          const boundary = await poll(
            "retention boundary reached without early deletion",
            () =>
              app.sql(
                `SELECT (clock_timestamp()>='${retainUntil}'::timestamptz)::text||'|'||(SELECT count(*) FROM jeeves.consumer_receipts WHERE event_id='delivery-one')`,
                "d_caller_db",
              ),
            (value) => value.startsWith("true|") || value.endsWith("|0"),
            80000,
          );
          expect(boundary.startsWith("true|")).toBe(true);
          await waitRow(
            app,
            "SELECT count(*) FROM jeeves.consumer_receipts WHERE event_id='delivery-one'",
            "0",
            20000,
          );
          await waitRow(
            app,
            "SELECT count(*) FROM jeeves.consumer_receipts_workers WHERE heartbeat_at<clock_timestamp()-interval '45 seconds'",
            "2",
            15000,
          );
          expect(
            await app.sql(
              "SELECT count(*) FROM jeeves.consumer_receipts_workers WHERE in_flight=0 AND heartbeat_at>clock_timestamp()-interval '30 seconds'",
              "d_caller_db",
            ),
          ).toBe("1");
          expect(await count(app, "deliveries", "delivery-one")).toBe("1");
          expect(await effects(app, "deliveries", "delivery-one")).toBe("1");
          expect(
            await app.sql(
              "SELECT (last_success_at IS NOT NULL)::text FROM jeeves.consumer_receipts_maintenance",
              "d_caller_db",
            ),
          ).toBe("true");
          return {
            deadlineAtLeast60Seconds: true,
            stoppedOrCrashedStale: 2,
            staleThresholdSeconds: 45,
            idleLive: 1,
            idleCleanup: true,
            retainedProduct: 1,
          };
        },
      );
      await check(
        "native broker stall/drop and recovery",
        "required broker loss removes worker readiness, liveness survives, same copy recovers without restart and processes a fresh receipt",
        async () => {
          const remaining = (await serviceContainers(app, "app-projector")).find(
            (r) => r.State.Status === "running",
          );
          assert(remaining);
          const broker = (await serviceContainers(app, "local-broker"))[0];
          assert(broker);
          const ready = () =>
            native<boolean>(
              app,
              "app-projector",
              `import {existsSync} from 'node:fs';${finish("existsSync('/tmp/application-ready')")}`,
              remaining.Id,
            );
          await faultContainer(app, "local-broker", broker.Id, "pause");
          try {
            await poll("heartbeat detects broker stall", ready, (v) => !v, 35000);
          } finally {
            await faultContainer(app, "local-broker", broker.Id, "unpause");
          }
          await poll("same worker recovers", ready, (v) => v, 25000);
          await faultContainer(app, "local-broker", broker.Id, "stop");
          try {
            await poll("known drop unready", ready, (v) => !v, 15000);
          } finally {
            await faultContainer(app, "local-broker", broker.Id, "start");
          }
          await poll("broker drop recovery", ready, (v) => v, 30000);
          await publish(app, "after-broker", "2026-11-17");
          await waitRow(
            app,
            "SELECT count(*) FROM p_caller_owner.deliveries WHERE id='after-broker'",
            "1",
          );
          expect(
            (await serviceContainers(app, "app-projector")).find((r) => r.Id === remaining.Id)
              ?.State.Status,
          ).toBe("running");
          return {
            worker: remaining.Id,
            broker: broker.Id,
            stallUnready: true,
            dropUnready: true,
            recovered: true,
            effect: 1,
          };
        },
      );
    },
    "design.json",
    { beforeStart: prepare },
  );
}

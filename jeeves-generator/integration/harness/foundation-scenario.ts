import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";
import { controlContainer, healthyCopies, serviceContainers } from "./activity.ts";
import { withApplication } from "./application.ts";
import { SqlSession } from "./faults.ts";
import { IdentityClient } from "./identity.ts";
import { command, hash, poll, repository } from "./process.ts";
import {
  cacheProbe,
  direct,
  finish,
  foundationForward,
  foundationHealth,
  foundationTemplates,
  foundationWorkerReady,
  native,
  prepareFoundation,
  privateScope,
  productPermissions,
} from "./rg-foundations.ts";

import { verifyTransactionPooler } from "./wd-pooler.ts";

export async function foundationScenario(
  options: {
    fixture?: string;
    templates?: string[];
    beforeStart?: (app: import("./application.ts").Application) => Promise<void>;
    extra?: (app: import("./application.ts").Application) => Promise<void>;
  } = {},
) {
  await withApplication(
    options.fixture ?? "rg-foundations",
    options.templates ?? foundationTemplates,
    async (app) => {
      const assertions: {
        name: string;
        expected: string;
        actual?: unknown;
        outcome: string;
      }[] = [];
      async function check(name: string, expected: string, effect: () => Promise<unknown>) {
        const row = {
          name,
          expected,
          outcome: "running",
        } as (typeof assertions)[number];
        assertions.push(row);
        try {
          row.actual = await effect();
          row.outcome = "passed";
        } catch (error) {
          row.outcome = "failed";
          throw error;
        } finally {
          await app.save("named-assertions.json", assertions);
        }
      }
      await app.compose([
        "up",
        "-d",
        "--no-deps",
        "--scale",
        "app-items-api=2",
        "--scale",
        "app-gateway=2",
        "app-items-api",
        "app-gateway",
      ]);
      const api = await healthyCopies(app, "app-items-api", 2);
      const gateways = await healthyCopies(app, "app-gateway", 2);
      const addresses = api.map((row) => Object.values(row.NetworkSettings.Networks)[0]?.IPAddress);
      assert(addresses[0] && addresses[1]);
      const [first, second] = addresses as [string, string];
      const startupHealth = await foundationHealth(app, first);
      expect(startupHealth).toEqual([
        { path: "/livez", status: 200 },
        { path: "/readyz", status: 200 },
      ]);
      app.record({
        healthPhase: "after initialization/startup",
        probes: startupHealth,
      });
      await app.save("independent-copies.json", {
        api: api.map((row) => row.Id),
        gateways: gateways.map((row) => row.Id),
        addresses,
      });
      await verifyTransactionPooler(app, "app-items-api");
      await options.extra?.(app);
      const identity = new IdentityClient(app);
      const accounts = await identity.provision();
      const [accountA, accountB] = accounts;
      assert(accountA && accountB);
      const userA = await identity.signIn(accountA),
        userB = await identity.signIn(accountB);
      const read = (address: string, key: string) =>
        direct(app, address, userA, "/internal/modules/read-record", {
          input: { key },
        });
      const create = (address: string, user: string, key: string, id = key) =>
        direct(app, address, user, "/internal/modules/create", {
          key,
          input: { id },
        });

      await check(
        "authenticated generated calls and independent user identity",
        "Each gateway copy forwards a verified user over its own generated audience-bound workload client; missing either identity refuses",
        async () => {
          for (const gateway of gateways) {
            const result = await native<{ status: number; body: unknown }>(
              app,
              "app-gateway",
              `
const response=await fetch('http://127.0.0.1:3000/modules/forward',{method:'POST',headers:{authorization:'Bearer '+${JSON.stringify(userA)},'content-type':'application/json'},body:JSON.stringify({operation:'read-record',input:{key:'missing'}})});
${finish("{status:response.status,body:await response.json()}")}
`,
              gateway.Id,
            );
            expect(result.status).toBe(404);
          }
          const noWorkload = await direct(app, first, userA, "/internal/modules/create", {
            key: "no-workload",
            input: { id: "no-workload" },
            workload: false,
          });
          const noUser = await direct(app, first, undefined, "/internal/modules/create", {
            key: "no-user",
            input: { id: "no-user" },
          });
          expect(noWorkload.status).toBe(401);
          expect(noUser.status).toBe(401);
          const wrongCaller = await direct(app, first, userA, "/internal/modules/forbidden", {
            input: {},
          });
          expect(wrongCaller.status).toBe(403);
          const userAsWorkload = await native<{ status: number }>(
            app,
            "app-gateway",
            `
const response=await fetch(${JSON.stringify(`http://${first}:3000/internal/modules/create`)},{method:'POST',headers:{authorization:'Bearer '+${JSON.stringify(userA)},'x-jeeves-workload':'Bearer '+${JSON.stringify(userA)},'content-type':'application/json','idempotency-key':'user-is-not-service'},body:'{"id":"user-is-not-service"}'});
${finish("{status:response.status}")}
`,
          );
          expect(userAsWorkload.status).toBe(401);
          for (const path of ["/modules/create", "/modules/record-reader/anything"])
            expect((await direct(app, first, userA, path, { method: "GET" })).status).toBe(404);
          expect((await app.request("/api/items-api/modules/create")).status).toBe(404);
          return {
            gatewayCopies: 2,
            noWorkload: noWorkload.status,
            noUser: noUser.status,
            wrongCaller: wrongCaller.status,
            userAsWorkload: userAsWorkload.status,
            anonymousAliases: 0,
          };
        },
      );

      await check(
        "precise native product and framework credentials",
        "API SELECT/INSERT; same-owner worker SELECT/UPDATE; gateway only named published SELECT; product logins cannot read protected state or assume setup/DDL roles",
        async () => {
          const results = [];
          for (const host of ["items-api", "items-worker", "gateway"]) {
            const result = await productPermissions(app, host);
            const permitted =
              host === "items-api"
                ? ["select-items", "insert-items", "select-records"]
                : host === "items-worker"
                  ? ["select-items", "update-items"]
                  : ["published-view"];
            for (const row of result.outcomes)
              expect(row.code, `${host}/${row.name}`).toBe(
                permitted.includes(row.name) ? "OK" : "42501",
              );
            results.push({ host, ...result });
          }
          const runtime = await native(
            app,
            "app-items-api",
            `
import pg from 'pg';import {readSecret} from './dist/runtime/local.js';import {readdirSync} from 'node:fs';
const client=new pg.Client({host:'local-postgres',database:'d_items_db',user:'r_items_db__items_api',password:readSecret('sql-items-db--items-api'),ssl:false});await client.connect();
let productCode='OK';try{await client.query('SELECT * FROM p_items_api_owner.items');}catch(error){productCode=error.code;}
await client.query("INSERT INTO p_items_api_owner.items(id) VALUES ('framework-allowed')");
const denied=[];for(const sql of ["UPDATE p_items_api_owner.items SET marked=false WHERE id='seed'","DELETE FROM p_items_api_owner.items WHERE id='absent'","CREATE TABLE p_items_api_owner.framework_ddl(id text)"]){try{await client.query(sql);denied.push('OK');}catch(error){denied.push(error.code);}}
const protectedRows=(await client.query('SELECT count(*) FROM jeeves.idempotency_records')).rows[0].count;
await client.query('SET ROLE pr_items_db__items_api');await client.query('BEGIN READ ONLY');let readOnly;
try{await client.query("INSERT INTO p_items_api_owner.items(id) VALUES ('readonly-forbidden')");}catch(error){readOnly=error.code;}
await client.query('ROLLBACK');await client.end();
${finish("{productCode,denied,protectedRows,readOnly,setupMounted:readdirSync('/run/secrets').some(name=>name.includes('owner')||name==='postgres-admin')}")}
`,
          );
          expect(runtime).toMatchObject({
            productCode: "OK",
            denied: ["42501", "42501", "42501"],
            readOnly: "25006",
            setupMounted: false,
          });
          const workerResult = await native(
            app,
            "app-items-worker",
            `
${privateScope}
import {prepareProductDatabase,productDatabaseClient} from './dist/runtime/module-clients.js';
import {workerAccess} from './dist/modules/items-worker/worker-access.js';
const result=await withProcess(scope,async()=>{const db=await productDatabaseClient(scope,()=>{},prepareProductDatabase({tile:'items-worker',resource:'items-db',module:'worker-access',writable:true}));return workerAccess({itemsDb:db,settings:{}},{id:'seed'});});
${finish("result")}
await lifecycle.close();
`,
          );
          expect(workerResult).toMatchObject({
            rows: [{ id: "seed", marked: true }],
            rowCount: 1,
          });
          const ddlOutput = await app.compose([
            "run",
            "--rm",
            "--no-deps",
            "setup-migrate",
            "node",
            "--input-type=module",
            "-e",
            `
import pg from 'pg';import {secret} from './scripts/common.mjs';
const client=new pg.Client({host:'local-postgres',database:'d_items_db',user:'o_items_db',password:secret('owner-items-db'),ssl:false});await client.connect();
const outcomes=[];try{for(const [name,sql] of ${JSON.stringify([
              ["own-namespace-ddl", "CREATE TABLE p_items_api_owner.rg14_ddl_probe(id text)"],
              ["template-table", "SELECT * FROM jeeves.idempotency_records"],
              ["protected-ledger", "DELETE FROM public.jeeves_product_migrations"],
              ["foreign-ddl", "CREATE TABLE public.rg14_forbidden(id text)"],
            ])}){await client.query('BEGIN');await client.query('SET LOCAL ROLE pm_items_db_p_items_api_owner');let code='OK';try{await client.query(sql);}catch(error){code=error.code;}outcomes.push({name,code});await client.query('ROLLBACK');}}finally{await client.end();}
${finish("outcomes")}
`,
          ]);
          const ddlLine = ddlOutput.split("\n").find((line) => line.startsWith("RG14_RESULT="));
          assert(ddlLine);
          const ddl = JSON.parse(ddlLine.slice("RG14_RESULT=".length)) as {
            name: string;
            code: string;
          }[];
          expect(ddl).toEqual([
            { name: "own-namespace-ddl", code: "OK" },
            ...["template-table", "protected-ledger", "foreign-ddl"].map((name) => ({
              name,
              code: "42501",
            })),
          ]);
          return { products: results, runtime, workerResult, ddl };
        },
      );

      await check(
        "concurrent native migration serialization",
        "Two native setup processes compete on unapplied 0002: both succeed, one marker and one exact checksummed ledger entry; rerun skips it and altered history refuses",
        async () => {
          const fixture = join(
            repository,
            "field-projects/generator-system/fixtures/rg-foundations/owned",
          );
          const migration = await readFile(join(fixture, "0002-checkpoint.sql"));
          const migrationPath = join(
            app.directory,
            "infra/postgres/items-db/products/migrations/p_items_api_owner/0002-checkpoint.sql",
          );
          // Product declarations/migrations are application-owned inputs, never template scaffold.
          await writeFile(migrationPath, migration);
          await writeFile(
            join(app.directory, "infra/postgres/items-db/products.json"),
            await readFile(join(fixture, "products-next.json")),
          );
          expect(
            await app.sql(
              "SELECT count(*) FROM public.jeeves_product_migrations WHERE version='0002'",
              "d_items_db",
            ),
          ).toBe("0");
          const results = await Promise.all(
            [1, 2].map(() => app.compose(["run", "--rm", "--no-deps", "setup-migrate"], 60_000)),
          );
          const after = await app.sql(
            "SELECT version||'|'||sha256 FROM public.jeeves_product_migrations WHERE version='0002'",
            "d_items_db",
          );
          expect(results.every((value) => value.includes("Migrations current"))).toBe(true);
          expect(after).toBe(`0002|${hash(migration)}`);
          const marker = await app.sql(
            "SELECT id FROM p_items_api_owner.foundation_checkpoint",
            "d_items_db",
          );
          expect(marker).toBe("applied-once");
          const rerun = await app.compose(["run", "--rm", "--no-deps", "setup-migrate"], 60_000);
          expect(rerun).not.toContain("Applied infra/postgres/items-db/products");
          let checksumRefused = false;
          try {
            await writeFile(
              migrationPath,
              Buffer.concat([migration, Buffer.from("-- altered checksum\n")]),
            );
            await app.compose(["run", "--rm", "--no-deps", "setup-migrate"], 60_000);
          } catch (error) {
            checksumRefused = String(error).includes("differs or is missing");
          } finally {
            await writeFile(migrationPath, migration);
          }
          expect(checksumRefused).toBe(true);
          expect(
            await app.sql(
              "SELECT count(*) FROM p_items_api_owner.foundation_checkpoint",
              "d_items_db",
            ),
          ).toBe("1");
          return {
            processes: 2,
            marker,
            history: after,
            checksumRefused,
            rerunSkipped: true,
          };
        },
      );

      await check(
        "competing replay and atomic admission",
        "One mutation for a shared key; at most two new admissions total across both copies; replay does not spend another slot",
        async () => {
          const result = await native<{
            same: number[];
            burst: number[];
            replay: number[];
          }>(
            app,
            "app-gateway",
            `
${privateScope}
import {createWorkload,workloadSettings} from './dist/runtime/workload.js';
const workload=createWorkload(workloadSettings({identity:'sign-in',client:'jeeves-workload-gateway',audience:'jeeves-service-gateway'}),['items-api']);
const result=await withProcess(scope,async()=>{const token=await workload.acquire('items-api');const targets=${JSON.stringify(addresses)};
const send=async(index,key,id)=>{const response=await fetch('http://'+targets[index%2]+':3000/internal/modules/create',{method:'POST',headers:{authorization:'Bearer '+${JSON.stringify(userA)},'x-jeeves-workload':'Bearer '+token,'content-type':'application/json','idempotency-key':key},body:JSON.stringify({id})});await response.arrayBuffer();return response.status;};
return {same:await Promise.all(Array.from({length:12},(_,i)=>send(i,'replay','replay'))),burst:await Promise.all(Array.from({length:6},(_,i)=>send(i,'burst-'+i,'burst-'+i))),replay:await Promise.all([send(0,'replay','replay'),send(1,'replay','replay')])};});
${finish("result")}
await lifecycle.close();
`,
          );
          expect(result.same.some((status) => status === 201)).toBe(true);
          expect(result.same.every((status) => [201, 409].includes(status))).toBe(true);
          expect(result.burst.filter((status) => status === 201)).toHaveLength(1);
          expect(result.burst.filter((status) => status === 429)).toHaveLength(5);
          expect(result.replay).toEqual([201, 201]);
          expect(
            await app.sql(
              "SELECT count(*) FROM p_items_api_owner.items WHERE id='replay' OR id LIKE 'burst-%'",
              "d_items_db",
            ),
          ).toBe("2");
          expect((await create(first, userA, "replay", "different")).status).toBe(409);
          const cache = await cacheProbe(
            app,
            "admission",
            `${finish("await Promise.all((await client.keys('jeeves:admission:*')).map(async key=>({count:await client.zCard(key),ttl:await client.pTTL(key)})))")}`,
          );
          expect(cache).toEqual([expect.objectContaining({ count: 2 })]);
          return { ...result, cache, productMutations: 2 };
        },
      );

      await check(
        "old version fill fencing and absolute validity",
        "The old native SELECT snapshot finishes after v2 but cannot replace or deliver v1; hits do not renew source validity",
        async () => {
          const until = Date.now() + 30_000;
          await app.sql(
            `INSERT INTO p_items_api_owner.records VALUES('race',jsonb_build_object('key','race','public',true,'version','1','validUntil',${until},'destination','old','gate','old-fill'))`,
            "d_items_db",
          );
          const gate = await SqlSession.open(app, "d_items_db", "rg14-old-fill-gate");
          let newer: Awaited<ReturnType<typeof read>>, older: Awaited<ReturnType<typeof read>>;
          try {
            await gate.run("SELECT pg_advisory_lock(710014);");
            const blocked = () =>
              gate.run(
                "SELECT count(*) FROM pg_stat_activity WHERE datname='d_items_db' AND usename='pr_items_db__items_api' AND wait_event='advisory';",
              );
            const old = read(first, "race");
            await poll(
              "old snapshot blocked at native gate",
              blocked,
              (count) => count === "1",
              5000,
            );
            await gate.run(
              'UPDATE p_items_api_owner.records SET payload=(payload-\'gate\')||\'{"version":"2","destination":"new"}\'::jsonb WHERE key=\'race\';',
            );
            newer = await read(second, "race");
            expect(newer).toMatchObject({
              status: 200,
              body: { version: "2", record: { destination: "new" } },
            });
            const committed = await cacheProbe(
              app,
              "records",
              `${finish("await Promise.all((await client.keys('jeeves:reader:*')).map(async key=>JSON.parse(await client.get(key)).version))")}`,
            );
            expect(committed).toEqual(["2"]);
            expect(await blocked()).toBe("1");
            await gate.run("SELECT pg_advisory_unlock(710014);");
            older = await old;
          } finally {
            await gate.close();
          }
          expect(newer).toMatchObject({
            status: 200,
            body: { version: "2", record: { destination: "new" } },
          });
          expect(older).toMatchObject({
            status: 200,
            body: {
              version: "2",
              record: { destination: "new" },
              source: "cache",
            },
          });
          const expiry = Date.now() + 3500;
          await app.sql(
            `INSERT INTO p_items_api_owner.records VALUES('expires',jsonb_build_object('key','expires','public',true,'version','18446744073709551615','validUntil',${expiry},'destination','finite'))`,
            "d_items_db",
          );
          const fill = await read(first, "expires"),
            hit = await read(second, "expires");
          expect(fill).toMatchObject({
            status: 200,
            body: { validUntil: expiry, version: "18446744073709551615" },
          });
          expect(hit).toMatchObject({
            status: 200,
            body: { validUntil: expiry, source: "cache" },
          });
          await poll(
            "absolute source bound passed",
            async () => Date.now(),
            (now) => now >= expiry,
            5000,
          );
          expect((await read(second, "expires")).status).toBe(404);
          const stored = await cacheProbe(
            app,
            "records",
            `${finish("await Promise.all((await client.keys('jeeves:reader:*')).map(async key=>JSON.parse(await client.get(key))))")}`,
          );
          expect(stored).toEqual([expect.objectContaining({ version: "2" })]);
          return { older, newer, fill, hit, expiredStatus: 404, stored };
        },
      );

      await check(
        "native pending bound and unknown cache mutation",
        "32 actual pending commands fit, the 33rd refuses without reconnect; a lost mutation reply remains unknown and never retries",
        async () => {
          const result = await native(
            app,
            "app-items-api",
            `
${privateScope}
import {createValkeyCache} from './dist/runtime/valkey.js';import {readSecret} from './dist/runtime/local.js';import {createClient} from 'redis';
const result=await withProcess(scope,async()=>{const states=[];const cache=await createValkeyCache({binding:{hostname:'cache-records',port:6379,secret:'cache-records',tls:{mode:'disable'}},onState:state=>states.push(state)});scope.own(()=>cache.close());
const control=createClient({password:readSecret('cache-records'),socket:{host:'cache-records',port:6379,reconnectStrategy:false}});control.on('error',()=>{});await control.connect();
// Dispatch all32 synchronously before yielding to socket responses; no server-timer precondition.
try{const pending=Array.from({length:32},()=>cache.get('pending-probe'));let saturation;try{await cache.get('pending-probe');}catch(error){saturation={code:error.code,outcome:error.outcome};}
const settled=await Promise.allSettled(pending),survived=await cache.ping();const statesAfterSaturation=[...states];
await control.sendCommand(['CLIENT','PAUSE','400','ALL']);let unknown;try{await cache.admit('jeeves:rg14:unknown',{limit:2,windowMs:60000});}catch(error){unknown={code:error.code,outcome:error.outcome};}
await new Promise(done=>setTimeout(done,500));const count=await control.zCard('jeeves:rg14:unknown');return {saturation,fulfilled:settled.filter(value=>value.status==='fulfilled').length,survived,statesAfterSaturation,unknown,count};}finally{control.destroy();}});
${finish("result")}
await lifecycle.close();
`,
          );
          expect(result).toMatchObject({
            saturation: { code: "CACHE_SATURATED", outcome: "refused" },
            fulfilled: 32,
            survived: "PONG",
            statesAfterSaturation: ["available"],
            unknown: { outcome: "unknown" },
          });
          expect((result as { count: number }).count).toBeLessThanOrEqual(1);
          const localUnknown = await native(
            app,
            "app-items-api",
            `
${privateScope}
import {createClient} from 'redis';import {readSecret} from './dist/runtime/local.js';
import {createValkeyCache} from './dist/runtime/valkey.js';import {createRateLimiter} from './dist/runtime/rate-limiter.js';
import {prepareProductDatabase,productDatabaseClient} from './dist/runtime/module-clients.js';import {localOperation} from './dist/modules/items-api/create.js';
const result=await withProcess(scope,async()=>{
 const cache=await createValkeyCache({binding:{hostname:'cache-admission',port:6379,secret:'cache-admission',tls:{mode:'disable'}}});scope.own(()=>cache.close());
 const limiter=createRateLimiter({process:'items-api',module:'create-limit',limit:2,windowSeconds:60,cache,hooks:{key:caller=>caller.subject}});
 const db=await productDatabaseClient(scope,()=>{},prepareProductDatabase({tile:'items-api',resource:'items-db',module:'create',property:'itemsDb',writable:true,operation:localOperation}));
 const control=createClient({password:readSecret('cache-admission'),socket:{host:'cache-admission',port:6379,reconnectStrategy:false}});control.on('error',()=>{});await control.connect();
 const context=operation({maximumMs:3000,caller:{subject:${JSON.stringify(accountB.subject)}}});
 try{await control.sendCommand(['CLIENT','PAUSE','400','ALL']);await withOperation(context.context,()=>localOperation.call({itemsDb:db,createLimit:limiter,settings:{}},{key:'unknown-admission',input:{id:'unknown-admission'}}));return {unexpectedSuccess:true};}
 catch(error){return {code:error.code,status:error.statusCode,outcome:error.outcome};}
 finally{context.close();control.destroy();}
});
${finish("result")}
await lifecycle.close();
`,
          );
          expect(localUnknown).toEqual({
            code: "RATE_LIMIT_UNKNOWN",
            status: 503,
            outcome: "unknown",
          });
          expect(
            await app.sql(
              "SELECT count(*) FROM p_items_api_owner.items WHERE id='unknown-admission'",
              "d_items_db",
            ),
          ).toBe("0");
          expect(
            await app.sql(
              "SELECT count(*) FROM jeeves.idempotency_records WHERE idem_key='unknown-admission'",
              "d_items_db",
            ),
          ).toBe("0");
          return { cache: result, localUnknown, localProductEffects: 0 };
        },
      );

      await check(
        "native lost COMMIT response and durable sealed replay",
        "A TCP proxy drops the actual PostgreSQL COMMIT reply; the caller reports unknown and the other service copy recovers exactly one sealed mutation",
        async () => {
          const result = await native(
            app,
            "app-items-api",
            `
${privateScope}
import net from 'node:net';import {prepareProductDatabase,productDatabaseClient} from './dist/runtime/module-clients.js';
import {localOperation} from './dist/modules/items-api/create.js';import {createValkeyCache} from './dist/runtime/valkey.js';import {createRateLimiter} from './dist/runtime/rate-limiter.js';
let dropped=0;const upstreamHost=process.env.JEEVES_DATABASE_ITEMS_DB_HOST??'local-postgres',upstreamPort=Number(process.env.JEEVES_DATABASE_ITEMS_DB_PORT??5432);
const server=net.createServer(down=>{const up=net.connect(upstreamPort,upstreamHost);let commit=false,mutation=false;let reply=Buffer.alloc(0);down.on('error',()=>{});up.on('error',()=>down.destroy());
down.on('data',data=>{if(data.includes(Buffer.from('INSERT INTO jeeves.idempotency_records')))mutation=true;if(mutation&&!dropped&&data.includes(Buffer.from('COMMIT\\0')))commit=true;up.write(data);});
up.on('data',data=>{if(commit&&!dropped){reply=Buffer.concat([reply,data]);if(reply.includes(Buffer.from('COMMIT\\0'))){dropped++;down.destroy();up.end();}}else down.write(data);});down.on('close',()=>up.destroy());up.on('close',()=>down.destroy());});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
process.env.JEEVES_DATABASE_ITEMS_DB_HOST='127.0.0.1';process.env.JEEVES_DATABASE_ITEMS_DB_PORT=String(server.address().port);
const result=await withProcess(scope,async()=>{const cache=await createValkeyCache({binding:{hostname:'cache-admission',port:6379,secret:'cache-admission',tls:{mode:'disable'}}});scope.own(()=>cache.close());
const limiter=createRateLimiter({process:'items-api',module:'create-limit',limit:2,windowSeconds:60,cache,hooks:{key:caller=>caller.subject}});
const prepared=prepareProductDatabase({tile:'items-api',resource:'items-db',module:'create',property:'itemsDb',writable:true,operation:localOperation});
const db=await productDatabaseClient(scope,()=>{},prepared),context=operation({maximumMs:4000,caller:{subject:${JSON.stringify(accountB.subject)}}});
try{await withOperation(context.context,()=>localOperation.call({itemsDb:db,createLimit:limiter,settings:{}},{key:'commit-lost',input:{id:'commit-lost'}}));return {unexpectedSuccess:true,dropped};}
catch(error){return {outcome:error.outcome,code:error.code,dropped};}finally{context.close();}});
${finish("result")}
await lifecycle.close();await new Promise(done=>server.close(done));
`,
          );
          expect(result).toMatchObject({
            outcome: "unknown",
            code: "COMMIT_RESPONSE_LOST",
            dropped: 1,
          });
          const replay = await create(second, userB, "commit-lost");
          expect(replay).toMatchObject({
            status: 201,
            body: { id: "commit-lost", receipt: "sealed-foundation-receipt" },
          });
          expect(
            await app.sql(
              "SELECT count(*) FROM p_items_api_owner.items WHERE id='commit-lost'",
              "d_items_db",
            ),
          ).toBe("1");
          expect(
            await app.sql(
              "SELECT (response ? 'sealed')::text||'|'||(position('sealed-foundation-receipt' in response::text)=0)::text FROM jeeves.idempotency_records WHERE idem_key='commit-lost'",
              "d_items_db",
            ),
          ).toBe("true|true");
          return { result, replay, mutations: 1, sealed: true };
        },
      );

      await check(
        "forwarded deadline and explicit unknown effects",
        "A 100ms remaining budget is clamped and a dispatched POST times out as unknown; no new mutation is retried",
        async () => {
          const result = await direct(app, first, userA, "/internal/modules/slow", {
            input: {},
            remainingMs: 100,
          });
          expect(result.status).toBe(503);
          expect(result.elapsedMs).toBeLessThan(500);
          expect(result.body).toMatchObject({ error: "DEADLINE" });
          expect(result.headers["retry-after"]).toBeUndefined();
          const transport = await native<{
            outcome: string;
            code: string;
            elapsedMs: number;
            headers: Record<string, string>;
          }>(
            app,
            "app-gateway",
            `
${privateScope}
import {createWorkload,workloadSettings,serviceTarget} from './dist/runtime/workload.js';import {rememberVerifiedBearer} from './dist/runtime/operation.js';
import {classifyHttpError} from './dist/runtime/admission.js';
const result=await withProcess(scope,async()=>{
 const credentials=createWorkload(workloadSettings({identity:'sign-in',client:'jeeves-workload-gateway',audience:'jeeves-service-gateway'}),['items-api']);
 await credentials.acquire('items-api');
 const target=serviceTarget({tile:'items-api',operations:['slow'],forwardUser:true,credentials});
 const context=operation({maximumMs:100});const started=performance.now();
 try{await withOperation(context.context,()=>{rememberVerifiedBearer(${JSON.stringify(userA)});return target.call('slow',{method:'POST',body:{}});});return {unexpectedSuccess:true};}
 catch(error){return {outcome:error.outcome,code:error.code,headers:classifyHttpError(error).headers,elapsedMs:Math.round(performance.now()-started)};}finally{context.close();}
});
${finish("result")}
await lifecycle.close();
`,
          );
          expect(transport.outcome).toBe("unknown");
          expect(transport).toMatchObject({
            headers: { "X-Jeeves-Outcome": "unknown" },
          });
          expect(transport.headers["Retry-After"]).toBeUndefined();
          expect(transport.elapsedMs).toBeLessThan(500);
          await poll(
            "timed-out native read settles",
            () =>
              app.sql(
                "SELECT count(*) FROM pg_stat_activity WHERE datname='d_items_db' AND usename='pr_items_db__items_api' AND wait_event='PgSleep'",
                "d_items_db",
              ),
            (count) => count === "0",
            5000,
          );
          return { receiver: result, generatedTransport: transport };
        },
      );

      await check(
        "store loss, retained admission state and recovery",
        "Admission fails closed, committed replay still returns while its cache is down, optional reader falls back; both caches and PostgreSQL recover without restarting service copies",
        async () => {
          const [admission] = await serviceContainers(app, "cache-admission"),
            [records] = await serviceContainers(app, "cache-records"),
            [postgres] = await serviceContainers(app, "local-postgres");
          assert(admission && records && postgres);
          const config = await cacheProbe(
            app,
            "admission",
            `${finish("await client.configGet(['maxmemory-policy','appendonly','appendfsync'])")}`,
          );
          expect(config).toMatchObject({
            "maxmemory-policy": "noeviction",
            appendonly: "yes",
            appendfsync: "always",
          });
          const before = await cacheProbe<{ key: string; count: number; ttl: number }[]>(
            app,
            "admission",
            `${finish("await Promise.all((await client.keys('jeeves:admission:*')).map(async key=>({key,count:await client.zCard(key),ttl:await client.pTTL(key)})))")}`,
          );
          const fullWindow = before.find((row) => row.key.endsWith(`:${hash(accountA.subject)}`));
          assert(fullWindow);
          expect(fullWindow.count).toBe(2);
          expect(fullWindow.ttl).toBeGreaterThan(20000);
          await command("docker", ["kill", "--signal", "KILL", admission.Id]);
          app.record({
            boundary: "task admission cache abrupt crash",
            container: admission.Id,
          });
          const denied = await create(first, userB, "store-down");
          expect(denied.status).toBe(503);
          const admissionDownHealth = await poll(
            "required cache loss prevents readiness",
            () => foundationHealth(app, first),
            (rows) => rows.find((row) => row.path === "/readyz")?.status === 503,
            10000,
          );
          expect(admissionDownHealth.find((row) => row.path === "/livez")?.status).toBe(200);
          app.record({
            healthPhase: "required admission cache unavailable",
            probes: admissionDownHealth,
          });
          const gatewayUnknown = await native<{
            status: number;
            outcome: string;
            retryAfter: string | null;
          }>(
            app,
            "app-gateway",
            `
const response=await fetch('http://127.0.0.1:3000/modules/forward',{method:'POST',headers:{authorization:'Bearer '+${JSON.stringify(userB)},'idempotency-key':'gateway-store-down','content-type':'application/json'},body:JSON.stringify({operation:'create',input:{id:'gateway-store-down'}})});
await response.arrayBuffer();
${finish("{status:response.status,outcome:response.headers.get('x-jeeves-outcome'),retryAfter:response.headers.get('retry-after')}")}
`,
          );
          expect(gatewayUnknown).toEqual({
            status: 503,
            outcome: "unknown",
            retryAfter: null,
          });
          const replay = await create(second, userB, "commit-lost");
          expect(replay.status).toBe(201);
          await controlContainer(app, "cache-admission", admission.Id, "start");
          await healthyCopies(app, "cache-admission", 1);
          await poll(
            "same service reconnects admission",
            () => create(first, userA, "still-limited"),
            (result) => result.status === 429,
            15000,
          );
          const retained = await cacheProbe<{ count: number; ttl: number }>(
            app,
            "admission",
            `${finish(`{count:await client.zCard(${JSON.stringify(fullWindow.key)}),ttl:await client.pTTL(${JSON.stringify(fullWindow.key)})}`)}`,
          );
          expect(retained.count).toBe(2);
          expect(retained.ttl).toBeGreaterThan(0);
          await app.sql(
            `INSERT INTO p_items_api_owner.records VALUES('recovery',jsonb_build_object('key','recovery','public',true,'version','2','validUntil',${Date.now() + 120000},'destination','recovery'))`,
            "d_items_db",
          );
          expect((await read(second, "recovery")).status).toBe(200);
          await controlContainer(app, "cache-records", records.Id, "stop");
          const fallback = await read(second, "recovery");
          expect(fallback).toMatchObject({
            status: 200,
            body: { source: "authoritative", version: "2" },
          });
          const optionalDownHealth = await foundationHealth(app, second);
          expect(optionalDownHealth).toEqual([
            { path: "/livez", status: 200 },
            { path: "/readyz", status: 200 },
          ]);
          await controlContainer(app, "cache-records", records.Id, "start");
          await healthyCopies(app, "cache-records", 1);
          await poll(
            "optional cache resumes hits",
            () => read(second, "recovery"),
            (result) =>
              result.status === 200 && (result.body as { source?: string }).source === "cache",
            15000,
          );
          await controlContainer(app, "local-postgres", postgres.Id, "stop");
          const databaseDown = await foundationForward(app, userB, "commit-lost");
          expect(databaseDown.status).toBe(503);
          const databaseDownHealth = await poll(
            "required PostgreSQL loss prevents readiness",
            () => foundationHealth(app, first),
            (rows) => rows.find((row) => row.path === "/readyz")?.status === 503,
            12000,
          );
          expect(databaseDownHealth.find((row) => row.path === "/livez")?.status).toBe(200);
          await poll(
            "independent worker marker becomes unready",
            () => foundationWorkerReady(app),
            (ready) => !ready,
            12000,
          );
          app.record({
            healthPhase: "PostgreSQL unavailable",
            probes: databaseDownHealth,
          });
          await controlContainer(app, "local-postgres", postgres.Id, "start");
          await healthyCopies(app, "local-postgres", 1);
          await poll(
            "same process recovers durable replay after Postgres restart",
            () => foundationForward(app, userB, "commit-lost"),
            (result) => result.status === 201,
            15000,
          );
          const current = (await serviceContainers(app, "app-items-api"))
            .map((row) => row.Id)
            .sort();
          expect(current).toEqual(api.map((row) => row.Id).sort());
          const recoveredHealth = await poll(
            "readiness recovers without service restart",
            () => foundationHealth(app, first),
            (rows) => rows.find((row) => row.path === "/readyz")?.status === 200,
            12000,
          );
          expect(recoveredHealth).toEqual([
            { path: "/livez", status: 200 },
            { path: "/readyz", status: 200 },
          ]);
          await poll(
            "worker marker recovers without HTTP traffic",
            () => foundationWorkerReady(app),
            (ready) => ready,
            12000,
          );
          return {
            config,
            denied,
            replay,
            fallback,
            databaseDown,
            gatewayUnknown,
            admissionDownHealth,
            databaseDownHealth,
            recoveredHealth,
            optionalDownHealth,
            workerMarkerRecovered: true,
            processesUnchanged: true,
            retainedAdmissionDenial: 429,
            beforeWindowMs: fullWindow.ttl,
            retained,
          };
        },
      );

      await check(
        "bounded shutdown of a hung operation",
        "SIGTERM stops admission and terminates the actual hung service copy within its 10-second shutdown budget, with an explicit deadline log and exit 1",
        async () => {
          const hanging = native(
            app,
            "app-gateway",
            `
const response=await fetch('http://127.0.0.1:3000/modules/forward',{method:'POST',headers:{authorization:'Bearer '+${JSON.stringify(userA)},'content-type':'application/json'},body:JSON.stringify({operation:'slow',input:{hang:true}}),signal:AbortSignal.timeout(7000)});
await response.arrayBuffer();${finish("{status:response.status}")}
`,
          ).catch((error) => {
            app.record({ hungRequestResult: String(error) });
            return undefined;
          });
          const admitted = await poll(
            "hung product handler actually entered",
            async () => {
              const logs = await Promise.all(
                api.map((row) => command("docker", ["logs", "--tail", "30", row.Id])),
              );
              return logs.findIndex((value) => value.includes("rg14-hung-entered"));
            },
            (index) => index >= 0,
            5000,
          );
          const firstCopy = api[admitted],
            hungAddress = addresses[admitted];
          assert(firstCopy && hungAddress);
          const started = performance.now();
          await command("docker", ["kill", "--signal", "TERM", firstCopy.Id]);
          const drainingHealth = await foundationHealth(app, hungAddress);
          expect(drainingHealth.find((row) => row.path === "/readyz")?.status).not.toBe(200);
          const liveStatus = drainingHealth.find((row) => row.path === "/livez")?.status;
          if (liveStatus !== null) expect(liveStatus).toBe(200);
          app.record({
            healthPhase: "draining after SIGTERM",
            probes: drainingHealth,
          });
          const state = await poll(
            "hung process exits on its own final deadline",
            async () =>
              JSON.parse(
                await command("docker", ["inspect", "--format", "{{json .State}}", firstCopy.Id]),
              ) as { Status: string; ExitCode: number },
            (state) => state.Status === "exited",
            13000,
          );
          const elapsedMs = Math.round(performance.now() - started),
            logs = await command("docker", ["logs", "--tail", "60", firstCopy.Id]);
          await hanging;
          expect(elapsedMs).toBeLessThan(12500);
          expect(state.ExitCode).toBe(1);
          expect(logs).toContain("shutdown-deadline");
          expect(logs).toContain("admission-stopped");
          return {
            elapsedMs,
            exitCode: state.ExitCode,
            deadlineLogged: true,
            drainingHealth,
          };
        },
      );
    },
    "design.json",
    { beforeStart: options.beforeStart ?? prepareFoundation },
  );
}

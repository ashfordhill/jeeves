import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { serviceContainers } from "./activity.ts";
import type { Application } from "./application.ts";
import { rememberSecrets } from "./evidence.ts";
import { command } from "./process.ts";

export const foundationTemplates = [
  "verified-identity",
  "verified-identity",
  "module-stub",
  "module-stub",
  "module-stub",
  "module-stub",
  "module-stub",
  "module-stub",
  "positive-cache-read",
  "rate-limiter",
  "module-stub",
];

export async function prepareFoundation(app: Application) {
  const key = randomBytes(32).toString("base64url");
  const ring = JSON.stringify([{ id: "fixture-v1", key }]);
  await rememberSecrets(app.directory, key, ring);
  // Disposable local test credential; never an owner credential or a committed fixture key.
  await writeFile(join(app.directory, "../rg14-replay-keys.json"), ring, { mode: 0o644 });
}

/** Only test-owned containers; private imports/drivers are harness observation/fault injection,
 * never application extensions. stdout has one JSON result envelope, never credentials. */
export async function native<T>(
  app: Application,
  service: string,
  script: string,
  containerId?: string,
  timeoutMs = 20_000,
): Promise<T> {
  const rows = await serviceContainers(app, service);
  const container = containerId ? rows.find((row) => row.Id === containerId) : rows[0];
  assert(container?.State.Status === "running", "Owned running native probe container required");
  const output = await command(
    "docker",
    ["exec", "-i", container.Id, "node", "--input-type=module"],
    {
      input: script,
      timeoutMs,
    },
  );
  const result = output.split("\n").find((line) => line.startsWith("RG14_RESULT="));
  assert(result, "Native probe result envelope missing");
  return JSON.parse(result.slice("RG14_RESULT=".length)) as T;
}

export const finish = (expression: string) =>
  `console.log('RG14_RESULT='+JSON.stringify(${expression}));`;

/** Health is observed without either identity. During drain the listener may already be closed. */
export function foundationHealth(app: Application, address: string) {
  return native<{ path: string; status: number | null }[]>(
    app,
    "app-gateway",
    `
const result=await Promise.all(['/livez','/readyz'].map(async path=>{try{const response=await fetch(${JSON.stringify(`http://${address}:3000`)}+path,{signal:AbortSignal.timeout(500)});await response.arrayBuffer();return {path,status:response.status};}catch{return {path,status:null};}}));
${finish("result")}
`,
  );
}

/** Exercise the actual long-running gateway, including its bounded cached workload credential. */
export function foundationForward(app: Application, user: string, key: string) {
  return native<{ status: number; body: unknown }>(
    app,
    "app-gateway",
    `
const response=await fetch('http://127.0.0.1:3000/modules/forward',{method:'POST',headers:{authorization:'Bearer '+${JSON.stringify(user)},'idempotency-key':${JSON.stringify(key)},'content-type':'application/json'},body:JSON.stringify({operation:'create',input:{id:${JSON.stringify(key)}}}),signal:AbortSignal.timeout(7000)});
${finish("{status:response.status,body:await response.json()}")}
`,
  );
}

export function foundationWorkerReady(app: Application) {
  return native<boolean>(
    app,
    "app-items-worker",
    `import {existsSync} from 'node:fs';${finish("existsSync('/tmp/application-ready')")}`,
  );
}

export const privateScope = `
import {createProcessLifecycle} from './dist/runtime/process.js';
import {operation,withOperation,withProcess,withLocalPolicy} from './dist/runtime/operation.js';
const lifecycle=createProcessLifecycle({mark:()=>{}}),scope=lifecycle.scope;
`;

/** A generated client acquires/verifies its audience token from actual Keycloak. User identity
 * is independently supplied; neither token nor credential is returned in the probe envelope. */
export async function direct(
  app: Application,
  address: string,
  user: string | undefined,
  path: string,
  options: {
    input?: unknown;
    key?: string;
    remainingMs?: number;
    workload?: boolean;
    method?: string;
  } = {},
) {
  return native<{
    status: number;
    body: unknown;
    headers: Record<string, string>;
    elapsedMs: number;
  }>(
    app,
    "app-gateway",
    `
${privateScope}
import {createWorkload,workloadSettings} from './dist/runtime/workload.js';
const credentials=createWorkload(workloadSettings({identity:'sign-in',client:'jeeves-workload-gateway',audience:'jeeves-service-gateway'}),['items-api']);
const answer=await withProcess(scope,async()=>{
 const token=${options.workload === false ? "undefined" : "await credentials.acquire('items-api')"};
 const started=performance.now();
 const response=await fetch(${JSON.stringify(`http://${address}:3000${path}`)},{method:${JSON.stringify(options.method ?? "POST")},
 headers:{'content-type':'application/json',${user ? `authorization:'Bearer '+${JSON.stringify(user)},` : ""}
 ...(token?{'x-jeeves-workload':'Bearer '+token}:{}),
 ${options.key ? `'idempotency-key':${JSON.stringify(options.key)},` : ""}
 ${options.remainingMs !== undefined ? `'x-jeeves-remaining-ms':${options.remainingMs},'x-correlation-id':'rg14-deadline',` : ""}},
 ${options.input !== undefined ? `body:JSON.stringify(${JSON.stringify(options.input)}),` : ""}signal:AbortSignal.timeout(7000)});
 const body=await response.json();return {status:response.status,body,elapsedMs:Math.round(performance.now()-started),
 headers:Object.fromEntries(['retry-after','x-jeeves-outcome','x-correlation-id'].flatMap(key=>response.headers.has(key)?[[key,response.headers.get(key)]]:[]))};
});
${finish("answer")}
await lifecycle.close();
`,
  );
}

export async function productPermissions(app: Application, host: string) {
  return native<{ user: string; outcomes: { name: string; code: string }[] }>(
    app,
    `app-${host}`,
    `
import pg from 'pg';import {readSecret} from './dist/runtime/local.js';
const client=new pg.Client({host:'local-postgres',database:'d_items_db',user:${JSON.stringify(`pr_items_db__${host.replaceAll("-", "_")}`)},password:readSecret(${JSON.stringify(`product-items-db--${host}`)}),ssl:false});
await client.connect();const user=(await client.query('SELECT current_user')).rows[0].current_user;
const cases=${JSON.stringify([
      ["select-items", "SELECT * FROM p_items_api_owner.items"],
      ["insert-items", `INSERT INTO p_items_api_owner.items(id) VALUES ('privilege-${host}')`],
      ["update-items", "UPDATE p_items_api_owner.items SET marked=true WHERE id='seed'"],
      ["delete-items", "DELETE FROM p_items_api_owner.items WHERE id='absent'"],
      ["select-records", "SELECT * FROM p_items_api_owner.records"],
      ["published-view", "SELECT * FROM published.visible_items"],
      ["protected-replay", "SELECT * FROM jeeves.idempotency_records"],
      ["protected-ledger", "SELECT * FROM public.jeeves_product_migrations"],
      ["product-ddl", "CREATE TABLE p_items_api_owner.forbidden(id text)"],
      ["owner-role", "SET ROLE o_items_db"],
      ["migration-role", "SET ROLE pm_items_db_p_items_api_owner"],
    ])};
const outcomes=[];try{for(const [name,sql] of cases){let code='OK';try{await client.query(sql);}catch(error){code=error.code;}outcomes.push({name,code});}}
finally{await client.end();}
${finish("{user,outcomes}")}
`,
  );
}

/** Native Valkey commands use only the task's generated password, never print it. */
export async function cacheProbe<T>(
  app: Application,
  cache: "admission" | "records",
  script: string,
) {
  return native<T>(
    app,
    "app-items-api",
    `
import {createClient} from 'redis';import {readSecret} from './dist/runtime/local.js';
const client=createClient({password:readSecret('cache-${cache}'),socket:{host:'cache-${cache}',port:6379,reconnectStrategy:false}});client.on('error',()=>{});
await client.connect();try{${script}}finally{client.destroy();}
`,
  );
}

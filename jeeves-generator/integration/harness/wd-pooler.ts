/** WD11's opt-in, disposable transaction-pooler integration seam. Never emitted to applications. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Application } from "./application.ts";
import { finish, native } from "./rg-foundations.ts";

export const transactionPooler = process.env.JEEVES_SYSTEM_DB_POOLER === "wd11";
// edoburu/pgbouncer:v1.25.2-p0, pinned linux/amd64 manifest, not a floating tag.
export const poolerImage =
  "edoburu/pgbouncer@sha256:68969403ee54dbf98601b49a1e92db644a9fdeed5c40969f7f0adce5193ac5b8";
export async function prepareTransactionPooler(app: Application) {
  if (!transactionPooler) return;
  const plan = JSON.parse(await readFile(join(app.directory, "infra/local.json"), "utf8")) as {
    logins: { user: string; secret: string }[];
    productLogins: { user: string; secret: string }[];
  };
  const logins = [
    ...plan.logins,
    ...plan.productLogins,
    { user: "postgres", secret: "postgres-admin" },
  ];
  const poolerFolder = `../wd11-pooler-${app.stack.fixture}`;
  const folder = join(app.directory, poolerFolder);
  await mkdir(folder);
  await writeFile(
    join(folder, "pgbouncer.ini"),
    `[databases]
* = host=local-postgres port=5432
[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
unix_socket_dir = /tmp
user = postgres
auth_type = scram-sha-256
auth_file = /tmp/wd11-userlist
admin_users = ${logins.map((login) => login.user).join(",")}
pool_mode = transaction
default_pool_size = 2
max_client_conn = 200
max_prepared_statements = 0
server_connect_timeout = 2
server_login_retry = 1
`,
  );
  const userlist = logins
    .map(({ user, secret }) => {
      assert(/^[a-z0-9_]+$/.test(user) && /^[a-z0-9-]+$/.test(secret));
      return `printf '"%s" "%s"\\n' '${user}' "$(cat /run/secrets/${secret})" >> /tmp/wd11-userlist`;
    })
    .join("\n");
  const overridePath = join(app.directory, "compose.override.yaml");
  const override = JSON.parse(await readFile(overridePath, "utf8"));
  const compose = JSON.parse(await readFile(join(app.directory, "compose.yaml"), "utf8"));
  override.services["wd11-pooler"] = {
    image: poolerImage,
    user: "0:0",
    entrypoint: ["/bin/sh", "-ec"],
    command: [
      `umask 077\n${userlist}\nchown postgres:postgres /tmp/wd11-userlist\nexec pgbouncer /pooler/pgbouncer.ini`,
    ],
    volumes: [`${poolerFolder}:/pooler:ro`],
    secrets: logins.map((login) => login.secret),
    depends_on: { "local-postgres": { condition: "service_healthy" } },
    healthcheck: {
      test: ["CMD", "nc", "-z", "127.0.0.1", "6432"],
      interval: "1s",
      timeout: "2s",
      retries: 30,
    },
  };
  for (const [name, service] of Object.entries(compose.services) as [
    string,
    { environment?: Record<string, string> },
  ][]) {
    if (!name.startsWith("app-") || !service.environment) continue;
    const hostNames = Object.keys(service.environment).filter((key) =>
      /^JEEVES_DATABASE_.*_HOST$/.test(key),
    );
    if (!hostNames.length) continue;
    override.services[name] ??= {};
    const target = override.services[name];
    target.environment ??= {};
    target.environment.JEEVES_DB_POOL_MAX = "3";
    for (const host of hostNames) {
      // Catalog's PostgreSQL COMMIT gate remains in front of the pooler, not around it.
      if (target.environment[host] === "rg-provider") continue;
      target.environment[host] = "wd11-pooler";
      target.environment[host.replace(/_HOST$/, "_PORT")] = "6432";
    }
    target.depends_on ??= {};
    target.depends_on["wd11-pooler"] = { condition: "service_healthy" };
  }
  if (override.services["rg-provider"]) {
    override.services["rg-provider"].environment = {
      WD11_PG_HOST: "wd11-pooler",
      WD11_PG_PORT: "6432",
    };
    override.services["rg-provider"].depends_on = {
      "wd11-pooler": { condition: "service_healthy" },
    };
  }
  await writeFile(overridePath, JSON.stringify(override, null, 2));
  await app.save("pooler-topology.json", {
    image: poolerImage,
    mode: "transaction",
    defaultPoolSize: 2,
    processPoolMax: 3,
    publishedPoolerPorts: [],
    services: Object.fromEntries(
      Object.entries(override.services)
        .filter(([name]) => name.startsWith("app-"))
        .map(([name, value]) => [
          name,
          (value as { environment?: Record<string, string> }).environment,
        ]),
    ),
  });
}
/** Assert real pooler mode/upstream use without returning task credentials. */
export async function verifyTransactionPooler(app: Application, service: string) {
  if (!transactionPooler) return;
  const result = await native<{ mode: string; clients: number }>(
    app,
    service,
    `
import pg from 'pg';import {readSecret} from './dist/runtime/local.js';import {localLogins} from './dist/features/local-bindings.js';
const login=localLogins.find(l=>l.host===${JSON.stringify(service.slice(4))});
const client=new pg.Client({host:'wd11-pooler',port:6432,database:'pgbouncer',user:login.user,password:readSecret(login.secret),ssl:false});
await client.connect();try{const config=await client.query('SHOW CONFIG');const clients=await client.query('SHOW CLIENTS');${finish("{mode:config.rows.find(r=>r.key==='pool_mode')?.value,clients:clients.rows.length}")}}finally{await client.end();}
`,
  );
  assert.equal(result.mode, "transaction");
  await app.save("pooler-observed.json", result);
}

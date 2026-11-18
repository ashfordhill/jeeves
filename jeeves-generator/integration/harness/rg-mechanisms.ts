import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Application } from "./application.ts";
import { rememberSecrets } from "./evidence.ts";
import { command, repository } from "./process.ts";
import { finish, native, prepareFoundation } from "./rg-foundations.ts";

export async function prepareLinkFlow(app: Application) {
  await prepareFoundation(app);
  const infra = join(app.directory, "../rg-infra");
  await mkdir(infra);
  const secret = randomBytes(32).toString("base64url"),
    key = randomBytes(32).toString("base64url");
  const ring = JSON.stringify([{ id: "rg23", key }]);
  await rememberSecrets(app.directory, secret, key, ring);
  for (const [name, value] of Object.entries({
    "browser-secret": secret,
    "browser-ring": ring,
    "control.json": '{"mode":"normal"}',
  }))
    await writeFile(join(infra, name), value, { mode: 0o644 });
  await command(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(infra, "ca.key"),
      "-out",
      join(infra, "ca.crt"),
      "-days",
      "2",
      "-subj",
      "/CN=RG23 task CA",
    ],
    { timeoutMs: 10000 },
  );
  await command(
    "openssl",
    [
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(infra, "server.key"),
      "-out",
      join(infra, "server.csr"),
      "-subj",
      "/CN=rg-issuer",
    ],
    { timeoutMs: 10000 },
  );
  await writeFile(
    join(infra, "san.ext"),
    "subjectAltName=DNS:rg-issuer\nextendedKeyUsage=serverAuth\n",
  );
  await command("openssl", [
    "x509",
    "-req",
    "-in",
    join(infra, "server.csr"),
    "-CA",
    join(infra, "ca.crt"),
    "-CAkey",
    join(infra, "ca.key"),
    "-CAcreateserial",
    "-out",
    join(infra, "server.crt"),
    "-days",
    "2",
    "-extfile",
    join(infra, "san.ext"),
  ]);
  await copyFile(
    join(repository, "jeeves-generator/integration/harness/rg-issuer.mjs"),
    join(infra, "issuer.mjs"),
  );
  const common = {
    NODE_EXTRA_CA_CERTS: "/rg/ca.crt",
    OIDC_ISSUER: "https://rg-issuer:8443/realms/sign-in",
    OIDC_JWKS_URL: "https://rg-issuer:8443/realms/sign-in/protocol/openid-connect/certs",
    JEEVES_WORKLOAD_ISSUER: "https://rg-issuer:8443/realms/sign-in",
    JEEVES_WORKLOAD_JWKS_URL: "https://rg-issuer:8443/realms/sign-in/protocol/openid-connect/certs",
    JEEVES_WORKLOAD_TOKEN_URL:
      "https://rg-issuer:8443/realms/sign-in/protocol/openid-connect/token",
  };
  const services: Record<string, unknown> = {
    "identity-sign-in": {
      environment: {
        KC_HOSTNAME: "https://rg-issuer:8443",
        KC_PROXY_HEADERS: "xforwarded",
      },
    },
    "rg-issuer": {
      image: `${app.stack.project}-app`,
      command: ["node", "/rg/issuer.mjs"],
      volumes: ["../rg-infra:/rg:ro"],
      secrets: ["identity-admin-sign-in"],
      depends_on: { "identity-sign-in": { condition: "service_healthy" } },
      healthcheck: {
        test: [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:9080').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ],
        interval: "1s",
        timeout: "2s",
        retries: 30,
      },
    },
    "setup-migrate": {
      volumes: [
        "./infra/postgres/items-db/products.json:/app/infra/postgres/items-db/products.json:ro",
        "./infra/postgres/items-db/products:/app/infra/postgres/items-db/products:ro",
      ],
    },
  };
  for (const host of ["gateway", "items-api", "items-worker", "browser"])
    services[`app-${host}`] = {
      environment: {
        ...common,
        ...(host === "items-api"
          ? { JEEVES_SECRET_JEEVES_REPLAY_KEYS_FILE: "/rg14-replay-keys.json" }
          : {}),
        ...(host === "browser"
          ? {
              JEEVES_BROWSER_IDENTITY_SIGN_IN_ISSUER: common.OIDC_ISSUER,
              JEEVES_BROWSER_SESSION_CALLBACK: "https://browser.test/modules/session/callback",
              JEEVES_BROWSER_SESSION_AUDIENCE: "sign-in-web",
              JEEVES_SECRET_JEEVES_BROWSER_SESSION_CLIENT_SECRET_FILE: "/rg/browser-secret",
              JEEVES_SECRET_JEEVES_BROWSER_SESSION_KEYS_FILE: "/rg/browser-ring",
            }
          : {}),
      },
      volumes: [
        host === "browser" ? "../rg-infra:/rg:rw" : "../rg-infra:/rg:ro",
        ...(host === "items-api" ? ["../rg14-replay-keys.json:/rg14-replay-keys.json:ro"] : []),
      ],
      depends_on: { "rg-issuer": { condition: "service_healthy" } },
    };
  // Override is fixture-owned deployment input, never a patched generated runtime file.
  await writeFile(
    join(app.directory, "compose.override.yaml"),
    JSON.stringify({ services }, null, 2),
  );
}
export async function issuerMode(app: Application, mode: string) {
  await writeFile(join(app.directory, "../rg-infra/control.json"), JSON.stringify({ mode }));
}
export const issuerStats = (app: Application) =>
  native<{ refreshes: number; rotations: number }>(
    app,
    "app-browser",
    `const result=await(await fetch('http://rg-issuer:9080')).json();${finish("result")}`,
  );
export async function browserLogin(app: Application, username: string, password: string) {
  const handoff = `session-${randomBytes(16).toString("hex")}.json`;
  const status = await native<{ status: number }>(
    app,
    "app-browser",
    `
import {writeFileSync} from "node:fs";
const cookieJar=new Map();const absorb=r=>{for(const x of r.headers.getSetCookie()){const pair=x.split(';')[0];if(/Max-Age=0(?:;|$)/i.test(x))cookieJar.delete(pair.slice(0,pair.indexOf('=')));else cookieJar.set(pair.slice(0,pair.indexOf('=')),pair.slice(pair.indexOf('=')+1));}};
const cookies=()=>[...cookieJar].map(([k,v])=>k+'='+v).join('; ');
const start=await fetch('http://127.0.0.1:3000/modules/session/login',{redirect:'manual'});absorb(start);if(start.status!==302)throw Error('Login start '+start.status);
const auth=await fetch(start.headers.get('location'),{redirect:'manual'});absorb(auth);const html=await auth.text();const action=/<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/s.exec(html)?.[1]?.replaceAll('&amp;','&');if(!action)throw Error('Login form absent '+auth.status);
const login=await fetch(action,{method:'POST',redirect:'manual',headers:{cookie:cookies(),'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:${JSON.stringify(username)},password:${JSON.stringify(password)},credentialId:''})});absorb(login);await login.text();if(login.status!==302)throw Error('Issuer login '+login.status);
const target=new URL(login.headers.get('location'));const callback=await fetch('http://127.0.0.1:3000'+target.pathname+target.search,{headers:{cookie:cookies()},redirect:'manual'});absorb(callback);await callback.text();if(callback.status!==302)throw Error('Callback '+callback.status);
const state=await fetch('http://127.0.0.1:3000/modules/session/session',{headers:{cookie:cookies()}});const body=await state.json();writeFileSync(${JSON.stringify("/rg/" + handoff)},JSON.stringify({cookie:cookies(),csrf:body.csrf,status:state.status}),{mode:0o600});${finish("{status:state.status}")}
`,
  );
  const session = JSON.parse(
    await readFile(join(app.directory, "../rg-infra", handoff), "utf8"),
  ) as { cookie: string; csrf: string; status: number };
  await rememberSecrets(
    app.directory,
    session.cookie,
    session.csrf,
    ...session.cookie.split("; ").map((p) => p.slice(p.indexOf("=") + 1)),
  );
  assert.equal(status.status, 200);
  assert.equal(session.status, 200);
  return session;
}

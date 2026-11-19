import { randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { auth0Design } from "../../../field-projects/generator-system/fixtures/qr-auth0/design.ts";
import { resolveGeneration } from "../../../jeeves/packages/spec/src/generation-resolver.ts";
import { auth0Workload } from "../../src/v2/auth0.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import type { Application } from "./application.ts";
import { rememberSecrets } from "./evidence.ts";
import { command, repository } from "./process.ts";
import { finish, native } from "./rg-foundations.ts";

export async function prepareAuth0(app: Application) {
  const infra = join(app.directory, "../auth0-fixture");
  await mkdir(infra);
  const key = randomBytes(32).toString("base64url");
  const ring = JSON.stringify([{ id: "auth0-fixture", key }]);
  await rememberSecrets(app.directory, key, ring);
  const model = resolveGeneration(auth0Design(), loadLocalV2Registry().installed).model;
  if (!model?.processes?.length) throw new Error("Missing Auth0 fixture processes");
  for (const file of ["browser-secret", ...model.processes.map((p) => p.tile)]) {
    const value = randomBytes(32).toString("base64url");
    await rememberSecrets(app.directory, value);
    await writeFile(join(infra, file), value, { mode: 0o644 });
  }
  await writeFile(join(infra, "browser-ring"), ring, { mode: 0o644 });
  await writeFile(join(infra, "mode"), "normal", { mode: 0o644 });
  await command("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    join(infra, "server.key"),
    "-out",
    join(infra, "server.crt"),
    "-days",
    "1",
    "-subj",
    "/CN=auth0-issuer",
    "-addext",
    "subjectAltName=DNS:auth0-issuer",
  ]);
  await copyFile(
    join(repository, "jeeves-generator/integration/harness/auth0-issuer.mjs"),
    join(infra, "issuer.mjs"),
  );
  const common = {
    NODE_EXTRA_CA_CERTS: "/auth0-fixture/server.crt",
    JEEVES_AUTH0_IDENTITY_ISSUER: "https://auth0-issuer:8443/",
    JEEVES_AUTH0_IDENTITY_AUDIENCE: "https://fixture.test/users",
  };
  const services: Record<string, unknown> = {
    "auth0-issuer": {
      image: `${app.stack.project}-app`,
      command: ["node", "/auth0-fixture/issuer.mjs"],
      volumes: ["../auth0-fixture:/auth0-fixture:ro"],
      healthcheck: {
        test: [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:9080/facts').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ],
        interval: "1s",
        timeout: "2s",
        retries: 30,
      },
    },
  };
  for (const p of model.processes) {
    const binding = auth0Workload(p);
    if (!binding) throw new Error("Missing fixture binding");
    services[`app-${p.tile}`] = {
      environment: {
        ...common,
        [binding.ownClient]: `machine_${p.tile}`,
        [binding.ownAudience]: `https://fixture.test/services/${p.tile}`,
        ...Object.fromEntries(
          Object.entries(binding.callers).map(([id, name]) => [name, `machine_${id}`]),
        ),
        ...Object.fromEntries(
          Object.entries(binding.targets).map(([id, name]) => [
            name,
            `https://fixture.test/services/${id}`,
          ]),
        ),
        JEEVES_WORKLOAD_SECRET_FILE: `/auth0-fixture/${p.tile}`,
        ...(p.tile === "browser-api" && {
          JEEVES_BROWSER_SIGN_IN_CLIENT_ID: "fixture_browser",
          JEEVES_BROWSER_SIGN_IN_CALLBACK: "https://browser.test/modules/sign-in/callback",
          JEEVES_BROWSER_SIGN_IN_LOGOUT_RETURN: "https://browser.test/",
          JEEVES_SECRET_JEEVES_BROWSER_SIGN_IN_CLIENT_SECRET_FILE: "/auth0-fixture/browser-secret",
          JEEVES_SECRET_JEEVES_BROWSER_SIGN_IN_KEYS_FILE: "/auth0-fixture/browser-ring",
        }),
      },
      volumes: [`../auth0-fixture:/auth0-fixture:${p.tile === "browser-api" ? "rw" : "ro"}`],
      depends_on: { "auth0-issuer": { condition: "service_healthy" } },
    };
  }
  await writeFile(
    join(app.directory, "compose.override.yaml"),
    JSON.stringify({ services }, null, 2),
  );
}

export function auth0Mode(app: Application, mode: string) {
  return writeFile(join(app.directory, "../auth0-fixture/mode"), mode);
}

export function auth0Stats(app: Application) {
  return native<{ refreshes: number; rotations: number; logouts: number }>(
    app,
    "app-browser-api",
    `const result=await(await fetch('http://auth0-issuer:9080/facts')).json();${finish("result")}`,
  );
}

export async function auth0Login(app: Application, user: "alice" | "bob") {
  const name = `session-${randomBytes(16).toString("hex")}.json`;
  await native(
    app,
    "app-browser-api",
    `
import {writeFileSync} from "node:fs";
const base='http://127.0.0.1:3000';
const start=await fetch(base+'/modules/sign-in/login',{redirect:'manual'});
if(start.status!==302)throw Error('Login start '+start.status);
const auth=await fetch(start.headers.get('location'),{redirect:'manual',headers:{'x-fixture-user':${JSON.stringify(user)}}});
if(auth.status!==302)throw Error('Issuer authorize '+auth.status);
const target=new URL(auth.headers.get('location'));
const login=await fetch(base+target.pathname+target.search,{headers:{cookie:start.headers.getSetCookie()[0].split(';')[0]},redirect:'manual'});
if(login.status!==302)throw Error('Callback '+login.status);
const cookie=login.headers.getSetCookie().find(line=>line.startsWith('__Host-jeeves-sign-in-session=')).split(';')[0];
const state=await fetch(base+'/modules/sign-in/session',{headers:{cookie}});
const body=await state.json();
writeFileSync('/auth0-fixture/'+${JSON.stringify(name)},JSON.stringify({cookie,csrf:body.csrf,subject:body.subject}),{mode:0o600});
${finish("state.status")}
  `,
  );
  const session = JSON.parse(
    await readFile(join(app.directory, "../auth0-fixture", name), "utf8"),
  ) as {
    cookie: string;
    csrf: string;
    subject: string;
  };
  const cookieValue = session.cookie.split("=")[1];
  if (!cookieValue) throw new Error("Missing fixture session cookie");
  await rememberSecrets(app.directory, session.cookie, session.csrf, cookieValue);
  return session;
}

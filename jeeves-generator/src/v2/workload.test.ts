import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildSupportedAuthoringCommand,
  createStudioSettings,
  moduleConnectOptions,
  moduleSlots,
  resolveGeneration,
} from "@jeeves/spec";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { workloadDesign } from "../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { operationUrl } from "./operation.test.helpers.ts";

const registry = loadLocalV2Registry();
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const issuer = "https://issuer.example/realms/issuer";
const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
function token(overrides: Record<string, unknown> = {}, workload = true) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuer,
    aud: "jeeves-service-callee",
    sub: workload ? "service-account-caller" : "user-7",
    exp: now + 300,
    iat: now,
    ...(workload ? { azp: "jeeves-workload-caller", jeeves_workload: "caller" } : {}),
    ...overrides,
  };
  const input = `${part({ alg: "RS256", kid: "one" })}.${part(payload)}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), keys.privateKey).toString("base64url")}`;
}
const data = (source: string) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
// Crypto-backed unit stand-in; the emitted real pinned jose cache is exercised separately in
// scratch evidence. Capture every option and custom fetch callback rather than emulate its cache.
const jose = data(`import {createPublicKey,verify} from "node:crypto";
const key=createPublicKey(${JSON.stringify(String(keys.publicKey.export({ type: "spki", format: "pem" })))});
export const customFetch=Symbol(); export const sets=[];
export function createRemoteJWKSet(url,options){sets.push({url,options}); return async()=>key;}
const fail=(code)=>{throw Object.assign(Error("test invalid identity"),{code});};
export async function jwtVerify(token,keyset,options){const [h,p,s]=token.split('.'); let header,payload; try {header=JSON.parse(Buffer.from(h,'base64url'));payload=JSON.parse(Buffer.from(p,'base64url'));}catch{fail('ERR_JWT_INVALID');}
if(!options.algorithms.includes(header.alg))fail('ERR_JOSE_ALG_NOT_ALLOWED');
await keyset(header); if(!verify('RSA-SHA256',Buffer.from(h+'.'+p),key,Buffer.from(s,'base64url')))fail('ERR_JWS_SIGNATURE_VERIFICATION_FAILED');
if(payload.iss!==options.issuer||![payload.aud].flat().some(a=>[options.audience].flat().includes(a)))fail('ERR_JWT_CLAIM_VALIDATION_FAILED');
for(const c of options.requiredClaims)if(!(c in payload))fail('ERR_JWT_CLAIM_VALIDATION_FAILED');
if(payload.exp<=Date.now()/1000)fail('ERR_JWT_EXPIRED'); return {payload};}
`);
const requireServer = createRequire(
  new URL("../../../jeeves/apps/server/package.json", import.meta.url),
);
const fastify =
  data(`import fastify from ${JSON.stringify(pathToFileURL(requireServer.resolve("fastify")).href)};
export const apps=[]; export default function(options){const app=fastify(options);app.listen=async()=>{await app.ready();apps.push(app);return 'injected';};return app;}`);
const settings = {
  identity: "issuer",
  client: "jeeves-workload-caller",
  audience: "jeeves-service-callee",
  issuer,
  tokenUrl: "https://issuer.example/token",
  jwksUrl: "https://issuer.example/jwks",
  secret: "unit-secret",
};
function loader(user = false, publicCallee = false) {
  let design = workloadDesign();
  if (user)
    design = runStudioCommands(design, [
      {
        type: "addModule",
        host: "caller",
        id: "caller-auth",
        name: "Caller auth",
        kind: "auth-guard",
      },
      {
        type: "connectModule",
        module: "caller-auth",
        slot: "identity",
        target: { tile: "issuer" },
      },
      {
        type: "addModule",
        host: "callee",
        id: "callee-auth",
        name: "Callee auth",
        kind: "auth-guard",
      },
      {
        type: "connectModule",
        module: "callee-auth",
        slot: "identity",
        target: { tile: "issuer" },
      },
    ]);
  if (publicCallee) {
    const callee = design.architecture?.studio?.elements.find((e) => e.element === "callee");
    if (callee?.settings.kind === "service") callee.settings.exposure = "public";
  }
  const bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
  const urls = new Map<string, string>();
  const overrides: Record<string, string> = {
    "src/runtime/operation.ts": operationUrl,
    "src/runtime/local.ts": data('export const readSecret=()=>"unit-secret";'),
    "src/runtime/process.ts": data(
      `import {withProcess} from ${JSON.stringify(operationUrl)};export async function runProcess(start){await withProcess({signal:new AbortController().signal,track(){},ready(){},own(){},admission(){}},()=>start({signal:new AbortController().signal,ready(){},own(){},admission(){}}));} export const ownResource=()=>{};export const processClient=()=>{};export const probeDependency=()=>{};`,
    ),
  };
  function load(path: string): string {
    if (overrides[path]) return overrides[path];
    if (urls.has(path)) return urls.get(path) as string;
    const file = bundle.files.find((f) => f.path === path);
    if (!file) throw Error(`Missing ${path}`);
    let source = new TextDecoder().decode(file.bytes);
    if (path === "src/modules/caller/send.ts" || path === "src/modules/callee/receive.ts")
      source = readFileSync(
        new URL(
          `../../../field-projects/generator-system/fixtures/rg-workload/${path.includes("send.ts") ? "send" : "receive"}.ts`,
          import.meta.url,
        ),
        "utf8",
      );
    const js = stripTypeScriptTypes(source)
      .replace(
        /from "(\.?\.?\/[^"]+)"/g,
        (_m, relative: string) =>
          `from ${JSON.stringify(load(posix.join(posix.dirname(path), relative)))}`,
      )
      .replaceAll('from "jose"', `from ${JSON.stringify(jose)}`)
      .replaceAll('from "fastify"', `from ${JSON.stringify(fastify)}`);
    const url = data(js);
    urls.set(path, url);
    return url;
  }
  return { design, bundle, load };
}
const l = loader();
const runtime = await import(l.load("src/runtime/workload.ts"));
const op = await import(operationUrl);
const { sets, customFetch } = await import(jose);
const { apps } = await import(fastify);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
afterAll(async () => {
  for (const app of apps) await app.close();
});
const within = async (dispatch: () => Promise<unknown>, maximumMs = 1000) => {
  const running = op.operation({ maximumMs });
  try {
    return await op.withOperation(running.context, dispatch);
  } finally {
    running.close();
  }
};

describe("RG09 workload contracts and verifier", () => {
  it("mouse keeps an Auth guard's first identity choice and reaches workload after it is filled", () => {
    const design = workloadDesign(true);
    const option = moduleConnectOptions(design, "caller-auth").find(
      (item) => "tile" in item.target && item.target.tile === "issuer",
    );
    if (!option || !("command" in option)) throw Error("missing workload choice");
    expect(option.command.slot).toBe("workload");
    const next = runStudioCommands(design, [option.command]);
    expect(
      moduleSlots(next, "caller-auth")
        .filter((state) => state.links.length)
        .map((state) => state.slot.id),
    ).toEqual(["identity", "workload"]);
    const identity = design.architecture?.studio?.componentConnections?.find(
      (link) => link.from === "caller-auth",
    );
    if (!identity) throw Error("identity");
    const empty = runStudioCommands(design, [{ type: "disconnectModule", link: identity.id }]);
    const first = moduleConnectOptions(empty, "caller-auth").find(
      (item) => "tile" in item.target && item.target.tile === "issuer",
    );
    expect(first && "command" in first && first.command.slot).toBe("identity");
  });
  it("hides and refuses confidential workload selection on Browser hosts", () => {
    const design = workloadDesign();
    const binding = design.architecture?.studio?.elements.find((row) => row.element === "caller");
    if (!binding) throw Error("caller");
    // Browser hosts survive only as legacy source; normal lane authoring already excludes them.
    binding.settings = createStudioSettings("browser");
    expect(moduleSlots(design, "send").some((state) => state.slot.id === "workload")).toBe(false);
    expect(() =>
      buildSupportedAuthoringCommand(
        design,
        { type: "connectModule", module: "send", slot: "workload", target: { tile: "issuer" } },
        registry.installed,
      ),
    ).toThrow("a Browser cannot hold service credentials");
  });
  it("selects a workload issuer without user Sign-in and compiles stable callers/operations", () => {
    const resolved = resolveGeneration(l.design, registry.installed);
    expect(resolved.findings).toEqual([]);
    expect(resolved.model?.processes?.find((p) => p.tile === "caller")?.serviceCalls).toMatchObject(
      [{ target: "callee", module: "send", operations: ["receive"], forwardUser: false }],
    );
    expect(resolved.model?.processes?.find((p) => p.tile === "callee")?.workloadCallers).toEqual([
      "caller",
    ]);
    const renamed = runStudioCommands(l.design, [
      { type: "edit", element: "caller", name: "Another label" },
    ]);
    expect(resolveGeneration(renamed, registry.installed).model?.processes).toMatchObject(
      resolved.model?.processes?.map((p) => ({
        tile: p.tile,
        workload: p.workload,
        ...(p.serviceCalls ? { serviceCalls: p.serviceCalls } : {}),
        ...(p.workloadCallers ? { workloadCallers: p.workloadCallers } : {}),
      })) ?? [],
    );
  });
  it("refuses missing setup even for Private network and keeps source readable", () => {
    const missing = structuredClone(l.design);
    const studio = missing.architecture?.studio;
    if (!studio) throw Error("studio");
    studio.componentConnections = studio.componentConnections?.filter(
      (link) => link.slot !== "workload",
    );
    const resolved = resolveGeneration(missing, registry.installed);
    expect(resolved.model).toBeDefined();
    expect(resolved.complete).toBe(false);
    expect(resolved.findings.map((f) => f.message)).toContainEqual(
      expect.stringContaining("Private network does not replace workload identity"),
    );
  });
  it("verifies dedicated workload claims, audience, expiry and maximum caller, independently of user tokens", async () => {
    const verifier = runtime.createWorkload(settings, []);
    await expect(verifier.require(`Bearer ${token()}`, ["caller"])).resolves.toEqual({
      process: "caller",
    });
    for (const value of [
      undefined,
      `Bearer ${token({}, false)}`,
      `Bearer ${token({ aud: "other" })}`,
      `Bearer ${token({ exp: Math.floor(Date.now() / 1000) - 1 })}`,
      `Bearer ${token({ azp: "browser-client" })}`,
      `Bearer ${token().slice(0, -3)}xxx`,
    ])
      await expect(verifier.require(value, ["caller"])).rejects.toMatchObject({
        statusCode: 401,
        code: "WORKLOAD_REQUIRED",
      });
    await expect(verifier.require(`Bearer ${token()}`, ["other"])).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(runtime.callerAllowlist([], ["caller"])).toEqual([]);
    expect(() => runtime.callerAllowlist(["other"], ["caller"])).toThrow("narrow");
  });
  it("bounds JWKS response size/key count, options and failed refresh frequency", async () => {
    runtime.createWorkload(settings, []);
    const set = sets.at(-1);
    expect(set.options).toMatchObject({
      timeoutDuration: 2000,
      cacheMaxAge: 60000,
      cooldownDuration: 30000,
    });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ keys: Array(17).fill({}) })));
    vi.stubGlobal("fetch", fetch);
    const fetchKeys = () =>
      set.options[customFetch](settings.jwksUrl, { signal: new AbortController().signal });
    await expect(fetchKeys()).rejects.toMatchObject({ code: "IDENTITY_UNAVAILABLE" });
    await expect(fetchKeys()).rejects.toMatchObject({ code: "IDENTITY_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(1);
    runtime.createWorkload(settings, []);
    fetch.mockResolvedValue(new Response("x".repeat(65537)));
    await expect(
      sets.at(-1).options[customFetch](settings.jwksUrl, { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "IDENTITY_UNAVAILABLE" });
  });
  it("emits service-only clients and refuses a missing/changed setup record for existing realms", async () => {
    const get = (path: string) =>
      new TextDecoder().decode(l.bundle.files.find((f) => f.path === path)?.bytes);
    const plan = JSON.parse(get("infra/local.json"));
    const memory = new Map<string, string>();
    vi.stubGlobal("rg09SetupMemory", memory);
    const fs = data(
      `const files=globalThis.rg09SetupMemory;export const existsSync=p=>files.has(p);export const mkdirSync=p=>files.set(p,'directory');export const chmodSync=()=>{};export const writeFileSync=(p,v)=>files.set(p,v);export const readFileSync=p=>files.get(p);`,
    );
    const module = await import(
      data(
        get("scripts/setup.mjs")
          .replace('from "node:fs"', `from ${JSON.stringify(fs)}`)
          .replace(
            'from "./common.mjs"',
            `from ${JSON.stringify(data(`export const plan=${JSON.stringify(plan)};`))}`,
          ),
      )
    );
    expect(() => module.verifyWorkloadSetup()).toThrow("Existing Keycloak realms are not updated");
    module.setup();
    expect(() => module.verifyWorkloadSetup()).not.toThrow();
    const realm = JSON.parse(memory.get(".runtime/secrets/issuer.realm.json") ?? "null");
    const service = realm.clients.find(
      (c: { clientId: string }) => c.clientId === "jeeves-workload-caller",
    );
    expect(service).toMatchObject({
      publicClient: false,
      serviceAccountsEnabled: true,
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      fullScopeAllowed: false,
    });
    expect(service.protocolMappers).toContainEqual(
      expect.objectContaining({
        protocolMapper: "oidc-hardcoded-claim-mapper",
        config: expect.objectContaining({
          "claim.name": "jeeves_workload",
          "claim.value": "caller",
        }),
      }),
    );
    const browser = realm.clients.find((c: { clientId: string }) => c.clientId === "issuer-web");
    expect(
      browser.protocolMappers.map((m: { protocolMapper: string }) => m.protocolMapper),
    ).toEqual(["oidc-audience-mapper"]);
    memory.set(".runtime/workload-contract.json", "old setup");
    expect(() => module.verifyWorkloadSetup()).toThrow("reviewed external issuer/client migration");
  });
});

describe("RG09 generated caller adapter", () => {
  it("bounds one waiter without aborting another waiter's shared credential acquisition", async () => {
    vi.useFakeTimers();
    vi.stubEnv("JEEVES_TILE_CALLEE_URL", "https://callee.example");
    let release!: (response: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetch = vi.fn((url: URL | string) =>
      String(url) === settings.tokenUrl ? gate : Promise.resolve(Response.json({ ok: true })),
    );
    vi.stubGlobal("fetch", fetch);
    const credentials = runtime.createWorkload(settings, ["callee"]);
    const target = runtime.serviceTarget({ tile: "callee", operations: ["receive"], credentials });
    const short = within(() => target.call("receive", { method: "GET" }), 10);
    const refused = expect(short).rejects.toMatchObject({ code: "CONTEXT_EXPIRED" });
    const long = within(() => target.call("receive", { method: "GET" }), 1000);
    await vi.advanceTimersByTimeAsync(11);
    await refused;
    expect(fetch).toHaveBeenCalledTimes(1);
    release(Response.json({ access_token: token() }));
    await expect(long).resolves.toMatchObject({ status: 200, body: { ok: true } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("callee enforces the GET read effect before a product command, while POST permits mutation", async () => {
    const { stubRoutes } = await import(l.load("src/runtime/tile-http.ts"));
    const mounted: { handler: (request: unknown, reply: unknown) => Promise<unknown> }[] = [];
    let writes = 0;
    stubRoutes(
      {
        route: (route: { handler: (request: unknown, reply: unknown) => Promise<unknown> }) =>
          mounted.push(route),
      },
      () => {},
      "receive",
      async () =>
        op.withEffect("local-atomic-mutation", async () => {
          writes++;
          return { body: { ok: true } };
        }),
      { deadlineMs: 1000 },
      undefined,
      "/internal/modules",
    );
    const handler = mounted[0]?.handler;
    if (!handler) throw Error("no route");
    const request = { headers: {}, params: {}, url: "/internal/modules/receive", query: {} };
    const reply = { code() {}, header() {} };
    await expect(within(() => handler({ ...request, method: "GET" }, reply))).rejects.toMatchObject(
      { code: "EFFECT_NOT_ALLOWED" },
    );
    expect(writes).toBe(0);
    await expect(within(() => handler({ ...request, method: "POST" }, reply))).resolves.toBe(
      '{"ok":true}',
    );
    expect(writes).toBe(1);
  });
  it("private callee has no anonymous or user-only legacy alias, method or wildcard bypass", async () => {
    for (const [name, value] of Object.entries({
      JEEVES_WORKLOAD_ISSUER: issuer,
      JEEVES_WORKLOAD_TOKEN_URL: settings.tokenUrl,
      JEEVES_WORKLOAD_JWKS_URL: settings.jwksUrl,
    }))
      vi.stubEnv(name, value);
    const before = apps.length;
    await import(l.load("src/processes/callee.ts"));
    const app = apps[before];
    const receiver = await import(l.load("src/modules/callee/receive.ts"));
    const baseline = receiver.observations;
    for (const url of ["/internal/modules/receive", "/modules/receive", "/modules/receive/nested"])
      for (const headers of [{}, { authorization: `Bearer ${token({}, false)}` }])
        for (const method of ["GET", "POST", "PUT"]) {
          const result = await app.inject({ method, url, headers });
          expect([401, 404]).toContain(result.statusCode);
        }
    expect(receiver.observations).toBe(baseline);
    const head = await app.inject({
      method: "HEAD",
      url: "/internal/modules/receive",
      headers: { "x-jeeves-workload": `Bearer ${token()}` },
    });
    expect(head.statusCode).toBe(405);
    expect(head.headers.allow).toBe("GET, POST");
    expect(head.headers["cache-control"]).toBe("no-store");
    expect(receiver.observations).toBe(baseline);
    const good = await app.inject({
      method: "GET",
      url: "/internal/modules/receive",
      headers: { "x-jeeves-workload": `Bearer ${token()}` },
    });
    expect(good.statusCode).toBe(200);
    expect(good.headers["cache-control"]).toBe("no-store");
    expect(receiver.observations).toBe(baseline + 1);
  });
  it("keeps verified bearer inheritance private and releases credentials when contexts close", async () => {
    const parent = op.operation({ maximumMs: 1000 });
    let child: ReturnType<typeof op.operation>;
    await op.withOperation(parent.context, async () => {
      op.rememberVerifiedBearer("private-user-credential");
      child = op.operation({ maximumMs: 500 });
      expect(JSON.stringify(parent.context)).not.toContain("private-user-credential");
      expect(await op.withOperation(child.context, async () => op.verifiedBearer())).toBe(
        "private-user-credential",
      );
      child.close();
      expect(op.withOperation(child.context, () => op.verifiedBearer())).toBeUndefined();
    });
    parent.close();
    expect(op.withOperation(parent.context, () => op.verifiedBearer())).toBeUndefined();
  });
  it("retained private legacy tile transport refuses every request without dispatch", async () => {
    vi.stubEnv("JEEVES_TILE_CALLEE_URL", "https://callee.example");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const clients = await import(l.load("src/runtime/module-clients.ts"));
    await expect(
      clients.httpTarget({ tile: "callee" }).request("/modules/receive"),
    ).rejects.toMatchObject({ code: "WORKLOAD_BINDING_REQUIRED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("single-flights refresh per independent process and retains only still-valid credentials during outage", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const signed = token({ exp: Math.floor(start / 1000) + 10 });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: signed })));
    vi.stubGlobal("fetch", fetch);
    const a = runtime.createWorkload(settings, ["callee"]);
    const b = runtime.createWorkload(settings, ["callee"]);
    const values = await Promise.all(Array.from({ length: 8 }, () => a.acquire("callee")));
    expect(new Set(values)).toEqual(new Set([signed]));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await b.acquire("callee")).toBe(signed);
    expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockRejectedValue(Error("offline"));
    vi.setSystemTime(start + 6000);
    expect(await a.acquire("callee")).toBe(signed);
    expect(fetch).toHaveBeenCalledTimes(3);
    vi.setSystemTime(start + 11000);
    await expect(a.acquire("callee")).rejects.toMatchObject({ code: "IDENTITY_UNAVAILABLE" });
    const empty = runtime.createWorkload(settings, ["callee"]);
    await expect(empty.acquire("callee")).rejects.toMatchObject({ code: "IDENTITY_UNAVAILABLE" });
    const count = fetch.mock.calls.length;
    await expect(empty.acquire("callee")).rejects.toMatchObject({ code: "IDENTITY_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(count);
  });
  it("rejects invalid/non-DTO/oversized inputs before credential or service dispatch", async () => {
    vi.stubEnv("JEEVES_TILE_CALLEE_URL", "https://callee.example");
    const acquire = vi.fn(async () => token());
    const target = runtime.serviceTarget({
      tile: "callee",
      operations: ["receive"],
      credentials: { acquire },
    });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    const getter = Object.defineProperty({}, "bad", {
      get() {
        throw Error("getter executed");
      },
      enumerable: true,
    });
    for (const body of [
      () => 0,
      NaN,
      { x: undefined },
      new Date(),
      cyclic,
      getter,
      "x".repeat(65537),
      Array(1025).fill(0),
    ])
      await expect(target.call("receive", { method: "POST", body })).rejects.toMatchObject({
        outcome: "refused",
      });
    for (const request of [
      { method: "DELETE" },
      { method: "GET", headers: { authorization: "bad" } },
      { method: "GET", body: {} },
    ])
      await expect(target.call("receive", request)).rejects.toMatchObject({ outcome: "refused" });
    await expect(target.call("elsewhere", { method: "GET" })).rejects.toMatchObject({
      outcome: "refused",
    });
    expect(acquire).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fixes credentials, paths, audience and budget; preserves mutation uncertainty and effect restrictions", async () => {
    vi.stubEnv("JEEVES_TILE_CALLEE_URL", "https://callee.example");
    const acquire = vi.fn(async () => token());
    const target = runtime.serviceTarget({
      tile: "callee",
      operations: ["receive"],
      credentials: { acquire },
    });
    let effects = 0;
    const fetch = vi.fn(async () => {
      effects++;
      return new Response("x".repeat(65537));
    });
    vi.stubGlobal("fetch", fetch);
    await expect(
      within(() => target.call("receive", { method: "POST", body: { ok: true } })),
    ).rejects.toMatchObject({ outcome: "unknown" });
    expect(effects).toBe(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe("https://callee.example/internal/modules/receive");
    expect(init).toMatchObject({ credentials: "omit", redirect: "manual" });
    expect(new Headers(init.headers).get("x-jeeves-workload")).toBe(`Bearer ${token()}`);
    expect(Number(new Headers(init.headers).get("x-jeeves-remaining-ms"))).toBeLessThanOrEqual(
      1000,
    );
    fetch.mockImplementation(async () => {
      effects++;
      return new Response("invalid-json");
    });
    await expect(within(() => target.call("receive", { method: "POST" }))).rejects.toMatchObject({
      outcome: "unknown",
    });
    fetch.mockImplementation(async () => {
      effects++;
      return new Response('{"custom":"formatted"}', {
        status: 503,
        headers: { "x-jeeves-outcome": "unknown" },
      });
    });
    await expect(within(() => target.call("receive", { method: "POST" }))).rejects.toMatchObject({
      outcome: "unknown",
      code: "REMOTE_OUTCOME_UNKNOWN",
    });
    await expect(
      within(() => op.withEffect("read", () => target.call("receive", { method: "POST" }))),
    ).rejects.toMatchObject({ code: "EFFECT_NOT_ALLOWED" });
    await expect(
      within(() =>
        op.withEffect("local-atomic-mutation", () => target.call("receive", { method: "GET" })),
      ),
    ).rejects.toMatchObject({ code: "EFFECT_NOT_ALLOWED" });
    await expect(
      within(() =>
        op.withEffect("local-atomic-mutation", () =>
          op.withEffect("read", () => target.call("receive", { method: "GET" })),
        ),
      ),
    ).rejects.toMatchObject({ code: "EFFECT_NOT_ALLOWED" });
    expect(effects).toBe(3);
  });
  it("runs actual emitted caller and callee routes with independent user/workload authentication", async () => {
    const generated = loader(true, true);
    for (const [name, value] of Object.entries({
      JEEVES_WORKLOAD_ISSUER: issuer,
      JEEVES_WORKLOAD_TOKEN_URL: settings.tokenUrl,
      JEEVES_WORKLOAD_JWKS_URL: settings.jwksUrl,
      JEEVES_TILE_CALLEE_URL: "https://callee.example",
      OIDC_ISSUER: issuer,
      OIDC_AUDIENCE: "issuer-web",
      OIDC_JWKS_URL: settings.jwksUrl,
    }))
      vi.stubEnv(name, value);
    const before = apps.length;
    await import(generated.load("src/processes/callee.ts"));
    const callee = apps[before];
    const workload = token();
    const user = token({ aud: "issuer-web" }, false);
    let forwarded: Record<string, string> | undefined;
    let wire: { status: number; body: string; headers: Record<string, string> } | undefined;
    const fetch = vi.fn(async (url: URL | string, init: RequestInit) => {
      if (String(url) === settings.tokenUrl)
        return new Response(JSON.stringify({ access_token: workload }));
      forwarded = Object.fromEntries(new Headers(init.headers));
      const answer = await callee.inject({
        method: init.method,
        url: new URL(url).pathname,
        headers: forwarded,
        payload: init.body,
      });
      wire = { status: answer.statusCode, body: answer.body, headers: answer.headers };
      return new Response([204, 205, 304].includes(answer.statusCode) ? null : answer.body, {
        status: answer.statusCode,
        headers: answer.headers,
      });
    });
    vi.stubGlobal("fetch", fetch);
    await import(generated.load("src/processes/caller.ts"));
    const caller = apps[before + 1];
    const good = await caller.inject({
      method: "GET",
      url: "/modules/send",
      headers: { authorization: `Bearer ${user}` },
    });
    expect(good.statusCode).toBe(200);
    expect(good.json()).toEqual({ ok: true, user: "user-7" });
    expect(wire?.headers["cache-control"]).toBe("no-store");
    expect(forwarded).toMatchObject({
      authorization: `Bearer ${user}`,
      "x-jeeves-workload": `Bearer ${workload}`,
    });
    expect(JSON.stringify(good.json())).not.toContain(user);
    const receiver = await import(generated.load("src/modules/callee/receive.ts"));
    expect(receiver.lastRequest).toEqual({ path: "/", rawPath: "/" });
    const postEmpty = await caller.inject({
      method: "POST",
      url: "/modules/send",
      headers: { authorization: `Bearer ${user}` },
    });
    expect(postEmpty.statusCode).toBe(200);
    expect(postEmpty.json()).toEqual({ ok: true, user: "user-7" });
    expect(forwarded).not.toHaveProperty("content-type");
    for (const [shape, status, body] of [
      ["string", 200, '"primitive"'],
      ["null", 200, "null"],
      ["empty", 200, "null"],
      ["no-content", 204, ""],
    ] as const) {
      const result = await caller.inject({
        method: "POST",
        url: "/modules/send",
        headers: { authorization: `Bearer ${user}` },
        payload: { response: shape },
      });
      expect(result.statusCode, shape).toBe(status);
      expect(wire, shape).toMatchObject({ status, body });
      expect(wire?.headers["cache-control"]).toBe("no-store");
      expect(wire?.headers["content-encoding"]).toBeUndefined();
      expect(wire?.headers["x-product"]).toBeUndefined();
      if (shape === "string") {
        expect(wire?.headers["content-type"]).toContain("application/json");
        expect(wire?.headers["content-length"]).toBe(String(Buffer.byteLength(body)));
        expect(result.body).toBe("primitive");
      }
      expect(receiver.lastRequest).toEqual({ path: "/", rawPath: "/" });
    }
    const previous = receiver.observations;
    const unknown = await caller.inject({
      method: "POST",
      url: "/modules/send",
      headers: { authorization: `Bearer ${user}` },
      payload: { response: "oversized" },
    });
    expect(receiver.observations).toBe(previous + 1);
    expect(unknown.statusCode).toBe(503);
    expect(unknown.json().error).toBe("OUTCOME_UNKNOWN");
    expect(unknown.headers["x-jeeves-outcome"]).toBe("unknown");
    expect(wire?.headers["x-jeeves-outcome"]).toBe("unknown");
    const refused = await callee.inject({
      method: "POST",
      url: "/internal/modules/receive",
      headers: { authorization: `Bearer ${user}`, "x-jeeves-workload": `Bearer ${workload}` },
      payload: { large: "x".repeat(16385) },
    });
    expect(refused.statusCode).toBe(400);
    expect(receiver.observations).toBe(previous + 1);
    for (const headers of [
      { authorization: `Bearer ${user}` },
      { "x-jeeves-workload": `Bearer ${workload}` },
      {
        authorization: `Bearer ${token({ aud: ["issuer-web", "jeeves-service-callee"] })}`,
        "x-jeeves-workload": `Bearer ${workload}`,
      },
    ])
      expect(
        (await callee.inject({ method: "GET", url: "/internal/modules/receive", headers }))
          .statusCode,
      ).toBe(401);
    expect(
      (
        await callee.inject({
          method: "GET",
          url: "/modules/receive",
          headers: { authorization: `Bearer ${user}` },
        })
      ).statusCode,
    ).toBe(200);
    const noUser = await caller.inject({ method: "GET", url: "/modules/send" });
    expect(noUser.statusCode).toBe(401);
  });
});

it("RG10 authenticated internal POST and the in-process core share replay identity and ordering", async () => {
  const { fixture, load } = await import("./local-operation.test.helpers.ts");
  const { invokeLocalModule } = await import(load("local-operation"));
  const f = await fixture();
  const generated = loader(true);
  const { createHttpService } = await import(generated.load("src/runtime/http.ts"));
  const { stubRoutes } = await import(generated.load("src/runtime/tile-http.ts"));
  const { createTileGuard } = await import(generated.load("src/runtime/tile-guard.ts"));
  const { createPrincipalVerifier } = await import(generated.load("src/runtime/identity.ts"));
  const serviceRuntime = await import(generated.load("src/runtime/workload.ts"));
  vi.stubEnv("JEEVES_TILE_CALLEE_URL", "https://callee.example");
  let admissions = 0,
    unavailable = false;
  let local = f.define({
    admit: async () => {
      admissions++;
      if (unavailable) throw Error("reputation down");
    },
  });
  const guard = createTileGuard({
    signIn: "required",
    verify: createPrincipalVerifier({
      issuer,
      audience: "issuer-web",
      jwksUrl: settings.jwksUrl,
      algorithms: ["RS256"],
      jwksTimeoutMs: 2000,
    }),
  });
  const credentials = serviceRuntime.createWorkload(
    { ...settings, client: "jeeves-workload-callee", audience: "jeeves-service-callee" },
    [],
  );
  const logs = vi.spyOn(console, "log").mockImplementation(() => {});
  const service = await createHttpService({
    id: "local-operation",
    settings: { requestTimeoutMs: 10000, concurrencyLimit: 10 },
    initialize: async () => {},
    configure(routes: unknown) {
      stubRoutes(
        serviceRuntime.workloadRoutes(guard.routes(routes), credentials, ["caller"]),
        () => {},
        "receive",
        (request: unknown) => local.route(f.dependencies, request),
        { deadlineMs: 10000 },
        (request: unknown) => guard.caller(request),
        "/internal/modules",
      );
    },
  });
  try {
    await service.start({ host: "127.0.0.1", port: 0 });
    const workload = token();
    const user = token({ aud: "issuer-web", sub: "alice" }, false);
    const fetched: Record<string, string>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string, init: RequestInit) => {
        const headers = Object.fromEntries(new Headers(init.headers));
        fetched.push(headers);
        const response = await service.inject({
          method: init.method,
          url: new URL(url).pathname,
          headers,
          payload: init.body,
        });
        return new Response(response.body, {
          status: response.statusCode,
          headers: response.headers,
        });
      }),
    );
    const target = serviceRuntime.serviceTarget({
      tile: "callee",
      operations: ["receive"],
      forwardUser: true,
      credentials: { acquire: async () => workload },
    });
    const call = (key: string, input: unknown) =>
      within(async () => {
        op.rememberVerifiedBearer(user);
        return target.call("receive", { method: "POST", key, body: input });
      }, 10000);
    const first = await call("shared", { id: "one" });
    unavailable = true;
    expect(first).toEqual({ status: 201, body: { id: "one", secret: "replay-secret" } });
    const running = op.operation({ maximumMs: 10000, caller: { subject: "alice" } });
    try {
      expect(
        await op.withOperation(running.context, () =>
          invokeLocalModule(
            local,
            f.dependencies,
            { key: "shared", input: { id: "one" } },
            async () => {
              throw Error("legacy route bypass");
            },
          ),
        ),
      ).toEqual(first);
    } finally {
      running.close();
    }
    expect(await call("shared", { id: "one" })).toEqual(first);
    expect(admissions).toBe(1);
    expect(await call("shared", { id: "changed" })).toMatchObject({
      status: 409,
      body: { error: "IDEMPOTENCY_CONFLICT" },
    });
    expect(fetched[0]).toMatchObject({
      "idempotency-key": "shared",
      "x-jeeves-workload": `Bearer ${workload}`,
      authorization: `Bearer ${user}`,
    });
    for (const headers of [
      { "x-jeeves-workload": `Bearer ${workload}` },
      { authorization: `Bearer ${user}` },
    ]) {
      const denied = await service.inject({
        method: "POST",
        url: "/internal/modules/receive",
        headers: { ...headers, "idempotency-key": "shared" },
        payload: { id: "one" },
      });
      expect(denied.statusCode).toBe(401);
    }
    expect((await f.pg.query("SELECT count(*)::int AS n FROM p_app.items")).rows).toEqual([
      { n: 1 },
    ]);
    expect(JSON.stringify(logs.mock.calls)).not.toContain("replay-secret");
    expect(JSON.stringify(logs.mock.calls)).not.toContain("jke1.");
    let nullableEffects = 0;
    local = f.define({
      validate: (input: unknown) => input,
      mutate: async (
        input: unknown,
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        nullableEffects++;
        await commands.call("insert", [input === undefined ? "absence" : "null", "alice"]);
        return { status: 201, body: { present: input !== undefined } };
      },
    });
    const absent = await call("presence", undefined);
    expect(absent).toEqual({ status: 201, body: { present: false } });
    const nullableContext = op.operation({ maximumMs: 10000, caller: { subject: "alice" } });
    try {
      expect(
        await op.withOperation(nullableContext.context, () =>
          invokeLocalModule(
            local,
            f.dependencies,
            { key: "presence", input: undefined },
            async () => {
              throw Error("legacy bypass");
            },
          ),
        ),
      ).toEqual(absent);
      await expect(
        op.withOperation(nullableContext.context, () =>
          invokeLocalModule(
            local,
            f.dependencies,
            { key: "presence", input: null },
            async () => {},
          ),
        ),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    } finally {
      nullableContext.close();
    }
    expect(await call("presence", null)).toMatchObject({
      status: 409,
      body: { error: "IDEMPOTENCY_CONFLICT" },
    });
    expect(nullableEffects).toBe(1);
    let normalizedEffects = 0;
    local = f.define({
      validate: (input: unknown) => {
        const value = input as { a: { value: number }; z: { value: number } };
        expect(Object.keys(value)).toEqual(["a", "z"]);
        expect(value.a).not.toBe(value.z);
        expect(Object.is(value.a.value, -0)).toBe(false);
        return { z: value.z, a: value.a };
      },
      mutate: async (input: unknown) => {
        normalizedEffects++;
        expect(Object.keys(input as object)).toEqual(["a", "z"]);
        return { status: 200, body: { normalized: true } };
      },
    });
    const shared = { value: -0 };
    expect(await f.run(local, "normalized", { z: shared, a: shared })).toEqual({
      status: 200,
      body: { normalized: true },
    });
    expect(await call("normalized", { a: { value: 0 }, z: { value: 0 } })).toEqual({
      status: 200,
      body: { normalized: true },
    });
    expect(normalizedEffects).toBe(1);
    const before = fetched.length;
    for (const request of [
      { method: "POST", key: "bad key", body: {} },
      { method: "GET", key: "shared" },
    ])
      await expect(within(() => target.call("receive", request))).rejects.toMatchObject({
        code: "INVALID_SERVICE_CALL",
      });
    expect(fetched).toHaveLength(before);
  } finally {
    await service.close();
    logs.mockRestore();
    await f.pg.close();
  }
});

it("RG15 emits and reports the framework-owned opt-in work protocol without making an unfinished stub runnable", async () => {
  const { remoteDurableWorkDesign } = await import(
    "../../../field-projects/generator-system/fixtures/rg-durable-work/design.ts"
  );
  const bundle = assembleV2(
    { designJson: JSON.stringify(await remoteDurableWorkDesign()) },
    registry,
  );
  const text = (path: string) =>
    new TextDecoder().decode(bundle.files.find((file) => file.path === path)?.bytes);
  expect(text("src/processes/callee.ts")).toContain(
    'invokeWorkProtocol((ReceiveModule as { localOperation?: unknown }).localOperation, dependencies["receive"], request)',
  );
  expect(text("src/processes/callee.ts")).toContain('"/internal/work"');
  const report = JSON.parse(text(".jeeves/report.json"));
  const callee = report.processes.tiles.find(
    (process: { tile: string }) => process.tile === "callee",
  );
  expect(callee.routes).toContainEqual({
    method: "POST",
    path: "/internal/work/receive",
    answers: expect.stringContaining(
      "refuses unless the module explicitly declares a workload-only operation",
    ),
  });
  expect(callee.templates).not.toContainEqual(expect.objectContaining({ level: "mounted" }));

  expect(text("src/runtime/module-clients.ts")).toContain("process: binding.tile");
});

it("RG15 uses the actual authenticated generated protocol for restart-safe work and finite ticket recovery", async () => {
  const helpers = await import("./local-operation.test.helpers.ts");
  const { durableWorkMigration } = await import("./client-wiring.ts");
  const local = await import(helpers.load("local-operation"));
  const workRuntime = await import(helpers.load("durable-work"));
  const caller = await helpers.fixture(),
    callee = await helpers.fixture();
  for (const f of [caller, callee])
    await f.pg.exec(
      `${durableWorkMigration.sql} GRANT SELECT,INSERT,UPDATE,DELETE ON jeeves.work_records,jeeves.work_tickets TO runtime;`,
    );
  const generated = loader();
  const serviceRuntime = await import(generated.load("src/runtime/workload.ts"));
  const { createHttpService } = await import(generated.load("src/runtime/http.ts"));
  const { stubRoutes } = await import(generated.load("src/runtime/tile-http.ts"));
  const remoteDefinition = {
    database: "db",
    id: "remote-item",
    version: 1,
    retentionSeconds: 60,
    secret: false,
    validate: (input: unknown) => input,
    admit: async () => {},
    mutate: async (
      input: { id: string },
      commands: { call(name: string, values: unknown[]): Promise<unknown> },
      principal: { processId: string },
    ) => {
      await commands.call("insert", [input.id, principal.processId]);
      const empty = /^empty-(204|205)$/.exec(input.id);
      return empty
        ? { status: Number(empty[1]), body: null }
        : { status: 201, body: { id: input.id } };
    },
  };
  let remote = local.defineWorkloadOperation(remoteDefinition);
  expect(Object.keys(remote)).toEqual([]);
  await expect(
    (async () => local.invokeLocalModule(remote, {}, {}, async () => null))(),
  ).rejects.toMatchObject({ code: "WORKLOAD_OPERATION_REQUIRED" });
  const bindRemote = () =>
    local.bindLocalOperation(
      callee.dependencies.db,
      local.localOperationDefinition(remote, "db", true),
      {
        tile: "callee",
        module: "receive",
        productRole: "product",
        pool: callee.pool,
        commands: callee.commands,
        keys: helpers.ring(),
      },
    );
  expect(() =>
    local.validateLocalOperationBinding(remote, ["db"], { workload: true, requiredUser: true }),
  ).toThrow(/Required user/);
  expect(() =>
    local.validateLocalOperationBinding(remote, ["db"], { workload: false, requiredUser: false }),
  ).toThrow(/authenticated/);
  bindRemote();
  const credential = serviceRuntime.createWorkload(
    { ...settings, client: "jeeves-workload-callee", audience: "jeeves-service-callee" },
    [],
  );
  const server = await createHttpService({
    id: "work-protocol",
    settings: { requestTimeoutMs: 10000, concurrencyLimit: 10 },
    initialize: async () => {},
    configure(routes: unknown) {
      stubRoutes(
        serviceRuntime.workloadRoutes(routes, credential, ["caller"]),
        () => {},
        "receive",
        (request: unknown) => local.invokeWorkProtocol(remote, callee.dependencies, request),
        { deadlineMs: 10000 },
        undefined,
        "/internal/work",
      );
    },
  });
  vi.stubEnv("JEEVES_TILE_CALLEE_URL", "https://callee.example");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const traffic: {
    phase: string;
    key: string;
    ticket?: string;
    headers: Record<string, string>;
  }[] = [];
  let drop: "prepare" | "execute" | undefined;
  let holdExecute: undefined | (() => Promise<void>);
  const tokenValue = token();
  let freshCredentials = 0;
  let duringCredential: undefined | (() => Promise<void>);
  const target = serviceRuntime.serviceTarget({
    tile: "callee",
    operations: ["receive"],
    forwardUser: true,
    credentials: {
      acquire: async () => {
        freshCredentials++;
        await duringCredential?.();
        return tokenValue;
      },
    },
  });
  const definition = {
    database: "db",
    id: "replicate",
    version: 1,
    retentionSeconds: 60,
    maxAttempts: 4,
    integration: { target: "remote", operation: "receive", map: (input: unknown) => input },
    validate: (input: unknown) => input,
    complete: async (
      input: { id: string },
      commands: { call(name: string, values: unknown[]): Promise<unknown> },
      _principal: unknown,
      result: { status: number; body: { id: string } },
    ) => {
      const empty = /^empty-(204|205)$/.exec(input.id);
      expect(result).toEqual(
        empty ? { status: Number(empty[1]), body: null } : { status: 201, body: { id: input.id } },
      );
      if (!empty) expect(Object.isFrozen(result.body)).toBe(true);
      await commands.call("insert", [input.id, "local"]);
    },
  };
  const absent = workRuntime.defineDurableWork({
    ...definition,
    integration: { ...definition.integration, map: () => undefined },
  });
  const absentDependencies = { db: {}, remote: target };
  workRuntime.bindDurableWork(
    absentDependencies.db,
    workRuntime.durableWorkDefinition(absent, "db", true),
    {
      process: "caller",
      namespace: "absent",
      pool: caller.pool,
      productRole: "product",
      commands: caller.commands,
    },
  );
  const beforeAbsent = caller.trace.length;
  await expect(
    within(
      () => absent.accept(absentDependencies, { key: "absent", input: { id: "absent" } }),
      10000,
    ),
  ).rejects.toMatchObject({ code: "WORK_INPUT" });
  expect(caller.trace).toHaveLength(beforeAbsent);
  const descriptor = workRuntime.defineDurableWork(definition);
  const dependencies = { db: caller.dependencies.db, remote: target };
  let ticketFault: "committed" | "rolled-back" | undefined,
    ticketWrite = false;
  const connect = caller.pool.connect.bind(caller.pool);
  const pool = {
    connect: async () => {
      const client = await connect();
      return {
        ...client,
        query: async (sql: string, values?: unknown[]) => {
          if (sql.includes("SET remote_ticket=")) ticketWrite = true;
          if (sql === "COMMIT" && ticketWrite && ticketFault) {
            const fault = ticketFault;
            ticketFault = undefined;
            ticketWrite = false;
            await client.query(fault === "committed" ? "COMMIT" : "ROLLBACK");
            throw Object.assign(Error("ticket commit response lost"), { code: "EPIPE" });
          }
          if (sql === "COMMIT") ticketWrite = false;
          return client.query(sql, values);
        },
      };
    },
  };
  const options = {
    process: "caller",
    namespace: '["db","owner","replicate"]',
    pool,
    productRole: "product",
    commands: caller.commands,
  };
  const store = workRuntime.bindDurableWork(
    dependencies.db,
    workRuntime.durableWorkDefinition(descriptor, "db", true),
    options,
  );
  store.configureTarget(target);
  expect(() => store.configureTarget({ call: async () => ({ status: 200, body: {} }) })).toThrow(
    /installed/,
  );
  const reclaim = async () => {
    await caller.pg.exec(
      "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' WHERE state='running' OR state='retry'",
    );
    return (await store.claim(1))[0];
  };
  let stage = "start";
  try {
    await server.start({ host: "127.0.0.1", port: 0 });
    for (const [bearer, status] of [
      [undefined, 401],
      [token({ aud: "wrong" }), 401],
      [token({ azp: "jeeves-workload-other", jeeves_workload: "other" }), 403],
    ] as const) {
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/internal/work/receive",
            headers: bearer ? { "x-jeeves-workload": `Bearer ${bearer}` } : {},
            payload: { phase: "prepare", key: "auth", input: { id: "auth" } },
          })
        ).statusCode,
      ).toBe(status);
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        const headers = Object.fromEntries(new Headers(init.headers));
        traffic.push({ ...body, headers });
        expect(new URL(url).pathname).toBe("/internal/work/receive");
        const response = await server.inject({
          method: init.method,
          url: new URL(url).pathname,
          headers,
          payload: init.body,
        });
        if (drop === body.phase) {
          drop = undefined;
          throw Error("response lost after callee settlement");
        }
        if (body.phase === "execute") await holdExecute?.();
        return new Response(response.body, {
          status: response.statusCode,
          headers: response.headers,
        });
      }),
    );
    for (const fault of ["committed", "rolled-back"] as const) {
      stage = fault;
      await within(
        () => descriptor.accept(dependencies, { key: fault, input: { id: fault } }),
        10000,
      );
      const [first] = await store.claim(1);
      ticketFault = fault;
      const before = traffic.length;
      await expect(within(() => store.dispatch(first), 10000)).rejects.toMatchObject({
        outcome: "unknown",
        code: "COMMIT_RESPONSE_LOST",
      });
      expect(traffic.slice(before).map((row) => row.phase)).toEqual(["prepare"]);
      const saved = (
        await caller.pg.query<{ remote_ticket: string | null }>(
          "SELECT remote_ticket FROM jeeves.work_records WHERE work_key=$1",
          [fault],
        )
      ).rows[0]?.remote_ticket;
      expect(!!saved).toBe(fault === "committed");
      const worker = workRuntime.createWorkStore({ ...options, process: "worker", definition });
      worker.configureTarget(target);
      expect(await worker.claim(1)).toEqual([]);
      await expect(worker.accept("{}", fault, { id: fault }, { id: fault })).rejects.toMatchObject({
        code: "WORK_CONFIGURATION_CONFLICT",
      });
      expect(
        (
          await caller.pg.query<{ remote_ticket: string | null }>(
            "SELECT remote_ticket FROM jeeves.work_records WHERE work_key=$1",
            [fault],
          )
        ).rows[0]?.remote_ticket,
      ).toBe(saved);
      const next = await reclaim();
      expect(next.identity).toBe(first.identity);
      await within(() => store.dispatch(next), 10000);
      await store.complete(next);
      expect(traffic.slice(before).map((row) => row.phase)).toEqual(
        fault === "committed" ? ["prepare", "execute"] : ["prepare", "prepare", "execute"],
      );
    }
    for (const phase of ["prepare", "execute"] as const) {
      stage = phase;
      await within(
        () =>
          descriptor.accept(dependencies, { key: `lost-${phase}`, input: { id: `lost-${phase}` } }),
        10000,
      );
      drop = phase;
      const events: string[] = [];
      await within(() => store.runBatch((event: string) => events.push(event)), 10000);
      expect(events).toEqual(["work outcome unknown"]);
      const before = traffic.length;
      if (phase === "execute")
        await callee.pg.query(
          "UPDATE jeeves.work_tickets SET expires_at=clock_timestamp()-interval '1 second' WHERE work_key=$1",
          [traffic.at(-1)?.key],
        );
      const next = await reclaim();
      await within(() => store.dispatch(next), 10000);
      await store.complete(next);
      expect(traffic.slice(before).map((row) => row.phase)).toEqual(
        phase === "prepare" ? ["prepare", "execute"] : ["execute"],
      );
      const attempts = traffic.filter(
        (row) => row.key === next.identity && row.phase === "execute",
      );
      expect(new Set(attempts.map((row) => row.ticket)).size).toBe(1);
    }
    for (const status of [204, 205]) {
      stage = `empty-${status}`;
      await within(
        () => descriptor.accept(dependencies, { key: stage, input: { id: stage } }),
        10000,
      );
      drop = "execute";
      const events: string[] = [];
      await within(() => store.runBatch((event: string) => events.push(event)), 10000);
      expect(events).toEqual(["work outcome unknown"]);
      const next = await reclaim();
      await within(() => store.dispatch(next), 10000);
      await store.complete(next);
      expect(await descriptor.status(dependencies, stage)).toMatchObject({
        state: "completed",
        attempts: 2,
      });
      expect(
        (await callee.pg.query("SELECT count(*)::int n FROM p_app.items WHERE id=$1", [stage]))
          .rows,
      ).toEqual([{ n: 1 }]);
    }
    stage = "known";
    // Known remote result survives a crash before local completion; another replica never redispatches it.
    await within(
      () => descriptor.accept(dependencies, { key: "known", input: { id: "known" } }),
      10000,
    );
    const [known] = await store.claim(1);
    await within(() => store.dispatch(known), 10000);
    const beforeKnown = traffic.length;
    const other = workRuntime.createWorkStore({ ...options, definition });
    other.configureTarget(target);
    await caller.pg.exec(
      "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second' WHERE work_key='known'",
    );
    const [recovered] = await other.claim(1);
    await within(() => other.dispatch(recovered), 10000);
    await other.complete(recovered);
    expect(traffic).toHaveLength(beforeKnown);
    stage = "expiry";
    // Existing uncertain work retains its original ticket even after BOTH callee tables are cleaned.
    await within(
      () => descriptor.accept(dependencies, { key: "expired", input: { id: "expired" } }),
      10000,
    );
    drop = "execute";
    await within(() => store.runBatch(() => {}), 10000);
    await callee.pg.exec(
      "UPDATE jeeves.work_tickets SET expires_at=clock_timestamp()-interval '1 second'; UPDATE jeeves.idempotency_records SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await local.sweepWorkTickets(callee.pool);
    await helpers.sweepExpired(callee.pool);
    const beforeExpired = traffic.length;
    const expired = await reclaim();
    expect(await within(() => store.dispatch(expired), 10000)).toBe(false);
    expect(traffic.slice(beforeExpired).map((row) => row.phase)).toEqual(["execute"]);
    expect(await descriptor.status(dependencies, "expired")).toMatchObject({ state: "unknown" });
    expect(
      (await callee.pg.query("SELECT count(*)::int n FROM p_app.items WHERE id='expired'")).rows,
    ).toEqual([{ n: 1 }]);
    stage = "reuse";
    // Reuse after declared local retention is a new acceptance generation and remote identity.
    await caller.pg.exec(
      "UPDATE jeeves.work_records SET expires_at=clock_timestamp()-interval '1 second' WHERE work_key='known'",
    );
    await store.sweep();
    await within(
      () => descriptor.accept(dependencies, { key: "known", input: { id: "new-generation" } }),
      10000,
    );
    const [newGeneration] = await store.claim(1);
    expect(newGeneration.identity).not.toBe(known.identity);
    await within(() => store.dispatch(newGeneration), 10000);
    await store.complete(newGeneration);
    expect(freshCredentials).toBe(traffic.length);
    stage = "secret";
    remote = local.defineWorkloadOperation({ ...remoteDefinition, secret: true });
    bindRemote();
    await within(
      () => descriptor.accept(dependencies, { key: "secret", input: { id: "private-result" } }),
      10000,
    );
    const [secret] = await store.claim(1);
    const beforeSecret = traffic.length;
    await expect(within(() => store.dispatch(secret), 10000)).rejects.toMatchObject({
      code: "WORK_SECRET_CHECKPOINT_UNSUPPORTED",
    });
    expect(traffic.slice(beforeSecret).map((row) => row.phase)).toEqual(["prepare"]);
    expect(
      (
        await caller.pg.query(
          "SELECT remote_ticket,remote_protocol,remote_result,external_state FROM jeeves.work_records WHERE work_key='secret'",
        )
      ).rows,
    ).toEqual([
      { remote_ticket: null, remote_protocol: null, remote_result: null, external_state: "none" },
    ]);
    expect(
      (await callee.pg.query("SELECT * FROM p_app.items WHERE id='private-result'")).rows,
    ).toEqual([]);
    await store.refuseSecret(secret);
    expect(await descriptor.status(dependencies, "secret")).toEqual({
      state: "failed",
      attempts: 1,
      error: "WORK_SECRET_CHECKPOINT_UNSUPPORTED",
    });
    await within(
      () =>
        descriptor.accept(dependencies, { key: "secret-drain", input: { id: "private-drain" } }),
      10000,
    );
    const refused: string[] = [];
    await within(() => store.runBatch((event: string) => refused.push(event)), 10000);
    expect(refused).toEqual(["work integration refused"]);
    expect(await descriptor.status(dependencies, "secret-drain")).toEqual({
      state: "failed",
      attempts: 1,
      error: "WORK_SECRET_CHECKPOINT_UNSUPPORTED",
    });
    remote = local.defineWorkloadOperation(remoteDefinition);
    bindRemote();
    stage = "protocol";
    const request = async (body: unknown) =>
      server.inject({
        method: "POST",
        url: "/internal/work/receive",
        headers: { "x-jeeves-workload": `Bearer ${tokenValue}` },
        payload: body,
      });
    const issued = JSON.parse(
      (await request({ phase: "prepare", key: "direct", input: { id: "direct" } })).body,
    );
    expect(issued).toMatchObject({ protocol: 1, version: 1, secret: false });
    expect(
      (
        await request({
          phase: "execute",
          key: "direct",
          input: { id: "direct" },
          ticket: issued.ticket,
          protocol: 1,
          version: 2,
        })
      ).statusCode,
    ).toBe(409);
    expect((await callee.pg.query("SELECT * FROM p_app.items WHERE id='direct'")).rows).toEqual([]);
    stage = "admission-expiry";
    let admitted = false;
    remote = local.defineWorkloadOperation({
      ...remoteDefinition,
      admit: async () => {
        admitted = true;
        // Trusted fault injection on the test connection after the first ticket check.
        await callee.pg.exec(
          "UPDATE jeeves.work_tickets SET expires_at=clock_timestamp()-interval '1 second' WHERE work_key='late'",
        );
      },
    });
    bindRemote();
    const late = JSON.parse(
      (await request({ phase: "prepare", key: "late", input: { id: "late" } })).body,
    );
    expect(
      (
        await request({
          phase: "execute",
          key: "late",
          input: { id: "late" },
          ticket: late.ticket,
          protocol: 1,
          version: 1,
        })
      ).statusCode,
    ).toBe(410);
    expect(admitted).toBe(true);
    expect((await callee.pg.query("SELECT * FROM p_app.items WHERE id='late'")).rows).toEqual([]);
    remote = local.defineWorkloadOperation(remoteDefinition);
    bindRemote();
    stage = "credential-lease";
    await within(
      () => descriptor.accept(dependencies, { key: "lease", input: { id: "lease" } }),
      10000,
    );
    const [lease] = await store.claim(1);
    const beforeLease = traffic.length;
    duringCredential = async () => {
      await caller.pg.exec(
        "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second' WHERE work_key='lease'",
      );
    };
    await expect(within(() => store.dispatch(lease), 10000)).rejects.toMatchObject({
      code: "WORK_LEASE_LOST",
    });
    expect(traffic).toHaveLength(beforeLease);
    duringCredential = undefined;
    const nextLease = await reclaim();
    await within(() => store.dispatch(nextLease), 10000);
    await store.complete(nextLease);
    stage = "hung-transport";
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    holdExecute = () => blocked;
    await within(
      () => descriptor.accept(dependencies, { key: "hung", input: { id: "hung" } }),
      10000,
    );
    const events: string[] = [];
    await within(() => store.runBatch((event: string) => events.push(event)), 1000);
    expect(events).toEqual(["work outcome unknown"]);
    const beforeHung = traffic.length;
    await store.runBatch((event: string) => events.push(event));
    expect(traffic).toHaveLength(beforeHung);
    expect(events).toEqual(["work outcome unknown"]);
    release();
    holdExecute = undefined;
    await new Promise((resolve) => setImmediate(resolve));
    const nextHung = await reclaim();
    await within(() => store.dispatch(nextHung), 10000);
    await store.complete(nextHung);
    expect(
      (await callee.pg.query("SELECT count(*)::int n FROM p_app.items WHERE id='hung'")).rows,
    ).toEqual([{ n: 1 }]);
    expect(traffic.every((row) => !row.headers.authorization)).toBe(true);
    expect((await callee.pg.query("SELECT DISTINCT account FROM p_app.items")).rows).toEqual([
      { account: "caller" },
    ]);
    expect((await caller.pg.query("SELECT count(*)::int n FROM p_app.items")).rows).toEqual([
      { n: 10 },
    ]);
  } catch (error) {
    throw new Error(`RG15 stage ${stage}`, { cause: error });
  } finally {
    await server.close();
    log.mockRestore();
    await caller.pg.close();
    await callee.pg.close();
  }
});

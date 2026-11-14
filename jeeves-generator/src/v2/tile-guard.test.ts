import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { signInStackDesign } from "../../../jeeves/packages/spec/src/fixtures/sign-in-stack.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

// The exact emitted sign-in scaffold, tile HTTP wrappers and multipart hooks file of the sign-in
// stack (V3-06, v3 contract section 2), loaded with their relative imports resolved to the other
// emitted files. Only the token verifier, the routes and the asset lifecycle are fakes.
const bundle = assembleV2(
  { designJson: canonicalJson(signInStackDesign()) },
  loadLocalV2Registry(),
);
const emitted = (path: string) => {
  const file = bundle.files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
const urls = new Map<string, string>();
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;

// The two packages an emitted process imports. Fastify is the Jeeves server's, which pins the
// version the export pins; only `listen` changes: it readies the app without a socket and keeps
// it, so `inject` reaches the real routes. jose 6.2.13 is the export's, not this workspace's: its
// stand-in checks what the emitted verifier asks `jwtVerify` for (an RS256 signature by the test
// key, `iss`, `aud`, `exp` and `sub`) and keeps each audience it was asked to accept.
const issuer = "https://issuer.example/realms/sign-in";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
/** An RS256 token for audience `aud` from issuer `iss`, signed by the test key. */
function token(aud: string, iss = issuer) {
  const exp = Math.floor(Date.now() / 1000) + 300;
  const input = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iss, aud, sub: "sub-1", preferred_username: "viewer", exp })}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), keys.privateKey).toString("base64url")}`;
}
const serverRequire = createRequire(
  new URL("../../../jeeves/apps/server/package.json", import.meta.url),
);
const packages = {
  fastify:
    dataUrl(`import fastify from ${JSON.stringify(pathToFileURL(serverRequire.resolve("fastify")).href)};
export const apps = [];
export default function Fastify(options) {
  const app = fastify(options);
  app.listen = async () => { await app.ready(); apps.push(app); return "http://injected"; };
  return app;
}`),
  jose: dataUrl(`import { createPublicKey, verify } from "node:crypto";
const key = createPublicKey(${JSON.stringify(String(keys.publicKey.export({ type: "spki", format: "pem" })))});
const decode = (text) => JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
export const audiences = [];
export const createRemoteJWKSet = () => async () => key;
export async function jwtVerify(token, _keySet, options) {
  audiences.push(options.audience);
  const [head, body, signature] = token.split(".");
  if (!options.algorithms.includes(decode(head).alg)) throw new Error("unexpected alg");
  if (!verify("RSA-SHA256", Buffer.from(head + "." + body), key, Buffer.from(signature, "base64url")))
    throw new Error("signature verification failed");
  const payload = decode(body);
  if (payload.iss !== options.issuer) throw new Error('unexpected "iss" claim value');
  if (![payload.aud].flat().some((aud) => [options.audience].flat().includes(aud)))
    throw new Error('unexpected "aud" claim value');
  for (const claim of options.requiredClaims)
    if (!(claim in payload)) throw new Error("missing required claim " + claim);
  if (!(payload.exp > Date.now() / 1000)) throw new Error('"exp" claim timestamp check failed');
  return { payload, protectedHeader: decode(head) };
}`),
};
// A process's ready marker goes to a scratch directory, not /tmp.
const markerDirectory = mkdtempSync(join(tmpdir(), "jeeves-guard-"));
function compile(path: string): string {
  return stripTypeScriptTypes(emitted(path))
    .replace(
      /from "(\.\.?\/[^"]+)"/g,
      (_match, relative: string) => `from "${load(posix.join(posix.dirname(path), relative))}"`,
    )
    .replace(
      /from "(fastify|jose)"/g,
      (_match, name: keyof typeof packages) => `from "${packages[name]}"`,
    )
    .replace('"/tmp/application-ready"', JSON.stringify(join(markerDirectory, "ready")));
}
function load(path: string): string {
  const old = urls.get(path);
  if (old) return old;
  const url = dataUrl(compile(path));
  urls.set(path, url);
  return url;
}
const { createTileGuard } = await import(load("src/runtime/tile-guard.ts"));
const { stubRoutes } = await import(load("src/runtime/tile-http.ts"));
const { multipartUploadsHooks } = await import(
  load("src/modules/upload-api/multipart-uploads.hooks.ts")
);
// The apps the Fastify stand-in has started, and the audiences jose's was asked to accept.
const { apps } = await import(packages.fastify);
const { audiences } = await import(packages.jose);

type Handler = (request: unknown, reply?: unknown) => Promise<unknown>;
/** Routes that record what is mounted, by method and URL. */
function routes() {
  const mounted = new Map<string, Handler>();
  return {
    mounted,
    route(options: { method: string | string[]; url: string; handler: Handler }) {
      for (const method of [options.method].flat())
        mounted.set(`${method} ${options.url}`, options.handler);
    },
  };
}
const principal = { subject: "sub-1", claims: { sub: "sub-1", preferred_username: "creator" } };
/** A verifier that accepts only the token "good". */
const verifier = () =>
  vi.fn(async (bearer: string) => {
    if (bearer !== "good") throw new Error("signature verification failed");
    return principal;
  });
const request = (authorization?: string) => ({
  method: "GET",
  params: {},
  query: {},
  headers: authorization === undefined ? {} : { authorization },
  body: undefined,
});
const refused = { statusCode: 401, code: "SIGN_IN_REQUIRED", message: "Sign in to continue." };

/** A guard on the recording routes with one module route and the guard's `me`. */
function guarded(signIn: "required" | "optional") {
  const verify = verifier();
  const guard = createTileGuard({ signIn, verify });
  const open = routes();
  const routed = guard.routes(open);
  const reached = vi.fn(async () => ({ ok: true }));
  routed.route({ method: "GET", url: "/modules/hello", handler: reached });
  guard.me(routed, "/modules/check/me");
  const call = (key: string, authorization?: string) => {
    const handler = open.mounted.get(key);
    if (!handler) throw new Error(`Not mounted: ${key}`);
    return handler(request(authorization), {});
  };
  return { guard, verify, reached, call };
}

describe("emitted tile-guard.ts (v3 contract, section 2)", () => {
  it("Required: 401 without a token or with an invalid one; a valid one reaches the route", async () => {
    const { verify, reached, call } = guarded("required");
    for (const header of [undefined, "", "Bearer bad", "Basic good", "Bearer "]) {
      await expect(call("GET /modules/hello", header)).rejects.toMatchObject(refused);
      await expect(call("GET /modules/check/me", header)).rejects.toMatchObject(refused);
    }
    expect(reached).not.toHaveBeenCalled();
    await expect(call("GET /modules/hello", "Bearer good")).resolves.toEqual({ ok: true });
    await expect(call("GET /modules/check/me", "Bearer good")).resolves.toEqual({
      signedIn: true,
      subject: "sub-1",
      username: "creator",
    });
    expect(verify).toHaveBeenCalledWith("good");
  });

  it("Optional: no token is anonymous, an invalid one is 401, a valid one is the principal", async () => {
    const { reached, call } = guarded("optional");
    await expect(call("GET /modules/hello")).resolves.toEqual({ ok: true });
    await expect(call("GET /modules/check/me")).resolves.toEqual({ signedIn: false });
    await expect(call("GET /modules/hello", "Bearer bad")).rejects.toMatchObject(refused);
    await expect(call("GET /modules/check/me", "Bearer bad")).rejects.toMatchObject(refused);
    await expect(call("GET /modules/check/me", "bearer good")).resolves.toEqual({
      signedIn: true,
      subject: "sub-1",
      username: "creator",
    });
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it("verifies once per request, and require answers 401 for an anonymous caller", async () => {
    const verify = verifier();
    const guard = createTileGuard({ signIn: "optional", verify });
    const signedIn = request("Bearer good");
    expect(await guard.caller(signedIn)).toEqual({ signedIn: true, principal });
    expect(await guard.require(signedIn)).toEqual(principal);
    expect(await guard.caller(signedIn)).toEqual({ signedIn: true, principal });
    expect(verify).toHaveBeenCalledTimes(1);
    await expect(guard.require(request())).rejects.toMatchObject(refused);
    // A username that isn't a string reads as null.
    const plain = createTileGuard({
      signIn: "required",
      verify: async () => ({ subject: "s", claims: { sub: "s" } }),
    });
    const open = routes();
    plain.me(plain.routes(open), "/me");
    await expect(open.mounted.get("GET /me")?.(request("Bearer x"))).resolves.toEqual({
      signedIn: true,
      subject: "s",
      username: null,
    });
    expect(() => createTileGuard({ signIn: "sometimes", verify })).toThrow(
      "Invalid sign-in setting",
    );
  });

  it("gives a route stub's request the guard's caller, and anonymous without a guard", async () => {
    const guard = createTileGuard({ signIn: "optional", verify: verifier() });
    const seen: unknown[] = [];
    const entry = async (moduleRequest: { caller: unknown; path: string }) => {
      seen.push([moduleRequest.path, moduleRequest.caller]);
      return { status: 200 };
    };
    const log = () => {};
    const withGuard = routes();
    stubRoutes(guard.routes(withGuard), log, "hello", entry, guard.caller);
    const without = routes();
    stubRoutes(without, log, "plain", entry);
    const reply = { code: () => reply, header: () => reply };
    const get = (open: ReturnType<typeof routes>, key: string, authorization?: string) =>
      open.mounted.get(key)?.({ ...request(authorization), params: { "*": "x" } }, reply);
    await get(withGuard, "GET /modules/hello/*", "Bearer good");
    await get(withGuard, "GET /modules/hello/*");
    await get(without, "GET /modules/plain/*", "Bearer good");
    expect(seen).toEqual([
      ["/x", { signedIn: true, principal }],
      ["/x", { signedIn: false }],
      ["/x", { signedIn: false }],
    ]);
  });

  it("gives a route stub's request the body's bytes, and sends an array header once per value", async () => {
    const cookies: readonly string[] = ["a=1; Path=/", "b=2; Path=/"];
    const seen: unknown[] = [];
    const open = routes();
    stubRoutes(
      open,
      () => {},
      "probe",
      async (moduleRequest: unknown) => {
        seen.push(moduleRequest);
        return { headers: { "Set-Cookie": cookies, "X-Probe": "one" } };
      },
    );
    const headers: [string, unknown][] = [];
    const reply = {
      code: () => reply,
      header: (name: string, value: unknown) => {
        headers.push([name, value]);
        return reply;
      },
    };
    const rawBody = Buffer.from('{"id":"evt_1",  "n": 1.0}');
    const body = { id: "evt_1", n: 1 };
    await open.mounted.get("POST /modules/probe/*")?.(
      { ...request(), method: "POST", params: { "*": "events" }, body, rawBody },
      reply,
    );
    expect(seen).toEqual([
      {
        method: "POST",
        path: "/events",
        query: {},
        headers: {},
        body,
        rawBody,
        caller: { signedIn: false },
      },
    ]);
    // Each value in order, from a copy: Fastify may add to the array it is given.
    expect(headers).toEqual([
      ["Set-Cookie", ["a=1; Path=/", "b=2; Path=/"]],
      ["X-Probe", "one"],
    ]);
    expect(headers[0]?.[1]).not.toBe(cookies);
    // The types a stub compiles against.
    const entryTypes = emitted("src/modules/entry.ts");
    expect(entryTypes).toContain("  rawBody?: Uint8Array;\n");
    expect(entryTypes).toContain("  headers?: Record<string, string | readonly string[]>;\n");
  });
});

describe("emitted multipart hooks beside a sign-in and an asset lifecycle (V3-06)", () => {
  it("answer principal from the guard and delegate reserve, complete and closed", async () => {
    const guard = { require: vi.fn(async () => principal), caller: vi.fn() };
    const lifecycle = {
      reserve: vi.fn(async () => undefined),
      complete: vi.fn(async () => ({ assetId: "a", state: "pending" })),
      closed: vi.fn(async () => undefined),
    };
    const hooks = multipartUploadsHooks({ prefix: "multipart-uploads/", guard, lifecycle });
    const incoming = request("Bearer good");
    expect(await hooks.principal(incoming)).toBe(principal);
    expect(guard.require).toHaveBeenCalledWith(incoming);
    const tx = { query: vi.fn() };
    const record = { assetId: "a", uploadId: "u" };
    const original = { key: "k", size: 1 };
    await hooks.upload.reserve(tx, record);
    expect(await hooks.upload.complete(tx, record, original)).toEqual({
      assetId: "a",
      state: "pending",
    });
    await hooks.upload.closed(tx, record, { state: "aborted" });
    expect(lifecycle.reserve).toHaveBeenCalledWith(tx, record);
    expect(lifecycle.complete).toHaveBeenCalledWith(tx, record, original);
    expect(lifecycle.closed).toHaveBeenCalledWith(tx, record, { state: "aborted" });
    // The rest stay the product's to write.
    expect(() => hooks.upload.validate({}, principal)).toThrow(
      "Not implemented: validate for Multipart uploads",
    );
    expect(() => hooks.job({}, "e")).toThrow("Not implemented: job for Multipart uploads");
  });
});

describe("the emitted sign-in's audience comes from OIDC_AUDIENCE (QG11)", () => {
  type App = {
    inject(request: unknown): Promise<{ statusCode: number; json(): unknown }>;
  };
  const names = ["OIDC_ISSUER", "OIDC_AUDIENCE", "OIDC_JWKS_URL"] as const;
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const signals = ["SIGTERM", "SIGINT"] as const;
  const listening = Object.fromEntries(signals.map((name) => [name, process.listeners(name)]));
  const exitCode = process.exitCode;
  /** Removes the signal listeners the processes started here added. */
  const dropListeners = () => {
    for (const name of signals)
      for (const listener of process.listeners(name))
        if (!listening[name]?.includes(listener)) process.removeListener(name, listener);
  };
  afterEach(() => {
    for (const name of names)
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    dropListeners();
    process.exitCode = exitCode;
    vi.restoreAllMocks();
  });
  afterAll(() => rmSync(markerDirectory, { recursive: true, force: true }));

  let runs = 0;
  /** Starts the emitted Watch API process (an Optional sign-in) with `audience` as its
   * OIDC_AUDIENCE and `urls` in place of the test issuer's OIDC_ISSUER and OIDC_JWKS_URL (undefined
   * unsets one), keeping its console lines; the app is there once it has started. */
  async function run(
    audience: string | undefined,
    urls: Partial<Record<"OIDC_ISSUER" | "OIDC_JWKS_URL", string | undefined>> = {},
  ) {
    const environment = {
      OIDC_ISSUER: issuer,
      OIDC_JWKS_URL: `${issuer}/protocol/openid-connect/certs`,
      ...urls,
      OIDC_AUDIENCE: audience,
    };
    for (const [name, value] of Object.entries(environment))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    const lines: unknown[] = [];
    const keep = (line: string) => lines.push(line.startsWith("{") ? JSON.parse(line) : line);
    vi.spyOn(console, "log").mockImplementation(keep);
    vi.spyOn(console, "error").mockImplementation(keep);
    const before = apps.length;
    process.exitCode = undefined;
    // An earlier run here has stopped or failed to start; its listeners would only pile up.
    dropListeners();
    // A new module each run: the process reads its environment as it starts.
    runs += 1;
    await import(dataUrl(`${compile("src/processes/watch-api.ts")}\n// run ${runs}\n`));
    return { lines, app: (apps.length > before ? apps.at(-1) : undefined) as App | undefined };
  }
  /** Stops the newest process as SIGTERM does, once its drains have run. */
  async function stop() {
    const listener = process.listeners("SIGTERM").at(-1);
    if (!listener || listening.SIGTERM?.includes(listener)) throw new Error("No process runs");
    process.removeListener("SIGTERM", listener);
    listener("SIGTERM");
    await vi.waitFor(() => expect(process.exitCode).toBe(0));
  }
  const me = async (app: App | undefined, bearer: string) => {
    if (!app) throw new Error("The process did not start");
    const response = await app.inject({
      method: "GET",
      url: "/modules/viewer-check/me",
      headers: { authorization: `Bearer ${bearer}` },
    });
    return [response.statusCode, response.json()];
  };
  const signedIn = [200, { signedIn: true, subject: "sub-1", username: "viewer" }];
  const refused = [401, { error: "SIGN_IN_REQUIRED", message: "Sign in to continue." }];

  it("accepts a token for the audience OIDC_AUDIENCE names and refuses one for another", async () => {
    audiences.length = 0;
    const deployed = await run("api://example");
    expect(deployed.lines).toContain("Application ready");
    expect(await me(deployed.app, token("api://example"))).toEqual(signedIn);
    expect(await me(deployed.app, token("sign-in-web"))).toEqual(refused);
    await stop();
    // Compose's local value, the browser client's: its tokens pass as before, the other is refused.
    const local = await run("sign-in-web");
    expect(await me(local.app, token("sign-in-web"))).toEqual(signedIn);
    expect(await me(local.app, token("api://example"))).toEqual(refused);
    await stop();
    expect(audiences).toEqual(["api://example", "api://example", "sign-in-web", "sign-in-web"]);
  });

  it("fails startup naming OIDC_AUDIENCE when it is missing or empty", async () => {
    for (const audience of [undefined, ""]) {
      const { lines, app } = await run(audience);
      expect(lines).toEqual([
        {
          level: "error",
          event: "startup-failed",
          error: "Error: OIDC_AUDIENCE must name the audience of the sign-in tokens.",
        },
        "Application startup failed",
      ]);
      expect(process.exitCode).toBe(1);
      // It stopped before its HTTP service: no app was started.
      expect(app === undefined).toBe(true);
    }
  });

  it("fails startup naming each OIDC_* variable that is unset or invalid, never its value (QG24)", async () => {
    const audience = "OIDC_AUDIENCE must name the audience of the sign-in tokens.";
    const cases: [name: string, value: string | undefined, error: string][] = [
      ["OIDC_AUDIENCE", undefined, audience],
      ["OIDC_AUDIENCE", "", audience],
    ];
    // Not an absolute http: or https: URL: unset, empty, relative, without a scheme, or another one.
    const invalid = [
      undefined,
      "",
      "issuer.example/realms/sign-in",
      "/realms/sign-in",
      "//issuer.example/realms/sign-in",
      "not a url",
      "ftp://issuer.example/realms/sign-in",
      "file:///realms/sign-in",
      "ws://issuer.example/realms/sign-in",
    ];
    for (const name of ["OIDC_ISSUER", "OIDC_JWKS_URL"])
      for (const value of invalid) cases.push([name, value, `Invalid endpoint ${name}`]);
    for (const [name, value, error] of cases) {
      const { lines, app } =
        name === "OIDC_AUDIENCE" ? await run(value) : await run("api://example", { [name]: value });
      expect(lines).toEqual([
        { level: "error", event: "startup-failed", error: `Error: ${error}` },
        "Application startup failed",
      ]);
      expect(process.exitCode).toBe(1);
      expect(app === undefined).toBe(true);
      if (value) expect(JSON.stringify(lines)).not.toContain(value);
    }
  });

  it("passes an http: or https: issuer and key set through as they are given (QG24)", async () => {
    // Compose's local shape: an http: issuer on a loopback port, the key set at Keycloak's name.
    const local = "http://127.0.0.1:47922/realms/sign-in";
    const compose = await run("sign-in-web", {
      OIDC_ISSUER: local,
      OIDC_JWKS_URL: "http://identity-sign-in:8080/realms/sign-in/protocol/openid-connect/certs",
    });
    expect(compose.lines).toContain("Application ready");
    expect(await me(compose.app, token("sign-in-web", local))).toEqual(signedIn);
    expect(await me(compose.app, token("sign-in-web"))).toEqual(refused);
    await stop();
    // An issuer without a path is compared as written (no "/" added), and a key set URL may carry
    // a query, as some providers' do.
    const bare = "https://accounts.example";
    const deployed = await run("api://example", {
      OIDC_ISSUER: bare,
      OIDC_JWKS_URL: `${bare}/discovery/v2.0/keys?p=sign-in`,
    });
    expect(await me(deployed.app, token("api://example", bare))).toEqual(signedIn);
    expect(await me(deployed.app, token("api://example", `${bare}/`))).toEqual(refused);
    await stop();
  });
});

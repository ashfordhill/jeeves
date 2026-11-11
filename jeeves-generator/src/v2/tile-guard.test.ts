import { stripTypeScriptTypes } from "node:module";
import { posix } from "node:path";
import { describe, expect, it, vi } from "vitest";
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
function load(path: string): string {
  const old = urls.get(path);
  if (old) return old;
  const js = stripTypeScriptTypes(emitted(path)).replace(
    /from "(\.\.?\/[^"]+)"/g,
    (_match, relative: string) => `from "${load(posix.join(posix.dirname(path), relative))}"`,
  );
  const url = dataUrl(js);
  urls.set(path, url);
  return url;
}
const { createTileGuard } = await import(load("src/runtime/tile-guard.ts"));
const { stubRoutes } = await import(load("src/runtime/tile-http.ts"));
const { multipartUploadsHooks } = await import(
  load("src/modules/upload-api/multipart-uploads.hooks.ts")
);

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

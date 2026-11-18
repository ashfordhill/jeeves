import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { pathToFileURL } from "node:url";
import {
  buildStudioCommand,
  designBlueprintV3,
  designGeneration,
  normalGenerationControls,
  resolveGeneration,
} from "@jeeves/spec";
import { afterEach, describe, expect, it } from "vitest";
import { browserSessionDesign } from "../../../field-projects/generator-system/fixtures/rg-browser-session/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { browserSessionMigration } from "./browser-session.ts";
import {
  databases,
  fixture,
  load,
  operation,
  withOperation,
} from "./local-operation.test.helpers.ts";

const runtime = await import(load("browser-session"));
const { createSealingKeys, createSigningKeys } = await import(load("keys"));
const { keyRing } = await import(load("settings"));
const require = createRequire(new URL("../../../jeeves/apps/server/package.json", import.meta.url));
const httpSource = stripTypeScriptTypes(
  readFileSync(
    new URL("../../templates/local-v2/assets/src/runtime/http.ts.template", import.meta.url),
    "utf8",
  ),
)
  .replace(/from "\.\/([a-z-]+)\.ts"/g, (_m, name: string) => `from "${load(name)}"`)
  .replace('from "fastify"', `from "${pathToFileURL(require.resolve("fastify")).href}"`);
const { createHttpService } = await import(
  `data:text/javascript;base64,${Buffer.from(httpSource).toString("base64")}`
);
const apps: { close(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  await Promise.all(databases.splice(0).map((d) => d.close()));
});
const ring = (ids = ["old"]) =>
  keyRing().parse(
    Buffer.from(
      JSON.stringify(
        ids.map((id) => ({
          id,
          key: Buffer.alloc(32, id === "old" ? 4 : 5).toString("base64url"),
        })),
      ),
    ),
  );
const keys = (ids = ["old"]) => ({
  seal: createSealingKeys(ring(ids), "jeeves.browser.tokens.v1"),
  sign: createSigningKeys(ring(ids), "jeeves.browser.csrf.v1"),
});
async function setup(
  input: { signIn?: string; guest?: boolean; keys?: ReturnType<typeof keys>; issuer?: object } = {},
) {
  const f = await fixture();
  await f.pg.exec(
    `${browserSessionMigration.sql} GRANT SELECT,INSERT,UPDATE,DELETE ON jeeves.browser_sessions,jeeves.browser_logins TO runtime;`,
  );
  const exchangeCalls: unknown[] = [];
  let authorizing: unknown;
  const issuer = {
    async start() {},
    async authorize(values: unknown) {
      authorizing = values;
      return "https://issuer.test/authorize";
    },
    async exchange(url: URL, values: unknown) {
      exchangeCalls.push({ url: String(url), values });
      return {
        subject: "alice",
        email: "a@example.test",
        name: "Alice",
        access: "private-access",
        refresh: "private-refresh",
        id: "private-id",
        expiresIn: 60,
      };
    },
    ...input.issuer,
  };
  const settings = {
    issuer: "https://issuer.test",
    clientId: "browser",
    clientSecret: "private-client",
    callback: "https://app.test/modules/sign-in/callback",
    origin: "https://app.test",
    offlineAccess: false,
    signIn: input.signIn ?? "optional",
    idleSeconds: 3600,
    absoluteSeconds: 86400,
    guestContext: input.guest ?? false,
    keys: input.keys ?? keys(),
  };
  const session = runtime.createBrowserSession({
    namespace: "owner-browser",
    module: "sign-in",
    pool: f.pool,
    settings,
    issuer,
  });
  const app = await createHttpService({
    id: "browser",
    settings: { requestTimeoutMs: 1000, concurrencyLimit: 10 },
    formatError: () => ({ success: true }),
    configure(open: unknown) {
      session.mount(open);
      const routes = session.routes(open);
      for (const method of ["GET", "POST"])
        routes.route({
          method,
          url: "/product",
          handler: (request: unknown) => session.caller(request),
        });
    },
    initialize: () => session.start(),
  });
  apps.push(app);
  await app.start({ host: "127.0.0.1", port: 0 });
  return { ...f, session, app, settings, exchangeCalls, authorizing: () => authorizing };
}
const oneCookie = (r: { cookies: { name: string; value: string }[] }, suffix: string) => {
  const c = r.cookies.find((c) => c.name.endsWith(suffix) && c.value);
  return c ? `${c.name}=${c.value}` : "";
};
async function login(f: Awaited<ReturnType<typeof setup>>, previous?: string) {
  const start = await f.app.inject({ url: "/modules/sign-in/login?returnTo=%2Faccount" });
  expect(start.statusCode).toBe(302);
  const state = (f.authorizing() as { state: string }).state;
  const binding = oneCookie(start, "-login");
  const finish = await f.app.inject({
    url: `/modules/sign-in/callback?code=code&state=${state}`,
    headers: { cookie: [binding, previous].filter(Boolean).join("; ") },
  });
  expect(finish.statusCode).toBe(302);
  return { start, finish, state, binding, cookie: oneCookie(finish, "-session") };
}
const run = async (effect: () => Promise<unknown>) => {
  const op = operation({ maximumMs: 5000 });
  try {
    return await withOperation(op.context, effect);
  } finally {
    op.close();
  }
};

describe("RG19 browser sessions", () => {
  it("authors and exports the finite lead, declared state/grants and explicit bootstrap routes", () => {
    const d = browserSessionDesign(),
      registry = loadLocalV2Registry();
    const resolved = resolveGeneration(d, registry.installed);
    expect(resolved.findings).toEqual([]);
    const selection = resolved.model?.selections.find((x) => x.binding.kind === "browser-session");
    expect(selection?.resources[0]?.access).toBe("read-write");
    const fields = normalGenerationControls(d, registry.installed).filter((c) =>
      c.input.startsWith("session."),
    );
    expect(fields).toHaveLength(5);
    expect(JSON.stringify(designBlueprintV3(d))).toContain("browser-session");
    const bundle = assembleV2({ designJson: JSON.stringify(d) }, registry);
    const text = (path: string) =>
      new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
    expect(text("src/processes/browser-api.ts")).toContain("signIn.mount(open)");
    expect(text("src/processes/browser-api.ts")).toContain("const routes = signIn.routes(open)");
    expect(text("infra/postgres/sessions/054-jeeves-browser-session.sql")).toContain(
      "browser_logins",
    );
    expect(text("src/operations/browser-api-sign-in-revoke-subject.ts")).toContain("subject=$2");
    expect(JSON.stringify(bundle.report)).not.toContain("private-client");
    expect(() =>
      buildStudioCommand(d, { type: "addModule", host: "browser-api", kind: "auth-guard" }),
    ).toThrow(/Browser session/);
    expect(() =>
      buildStudioCommand(d, { type: "addModule", host: "browser-api", kind: "favorites" }),
    ).toThrow(/Required|Browser session/);
    expect(designGeneration(d)?.selections.some((s) => s.binding.kind === "browser-session")).toBe(
      true,
    );
  });
  it("signs in with fresh flagged cookies, hides tokens, refuses callback reuse and session fixation", async () => {
    const f = await setup();
    const a = await login(f);
    expect(a.finish.headers.location).toBe("/account");
    expect(String(a.finish.headers["set-cookie"])).toContain("Secure; HttpOnly; SameSite=Lax");
    const me = await f.app.inject({
      url: "/modules/sign-in/session",
      headers: { cookie: a.cookie },
    });
    expect(me.json()).toMatchObject({ signedIn: true, subject: "alice" });
    expect(me.body).not.toMatch(/private-|access|refresh|cookie_hash/);
    const product = await f.app.inject({ url: "/product", headers: { cookie: a.cookie } });
    expect(product.json()).toMatchObject({ signedIn: true, principal: { subject: "alice" } });
    expect(product.body).not.toContain("private-");
    expect(
      (
        await f.app.inject({
          url: `/modules/sign-in/callback?code=code&state=${a.state}`,
          headers: { cookie: a.binding },
        })
      ).statusCode,
    ).toBe(401);
    expect(f.exchangeCalls).toHaveLength(1);
    const b = await login(f, a.cookie);
    expect(a.cookie).not.toBe(b.cookie);
    expect(
      (await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode,
    ).toBe(401);
    const stored = await f.pg.query<{ access_sealed: string }>(
      "SELECT access_sealed FROM jeeves.browser_sessions WHERE revoked_at IS NULL",
    );
    expect(stored.rows[0]?.access_sealed).toMatch(/^jke1.old\./);
    expect(JSON.stringify(stored.rows)).not.toContain("private-access");
  });
  it("binds one-use state to its browser and expires transactions without issuer dispatch", async () => {
    const f = await setup();
    const start = await f.app.inject({ url: "/modules/sign-in/login" });
    const state = (f.authorizing() as { state: string }).state;
    for (const headers of [{}, { cookie: `__Host-jeeves-sign-in-login=${"x".repeat(43)}` }])
      expect(
        (await f.app.inject({ url: `/modules/sign-in/callback?state=${state}&code=code`, headers }))
          .statusCode,
      ).toBe(401);
    expect(f.exchangeCalls).toHaveLength(0);
    await f.pg.exec(
      "UPDATE jeeves.browser_logins SET expires_at=clock_timestamp()-interval '1 second'",
    );
    expect(
      (
        await f.app.inject({
          url: `/modules/sign-in/callback?state=${state}&code=code`,
          headers: { cookie: oneCookie(start, "-login") },
        })
      ).statusCode,
    ).toBe(401);
    expect(f.exchangeCalls).toHaveLength(0);
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil",
    "/%2f%2fevil",
    "/%252fevil",
    "/a/../evil",
    "/a%0d%0aLocation:x",
    "/fragment#x",
    "/a b",
  ])("refuses unsafe return path %s", async (path) => {
    expect(() => runtime.safeReturnPath(path)).toThrow();
  });
  it("does not clear omitted Lax cookies on a cross-site cookieless logout", async () => {
    const f = await setup();
    const a = await login(f);
    const result = await f.app.inject({
      method: "POST",
      url: "/modules/sign-in/logout",
      headers: { origin: "https://evil.test" },
    });
    expect(result.statusCode).toBe(204);
    expect(result.headers["set-cookie"]).toBeUndefined();
    expect(
      (await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode,
    ).toBe(200);
  });
  it("rejects duplicate, malformed, bearer and expired guest credentials on optional routes", async () => {
    const f = await setup({ guest: true });
    const a = await login(f);
    for (const headers of [
      { cookie: `${a.cookie}; ${a.cookie}` },
      { cookie: "__Host-jeeves-sign-in-guest=invalid" },
      { authorization: "Bearer invalid" },
    ]) {
      const response = await f.app.inject({ url: "/product", headers });
      expect(response.statusCode).toBe(401);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
    }
    const expired = f.settings.keys.sign.sign(`${"x".repeat(43)}:1000000000000`, {
      scope: createHash("sha256")
        .update(
          JSON.stringify([
            "owner-browser",
            createHash("sha256")
              .update(JSON.stringify([f.settings.issuer, f.settings.clientId]))
              .digest("hex"),
          ]),
        )
        .digest("hex"),
      context: "guest",
    });
    expect(
      (
        await f.app.inject({
          url: "/product",
          headers: { cookie: `__Host-jeeves-sign-in-guest=${expired}` },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("retains old sealing keys while new writes use current; a removed key invalidates the session", async () => {
    const f = await setup();
    const a = await login(f);
    f.settings.keys = keys(["new", "old"]);
    expect(
      (await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode,
    ).toBe(200);
    const b = await login(f);
    expect(
      (
        await f.pg.query<{ access_sealed: string | null }>(
          "SELECT access_sealed FROM jeeves.browser_sessions WHERE revoked_at IS NULL",
        )
      ).rows.some((r) => String(r.access_sealed).startsWith("jke1.new.")),
    ).toBe(true);
    f.settings.keys = keys(["new"]);
    expect(
      (await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode,
    ).toBe(401);
    expect(
      (await f.app.inject({ url: "/product", headers: { cookie: b.cookie } })).statusCode,
    ).toBe(200);
  });
  it("enforces session CSRF and logout before product formatting; no cookieless authentication", async () => {
    const f = await setup();
    expect((await f.app.inject({ url: "/product" })).json()).toEqual({ signedIn: false });
    const a = await login(f);
    const me = (
      await f.app.inject({ url: "/modules/sign-in/session", headers: { cookie: a.cookie } })
    ).json();
    for (const headers of [
      { cookie: a.cookie },
      { cookie: a.cookie, origin: "https://evil.test", "x-csrf-token": me.csrf },
      { cookie: a.cookie, origin: "https://app.test", "x-csrf-token": "wrong" },
    ]) {
      const result = await f.app.inject({ method: "POST", url: "/product", headers });
      expect(result.statusCode).toBe(403);
      expect(result.json()).toEqual({ success: true });
    }
    const headers = { cookie: a.cookie, origin: "https://app.test", "x-csrf-token": me.csrf };
    expect((await f.app.inject({ method: "POST", url: "/product", headers })).statusCode).toBe(200);
    expect(
      (await f.app.inject({ method: "POST", url: "/modules/sign-in/logout", headers })).statusCode,
    ).toBe(204);
    expect(
      (await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode,
    ).toBe(401);
  });
  it("coordinates guest cookies with CSRF and keeps only immutable guest facts in product requests", async () => {
    const f = await setup({ guest: true });
    const me = await f.app.inject({ url: "/modules/sign-in/session" });
    const cookie = oneCookie(me, "-guest");
    expect(cookie).toContain("__Host-");
    expect((await f.app.inject({ method: "POST", url: "/product" })).statusCode).toBe(403);
    expect(
      (await f.app.inject({ method: "POST", url: "/product", headers: { cookie } })).statusCode,
    ).toBe(403);
    const result = await f.app.inject({
      method: "POST",
      url: "/product",
      headers: { cookie, origin: "https://app.test", "x-csrf-token": me.json().csrf },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
      signedIn: false,
      guest: { id: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(result.body).not.toContain(cookie.split("=")[1]);
  });
  it.each(["idle", "absolute"])(
    "irreversibly expires %s state and clears bad supplied cookies even on optional routes",
    async (kind) => {
      const f = await setup();
      const a = await login(f);
      await f.pg.exec(
        kind === "idle"
          ? "UPDATE jeeves.browser_sessions SET last_seen_at=clock_timestamp()-interval '2 hours'"
          : "UPDATE jeeves.browser_sessions SET absolute_expires_at=clock_timestamp()-interval '1 second'",
      );
      const expired = await f.app.inject({ url: "/product", headers: { cookie: a.cookie } });
      expect(expired.statusCode).toBe(401);
      expect(String(expired.headers["set-cookie"])).toContain("Max-Age=0");
      await f.pg.exec(
        "UPDATE jeeves.browser_sessions SET last_seen_at=clock_timestamp(),absolute_expires_at=clock_timestamp()+interval '1 day'",
      );
      expect(
        (await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode,
      ).toBe(401);
      expect(
        (
          await f.app.inject({
            url: "/product",
            headers: { cookie: "__Host-jeeves-sign-in-session=invalid" },
          })
        ).statusCode,
      ).toBe(401);
    },
  );
  it("requires identity on required routes and revokes every local session for a subject", async () => {
    const f = await setup({ signIn: "required" });
    expect((await f.app.inject({ url: "/product" })).statusCode).toBe(401);
    const a = await login(f),
      b = await login(f);
    await run(() => f.session.revokeSubject("alice"));
    for (const cookie of [a.cookie, b.cookie])
      expect((await f.app.inject({ url: "/product", headers: { cookie } })).statusCode).toBe(401);
    expect(
      (
        await f.pg.query<{ access_sealed: string | null; refresh_sealed: string | null }>(
          "SELECT access_sealed,refresh_sealed FROM jeeves.browser_sessions",
        )
      ).rows.every((r) => r.access_sealed === null && r.refresh_sealed === null),
    ).toBe(true);
  });
  it("keeps login outage distinct from authentication refusal and consumes the callback before exchange", async () => {
    const f = await setup({
      issuer: {
        async exchange() {
          throw new Error("issuer secret unavailable");
        },
      },
    });
    const start = await f.app.inject({ url: "/modules/sign-in/login" });
    const state = (f.authorizing() as { state: string }).state;
    const result = await f.app.inject({
      url: `/modules/sign-in/callback?state=${state}&code=code`,
      headers: { cookie: oneCookie(start, "-login") },
    });
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toContain("secret");
    expect(
      (
        await f.app.inject({
          url: `/modules/sign-in/callback?state=${state}&code=code`,
          headers: { cookie: oneCookie(start, "-login") },
        })
      ).statusCode,
    ).toBe(401);
  });
  it.each(["issuer", "clientId"])(
    "refuses retained cookies after exact %s authority changes",
    async (field) => {
      const f = await setup();
      const a = await login(f);
      const changed = runtime.createBrowserSession({
        namespace: "owner-browser",
        module: "sign-in",
        pool: f.pool,
        settings: {
          ...f.settings,
          [field]:
            field === "issuer" ? "https://new-issuer.test/realms/identity" : "different-client",
        },
        issuer: {},
      });
      await expect(
        run(() => changed.caller({ headers: { cookie: a.cookie } })),
      ).rejects.toMatchObject({ statusCode: 401 });
    },
  );
  it("does not consume or exchange another issuer's retained login transaction", async () => {
    const f = await setup();
    const first = await f.app.inject({ url: "/modules/sign-in/login" });
    const state = (f.authorizing() as { state: string }).state;
    let callback: ((request: unknown, reply: unknown) => Promise<unknown>) | undefined;
    const changed = runtime.createBrowserSession({
      namespace: "owner-browser",
      module: "sign-in",
      pool: f.pool,
      settings: { ...f.settings, issuer: "https://other.test/realms/identity" },
      issuer: {},
    });
    changed.mount({
      route(value: {
        url: string;
        handler: (request: unknown, reply: unknown) => Promise<unknown>;
      }) {
        if (value.url.endsWith("/callback")) callback = value.handler;
      },
    });
    const reply = {
      getHeader() {
        return undefined;
      },
      header() {
        return this;
      },
    };
    await expect(
      run(() =>
        callback!(
          {
            url: `/modules/sign-in/callback?state=${state}&code=code`,
            headers: { cookie: oneCookie(first, "-login") },
          },
          reply,
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(f.exchangeCalls).toHaveLength(0);
    expect((await f.pg.query("SELECT state_hash FROM jeeves.browser_logins")).rows).toHaveLength(1);
  });
  it("refuses startup when only a subset of protected privileges exists", async () => {
    const f = await setup();
    await f.pg.exec("REVOKE INSERT,UPDATE,DELETE ON jeeves.browser_sessions FROM runtime");
    await expect(run(() => f.session.start())).rejects.toThrow("Missing browser session grants");
  });
  it("product-only role cannot read or mutate protected login/session tables", async () => {
    const f = await setup();
    await login(f);
    await f.pg.exec("SET ROLE product");
    await expect(f.pg.query("SELECT * FROM jeeves.browser_sessions")).rejects.toThrow(
      /permission denied/,
    );
    await expect(f.pg.query("DELETE FROM jeeves.browser_logins")).rejects.toThrow(
      /permission denied/,
    );
    await f.pg.exec("RESET ROLE");
  });
});

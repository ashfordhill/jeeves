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
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserSessionDesign } from "../../../field-projects/generator-system/fixtures/rg-browser-session/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { browserRefreshMigration, browserSessionMigration } from "./browser-session.ts";
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
    `${browserSessionMigration.sql} ${browserRefreshMigration.sql} GRANT SELECT,INSERT,UPDATE,DELETE ON jeeves.browser_sessions,jeeves.browser_logins TO runtime;`,
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
    async refresh(_refresh: string, _subject: string) {
      return {
        access: "rotated-access",
        refresh: "rotated-refresh" as string | null,
        id: null as string | null,
        expiresIn: 3600,
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
  return {
    ...f,
    session,
    app,
    settings,
    issuer,
    exchangeCalls,
    authorizing: () => authorizing,
  };
}
const oneCookie = (r: { cookies: { name: string; value: string }[] }, suffix: string) => {
  const c = r.cookies.find((c) => c.name.endsWith(suffix) && c.value);
  return c ? `${c.name}=${c.value}` : "";
};
async function login(f: Awaited<ReturnType<typeof setup>>, previous?: string) {
  const start = await f.app.inject({
    url: "/modules/sign-in/login?returnTo=%2Faccount",
  });
  expect(start.statusCode).toBe(302);
  const state = (f.authorizing() as { state: string }).state;
  const binding = oneCookie(start, "-login");
  const finish = await f.app.inject({
    url: `/modules/sign-in/callback?code=code&state=${state}`,
    headers: { cookie: [binding, previous].filter(Boolean).join("; ") },
  });
  expect(finish.statusCode).toBe(302);
  return {
    start,
    finish,
    state,
    binding,
    cookie: oneCookie(finish, "-session"),
  };
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
      buildStudioCommand(d, {
        type: "addModule",
        host: "browser-api",
        kind: "auth-guard",
      }),
    ).toThrow(/Browser session/);
    expect(() =>
      buildStudioCommand(d, {
        type: "addModule",
        host: "browser-api",
        kind: "favorites",
      }),
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
    const product = await f.app.inject({
      url: "/product",
      headers: { cookie: a.cookie },
    });
    expect(product.json()).toMatchObject({
      signedIn: true,
      principal: { subject: "alice" },
    });
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
        (
          await f.app.inject({
            url: `/modules/sign-in/callback?state=${state}&code=code`,
            headers,
          })
        ).statusCode,
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
    expect((await f.app.inject({ url: "/product" })).json()).toEqual({
      signedIn: false,
    });
    const a = await login(f);
    const me = (
      await f.app.inject({
        url: "/modules/sign-in/session",
        headers: { cookie: a.cookie },
      })
    ).json();
    for (const headers of [
      { cookie: a.cookie },
      {
        cookie: a.cookie,
        origin: "https://evil.test",
        "x-csrf-token": me.csrf,
      },
      { cookie: a.cookie, origin: "https://app.test", "x-csrf-token": "wrong" },
    ]) {
      const result = await f.app.inject({
        method: "POST",
        url: "/product",
        headers,
      });
      expect(result.statusCode).toBe(403);
      expect(result.json()).toEqual({ success: true });
    }
    const headers = {
      cookie: a.cookie,
      origin: "https://app.test",
      "x-csrf-token": me.csrf,
    };
    expect((await f.app.inject({ method: "POST", url: "/product", headers })).statusCode).toBe(200);
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: "/modules/sign-in/logout",
          headers,
        })
      ).statusCode,
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
      (
        await f.app.inject({
          method: "POST",
          url: "/product",
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(403);
    const result = await f.app.inject({
      method: "POST",
      url: "/product",
      headers: {
        cookie,
        origin: "https://app.test",
        "x-csrf-token": me.json().csrf,
      },
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
      const expired = await f.app.inject({
        url: "/product",
        headers: { cookie: a.cookie },
      });
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
        await f.pg.query<{
          access_sealed: string | null;
          refresh_sealed: string | null;
        }>("SELECT access_sealed,refresh_sealed FROM jeeves.browser_sessions")
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

const { OperationError, withProcess } = await import(load("operation"));
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
type SqlInput = string | { text: string; values?: unknown[]; query_timeout?: number };
const sqlText = (input: SqlInput) => (typeof input === "string" ? input : input.text);
const refreshTokens = {
  access: "rotated-access",
  refresh: "rotated-refresh" as string | null,
  id: null,
  expiresIn: 3600,
};
const stale = async (f: Awaited<ReturnType<typeof setup>>) =>
  f.pg.exec(
    "UPDATE jeeves.browser_sessions SET access_expires_at=clock_timestamp()-interval '1 second'",
  );

describe("RG20 emitted refresh coordination", () => {
  it("two independent replicas serialize before issuer dispatch and reuse the committed winner", async () => {
    const entered = deferred<void>(),
      reply = deferred<typeof refreshTokens>();
    let calls = 0;
    const f = await setup({
      issuer: {
        async refresh(value: string, subject: string) {
          calls++;
          expect(value).toBe("private-refresh");
          expect(subject).toBe("alice");
          entered.resolve();
          return reply.promise;
        },
      },
    });
    const a = await login(f);
    await stale(f);
    const replica = runtime.createBrowserSession({
      namespace: "owner-browser",
      module: "sign-in",
      pool: f.pool,
      settings: f.settings,
      issuer: {
        async refresh() {
          calls++;
          throw Object.assign(new Error("would invalidate winner"), {
            statusCode: 401,
          });
        },
      },
    });
    const first = run(() => f.session.refresh({ headers: { cookie: a.cookie } }));
    await entered.promise;
    const second = run(() => replica.refresh({ headers: { cookie: a.cookie } }));
    reply.resolve(refreshTokens);
    const results = await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(results.every((r) => (r as { signedIn: boolean }).signedIn)).toBe(true);
    const row = (
      await f.pg.query<{
        refresh_generation: number;
        revoked_at: null;
        access_sealed: string;
        refresh_sealed: string;
      }>("SELECT * FROM jeeves.browser_sessions")
    ).rows[0]!;
    expect(Number(row.refresh_generation)).toBe(1);
    expect(row.revoked_at).toBeNull();
    expect(row.access_sealed).not.toContain(refreshTokens.access);
    expect(f.trace.some((q) => q.sql.includes("FOR UPDATE"))).toBe(true);
    expect(f.trace.some((q) => q.sql.includes("lock_timeout='4500ms'"))).toBe(true);
  });
  it.each(["temporary", "definitive", "unknown"])(
    "keeps %s refresh failure distinct without blind grant retry",
    async (kind) => {
      let calls = 0;
      const f = await setup({
        issuer: {
          async refresh() {
            calls++;
            if (kind === "definitive")
              throw new (await import(load("admission"))).HttpError(
                401,
                "SIGN_IN_REQUIRED",
                "Sign in to continue.",
              );
            throw new OperationError(
              kind === "unknown" ? "unknown" : "definite-failure",
              kind === "unknown" ? "SESSION_REFRESH_UNKNOWN" : "IDENTITY_UNAVAILABLE",
            );
          },
        },
      });
      const a = await login(f);
      await stale(f);
      const request = () => run(() => f.session.refresh({ headers: { cookie: a.cookie } }));
      await expect(request()).rejects.toMatchObject(
        kind === "definitive"
          ? { statusCode: 401 }
          : {
              code: kind === "temporary" ? "IDENTITY_UNAVAILABLE" : "SESSION_REFRESH_UNKNOWN",
              outcome: kind === "temporary" ? "definite-failure" : "unknown",
            },
      );
      const row = (
        await f.pg.query<{
          revoked_at: unknown;
          refresh_sealed: string | null;
          refresh_uncertain: boolean;
        }>("SELECT * FROM jeeves.browser_sessions")
      ).rows[0]!;
      if (kind === "definitive") {
        expect(row.revoked_at).not.toBeNull();
        expect(row.refresh_sealed).toBeNull();
      } else {
        expect(row.revoked_at).toBeNull();
        expect(row.refresh_sealed).not.toBeNull();
        expect(row.refresh_uncertain).toBe(kind === "unknown");
      }
      if (kind === "unknown") {
        await expect(request()).rejects.toMatchObject({
          code: "SESSION_REFRESH_UNKNOWN",
        });
        expect(calls).toBe(1);
      }
      if (kind === "temporary") {
        f.issuer.refresh = async () => {
          calls++;
          return refreshTokens;
        };
        expect(await request()).toMatchObject({ signedIn: true });
        expect(calls).toBe(2);
      }
    },
  );
  it("commits successful received tokens despite browser cancellation and reseals retained material with current keys", async () => {
    const entered = deferred<void>(),
      reply = deferred<typeof refreshTokens>();
    let calls = 0;
    const f = await setup({
      issuer: {
        async refresh() {
          calls++;
          entered.resolve();
          return reply.promise;
        },
      },
    });
    const a = await login(f);
    await stale(f);
    const cancelled = new AbortController(),
      op = operation({ maximumMs: 5000, signals: [cancelled.signal] });
    const result = withOperation(op.context, () =>
      f.session.refresh({ headers: { cookie: a.cookie } }),
    );
    await entered.promise;
    cancelled.abort();
    await expect(result).rejects.toMatchObject({ outcome: "unknown" });
    op.close();
    f.settings.keys = keys(["new", "old"]);
    reply.resolve({ ...refreshTokens, refresh: null });
    // Acquiring this replica's row lock waits for the independent completion, then reuses it.
    expect(await run(() => f.session.refresh({ headers: { cookie: a.cookie } }))).toMatchObject({
      signedIn: true,
    });
    const row = (
      await f.pg.query<{
        access_sealed: string;
        refresh_sealed: string;
        id_sealed: string;
      }>("SELECT * FROM jeeves.browser_sessions")
    ).rows[0]!;
    expect(row.access_sealed).toMatch(/^jke1.new\./);
    expect(row.refresh_sealed).toMatch(/^jke1.new\./);
    expect(row.id_sealed).toMatch(/^jke1.new\./);
    expect(calls).toBe(1);
  });
  it("queued owning-service revocation wins after a delayed refresh and cannot be undone by later lookup", async () => {
    const entered = deferred<void>(),
      reply = deferred<typeof refreshTokens>();
    let calls = 0;
    const f = await setup({
      issuer: {
        async refresh() {
          calls++;
          entered.resolve();
          return reply.promise;
        },
      },
    });
    const a = await login(f);
    await stale(f);
    const first = run(() => f.session.refresh({ headers: { cookie: a.cookie } }));
    await entered.promise;
    const revoke = run(() => f.session.revokeSubject("alice"));
    reply.resolve(refreshTokens);
    await Promise.all([first, revoke]);
    await expect(
      run(() => f.session.refresh({ headers: { cookie: a.cookie } })),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(
      (
        await f.pg.query<{ access_sealed: null; refresh_sealed: null }>(
          "SELECT access_sealed,refresh_sealed FROM jeeves.browser_sessions",
        )
      ).rows[0],
    ).toEqual({ access_sealed: null, refresh_sealed: null });
    expect(calls).toBe(1);
  });
  it.each(["expiry", "revocation", "removed-key"])(
    "a late successful issuer response cannot reverse %s",
    async (kind) => {
      const entered = deferred<void>(),
        reply = deferred<typeof refreshTokens>();
      const f = await setup({
        issuer: {
          async refresh() {
            entered.resolve();
            return reply.promise;
          },
        },
      });
      const a = await login(f);
      await stale(f);
      const first = run(() => f.session.refresh({ headers: { cookie: a.cookie } }));
      await entered.promise;
      // Controlled SQL seam changes the row inside the held transaction. This observes the final
      // fence independently of real concurrent transactions (the two-process proof is RG23).
      if (kind === "expiry")
        await f.pg.exec(
          "UPDATE jeeves.browser_sessions SET absolute_expires_at=clock_timestamp()-interval '1 second'",
        );
      if (kind === "revocation")
        await f.pg.exec(
          "UPDATE jeeves.browser_sessions SET revoked_at=clock_timestamp(),access_sealed=NULL,refresh_sealed=NULL,id_sealed=NULL",
        );
      if (kind === "removed-key") f.settings.keys = keys(["new"]);
      reply.resolve(refreshTokens);
      await expect(first).rejects.toMatchObject({ statusCode: 401 });
      expect(
        (
          await f.pg.query<{ access_sealed: null }>(
            "SELECT access_sealed FROM jeeves.browser_sessions",
          )
        ).rows[0]?.access_sealed,
      ).toBeNull();
    },
  );
  it("lock refusal is bounded, dispatches no issuer call and never retries the transaction", async () => {
    let calls = 0;
    const f = await setup({
      issuer: {
        async refresh() {
          calls++;
          return refreshTokens;
        },
      },
    });
    const a = await login(f);
    await stale(f);
    const connect = f.pool.connect.bind(f.pool);
    let attempts = 0;
    f.pool.connect = async () => {
      const c = await connect();
      return {
        ...c,
        async query(sql: SqlInput, values?: unknown[]) {
          if (sqlText(sql).includes("FOR UPDATE")) {
            attempts++;
            throw Object.assign(new Error("bounded lock wait"), {
              code: "55P03",
            });
          }
          return c.query(sql, values);
        },
      };
    };
    await expect(
      run(() => f.session.refresh({ headers: { cookie: a.cookie } })),
    ).rejects.toMatchObject({ outcome: "definite-failure" });
    expect(calls).toBe(0);
    expect(attempts).toBe(1);
  });
  it("cancellation while waiting for coordination prevents later issuer dispatch", async () => {
    let calls = 0;
    const f = await setup({
      issuer: {
        async refresh() {
          calls++;
          return refreshTokens;
        },
      },
    });
    const a = await login(f);
    await stale(f);
    const gate = deferred<void>(),
      entered = deferred<void>(),
      connect = f.pool.connect.bind(f.pool);
    f.pool.connect = async () => {
      entered.resolve();
      await gate.promise;
      return connect();
    };
    const abort = new AbortController(),
      op = operation({ maximumMs: 5000, signals: [abort.signal] });
    const first = withOperation(op.context, () =>
      f.session.refresh({ headers: { cookie: a.cookie } }),
    );
    await entered.promise;
    abort.abort();
    await expect(first).rejects.toMatchObject({ outcome: "unknown" });
    op.close();
    gate.resolve();
    f.pool.connect = connect;
    await run(() => f.session.revokeSubject("nobody"));
    expect(calls).toBe(0);
  });
  it("process shutdown refuses late received tokens and releases the transaction", async () => {
    const entered = deferred<void>(),
      reply = deferred<typeof refreshTokens>();
    const f = await setup({
      issuer: {
        async refresh() {
          entered.resolve();
          return reply.promise;
        },
      },
    });
    const a = await login(f);
    await stale(f);
    const stopping = new AbortController(),
      tracked: Promise<unknown>[] = [];
    const first = withProcess(
      {
        signal: stopping.signal,
        track(work: Promise<unknown>) {
          tracked.push(work);
        },
      },
      () => run(() => f.session.refresh({ headers: { cookie: a.cookie } })),
    );
    await entered.promise;
    stopping.abort();
    await expect(first).rejects.toMatchObject({ outcome: "unknown" });
    reply.resolve(refreshTokens);
    await Promise.allSettled(tracked);
    expect(
      Number(
        (
          await f.pg.query<{ refresh_generation: number }>(
            "SELECT refresh_generation FROM jeeves.browser_sessions",
          )
        ).rows[0]?.refresh_generation,
      ),
    ).toBe(0);
  });
});

it("RG20 local identity remains valid with expired/uncertain issuer credentials and no issuer request", async () => {
  let calls = 0;
  const f = await setup({
    issuer: {
      async refresh() {
        calls++;
        throw new Error("must not call issuer for local identity");
      },
    },
  });
  const a = await login(f);
  await stale(f);
  await f.pg.exec("UPDATE jeeves.browser_sessions SET refresh_uncertain=true,refresh_sealed=NULL");
  expect((await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode).toBe(
    200,
  );
  expect(
    (
      await f.app.inject({
        url: "/modules/sign-in/session",
        headers: { cookie: a.cookie },
      })
    ).json(),
  ).toMatchObject({ signedIn: true, subject: "alice" });
  expect(calls).toBe(0);
});

it("RG20 bounds actual pending connections past browser cancellation without new dispatch", async () => {
  const f = await setup();
  const a = await login(f);
  await stale(f);
  const entered = deferred<void>(),
    gate = deferred<void>(),
    connect = f.pool.connect.bind(f.pool);
  let connections = 0;
  f.pool.connect = async () => {
    connections++;
    if (connections === 32) entered.resolve();
    await gate.promise;
    return connect();
  };
  const stopping = new AbortController(),
    tracked: Promise<unknown>[] = [];
  const op = operation({ maximumMs: 10000, signals: [stopping.signal] });
  const work = withProcess(
    {
      signal: new AbortController().signal,
      track(actual: Promise<unknown>) {
        tracked.push(actual);
      },
    },
    () =>
      Array.from({ length: 32 }, () =>
        withOperation(op.context, () => f.session.refresh({ headers: { cookie: a.cookie } })),
      ),
  );
  await entered.promise;
  stopping.abort();
  await Promise.allSettled(work);
  op.close();
  await expect(
    run(() => f.session.refresh({ headers: { cookie: a.cookie } })),
  ).rejects.toMatchObject({ code: "SESSION_REFRESH_SATURATED" });
  expect(connections).toBe(32);
  gate.resolve();
  f.pool.connect = connect;
  await Promise.allSettled(tracked);
  expect(await run(() => f.session.refresh({ headers: { cookie: a.cookie } }))).toMatchObject({
    signedIn: true,
  });
});

it("RG20 hard internal deadline destroys a hung checked-out connection and bounds shutdown tracking", async () => {
  const f = await setup();
  const a = await login(f);
  await stale(f);
  vi.useFakeTimers();
  try {
    const entered = deferred<void>();
    let rejectQuery!: (error: Error) => void,
      releases = 0;
    f.pool.connect = async () => ({
      query: async (sql: SqlInput) => {
        if (sqlText(sql) === "BEGIN") {
          entered.resolve();
          return new Promise<never>((_r, reject) => {
            rejectQuery = reject;
          });
        }
        throw new Error("closed connection");
      },
      release(discard: boolean) {
        expect(discard).toBe(true);
        releases++;
        rejectQuery(new Error("hard deadline socket closed"));
      },
    });
    const tracked: Promise<unknown>[] = [],
      op = operation({ maximumMs: 10000 });
    const result = withProcess(
      {
        signal: new AbortController().signal,
        track(work: Promise<unknown>) {
          tracked.push(work);
        },
      },
      () => withOperation(op.context, () => f.session.refresh({ headers: { cookie: a.cookie } })),
    );
    const observed = expect(result).rejects.toMatchObject({
      outcome: "unknown",
    });
    await entered.promise;
    await vi.advanceTimersByTimeAsync(7000);
    await observed;
    await Promise.allSettled(tracked);
    op.close();
    expect(releases).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

it.each(["received-success", "unknown"])(
  "RG20 durable attempt survives %s completion rollback and a new coordinator never reuses the spent token",
  async (kind) => {
    let posts = 0;
    const f = await setup({
      issuer: {
        async refresh() {
          posts++;
          if (kind === "unknown") throw new OperationError("unknown", "SESSION_REFRESH_UNKNOWN");
          return refreshTokens;
        },
      },
    });
    const a = await login(f);
    await stale(f);
    const connect = f.pool.connect.bind(f.pool);
    let fail = true;
    f.pool.connect = async () => {
      const c = await connect();
      return {
        ...c,
        async query(sql: SqlInput, values?: unknown[]) {
          if (
            fail &&
            ((kind === "received-success" && sqlText(sql).includes("SET access_sealed=$4")) ||
              (kind === "unknown" && sqlText(sql).includes("SET refresh_uncertain=$4")))
          ) {
            fail = false;
            throw Object.assign(new Error("storage failure after issuer dispatch"), {
              code: "40001",
            });
          }
          return c.query(sql, values);
        },
      };
    };
    await expect(
      run(() => f.session.refresh({ headers: { cookie: a.cookie } })),
    ).rejects.toBeDefined();
    f.pool.connect = connect;
    const row = (
      await f.pg.query<{
        refresh_uncertain: boolean;
        refresh_attempt: string;
        refresh_generation: number;
      }>("SELECT refresh_uncertain,refresh_attempt,refresh_generation FROM jeeves.browser_sessions")
    ).rows[0]!;
    expect(row.refresh_uncertain).toBe(true);
    expect(row.refresh_attempt).toBeTruthy();
    expect(Number(row.refresh_generation)).toBe(0);
    // Model elapsed authoritative store time after a dead holder without a production clock seam.
    await f.pg.exec(
      "UPDATE jeeves.browser_sessions SET refresh_attempt_until=clock_timestamp()-interval '1 second'",
    );
    const restarted = runtime.createBrowserSession({
      namespace: "owner-browser",
      module: "sign-in",
      pool: f.pool,
      settings: f.settings,
      issuer: f.issuer,
    });
    await expect(
      run(() => restarted.refresh({ headers: { cookie: a.cookie } })),
    ).rejects.toMatchObject({
      code: "SESSION_REFRESH_UNKNOWN",
      outcome: "unknown",
    });
    expect(posts).toBe(1);
    expect(
      (await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode,
    ).toBe(200);
  },
);

it("RG20 a lost successful COMMIT response reuses the committed generation without a second rotation", async () => {
  let posts = 0;
  const f = await setup({
    issuer: {
      async refresh() {
        posts++;
        return refreshTokens;
      },
    },
  });
  const a = await login(f);
  await stale(f);
  const connect = f.pool.connect.bind(f.pool);
  let rotating = false;
  f.pool.connect = async () => {
    const c = await connect();
    return {
      ...c,
      async query(sql: SqlInput, values?: unknown[]) {
        if (sqlText(sql).includes("SET access_sealed=$4")) rotating = true;
        const result = await c.query(sql, values);
        if (sqlText(sql) === "COMMIT" && rotating) {
          rotating = false;
          throw Object.assign(new Error("commit response lost"), {
            code: "EPIPE",
          });
        }
        return result;
      },
    };
  };
  await expect(
    run(() => f.session.refresh({ headers: { cookie: a.cookie } })),
  ).rejects.toMatchObject({ outcome: "unknown" });
  f.pool.connect = connect;
  const restarted = runtime.createBrowserSession({
    namespace: "owner-browser",
    module: "sign-in",
    pool: f.pool,
    settings: f.settings,
    issuer: f.issuer,
  });
  expect(await run(() => restarted.refresh({ headers: { cookie: a.cookie } }))).toMatchObject({
    signedIn: true,
  });
  expect(posts).toBe(1);
});

it("RG20 private coordinator returns the actual updated generation and current-key credential state", async () => {
  const f = await setup();
  const a = await login(f);
  await stale(f);
  f.settings.keys = keys(["new", "old"]);
  const authority = createHash("sha256")
    .update(JSON.stringify([f.settings.issuer, f.settings.clientId]))
    .digest("hex");
  const cookieHash = createHash("sha256").update(a.cookie.split("=")[1]!).digest("hex");
  const binding = (field: string) => ({
    scope: createHash("sha256")
      .update(JSON.stringify(["owner-browser", authority]))
      .digest("hex"),
    context: `session:${cookieHash}:${field}`,
  });
  const coordinate = (await import(load("browser-refresh"))).browserRefresh();
  const result = await run(() =>
    coordinate({
      pool: f.pool,
      namespace: "owner-browser",
      authority,
      cookieHash,
      settings: f.settings,
      issuer: f.issuer,
      binding,
    }),
  );
  const row = result as {
    refresh_generation: string;
    access_sealed: string;
    refresh_sealed: string;
    id_sealed: string;
    fresh: boolean;
  };
  expect(Number(row.refresh_generation)).toBe(1);
  expect(row.fresh).toBe(true);
  expect(f.settings.keys.seal.open(row.access_sealed, binding("access"))).toBe("rotated-access");
  for (const field of [row.access_sealed, row.refresh_sealed, row.id_sealed])
    expect(field).toMatch(/^jke1.new\./);
});

it("RG20 an unsupported short successful rotation stays uncertain and queued callers never rotate again", async () => {
  let posts = 0;
  const f = await setup({
    issuer: {
      async refresh() {
        posts++;
        return { ...refreshTokens, expiresIn: 20 };
      },
    },
  });
  const a = await login(f);
  await stale(f);
  await expect(
    run(() => f.session.refresh({ headers: { cookie: a.cookie } })),
  ).rejects.toMatchObject({ code: "SESSION_REFRESH_UNKNOWN" });
  await expect(
    run(() => f.session.refresh({ headers: { cookie: a.cookie } })),
  ).rejects.toMatchObject({ code: "SESSION_REFRESH_UNKNOWN" });
  expect(posts).toBe(1);
  expect((await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode).toBe(
    200,
  );
});

it("RG20 checks original monotonic budget before issuer dispatch even when its abort timer is delayed", async () => {
  let posts = 0;
  const f = await setup({
    issuer: {
      async refresh() {
        posts++;
        return refreshTokens;
      },
    },
  });
  const a = await login(f);
  await stale(f);
  const connect = f.pool.connect.bind(f.pool),
    base = performance.now();
  let reads = 0;
  const now = vi.spyOn(performance, "now").mockReturnValue(base);
  const op = operation({ maximumMs: 5000 });
  f.pool.connect = async () => {
    if (++reads === 2) now.mockReturnValue(base + 5001);
    return connect();
  };
  try {
    await expect(
      withOperation(op.context, () => f.session.refresh({ headers: { cookie: a.cookie } })),
    ).rejects.toMatchObject({ code: "CONTEXT_EXPIRED" });
    expect(op.context.signal.aborted).toBe(false);
    expect(posts).toBe(0);
  } finally {
    now.mockRestore();
    op.close();
    f.pool.connect = connect;
  }
});

it("RG20 refreshed expiry uses the pre-dispatch store timestamp and cannot gain response transport time", async () => {
  let providerObserved: Date | undefined;
  const f = await setup({
    issuer: {
      async refresh() {
        providerObserved = (await f.pg.query<{ now: Date }>("SELECT clock_timestamp() AS now"))
          .rows[0]?.now;
        return refreshTokens;
      },
    },
  });
  const a = await login(f);
  await stale(f);
  await run(() => f.session.refresh({ headers: { cookie: a.cookie } }));
  const expiry = (
    await f.pg.query<{ access_expires_at: Date }>(
      "SELECT access_expires_at FROM jeeves.browser_sessions",
    )
  ).rows[0]?.access_expires_at;
  expect(expiry).toBeInstanceOf(Date);
  expect(providerObserved).toBeInstanceOf(Date);
  expect(expiry!.getTime()).toBeLessThanOrEqual(providerObserved!.getTime() + 3600000);
});

it("RG20 private query timeout exceeds the bounded row-lock wait without changing the pool default", async () => {
  const f = await setup();
  const a = await login(f);
  await stale(f);
  const connect = f.pool.connect.bind(f.pool),
    timeouts: number[] = [];
  f.pool.connect = async () => {
    const c = await connect();
    return {
      ...c,
      async query(input: SqlInput, values?: unknown[]) {
        expect(typeof input).toBe("object");
        if (typeof input !== "string") timeouts.push(input.query_timeout ?? 0);
        return c.query(input, values);
      },
    };
  };
  expect(await run(() => f.session.refresh({ headers: { cookie: a.cookie } }))).toMatchObject({
    signedIn: true,
  });
  expect(timeouts.length).toBeGreaterThan(5);
  expect(new Set(timeouts)).toEqual(new Set([5500]));
  f.pool.connect = connect;
  expect((await f.app.inject({ url: "/product", headers: { cookie: a.cookie } })).statusCode).toBe(
    200,
  );
});

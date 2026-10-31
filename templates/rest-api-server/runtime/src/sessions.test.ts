import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createService, type Service } from "@jeeves/service-runtime";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { legacyRuntime } from "../test-fixtures/legacy-runtime.ts";
import { type ResourceDatabase, resourceServer } from "./resources.ts";
import { sessionCookieName } from "./sessions.ts";

const legacy = await legacyRuntime();
afterAll(legacy.cleanup);
const services: Service[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const service of services.splice(0)) await service.stop();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const origin = "http://127.0.0.1:19999";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function storage() {
  const users = new Map<string, { id: unknown; password_hash: unknown }>();
  const tokens = new Map<unknown, { user_id: unknown; csrf_token: unknown }>();
  const queries: string[] = [];
  const database: ResourceDatabase = {
    async query(sql, values = []) {
      queries.push(sql);
      if (sql.startsWith("INSERT INTO app_user")) {
        if (users.has(String(values[1]))) return { rows: [] };
        users.set(String(values[1]), { id: values[0], password_hash: values[2] });
        return { rows: [{ id: values[0] }] };
      }
      if (sql.includes("FROM app_user")) {
        const user = users.get(String(values[0]));
        return { rows: user ? [user] : [] };
      }
      if (sql.startsWith("INSERT INTO app_session")) {
        tokens.set(values[0], { user_id: values[1], csrf_token: values[2] });
        return { rows: [] };
      }
      if (sql.startsWith("DELETE FROM app_session")) {
        tokens.delete(values[0]);
        return { rows: [] };
      }
      if (sql.includes("FROM app_session")) {
        const session = tokens.get(values[0]);
        return { rows: session ? [session] : [] };
      }
      throw new Error("Unexpected fixture SQL");
    },
  };
  return { database, tokens, users, queries };
}
async function setup(server = resourceServer, publicOrigin = origin, store = storage()) {
  const dir = mkdtempSync(join(tmpdir(), "jeeves-session-unit-"));
  dirs.push(dir);
  const contract = join(dir, "api.json");
  const response = {
    description: "Success",
    content: { "application/json": { schema: { type: "object" } } },
  };
  writeFileSync(
    contract,
    JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Sessions", version: "1" },
      paths: {
        "/auth/register": {
          post: { operationId: "registerAccount", responses: { "201": response, "409": response } },
        },
        "/auth/login": {
          post: { operationId: "login", responses: { "200": response, "401": response } },
        },
        "/auth/session": {
          get: { operationId: "readSession", responses: { "200": response, "401": response } },
        },
        "/auth/logout": {
          post: { operationId: "logout", responses: { "204": { description: "Signed out" } } },
        },
      },
    }),
  );
  const service = await createService(
    {
      name: "sessions",
      plugins: [
        server({ contract, database: () => store.database, resources: [], extensions: [] }),
      ],
    },
    { env: { PUBLIC_ORIGIN: publicOrigin }, logger: false },
  );
  services.push(service);
  return { service, app: service.app, store };
}
const credentials = { email: "fixture@example.test", password: "fixture-password-only" };

it("derives the specified normalized identity, including ports and stable reloads", () => {
  expect(sessionCookieName(origin)).toBe(`jeeves_session_${hash(origin).slice(0, 32)}`);
  expect(sessionCookieName("HTTP://LOCALHOST:80/")).toBe(sessionCookieName("http://localhost"));
  expect(sessionCookieName("https://example.test:443/")).toBe(
    sessionCookieName("https://example.test"),
  );
  expect(sessionCookieName(origin)).not.toBe(sessionCookieName("http://127.0.0.1:19998"));
  expect(sessionCookieName(origin)).toBe(sessionCookieName(`${origin}/`));
});

describe.each([
  ["legacy compiled 0.2.0", legacy.resourceServer, () => "jeeves_session"],
  ["current source 0.3.0", resourceServer, sessionCookieName],
] as const)("session lifecycle: %s", (_version, server, nameOf) => {
  it.each([origin, "https://example.test"])(
    "retains authentication, flags, lifetime and CSRF at %s",
    async (publicOrigin) => {
      const { app, store } = await setup(server, publicOrigin);
      const post = (
        url: string,
        headers: Record<string, string | undefined> = { origin: publicOrigin },
        payload = credentials,
      ) => app.inject({ method: "POST", url, headers, payload });
      expect((await app.inject({ url: "/auth/session" })).statusCode).toBe(401);
      for (const url of ["/auth/login", "/auth/register"]) {
        expect((await post(url, {})).statusCode).toBe(403);
        expect((await post(url, { origin: `${publicOrigin}/` })).statusCode).toBe(403);
        expect((await post(url, { origin: "https://untrusted.test" })).statusCode).toBe(403);
      }
      expect(store.queries).toEqual([]);
      const registered = await post("/auth/register");
      expect(registered.statusCode).toBe(201);
      const name = nameOf(publicOrigin);
      const setCookie = String(registered.headers["set-cookie"]);
      expect(setCookie).toMatch(
        new RegExp(
          `^${name}=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${publicOrigin.startsWith("https:") ? "; Secure" : ""}$`,
        ),
      );
      expect(registered.headers["cache-control"]).toBe("no-store");
      const cookie = setCookie.split(";")[0]!;
      const token = cookie.split("=")[1]!;
      expect(store.tokens.has(hash(token))).toBe(true);
      expect(store.tokens.has(token)).toBe(false);
      expect(store.queries).toContain(
        "INSERT INTO app_session (token_hash,user_id,csrf_token,expires_at) VALUES ($1,$2,$3,now() + interval '7 days')",
      );
      expect(
        (await post("/auth/login", undefined, { ...credentials, password: "incorrect" }))
          .statusCode,
      ).toBe(401);
      expect((await post("/auth/register")).statusCode).toBe(409);
      const csrf = registered.json().csrfToken;
      expect((await app.inject({ url: "/auth/session", headers: { cookie } })).json()).toEqual(
        registered.json(),
      );
      expect(store.queries.at(-1)).toContain("expires_at > now()");
      for (const headers of [
        { origin: publicOrigin, cookie },
        { origin: publicOrigin, cookie, "x-csrf-token": "wrong" },
        { cookie, "x-csrf-token": csrf },
        { origin: "https://untrusted.test", cookie, "x-csrf-token": csrf },
      ])
        expect((await post("/auth/logout", headers)).statusCode).toBe(403);
      const loggedOut = await post("/auth/logout", {
        origin: publicOrigin,
        cookie,
        "x-csrf-token": csrf,
      });
      expect(loggedOut.statusCode).toBe(204);
      expect(loggedOut.headers["set-cookie"]).toBe(
        `${name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${publicOrigin.startsWith("https:") ? "; Secure" : ""}`,
      );
      expect((await app.inject({ url: "/auth/session", headers: { cookie } })).statusCode).toBe(
        401,
      );
      const login = await post("/auth/login");
      expect(login.statusCode).toBe(200);
      expect(login.json().id).toBe(registered.json().id);
      expect(store.users.size).toBe(1);
    },
  );
});

it("ignores legacy, unrelated and other-origin cookies, retaining identity across service reload", async () => {
  const { app, store, service } = await setup();
  const register = await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: { origin },
    payload: credentials,
  });
  const cookie = String(register.headers["set-cookie"]).split(";")[0]!;
  const token = cookie.split("=")[1]!;
  const others = `jeeves_session=${token}; unrelated=${token}; ${sessionCookieName("http://127.0.0.1:19998")}=${token}`;
  const calls = store.queries.length;
  for (const value of [others, `prefix_${cookie}`, `${cookie}extra`]) {
    expect(
      (await app.inject({ url: "/auth/session", headers: { cookie: value } })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/logout",
          headers: { origin, cookie: value, "x-csrf-token": register.json().csrfToken },
        })
      ).statusCode,
    ).toBe(401);
  }
  expect(store.queries.length).toBe(calls);
  expect(
    (await app.inject({ url: "/auth/session", headers: { cookie: `${others}; ${cookie}` } }))
      .statusCode,
  ).toBe(200);
  await service.stop();
  services.splice(services.indexOf(service), 1);
  const reloaded = await setup(resourceServer, `${origin}/`, store);
  expect((await reloaded.app.inject({ url: "/auth/session", headers: { cookie } })).json()).toEqual(
    register.json(),
  );
  const changedOrigin = await setup(resourceServer, "http://127.0.0.1:19998", store);
  expect(
    (await changedOrigin.app.inject({ url: "/auth/session", headers: { cookie } })).statusCode,
  ).toBe(401);
  const logout = await reloaded.app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: { origin, cookie: `${others}; ${cookie}`, "x-csrf-token": register.json().csrfToken },
  });
  expect(logout.statusCode).toBe(204);
  expect(logout.headers["set-cookie"]).toBe(
    `${sessionCookieName(origin)}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
  );
});

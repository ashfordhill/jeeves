/** Maintained, bounded version of v3-17's archived harness/lib.mjs PKCE browser flow. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Application } from "./application.ts";
import { rememberSecrets } from "./evidence.ts";

export const identityTemplates = [
  "verified-identity",
  "favorites",
  "module-stub",
  "verified-identity",
];
export type TestAccount = { username: string; password: string; subject: string };
export class IdentityClient {
  readonly origin: string;
  constructor(readonly app: Application) {
    this.origin = `http://127.0.0.1:${app.stack.ports[1]}`;
  }
  async protect(...values: string[]) {
    await rememberSecrets(this.app.directory, ...values);
  }
  async request(path: string, init: RequestInit = {}) {
    // Never retain OAuth URLs, headers, forms or response bodies in observations/errors.
    await this.protect(path);
    const response = await fetch(new URL(path, this.origin), {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    return response;
  }
  async tokens(path: string, form: Record<string, string>) {
    const response = await this.request(path, { method: "POST", body: new URLSearchParams(form) });
    const body = (await response.json()) as Record<string, unknown>;
    for (const key of ["access_token", "refresh_token", "id_token", "session_state"])
      if (typeof body[key] === "string") await this.protect(body[key]);
    assert.equal(response.status, 200, "Keycloak token exchange status");
    assert.equal(typeof body.access_token, "string", "Keycloak access token is present");
    return body.access_token as string;
  }
  async provision(): Promise<TestAccount[]> {
    const password = (
      await readFile(join(this.app.directory, ".runtime/secrets/identity-admin-sign-in"), "utf8")
    ).trim();
    const admin = await this.tokens("/realms/master/protocol/openid-connect/token", {
      grant_type: "password",
      client_id: "admin-cli",
      username: "admin",
      password,
    });
    const accounts: TestAccount[] = [];
    for (const username of ["account-a", "account-b"]) {
      const userPassword = randomBytes(32).toString("base64url");
      await this.protect(userPassword);
      const response = await this.request("/admin/realms/sign-in/users", {
        method: "POST",
        headers: { authorization: `Bearer ${admin}`, "content-type": "application/json" },
        body: JSON.stringify({
          username,
          enabled: true,
          emailVerified: true,
          firstName: "Fixture",
          lastName: username,
          email: `${username}@example.invalid`,
          credentials: [{ type: "password", value: userPassword, temporary: false }],
        }),
      });
      await response.text();
      assert.equal(response.status, 201, "Disposable user creation status");
      const subject = response.headers.get("location")?.split("/").at(-1);
      assert(subject && /^[a-f0-9-]{36}$/.test(subject), "Created user ID");
      accounts.push({ username, password: userPassword, subject });
      this.app.record({
        identitySetup: "user-created",
        username,
        subject,
        status: response.status,
      });
    }
    return accounts;
  }
  async signIn(account: TestAccount) {
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(16).toString("hex");
    await this.protect(verifier, state);
    const redirect = `http://127.0.0.1:${this.app.stack.ports[0]}/`;
    const auth = await this.request(
      `/realms/sign-in/protocol/openid-connect/auth?${new URLSearchParams({
        client_id: "sign-in-web",
        redirect_uri: redirect,
        response_type: "code",
        scope: "openid",
        state,
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
        code_challenge_method: "S256",
      })}`,
    );
    const cookies: string[] = [];
    for (const line of auth.headers.getSetCookie()) {
      const pair = line.split(";")[0];
      assert(pair, "Identity cookie");
      await this.protect(line, pair, pair.slice(pair.indexOf("=") + 1));
      cookies.push(pair);
    }
    const html = await auth.text();
    assert.equal(auth.status, 200, "Keycloak authorization status");
    const action = /<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/s
      .exec(html)?.[1]
      ?.replaceAll("&amp;", "&");
    assert(action, "Keycloak login form is present");
    await this.protect(action, ...new URL(action).searchParams.values());
    const login = await this.request(action, {
      method: "POST",
      headers: { cookie: cookies.join("; "), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: account.username,
        password: account.password,
        credentialId: "",
      }),
    });
    await login.text();
    const location = login.headers.get("location");
    if (location) await this.protect(location, ...new URL(location).searchParams.values());
    assert.equal(login.status, 302, "Keycloak login status");
    assert(location, "PKCE redirect is present");
    assert(location.startsWith(`${redirect}?`), "PKCE redirect matches application origin");
    const back = new URL(location);
    // Booleans keep sensitive operands out of even an interrupted reporter.
    assert(back.searchParams.get("state") === state, "PKCE state matches");
    const code = back.searchParams.get("code");
    assert(code, "Authorization code is present");
    const token = await this.tokens("/realms/sign-in/protocol/openid-connect/token", {
      grant_type: "authorization_code",
      client_id: "sign-in-web",
      code,
      redirect_uri: redirect,
      code_verifier: verifier,
    });
    this.app.record({
      identityFlow: "authorization-code-pkce-S256",
      username: account.username,
      authorizationStatus: auth.status,
      loginStatus: login.status,
      tokenStatus: 200,
    });
    return token;
  }
}
export function signedRequest(
  app: Application,
  token: string | undefined,
  path: string,
  method = "GET",
) {
  return app.request(path, {
    method,
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}
export function tampered(token: string) {
  const parts = token.split(".");
  const signature = parts[2];
  assert(signature, "Signed JWT has a signature");
  parts[2] = `${signature.slice(0, -4)}${signature.endsWith("AAAA") ? "BBBB" : "AAAA"}`;
  return parts.join(".");
}

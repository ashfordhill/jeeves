import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { OperationHandler, RegisteredOperation } from "@jeeves/service-runtime";
import type { FastifyRequest } from "fastify";
import type { ResourceDatabase } from "./resources.ts";

const derive = promisify(scrypt);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const lifetime = 7 * 24 * 60 * 60;
export interface Principal {
  id: string;
  csrfToken: string;
}
const error = (status: number, code: string, message: string) => ({
  status,
  body: { error: code, message },
});

/** Stable deployment identity; the resource server validates PUBLIC_ORIGIN before calling. */
export function sessionCookieName(publicOrigin: string): string {
  return `jeeves_session_${digest(new URL(publicOrigin).origin).slice(0, 32)}`;
}

/** Credentials are validated by the generated Zod-derived OpenAPI contract before these handlers. */
export function sessions(database: () => ResourceDatabase, publicOrigin: string) {
  const name = sessionCookieName(publicOrigin);
  const tokenPattern = new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`);
  const cookie = (token: string, maxAge = lifetime) =>
    name +
    "=" +
    token +
    "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" +
    maxAge +
    (publicOrigin.startsWith("https:") ? "; Secure" : "");
  const tokenOf = (request: FastifyRequest) => tokenPattern.exec(request.headers.cookie ?? "")?.[1];
  const principal = async (request: FastifyRequest): Promise<Principal | undefined> => {
    const token = tokenOf(request);
    if (!token) return undefined;
    const result = await database().query(
      "SELECT user_id, csrf_token FROM app_session WHERE token_hash = $1 AND expires_at > now()",
      [digest(token)],
    );
    const row = result.rows[0];
    return row ? { id: String(row.user_id), csrfToken: String(row.csrf_token) } : undefined;
  };
  const sameOrigin = (request: FastifyRequest) => request.headers.origin === publicOrigin;
  const mutationAllowed = (request: FastifyRequest, user: Principal) =>
    sameOrigin(request) && request.headers["x-csrf-token"] === user.csrfToken;
  const handlers = (established: (request: FastifyRequest) => Principal | undefined) => {
    const operations = new Map<string, RegisteredOperation>();
    const add = (id: string, handler: OperationHandler) =>
      operations.set(id, { feature: "runtime:sessions", handler });
    for (const action of ["registerAccount", "login"] as const)
      add(action, async (request) => {
        const body = request.body as { email: string; password: string };
        const email = body.email.toLowerCase();
        let id: string;
        if (action === "registerAccount") {
          id = randomUUID();
          const salt = randomBytes(16).toString("hex");
          const hash = (await derive(body.password, salt, 64)) as Buffer;
          const created = await database().query(
            "INSERT INTO app_user (id,email,password_hash) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING RETURNING id",
            [id, email, salt + ":" + hash.toString("hex")],
          );
          if (!created.rows.length) return error(409, "ACCOUNT_EXISTS", "Account already exists");
        } else {
          const found = await database().query(
            "SELECT id, password_hash FROM app_user WHERE email = $1",
            [email],
          );
          const row = found.rows[0];
          const [salt = "", saved = ""] = String(
            row?.password_hash ?? "0".repeat(32) + ":" + "0".repeat(128),
          ).split(":");
          const hash = (await derive(body.password, salt, 64)) as Buffer;
          const expected = Buffer.from(saved, "hex");
          if (!row || expected.length !== hash.length || !timingSafeEqual(hash, expected))
            return error(401, "UNAUTHORIZED", "Invalid credentials");
          id = String(row.id);
        }
        const token = randomBytes(32).toString("hex");
        const csrfToken = randomBytes(32).toString("hex");
        await database().query(
          "INSERT INTO app_session (token_hash,user_id,csrf_token,expires_at) VALUES ($1,$2,$3,now() + interval '7 days')",
          [digest(token), id, csrfToken],
        );
        return {
          status: action === "registerAccount" ? 201 : 200,
          headers: { "set-cookie": cookie(token), "cache-control": "no-store" },
          body: { id, csrfToken },
        };
      });
    add("readSession", async (request) => ({ status: 200, body: established(request.request) }));
    add("logout", async (request) => {
      const token = tokenOf(request.request);
      if (!token) return error(401, "UNAUTHORIZED", "Sign in required");
      await database().query("DELETE FROM app_session WHERE token_hash = $1", [digest(token)]);
      return { status: 204, headers: { "set-cookie": cookie("", 0) } };
    });
    return operations;
  };
  return { principal, mutationAllowed, sameOrigin, handlers };
}

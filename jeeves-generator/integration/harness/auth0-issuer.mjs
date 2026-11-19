// Disposable Auth0-protocol fixture with a real TLS peer, signed JWTs and single-use grants.
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const dir = "/auth0-fixture";
const issuer = "https://auth0-issuer:8443/";
const userAudience = "https://fixture.test/users";
const audience = (service) => `https://fixture.test/services/${service}`;
const client = (service) => `machine_${service}`;
const browser = "fixture_browser";
const callback = "https://browser.test/modules/sign-in/callback";
const logoutReturn = "https://browser.test/";
const registrations = {
  "browser-api": ["account-api", "link-api"],
  "account-api": ["billing-api"],
  "billing-api": [],
  "link-api": [],
};
const codes = new Map();
const refreshTokens = new Map();
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "fixture", use: "sig", alg: "RS256" };
const random = () => randomBytes(32).toString("base64url");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const secret = (name) => readFileSync(`${dir}/${name}`, "utf8").trim();
let refreshes = 0;
let rotations = 0;
let logouts = 0;
function jwt(claims) {
  const iat = Math.floor(Date.now() / 1000);
  const text = [
    encode({ alg: "RS256", typ: "JWT", kid: jwk.kid }),
    encode({
      iss: issuer,
      iat,
      exp: iat + 120,
      ...claims,
    }),
  ].join(".");
  return `${text}.${sign("sha256", Buffer.from(text), privateKey).toString("base64url")}`;
}
function user(subject, extra = {}) {
  return jwt({ sub: subject, aud: [userAudience, `${issuer}userinfo`], azp: browser, ...extra });
}
function machine(service, aud) {
  const id = client(service);
  return jwt({ sub: `${id}@clients`, azp: id, aud, gty: "client-credentials" });
}
function respond(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}
function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}
async function tokenRoute(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = new URLSearchParams(Buffer.concat(chunks).toString());
  const grant = body.get("grant_type");
  const id = body.get("client_id");
  const failure = (error = "invalid_grant", status = 400) => respond(res, status, { error });
  if (grant === "client_credentials") {
    const service = Object.keys(registrations).find((key) => client(key) === id);
    if (!service || secret(service) !== body.get("client_secret"))
      return failure("invalid_client", 401);
    const target = registrations[service].find((key) => audience(key) === body.get("audience"));
    if (!target) return failure("access_denied");
    return respond(res, 200, {
      access_token: machine(service, audience(target)),
      token_type: "Bearer",
      expires_in: 120,
    });
  }
  if (id !== browser || secret("browser-secret") !== body.get("client_secret"))
    return failure("invalid_client", 401);
  if (grant === "authorization_code") {
    const code = body.get("code");
    const record = codes.get(code);
    codes.delete(code);
    const expectedPkce = createHash("sha256")
      .update(body.get("code_verifier") ?? "")
      .digest("base64url");
    if (!record || expectedPkce !== record.challenge || body.get("redirect_uri") !== callback)
      return failure();
    const refreshToken = random();
    refreshTokens.set(refreshToken, record.subject);
    return respond(res, 200, {
      access_token: user(record.subject),
      token_type: "Bearer",
      expires_in: 120,
      id_token: jwt({ sub: record.subject, aud: browser, nonce: record.nonce }),
      refresh_token: refreshToken,
    });
  }
  if (grant !== "refresh_token") return failure("unsupported_grant_type");
  refreshes += 1;
  if (secret("mode") === "temporary") return failure("temporarily_unavailable", 503);
  const previous = body.get("refresh_token");
  const subject = refreshTokens.get(previous);
  if (!subject) return failure();
  refreshTokens.delete(previous);
  const refreshToken = random();
  refreshTokens.set(refreshToken, subject);
  rotations += 1;
  await new Promise((resolve) => setTimeout(resolve, 350));
  return respond(res, 200, {
    access_token: user(subject),
    token_type: "Bearer",
    expires_in: 120,
    ...(secret("mode") === "missing-replacement" ? {} : { refresh_token: refreshToken }),
  });
}
https
  .createServer({ key: secret("server.key"), cert: secret("server.crt") }, async (req, res) => {
    try {
      const url = new URL(req.url, issuer);
      if (url.pathname === "/.well-known/openid-configuration")
        return respond(res, 200, {
          issuer,
          authorization_endpoint: `${issuer}authorize`,
          token_endpoint: `${issuer}oauth/token`,
          jwks_uri: `${issuer}.well-known/jwks.json`,
          end_session_endpoint: `${issuer}oidc/logout`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          token_endpoint_auth_methods_supported: ["client_secret_post"],
          id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
        });
      if (url.pathname === "/.well-known/jwks.json") return respond(res, 200, { keys: [jwk] });
      if (url.pathname === "/authorize") {
        const q = url.searchParams;
        const subject = req.headers["x-fixture-user"];
        if (
          !["alice", "bob"].includes(subject) ||
          q.get("client_id") !== browser ||
          q.get("response_type") !== "code" ||
          q.get("code_challenge_method") !== "S256" ||
          !q.get("code_challenge") ||
          !q.get("state") ||
          !q.get("nonce") ||
          q.get("redirect_uri") !== callback ||
          q.get("audience") !== userAudience ||
          !q.get("scope")?.split(" ").includes("offline_access")
        )
          return respond(res, 400, { error: "invalid_request" });
        const code = random();
        codes.set(code, {
          subject: `auth0|${subject}`,
          nonce: q.get("nonce"),
          challenge: q.get("code_challenge"),
        });
        const location = new URL(callback);
        location.searchParams.set("code", code);
        location.searchParams.set("state", q.get("state"));
        return redirect(res, location.href);
      }
      if (url.pathname === "/oauth/token" && req.method === "POST")
        return await tokenRoute(req, res);
      if (
        url.pathname === "/oidc/logout" &&
        url.searchParams.get("client_id") === browser &&
        url.searchParams.get("post_logout_redirect_uri") === logoutReturn
      ) {
        logouts += 1;
        return redirect(res, logoutReturn);
      }
      return respond(res, 404, { error: "fixture_route_missing" });
    } catch {
      respond(res, 500, { error: "fixture_error" });
    }
  })
  .listen(8443, "0.0.0.0");

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    const target = audience("billing-api");
    if (pathname === "/facts") return respond(res, 200, { refreshes, rotations, logouts });
    if (pathname === "/checks")
      return respond(res, 200, {
        user: user("auth0|alice"),
        otherAudience: user("auth0|alice", { aud: "https://fixture.test/other" }),
        expired: user("auth0|alice", { exp: Math.floor(Date.now() / 1000) - 1 }),
        allowedMachine: machine("account-api", target),
        wrongCaller: machine("browser-api", target),
        wrongAudienceMachine: machine("account-api", audience("link-api")),
        machineOnUserAudience: machine("account-api", userAudience),
      });
    return respond(res, 404, { error: "fixture_route_missing" });
  })
  .listen(9080, "0.0.0.0");

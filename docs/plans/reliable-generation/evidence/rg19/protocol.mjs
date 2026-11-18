// Actual exported openid-client proof. Every HTTP response is a bounded HTTPS protocol stand-in;
// no native issuer, live account, network, test-clock production override or product token seam.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const app = (await readFile("/tmp/jeeves-rg19-compile-path", "utf8")).trim();
const { createBrowserIssuer } = await import(pathToFileURL(`${app}/dist/runtime/browser-oidc.js`));
const { operation, withOperation } = await import(
  pathToFileURL(`${app}/dist/runtime/operation.js`)
);
const { generateKeyPair, exportJWK, SignJWT } = await import(
  pathToFileURL(`${app}/node_modules/jose/dist/webapi/index.js`)
);
const pair = await generateKeyPair("RS256");
const other = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
const issuer = "https://issuer.test/realms/identity";
const settings = {
  issuer,
  clientId: "jeeves-browser-browser-api-sign-in",
  clientSecret: "private-client-secret",
  callback: "https://app.test/modules/sign-in/callback",
  origin: "https://app.test",
  audience: "api-audience",
  offlineAccess: true,
};
let mode = "valid",
  grant,
  posts = 0,
  metadata = 0;
let admitted;
const hung = [];
const response = (value) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, options) => {
  const target = String(url);
  assert.equal(new URL(target).protocol, "https:");
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  if (mode === "oversize")
    return new Response(new Uint8Array(262145), {
      headers: { "content-type": "application/json" },
    });
  if (mode === "outage") throw new Error("private-response-secret must never leak");
  if (target === `${issuer}/.well-known/openid-configuration`) {
    metadata++;
    return response({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      code_challenge_methods_supported: ["S256"],
    });
  }
  if (target === `${issuer}/jwks`)
    return mode === "jwks" ? response({ keys: "invalid" }) : response({ keys: [jwk] });
  assert.equal(target, `${issuer}/token`);
  posts++;
  const form = new URLSearchParams(options.body);
  assert.equal(form.get("grant_type"), "authorization_code");
  assert.equal(form.get("client_id"), settings.clientId);
  assert.equal(form.get("client_secret"), settings.clientSecret);
  assert.equal(form.get("redirect_uri"), settings.callback);
  if (mode === "pending")
    return new Promise((resolve) => {
      hung.push(() =>
        resolve(
          new Response(JSON.stringify({ error: "invalid_grant" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          }),
        ),
      );
      admitted?.();
    });
  if (mode === "network") throw new TypeError("private upstream error");
  if (mode === "server")
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  if (mode === "limited")
    return new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  if (mode === "malformed")
    return new Response("broken-secret-upstream-json", {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  if (mode === "client")
    return new Response(JSON.stringify({ error: "invalid_client" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  if (
    mode === "pkce" ||
    createHash("sha256").update(form.get("code_verifier")).digest("base64url") !== grant.challenge
  )
    return new Response(JSON.stringify({ error: "invalid_grant" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  const signed = new SignJWT({
    nonce: mode === "nonce" ? "wrong" : grant.nonce,
    name: "Alice",
    ...(mode === "workload" ? { jeeves_workload: "api" } : {}),
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(mode === "issuer" ? "https://other.test" : issuer)
    .setAudience(mode === "audience" ? "wrong" : settings.clientId)
    .setSubject(mode === "subject" ? "é".repeat(200) : "alice")
    .setIssuedAt()
    .setExpirationTime(mode === "expiry" ? "-1m" : "5m");
  const id = await signed.sign(mode === "signature" ? other.privateKey : pair.privateKey);
  return response({
    token_type: "Bearer",
    access_token: "private-access-token",
    refresh_token: "private-refresh-token",
    id_token: id,
    expires_in: 60,
  });
};
const rp = createBrowserIssuer(settings);
await rp.start();
const values = () => ({
  state: randomBytes(32).toString("base64url"),
  nonce: randomBytes(32).toString("base64url"),
  verifier: randomBytes(32).toString("base64url"),
});
async function request(input = values()) {
  const url = new URL(await rp.authorize(input));
  grant = { ...input, challenge: url.searchParams.get("code_challenge") };
  assert.equal(url.searchParams.get("scope"), "openid profile email offline_access");
  assert.equal(url.searchParams.get("audience"), "api-audience");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  return { input, callback: new URL(`${settings.callback}?code=test-code&state=${input.state}`) };
}
const first = await request();
const ok = await rp.exchange(first.callback, first.input);
assert.equal(ok.subject, "alice");
assert.equal(ok.refresh, "private-refresh-token");
console.log("PASS actual pinned library valid RS256/code/PKCE/state/nonce/audience/offline flow");
const stale = posts;
const mismatch = await request();
mismatch.callback.searchParams.set("state", "wrong");
await assert.rejects(rp.exchange(mismatch.callback, mismatch.input), (e) => e.statusCode === 401);
assert.equal(posts, stale);
console.log("PASS state mismatch refuses before token POST");
for (mode of [
  "nonce",
  "pkce",
  "signature",
  "issuer",
  "audience",
  "expiry",
  "subject",
  "workload",
]) {
  const attempt = await request();
  await assert.rejects(rp.exchange(attempt.callback, attempt.input), (e) => e.statusCode === 401);
  console.log("PASS", mode, "mismatch/refusal via actual library and bounded subject policy");
}
mode = "outage";
await assert.rejects(
  createBrowserIssuer(settings).start(),
  (e) => e.code === "IDENTITY_UNAVAILABLE",
);
console.log("PASS startup issuer outage safely refuses readiness setup");
mode = "oversize";
await assert.rejects(
  createBrowserIssuer(settings).start(),
  (e) => e.code === "IDENTITY_UNAVAILABLE",
);
console.log("PASS issuer streaming byte limit refuses oversized metadata");
mode = "valid";
for (let i = 0; i < 40; i++) {
  const stopped = new AbortController();
  const run = operation({ maximumMs: 1000, signals: [stopped.signal] });
  try {
    await assert.rejects(
      withOperation(run.context, async () => {
        stopped.abort();
        await rp.start();
      }),
    );
  } finally {
    run.close();
  }
}
const afterRefusals = await request();
assert.equal((await rp.exchange(afterRefusals.callback, afterRefusals.input)).subject, "alice");
console.log("PASS forty pre-dispatch cancelled requests release their reservations");
for (mode of ["network", "server", "limited", "malformed", "client", "jwks"]) {
  const isolated = createBrowserIssuer(settings);
  await isolated.start();
  const attempt = await request();
  await assert.rejects(
    isolated.exchange(attempt.callback, attempt.input),
    (e) => e.statusCode !== 401 && e.outcome === "unknown",
  );
  console.log(
    "PASS actual SDK",
    mode,
    "failure remains dependency/unknown, never anonymous/auth refusal",
  );
}
mode = "pending";
for (let i = 0; i < 32; i++) {
  const attempt = await request();
  const cancel = new AbortController();
  const run = operation({ maximumMs: 5000, signals: [cancel.signal] });
  const gate = new Promise((resolve) => {
    admitted = resolve;
  });
  const actual = withOperation(run.context, () => rp.exchange(attempt.callback, attempt.input));
  const refusal = assert.rejects(actual, (e) => e.outcome === "unknown");
  await gate;
  cancel.abort();
  await refusal;
  run.close();
  admitted = undefined;
}
const before = posts;
const attempt = await request();
await assert.rejects(
  rp.exchange(attempt.callback, attempt.input),
  (e) => e.code === "IDENTITY_SATURATED",
);
assert.equal(posts, before);
assert.equal(hung.length, 32);
for (const finish of hung) finish();
await new Promise((resolve) => setTimeout(resolve, 20));
console.log(
  "PASS token POST timeout remains unknown;32 actual pending grants retain capacity until settled; no retry",
);
console.log(
  "PROTOCOL PASSED: actual export and pinned dependencies; HTTPS protocol stand-ins only; metadata requests",
  metadata,
);

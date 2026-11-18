// Actual emitted adapter + pinned maintained SDK. HTTPS fetch stand-ins only; no live issuer.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const app = (await readFile("/tmp/jeeves-rg20-compile-path", "utf8")).trim();
const { createBrowserIssuer } = await import(pathToFileURL(`${app}/dist/runtime/browser-oidc.js`));
const { operation, withOperation } = await import(
  pathToFileURL(`${app}/dist/runtime/operation.js`)
);
const { generateKeyPair, exportJWK, SignJWT } = await import(
  pathToFileURL(`${app}/node_modules/jose/dist/webapi/index.js`)
);
const pair = await generateKeyPair("RS256"),
  other = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(pair.publicKey)), kid: "refresh-key", alg: "RS256", use: "sig" };
const issuer = "https://issuer.test/realms/identity",
  client = "jeeves-browser-browser-api-sign-in";
const settings = {
  issuer,
  clientId: client,
  clientSecret: "private-secret",
  callback: "https://app.test/modules/sign-in/callback",
  origin: "https://app.test",
  offlineAccess: true,
};
let mode = "valid",
  posts = 0,
  admitted;
const pending = [];
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, options) => {
  assert.equal(new URL(String(url)).protocol, "https:");
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  if (String(url) === `${issuer}/.well-known/openid-configuration`)
    return json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
    });
  if (String(url) === `${issuer}/jwks`) return json({ keys: [jwk] });
  assert.equal(String(url), `${issuer}/token`);
  posts++;
  const form = new URLSearchParams(options.body);
  assert.equal(form.get("grant_type"), "refresh_token");
  assert.equal(form.get("refresh_token"), "private-refresh");
  assert.equal(form.get("client_id"), client);
  assert.equal(form.get("client_secret"), settings.clientSecret);
  if (mode === "pending")
    return new Promise((resolve) => {
      pending.push(() => resolve(json({ error: "invalid_grant" }, 400)));
      admitted?.();
    });
  if (mode === "network") throw new TypeError("secret network detail");
  if (mode === "malformed")
    return new Response("secret malformed body", {
      headers: { "content-type": "application/json" },
    });
  if (mode === "oversize") return new Response(new Uint8Array(262145));
  if (mode === "invalid-grant") return json({ error: "invalid_grant" }, 400);
  if (mode === "server") return json({ error: "temporarily_unavailable" }, 503);
  if (mode === "limited") return json({ error: "temporarily_unavailable" }, 429);
  if (mode === "client") return json({ error: "invalid_client" }, 401);
  const result = {
    access_token: "new-private-access",
    token_type: "Bearer",
    expires_in: mode === "short" ? 20 : 3600,
  };
  if (mode !== "omitted") {
    result.refresh_token = "new-private-refresh";
    const now = Math.floor(Date.now() / 1000);
    result.id_token = await new SignJWT(mode === "workload" ? { jeeves_workload: "worker" } : {})
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setSubject(mode === "subject" ? "bob" : "alice")
      .setIssuer(mode === "issuer" ? "https://other.test" : issuer)
      .setAudience(mode === "audience" ? "other-client" : client)
      .setIssuedAt(now)
      .setExpirationTime(mode === "expired" ? now - 3600 : now + 3600)
      .sign(mode === "signature" ? other.privateKey : pair.privateKey);
  }
  return json(result);
};
const run = async (effect, signal) => {
  const op = operation({ maximumMs: 10000, signals: signal ? [signal] : [] });
  try {
    return await withOperation(op.context, effect);
  } finally {
    op.close();
  }
};
const sdk = createBrowserIssuer(settings);
await run(() => sdk.start());
for (const next of ["valid", "omitted"]) {
  mode = next;
  const before = posts;
  const result = await run(() => sdk.refresh("private-refresh", "alice"));
  assert.equal(posts, before + 1);
  assert.equal(result.access, "new-private-access");
  assert.equal(result.expiresIn, 3600);
  assert.equal(result.refresh, next === "omitted" ? null : "new-private-refresh");
  assert.equal(result.id === null, next === "omitted");
  console.log(next, "accepted once; identity retained, no token returned by public routes");
}
for (const next of [
  "subject",
  "workload",
  "issuer",
  "audience",
  "signature",
  "expired",
  "invalid-grant",
  "server",
  "limited",
  "client",
  "network",
  "malformed",
  "oversize",
  "short",
]) {
  mode = next;
  const before = posts;
  let failure;
  try {
    await run(() => sdk.refresh("private-refresh", "alice"));
  } catch (error) {
    failure = error;
  }
  assert.ok(failure);
  assert.equal(posts, before + 1, "no automatic grant retry");
  const expected = ["subject", "workload", "invalid-grant"].includes(next)
    ? "refused"
    : ["server", "limited", "client"].includes(next)
      ? "definite-failure"
      : "unknown";
  assert.equal(failure.outcome, expected);
  if (expected === "refused") assert.equal(failure.statusCode, 401);
  else assert.notEqual(failure.statusCode, 401);
  assert.ok(!failure.message.includes("secret"));
  console.log(next, expected, "single POST; no credentials adopted");
}
mode = "pending";
const controllers = [],
  work = [];
const allEntered = new Promise((resolve) => {
  admitted = () => {
    if (pending.length === 32) resolve();
  };
});
for (let i = 0; i < 32; i++) {
  const abort = new AbortController();
  controllers.push(abort);
  work.push(
    run(() => sdk.refresh("private-refresh", "alice"), abort.signal).then(
      () => assert.fail("unexpected successful cancelled refresh"),
      (error) => assert.equal(error.outcome, "unknown"),
    ),
  );
}
await allEntered;
for (const abort of controllers) abort.abort();
await Promise.all(work);
const before = posts;
await assert.rejects(
  run(() => sdk.refresh("private-refresh", "alice")),
  (error) => error.code === "IDENTITY_SATURATED",
);
assert.equal(posts, before);
console.log("32 actual pending refreshes retain capacity after browser cancellation; no33rd POST");
for (const release of pending.splice(0)) release();
await new Promise((resolve) => setImmediate(resolve));
mode = "valid";
await run(() => sdk.refresh("private-refresh", "alice"));
console.log("actual settlement releases slots; recovery succeeds");
mode = "pending";
const began = new Promise((resolve) => {
  admitted = resolve;
});
const start = performance.now();
const timed = run(() => sdk.refresh("private-refresh", "alice"));
const observed = assert.rejects(timed, (error) => error.outcome === "unknown");
await began;
await observed;
assert.ok(performance.now() - start < 5000);
console.log("fixed3s SDK timeout returns unknown while actual POST remains counted");
for (const release of pending.splice(0)) release();
await new Promise((resolve) => setImmediate(resolve));
console.log("Actual pinned openid-client6.8.9 refresh/JOSE6.2.13 proof passed", { posts });

// Actual emitted adapter, pinned JOSE/openid-client, HTTPS stand-ins; no live issuer.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const app = (await readFile("/tmp/jeeves-rg21-compile-path", "utf8")).trim();
const load = (name) => import(pathToFileURL(`${app}/dist/runtime/${name}.js`));
const { operation, withOperation } = await load("operation");
const { createBrowserIssuer } = await load("browser-oidc");
const { generateKeyPair, exportJWK, SignJWT } = await import(
  pathToFileURL(`${app}/node_modules/jose/dist/webapi/index.js`)
);
const pair = await generateKeyPair("RS256"),
  other = await generateKeyPair("RS256");
const issuer = "https://issuer.test/realms/issuer",
  audience = "issuer-web",
  client = "jeeves-browser-caller-browser-session";
const jwk = { ...(await exportJWK(pair.publicKey)), kid: "one", alg: "RS256", use: "sig" };
let tokenPosts = 0,
  jwksReads = 0;
const jwt = async (overrides = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(overrides.workload ? { jeeves_workload: "caller" } : {})
    .setProtectedHeader({ alg: "RS256", kid: "one" })
    .setSubject(overrides.subject ?? "alice")
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? audience)
    .setIssuedAt(now)
    .setExpirationTime(overrides.expired ? now - 60 : now + 3600)
    .sign(overrides.signature ? other.privateKey : pair.privateKey);
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
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
  if (String(url) === `${issuer}/jwks`) {
    jwksReads++;
    return json({ keys: [jwk] });
  }
  assert.equal(String(url), `${issuer}/token`);
  tokenPosts++;
  const form = new URLSearchParams(options.body);
  assert.equal(form.get("grant_type"), "refresh_token");
  assert.equal(form.get("refresh_token"), "private-refresh");
  assert.equal(form.get("client_id"), client);
  return json({
    access_token: await jwt(),
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "replacement-refresh",
  });
};
const run = async (effect) => {
  const op = operation({ maximumMs: 10000 });
  try {
    return await withOperation(op.context, effect);
  } finally {
    op.close();
  }
};
const sdk = createBrowserIssuer({
  issuer,
  clientId: client,
  clientSecret: "private",
  callback: "https://app.test/modules/browser-session/callback",
  origin: "https://app.test",
  offlineAccess: true,
});
await run(() => sdk.start());
const awaitedValid = await jwt();
assert.equal(await run(() => sdk.verifyAccess(awaitedValid, audience, "alice")), undefined);

for (const [name, change] of Object.entries({
  subject: { subject: "bob" },
  issuer: { issuer: "https://other.test/realms/issuer" },
  audience: { audience: "other-web" },
  expired: { expired: true },
  signature: { signature: true },
  workload: { workload: true },
})) {
  await assert.rejects(
    run(async () => sdk.verifyAccess(await jwt(change), audience, "alice")),
    (error) => error.statusCode === 403 && error.code === "SESSION_IDENTITY_INCOMPATIBLE",
  );
  console.log(name, "refused by actual pinned JWT verifier before credential forwarding");
}
const rotated = await run(() => sdk.refresh("private-refresh", "alice"));
await run(() => sdk.verifyAccess(rotated.access, audience, "alice"));
assert.equal(tokenPosts, 1);
assert.equal(jwksReads, 1);
console.log(
  "one maintained-SDK refresh POST; replacement verified; cached JWKS reused; no token values printed",
);
const extension = `${app}/src/modules/caller/send.ts`,
  original = await readFile(extension, "utf8");
await writeFile(
  extension,
  original + '\nimport {sessionAccess} from "../../runtime/operation.ts";\nvoid sessionAccess;\n',
);
try {
  let refused = false;
  try {
    execFileSync(process.execPath, [`${app}/scripts/check-extensions.mjs`], {
      cwd: app,
      stdio: "pipe",
    });
  } catch (error) {
    refused = String(error.stderr).includes("runtime") || String(error.stdout).includes("runtime");
  }
  assert.equal(refused, true);
  console.log("actual public extension checker refuses private token-provider import");
} finally {
  await writeFile(extension, original);
}

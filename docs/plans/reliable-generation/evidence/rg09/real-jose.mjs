/** Run with Node 24 against a scratch export and its installed pinned dependencies. No network. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
if (!root) throw Error("Supply the scratch generated export directory");
const require = createRequire(`${root}/package.json`);
const jose = await import(pathToFileURL(require.resolve("jose")));
const runtime = await import(pathToFileURL(`${root}/src/runtime/workload.ts`));
const identity = await import(pathToFileURL(`${root}/src/runtime/identity.ts`));
const one = await jose.generateKeyPair("RS256", { extractable: true });
const two = await jose.generateKeyPair("RS256", { extractable: true });
const jwk = { ...(await jose.exportJWK(one.publicKey)), kid: "one", alg: "RS256" };
const jwkTwo = { ...(await jose.exportJWK(two.publicKey)), kid: "two", alg: "RS256" };
const started = Date.now();
let clock = started;
const originalNow = Date.now;
const originalFetch = globalThis.fetch;
const counts = { token: 0, jwks: 0, service: 0 };
let offline = false;
let keys = [jwk];
const settings = {
  identity: "issuer",
  client: "jeeves-workload-caller",
  audience: "jeeves-service-callee",
  issuer: "https://issuer.example/realms/issuer",
  tokenUrl: "https://issuer.example/token",
  jwksUrl: "https://issuer.example/jwks",
  secret: "ephemeral-in-memory-fixture",
};
async function token(overrides = {}, kid = "one") {
  const at = Math.floor(started / 1000);
  return new jose.SignJWT({
    sub: "service-account-caller",
    azp: settings.client,
    jeeves_workload: "caller",
    iat: at,
    exp: at + 300,
    aud: settings.audience,
    iss: settings.issuer,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .sign(kid === "one" ? one.privateKey : two.privateKey);
}
try {
  Date.now = () => clock;
  const credential = await token();
  globalThis.fetch = async (url, init) => {
    if (String(url) === settings.tokenUrl) {
      counts.token++;
      if (offline) throw Error("offline token endpoint");
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("grant_type"), "client_credentials");
      assert.equal(form.get("client_id"), settings.client);
      assert.equal(form.get("audience"), settings.audience);
      return Response.json({ access_token: credential });
    }
    if (String(url) === settings.jwksUrl) {
      counts.jwks++;
      if (offline) throw Error("offline JWKS endpoint");
      return Response.json({ keys });
    }
    counts.service++;
    throw Error("Unexpected service/network dispatch");
  };
  const callee = runtime.createWorkload(settings, []);
  assert.deepEqual(await callee.require(`Bearer ${credential}`, ["caller"]), { process: "caller" });
  assert.equal(counts.jwks, 1);
  offline = true;
  clock = started + 10000;
  assert.deepEqual(await callee.require(`Bearer ${credential}`, ["caller"]), { process: "caller" });
  assert.equal(counts.jwks, 1);
  const nextKey = await token({}, "two");
  await assert.rejects(callee.require(`Bearer ${nextKey}`, ["caller"]), { statusCode: 401 });
  assert.equal(counts.jwks, 1);
  clock = started + 31000;
  await assert.rejects(callee.require(`Bearer ${nextKey}`, ["caller"]), {
    code: "IDENTITY_UNAVAILABLE",
  });
  assert.equal(counts.jwks, 2);
  await assert.rejects(callee.require(`Bearer ${nextKey}`, ["caller"]), {
    code: "IDENTITY_UNAVAILABLE",
  });
  assert.equal(counts.jwks, 2);
  clock = started + 61000;
  await assert.rejects(callee.require(`Bearer ${credential}`, ["caller"]), {
    code: "IDENTITY_UNAVAILABLE",
  });
  assert.equal(counts.jwks, 3);
  offline = false;
  keys = [jwkTwo];
  clock = started + 62001;
  assert.deepEqual(await callee.require(`Bearer ${nextKey}`, ["caller"]), { process: "caller" });
  assert.equal(counts.jwks, 4);
  await assert.rejects(callee.require(`Bearer ${credential}`, ["caller"]), { statusCode: 401 });
  assert.equal(counts.jwks, 4);
  console.log(
    "Real jose: valid cached key during outage; unknown-key cooldown; failed-refresh cooldown; 60s key expiry fails closed; recovery/rotation passed.",
  );

  clock = started;
  keys = [jwk];
  const caller = runtime.createWorkload(settings, ["callee"]);
  assert.deepEqual(
    new Set(await Promise.all(Array.from({ length: 12 }, () => caller.acquire("callee")))),
    new Set([credential]),
  );
  assert.equal(counts.token, 1);
  const copy = runtime.createWorkload(settings, ["callee"]);
  assert.equal(await copy.acquire("callee"), credential);
  assert.equal(counts.token, 2);
  offline = true;
  clock = started + 296000;
  assert.equal(await caller.acquire("callee"), credential);
  assert.equal(counts.token, 3);
  clock = started + 301000;
  await assert.rejects(caller.acquire("callee"), { code: "IDENTITY_UNAVAILABLE" });
  const cold = runtime.createWorkload(settings, ["callee"]);
  await assert.rejects(cold.acquire("callee"), { code: "IDENTITY_UNAVAILABLE" });
  const failed = counts.token;
  await assert.rejects(cold.acquire("callee"), { code: "IDENTITY_UNAVAILABLE" });
  assert.equal(counts.token, failed);
  console.log(
    "Real jose: 12 concurrent callers share one refresh; separate copies fetch separately; valid token survives early refresh outage only to exp; cold/expired credentials fail closed.",
  );

  clock = started;
  offline = false;
  const fresh = runtime.createWorkload(settings, []);
  await assert.rejects(
    fresh.require(`Bearer ${await token({ exp: Math.floor(started / 1000) - 1 })}`, ["caller"]),
    { statusCode: 401 },
  );
  await assert.rejects(fresh.require(`Bearer ${await token({ aud: "other" })}`, ["caller"]), {
    statusCode: 401,
  });
  await assert.rejects(fresh.require(`Bearer ${credential}`, ["other"]), { statusCode: 403 });
  const userOnly = await new jose.SignJWT({ sub: "user-7" })
    .setProtectedHeader({ alg: "RS256", kid: "one" })
    .setIssuer(settings.issuer)
    .setAudience(settings.audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(one.privateKey);
  await assert.rejects(fresh.require(`Bearer ${userOnly}`, ["caller"]), { statusCode: 401 });
  const userVerifier = identity.createPrincipalVerifier({
    issuer: settings.issuer,
    audience: "user-web",
    jwksUrl: settings.jwksUrl,
    algorithms: ["RS256"],
    jwksTimeoutMs: 2000,
  });
  await assert.rejects(
    userVerifier(await token({ aud: [settings.audience, "user-web"] })),
    /Invalid identity token/,
  );
  assert.equal(counts.service, 0);
  console.log(
    "Real jose: expired/wrong-audience/disallowed/user-only identity refusal and dual-audience workload-as-user confusion refusal passed. No live HTTP dispatch.",
  );
  console.log(JSON.stringify(counts));
} finally {
  Date.now = originalNow;
  globalThis.fetch = originalFetch;
}

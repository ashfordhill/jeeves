import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Invoke after public CLI exports, application hook copies, API8 checks and TS7 compilation.
// All Docker resources below belong to this invocation; no install, pull, issuer or provider.
const root = process.argv[2];
assert(root?.startsWith("/tmp/jeeves-wd10/"));
const required = join(root, "required-export-v3");
const none = join(root, "none-export-v3");
const workload = join(root, "workload-export-v3");
const prefix = `jeeves-wd10-${process.pid}`;
const containers = [];
const results = [];
let network;
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const image = "node:24.21.0-alpine3.23";
const nginx = JSON.parse(readFileSync(join(required, "infra/local.json"), "utf8"));
const nginxImage =
  JSON.parse(readFileSync(join(required, ".jeeves/inputs/design.json"), "utf8")) &&
  "nginx:1.28.3-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236";
assert.deepEqual(nginx.edgeStamp, ["front"]);
function setup(directory) {
  if (!existsSync(join(directory, ".runtime")))
    execFileSync(
      process.execPath,
      ["--input-type=module", "-e", 'const m=await import("./scripts/setup.mjs"); m.setup();'],
      { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
    );
  assert.equal(statSync(join(directory, ".runtime/secrets/edge-stamp.env")).mode & 0o777, 0o600);
  const key = /^JEEVES_EDGE_STAMP_KEY=([a-f0-9]{64})\n$/.exec(
    readFileSync(join(directory, ".runtime/secrets/edge-stamp.env"), "utf8"),
  )?.[1];
  assert(key);
  const previous = randomBytes(32).toString("hex");
  const env = join(directory, ".runtime/acceptance.env");
  writeFileSync(
    env,
    `JEEVES_EDGE_STAMP_KEY=${key}\nJEEVES_EDGE_STAMP_KEY_PREVIOUS=${previous}\nOIDC_ISSUER=https://wd10.invalid/realms/issuer\nOIDC_AUDIENCE=issuer-web\nOIDC_JWKS_URL=https://wd10.invalid/jwks\nJEEVES_WORKLOAD_ISSUER=https://wd10.invalid/realms/issuer\nJEEVES_WORKLOAD_TOKEN_URL=https://wd10.invalid/token\nJEEVES_WORKLOAD_JWKS_URL=https://wd10.invalid/jwks\n`,
    { mode: 0o600, flag: "w" },
  );
  return { key, previous, env };
}
const keys = setup(required),
  calleeKeys = setup(workload);
function run(name, directory, command, { alias, env, published = false, mounts = [] } = {}) {
  const args = [
    "run",
    "--pull=never",
    "-d",
    "--name",
    `${prefix}-${name}`,
    "--label",
    "jeeves.unit=wd10",
    "--network",
    network,
  ];
  if (alias) args.push("--network-alias", alias);
  if (published) args.push("-p", "127.0.0.1::3000");
  if (env) args.push("--env-file", env);
  args.push(
    "--mount",
    `type=bind,src=${directory},dst=/app,readonly`,
    "--mount",
    `type=bind,src=${realpathSync(join(directory, "node_modules"))},dst=/app/node_modules,readonly`,
  );
  for (const mount of mounts) args.push("--mount", mount);
  args.push("-w", "/app", image, ...command);
  const id = docker(...args);
  containers.push(id);
  return id;
}
const address = (id, port = "3000/tcp") => `http://${docker("port", id, port).split("\n")[0]}`;
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${url}/readyz`);
      if (response.ok) return;
    } catch {}
    await pause(100);
  }
  throw Error("Task-owned service did not become ready");
}
function stamp(key, path, method = "POST", delta = 0) {
  const seconds = String(Math.floor(Date.now() / 1000) + delta);
  return `v1.${seconds}.${createHmac("sha256", key).update(`${seconds}.${method}.${path}`).digest("hex")}`;
}
async function check(url, name, expected, headers = {}, body = '{"n":1}', method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(method === "POST" && { body }),
  });
  const value = await response.json();
  assert.equal(response.status, expected, name);
  if (expected === 403)
    assert.deepEqual(value, { error: "FORBIDDEN", message: "Request refused." });
  assert(!JSON.stringify(value).includes("v1."), `${name} leaked a stamp`);
  for (const key of [keys.key, keys.previous, calleeKeys.key, calleeKeys.previous])
    assert(!JSON.stringify(value).includes(key));
  results.push({ name, status: response.status });
  return value;
}
try {
  docker("image", "inspect", image);
  docker("image", "inspect", nginxImage);
  network = docker("network", "create", "--label", "jeeves.unit=wd10", `${prefix}-net`);
  const service = run("required", required, ["node", "dist/processes/front.js"], {
    alias: "app-front",
    env: keys.env,
    published: true,
  });
  const plain = run("none", none, ["node", "dist/processes/front.js"], { published: true });
  const callee = run("callee", workload, ["node", "dist/processes/callee.js"], {
    env: calleeKeys.env,
    published: true,
    mounts: [`type=bind,src=${join(workload, ".runtime/secrets")},dst=/run/secrets,readonly`],
  });
  const direct = address(service),
    plainUrl = address(plain),
    calleeUrl = address(callee);
  await Promise.all([ready(direct), ready(plainUrl), ready(calleeUrl)]);
  for (const health of ["/livez", "/readyz", "/healthz"])
    await check(`${direct}${health}`, `health ${health}`, 200, {}, undefined, "GET");
  await check(`${direct}/modules/echo`, "missing", 403);
  await check(`${direct}/unmatched?private=do-not-log`, "unmatched before routing", 403);
  await check(`${direct}/modules/echo`, "malformed JSON before parser", 403, {}, "{");
  await check(
    `${direct}/modules/echo`,
    "unsupported content type before parser",
    403,
    { "Content-Type": "image/invalid" },
    "x",
  );
  await check(`${direct}/modules/echo`, "oversize before parser", 403, {}, "x".repeat(70000));
  for (const [name, value] of [
    ["old", stamp(keys.key, "/modules/echo", "POST", -61)],
    ["future", stamp(keys.key, "/modules/echo", "POST", 61)],
    ["wrong MAC", stamp("c".repeat(64), "/modules/echo")],
    ["wrong method", stamp(keys.key, "/modules/echo", "GET")],
    ["wrong path", stamp(keys.key, "/another")],
  ])
    await check(`${direct}/modules/echo`, name, 403, { "x-edge-stamp": value });
  for (const [name, key] of [
    ["current", keys.key],
    ["previous", keys.previous],
  ]) {
    const body = await check(`${direct}/modules/echo?query=ignored`, name, 200, {
      "x-edge-stamp": stamp(key, "/modules/echo"),
    });
    assert.equal(body.ok, true);
    assert(!Object.hasOwn(body.headers, "x-edge-stamp"));
  }
  await check(`${plainUrl}/modules/echo`, "none unchanged", 200);
  await check(`${calleeUrl}/internal/unknown`, "unknown internal requires stamp", 403);
  await check(
    `${calleeUrl}/internal/modules/receive/subpath`,
    "internal descendant requires stamp",
    403,
  );
  await check(
    `${calleeUrl}/internal/modules/receive`,
    "unregistered internal PUT requires stamp",
    403,
    {},
    undefined,
    "PUT",
  );
  const head = await fetch(`${calleeUrl}/internal/modules/receive`, { method: "HEAD" });
  assert.equal(head.status, 401);
  results.push({ name: "automatic HEAD retains Required user guard", status: head.status });
  await check(
    `${calleeUrl}/internal/modules/receive`,
    "internal root retains Required user guard",
    401,
  );
  await check(
    `${calleeUrl}/internal/modules/receive`,
    "Required user guard refuses before workload verification",
    401,
    {
      "x-jeeves-workload": "Bearer invalid",
    },
  );
  await check(`${calleeUrl}/modules/receive`, "stamp never replaces Required user", 401, {
    "x-edge-stamp": stamp(calleeKeys.key, "/modules/receive"),
  });
  await check(
    `${calleeUrl}/internal/modules/receive`,
    "internal stamp never bypasses Required user guard",
    401,
    {
      "x-edge-stamp": stamp(calleeKeys.key, "/internal/modules/receive"),
    },
  );
  run("stamper", required, ["node", "scripts/edge-stamp.mjs"], {
    alias: "app-edge-stamp",
    env: keys.env,
  });
  const edge = docker(
    "run",
    "--pull=never",
    "-d",
    "--name",
    `${prefix}-nginx`,
    "--label",
    "jeeves.unit=wd10",
    "--network",
    network,
    "-p",
    "127.0.0.1::8080",
    "--mount",
    `type=bind,src=${join(required, "infra/edge/nginx.conf")},dst=/etc/nginx/nginx.conf,readonly`,
    nginxImage,
  );
  containers.push(edge);
  const edgeUrl = address(edge, "8080/tcp");
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${edgeUrl}/healthz`);
      if (r.ok) break;
    } catch {}
    await pause(100);
  }
  const through = await check(
    `${edgeUrl}/api/front/modules/echo?native=1`,
    "generated nginx + local stamp edge",
    200,
    { "x-edge-stamp": "client-forgery" },
  );
  assert.equal(through.ok, true);
  assert(!Object.hasOwn(through.headers, "x-edge-stamp"));
  const missing = run("missing-key", required, ["node", "dist/processes/front.js"]);
  for (let i = 0; i < 50 && docker("inspect", "-f", "{{.State.Status}}", missing) !== "exited"; i++)
    await pause(100);
  assert.equal(docker("inspect", "-f", "{{.State.ExitCode}}", missing), "1");
  const captured = spawnSync("docker", ["logs", missing], { encoding: "utf8" });
  const missingLogs = `${captured.stdout}${captured.stderr}`;
  assert(missingLogs.includes("Invalid setting JEEVES_EDGE_STAMP_KEY"));
  const marker = spawnSync(
    "docker",
    ["cp", `${missing}:/tmp/application-ready`, join(root, "unexpected-ready-marker")],
    { encoding: "utf8" },
  );
  assert.notEqual(marker.status, 0);
  results.push({
    name: "missing key startup before readiness",
    exitCode: 1,
    readyMarkerAbsent: true,
  });
  const log = docker("logs", service);
  const refused = log
    .split("\n")
    .filter((line) => line.includes("EDGE_STAMP_"))
    .map((line) => JSON.parse(line));
  assert.equal(refused.length, 10);
  for (const entry of refused) assert.deepEqual(Object.keys(entry), ["reason"]);
  for (const secret of [keys.key, keys.previous]) assert(!log.includes(secret));
  assert(!log.includes("v1."));
  assert(!log.includes("do-not-log"));
  results.push({
    name: "single reason-only refusal log; stamp/key/URI absent",
    refusalRecords: refused.length,
  });
} finally {
  try {
    const diagnostics = containers.map((id) => {
      const state = docker("inspect", "-f", "{{.State.Status}} {{.State.ExitCode}}", id);
      const portBindings = docker("inspect", "-f", "{{json .HostConfig.PortBindings}}", id);
      const captured = spawnSync("docker", ["logs", id], { encoding: "utf8" });
      const logs = `${captured.stdout}${captured.stderr}`;
      for (const key of [keys.key, keys.previous, calleeKeys.key, calleeKeys.previous])
        assert(!logs.includes(key));
      assert(!logs.includes("v1."));
      return { id, state, portBindings, logs };
    });
    writeFileSync(
      join(root, `native-diagnostics-${process.pid}.json`),
      `${JSON.stringify(diagnostics, null, 2)}\n`,
    );
  } finally {
    for (const id of containers.reverse()) docker("rm", "-f", id);
    if (network) docker("network", "rm", network);
  }
  writeFileSync(
    join(root, "native-results.json"),
    `${JSON.stringify({ prefix, results, exactTaskResourcesRemoved: true }, null, 2)}\n`,
  );
}
console.log(
  `WD10 native acceptance passed ${results.length} checks; exact task containers/network removed.`,
);

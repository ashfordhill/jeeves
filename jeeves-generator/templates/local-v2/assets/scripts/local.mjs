import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { capture, hash, output, plan } from "./common.mjs";
import { setup } from "./setup.mjs";

const command = process.argv[2];
if (!["first-run", "start", "stop"].includes(command))
  throw new Error("Use first-run, start or stop.");
const project = process.env.COMPOSE_PROJECT_NAME;
if (!project || !/^[a-z0-9][a-z0-9_-]{2,60}$/.test(project))
  throw new Error("Set a unique bounded COMPOSE_PROJECT_NAME; there is no default project.");
const ports = Object.fromEntries(
  ["LOCAL_HTTP_PORT", "LOCAL_IDENTITY_PORT", "LOCAL_OBJECT_PORT"].map((key) => {
    const value = process.env[key];
    if (
      !value ||
      !/^\d{4,5}$/.test(value) ||
      Number(value) < 1024 ||
      Number(value) > 65535 ||
      [4300, 4301, 4304, 4310, 4311, 4400, 4401, 4402, 54329].includes(Number(value))
    )
      throw new Error(`Set a permitted free loopback ${key}; owner/v1 ports are reserved.`);
    return [key, Number(value)];
  }),
);
if (new Set(Object.values(ports)).size !== 3)
  throw new Error("Allocate three distinct ports together with the project/runtime.");
const statePath = ".runtime/local-setup.json";
const volumeIdentity = (name) => {
  let value;
  try {
    value = JSON.parse(capture("volume", "inspect", name))[0];
  } catch {
    throw new Error(
      `Recorded volume ${name} is missing; recover it. No replacement will be created.`,
    );
  }
  return {
    name: value.Name,
    createdAt: value.CreatedAt,
    driver: value.Driver,
    project: value.Labels?.["com.docker.compose.project"],
    volume: value.Labels?.["com.docker.compose.volume"],
  };
};
const ownedVolumes = () => {
  const names = capture(
    "volume",
    "ls",
    "-q",
    "--filter",
    `label=com.docker.compose.project=${project}`,
  );
  return names ? names.split("\n").sort().map(volumeIdentity) : [];
};
const credentialHashes = (names) =>
  Object.fromEntries(
    names.sort().map((name) => {
      const path = `.runtime/secrets/${name}`;
      if (!existsSync(path))
        throw new Error(
          `Missing ${path}; recover original credentials, never rotate over live volumes.`,
        );
      return [name, hash(readFileSync(path))];
    }),
  );
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const composition = hash(
  Buffer.concat([readFileSync("compose.yaml"), readFileSync("infra/local.json")]),
);
let state;
if (existsSync(statePath)) {
  for (const dir of [".runtime", ".runtime/secrets"])
    if (statSync(dir).mode & 0o077)
      throw new Error("Runtime parent directories must remain private (0700).");
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    throw new Error(
      "Unreadable initialization history; preserve runtime and volumes for recovery.",
    );
  }
  if (
    state.version !== 1 ||
    state.project !== project ||
    !same(state.ports, ports) ||
    state.composition !== composition ||
    !Array.isArray(state.done) ||
    !state.secrets ||
    !Array.isArray(state.volumes)
  )
    throw new Error(
      "Runtime project/ports/composition/history differs; preserve original values and volumes.",
    );
  if (!same(credentialHashes(Object.keys(state.secrets)), state.secrets))
    throw new Error("Runtime credentials changed; recover original private files.");
  for (const v of state.volumes)
    if (!same(volumeIdentity(v.name), v))
      throw new Error(
        `Recorded volume ${v.name} identity changed; no initialization replay permitted.`,
      );
  if (state.done.includes("providers") && !same(ownedVolumes(), state.volumes))
    throw new Error("Exact-project volume set changed; preserve and inspect runtime.");
} else if (existsSync(".runtime"))
  throw new Error(
    "Untracked .runtime exists; preserve it and recover history instead of bootstrapping.",
  );
const save = () => {
  writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  renameSync(`${statePath}.tmp`, statePath);
};
if (!state) {
  if (command !== "first-run") throw new Error("Use first-run only for a genuinely new runtime.");
  const definition = JSON.parse(readFileSync("compose.yaml", "utf8"));
  const existingNames = new Set(capture("volume", "ls", "--format", "{{.Name}}").split("\n"));
  const expectedNames = Object.entries(definition.volumes ?? {}).map(
    ([name, value]) => value.name ?? `${project}_${name}`,
  );
  const existingNetworks = new Set(capture("network", "ls", "--format", "{{.Name}}").split("\n"));
  const expectedNetwork = definition.networks?.default?.name ?? `${project}_default`;
  if (
    expectedNames.some((name) => existingNames.has(name)) ||
    existingNetworks.has(expectedNetwork)
  )
    throw new Error(
      "Compose volume/network namespace already exists without this runtime, including unlabeled resources. Recover it; no new credentials or provider state will be created.",
    );
  if (
    ownedVolumes().length ||
    capture("ps", "-aq", "--filter", `label=com.docker.compose.project=${project}`)
  )
    throw new Error(
      "Exact-project Docker state already exists without this runtime. Recover it; do not initialize or delete blindly.",
    );
}
if (command === "stop") {
  output("stop");
  process.exit(0);
}
const owned = capture("ps", "-q", "--filter", `label=com.docker.compose.project=${project}`);
const published = owned
  ? JSON.parse(capture("inspect", ...owned.split("\n"))).flatMap((c) =>
      Object.values(c.NetworkSettings.Ports ?? {})
        .flatMap((p) => p ?? [])
        .map((p) => Number(p.HostPort)),
    )
  : [];
for (const port of Object.values(ports)) {
  if (published.includes(port)) continue;
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(new Error(`Loopback port ${port} is occupied; preserve other services.`)),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
if (!state) {
  setup();
  state = {
    version: 1,
    project,
    ports,
    composition,
    done: ["secrets"],
    pending: null,
    volumes: [],
    secrets: credentialHashes([...plan.secrets]),
  };
  save();
}
if (state.pending === "storage-bootstrap")
  throw new Error(
    "Storage bootstrap was interrupted. Preserve .runtime/volumes; inspect layout/buckets/keys/CORS/owner revocation before manually completing and recording this exact step. Never replay blindly.",
  );
if (command === "start" && !state.done.includes("initialized"))
  throw new Error(
    "First initialization incomplete; use first-run for repeatable steps with retained credentials.",
  );
const step = (name, run, once = false) => {
  if (once && state.done.includes(name)) return;
  state.pending = name;
  save();
  run();
  if (!state.done.includes(name)) state.done.push(name);
  state.pending = null;
  save();
};
const setupServices = ["setup-migrate", "setup-broker", "setup-search", "setup-storage"].filter(
  (name) => Object.hasOwn(JSON.parse(readFileSync("compose.yaml", "utf8")).services, name),
);
const buildServices = [...setupServices, ...plan.application];
if (buildServices.length) step("build", () => output("build", ...buildServices));
if (plan.providers.length)
  step("providers", () => {
    // Keycloak depends on the setup-created private DB. Start SQL first, migrate, then Identity.
    const providers = plan.providers.filter((name) => !name.startsWith("identity-"));
    try {
      if (providers.length) output("up", "-d", "--wait", "--wait-timeout", "150", ...providers);
    } finally {
      state.volumes = ownedVolumes();
      save();
    }
  });
if (setupServices.includes("setup-migrate"))
  step("migrations", () => output("run", "--rm", "--no-deps", "setup-migrate"));
if (plan.identity.length)
  step("identity", () =>
    output("up", "-d", "--wait", "--wait-timeout", "150", ...plan.identity.map((i) => i.service)),
  );
if (plan.objects.length)
  step(
    "storage-bootstrap",
    () => {
      // Captured key output is handled privately inside bootstrap; do not print it.
      const { execFileSync } = process.getBuiltinModule("node:child_process");
      execFileSync(process.execPath, ["scripts/bootstrap.mjs"], {
        stdio: "inherit",
        timeout: 180000,
      });
      state.secrets = credentialHashes([...plan.secrets, ...plan.generatedSecrets]);
    },
    true,
  );
for (const name of ["setup-broker", "setup-search"])
  if (setupServices.includes(name)) step(name, () => output("run", "--rm", "--no-deps", name));
if (plan.application.length) step("application", () => output("up", "-d", ...plan.application));
if (!state.done.includes("initialized")) state.done.push("initialized");
state.volumes = ownedVolumes();
save();
console.log(
  `Local providers initialized (Compose ${project}); private credentials and volume identities retained. Application readiness remains in .jeeves/report.json.`,
);

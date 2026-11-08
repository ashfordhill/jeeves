import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const command = process.argv[2];
if (!["first-run", "start", "stop"].includes(command))
  throw new Error("Use first-run, start or stop.");
const project = process.env.COMPOSE_PROJECT_NAME ?? "jeeves-youtube-v1";
if (!/^[a-z0-9][a-z0-9_-]{2,60}$/.test(project)) throw new Error("Invalid COMPOSE_PROJECT_NAME.");
process.env.COMPOSE_PROJECT_NAME = project;
const capture = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).trim();
const compose = (...args) => execFileSync("docker", ["compose", ...args], { stdio: "inherit" });
const statePath = ".runtime/local-setup.json";
const fail = (text) => {
  throw new Error(text);
};
const volumeIdentity = (name) => {
  let v;
  try {
    v = JSON.parse(capture("volume", "inspect", name))[0];
  } catch {
    fail(
      `Recorded Docker volume ${name} is missing. Preserve the runtime; recover its original volume before starting. No replacement will be created.`,
    );
  }
  return {
    name: v.Name,
    createdAt: v.CreatedAt,
    driver: v.Driver,
    project: v.Labels?.["com.docker.compose.project"],
    volume: v.Labels?.["com.docker.compose.volume"],
  };
};
const recordVolumes = () => {
  const names = capture(
    "volume",
    "ls",
    "-q",
    "--filter",
    `label=com.docker.compose.project=${project}`,
  );
  return names ? names.split("\n").sort().map(volumeIdentity) : [];
};
const requiredSecrets = [
  "postgres_admin",
  "metadata_owner",
  "metadata_reader",
  "metadata_upload",
  "metadata_lifecycle",
  "counts_owner",
  "counts_reader",
  "counts_writer",
  "identity_password",
  "cache_password",
  "broker_password",
  "creator_password",
  "other_creator_password",
  "identity_admin",
  "garage_rpc",
  "garage.toml",
  "identity.env",
  "realm.json",
];
const hashes = (names) =>
  Object.fromEntries(
    names.map((name) => {
      if (!existsSync(`.runtime/secrets/${name}`))
        fail(
          `Missing .runtime/secrets/${name}. Preserve this runtime; recover its original file before starting.`,
        );
      return [
        name,
        createHash("sha256")
          .update(readFileSync(`.runtime/secrets/${name}`))
          .digest("hex"),
      ];
    }),
  );
let state;
if (existsSync(statePath)) {
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    fail(
      "Initialization record is unreadable. Preserve .runtime and its volumes; recover the original local-setup.json before starting.",
    );
  }
  if (
    !state ||
    !Array.isArray(state.done) ||
    !state.secrets ||
    typeof state.secrets !== "object" ||
    (state.done.includes("initialized") && !Array.isArray(state.volumes))
  )
    fail(
      "Initialization record is incomplete. Preserve .runtime and its volumes; recover/inspect its completed steps and volume identities before starting.",
    );
  if (state.version !== 1 || state.project !== project)
    fail(
      `Runtime belongs to ${state.project}; use that COMPOSE_PROJECT_NAME and retain its volumes.`,
    );
  if (JSON.stringify(hashes(Object.keys(state.secrets))) !== JSON.stringify(state.secrets))
    fail(
      "Runtime credentials changed. Restore the original files; never pair new credentials with existing volumes.",
    );
  for (const v of state.volumes ?? []) {
    if (JSON.stringify(volumeIdentity(v.name)) !== JSON.stringify(v))
      fail(
        `Docker volume ${v.name} no longer matches the recorded runtime. Recover the original volume; initialization will not be replayed.`,
      );
  }
} else if (existsSync(".runtime"))
  fail(
    "Untracked .runtime exists. Preserve it and its Docker volumes. No safe initialization history is available; inspect/recover it manually instead of rerunning setup/bootstrap.",
  );
const save = () => {
  writeFileSync(`${statePath}.tmp`, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  renameSync(`${statePath}.tmp`, statePath);
};
if (!state) {
  if (command !== "first-run")
    fail("No initialized runtime. Use pnpm first-run for a genuinely new runtime.");
  const volumes = capture(
    "volume",
    "ls",
    "-q",
    "--filter",
    `label=com.docker.compose.project=${project}`,
  );
  const containers = capture(
    "ps",
    "-aq",
    "--filter",
    `label=com.docker.compose.project=${project}`,
  );
  if (volumes || containers)
    fail(
      `Docker state already exists for ${project} without this runtime. Recover its original .runtime; do not initialize or delete it blindly.`,
    );
  // setup is single-use. A crash before recording this step intentionally requires manual inspection.
  execFileSync(process.execPath, ["scripts/setup.mjs"], { stdio: "inherit" });
  state = {
    version: 1,
    project,
    done: ["secrets"],
    pending: null,
    secrets: hashes(requiredSecrets),
  };
  save();
}
if (command === "stop") {
  compose(
    "stop",
    "edge",
    "watch",
    "search",
    "search-indexer",
    "view-counter",
    "upload",
    "transcoder",
    "completion-handler",
    "cache",
    "identity",
    "objects",
    "broker",
    "postgres",
    "search-index",
  );
  process.exit(0);
}
if (state.pending === "garage-bootstrap")
  fail(
    "Garage bootstrap was interrupted. Do not replay it: preserve .runtime and the objects volume; inspect Garage layout/buckets/keys/CORS/owner revocation against scripts/bootstrap.mjs. After manually completing and verifying that exact step, record upload_s3/transcoder_s3 hashes, add garage-bootstrap to done and clear pending in .runtime/local-setup.json.",
  );
if (command === "start" && !state.done.includes("initialized"))
  fail(
    "First initialization is incomplete. Use pnpm first-run to resume recorded repeatable steps; no credentials will be rotated.",
  );
// A bound port is permitted only when an existing container of this exact project publishes it.
const owned = capture("ps", "-q", "--filter", `label=com.docker.compose.project=${project}`);
const ports = owned
  ? JSON.parse(capture("inspect", ...owned.split("\n"))).flatMap((c) =>
      Object.values(c.NetworkSettings.Ports ?? {})
        .flatMap((v) => v ?? [])
        .map((p) => Number(p.HostPort)),
    )
  : [];
for (const port of [4400, 4401, 4402]) {
  if (ports.includes(port)) continue;
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Loopback port ${port} is occupied by another process. Preserve it; stop only your own conflicting service.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
function step(name, run, singleUse = false) {
  if (singleUse && state.done.includes(name)) return;
  state.pending = name;
  save();
  run();
  if (!state.done.includes(name)) state.done.push(name);
  state.pending = null;
  save();
}
step("build", () => compose("build", "upload", "transcoder", "edge"));
step("providers", () => {
  compose(
    "up",
    "-d",
    "--wait",
    "postgres",
    "broker",
    "objects",
    "identity",
    "search-index",
    "cache",
  );
  state.volumes = recordVolumes();
});
step(
  "garage-bootstrap",
  () => {
    execFileSync(process.execPath, ["scripts/bootstrap.mjs"], { stdio: "inherit" });
    state.secrets = hashes([...requiredSecrets, "upload_s3", "transcoder_s3"]);
  },
  true,
);
step("migrations", () => compose("run", "--rm", "--no-deps", "migrate"));
step("broker-assertions", () => compose("run", "--rm", "--no-deps", "broker-init"));
step("search-assertions", () => compose("run", "--rm", "--no-deps", "search-init"));
step("implemented-app", () =>
  compose(
    "up",
    "-d",
    "--wait",
    "upload",
    "completion-handler",
    "transcoder",
    "watch",
    "search",
    "search-indexer",
    "view-counter",
    "edge",
  ),
);
if (!state.done.includes("initialized")) state.done.push("initialized");
state.volumes = recordVolumes();
save();
console.log(
  `Core upload, watch, search and playback counts ready at http://127.0.0.1:4400 (Compose ${project}).`,
);

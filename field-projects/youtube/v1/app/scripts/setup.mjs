import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";

// Explicit upgrade path adds only the three newly scoped runtime credentials, never rotates existing ones.
if (process.argv.includes("--add-runtime-roles")) {
  for (const name of [
    "postgres_admin",
    "metadata_owner",
    "metadata_reader",
    "counts_owner",
    "counts_reader",
  ]) {
    if (!existsSync(`.runtime/secrets/${name}`))
      throw new Error(
        "Existing runtime is incomplete; preserve it and inspect missing setup secrets.",
      );
  }
  for (const dir of [".runtime", ".runtime/secrets"])
    if (statSync(dir).mode & 0o077)
      throw new Error("Runtime parent directories must remain private (0700).");
  for (const name of ["metadata_upload", "metadata_lifecycle", "counts_writer"])
    if (!existsSync(`.runtime/secrets/${name}`))
      writeFileSync(`.runtime/secrets/${name}`, randomBytes(32).toString("hex"), {
        mode: 0o644,
        flag: "wx",
      });
  console.log(
    "Scoped runtime credentials present; existing secrets preserved. Run the repeatable migrate setup service.",
  );
  process.exit(0);
}
if (existsSync(".runtime"))
  throw new Error(
    ".runtime exists; retain it. Setup only creates a new runtime; never reset credentials over live volumes.",
  );
mkdirSync(".runtime", { mode: 0o700 });
mkdirSync(".runtime/secrets", { mode: 0o700 });
const values = Object.fromEntries(
  [
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
  ].map((name) => [name, randomBytes(32).toString("hex")]),
);
for (const [name, value] of Object.entries(values))
  writeFileSync(`.runtime/secrets/${name}`, value, { mode: 0o644, flag: "wx" });
writeFileSync(
  ".runtime/secrets/garage.toml",
  `metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "[::]:3901"
rpc_public_addr = "objects:3901"
rpc_secret = "${values.garage_rpc}"
[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"
[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.garage.localhost"
index = "index.html"
`,
  { mode: 0o600, flag: "wx" },
);
// Compose secrets are bind mounts in local Docker; Keycloak's uid 1000 must read this derived file.
// Parent directory remains private to the owner on the host.
writeFileSync(
  ".runtime/secrets/identity.env",
  `KC_DB_PASSWORD=${values.identity_password}
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=${values.identity_admin}
`,
  { mode: 0o644, flag: "wx" },
);
const realm = JSON.parse(
  await (await import("node:fs/promises")).readFile("infra/identity/realm.json", "utf8"),
);
realm.users = [
  {
    username: "creator",
    enabled: true,
    email: "creator@localhost.test",
    emailVerified: true,
    firstName: "Local",
    lastName: "Creator",
    credentials: [{ type: "password", value: values.creator_password, temporary: false }],
    realmRoles: ["creator"],
  },
  {
    username: "other-creator", enabled: true, email: "other-creator@localhost.test",
    emailVerified: true, firstName: "Other", lastName: "Creator",
    credentials: [{ type: "password", value: values.other_creator_password, temporary: false }],
    realmRoles: ["creator"],
  },
];
writeFileSync(".runtime/secrets/realm.json", JSON.stringify(realm), { mode: 0o644, flag: "wx" });
console.log(
  "Created private .runtime. Creator username: creator. Read its password locally from .runtime/secrets/creator_password; do not commit/log secrets.",
);

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

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
    "counts_owner",
    "counts_reader",
    "identity_password",
    "cache_password",
    "broker_password",
    "creator_password",
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
];
writeFileSync(".runtime/secrets/realm.json", JSON.stringify(realm), { mode: 0o644, flag: "wx" });
console.log(
  "Created private .runtime. Creator username: creator. Read its password locally from .runtime/secrets/creator_password; do not commit/log secrets.",
);

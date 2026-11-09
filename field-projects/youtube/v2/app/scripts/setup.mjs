import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { plan } from "./common.mjs";

/** Called only after local.mjs has checked exact-project Docker state and free ports. */
export function setup() {
  if (existsSync(".runtime"))
    throw new Error("Existing .runtime must be retained; setup is single-use.");
  mkdirSync(".runtime", { mode: 0o700 });
  mkdirSync(".runtime/secrets", { mode: 0o700 });
  const values = {};
  const write = (name, value, mode = 0o644) =>
    writeFileSync(`.runtime/secrets/${name}`, value, { mode, flag: "wx" });
  for (const name of plan.secrets.filter(
    (name) =>
      !plan.generatedSecrets.includes(name) &&
      !name.endsWith(".toml") &&
      !name.endsWith(".env") &&
      !name.endsWith(".json"),
  )) {
    values[name] = randomBytes(32).toString("hex");
    write(name, values[name]);
  }
  if (plan.objects.length)
    write(
      "garage.toml",
      `metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "[::]:3901"
rpc_public_addr = "local-objects:3901"
rpc_secret = "${values["garage-rpc"]}"
[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"
[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.garage.localhost"
index = "index.html"
`,
      0o600,
    );
  for (const identity of plan.identity) {
    write(
      `${identity.id}.env`,
      `KC_DB_PASSWORD=${values[identity.secret]}\nKC_BOOTSTRAP_ADMIN_USERNAME=admin\nKC_BOOTSTRAP_ADMIN_PASSWORD=${values[identity.admin]}\n`,
    );
    const origin = `http://127.0.0.1:${process.env.LOCAL_HTTP_PORT}`;
    write(
      `${identity.id}.realm.json`,
      JSON.stringify({
        realm: identity.id,
        enabled: true,
        registrationAllowed: false,
        roles: { realm: identity.roles.map((name) => ({ name })) },
        sslRequired: "none",
        clients: [
          {
            clientId: `${identity.id}-web`,
            publicClient: true,
            standardFlowEnabled: true,
            directAccessGrantsEnabled: false,
            redirectUris: [`${origin}/`],
            webOrigins: [origin],
            protocolMappers: [
              {
                name: "browser-audience",
                protocol: "openid-connect",
                protocolMapper: "oidc-audience-mapper",
                config: {
                  "included.client.audience": `${identity.id}-web`,
                  "id.token.claim": "false",
                  "access.token.claim": "true",
                },
              },
            ],
            attributes: {
              "pkce.code.challenge.method": "S256",
              "post.logout.redirect.uris": `${origin}/`,
            },
          },
        ],
      }),
    );
  }
}

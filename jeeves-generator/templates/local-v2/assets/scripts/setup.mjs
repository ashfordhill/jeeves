import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { plan } from "./common.mjs";

const workloadContract = () =>
  JSON.stringify(plan.identity.map((i) => ({ id: i.id, workloads: i.workloads ?? [] })));
/** Realm import is first-run only. Restart must never pretend import updates an existing realm. */
export function verifyWorkloadSetup() {
  if (!plan.identity.some((i) => i.workloads?.length)) return;
  const path = ".runtime/workload-contract.json";
  if (!existsSync(path) || readFileSync(path, "utf8") !== workloadContract())
    throw new Error(
      "Workload issuer setup changed or is missing. Existing Keycloak realms are not updated by --import-realm. Use a fresh disposable local runtime, or perform a reviewed external issuer/client migration and record its exact workload contract before restart.",
    );
}

/** Called only after local.mjs has checked exact-project Docker state and free ports. */
export function setup() {
  if (existsSync(".runtime"))
    throw new Error("Existing .runtime must be retained; setup is single-use.");
  mkdirSync(".runtime", { mode: 0o700 });
  mkdirSync(".runtime/secrets", { mode: 0o700 });
  writeFileSync(".runtime/workload-contract.json", workloadContract(), { mode: 0o600, flag: "wx" });
  chmodSync(".runtime/workload-contract.json", 0o600);
  const values = {};
  const write = (name, value, mode = 0o644) => {
    const path = `.runtime/secrets/${name}`;
    writeFileSync(path, value, { mode, flag: "wx" });
    // The host's umask masks `mode`; containers run as `node`, so set it exactly.
    chmodSync(path, mode);
  };
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
[admin]
api_bind_addr = "[::]:3903"
metrics_require_token = true
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
        accessTokenLifespan: 300,
        registrationAllowed: false,
        roles: { realm: identity.roles.map((name) => ({ name })) },
        sslRequired: "none",
        clients: [
          ...(identity.workloads ?? []).map((workload) => ({
            clientId: workload.client,
            publicClient: false,
            secret: values[workload.secret],
            serviceAccountsEnabled: true,
            standardFlowEnabled: false,
            implicitFlowEnabled: false,
            directAccessGrantsEnabled: false,
            fullScopeAllowed: false,
            protocolMappers: [
              {
                name: "workload-process",
                protocol: "openid-connect",
                protocolMapper: "oidc-hardcoded-claim-mapper",
                config: {
                  "claim.name": "jeeves_workload",
                  "claim.value": workload.process,
                  "jsonType.label": "String",
                  "id.token.claim": "false",
                  "access.token.claim": "true",
                },
              },
              ...workload.audiences.map((audience) => ({
                name: `audience-${audience}`,
                protocol: "openid-connect",
                protocolMapper: "oidc-audience-mapper",
                config: {
                  "included.custom.audience": audience,
                  "id.token.claim": "false",
                  "access.token.claim": "true",
                },
              })),
            ],
          })),
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

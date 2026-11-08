import { readdirSync, readFileSync } from "node:fs";
import type {
  ExperimentalTemplate,
  MappingTarget,
  SettingDecision,
  TemplateFile,
} from "../../src/assemble.ts";
import type { ValidatedInput } from "../../src/input.ts";
import { canonicalJson, pointerPart, sha256 } from "../../src/json.ts";
import { type TemplateId, templateIds } from "../../src/profile.ts";

const assetsUrl = new URL("./assets/", import.meta.url);
function readAssets(directory: URL, prefix = ""): [string, string][] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const name = `${prefix}${entry.name}`;
      return entry.isDirectory()
        ? readAssets(new URL(`${entry.name}/`, directory), `${name}/`)
        : [
            [
              name.replace(/\.template$/u, ""),
              readFileSync(new URL(entry.name, directory), "utf8"),
            ],
          ];
    });
}
const assets = new Map(readAssets(assetsUrl));
const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
// Includes ALL rendering code and exact embedded assets/lockfile, not a hand-maintained digest.
const fingerprint = sha256(jsonFile({ source, assets: [...assets] }));
const version = "0.1.0-experimental.1";
function jsonFile(value: unknown) {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}
const file = (
  path: string,
  content: string,
  sourcePaths: string[] = [],
  extension = false,
): TemplateFile => ({
  path,
  content,
  sourcePaths,
  ownership: extension ? "generated-extension" : "generated-scaffold",
});
function asset(path: string, sourcePaths: string[] = []) {
  const content = assets.get(path);
  if (content === undefined) throw new Error(`Missing versioned template asset ${path}`);
  return file(path, content, sourcePaths);
}
const settingsOf = (input: ValidatedInput, target: MappingTarget) =>
  (target.kind === "element"
    ? input.bindings.elements.find((item) => item.elementId === target.id)
    : input.bindings.components.find((item) => item.componentId === target.id)
  )?.requiredSettings ?? {};
function leafPaths(value: unknown, path: string): string[] {
  return value && typeof value === "object" && Object.keys(value).length
    ? Object.entries(value).flatMap(([key, child]) =>
        leafPaths(child, `${path}/${pointerPart(key)}`),
      )
    : [path];
}
function configDecisions(
  input: ValidatedInput,
  target: MappingTarget,
  outputPaths: string[],
): SettingDecision[] {
  return leafPaths(settingsOf(input, target), `${target.sourcePath}/settings`)
    .filter(
      (path) => !input.bindings.explicitUnsupportedIntent.some((item) => item.sourcePath === path),
    )
    .map((sourcePath) => {
      const key = sourcePath.split("/").at(-1);
      const custom =
        [
          "requestTimeoutMs",
          "concurrencyLimit",
          "pattern",
          "stampede",
          "l2TtlSeconds",
          "batchSize",
          "lingerMs",
          "ttlSeconds",
        ].includes(key ?? "") || target.templateId === "explicit-custom-extension";
      const emitted =
        (target.templateId === "typescript.pg-client-config" &&
          ["poolSize", "statementTimeoutMs", "readRouting"].includes(key ?? "")) ||
        (target.templateId === "typescript.amqp-consumer-config" &&
          ["concurrency", "retryLimit"].includes(key ?? ""));
      return {
        artifact: "design.json",
        sourcePath,
        status: custom ? "custom" : emitted ? "emitted" : "configuration-only",
        outputPaths,
        note: custom
          ? "Declared requirement retained; application policy is not implemented. See emitted extension/config and G01–G08."
          : emitted
            ? "Selected client passes this value to its transport helper: primary PostgreSQL pool/statement timeout or bounded per-consumer AMQP concurrency/retries. It requires application integration; no scenario coverage is granted."
            : "Exact declaration retained in the selected output; configuration bytes do not attest runtime enforcement or functional coverage.",
      };
    });
}
function image(input: ValidatedInput, prefix: string) {
  const images = input.runtimePins.images as { image: string; pinnedReference: string }[];
  const selected = images.find((item) => item.image.startsWith(prefix));
  if (!selected) throw new Error(`Missing frozen image ${prefix}`);
  return selected.pinnedReference;
}
function compose(input: ValidatedInput) {
  const services: Record<string, unknown> = {};
  const secrets: Record<string, { file: string }> = {};
  for (const name of [
    "postgres_admin",
    "metadata_owner",
    "metadata_reader",
    "counts_owner",
    "counts_reader",
    "identity_password",
    "cache_password",
    "broker_password",
    "upload_s3",
    "transcoder_s3",
    "garage.toml",
    "identity.env",
    "realm.json",
  ])
    secrets[name] = { file: `.runtime/secrets/${name}` };
  const secretMounts = (...names: string[]) => names;
  const health = (command: string[]) => ({
    test: command,
    interval: "5s",
    timeout: "5s",
    retries: 30,
    start_period: "20s",
  });
  services.postgres = {
    image: image(input, "postgres:"),
    environment: {
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD_FILE: "/run/secrets/postgres_admin",
    },
    secrets: secretMounts(
      "postgres_admin",
      "metadata_owner",
      "metadata_reader",
      "counts_owner",
      "counts_reader",
      "identity_password",
    ),
    volumes: [
      "postgres-data:/var/lib/postgresql/data",
      "./infra/postgres/init.sh:/docker-entrypoint-initdb.d/10-init.sh:ro",
    ],
    healthcheck: health(["CMD-SHELL", "pg_isready -U postgres -d postgres"]),
  };
  services.cache = {
    image: image(input, "valkey/"),
    secrets: ["cache_password"],
    command: [
      "sh",
      "-ec",
      'exec valkey-server --requirepass "$$(cat /run/secrets/cache_password)" --maxmemory 128mb --maxmemory-policy allkeys-lru --appendonly yes',
    ],
    volumes: ["cache-data:/data"],
    healthcheck: health([
      "CMD-SHELL",
      'REDISCLI_AUTH="$$(cat /run/secrets/cache_password)" valkey-cli ping | grep -q PONG',
    ]),
  };
  services.broker = {
    image: image(input, "rabbitmq:"),
    secrets: ["broker_password"],
    environment: { RABBITMQ_DEFAULT_USER: "youtube" },
    entrypoint: [
      "sh",
      "-ec",
      'export RABBITMQ_DEFAULT_PASS="$$(cat /run/secrets/broker_password)"; exec docker-entrypoint.sh rabbitmq-server',
    ],
    volumes: ["broker-data:/var/lib/rabbitmq"],
    healthcheck: health(["CMD", "rabbitmq-diagnostics", "-q", "ping"]),
  };
  services.objects = {
    image: image(input, "dxflrs/"),
    secrets: [{ source: "garage.toml", target: "/etc/garage.toml" }],
    volumes: ["objects-data:/var/lib/garage"],
    ports: ["127.0.0.1:4402:3900"],
    healthcheck: health(["CMD", "/garage", "status"]),
  };
  services["search-index"] = {
    image: image(input, "opensearchproject/"),
    environment: {
      "discovery.type": "single-node",
      DISABLE_SECURITY_PLUGIN: "true",
      DISABLE_INSTALL_DEMO_CONFIG: "true",
      OPENSEARCH_JAVA_OPTS: "-Xms512m -Xmx512m",
    },
    ulimits: { memlock: { soft: -1, hard: -1 } },
    volumes: ["search-data:/usr/share/opensearch/data"],
    healthcheck: health([
      "CMD-SHELL",
      "curl -fsS http://localhost:9200/_cluster/health?wait_for_status=yellow >/dev/null",
    ]),
  };
  services.identity = {
    image: image(input, "quay.io/"),
    command: ["start-dev", "--import-realm"],
    environment: {
      KC_DB: "postgres",
      KC_DB_URL: "jdbc:postgresql://postgres:5432/identity",
      KC_DB_USERNAME: "identity_owner",
      KC_HOSTNAME: "http://127.0.0.1:4401",
      KC_HTTP_ENABLED: "true",
      KC_HEALTH_ENABLED: "true",
    },
    env_file: [".runtime/secrets/identity.env"],
    volumes: ["./.runtime/secrets/realm.json:/opt/keycloak/data/import/realm.json:ro"],
    ports: ["127.0.0.1:4401:8080"],
    depends_on: { postgres: { condition: "service_healthy" } },
    healthcheck: health([
      "CMD-SHELL",
      "bash -ec 'exec 3<>/dev/tcp/127.0.0.1/9000; printf \"GET /health/ready HTTP/1.0\\r\\n\\r\\n\" >&3; cat <&3 | grep -q UP'",
    ]),
  };
  const base = {
    build: { context: ".", target: "app" },
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Docker Compose interpolation.
    image: "${COMPOSE_PROJECT_NAME:-youtube-v1}-app",
    init: true,
  };
  services["broker-init"] = {
    ...base,
    profiles: ["setup"],
    command: ["node", "scripts/broker-init.mjs"],
    secrets: ["broker_password"],
    depends_on: { broker: { condition: "service_healthy" } },
  };
  services["search-init"] = {
    ...base,
    profiles: ["setup"],
    command: ["node", "scripts/search-init.mjs"],
    depends_on: { "search-index": { condition: "service_healthy" } },
  };
  services["storage-config"] = {
    ...base,
    profiles: ["setup"],
    command: ["node", "scripts/storage-config.mjs"],
    secrets: [{ source: "upload_s3", target: "s3_credentials" }],
  };
  for (const element of input.bindings.elements.filter(
    (item) => item.runtime === "node" || item.runtime === "node+ffmpeg",
  )) {
    const id = element.elementId;
    const worker = element.requiredSettings.kind === "worker";
    const mounts: (string | { source: string; target: string })[] = [];
    if (
      [
        "watch",
        "view-counter",
        "completion-handler",
        "search-indexer",
        "upload",
        "transcoder",
      ].includes(id)
    )
      mounts.push("broker_password");
    if (id === "watch") mounts.push("metadata_reader", "counts_reader", "cache_password");
    if (id === "view-counter") mounts.push("counts_owner");
    if (id === "completion-handler") mounts.push("metadata_owner");
    if (id === "upload" || id === "transcoder")
      mounts.push({ source: `${id}_s3`, target: "s3_credentials" });
    services[id] = {
      ...base,
      ...(id === "transcoder"
        ? {
            build: { context: ".", target: "transcoder" },
            // biome-ignore lint/suspicious/noTemplateCurlyInString: Docker Compose interpolation.
            image: "${COMPOSE_PROJECT_NAME:-youtube-v1}-transcoder",
          }
        : {}),
      command: ["node", `dist/${worker ? "workers" : "services"}/${id}.js`],
      environment: {
        PUBLIC_S3_ENDPOINT: "http://127.0.0.1:4402",
        OIDC_ISSUER: "http://127.0.0.1:4401/realms/youtube-v1",
      },
      secrets: mounts,
      depends_on: worker ? { broker: { condition: "service_healthy" } } : {},
      healthcheck: worker
        ? health(["CMD", "node", "-e", "require('node:fs').accessSync('/tmp/shell-ready')"])
        : health([
            "CMD",
            "node",
            "-e",
            "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
          ]),
    };
  }
  services.edge = {
    image: image(input, "nginx:"),
    ports: ["127.0.0.1:4400:8080"],
    volumes: [
      "./infra/edge/nginx.conf:/etc/nginx/nginx.conf:ro",
      "./public:/usr/share/nginx/html:ro",
      "edge-cache:/var/cache/nginx",
    ],
    healthcheck: health(["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]),
  };
  return {
    services,
    secrets,
    volumes: Object.fromEntries(
      [
        "postgres-data",
        "cache-data",
        "broker-data",
        "objects-data",
        "search-data",
        "edge-cache",
      ].map((name) => [name, {}]),
    ),
  };
}
function project(input: ValidatedInput) {
  const sourcePaths = [...input.bindings.elements, ...input.bindings.components].map(
    (item) => item.sourcePath,
  );
  const families = [
    "infra/postgres/",
    "infra/edge/",
    "src/lib/postgres.ts",
    "src/lib/cache.ts",
    "src/lib/amqp.ts",
    "src/lib/jwt.ts",
    "src/lib/objects.ts",
    "src/lib/search.ts",
  ];
  const files = [...assets.keys()]
    .filter((path) => !families.some((prefix) => path.startsWith(prefix)))
    .map((path) => asset(path, sourcePaths));
  const packagePins = input.runtimePins.repositoryNpmPins as Record<string, string>;
  const newPins = input.runtimePins.newNpmPins as { name: string; version: string }[];
  const dependencies = {
    ...Object.fromEntries(["fastify", "pg", "zod"].map((name) => [name, packagePins[name]])),
    ...Object.fromEntries(newPins.map((item) => [item.name, item.version])),
  };
  files.push(
    file(
      "package.json",
      jsonFile({
        name: "youtube-local-v1",
        private: true,
        version: "0.0.0-experimental.1",
        type: "module",
        packageManager: "pnpm@12.16.1",
        engines: { node: "24.21.0" },
        scripts: { build: "tsc -p tsconfig.json", setup: "node scripts/setup.mjs" },
        dependencies,
        devDependencies: Object.fromEntries(
          ["typescript", "@types/node", "@types/pg"].map((name) => [name, packagePins[name]]),
        ),
      }),
      sourcePaths,
    ),
  );
  files.push(
    file(
      "tsconfig.json",
      jsonFile({
        compilerOptions: {
          target: "ES2023",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          skipLibCheck: true,
          outDir: "dist",
          rootDir: "src",
          rewriteRelativeImportExtensions: true,
          noUncheckedIndexedAccess: true,
        },
        include: ["src/**/*.ts"],
      }),
      sourcePaths,
    ),
  );
  files.push(file("compose.yaml", jsonFile(compose(input)), sourcePaths));
  files.push(file("config/local.json", jsonFile(input.bindings.localConfig), sourcePaths));
  files.push(file("config/connections.json", jsonFile(input.bindings.connections), sourcePaths));
  const overridden = new Set(
    input.bindings.explicitUnsupportedIntent.map((item) => item.sourcePath),
  );
  const settings: SettingDecision[] = leafPaths(input.bindings.localConfig, "/localConfig").map(
    (sourcePath) => ({
      artifact: "local-bindings.json",
      sourcePath,
      status: "configuration-only",
      outputPaths: ["config/local.json", "compose.yaml", "scripts/setup.mjs"],
      note: "Frozen local policy emitted with the selected infrastructure wiring. Generated configuration is not proof of browser/business/runtime correctness; G01–G08 remain open.",
    }),
  );
  input.design.connections.forEach((connection, index) => {
    for (const path of leafPaths(connection.planned, `/connections/${index}/planned`))
      if (!overridden.has(path))
        settings.push({
          artifact: "design.json",
          sourcePath: path,
          status: "configuration-only",
          outputPaths: ["config/connections.json"],
          note: "Exact connection intent and explicit local access mapping retained; original protocol/security overrides remain unsupported and business semantics remain custom.",
        });
  });
  const studio = input.design.architecture?.studio;
  studio?.connections.forEach((connection, index) => {
    if (Object.keys(connection.settings).length)
      for (const path of leafPaths(
        connection.settings,
        `/architecture/studio/connections/${index}/settings`,
      ))
        if (!overridden.has(path))
          settings.push({
            artifact: "design.json",
            sourcePath: path,
            status: "custom",
            note: "Connection policy requires application integration; topology wiring alone does not enforce this setting.",
          });
  });
  return { files, settings };
}
function family(id: TemplateId, input: ValidatedInput, targets: readonly MappingTarget[]) {
  const files: TemplateFile[] = [],
    settings: SettingDecision[] = [];
  for (const target of targets) {
    const values = settingsOf(input, target),
      sourcePaths = [target.sourcePath];
    const configPath = `config/${target.kind}s/${target.id}.json`;
    files.push(
      file(
        configPath,
        jsonFile({ id: target.id, sourcePath: target.sourcePath, declared: values }),
        sourcePaths,
      ),
    );
    const paths = [configPath];
    const add = (path: string, content: string, extension = false) => {
      files.push(file(path, content, sourcePaths, extension));
      paths.push(path);
    };
    if (["typescript.http-shell", "typescript.signed-multipart-shell"].includes(id))
      add(
        `src/services/${target.id}.ts`,
        `import { httpShell } from "../lib/http.ts";\nawait httpShell(${JSON.stringify(target.id)}, ${jsonFile({ requestTimeoutMs: values.requestTimeoutMs, concurrencyLimit: values.concurrencyLimit }).trim()});\n`,
      );
    if (["typescript.worker-shell", "typescript.ffmpeg-worker-shell"].includes(id)) {
      const consumer = input.bindings.components.find(
        (item) =>
          item.hostId === target.id &&
          item.proposedTemplateId === "typescript.amqp-consumer-config",
      );
      if (!consumer) throw new Error(`Missing explicit consumer ${target.id}`);
      const queue = target.id === "transcoder" ? "upload-jobs" : target.id;
      add(
        `src/workers/${target.id}.ts`,
        `import { workerShell } from "../lib/worker.ts";\nawait workerShell(${JSON.stringify(target.id)},${JSON.stringify(queue)},${consumer.requiredSettings.concurrency},${consumer.requiredSettings.retryLimit});\n`,
      );
    }
    if (id === "explicit-custom-extension")
      add(
        `src/extensions/${target.id}.ts`,
        `import { Unimplemented } from "../lib/env.ts";\nexport async function handle(_input: unknown): Promise<never> { throw new Unimplemented(${JSON.stringify(target.id)}); }\n`,
        true,
      );
    if (id === "typescript.pg-client-config") {
      const link = input.bindings.components
        .find((item) => item.componentId === target.id)
        ?.links.find((link) => (link as { to?: { kind?: string } }).to?.kind === "element") as {
        to: { id: string };
      };
      const database = link.to.id === "metadata-db" ? "metadata" : "counts";
      const role = target.id.startsWith("watch-") ? `${database}_reader` : `${database}_owner`;
      add(
        `src/clients/${target.id}.ts`,
        `import { postgres } from "../lib/postgres.ts";\nexport const connect = () => postgres(${JSON.stringify(database)},${JSON.stringify(role)},${JSON.stringify(role)},${jsonFile({ poolSize: values.poolSize, statementTimeoutMs: values.statementTimeoutMs }).trim()});\n`,
      );
    }
    if (id === "typescript.cache-client-config")
      add(
        `src/clients/${target.id}.ts`,
        `export { cache as connect } from "../lib/cache.ts";\n// Cache-aside, TTL and single-flight remain custom; see ${configPath}.\n`,
      );
    if (id === "typescript.jwt-guard-config")
      add(`src/clients/${target.id}.ts`, 'export { creatorToken } from "../lib/jwt.ts";\n');
    if (id === "typescript.amqp-publisher-config") {
      const endpoint = input.bindings.components
        .find((item) => item.componentId === target.id)
        ?.links.find((link) => (link as { to?: { kind?: string } }).to?.kind === "element") as {
        to: { id: string };
      };
      add(
        `src/clients/${target.id}.ts`,
        `import { publisher } from "../lib/amqp.ts";\nexport const connect = () => publisher(${JSON.stringify(endpoint.to.id === "upload-queue" ? "" : endpoint.to.id)},${JSON.stringify(endpoint.to.id === "upload-queue" ? "upload-jobs" : "")});\n// Immediate confirms only; no batch/linger/outbox or atomic DB+publish.\n`,
      );
    }
    if (id === "typescript.amqp-consumer-config")
      add(
        `src/clients/${target.id}.ts`,
        `import { consume } from "../lib/amqp.ts";\nexport const connect = (handle: (body: Buffer) => Promise<void>) => consume(${JSON.stringify(target.id === "transcoder-consumer" ? "upload-jobs" : input.bindings.components.find((item) => item.componentId === target.id)?.hostId)},${values.concurrency},${values.retryLimit},handle);\n// No batching; callbacks acknowledge only after successful handling.\n`,
      );
    if (["local.amqp-fanout", "local.amqp-work-queue"].includes(id))
      add(
        `infra/broker/${target.id}.json`,
        jsonFile({
          exchange: id === "local.amqp-fanout" ? target.id : null,
          queues:
            target.id === "upload-queue"
              ? ["upload-jobs"]
              : input.bindings.connections
                  .filter((item) => item.fromId === target.id)
                  .map((item) => item.toId),
        }),
      );
    if (id === "local.s3-bucket")
      add(
        `infra/objects/${target.id}.json`,
        jsonFile({
          bucket:
            target.id === "originals"
              ? input.bindings.localConfig.originalsBucket
              : input.bindings.localConfig.transcodedBucket,
          access: values.access,
          website: target.id === "transcoded",
          endpoint: input.bindings.localConfig.internalS3Endpoint,
        }),
      );
    if (id === "local.opensearch")
      add(
        "infra/search/index.json",
        jsonFile({ index: "videos", settings: { number_of_shards: 1, number_of_replicas: 0 } }),
      );
    if (id === "local.oidc")
      add(
        "infra/identity/realm.json",
        jsonFile({
          realm: "youtube-v1",
          enabled: true,
          sslRequired: "none",
          registrationAllowed: false,
          roles: { realm: [{ name: "creator" }] },
          clients: [
            {
              clientId: "youtube-v1-web",
              publicClient: true,
              standardFlowEnabled: true,
              directAccessGrantsEnabled: false,
              redirectUris: ["http://127.0.0.1:4400/*"],
              webOrigins: ["http://127.0.0.1:4400"],
              attributes: { "pkce.code.challenge.method": "S256" },
              protocolMappers: [
                {
                  name: "api-audience",
                  protocol: "openid-connect",
                  protocolMapper: "oidc-audience-mapper",
                  config: {
                    "included.custom.audience": "youtube-v1-api",
                    "access.token.claim": "true",
                    "id.token.claim": "false",
                  },
                },
              ],
            },
          ],
        }),
      );
    settings.push(...configDecisions(input, target, paths));
  }
  const helper: Partial<Record<TemplateId, string>> = {
    "typescript.pg-client-config": "src/lib/postgres.ts",
    "typescript.cache-client-config": "src/lib/cache.ts",
    "typescript.amqp-publisher-config": "src/lib/amqp.ts",
    "typescript.jwt-guard-config": "src/lib/jwt.ts",
    "local.edge-proxy": "infra/edge/nginx.conf",
    "local.postgresql": "infra/postgres/init.sh",
    "local.s3-bucket": "src/lib/objects.ts",
    "local.opensearch": "src/lib/search.ts",
  };
  const path = helper[id];
  if (path && targets.length)
    files.push(
      asset(
        path,
        targets.map((item) => item.sourcePath),
      ),
    );
  return { files, settings };
}
/** Explicit trusted production registry. Assembly's empty default remains useful for diagnostics. */
export const localV1Templates: readonly ExperimentalTemplate[] = Object.freeze(
  templateIds.map(
    (id): ExperimentalTemplate => ({
      id,
      version,
      sourceSha256: sha256(`${id}\n${fingerprint}`),
      render: ({ input, targets }) =>
        id === "local.project" ? project(input) : family(id, input, targets),
    }),
  ),
);

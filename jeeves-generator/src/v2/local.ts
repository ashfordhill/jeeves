import { generationCapabilities, generationLocalIdentity, generationRuntime } from "@jeeves/spec";
import { jsonFile, pointerPart, refuse } from "../json.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import {
  type V2Emitter,
  type V2Gap,
  type V2RenderContext,
  type V2TemplateFile,
  v2Compare,
} from "./registry.ts";

type Resource = {
  id: string;
  kind: string;
  sql: string;
  public: boolean;
  mode?: string;
  users: {
    host: string;
    access?: string;
    boundary?: string;
    channel?: string;
    authorized: boolean;
  }[];
};
type Database = {
  resource: string;
  database: string;
  owner: string;
  secret: string;
  migrations: string[];
};
const composeVariable = (name: string) => `\${${name}:?Set ${name}}`;
const assets = "jeeves-generator/templates/local-v2/assets/";
const sqlName = (name: string) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name))
    refuse(
      "LOCAL_IDENTITY_LIMIT",
      name,
      "Composed PostgreSQL identifiers must fit 63 bytes exactly.",
    );
  return name;
};
const providerName = (name: string, min = 1, max = 255) => {
  if (name.length < min || name.length > max || !/^[a-z][a-z0-9.-]*$/.test(name))
    refuse("LOCAL_IDENTITY_LIMIT", name, `Provider identity must fit ${min}..${max} characters.`);
  return name;
};
const sort = <T extends { id: string }>(rows: T[]) => rows.sort((a, b) => v2Compare(a.id, b.id));

/** Project owner composes specific local contributions. Contributors never write shared files. */
export function createLocalFoundation(
  sourcePaths: readonly string[],
  features: readonly V2Emitter[],
): V2Emitter {
  return {
    id: "local.foundation",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "Standalone exact local project, selected providers and least-privilege setup; no domain features.",
    sourcePaths,
    provides: {
      runtime: {
        ref: generationRuntime.ref,
        outputPaths: [
          "compose.yaml",
          "scripts/local.mjs",
          "scripts/migrate.mjs",
          "src/runtime/local.ts",
        ],
      },
    },
    render: (context) => renderFoundation(context, features),
  };
}

function renderFoundation(context: V2RenderContext, features: readonly V2Emitter[]) {
  const { model } = context;
  const gaps: V2Gap[] = [];
  const resourceMap = new Map<string, Resource>();
  const identityIds = new Set<string>();
  const sourcePaths = ["/generation"];
  const provenance = (paths: readonly (readonly (string | number)[])[]) => {
    for (const parts of paths) {
      const path = `/${parts.map((part) => pointerPart(String(part))).join("/")}`;
      if (!sourcePaths.includes(path)) sourcePaths.push(path);
    }
  };
  const contributions = features.flatMap((feature) => {
    const value = feature.local?.(context);
    if (!value) return [];
    if (!value.sourcePaths.length)
      refuse("INVALID_LOCAL_CONTRIBUTION", feature.id, "Name selected source declarations.");
    return [{ emitter: feature.id, value }];
  });
  const contributors = contributions.map(({ emitter, value }) => ({
    emitter,
    sourcePaths: value.sourcePaths,
  }));
  const file = (
    path: string,
    content: string | Uint8Array,
    participating: readonly string[] = [],
  ): V2TemplateFile => ({
    path,
    content,
    ownership: "generated-scaffold",
    sourcePaths,
    ...(participating.length
      ? { contributors: contributors.filter((c) => participating.includes(c.emitter)) }
      : {}),
  });
  for (const selection of model.selections) {
    provenance([
      selection.sourcePath,
      ...(selection.roleSourcePath ? [selection.roleSourcePath] : []),
    ]);
    if (selection.identity) provenance(selection.identity.sourcePaths);
    if (selection.identity)
      identityIds.add(generationLocalIdentity(selection.identity.element).local);
    for (const binding of selection.resources) {
      const requirement = generationCapabilities[selection.binding.kind].resources.find(
        (r) => r.field === binding.field,
      );
      if (!requirement) continue;
      const valid =
        selection.inputs[`${binding.field}.provider`] === "self-hosted" &&
        (requirement.kind !== "database" ||
          selection.inputs[`${binding.field}.engine`] === "postgresql") &&
        (requirement.kind !== "search" ||
          selection.inputs[`${binding.field}.engine`] === "opensearch") &&
        (requirement.kind !== "cache" ||
          selection.inputs[`${binding.field}.engine`] === "redis-compatible") &&
        (requirement.kind !== "queue" ||
          selection.inputs[`${binding.field}.mode`] === requirement.mode) &&
        (requirement.kind !== "object-store" ||
          ["public", "private"].includes(String(selection.inputs[`${binding.field}.access`])));
      if (!valid) {
        gaps.push({
          id: `provider-${selection.id}-${binding.field}`,
          required: true,
          status: "unsupported",
          description:
            "Provider is omitted because its selected local provider settings are missing or unsupported.",
          sourcePaths: [`/${binding.sourcePath.join("/")}`],
        });
        continue;
      }
      provenance([binding.sourcePath, ...binding.permissionPaths]);
      for (const setting of context.settings.filter(
        (setting) =>
          setting.selection === selection.id &&
          ["provider", "engine", "access", "mode", "readReplicas", "topology", "eviction"].some(
            (name) => setting.input === `${binding.field}.${name}`,
          ),
      ))
        provenance(setting.sourcePaths);
      const id = providerName(
        binding.identity.local,
        requirement.kind === "object-store" ? 3 : 1,
        requirement.kind === "object-store" ? 63 : 255,
      );
      const existing = resourceMap.get(id);
      if (existing && (existing.kind !== requirement.kind || existing.mode !== requirement.mode))
        refuse(
          "LOCAL_RESOURCE_CONFLICT",
          id,
          "Selected bindings disagree on provider resource kind/mode.",
        );
      const resource = existing ?? {
        id,
        kind: requirement.kind,
        sql: binding.identity.sql,
        public: false,
        ...(requirement.mode && { mode: requirement.mode }),
        users: [],
      };
      resource.public ||= selection.inputs[`${binding.field}.access`] === "public";
      const user = {
        host: selection.host,
        authorized:
          !binding.access ||
          !!(
            binding.authority &&
            binding.permissionPaths.length === 3 &&
            (binding.declaredAccess === "read-write" ||
              binding.declaredAccess === binding.access) &&
            (selection.owner === binding.authority ||
              (binding.access === "read" && binding.boundary === "published-read"))
          ),
        ...(binding.access && { access: binding.access }),
        ...(binding.boundary && { boundary: binding.boundary }),
        ...(binding.channel && { channel: binding.channel }),
      };
      const prior = resource.users.find((u) => u.host === user.host && u.channel === user.channel);
      if (prior) {
        if (prior.boundary !== user.boundary)
          refuse("LOCAL_RESOURCE_CONFLICT", id, "Host/resource publication boundaries disagree.");
        if (prior.access && user.access && prior.access !== user.access)
          prior.access = "read-write";
        prior.authorized &&= user.authorized;
      } else resource.users.push(user);
      resourceMap.set(id, resource);
    }
  }
  const resources = sort([...resourceMap.values()]);
  const byKind = (kind: string) => resources.filter((r) => r.kind === kind);
  const required = (id: string, kind?: string) => {
    const resource = resourceMap.get(id);
    if (!resource || (kind && resource.kind !== kind))
      refuse(
        "INVALID_LOCAL_CONTRIBUTION",
        id,
        "Contribution requires an actual selected local resource of the matching kind.",
      );
    return resource;
  };
  const user = (resource: Resource, host: string, channel?: string) => {
    const binding = resource.users.find(
      (u) => u.host === host && (!channel || u.channel === channel),
    );
    if (!binding?.authorized)
      refuse("INVALID_LOCAL_CONTRIBUTION", host, "Host must have a normalized resource binding.");
    return binding;
  };
  const pins = JSON.parse(
    new TextDecoder().decode(context.asset(`${assets}providers.json`)),
  ) as Record<string, string>;
  const files: V2TemplateFile[] = [];
  const services: Record<string, Record<string, unknown>> = {};
  const volumes: Record<string, object> = {};
  const secrets: Record<string, { file: string }> = {};
  const secretNames = new Set<string>();
  const secret = (name: string) => {
    secretNames.add(name);
    secrets[name] = { file: `.runtime/secrets/${name}` };
    return name;
  };
  const health = (test: string[], start = "20s") => ({
    test,
    interval: "5s",
    timeout: "5s",
    retries: 30,
    start_period: start,
  });
  const volume = (name: string, path: string) => {
    volumes[name] = {};
    return `${name}:${path}`;
  };
  const setupSecrets: string[] = [];
  const databases: Database[] = [];
  const identityRoles = contributions.flatMap(({ value }) => value.identityRoles ?? []);
  for (const declaration of identityRoles) {
    if (
      !identityIds.has(declaration.element) ||
      identityRoles.filter((row) => row.element === declaration.element).length !== 1 ||
      declaration.roles.length > 32 ||
      new Set(declaration.roles).size !== declaration.roles.length
    )
      refuse(
        "INVALID_LOCAL_CONTRIBUTION",
        declaration.element,
        "Declare one bounded role vocabulary for an actually selected identity.",
      );
    for (const role of declaration.roles) generationLocalIdentity(role);
  }
  const identity = [...identityIds].sort().map((id) => ({
    id,
    service: `identity-${id}`,
    database: sqlName(`i_${generationLocalIdentity(id).sql}`),
    owner: sqlName(`io_${generationLocalIdentity(id).sql}`),
    user: sqlName(`ik_${generationLocalIdentity(id).sql}`),
    ownerSecret: `identity-owner-${id}`,
    secret: `identity-${id}`,
    admin: `identity-admin-${id}`,
    roles: [...(identityRoles.find((row) => row.element === id)?.roles ?? [])],
  }));
  for (const r of byKind("database"))
    databases.push({
      resource: r.id,
      database: sqlName(`d_${r.sql}`),
      owner: sqlName(`o_${r.sql}`),
      secret: `owner-${r.id}`,
      migrations: [`infra/postgres/${r.id}/000-foundation.sql`],
    });
  for (const i of identity)
    databases.push({
      resource: i.id,
      database: i.database,
      owner: i.owner,
      secret: i.ownerSecret,
      migrations: [`infra/postgres/${i.id}/000-foundation.sql`],
    });
  if (databases.length) {
    secret("postgres-admin");
    setupSecrets.push("postgres-admin");
    for (const db of databases) {
      secret(db.secret);
      setupSecrets.push(db.secret);
      files.push(
        file(
          db.migrations[0] ?? "",
          `-- Private schema foundation; feature modules contribute domain migrations.\nREVOKE ALL ON SCHEMA public FROM PUBLIC;\n`,
        ),
      );
    }
    services["local-postgres"] = {
      image: pins.postgres,
      environment: {
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD_FILE: "/run/secrets/postgres-admin",
      },
      secrets: ["postgres-admin"],
      volumes: [volume("postgres-data", "/var/lib/postgresql/data")],
      healthcheck: health(["CMD-SHELL", "pg_isready -U postgres -d postgres"]),
    };
  }
  const logins: {
    resource: string;
    host: string;
    database: string;
    user: string;
    secret: string;
  }[] = [];
  const views: { resource: string; schema?: string; name: string; selectSql: string }[] = [];
  const grants: NonNullable<V2LocalContribution["grants"]>[number][] = [];
  const broker: { resource: string; exchange?: string; queues: string[] }[] = [];
  for (const r of byKind("queue")) {
    broker.push({
      resource: r.id,
      ...(r.mode === "topic" && { exchange: providerName(r.id) }),
      queues: r.mode === "work-queue" ? [providerName(r.id)] : [],
    });
  }
  const storage: {
    resource: string;
    host: string;
    secret: string;
    read: boolean;
    write: boolean;
    corsPut: boolean;
  }[] = [];
  const search: {
    resource: string;
    version: number;
    properties: Record<string, { type: string; index?: boolean }>;
  }[] = [];
  // Gather declarations before grants so cross-module references do not depend on emitter order.
  const combined: V2LocalContribution = {
    sourcePaths,
    logins: contributions.flatMap(({ value }) => value.logins ?? []),
    migrations: contributions.flatMap(({ value }) => value.migrations ?? []),
    views: contributions.flatMap(({ value }) => value.views ?? []),
    grants: contributions.flatMap(({ value }) => value.grants ?? []),
    broker: contributions.flatMap(({ value }) => value.broker ?? []),
    storage: contributions.flatMap(({ value }) => value.storage ?? []),
    search: contributions.flatMap(({ value }) => value.search ?? []),
  };
  for (const value of [combined]) {
    for (const login of value.logins ?? []) {
      const r = required(login.resource, "database"),
        access = user(r, login.host);
      if (!access.access)
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          login.host,
          "SQL login needs explicit normalized access.",
        );
      if (logins.some((l) => l.resource === r.id && l.host === login.host)) continue;
      const db = databases.find((d) => d.resource === r.id);
      if (!db) throw new Error("Missing selected database");
      const name = sqlName(`r_${r.sql}__${generationLocalIdentity(login.host).sql}`);
      const credential = secret(`sql-${r.id}--${login.host}`);
      setupSecrets.push(credential);
      logins.push({
        resource: r.id,
        host: login.host,
        database: db.database,
        user: name,
        secret: credential,
      });
    }
    for (const migration of value.migrations ?? []) {
      required(migration.resource, "database");
      if (!/^\d{3,6}-[a-z][a-z0-9-]*\.sql$/.test(migration.id) || migration.id.startsWith("000-"))
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          migration.id,
          "Use a unique ordered feature migration identity after 000.",
        );
      const db = databases.find((d) => d.resource === migration.resource);
      const path = `infra/postgres/${migration.resource}/${migration.id}`;
      if (!db || db.migrations.includes(path))
        refuse("INVALID_LOCAL_CONTRIBUTION", path, "Migration identities must be unique.");
      db.migrations.push(path);
      files.push(
        file(
          path,
          migration.sql,
          contributions
            .filter((c) => c.value.migrations?.includes(migration))
            .map((c) => c.emitter),
        ),
      );
    }
    for (const view of value.views ?? []) {
      required(view.resource, "database");
      sqlName(view.name);
      sqlName(view.schema ?? "public");
      if (
        views.some(
          (v) =>
            v.resource === view.resource &&
            v.name === view.name &&
            (v.schema ?? "public") === (view.schema ?? "public"),
        )
      )
        refuse("INVALID_LOCAL_CONTRIBUTION", view.name, "View identities must be unique.");
      views.push({ ...view });
    }
    for (const grant of value.grants ?? []) {
      const access = user(required(grant.resource, "database"), grant.host);
      sqlName(grant.relation);
      sqlName(grant.schema ?? "public");
      if (!logins.some((l) => l.resource === grant.resource && l.host === grant.host))
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          grant.host,
          "Declare the exact runtime login before its relation grants.",
        );
      if (
        !grant.privileges.length ||
        new Set(grant.privileges).size !== grant.privileges.length ||
        grant.privileges.some((p) => !["SELECT", "INSERT", "UPDATE", "DELETE"].includes(p))
      )
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          grant.relation,
          "Use finite explicit relation privileges.",
        );
      if (
        (access.access === "read" && grant.privileges.some((p) => p !== "SELECT")) ||
        (access.access === "write" && grant.privileges.includes("SELECT")) ||
        (access.boundary === "published-read" && grant.kind !== "view")
      )
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          grant.relation,
          "Relation grant exceeds normalized access/published boundary.",
        );
      if (
        grant.kind === "view" &&
        !views.some(
          (v) =>
            v.resource === grant.resource &&
            v.name === grant.relation &&
            (v.schema ?? "public") === (grant.schema ?? "public"),
        )
      )
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          grant.relation,
          "Published view must be explicitly contributed.",
        );
      grants.push(grant);
    }
    for (const binding of value.broker ?? []) {
      const r = required(binding.resource, "queue"),
        access = user(r, binding.host, "consume");
      if (access.channel !== "consume")
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          binding.host,
          "Subscriber requires a normalized consume channel.",
        );
      const topology = broker.find((b) => b.resource === r.id);
      if (topology?.exchange) {
        const queue = providerName(`${r.id}--${binding.host}`, 1, 248);
        if (!topology.queues.includes(queue)) topology.queues.push(queue);
        topology.queues.sort();
      }
    }
    for (const binding of value.storage ?? []) {
      const r = required(binding.resource, "object-store"),
        access = user(r, binding.host);
      if (binding.corsPut && access.access === "read")
        refuse("INVALID_LOCAL_CONTRIBUTION", binding.host, "PUT CORS requires write access.");
      if (storage.some((s) => s.resource === r.id && s.host === binding.host))
        refuse("INVALID_LOCAL_CONTRIBUTION", binding.host, "Storage bindings must be unique.");
      storage.push({
        resource: r.id,
        host: binding.host,
        secret: `s3-${binding.host}`,
        read: access.access !== "write",
        write: access.access !== "read",
        corsPut: binding.corsPut ?? false,
      });
    }
    for (const mapping of value.search ?? []) {
      required(mapping.resource, "search");
      if (
        !Number.isSafeInteger(mapping.version) ||
        mapping.version < 1 ||
        search.some((s) => s.resource === mapping.resource)
      )
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          mapping.resource,
          "Use one explicit versioned search mapping per selected index.",
        );
      search.push({ ...mapping });
    }
  }
  for (const db of databases) db.migrations.sort();
  if (broker.length) {
    secret("broker-password");
    services["local-broker"] = {
      image: pins.broker,
      environment: { RABBITMQ_DEFAULT_USER: "runtime" },
      entrypoint: [
        "sh",
        "-ec",
        'export RABBITMQ_DEFAULT_PASS="$$(cat /run/secrets/broker-password)"; exec docker-entrypoint.sh rabbitmq-server',
      ],
      secrets: ["broker-password"],
      volumes: [volume("broker-data", "/var/lib/rabbitmq")],
      healthcheck: health(["CMD", "rabbitmq-diagnostics", "-q", "ping"]),
    };
  }
  const objects = byKind("object-store").map((r) => ({ id: r.id, public: r.public }));
  if (objects.length) {
    secret("garage.toml");
    secret("garage-rpc");
    services["local-objects"] = {
      image: pins.objects,
      secrets: [{ source: "garage.toml", target: "/etc/garage.toml" }],
      volumes: [volume("objects-data", "/var/lib/garage")],
      ports: [`127.0.0.1:${composeVariable("LOCAL_OBJECT_PORT")}:3900`],
      healthcheck: health(["CMD", "/garage", "status"]),
    };
  }
  for (const r of byKind("cache")) {
    const name = secret(`cache-${r.id}`);
    services[`cache-${r.id}`] = {
      image: pins.cache,
      command: [
        "sh",
        "-ec",
        `exec valkey-server --requirepass "$$(cat /run/secrets/${name})" --maxmemory 128mb --maxmemory-policy allkeys-lru --appendonly yes`,
      ],
      secrets: [name],
      volumes: [volume(`cache-${r.id}`, "/data")],
      healthcheck: health([
        "CMD-SHELL",
        `REDISCLI_AUTH="$$(cat /run/secrets/${name})" valkey-cli ping | grep -q PONG`,
      ]),
    };
  }
  for (const r of byKind("search"))
    services[`search-${r.id}`] = {
      image: pins["search-index"],
      environment: {
        "discovery.type": "single-node",
        DISABLE_INSTALL_DEMO_CONFIG: "true",
        DISABLE_SECURITY_PLUGIN: "true",
        OPENSEARCH_JAVA_OPTS: "-Xms512m -Xmx512m",
      },
      ulimits: { memlock: { soft: -1, hard: -1 } },
      volumes: [volume(`search-${r.id}`, "/usr/share/opensearch/data")],
      healthcheck: health([
        "CMD-SHELL",
        "curl -fsS http://localhost:9200/_cluster/health?wait_for_status=yellow >/dev/null",
      ]),
    };
  if (identity.length > 1)
    refuse(
      "LOCAL_IDENTITY_LIMIT",
      "/generation",
      "The fixed local identity port slot supports one selected identity authority.",
    );
  for (const i of identity) {
    secret(i.secret);
    setupSecrets.push(i.secret);
    secret(i.admin);
    secret(`${i.id}.env`);
    secret(`${i.id}.realm.json`);
    services[i.service] = {
      image: pins.identity,
      command: ["start-dev", "--import-realm"],
      depends_on: { "local-postgres": { condition: "service_healthy" } },
      env_file: [`.runtime/secrets/${i.id}.env`],
      environment: {
        KC_DB: "postgres",
        KC_DB_URL: `jdbc:postgresql://local-postgres:5432/${i.database}`,
        KC_DB_USERNAME: i.user,
        KC_HEALTH_ENABLED: "true",
        KC_HTTP_ENABLED: "true",
        KC_HOSTNAME: `http://127.0.0.1:${composeVariable("LOCAL_IDENTITY_PORT")}`,
      },
      ports: [`127.0.0.1:${composeVariable("LOCAL_IDENTITY_PORT")}:8080`],
      volumes: [`./.runtime/secrets/${i.id}.realm.json:/opt/keycloak/data/import/realm.json:ro`],
      healthcheck: health([
        "CMD-SHELL",
        "bash -ec 'exec 3<>/dev/tcp/127.0.0.1/9000; printf \"GET /health/ready HTTP/1.0\\r\\n\\r\\n\" >&3; cat <&3 | grep -q UP'",
      ]),
    };
  }
  const app = (script: string, credentials: string[] = []) => ({
    image: `${composeVariable("COMPOSE_PROJECT_NAME")}-app`,
    build: { context: ".", target: "app" },
    init: true,
    profiles: ["setup"],
    command: ["node", `scripts/${script}.mjs`],
    environment: { LOCAL_HTTP_PORT: composeVariable("LOCAL_HTTP_PORT") },
    ...(credentials.length && { secrets: credentials }),
  });
  if (databases.length) services["setup-migrate"] = app("migrate", [...new Set(setupSecrets)]);
  if (broker.length) services["setup-broker"] = app("broker-init", ["broker-password"]);
  if (search.length) services["setup-search"] = app("search-init");
  if (storage.some((s) => s.corsPut))
    services["setup-storage"] = app("storage-config", [...new Set(storage.map((s) => s.secret))]);
  const providerFor = (id: string) => {
    const r = required(id);
    return r.kind === "database"
      ? "local-postgres"
      : r.kind === "queue"
        ? "local-broker"
        : r.kind === "object-store"
          ? "local-objects"
          : `${r.kind}-${id}`;
  };
  const application: string[] = [];
  const edges = contributions.flatMap(({ value }) =>
    value.youtubeEdge ? [value.youtubeEdge] : [],
  );
  if (edges.length > 1)
    refuse("INVALID_LOCAL_CONTRIBUTION", "/generation", "One finite browser edge is supported.");
  const edge = edges[0];
  const publicHttp = (host: string) =>
    model.selections.some((s) => s.host === host && s.inputs["host.exposure"] === "public");
  let httpHost: string | undefined;
  for (const { value } of contributions)
    for (const service of value.services ?? []) {
      generationLocalIdentity(service.host);
      if (!model.selections.some((s) => s.host === service.host) || !service.command.length)
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          service.host,
          "Runnable service must implement a selected host with an explicit command.",
        );
      const name = `app-${service.host}`;
      if (services[name])
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          service.host,
          "Exactly one runtime writer per selected host.",
        );
      const credentials: string[] = [];
      for (const id of service.sql ?? []) {
        const login = logins.find((l) => l.resource === id && l.host === service.host);
        if (!login)
          refuse(
            "INVALID_LOCAL_CONTRIBUTION",
            id,
            "Service needs a contributed exact runtime SQL login.",
          );
        credentials.push(login.secret);
      }
      for (const id of service.storage ?? []) {
        const binding = storage.find((s) => s.resource === id && s.host === service.host);
        if (!binding)
          refuse("INVALID_LOCAL_CONTRIBUTION", id, "Service needs a contributed storage key.");
        secret(binding.secret);
        credentials.push(binding.secret);
      }
      for (const id of service.cache ?? []) {
        user(required(id, "cache"), service.host);
        credentials.push(`cache-${id}`);
      }
      if (service.broker) {
        if (
          !resources.some((r) => r.kind === "queue" && r.users.some((u) => u.host === service.host))
        )
          refuse(
            "INVALID_LOCAL_CONTRIBUTION",
            service.host,
            "Service needs a selected queue channel.",
          );
        credentials.push("broker-password");
      }
      const identityBinding = service.identity
        ? identity.find(
            (i) =>
              i.id === service.identity &&
              model.selections.some((s) => s.host === service.host && s.identity?.element === i.id),
          )
        : undefined;
      if (service.identity && !identityBinding)
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          service.host,
          "Service identity must match its normalized verified principal binding.",
        );
      if (service.http) {
        if (httpHost && !edge)
          refuse(
            "LOCAL_IDENTITY_LIMIT",
            service.host,
            "One HTTP port slot; compose a later explicit edge for multiple APIs.",
          );
        httpHost = service.host;
      }
      services[name] = {
        ...app("status"),
        profiles: ["application"],
        command: [...service.command],
        ...(service.target === "media" && {
          image: `${composeVariable("COMPOSE_PROJECT_NAME")}-media`,
          build: { context: ".", target: "media" },
        }),
        secrets: [...new Set(credentials)],
        environment: {
          ...service.environment,
          ...(identityBinding && {
            OIDC_ISSUER: `http://127.0.0.1:${composeVariable("LOCAL_IDENTITY_PORT")}/realms/${identityBinding.id}`,
            OIDC_JWKS_URL: `http://${identityBinding.service}:8080/realms/${identityBinding.id}/protocol/openid-connect/certs`,
          }),
        },
        ...(service.readiness && {
          stop_grace_period: service.target === "media" ? "21m" : "6m",
          healthcheck: health([
            "CMD",
            "node",
            "-e",
            "process.exit(require('node:fs').existsSync('/tmp/application-ready')?0:1)",
          ]),
        }),
        depends_on: {
          ...(identityBinding && { [identityBinding.service]: { condition: "service_healthy" } }),
          ...Object.fromEntries(
            service.dependsOn.map((id) => {
              user(required(id), service.host);
              return [providerFor(id), { condition: "service_healthy" }];
            }),
          ),
        },
        ...(service.http &&
          !edge &&
          publicHttp(service.host) && {
            ports: [`127.0.0.1:${composeVariable("LOCAL_HTTP_PORT")}:3000`],
          }),
      };
      application.push(name);
    }
  if (edge) {
    const apis = [edge.upload, edge.watch, edge.search];
    if (new Set(apis).size !== 3 || apis.some((host) => !services[`app-${host}`]))
      refuse(
        "INVALID_LOCAL_CONTRIBUTION",
        "/generation",
        "Edge requires three actual distinct API services.",
      );
    const output = required(edge.outputs, "object-store");
    if (!output.public)
      refuse(
        "INVALID_LOCAL_CONTRIBUTION",
        edge.outputs,
        "Media edge requires selected public outputs.",
      );
    services["app-edge"] = {
      image: pins.nginx,
      profiles: ["application"],
      ports: [`127.0.0.1:${composeVariable("LOCAL_HTTP_PORT")}:8080`],
      volumes: [
        "./infra/edge/nginx.conf:/etc/nginx/nginx.conf:ro",
        "./public:/usr/share/nginx/html:ro",
      ],
      depends_on: Object.fromEntries(
        apis.map((host) => [`app-${host}`, { condition: "service_healthy" }]),
      ),
      healthcheck: health([
        "CMD",
        "wget",
        "-q",
        "-O",
        "/dev/null",
        "http://127.0.0.1:8080/healthz",
      ]),
    };
    application.push("app-edge");
    files.push(
      file(
        "infra/edge/nginx.conf",
        `events {}\nhttp {\n include /etc/nginx/mime.types;\n server {\n listen 8080;\n root /usr/share/nginx/html;\n location = /healthz { return 200 'ready'; }\n${publicHttp(edge.upload) ? ` location /api/upload/ { proxy_pass http://app-${edge.upload}:3000/; }` : " location /api/upload/ { return 404; }"}\n${publicHttp(edge.watch) ? ` location /api/watch/ { proxy_pass http://app-${edge.watch}:3000/; }` : " location /api/watch/ { return 404; }"}\n${publicHttp(edge.search) ? ` location /api/search/ { proxy_pass http://app-${edge.search}:3000/; }` : " location /api/search/ { return 404; }"}\n location /media/ { proxy_pass http://local-objects:3902/; proxy_set_header Host ${edge.outputs}.web.garage.localhost; add_header Cache-Control 'public, max-age=31536000, immutable'; }\n location / { try_files $uri $uri/ /index.html; }\n }\n}\n`,
        contributions.filter((c) => c.value.youtubeEdge).map((c) => c.emitter),
      ),
    );
    files.push(
      file(
        "public/index.html",
        "<!doctype html><meta charset=utf-8><title>Generated video backend</title><p>Video backend is running. Connect the existing browser through /api/upload/, /api/watch/ and /api/search/.</p>\n",
      ),
    );
  }
  const providerServices = Object.keys(services)
    .filter((name) => !name.startsWith("setup-") && !name.startsWith("app-"))
    .sort();
  const plan = {
    version: 1,
    resources,
    databases,
    logins,
    providerLogins: identity.map((i) => ({
      resource: i.id,
      database: i.database,
      user: i.user,
      secret: i.secret,
      provider: "identity",
    })),
    views,
    grants,
    broker,
    storage,
    objects,
    search,
    identity,
    providers: providerServices,
    application: application.sort(),
    secrets: [...secretNames].sort(),
    generatedSecrets: [...new Set(storage.map((s) => s.secret))].sort(),
  };
  for (const name of plan.generatedSecrets) secret(name);
  files.push(
    file(
      "infra/local.json",
      jsonFile(plan),
      contributions
        .filter((c) =>
          Object.entries(c.value).some(
            ([key, value]) =>
              key !== "sourcePaths" && (Array.isArray(value) ? value.length : !!value),
          ),
        )
        .map((c) => c.emitter),
    ),
    file(
      "src/features/local-bindings.ts",
      `// Foundation-owned exact contributed runtime logins.\nexport const localLogins: {resource:string;host:string;database:string;user:string;secret:string}[] = ${jsonFile(logins).trim()};\n`,
      contributors.map((c) => c.emitter),
    ),
    file(
      "compose.yaml",
      jsonFile({
        name: composeVariable("COMPOSE_PROJECT_NAME"),
        services,
        ...(Object.keys(volumes).length && { volumes }),
        ...(Object.keys(secrets).length && { secrets }),
      }),
      contributions
        .filter(
          (c) =>
            c.value.services?.length ||
            c.value.logins?.length ||
            c.value.storage?.length ||
            c.value.search?.length,
        )
        .map((c) => c.emitter),
    ),
  );
  for (const path of [
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    ".gitignore",
    ".dockerignore",
    "Dockerfile",
    "ffmpeg-os.lock",
    "src/runtime/local.ts",
    "scripts/status.mjs",
    "scripts/setup.mjs",
    "scripts/local.mjs",
    "scripts/migrate.mjs",
    "scripts/broker-init.mjs",
    "scripts/bootstrap.mjs",
    "scripts/storage-config.mjs",
    "scripts/search-init.mjs",
    "scripts/common.mjs",
  ])
    files.push(file(path, context.asset(`${assets}${path}`)));
  const missingHosts = [...new Set(model.selections.map((s) => s.host))].filter(
    (host) => !application.includes(`app-${host}`),
  );
  if (missingHosts.length)
    gaps.push({
      id: "application-services",
      status: "unfinished",
      required: true,
      description: `No runnable feature/application hooks are contributed for selected hosts: ${missingHosts.join(", ")}. Providers alone are not a working app.`,
      sourcePaths,
    });
  if (byKind("search").some((r) => !search.some((s) => s.resource === r.id)))
    gaps.push({
      id: "search-mappings",
      status: "unfinished",
      required: true,
      description:
        "Selected search providers have no contributed versioned feature mapping/query implementation.",
      sourcePaths,
    });
  files.push(
    file(
      "README.md",
      `# Generated local v2 foundation\n\nExperimental provider/project foundation. Inspect .jeeves/report.json for missing features and hooks. No application readiness or strict certification is claimed.\n\nNode 24.21.0 and pnpm 12.16.1. Run \`pnpm install --frozen-lockfile --ignore-scripts\` then \`pnpm build\`. Set a unique \`COMPOSE_PROJECT_NAME\` and three distinct free loopback ports: \`LOCAL_HTTP_PORT\`, \`LOCAL_IDENTITY_PORT\`, \`LOCAL_OBJECT_PORT\`. Run \`pnpm first-run\` once, \`pnpm stop\` to stop all profiles and \`pnpm start\` for normal restart. Reuse those exact values and private .runtime with the original Docker volumes. No resets or credential rotation occur. An interrupted single-use storage bootstrap requires manual inspection.\n\nMigration owners/admin are mounted only into setup. Runtime logins receive no implicit table access; features contribute explicit relation/view grants. PostgreSQL names are quoted and provider/composed-name limits refuse rather than truncate. Storage originals remain private; local public websites are a declared local-security limitation.\n\nCleanup only an owned disposable export: \`docker compose --profile '*' down --volumes --remove-orphans\` with its recorded project/ports, then remove its .runtime. Never run cleanup against a retained runtime.\n`,
    ),
  );
  return { files, gaps };
}

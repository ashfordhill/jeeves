import { generationCapabilities, generationLocalIdentity, generationRuntime } from "@jeeves/spec";
import { jsonFile, pointerPart, refuse } from "../json.ts";
import {
  endpointId,
  localEndpoints,
  localPubsub,
  pubsubSubscriptions,
  type StubStore,
  stubStores,
  stubUnsupported,
  subscriberQueues,
  type V2LocalContribution,
} from "./local-contract.ts";
import { stubProperties } from "./module-stubs.ts";
import {
  type V2Delivery,
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
  /** Runnable processes only: each writer module's SQL file and schema (v3 contract, §1). */
  modules?: { module: string; host: string; schema: string; file: string }[];
  productSql?: {
    version: 1;
    file: string;
    namespaces: { schema: string; role: string }[];
    bindings: { host: string; module: string; access: string }[];
  };
  productState?: V2RenderContext["model"]["productState"][number];
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
/** A Pub/Sub topic or subscription name (QG07): 3–255 characters, starting with a letter and
 * never with `goog`; a tile ID's slug and `--`, `.failed` keep to the rest of the rule. */
const pubsubName = (name: string) => {
  if (name.length < 3 || name.length > 255 || !/^[a-z]/.test(name) || name.startsWith("goog"))
    refuse(
      "LOCAL_IDENTITY_LIMIT",
      name,
      "A Pub/Sub topic or subscription name must be 3–255 characters, start with a letter and not start with goog.",
    );
  return name;
};
const sort = <T extends { id: string }>(rows: T[]) => rows.sort((a, b) => v2Compare(a.id, b.id));
/** With Runnable processes on, `first-run` and `start` gate on `report.processes.runnable`
 * instead of `applicationComplete` (tile process contract, section 2). */
const processGate = [
  [
    '!JSON.parse(readFileSync(".jeeves/report.json", "utf8")).applicationComplete\n',
    '!JSON.parse(readFileSync(".jeeves/report.json", "utf8")).processes?.runnable\n',
  ],
  [
    '"Required source/application bindings remain incomplete; inspect .jeeves/report.json before startup."',
    '"Runnable processes are not runnable yet; inspect processes in .jeeves/report.json before startup."',
  ],
] as const;
function gateOnProcesses(bytes: Uint8Array) {
  return substituteOnce(bytes, "scripts/local.mjs", processGate, "The startup gate");
}
/** With Runnable processes on, `migrate.mjs` runs the product step (v3 contract, section 1):
 * `scripts/products.mjs` after the template views, and its grants after the template grants. */
const productStep = [
  [
    'import { hash, plan, quote, secret } from "./common.mjs";\n',
    'import { hash, plan, quote, secret } from "./common.mjs";\nimport { applyProductSql, grantProductSql } from "./products.mjs";\n',
  ],
  [
    "      for (const login of runtime) {\n        // Keycloak owns",
    "      // Product migrations: ordered checksums under a restricted namespace role.\n      await applyProductSql(owner, db, quote);\n      for (const login of runtime) {\n        // Keycloak owns",
  ],
  [
    '      await owner.query("COMMIT");\n',
    '      await grantProductSql(owner, db, runtime, quote);\n      await owner.query("COMMIT");\n',
  ],
  [
    "  for (const db of plan.databases) {\n    const existing",
    `  for (const db of plan.databases) {
    for (const namespace of db.productSql?.namespaces ?? []) {
      if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [namespace.role])).rowCount)
        await admin.query(\`CREATE ROLE \${quote(namespace.role)} NOLOGIN NOINHERIT\`);
      await admin.query(\`GRANT \${quote(namespace.role)} TO \${quote(db.owner)} WITH INHERIT FALSE, SET TRUE\`);
    }
    const existing`,
  ],
  ["    ...plan.logins,\n", "    ...plan.logins,\n    ...plan.productLogins,\n"],
  ["        // Keycloak owns", "        if (login.product) continue;\n        // Keycloak owns"],
  [
    "    const runtime = [...plan.logins, ...plan.providerLogins].filter(",
    "    const runtime = [...plan.logins, ...plan.providerLogins, ...plan.productLogins].filter(",
  ],
] as const;
export function migrateWithProducts(bytes: Uint8Array) {
  return substituteOnce(bytes, "scripts/migrate.mjs", productStep, "The product step's anchor");
}
/** Replaces each anchor of an asset exactly once, and refuses an asset where one isn't. */
function substituteOnce(
  bytes: Uint8Array,
  path: string,
  pairs: readonly (readonly [string, string])[],
  what: string,
) {
  let text = new TextDecoder().decode(bytes);
  for (const [from, to] of pairs) {
    if (text.split(from).length !== 2)
      refuse("INVALID_ASSET", path, `${what} must appear exactly once.`);
    text = text.replace(from, to);
  }
  return text;
}
/** A writer module's product SQL file in its database (v3 contract, section 1). */
const productSqlPath = (database: string, schema: string) =>
  `infra/postgres/${database}/products/migrations/${schema}/0001-initial.sql`;

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
  for (const process of model.processes ?? [])
    if (process.workload) identityIds.add(process.workload.identity);
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
  // Runnable processes: every store or channel a stub links to is provisioned for the stub's tile
  // with the widest access among its links (tile process contract, section 6). A store on another
  // provider is a required unsupported gap. Nothing is written to ownership.
  const stubbed: { host: string; store: StubStore; id: string }[] = [];
  for (const process of model.processes ?? []) {
    const plan = stubStores(process, model.selections);
    gaps.push(...plan.gaps);
    for (const store of plan.stores) {
      if (store.unsupported) continue;
      for (const path of store.sourcePaths) if (!sourcePaths.includes(path)) sourcePaths.push(path);
      const identity = generationLocalIdentity(store.element);
      // A Pub/Sub topic is its own provider resource (QG07), never the broker's.
      const kind = store.pubsub ? "pubsub" : store.kind;
      const id =
        store.kind === "object-store"
          ? providerName(identity.local, 3, 63)
          : store.pubsub
            ? pubsubName(identity.local)
            : providerName(identity.local);
      const existing = resourceMap.get(id);
      if (existing && (existing.kind !== kind || existing.mode !== store.mode))
        refuse(
          "LOCAL_RESOURCE_CONFLICT",
          id,
          "A stub's store disagrees with its selected kind/mode.",
        );
      const resource = existing ?? {
        id,
        kind,
        sql: identity.sql,
        public: false,
        ...(store.mode && { mode: store.mode }),
        users: [],
      };
      resource.public ||= store.public === true;
      const queue = store.kind === "queue";
      const user: Resource["users"][number] = {
        host: process.tile,
        authorized: true,
        ...(queue ? { channel: store.access } : { access: store.access }),
        ...(store.boundary && { boundary: store.boundary }),
      };
      const prior = resource.users.find((u) => u.host === user.host && u.channel === user.channel);
      if (prior) {
        if (prior.boundary !== user.boundary)
          refuse("LOCAL_RESOURCE_CONFLICT", id, "Host/resource publication boundaries disagree.");
        if (prior.access && user.access && prior.access !== user.access)
          prior.access = "read-write";
      } else resource.users.push(user);
      resourceMap.set(id, resource);
      stubbed.push({ host: process.tile, store, id });
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
    workloads: (model.processes ?? [])
      .filter((p) => p.workload?.identity === id)
      .map((p) => ({
        process: p.tile,
        client: p.workload?.client ?? "",
        secret: `workload-${p.workload?.client}`,
        audiences: [
          ...new Set(p.serviceCalls?.map((call) => `jeeves-service-${call.target}`) ?? []),
        ].sort(),
      })),
  }));
  for (const r of byKind("database"))
    databases.push({
      resource: r.id,
      database: sqlName(`d_${r.sql}`),
      owner: sqlName(`o_${r.sql}`),
      secret: `owner-${r.id}`,
      migrations: [`infra/postgres/${r.id}/000-foundation.sql`],
      ...(model.processes && { modules: [] }),
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
  const views: {
    resource: string;
    schema?: string;
    name: string;
    selectSql: string;
  }[] = [];
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
  /** One runtime login per host and database: CONNECT and USAGE on public until grants. */
  const addLogin = (r: Resource, host: string) => {
    if (logins.some((l) => l.resource === r.id && l.host === host)) return;
    const db = databases.find((d) => d.resource === r.id);
    if (!db) throw new Error("Missing selected database");
    const name = sqlName(`r_${r.sql}__${generationLocalIdentity(host).sql}`);
    const credential = secret(`sql-${r.id}--${host}`);
    setupSecrets.push(credential);
    logins.push({
      resource: r.id,
      host,
      database: db.database,
      user: name,
      secret: credential,
    });
  };
  /** A topic's subscriber queue for a consuming host (one per consuming module when the host's
   * process has several on the topic); a work queue is consumed itself. */
  const addSubscriber = (r: Resource, host: string) => {
    const topology = broker.find((b) => b.resource === r.id);
    if (topology?.exchange) {
      for (const name of subscriberQueues(model, r.id, host)) {
        const queue = providerName(name, 1, 248);
        if (!topology.queues.includes(queue)) topology.queues.push(queue);
      }
      topology.queues.sort();
    }
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
      addLogin(r, login.host);
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
      // A stub's database login is declared by the stub rows below (QL04's idempotency grant).
      if (
        !logins.some((l) => l.resource === grant.resource && l.host === grant.host) &&
        !stubbed.some(
          (row) =>
            row.store.kind === "database" && row.id === grant.resource && row.host === grant.host,
        )
      )
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
      // Internal idempotency needs its exact full mechanism grant even for write-only product access.
      if (
        (access.access === "read" && grant.privileges.some((p) => p !== "SELECT")) ||
        (access.access === "write" &&
          grant.privileges.includes("SELECT") &&
          !(
            grant.schema === "jeeves" &&
            grant.relation === "idempotency_records" &&
            grant.kind === "table"
          )) ||
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
      addSubscriber(r, binding.host);
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
  // Stub rows, beside the templates' own (tile process contract, section 6): a runtime login per
  // database, with SELECT on what another owner publishes when it may only read; a subscriber per
  // consumed topic; a key per bucket with the link's read or write.
  for (const { host, store, id } of stubbed) {
    const r = required(id, store.pubsub ? "pubsub" : store.kind);
    const access = user(r, host, store.kind === "queue" ? store.access : undefined);
    if (store.kind === "database") {
      addLogin(r, host);
      if (access.boundary === "published-read")
        for (const view of views.filter((v) => v.resource === r.id)) {
          const schema = view.schema ?? "public";
          if (
            !grants.some(
              (g) =>
                g.resource === r.id &&
                g.host === host &&
                g.relation === view.name &&
                (g.schema ?? "public") === schema,
            )
          )
            grants.push({
              resource: r.id,
              host,
              ...(view.schema && { schema: view.schema }),
              relation: view.name,
              kind: "view",
              privileges: ["SELECT"],
            });
        }
    }
    if (store.kind === "queue" && store.access === "consume" && !store.pubsub)
      addSubscriber(r, host);
    if (
      store.kind === "object-store" &&
      !storage.some((s) => s.resource === r.id && s.host === host)
    )
      storage.push({
        resource: r.id,
        host,
        secret: `s3-${host}`,
        read: access.access !== "write",
        write: access.access !== "read",
        corsPut: false,
      });
  }
  // Pub/Sub (QG07): each topic, and for each loop stub that consumes it its own subscription
  // (QG28), which its tile's copies share, with its dead-letter topic and a pull subscription of
  // that name. setup-pubsub creates them all before any process starts: Pub/Sub keeps a message
  // only for subscriptions that exist when it is published.
  const pubsubTopics: string[] = [];
  const pubsubSubscriptionRows: Record<string, unknown>[] = [];
  for (const r of byKind("pubsub")) {
    pubsubTopics.push(r.id);
    const consumers = r.users.filter((u) => u.channel === "consume").map((u) => u.host);
    for (const host of [...new Set(consumers)].sort(v2Compare))
      for (const subscription of pubsubSubscriptions(model, r.id, host)) {
        pubsubTopics.push(pubsubName(subscription.failed));
        pubsubSubscriptionRows.push(
          {
            name: pubsubName(subscription.name),
            topic: r.id,
            ackDeadlineSeconds: 60,
            retryPolicy: { minimumBackoffSeconds: 1, maximumBackoffSeconds: 10 },
            deadLetterPolicy: { deadLetterTopic: subscription.failed, maxDeliveryAttempts: 100 },
          },
          { name: subscription.failed, topic: subscription.failed },
        );
      }
  }
  pubsubTopics.sort(v2Compare);
  pubsubSubscriptionRows.sort((a, b) => v2Compare(String(a.name), String(b.name)));
  for (const db of databases) db.migrations.sort();
  for (const state of model.processes ? model.productState : []) {
    const db = databases.find(
      (item) => item.resource === generationLocalIdentity(state.resource).local,
    );
    if (state.schema) {
      sqlName(state.schema);
      const templateSchemas = [
        "public",
        "published",
        "jeeves",
        ...views
          .filter((view) => view.resource === generationLocalIdentity(state.resource).local)
          .map((view) => view.schema ?? "public"),
        ...grants
          .filter((grant) => grant.resource === generationLocalIdentity(state.resource).local)
          .map((grant) => grant.schema ?? "public"),
      ];
      if (templateSchemas.includes(state.schema))
        refuse(
          "LOCAL_RESOURCE_CONFLICT",
          state.resource,
          `Product schema ${state.schema} conflicts with a private template namespace. Choose distinct stable identities with explicit application/data migration; display-label renames preserve SQL identities.`,
        );
    }
    if (db) db.productState = state;
  }
  const productSql = productFiles(model, databases, logins, views, grants);
  for (const row of productSql) provenance(row.sourcePaths);
  const productLogins: (Login & { product: true })[] = [];
  for (const db of databases.filter((db) => db.modules)) {
    const namespaces = [
      ...new Set([
        ...(db.modules ?? []).map((row) => row.schema),
        ...(db.productState?.schema ? [db.productState.schema] : []),
      ]),
    ].sort();
    db.productSql = {
      version: 1,
      file: `infra/postgres/${db.resource}/products.json`,
      namespaces: namespaces.map((schema) => ({
        schema,
        role: sqlName(`pm_${db.resource.replaceAll("-", "_")}_${schema}`),
      })),
      bindings: (model.processes ?? []).flatMap((process) =>
        process.stubs.flatMap((stub) => {
          const module = model.selections.find(
            (selection) => selection.id === stub.selection,
          )?.module;
          return module
            ? stubProperties(module, false).flatMap(({ connection, use }) =>
                connection.target.kind === "element" && connection.target.element === db.resource
                  ? [{ host: process.tile, module: module.component, access: use }]
                  : [],
              )
            : [];
        }),
      ),
    };
    const extensionFile = (path: string, content: string): V2TemplateFile => ({
      ...file(path, content),
      ownership: "generated-extension",
    });
    files.push(
      extensionFile(
        db.productSql.file,
        jsonFile({
          version: 1,
          namespaces: namespaces.map((schema) => ({
            schema,
            migrations: [
              {
                version: "0001",
                file: `infra/postgres/${db.resource}/products/migrations/${schema}/0001-initial.sql`,
              },
            ],
          })),
          tables: [
            ...new Set(
              db.productState?.access.flatMap((entry) =>
                entry.product.tables.map((table) => table.name),
              ) ?? [],
            ),
          ]
            .sort()
            .map((name) => ({ schema: db.productState?.schema, name })),
          views: [],
          operations: [],
        }),
      ),
    );
    for (const schema of namespaces)
      files.push(
        extensionFile(
          `infra/postgres/${db.resource}/products/migrations/${schema}/0001-initial.sql`,
          `-- Application-owned initial product migration for ${schema}.\n-- Append versions; never change an applied migration. No transaction/role controls.\n-- Create product views here; products.json publishes selected views through generated grants.\n`,
        ),
      );
    for (const kind of ["queries", "commands"])
      files.push(
        extensionFile(
          `infra/postgres/${db.resource}/products/${kind}/example.sql`,
          `-- Application-owned parameterized ${kind === "queries" ? "SELECT" : "INSERT/UPDATE/DELETE"}.\n-- Register its name, module, host, parameter count and relations in ../products.json.\n`,
        ),
      );
    for (const login of logins.filter((row) => row.resource === db.resource)) {
      const credential = secret(`product-${db.resource}--${login.host}`);
      setupSecrets.push(credential);
      productLogins.push({
        ...login,
        user: sqlName(`pr_${db.resource.replaceAll("-", "_")}__${login.host.replaceAll("-", "_")}`),
        secret: credential,
        product: true,
      });
    }
  }
  if (model.processes)
    files.push(
      file(
        "src/runtime/product-contract.ts",
        context.asset(`${assets}src/runtime/product-contract.ts`),
      ),
    );
  if (model.processes?.length)
    files.push(
      file(
        "src/runtime/product-operations.ts",
        context.asset(`${assets}src/runtime/product-operations.ts`),
      ),
    );
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
  // The Pub/Sub emulator (QG07): reached only inside the network, and its state lasts only while
  // it runs, so every start creates the topics and subscriptions again (setup-pubsub).
  if (pubsubTopics.length)
    services[localPubsub.service] = {
      image: pins.pubsub,
      command: [
        "gcloud",
        "beta",
        "emulators",
        "pubsub",
        "start",
        "--host-port=0.0.0.0:8085",
        `--project=${localPubsub.project}`,
      ],
      healthcheck: health(["CMD", "curl", "-fsS", "-o", "/dev/null", "http://127.0.0.1:8085/"]),
    };
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
    for (const workload of i.workloads) secret(workload.secret);
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
  if (databases.length) {
    // The migration's transport (QG29): plain text to the local cluster.
    const setup = app("migrate", [...new Set(setupSecrets)]);
    services["setup-migrate"] = {
      ...setup,
      environment: { ...setup.environment, JEEVES_MIGRATE_TLS: "disable" },
    };
  }
  if (broker.length) services["setup-broker"] = app("broker-init", ["broker-password"]);
  if (pubsubTopics.length) {
    const setup = app("pubsub-init");
    services["setup-pubsub"] = {
      ...setup,
      environment: {
        ...setup.environment,
        JEEVES_PUBSUB_PROJECT: localPubsub.project,
        PUBSUB_EMULATOR_HOST: localPubsub.host,
      },
    };
  }
  if (search.length) services["setup-search"] = app("search-init");
  if (storage.some((s) => s.corsPut))
    services["setup-storage"] = app("storage-config", [...new Set(storage.map((s) => s.secret))]);
  const providerFor = (id: string) => {
    const r = required(id);
    return r.kind === "database"
      ? "local-postgres"
      : r.kind === "queue"
        ? "local-broker"
        : r.kind === "pubsub"
          ? localPubsub.service
          : r.kind === "object-store"
            ? "local-objects"
            : `${r.kind}-${id}`;
  };
  const application: string[] = [];
  // The External API URLs each process reads (QG20): the application's to set, so not in Compose,
  // but in the process's list of what it reads (QG26).
  const externalReads = new Map<string, string[]>();
  let stubIssuer = false;
  const publicHttp = (host: string) =>
    model.selections.some((s) => s.host === host && s.inputs["host.exposure"] === "public");
  let httpHost: string | undefined;
  for (const { value } of contributions)
    for (const service of value.services ?? []) {
      generationLocalIdentity(service.host);
      // A process host runs with no selection of its own (an empty tile, tile process contract).
      if (
        (!model.selections.some((s) => s.host === service.host) &&
          !model.processes?.some((p) => p.tile === service.host)) ||
        !service.command.length
      )
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          service.host,
          "Runnable service must implement a selected or process host with an explicit command.",
        );
      const name = `app-${service.host}`;
      if (services[name])
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          service.host,
          "Exactly one runtime writer per selected host.",
        );
      const credentials: string[] = [];
      const workload = model.processes?.find((p) => p.tile === service.host)?.workload;
      const workloadIssuer = workload && identity.find((i) => i.id === workload.identity);
      if (workload) credentials.push(`workload-${workload.client}`);
      for (const id of service.sql ?? []) {
        const login = logins.find((l) => l.resource === id && l.host === service.host);
        if (!login)
          refuse(
            "INVALID_LOCAL_CONTRIBUTION",
            id,
            "Service needs a contributed exact runtime SQL login.",
          );
        credentials.push(login.secret);
        const product = productLogins.find(
          (row) => row.resource === id && row.host === service.host,
        );
        if (product) credentials.push(product.secret);
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
      // A Pub/Sub publisher or subscriber holds no credential: Application Default Credentials
      // (QG07, QG08).
      if (
        service.pubsub &&
        !resources.some((r) => r.kind === "pubsub" && r.users.some((u) => u.host === service.host))
      )
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          service.host,
          "Service needs a selected Pub/Sub topic it publishes to or consumes.",
        );
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
      // A stub's Identity client (QG20) reaches an Identity a sign-in binds, at its
      // `JEEVES_IDENTITY_<ID>_URL` (`localEndpoints`: Keycloak inside the network).
      const issuerBinding = service.issuer
        ? identity.find((i) => i.id === service.issuer)
        : undefined;
      if (service.issuer && !issuerBinding)
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          service.host,
          "A stub's Identity must be one a sign-in binds.",
        );
      if (issuerBinding) stubIssuer = true;
      if (service.external?.length)
        externalReads.set(
          name,
          service.external.map((id) => `JEEVES_EXTERNAL_${endpointId(id)}_URL`),
        );
      if (service.http) {
        if (httpHost)
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
        // Exactly what its process reads: its endpoints (the local ones, a stub Identity client's
        // JEEVES_IDENTITY_<ID>_URL among them) and a sign-in's OIDC_*. An External API's URL is
        // the application's to set.
        environment: {
          ...service.environment,
          ...(workloadIssuer && {
            JEEVES_WORKLOAD_ISSUER: `http://127.0.0.1:${composeVariable("LOCAL_IDENTITY_PORT")}/realms/${workloadIssuer.id}`,
            JEEVES_WORKLOAD_TOKEN_URL: `http://${workloadIssuer.service}:8080/realms/${workloadIssuer.id}/protocol/openid-connect/token`,
            JEEVES_WORKLOAD_JWKS_URL: `http://${workloadIssuer.service}:8080/realms/${workloadIssuer.id}/protocol/openid-connect/certs`,
          }),
          ...(identityBinding && {
            OIDC_ISSUER: `http://127.0.0.1:${composeVariable("LOCAL_IDENTITY_PORT")}/realms/${identityBinding.id}`,
            OIDC_AUDIENCE: `${identityBinding.id}-web`,
            OIDC_JWKS_URL: `http://${identityBinding.service}:8080/realms/${identityBinding.id}/protocol/openid-connect/certs`,
          }),
          ...localEndpoints(service),
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
          ...(workloadIssuer && { [workloadIssuer.service]: { condition: "service_healthy" } }),
          ...(identityBinding && { [identityBinding.service]: { condition: "service_healthy" } }),
          ...Object.fromEntries(
            service.dependsOn.map((id) => {
              user(required(id), service.host);
              return [providerFor(id), { condition: "service_healthy" }];
            }),
          ),
        },
        ...(service.http &&
          publicHttp(service.host) && {
            ports: [`127.0.0.1:${composeVariable("LOCAL_HTTP_PORT")}:3000`],
          }),
      };
      application.push(name);
    }
  // The public edge (tile process contract, section 2) owns the single HTTP port.
  const edge = contributions.filter(({ value }) => value.edge?.length);
  const edgeHosts = edge.flatMap(({ value }) => (value.edge ?? []).map((row) => row.host)).sort();
  // A CDN in front of one public bucket: the edge serves its objects at /cdn/<cdn>/ (V3-08).
  const delivery = deliveryRoutes(model, resourceMap);
  gaps.push(...delivery.gaps);
  for (const row of delivery.routes) provenance(row.sourcePaths);
  const cdn = delivery.routes.map(({ cdn, bucket }) => ({ cdn, bucket }));
  if (edgeHosts.length || cdn.length) {
    if (
      new Set(edgeHosts).size !== edgeHosts.length ||
      edgeHosts.some(
        (host) =>
          !application.includes(`app-${generationLocalIdentity(host).local}`) ||
          model.processes?.find((process) => process.tile === host)?.shape !== "http",
      )
    )
      refuse(
        "INVALID_LOCAL_CONTRIBUTION",
        "/generation/processes",
        "The edge routes each contributed HTTP process host once.",
      );
    if (httpHost)
      refuse("LOCAL_IDENTITY_LIMIT", httpHost, "One HTTP port slot: the edge publishes it.");
    if (services["app-edge"])
      refuse(
        "LOCAL_IDENTITY_LIMIT",
        "edge",
        "A tile with the ID edge would take the edge's service name; rename it.",
      );
    services["app-edge"] = {
      image: pins.nginx,
      profiles: ["application"],
      depends_on: Object.fromEntries([
        ...edgeHosts.map((host) => [`app-${host}`, { condition: "service_healthy" }]),
        ...(cdn.length ? [["local-objects", { condition: "service_healthy" }]] : []),
      ]),
      ports: [`127.0.0.1:${composeVariable("LOCAL_HTTP_PORT")}:8080`],
      volumes: ["./infra/edge/nginx.conf:/etc/nginx/nginx.conf:ro"],
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
        edgeConfig(edgeHosts, cdn),
        edge.map((c) => c.emitter),
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
    ...(model.processes && { productLogins }),
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
    ...(pubsubTopics.length && {
      pubsub: { topics: pubsubTopics, subscriptions: pubsubSubscriptionRows },
    }),
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
      `// Foundation-owned exact contributed runtime logins.\nexport const localLogins: {resource:string;host:string;database:string;user:string;secret:string}[] = ${jsonFile(logins).trim()};\n${model.processes?.length ? `export const productLogins: {resource:string;host:string;database:string;user:string;secret:string;product:true}[] = ${jsonFile(productLogins).trim()};\nexport const productDatabases: import("../runtime/product-contract.ts").ProductMaximum[] = ${jsonFile(databases.filter((db) => db.modules).map((db) => ({ resource: db.resource, modules: db.modules, productSql: db.productSql, ...(db.productState && { productState: { schema: db.productState.schema, access: db.productState.access.map((entry) => ({ host: entry.host, product: entry.product })) } }) }))).trim()};\n` : ""}`,
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
            c.value.edge?.length ||
            c.value.logins?.length ||
            c.value.storage?.length ||
            c.value.search?.length,
        )
        .map((c) => c.emitter),
    ),
  );
  // The package manifests are the application's own: it adds its packages with `pnpm add`, and
  // `update:v2` keeps its files, putting the template's new ones under `.jeeves/generated/`.
  // `pnpm-workspace.yaml` holds its pnpm settings: `allowBuilds` (QG09).
  const packageManifests = new Set(["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]);
  for (const path of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    ".gitignore",
    ".dockerignore",
    "Dockerfile",
    "ffmpeg-os.lock",
    "src/runtime/local.ts",
    "scripts/status.mjs",
    "scripts/check-extensions.mjs",
    "scripts/setup.mjs",
    "scripts/local.mjs",
    "scripts/migrate.mjs",
    "scripts/broker-init.mjs",
    "scripts/bootstrap.mjs",
    "scripts/storage-config.mjs",
    ...(search.length ? ["scripts/search-init.mjs"] : []),
    ...(pubsubTopics.length ? ["scripts/pubsub-init.mjs"] : []),
    ...(model.processes ? ["scripts/products.mjs"] : []),
    "scripts/common.mjs",
  ]) {
    const emitted = file(
      path,
      path === "scripts/local.mjs" && model.processes
        ? gateOnProcesses(context.asset(`${assets}${path}`))
        : path === "scripts/migrate.mjs" && model.processes
          ? migrateWithProducts(context.asset(`${assets}${path}`))
          : context.asset(`${assets}${path}`),
    );
    files.push(
      packageManifests.has(path) ? { ...emitted, ownership: "generated-extension" } : emitted,
    );
  }
  const missingHosts = [
    ...new Set([
      ...model.selections.map((s) => s.host),
      ...(model.processes ?? []).map((p) => p.tile),
    ]),
  ].filter((host) => !application.includes(`app-${host}`));
  if (missingHosts.length)
    gaps.push({
      id: "application-services",
      status: "unfinished",
      required: true,
      description: `No runnable feature/application hooks are contributed for selected hosts: ${missingHosts.join(", ")}. Providers alone are not a working app.`,
      sourcePaths,
    });
  // With Runnable processes on, an Index writer's process asserts its index from the mapping in
  // its hooks file (v3 contract, section 5), so that index needs no contributed mapping.
  const asserted = new Set(
    model.processes
      ? model.selections.flatMap((s) =>
          s.binding.kind === "search-projection"
            ? s.resources.filter((r) => r.field === "index").map((r) => r.identity.local)
            : [],
        )
      : [],
  );
  if (byKind("search").some((r) => !search.some((s) => s.resource === r.id) && !asserted.has(r.id)))
    gaps.push({
      id: "search-mappings",
      status: "unfinished",
      required: true,
      description:
        "Selected search providers have no contributed versioned feature mapping/query implementation.",
      sourcePaths,
    });
  // What each process reads from its environment: what its service sets (QG06) and its External
  // APIs' URLs (QG26).
  const processEnvironment = application
    .filter((name) => name !== "app-edge")
    .map((name) => {
      const keys = [
        ...Object.keys((services[name]?.environment ?? {}) as Record<string, string>),
        ...(externalReads.get(name) ?? []),
      ];
      return `- \`${name}\`: ${
        keys.length
          ? [...keys]
              .sort(v2Compare)
              .map((key) => `\`${key}\``)
              .join(", ")
          : "none"
      }`;
    });
  const endpointsReadme = `\n**Endpoints from the environment.** Each process with stubs checks the endpoints its clients and sign-in use in one pass before any client is built or probed, and reads each again as it builds that client, with no default: \`JEEVES_DATABASE_<ID>_HOST\` (a host, or an absolute Unix socket directory) and \`_PORT\` for each database, \`JEEVES_CACHE_<ID>_HOST\` and \`_PORT\` for each cache, \`JEEVES_BROKER_HOST\` and \`JEEVES_BROKER_PORT\` for the broker, and \`JEEVES_TILE_<ID>_URL\` (absolute \`http:\` or \`https:\`, with no credentials, query, fragment or whitespace) for each tile its stubs call, where \`<ID>\` is the tile ID upper-cased with \`-\` as \`_\`.${pubsubTopics.length ? " A process that publishes to or consumes a Pub/Sub topic reads `JEEVES_PUBSUB_PROJECT`, a Google Cloud project ID (a lowercase letter, then up to 29 lowercase letters, digits or `-`, optionally after `<domain>:`); `compose.yaml` also sets `PUBSUB_EMULATOR_HOST` for the local emulator and `METADATA_SERVER_DETECTION: none`, so the client looks for no Google metadata server; a deployment leaves both unset." : ""}${externalReads.size ? ` Each External API its stubs call is at \`JEEVES_EXTERNAL_<ID>_URL\`, by the same URL rule, which \`compose.yaml\` doesn't set: the value is yours, so set it in \`compose.override.yaml\` (and in your deployment); until it is set the process fails startup with \`Invalid endpoint JEEVES_EXTERNAL_<ID>_URL\`. A failed call to an External API keeps a loop's normal retries.` : ""}${stubIssuer ? " A process whose stubs call the Identity reads `JEEVES_IDENTITY_<ID>_URL`, the Identity's base URL as the process reaches it, by the same URL rule: `compose.yaml` sets Keycloak's address inside the network, `http://identity-<id>:8080` (a stub adds the realm's paths, `/realms/<id>/...`); a deployment sets its issuer's origin, or another address its processes reach. A sign-in's `OIDC_ISSUER` is what tokens carry, which a container can't reach locally, so it isn't the client's base. A lost connection to the Identity waits as an unreachable store's does." : ""} A missing or invalid one fails startup with \`Invalid endpoint <variable>\`, never its value (several at once: \`Invalid configuration: <message>; <message>\`). Each database and cache also reads its transport, \`JEEVES_DATABASE_<ID>_TLS\` or \`JEEVES_CACHE_<ID>_TLS\`, with no default: \`disable\` (plain text, which \`PGSSLMODE\` can't change) or \`verify-full\` (TLS that checks the certificate chain and the host name); with \`verify-full\`, \`_CA_FILE\` is an optional PEM file (else Node's roots; one that can't be read fails startup with \`Unreadable CA file <variable>\`) and \`_TLS_SERVERNAME\` the optional name the certificate carries when it isn't the host (a managed instance reached by a private address). With \`JEEVES_REQUIRE_TLS=true\` (else unset), startup fails with \`Insecure endpoint <variable>\` for a database or cache whose transport isn't \`verify-full\` (a database's Unix socket directory is local transport and passes), a \`JEEVES_TILE_<ID>_URL\`, ${externalReads.size ? "`JEEVES_EXTERNAL_<ID>_URL`, " : ""}${stubIssuer ? "`JEEVES_IDENTITY_<ID>_URL`, " : ""}\`OIDC_ISSUER\` or \`OIDC_JWKS_URL\` that isn't \`https:\`, and any \`PUBSUB_EMULATOR_HOST\`; the broker, object storage and search are plain text and aren't checked. With the switch, \`NODE_TLS_REJECT_UNAUTHORIZED\` must be unset or \`1\`, else startup fails with \`Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED\`: \`0\` would turn off certificate checks for every client that leaves them to Node. \`compose.yaml\` sets the local values (\`disable\`, and no \`JEEVES_REQUIRE_TLS\`); a deployment sets its own. Object storage and search are still reached at their local names. Each process reads (also \`processes.tiles[].environment\` in .jeeves/report.json):\n\n${processEnvironment.join("\n")}\n`;
  // Google Cloud Pub/Sub (QG07): what runs, what it promises and what a deployment provides.
  const pubsubReadme = pubsubTopics.length
    ? `\n**Google Cloud Pub/Sub.** A queue only stubs use, saved with provider Google Cloud, is a Pub/Sub topic named by the queue's ID (${byKind(
        "pubsub",
      )
        .map((r) => `\`${r.id}\``)
        .join(
          ", ",
        )}). A stub publishes through the official client (\`pubsubPublisher\` in \`src/runtime/module-clients.ts\`): \`publish\` resolves only once Pub/Sub has acknowledged the message, which carries the module's \`messageId\` (else a fresh one) as its \`messageId\` attribute; Pub/Sub gives a resent message a new ID, so a consumer deduplicates on the attribute. A publish fails after 2000 ms, and while 1000 are outstanding the next fails at once. Each publishing process checks at startup that its topic exists and fails without it; it needs \`pubsub.topics.get\` and \`pubsub.topics.publish\` on the topic, through Application Default Credentials (the export holds no key file). Processes never create or change topics or subscriptions. Locally \`local-pubsub\` runs the Pub/Sub emulator, reached only inside the network at \`local-pubsub:8085\`, and \`setup-pubsub\` (\`scripts/pubsub-init.mjs\`) creates every topic and subscription \`infra/local.json\` lists before the processes start, at \`first-run\` and every \`start\`: it creates what is missing and stops, naming it, at one that exists with other settings. Each loop stub that consumes a topic gets its own subscription, \`<topic>--<tile>--<module>\`, which its tile's copies share (every other loop stub, of this tile or another, gets its own, so each gets every message, in either mode), with a 60 s ack deadline, retries backing off from 1 s to 10 s and dead-letter topic \`<subscription>.failed\` after 100 delivery attempts, plus a pull subscription \`<subscription>.failed\` to inspect it. A loop stub on a topic consumes its own subscription through the official client (\`pubsubLoop\` in \`src/runtime/module-clients.ts\`), with a RabbitMQ loop's contract: one streaming-pull subscriber holding at most its Worker's Concurrency messages in hand, each acknowledged only after the stub resolves. Another error is nacked, and the subscription's retry policy spaces the redelivery (no 250 ms wait); a failure on delivery attempt 6, after 5 retries, ends the message in \`<subscription>.failed\` as "Not implemented" does at once: a copy with its attributes and \`x-terminal-code\`, then the message is acknowledged once Pub/Sub has the copy, else nacked. An unreachable store keeps the message and runs it again 5 s later with the same attempt. A message's attempt is Pub/Sub's delivery attempt, which every redelivery counts, a nack while draining or a lost lease too. A lost subscriber is reported once and reopened 5 s later. Each consuming process checks at startup that its subscription exists, and needs \`pubsub.subscriptions.get\` and \`pubsub.subscriptions.consume\` on it and \`pubsub.topics.publish\` on its \`.failed\` topic. The emulator keeps nothing across a restart, no topic, subscription or message: a local limit, never a durability claim. A deployment's own infrastructure creates the same topics and subscriptions, and grants the Pub/Sub service agent what a dead-letter policy needs (publish on each \`.failed\` topic, subscribe on its subscription).\n`
    : "";
  files.push(
    file(
      "README.md",
      `# Generated local v2 foundation\n\nExperimental provider/project foundation. Inspect .jeeves/report.json for missing features and hooks. No application readiness or strict certification is claimed.\n\nNode 24.21.0 and pnpm 12.16.1. Run \`pnpm install --frozen-lockfile\` then \`pnpm build\`. \`package.json\`, \`pnpm-lock.yaml\` and \`pnpm-workspace.yaml\` are yours: add a package with \`pnpm add <name>@<exact version>\`. \`pnpm-workspace.yaml\`'s \`allowBuilds\` says which packages' install scripts run: the template's dependencies run none (\`protobufjs: false\`), so neither command needs \`--ignore-scripts\`. Set a unique \`COMPOSE_PROJECT_NAME\` and three distinct free loopback ports: \`LOCAL_HTTP_PORT\`, \`LOCAL_IDENTITY_PORT\`, \`LOCAL_OBJECT_PORT\`. Run \`pnpm first-run\` once, \`pnpm stop\` to stop all profiles and \`pnpm start\` for normal restart. Reuse those exact values and private .runtime with the original Docker volumes. No resets or credential rotation occur. An interrupted single-use storage bootstrap requires manual inspection.\n\n**Your own configuration.** \`compose.override.yaml\` beside \`compose.yaml\` is yours: export never writes it and \`update:v2\` never touches it. Docker Compose merges it into every command \`pnpm first-run\`, \`start\` and \`stop\` run, so give your modules their own \`environment\` and \`secrets\` there, or add a service of your own (for example a scheduler that calls your routes). A service of your own starts with \`pnpm start\` only when a generated service \`depends_on\` it, which your override may add; otherwise start it with your own \`docker compose up\`. Don't redefine a generated service's image, command, ports or healthcheck. A change applies at the next \`pnpm start\`.\n\nMigration owners/admin are mounted only into setup. \`scripts/migrate.mjs\` reaches PostgreSQL at \`PGHOST\` and \`PGPORT\` with \`JEEVES_MIGRATE_TLS\` (\`disable\`, or \`verify-full\` with an optional \`JEEVES_MIGRATE_CA_FILE\` and \`JEEVES_MIGRATE_TLS_SERVERNAME\`), read as a database's \`_TLS\` is; \`PGSSLMODE\` can't change it, and with \`JEEVES_REQUIRE_TLS=true\` it must be \`verify-full\` unless \`PGHOST\` is a socket directory. A credential is read from \`JEEVES_SECRET_<NAME>_FILE\` when that is set (an absolute path; \`<NAME>\` is the secret's name upper-cased, with \`-\` and \`.\` as \`_\`), else from \`SECRET_DIR/<name>\` (\`/run/secrets/<name>\`, where Compose mounts it). Runtime logins receive no implicit table access; features contribute explicit relation/view grants. PostgreSQL names are quoted and provider/composed-name limits refuse rather than truncate. Storage originals remain private; local public websites are a declared local-security limitation.\n\nCleanup only an owned disposable export: \`docker compose --profile '*' down --volumes --remove-orphans\` with its recorded project/ports, then remove its .runtime. Never run cleanup against a retained runtime.\n${
        model.processes
          ? `\nRunnable processes: each application tile runs as \`app-<id>\` from \`src/processes/<id>.ts\`, healthy once its ready marker exists; HTTP processes answer readiness at \`GET /readyz\` (and \`/healthz\` for compatibility), and liveness at \`GET /livez\` on port 3000 inside the Compose network.${edgeHosts.length ? " `app-edge` publishes each public HTTP process at `http://127.0.0.1:$LOCAL_HTTP_PORT/api/<id>/` and answers `GET /healthz` itself; internal ones are reached only inside the network at `http://app-<id>:3000`." : ""} A module's routes are under \`/modules/<module id>\`: a stub or a generated hook in \`src/modules/\` answers 501 \`NOT_IMPLEMENTED\` until you write it. A consumer module or worker template runs a loop on its queue (a topic's \`<topic>--<id>\` subscriber): "Not implemented" sends the message to \`<queue>.failed\` with one log line, other errors retry within the loop's limit (a stub's 5 times, waiting 250 ms doubling up to 10 s), an unreachable store waits 5 s and keeps the attempt, a failed \`fetch\` to an outside host keeps the normal retries, and \`pnpm stop\` drains the loops. Every store or channel a stub links to is provisioned for its tile with its links' widest access (a database login with CONNECT and USAGE on public, SELECT only on named published views and declared template views; a queue, topic or subscriber; a cache; a bucket key; a search service with no index), and \`src/runtime/module-clients.ts\` gives each stub real clients, each probed once at startup. A database a stub writes also has Jeeves's own \`jeeves.idempotency_records\` (\`infra/postgres/<database>/050-jeeves-idempotency.sql\`), which only the logins of the tiles whose stubs write it use: a stub's \`idempotent(...)\` keeps a 200–299 answer per scope and key for 24 hours and replays it for the same request (\`requestHash\` in \`src/runtime/idempotency.ts\`), a different request under the key throws \`IdempotencyConflict\`, and expired records are swept every 60 s. Each stub declares the settings it reads in its file's \`settings\` export (\`declareSettings\` with \`text()\`, \`integer()\`, \`url()\`, \`signingKeys(purpose)\`, \`sealingKeys(purpose)\` and \`optional(kind)\` from \`src/extension-api/index.ts\`); its process reads them in its configuration pass, before any client is built or probed, and gives the same frozen values to the stub as \`dependencies.settings\` (rings yield purpose-bound handles, never raw keys): a missing or invalid one fails startup with \`Invalid setting <NAME>\`, never its value. \`compose.yaml\` sets none of them: set a setting in \`compose.override.yaml\`'s \`environment\`, and a signing or sealing ring as a file read as a credential is (above), \`<name>\` being the setting's name lower-cased with \`_\` as \`-\` (\`PROBE_TOKEN\` is \`probe-token\`), through its \`secrets\`; \`processes.tiles[].stubSettings\` in .jeeves/report.json names the files each process reads them from. Product SQL is application-owned: \`infra/postgres/<database>/products.json\` declares ordered migrations per namespace, tables, published views and registered parameterized queries/commands. Migrations run once under checksums and a transaction lock, as a namespace-only role; failed migrations roll back. Add versions, never edit applied SQL. Legacy \`modules/*.sql\` files are preserved but never executed. See .jeeves/extensions.md for the explicit baseline path. Product operations receive registered handles using separate product-only credentials; template tables remain protected. Only exact compiled table operations and named view audiences can be granted. \`first-run\` and \`start\` start them only while \`processes.runnable\` in .jeeves/report.json is true; its \`processes.tiles\` lists each process's routes, loops and provisioned stores. No restart policy: a failed process stays exited until \`pnpm start\`.\n${endpointsReadme}`
          : ""
      }${pubsubReadme}`,
    ),
  );
  return {
    files,
    gaps,
    ...(model.processes && {
      sql: productSql.map(({ module, database, path, schema }) => ({
        module,
        database,
        file: path,
        schema,
      })),
      ...(delivery.report.length && { delivery: delivery.report }),
    }),
  };
}

/**
 * Each CDN tile's route at the edge, with Runnable processes on (V3-08): a CDN in front of exactly
 * one public object storage that the design provisions locally is served read-only at
 * `/cdn/<cdn>/` from that bucket's local website. Any other CDN serves nothing locally and says why
 * in an optional custom gap `cdn-<cdn>`.
 */
function deliveryRoutes(model: V2RenderContext["model"], resources: ReadonlyMap<string, Resource>) {
  const routes: {
    cdn: string;
    bucket: string;
    sourcePaths: (readonly (string | number)[])[];
  }[] = [];
  const gaps: V2Gap[] = [];
  const report: V2Delivery[] = [];
  if (!model.processes) return { routes, gaps, report };
  for (const row of model.delivery ?? []) {
    const cdn = generationLocalIdentity(row.cdn).local;
    const [origin, ...others] = row.origins;
    const id = origin && generationLocalIdentity(origin.element).local;
    const why = !origin
      ? "it fronts no object storage"
      : others.length
        ? `it fronts ${row.origins.length} object storage tiles, and the edge serves one`
        : origin.objects !== "public"
          ? `${origin.name} is private`
          : stubUnsupported({ kind: "object-store", name: origin.name, provider: origin.provider })
            ? `${origin.name} isn't provisioned locally (its provider)`
            : !id || resources.get(id)?.kind !== "object-store" || !resources.get(id)?.public
              ? `no module reads or writes ${origin.name}, so it isn't provisioned`
              : undefined;
    const name = line(row.name);
    if (why || !origin || !id) {
      gaps.push({
        id: `cdn-${cdn}`,
        required: false,
        status: "custom",
        description: `${name} serves nothing locally: ${why}. The local edge serves one public object storage a CDN links to at /cdn/<cdn id>/.`,
        sourcePaths: [pointer(row.sourcePath)],
      });
      report.push({ cdn, name: row.name, answers: `nothing locally: ${why ?? "no origin"}` });
      continue;
    }
    routes.push({ cdn, bucket: id, sourcePaths: [row.sourcePath, origin.sourcePath] });
    report.push({
      cdn,
      name: row.name,
      path: `/cdn/${cdn}/`,
      bucket: id,
      answers: `GET and HEAD of the objects in ${line(origin.name)}, typed by extension; 404 for a missing key, 405 for any other method`,
    });
  }
  return { routes, gaps, report };
}

type Login = {
  resource: string;
  host: string;
  database: string;
  user: string;
  secret: string;
};
type View = {
  resource: string;
  schema?: string;
  name: string;
  selectSql: string;
};
type Grant = NonNullable<V2LocalContribution["grants"]>[number];
/** One comment line: names are the application's own text. */
const line = (text: string) => text.replace(/[\p{Cc}\u2028\u2029]/gu, " ");
const pointer = (path: readonly (string | number)[]) =>
  `/${path.map((part) => pointerPart(String(part))).join("/")}`;

/**
 * Product tables (v3 contract, section 1), with Runnable processes on: every module that writes a
 * provisioned database gets `infra/postgres/<database>/modules/<module>.sql`, a header only and
 * yours to write, run in its own schema `m_<module>`, and a row in its database's `modules`, which
 * `migrate.mjs`'s product step reads. A database whose provider isn't local has no file: its gap
 * is reported already.
 */
function productFiles(
  model: V2RenderContext["model"],
  databases: Database[],
  logins: readonly Login[],
  views: readonly View[],
  grants: readonly Grant[],
) {
  const rows: {
    module: string;
    database: string;
    path: string;
    schema: string;
    sourcePaths: (readonly (string | number)[])[];
  }[] = [];
  const processes = model.processes ?? [];
  for (const process of processes)
    for (const writer of process.writers ?? []) {
      const id = generationLocalIdentity(writer.database).local;
      const db = databases.find((item) => item.resource === id && item.modules);
      if (!db?.modules) continue;
      const module = generationLocalIdentity(writer.module);
      const schema = sqlName(db.productState?.schema ?? `m_${module.sql}`);
      const taken = [
        "public",
        "published",
        ...views.filter((v) => v.resource === id).map((v) => v.schema ?? "public"),
        ...grants.filter((g) => g.resource === id).map((g) => g.schema ?? "public"),
      ];
      if (
        taken.includes(schema) ||
        (!db.productState?.schema && db.modules.some((item) => item.schema === schema))
      )
        refuse(
          "LOCAL_RESOURCE_CONFLICT",
          writer.module,
          `Schema ${schema} is already taken in ${db.database}; choose distinct stable identities with explicit application/data migration. Display-label renames preserve SQL identities.`,
        );
      const login = logins.find((item) => item.resource === id && item.host === process.tile);
      if (!login)
        refuse(
          "INVALID_LOCAL_CONTRIBUTION",
          writer.module,
          "A module that writes a database needs its tile's runtime login there.",
        );
      const path = productSqlPath(id, schema);
      db.modules.push({ module: module.local, host: process.tile, schema, file: path });
      const selection = model.selections.find((item) => item.id === writer.selection);
      const sourcePaths = [
        ...(selection ? [selection.sourcePath] : []),
        writer.sourcePath,
        ...writer.links,
      ];
      rows.push({
        module: writer.module,
        database: writer.database,
        path,
        schema,
        sourcePaths,
      });
    }
  for (const db of databases) db.modules?.sort((a, b) => v2Compare(a.module, b.module));
  return rows;
}

/** A CDN route's content type, by its key's extension, else the object's own (V3-08). */
const cdnTypes: readonly (readonly [string, string])[] = [
  ["m3u8", "application/vnd.apple.mpegurl"],
  ["ts", "video/mp2t"],
  ["m4s", "video/iso.segment"],
  ["mp4", "video/mp4"],
  ["webm", "video/webm"],
  ["m4a", "audio/mp4"],
  ["mp3", "audio/mpeg"],
  ["aac", "audio/aac"],
  ["vtt", "text/vtt"],
  ["jpe?g", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["avif", "image/avif"],
  ["svg", "image/svg+xml"],
  ["json", "application/json"],
  ["txt", "text/plain"],
];

/** The edge's nginx configuration: `/api/<host>/` for each public HTTP process, `/cdn/<cdn>/` for
 * each CDN's public bucket (read only, from the bucket's local website), its own `/healthz`, 503
 * JSON with `Retry-After: 1` for a process that is down, and 404 for everything else. Upstreams
 * resolve per request through Docker DNS. */
function edgeConfig(
  hosts: readonly string[],
  cdn: readonly { cdn: string; bucket: string }[] = [],
) {
  const json = (value: object) => `'${JSON.stringify(value)}'`;
  return `${[
    "events {}",
    "http {",
    "  access_log off;",
    "  error_log /dev/stderr warn;",
    "  resolver 127.0.0.11 valid=10s;",
    // The edge's own answers are JSON whatever the path's extension (no built-in types).
    "  types { }",
    "  default_type application/json;",
    ...(cdn.length
      ? [
          "  map $uri $cdn_type {",
          "    default $upstream_http_content_type;",
          ...cdnTypes.map(([extension, type]) => `    ~*\\.${extension}$ ${type};`),
          "  }",
        ]
      : []),
    "  server {",
    "    listen 8080;",
    // A process that is down (stopped, or exited after losing its broker) answers JSON too.
    "    error_page 502 504 = @unavailable;",
    `    location = /healthz { return 200 ${json({ service: "edge", application: "ready" })}; }`,
    ...hosts.map(
      (host) =>
        `    location /api/${host}/ { set $backend app-${host}:3000; rewrite ^/api/${host}/(.*)$ /$1 break; proxy_pass http://$backend; }`,
    ),
    ...cdn.flatMap(({ cdn: id, bucket }) => [
      `    location /cdn/${id}/ {`,
      `      if ($request_method !~ ^(GET|HEAD)$ ) { return 405 ${json({ error: "METHOD_NOT_ALLOWED", message: "This route only reads." })}; }`,
      "      set $objects local-objects:3902;",
      `      rewrite ^/cdn/${id}/(.*)$ /$1 break;`,
      "      proxy_pass http://$objects;",
      `      proxy_set_header Host ${bucket}.web.garage.localhost;`,
      '      proxy_set_header Authorization "";',
      '      proxy_set_header Cookie "";',
      "      proxy_intercept_errors on;",
      "      error_page 403 404 = @cdn-missing;",
      "      error_page 502 504 = @unavailable;",
      "      proxy_hide_header Content-Type;",
      "      add_header Content-Type $cdn_type;",
      "      add_header X-Content-Type-Options nosniff;",
      '      add_header Content-Security-Policy "sandbox";',
      "    }",
    ]),
    ...(cdn.length
      ? [
          `    location @cdn-missing { return 404 ${json({ error: "NOT_FOUND", message: "No object for this key." })}; }`,
        ]
      : []),
    // Its 503 (for an upstream's 502 or 504) says when to retry, as the processes' own 503s do
    // (QG19, QG21); `always`, since nginx adds a header to an error status only then.
    `    location @unavailable { add_header Retry-After 1 always; return 503 ${json({ error: "UNAVAILABLE", message: "Service unavailable." })}; }`,
    `    location / { return 404 ${json({ error: "NOT_FOUND", message: "Route not found." })}; }`,
    "  }",
    "}",
  ].join("\n")}\n`;
}

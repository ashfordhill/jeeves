import {
  generationLocalIdentity,
  type NormalizedGenerationSelection,
  type NormalizedProcess,
  studioComponentTargetKind,
  studioDefinitions,
} from "@jeeves/spec";
import {
  brokerState,
  camel,
  type Import,
  line,
  type ProcessMount,
  pascal,
  service,
  text,
  tileGuard,
  tileProcess,
} from "./http-wiring.ts";
import {
  endpointId,
  localDatabase,
  localLogin,
  localPubsub,
  pubsubSubscription,
  type StubStore,
  stubStores,
} from "./local-contract.ts";
import { moduleEntryName, moduleStubPaths, stubProperties } from "./module-stubs.ts";
import { type V2ProcessReport, v2Compare } from "./registry.ts";

const clients = "../runtime/module-clients.ts";
const guardPath = "../runtime/tile-guard.ts";
const localPath = "../runtime/local.ts";
const settingsPath = "../runtime/settings.ts";
const entryTypes = "../modules/entry.ts";
/** The sections of `src/runtime/module-clients.ts` a design's processes use; the rest are left
 * out, so the scaffold imports only the libraries the export has. `broker` is the broker's
 * endpoint, for a stub's publisher and its RabbitMQ loops; `pubsub` a Pub/Sub topic's publisher
 * (QG07), which `pubsub-loop`, a stub loop's Pub/Sub subscriber (QG08), also needs. */
export type ClientSection =
  | "database"
  | "broker"
  | "queue"
  | "pubsub"
  | "pubsub-loop"
  | "cache"
  | "objects"
  | "search"
  | "http";

/** One client a process builds: its key in `clients`, its section and its constructor call; `name`
 * is the function it calls when it isn't its section's own (QG20's HTTP clients). `check` is the
 * reader the configuration pass calls for a store's client (QG31); an HTTP client's is its own
 * call, and object storage and search have none, since their endpoints are compiled. */
type Client = {
  key: string;
  section: Exclude<ClientSection, "broker" | "pubsub-loop">;
  call: string;
  name?: "externalTarget" | "identityTarget" | "productDatabaseClient" | "serviceTarget";
  check?: { name: string; call: string };
  prepare?: string;
};

/** An External API's base URL variable (QG20), `JEEVES_EXTERNAL_<ID>_URL`. */
export const externalVariable = (element: string) => `JEEVES_EXTERNAL_${endpointId(element)}_URL`;
/** An Identity's base URL variable (QG20, QGR2), `JEEVES_IDENTITY_<ID>_URL`, by its local ID (the
 * Keycloak service's and realm's): the Identity as the process reaches it, not a sign-in's
 * `OIDC_ISSUER`, which a container can't always reach. */
export const identityVariable = (local: string) => `JEEVES_IDENTITY_${endpointId(local)}_URL`;

/**
 * A stub's link to an External API or an Identity whose interface is an `HttpTarget` (QG20): an
 * External API's client at `JEEVES_EXTERNAL_<ID>_URL`, unmarked, and an Identity's at
 * `JEEVES_IDENTITY_<ID>_URL`, marked as an internal call, when a sign-in in the design binds that
 * Identity. Anything else (an Identity no sign-in binds, a link that verifies a token) is undefined.
 */
function outsideClient(
  kind: string,
  target: { element: string },
  type: string,
  selections: readonly NormalizedGenerationSelection[],
): Client | undefined {
  if (type !== "HttpTarget") return undefined;
  if (kind === "external-api")
    return {
      key: target.element,
      section: "http",
      name: "externalTarget",
      call: `externalTarget(${text(externalVariable(target.element))})`,
    };
  if (kind === "identity" && selections.some((item) => item.identity?.element === target.element))
    return {
      key: target.element,
      section: "http",
      name: "identityTarget",
      call: `identityTarget({ identity: ${text(generationLocalIdentity(target.element).local)} })`,
    };
  return undefined;
}

/**
 * The Jeeves-owned table of a stub's idempotency records (QL04, D4), on each database a stub
 * writes: the setup-only owner creates it, with no PUBLIC access, and only the logins of the tiles
 * whose stubs write that database get USAGE on `jeeves` and SELECT, INSERT, UPDATE and DELETE on
 * it (`idempotencyGrant`). A stub never creates it.
 */
export const idempotencyMigration = {
  id: "050-jeeves-idempotency.sql",
  sql: `-- Jeeves-owned: the idempotency records of the stubs that write this database (QL04).
CREATE SCHEMA IF NOT EXISTS jeeves;
REVOKE ALL ON SCHEMA jeeves FROM PUBLIC;
CREATE TABLE IF NOT EXISTS jeeves.idempotency_records (tile text NOT NULL, scope_kind text NOT NULL, scope_id text NOT NULL, idem_key text NOT NULL, request_hash bytea NOT NULL, status integer NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY (tile, scope_kind, scope_id, idem_key));
CREATE INDEX IF NOT EXISTS idempotency_records_expires ON jeeves.idempotency_records (expires_at);
`,
} as const;
/** Append-only evolution: existing records and the historical 050 migration stay intact. */
export const localOperationMigration = {
  id: "051-jeeves-local-operations.sql",
  sql: `ALTER TABLE jeeves.idempotency_records ADD COLUMN IF NOT EXISTS metadata jsonb;
`,
} as const;
/** Protected intent/lease state is separate from product namespaces and migration authority. */
export const durableWorkMigration = {
  id: "052-jeeves-durable-work.sql",
  sql: `CREATE TABLE IF NOT EXISTS jeeves.work_records (
  namespace text NOT NULL, scope_key text NOT NULL, work_key text NOT NULL, work_id uuid NOT NULL DEFAULT gen_random_uuid(),
  input jsonb NOT NULL, input_hash text NOT NULL, configuration text NOT NULL,
  remote_input jsonb, remote_ticket text, remote_protocol jsonb, remote_result jsonb, external_state text NOT NULL DEFAULT 'none' CHECK(external_state IN ('none','prepared','dispatched','done')),
  state text NOT NULL DEFAULT 'accepted' CHECK (state IN ('accepted','running','retry','unknown','completed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 20),
  retention_seconds integer NOT NULL CHECK (retention_seconds BETWEEN 60 AND 604800),
  holder text, fence bigint NOT NULL DEFAULT 0 CHECK (fence >= 0), lease_until timestamptz,
  next_attempt_at timestamptz DEFAULT clock_timestamp(), error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz, expires_at timestamptz,
  PRIMARY KEY (namespace,scope_key,work_key),
  CHECK ((state='running') = (holder IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK (state<>'completed' OR (completed_at IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS work_records_due ON jeeves.work_records(namespace,next_attempt_at,lease_until) WHERE state IN ('accepted','running','retry');
CREATE INDEX IF NOT EXISTS work_records_expiry ON jeeves.work_records(namespace,expires_at) WHERE state='completed';
REVOKE ALL ON jeeves.work_records FROM PUBLIC;
CREATE TABLE IF NOT EXISTS jeeves.work_tickets(namespace text NOT NULL,caller text NOT NULL,work_key text NOT NULL,input_hash text NOT NULL,version integer NOT NULL,ticket text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,PRIMARY KEY(namespace,caller,work_key));
CREATE INDEX IF NOT EXISTS work_tickets_expiry ON jeeves.work_tickets(expires_at);
REVOKE ALL ON jeeves.work_tickets FROM PUBLIC;
`,
} as const;
/** A writing tile's login on the idempotency records (QL04). */
export const idempotencyGrant = (resource: string, host: string) => ({
  resource,
  host,
  schema: "jeeves",
  relation: "idempotency_records",
  kind: "table" as const,
  privileges: ["SELECT" as const, "INSERT" as const, "UPDATE" as const, "DELETE" as const],
});
/** A store a stub writes that is provisioned locally: a database there gets the idempotency
 * records. */
const writesDatabase = (store: StubStore) =>
  store.kind === "database" && !store.unsupported && store.access !== "read";

/** The configuration pass's readers for the broker's endpoint and the Pub/Sub project (QG31). */
const brokerCheck = { name: "brokerBinding", call: "brokerBinding()" };
const pubsubCheck = { name: "pubsubProjectId", call: "pubsubProjectId()" };

/** What a store's client is built with, and what its probe checks. */
function storeClient(store: StubStore): Client {
  const key = store.element;
  const resource = text(store.resource);
  switch (store.kind) {
    case "database":
      return {
        key,
        section: "database",
        call: `await databaseClient(scope, probe, { tile: config.tile, resource: ${resource} })`,
        check: { name: "databaseEndpoint", call: `databaseEndpoint(${resource})` },
      };
    case "queue":
      // A queue only stubs use, saved on Google Cloud, publishes to its Pub/Sub topic (QG07).
      if (store.pubsub)
        return {
          key,
          section: "pubsub",
          call: `await pubsubPublisher(scope, probe, { topic: ${resource} })`,
          check: pubsubCheck,
        };
      return {
        key,
        section: "queue",
        call: `await queuePublisher(scope, probe, { queue: ${resource}, mode: ${text(store.mode ?? "work-queue")} }, ${brokerState(`broker publish ${store.resource}`)})`,
        check: brokerCheck,
      };
    case "cache":
      return {
        key,
        section: "cache",
        call: `await cacheClient(scope, probe, { cache: ${resource} })`,
        check: { name: "cacheClientEndpoint", call: `cacheClientEndpoint(${resource})` },
      };
    case "object-store":
      return {
        key,
        section: "objects",
        call: `await objectClient(scope, probe, { tile: config.tile, bucket: ${resource}, access: ${text(store.access)} })`,
      };
    case "search":
      return {
        key,
        section: "search",
        call: `await searchClient(scope, probe, { index: ${resource} })`,
      };
  }
}

/**
 * A process's stubs and their clients (tile process contract, sections 4 and 6): one client per
 * store or channel its stubs use, each probed once at startup, and every stub's `Dependencies`
 * built from them. A module link calls the module it names; an External API, or an Identity a
 * sign-in binds, an HTTP client at its base URL (QG20). A dependency that isn't provisioned
 * (another provider, an Identity no sign-in binds, a token check, a CDN, a tile with no process, a
 * template's part) answers "Not implemented" naming why.
 */
export function stubClients(
  process: NormalizedProcess,
  selections: readonly NormalizedGenerationSelection[],
  processes: readonly NormalizedProcess[],
): { mount?: ProcessMount; sections: Set<ClientSection> } {
  const sections = new Set<ClientSection>();
  const stubs = process.stubs.flatMap((stub) => {
    const selection = selections.find((item) => item.id === stub.selection);
    return selection?.module ? [{ stub, module: selection.module }] : [];
  });
  if (!stubs.length) return { sections };
  const { stores } = stubStores(process, selections);
  const built = new Map<string, Client>();
  const use = (client: Client) => {
    if (!built.has(client.key)) built.set(client.key, client);
    sections.add(client.section);
    return `clients[${text(client.key)}]`;
  };
  const imports: Import[] = [];
  const from = (path: string) => `../${path.slice("src/".length)}`;
  const assignments: string[] = [];
  const types: string[] = [];
  // Each stub's own settings (QL05): its file's `settings` export, read through a cast so a stub
  // file without one (an older body) builds and runs with none.
  const declarations: string[] = [];
  const settingReads: string[] = [];
  const localChecks: string[] = [];
  for (const { stub, module } of stubs) {
    const id = generationLocalIdentity(module.component).local;
    const alias = `${pascal(id)}Dependencies`;
    const files = moduleStubPaths(process.tile, module.component);
    imports.push({
      from: from(files.slots),
      name: `Dependencies as ${alias}`,
      type: true,
    });
    imports.push({ from: from(files.module), name: `${pascal(id)}Module`, namespace: true });
    declarations.push(
      `  ${text(id)}: (${pascal(id)}Module as { settings?: SettingsDeclaration }).settings ?? declareSettings({}),`,
    );
    const read = `readModuleSettings(${text(id)}, declared[${text(id)}])`;
    settingReads.push(`configuredSettings[${text(id)}] = ${read}`);
    types.push(`  ${text(id)}: ${alias};`);
    const properties = stubProperties(module, stub.role === "loop").filter((item) => !item.input);
    const workDatabases = properties
      .filter((item) => item.type === "DatabaseReadWriter")
      .map((item) => item.property);
    if (workDatabases.length) {
      imports.push({
        from: "../runtime/durable-work.ts",
        name: "validateDurableWorkBinding",
      });
      imports.push({
        from: "../runtime/durable-work.ts",
        name: "startDurableWork",
      });
      imports.push({ from: tileProcess, name: "createFailureLog" });
      localChecks.push(
        `validateDurableWorkBinding((${pascal(id)}Module as { durableWork?: unknown }).durableWork, ${JSON.stringify(workDatabases)}, ${JSON.stringify(properties.filter((item) => item.type === "ServiceTarget").map((item) => item.property))});`,
      );
    } else
      localChecks.push(
        `if ((${pascal(id)}Module as { durableWork?: unknown }).durableWork !== undefined) throw new Error("Durable work requires one writable database");`,
      );
    const databases =
      stub.role === "route"
        ? properties
            .filter((item) => item.type === "DatabaseReadWriter")
            .map((item) => item.property)
        : [];
    if (databases.length) {
      imports.push({
        from: "../runtime/local-operation.ts",
        name: "validateLocalOperationBinding",
      });
      localChecks.push(
        `validateLocalOperationBinding((${pascal(id)}Module as { localOperation?: unknown }).localOperation, ${JSON.stringify(databases)}, { workload: ${!!process.workloadCallers?.length}, requiredUser: ${selections.some((s) => s.host === process.tile && s.binding.kind === "verified-identity" && s.inputs["guard.signIn"] === "required")} });`,
      );
    } else
      localChecks.push(
        `if ((${pascal(id)}Module as { localOperation?: unknown }).localOperation !== undefined) throw new Error("Local operation requires a writable database on a route module");`,
      );
    const unavailable = (property: string, what: string, why: string) => {
      imports.push({ from: clients, name: "unavailable" });
      return `unavailable<${alias}[${text(property)}]>(${text(`${what} for ${module.name} (${why})`)})`;
    };
    const values = properties.map(({ property, connection, type, slot }) => {
      const target = connection.target;
      if (target.kind === "component") {
        if (slot.callables) {
          const selection = selections.find(
            (s) =>
              s.target.kind === "component" &&
              s.target.component === target.component &&
              (s.binding.kind === "favorites" ||
                s.binding.kind === "rate-limiter" ||
                s.binding.kind === "positive-cache-read"),
          );
          if (!selection) throw new Error(`No installed callable adapter for ${target.component}`);
          if (selection.binding.kind === "positive-cache-read") {
            imports.push({ from: "../runtime/positive-cache.ts", name: "cacheReaderCapability" });
            return [
              property,
              `cacheReaderCapability(() => ${camel(selection.id)}.read, ${text(target.component)})`,
            ];
          }
          if (selection.binding.kind === "rate-limiter") {
            imports.push({ from: "../runtime/rate-limiter.ts", name: "rateLimiterCapability" });
            return [
              property,
              `rateLimiterCapability(() => ${camel(selection.id)}.limiter, ${text(target.component)})`,
            ];
          }
          imports.push({ from: "../runtime/favorites.ts", name: "favoritesCapability" });
          return [
            property,
            `favoritesCapability(() => ${camel(selection.id)}.favorites, ${text(target.component)})`,
          ];
        }
        const called = process.stubs.find((item) => item.module === target.component);
        if (!called)
          return [property, unavailable(property, target.name, "a template's part, not a stub")];
        const paths = moduleStubPaths(process.tile, target.component);
        const entry = moduleEntryName(target.component);
        imports.push({ from: "../runtime/operation.ts", name: "moduleCall" });
        imports.push({ from: from(paths.module), name: entry });
        const deps = `dependencies[${text(generationLocalIdentity(target.component).local)}]`;
        if (called.role === "route") {
          imports.push({ from: entryTypes, name: "ModuleRequest", type: true });
          if (
            called.stores?.some((store) => store.kind === "database" && store.access !== "read")
          ) {
            imports.push({
              from: "../runtime/local-operation.ts",
              name: "invokeLocalModule",
            });
            return [
              property,
              `(input) => moduleCall(() => invokeLocalModule((${pascal(target.component)}Module as { localOperation?: unknown }).localOperation, ${deps}, input, () => ${entry}(${deps}, input as ModuleRequest)))`,
            ];
          }
          return [
            property,
            `(input) => moduleCall(() => ${entry}(${deps}, input as ModuleRequest))`,
          ];
        }
        if (called.role === "loop") {
          imports.push({ from: entryTypes, name: "ModuleMessage", type: true });
          return [
            property,
            `(input) => moduleCall(() => ${entry}(${deps}, input as ModuleMessage))`,
          ];
        }
        return [property, `() => moduleCall(() => ${entry}(${deps}))`];
      }
      const kind = studioComponentTargetKind(target.tile);
      if (
        kind === "database" ||
        kind === "cache" ||
        kind === "queue" ||
        kind === "object-store" ||
        kind === "search"
      ) {
        const store = stores.find(
          (item) =>
            item.element === target.element && (kind !== "queue" || item.access === "publish"),
        );
        if (!store || store.unsupported)
          return [
            property,
            unavailable(property, target.name, "its provider isn't provisioned locally"),
          ];
        if (kind === "database")
          return [
            property,
            use({
              key: `product:${target.element}:${module.component}`,
              section: "database",
              name: "productDatabaseClient",
              call: `await productDatabaseClient(scope, probe, preparedProduct[${text(`product:${target.element}:${module.component}`)}])`,
              prepare: `prepareProductDatabase({ tile: config.tile, resource: ${text(store.resource)}, module: ${text(module.component)}, property: ${text(property)}, writable: ${type === "DatabaseReadWriter"}, operation: (${pascal(id)}Module as { localOperation?: unknown }).localOperation, work: (${pascal(id)}Module as { durableWork?: unknown }).durableWork, owner: ${text(process.productAccess?.find((entry) => entry.resource === store.element)?.owner ?? process.tile)} })`,
              check: {
                name: "databaseEndpoint",
                call: `databaseEndpoint(${text(store.resource)})`,
              },
            }),
          ];
        return [property, use(storeClient(store))];
      }
      if (kind === "application") {
        if (!processes.some((item) => item.tile === target.element))
          return [property, unavailable(property, target.name, "it runs no process")];
        const call = process.serviceCalls?.find(
          (call) => call.module === module.component && call.target === target.element,
        );
        if (!call || !process.workload)
          return [
            property,
            unavailable(
              property,
              target.name,
              "Workload identity setup required; connect caller and callee workload slots to the same Identity",
            ),
          ];
        return [
          property,
          use({
            key: `${target.element}:${module.component}`,
            section: "http",
            name: "serviceTarget",
            call: `serviceTarget({ tile: ${text(target.element)}, operations: ${JSON.stringify(call.operations)}, forwardUser: ${call.forwardUser}, credentials: workload })`,
            check: { name: "serviceEndpoint", call: `serviceEndpoint(${text(target.element)})` },
          }),
        ];
      }
      // An External API, or an Identity a sign-in binds, is an HTTP client at its base URL (QG20).
      const outside = outsideClient(kind, target, type, selections);
      if (outside) return [property, use(outside)];
      const named = studioDefinitions[target.tile].name;
      // Otherwise an Identity isn't provisioned for stubs: a template that binds one on this tile
      // holds the tile's only Auth guard (the derivation refuses a second).
      const why =
        kind === "identity"
          ? "an Identity isn't provisioned for stubs"
          : `${/^[AEIOU]/.test(named) ? "an" : "a"} ${named} isn't provisioned locally`;
      return [property, unavailable(property, target.name, why)];
    });
    // Legacy clients remain private for startup/provisioning compatibility. Public extensions
    // receive a named gap until a registered SQL or authenticated target binding exists.
    for (const item of properties) {
      if (!["QueueConsumer", "TokenVerifier", "HttpTarget"].includes(item.type)) continue;
      const value = values.find(([property]) => property === item.property);
      if (value)
        value[1] = unavailable(
          item.property,
          item.connection.target.name,
          "requires a registered product capability binding",
        );
    }
    values.push(["settings", `configuredSettings[${text(id)}] as ${alias}["settings"]`]);
    assignments.push(
      ...(stub.role === "library"
        ? [`// ${line(module.name)} (library): called only through another module's link.`]
        : []),
      `dependencies[${text(id)}] = {\n${values.map(([property, value]) => `  ${property}: ${value},`).join("\n")}\n};`,
    );
  }
  // Every provisioned store gets its client and probe, even one only a library stub uses.
  for (const store of stores)
    if (!store.unsupported && store.access !== "consume" && store.kind !== "database")
      use(storeClient(store));
  // A publisher and a stub's RabbitMQ loop read the broker's endpoint (`brokerBinding`); a loop on
  // a Pub/Sub topic consumes its tile's subscription (`pubsubLoop`, QG08), probed at its start.
  if (sections.has("queue") || stores.some((store) => store.access === "consume" && !store.pubsub))
    sections.add("broker");
  const pubsubLoops = stores.some((store) => store.access === "consume" && store.pubsub);
  if (pubsubLoops) for (const section of ["pubsub", "pubsub-loop"] as const) sections.add(section);
  const list = [...built.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const probed = pubsubLoops || list.some((client) => client.call.startsWith("await "));
  for (const client of list)
    imports.push({
      from: client.name === "serviceTarget" ? "../runtime/workload.ts" : clients,
      name:
        client.name ??
        {
          database: "databaseClient",
          queue: "queuePublisher",
          pubsub: "pubsubPublisher",
          cache: "cacheClient",
          objects: "objectClient",
          search: "searchClient",
          http: "httpTarget",
        }[client.section],
    });
  if (probed) imports.push({ from: clients, name: "createProbeLog" });
  if (list.some((client) => client.prepare))
    imports.push({ from: clients, name: "prepareProductDatabase" });
  // The configuration pass (QG31): every reader these clients, their loops and the tile's sign-in
  // use, each once (by its text), so a wrong setting fails before any client is built or probed.
  const checks = new Map<string, { name: string; from: string }>();
  for (const client of list)
    if (client.name === "serviceTarget" && client.check)
      checks.set(client.check.call, { name: client.check.name, from: "../runtime/workload.ts" });
    else if (client.section === "http")
      checks.set(client.call, { name: client.name ?? "httpTarget", from: clients });
    else if (client.check)
      checks.set(client.check.call, { name: client.check.name, from: clients });
  if (sections.has("broker"))
    checks.set(brokerCheck.call, { name: brokerCheck.name, from: clients });
  if (sections.has("pubsub-loop"))
    checks.set(pubsubCheck.call, { name: pubsubCheck.name, from: clients });
  // Then each credential these clients read (QG35), by the name Compose's `secrets` gives the
  // service: the value is discarded, so a missing or unreadable one fails in the pass too.
  const secrets = new Set<string>();
  for (const store of stores) {
    if (store.unsupported) continue;
    if (store.kind === "database") {
      secrets.add(`sql-${store.resource}--${process.tile}`);
      secrets.add(`product-${store.resource}--${process.tile}`);
    } else if (store.kind === "cache") secrets.add(`cache-${store.resource}`);
    else if (store.kind === "object-store") secrets.add(`s3-${process.tile}`);
  }
  if (sections.has("broker")) secrets.add("broker-password");
  for (const secret of [...secrets].sort(v2Compare))
    checks.set(`readSecret(${text(secret)})`, { name: "readSecret", from: localPath });
  if (tileGuard(process, selections))
    checks.set("signInSettings()", { name: "signInSettings", from: guardPath });
  // Last, each stub's declared settings (QL05), in the order its dependencies are built.
  for (const read of settingReads)
    checks.set(read, { name: "createSettingsReader", from: settingsPath });
  imports.push(
    { from: settingsPath, name: "declareSettings" },
    { from: settingsPath, name: "SettingsDeclaration", type: true },
    { from: settingsPath, name: "SettingsOf", type: true },
    { from: clients, name: "checkConfiguration" },
  );
  for (const check of checks.values()) imports.push(check);
  // A queue's publisher reports a lost and a returned broker through the failure log.
  if (list.some((client) => client.section === "queue"))
    imports.push({ from: tileProcess, name: "brokerState" });
  const provisioned = stores.filter((store) => !store.unsupported);
  const written = stores.filter(writesDatabase);
  const issuer = list.find((client) => client.name === "identityTarget")?.key;
  if (process.workload && process.workloadCallers?.length)
    imports.push({ from: "../runtime/workload.ts", name: "callerAllowlist" });
  const external = list
    .filter((client) => client.name === "externalTarget")
    .map((client) => client.key);
  return {
    sections,
    mount: {
      imports,
      validation: [
        ...(process.workload && process.workloadCallers?.length
          ? [
              `const allowedCallers = { ${stubs
                .filter(({ stub }) => stub.role === "route")
                .map(
                  ({ module }) =>
                    `${text(module.component)}: callerAllowlist((${pascal(module.component)}Module as { allowedCallers?: unknown }).allowedCallers, ${JSON.stringify(process.workloadCallers)})`,
                )
                .join(", ")} };`,
            ]
          : []),
        "// Each stub's own settings: what its file's `settings` export declares (none without one).",
        "const declared = {",
        ...declarations,
        "};",
        "const readModuleSettings = createSettingsReader();",
        "const configuredSettings = {} as { [Name in keyof typeof declared]: SettingsOf<(typeof declared)[Name]> };",
        ...localChecks,
        ...(list.some((client) => client.prepare)
          ? [
              "// Prepare all registered SQL and product credentials before any connection or probe.",
              "const preparedProduct = {",
              ...list
                .filter((client) => client.prepare)
                .map((client) => `  ${text(client.key)}: ${client.prepare},`),
              "};",
            ]
          : []),
        "// Configuration: every variable these clients, the tile's sign-in and its stubs' settings read,",
        "// checked before any client is built or probed; one wrong setting fails startup naming it,",
        "// several are named together (a stub's first).",
        "checkConfiguration([",
        ...[...checks.keys()].map((call) => `  () => ${call},`),
        "]);",
      ],
      setup: [
        ...(list.length
          ? [
              "// Module clients (src/runtime/module-clients.ts): one per store or channel this tile's stubs",
              "// use, each probed once before the process is ready; a failed probe fails startup, except",
              "// a cache's, which is logged.",
            ]
          : []),
        ...(probed ? ["const probe = createProbeLog(config.tile);"] : []),
        ...(list.length
          ? [
              "const clients = {",
              ...list.map((client) => `  ${text(client.key)}: ${client.call},`),
              "};",
            ]
          : []),
        "// Each stub's dependencies: its clients, and a module link calls that module's entry point.",
        "const dependencies = {} as {",
        ...types,
        "};",
        ...assignments.flatMap((item) => item.split("\n")),
      ],
      configure: [],
      initialize: stubs
        .filter(({ module, stub }) =>
          stubProperties(module, stub.role === "loop").some(
            (item) => item.type === "DatabaseReadWriter",
          ),
        )
        .map(({ module }) => {
          const id = generationLocalIdentity(module.component).local;
          return `startDurableWork((${pascal(id)}Module as { durableWork?: unknown }).durableWork, dependencies[${text(id)}], scope, (event, fields) => failure(event, new Error(event), fields));`;
        }),
      started: [],
      routes: [],
      loops: [],
      service: {
        ...service(),
        dependsOn: [...new Set(provisioned.map((store) => store.resource))],
        sql: provisioned.filter((store) => store.kind === "database").map((s) => s.resource),
        storage: provisioned
          .filter((store) => store.kind === "object-store")
          .map((s) => s.resource),
        cache: provisioned.filter((store) => store.kind === "cache").map((s) => s.resource),
        broker: provisioned.some((store) => store.kind === "queue" && !store.pubsub),
        ...((pubsubLoops || list.some((client) => client.section === "pubsub")) && {
          pubsub: true,
        }),
        calls: [...new Set(process.serviceCalls?.map((call) => call.target) ?? [])],
        // A stub's Identity client reads that Identity's `JEEVES_IDENTITY_<ID>_URL` (locally
        // Keycloak inside the network), and an External API's its `JEEVES_EXTERNAL_<ID>_URL`, which
        // Compose doesn't set (QG20).
        ...(issuer && { issuer: generationLocalIdentity(issuer).local }),
        ...(external.length && { external }),
      },
      // Each database a stub writes gets the idempotency records and this tile's grant (QL04);
      // the tile's login there is the stub rows' own.
      local: written.length
        ? {
            migrations: written.flatMap((store) =>
              [idempotencyMigration, localOperationMigration, durableWorkMigration].map(
                (migration) => ({
                  resource: store.resource,
                  ...migration,
                }),
              ),
            ),
            grants: written.flatMap((store) => [
              idempotencyGrant(store.resource, process.tile),
              {
                ...idempotencyGrant(store.resource, process.tile),
                relation: "work_records",
              },
              { ...idempotencyGrant(store.resource, process.tile), relation: "work_tickets" },
            ]),
          }
        : {},
    },
  };
}

/** What runs locally for a store, in the report's words. */
function provisionedAs(
  store: StubStore,
  process: NormalizedProcess,
  views: readonly { resource: string; schema?: string; name: string }[],
) {
  const host = process.tile;
  switch (store.kind) {
    case "database": {
      const templateViews = views
        .filter((view) => view.resource === store.resource)
        .map((view) => `${view.schema ?? "public"}.${view.name}`);
      const access = process.productAccess?.find((entry) => entry.resource === store.element);
      return `PostgreSQL database ${localDatabase(store.resource)}, login ${localLogin(store.resource, host)} (${[
        "CONNECT, USAGE on public",
        ...(store.boundary && templateViews.length
          ? [`SELECT on its owner's template views ${templateViews.join(", ")}`]
          : []),
        ...(access
          ? [
              ...access.product.tables.map(
                (table) => `${table.operations.join(", ")} on ${access.schema}.${table.name}`,
              ),
              ...access.product.views.map((view) => `SELECT on published.${view}`),
            ]
          : ["no declared product access"]),
        ...(writesDatabase(store)
          ? [
              "its private replay and work records in jeeves.idempotency_records and jeeves.work_records",
            ]
          : []),
        "no product DDL or migration credential",
      ].join("; ")})`;
    }
    case "queue": {
      if (store.pubsub) {
        const local = `locally the emulator ${localPubsub.service}`;
        if (store.access === "publish")
          return `Google Cloud Pub/Sub topic ${store.resource} (${local})`;
        // Each consuming module's own subscription (QG28).
        const subscriptions = store.modules
          .map((module) => pubsubSubscription(store.resource, host, module))
          .sort((a, b) => v2Compare(a.name, b.name));
        const [only] = subscriptions;
        if (only && subscriptions.length === 1)
          return `Google Cloud Pub/Sub subscription ${only.name} on topic ${store.resource}, with dead-letter topic ${only.failed} and its subscription (${local})`;
        return `Google Cloud Pub/Sub subscriptions ${subscriptions.map((row) => row.name).join(", ")} on topic ${store.resource}, one per consuming module, each with its dead-letter topic <subscription>.failed and its subscription (${local})`;
      }
      const queue =
        store.mode === "topic"
          ? store.access === "consume"
            ? `subscriber ${store.resource}--${host}`
            : `exchange ${store.resource}`
          : `work queue ${store.resource}`;
      return `RabbitMQ ${queue}${store.mode === "topic" && store.access === "publish" ? "" : " and its .failed"}`;
    }
    case "cache":
      return `Valkey cache-${store.resource} with its password`;
    case "object-store":
      return `Garage bucket ${store.resource}, key s3-${host} (${store.access === "read-write" ? "read, write" : store.access})`;
    case "search":
      return `OpenSearch search-${store.resource} (no index until a mapping is written)`;
  }
}

/** The report's `stores` rows for the External APIs and Identity a process's stubs call through an
 * HTTP client (QG20), after its stores, in tile order: the base URL each reads. */
export function stubTargetRows(
  process: NormalizedProcess,
  selections: readonly NormalizedGenerationSelection[],
): V2ProcessReport["stores"] {
  const rows = new Map<
    string,
    {
      store: string;
      name: string;
      kind: string;
      access: string;
      modules: string[];
    }
  >();
  for (const stub of process.stubs) {
    const module = selections.find((item) => item.id === stub.selection)?.module;
    if (!module) continue;
    for (const { connection, type, use } of stubProperties(module, stub.role === "loop")) {
      const target = connection.target;
      if (target.kind !== "element") continue;
      const kind = studioComponentTargetKind(target.tile);
      if (!outsideClient(kind, target, type, selections)) continue;
      const row = rows.get(target.element) ?? {
        store: target.element,
        name: target.name,
        kind,
        access: use,
        modules: [],
      };
      if (!row.modules.includes(stub.module)) row.modules.push(stub.module);
      rows.set(target.element, row);
    }
  }
  return [...rows.values()]
    .sort((a, b) => v2Compare(a.store, b.store))
    .map((row) => ({
      ...row,
      provisioned:
        row.kind === "external-api"
          ? `HTTP client at ${externalVariable(row.store)}, which the application sets (compose.yaml doesn't, so startup fails until it is set); a failed call keeps the normal retries`
          : `HTTP client at ${identityVariable(generationLocalIdentity(row.store).local)}, the Identity's base URL as the process reaches it (locally Keycloak identity-${generationLocalIdentity(row.store).local} inside the network, realm ${generationLocalIdentity(row.store).local}); a failed call waits as an unreachable store's does`,
    }));
}

/** The report's `stubSettings` rows (QL05): each stub whose file's `settings` export the process
 * reads, in the order its dependencies are built. */
export function stubSettingsRows(
  process: NormalizedProcess,
  selections: readonly NormalizedGenerationSelection[],
): NonNullable<V2ProcessReport["stubSettings"]> {
  return process.stubs.flatMap((stub) => {
    const module = selections.find((item) => item.id === stub.selection)?.module;
    return module
      ? [
          {
            module: module.component,
            file: moduleStubPaths(process.tile, module.component).module,
          },
        ]
      : [];
  });
}

/** The report's `stores` rows for a process: each store or channel its stubs use, what is
 * provisioned for it, or why it isn't. */
export function stubStoreRows(
  process: NormalizedProcess,
  selections: readonly NormalizedGenerationSelection[],
  views: readonly { resource: string; schema?: string; name: string }[],
): V2ProcessReport["stores"] {
  return stubStores(process, selections).stores.map((store) => ({
    store: store.element,
    name: store.name,
    kind: store.kind,
    access: store.access,
    ...(store.boundary && { boundary: store.boundary }),
    modules: [...store.modules],
    ...(store.unsupported
      ? { unsupported: store.unsupported }
      : { provisioned: provisionedAs(store, process, views) }),
  }));
}

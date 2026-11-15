import {
  generationLocalIdentity,
  type NormalizedGenerationSelection,
  type NormalizedProcess,
  studioComponentTargetKind,
  studioDefinitions,
} from "@jeeves/spec";
import {
  brokerState,
  type Import,
  line,
  type ProcessMount,
  pascal,
  service,
  text,
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
 * is the function it calls when it isn't its section's own (QG20's HTTP clients). */
type Client = {
  key: string;
  section: Exclude<ClientSection, "broker" | "pubsub-loop">;
  call: string;
  name?: "externalTarget" | "identityTarget";
};

/** An External API's base URL variable (QG20), `JEEVES_EXTERNAL_<ID>_URL`. */
export const externalVariable = (element: string) => `JEEVES_EXTERNAL_${endpointId(element)}_URL`;

/**
 * A stub's link to an External API or an Identity whose interface is an `HttpTarget` (QG20): an
 * External API's client at `JEEVES_EXTERNAL_<ID>_URL`, unmarked, and an Identity's at `OIDC_ISSUER`,
 * marked as an internal call, when a sign-in in the design binds that Identity. Anything else
 * (an Identity no sign-in binds, a link that verifies a token) is undefined.
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
      call: "identityTarget()",
    };
  return undefined;
}

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
      };
    case "queue":
      // A queue only stubs use, saved on Google Cloud, publishes to its Pub/Sub topic (QG07).
      if (store.pubsub)
        return {
          key,
          section: "pubsub",
          call: `await pubsubPublisher(scope, probe, { topic: ${resource} })`,
        };
      return {
        key,
        section: "queue",
        call: `await queuePublisher(scope, probe, { queue: ${resource}, mode: ${text(store.mode ?? "work-queue")} }, ${brokerState(`broker publish ${store.resource}`)})`,
      };
    case "cache":
      return {
        key,
        section: "cache",
        call: `await cacheClient(scope, probe, { cache: ${resource} })`,
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
  for (const { stub, module } of stubs) {
    const id = generationLocalIdentity(module.component).local;
    const alias = `${pascal(id)}Dependencies`;
    imports.push({
      from: from(moduleStubPaths(process.tile, module.component).slots),
      name: `Dependencies as ${alias}`,
      type: true,
    });
    types.push(`  ${text(id)}: ${alias};`);
    const properties = stubProperties(module, stub.role === "loop").filter((item) => !item.input);
    const unavailable = (property: string, what: string, why: string) => {
      imports.push({ from: clients, name: "unavailable" });
      return `unavailable<${alias}[${text(property)}]>(${text(`${what} for ${module.name} (${why})`)})`;
    };
    const values = properties.map(({ property, connection, type }) => {
      const target = connection.target;
      if (target.kind === "component") {
        const called = process.stubs.find((item) => item.module === target.component);
        if (!called)
          return [property, unavailable(property, target.name, "a template's part, not a stub")];
        const paths = moduleStubPaths(process.tile, target.component);
        const entry = moduleEntryName(target.component);
        imports.push({ from: from(paths.module), name: entry });
        const deps = `dependencies[${text(generationLocalIdentity(target.component).local)}]`;
        if (called.role === "route") {
          imports.push({ from: entryTypes, name: "ModuleRequest", type: true });
          return [property, `(input) => ${entry}(${deps}, input as ModuleRequest)`];
        }
        if (called.role === "loop") {
          imports.push({ from: entryTypes, name: "ModuleMessage", type: true });
          return [property, `(input) => ${entry}(${deps}, input as ModuleMessage)`];
        }
        return [property, `() => ${entry}(${deps})`];
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
        return [property, use(storeClient(store))];
      }
      if (kind === "application") {
        if (!processes.some((item) => item.tile === target.element))
          return [property, unavailable(property, target.name, "it runs no process")];
        return [
          property,
          use({
            key: target.element,
            section: "http",
            call: `httpTarget({ tile: ${text(target.element)} })`,
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
    assignments.push(
      ...(stub.role === "library"
        ? [`// ${line(module.name)} (library): called only through another module's link.`]
        : []),
      values.length
        ? `dependencies[${text(id)}] = {\n${values.map(([property, value]) => `  ${property}: ${value},`).join("\n")}\n};`
        : `dependencies[${text(id)}] = {};`,
    );
  }
  // Every provisioned store gets its client and probe, even one only a library stub uses.
  for (const store of stores)
    if (!store.unsupported && store.access !== "consume") use(storeClient(store));
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
      from: clients,
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
  // A queue's publisher reports a lost and a returned broker through the failure log.
  if (list.some((client) => client.section === "queue"))
    imports.push({ from: tileProcess, name: "brokerState" });
  const provisioned = stores.filter((store) => !store.unsupported);
  const issuer = list.find((client) => client.name === "identityTarget")?.key;
  const external = list
    .filter((client) => client.name === "externalTarget")
    .map((client) => client.key);
  return {
    sections,
    mount: {
      imports,
      setup: [
        ...(list.length
          ? [
              "// Module clients (src/runtime/module-clients.ts): one per store or channel this tile's stubs",
              "// use, each probed once before the process is ready; a failed probe fails startup.",
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
      initialize: [],
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
        calls: list
          .filter((client) => client.section === "http" && !client.name)
          .map((client) => client.key),
        // A stub's Identity client reads that Identity's `OIDC_ISSUER`, and an External API's its
        // `JEEVES_EXTERNAL_<ID>_URL`, which Compose doesn't set (QG20).
        ...(issuer && { issuer: generationLocalIdentity(issuer).local }),
        ...(external.length && { external }),
      },
      local: {},
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
      // Every login reads the writers' published views (v3 contract, section 1); a stub that
      // writes the database also has its own schema there.
      const own = (process.writers ?? [])
        .filter(
          (writer) => writer.database === store.element && store.modules.includes(writer.module),
        )
        .map((writer) => `m_${generationLocalIdentity(writer.module).sql}`);
      return `PostgreSQL database ${localDatabase(store.resource)}, login ${localLogin(store.resource, host)} (${[
        "CONNECT, USAGE on public",
        "SELECT on published",
        ...(store.boundary && templateViews.length
          ? [`SELECT on its owner's template views ${templateViews.join(", ")}`]
          : []),
        ...(own.length ? [`its own tables in ${own.join(", ")}`] : []),
      ].join("; ")})`;
    }
    case "queue": {
      if (store.pubsub) {
        const local = `locally the emulator ${localPubsub.service}`;
        if (store.access === "publish")
          return `Google Cloud Pub/Sub topic ${store.resource} (${local})`;
        const subscription = pubsubSubscription(store.resource, host);
        return `Google Cloud Pub/Sub subscription ${subscription.name} on topic ${store.resource}, with dead-letter topic ${subscription.failed} and its subscription (${local})`;
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
    { store: string; name: string; kind: string; access: string; modules: string[] }
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
          : `HTTP client at OIDC_ISSUER, the issuer of Keycloak identity-${generationLocalIdentity(row.store).local} (realm ${generationLocalIdentity(row.store).local}); a failed call waits as an unreachable store's does`,
    }));
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

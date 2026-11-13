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
import { localDatabase, localLogin, type StubStore, stubStores } from "./local-contract.ts";
import { moduleEntryName, moduleStubPaths, stubProperties } from "./module-stubs.ts";
import type { V2ProcessReport } from "./registry.ts";

const clients = "../runtime/module-clients.ts";
const entryTypes = "../modules/entry.ts";
/** The sections of `src/runtime/module-clients.ts` a design's processes use; the rest are left
 * out, so the scaffold imports only the libraries the export has. */
export type ClientSection = "database" | "queue" | "cache" | "objects" | "search" | "http";

/** One client a process builds: its key in `clients`, its section and its constructor call. */
type Client = { key: string; section: ClientSection; call: string };

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
 * built from them. A module link calls the module it names. A dependency that isn't provisioned
 * (another provider, an Identity, a CDN or external API, a tile with no process, a template's part)
 * answers "Not implemented" naming why.
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
  const { stores } = stubStores(process);
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
    const values = properties.map(({ property, connection }) => {
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
            call: `httpTarget(${text(`http://app-${target.element}:3000`)})`,
          }),
        ];
      }
      const named = studioDefinitions[target.tile].name;
      // An Identity isn't provisioned for stubs: a template that binds one on this tile holds
      // the tile's only Auth guard (the derivation refuses a second).
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
  const list = [...built.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const probed = list.some((client) => client.call.startsWith("await "));
  for (const client of list)
    imports.push({
      from: clients,
      name: {
        database: "databaseClient",
        queue: "queuePublisher",
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
  return {
    sections,
    mount: {
      imports,
      setup: [
        ...(list.length
          ? [
              "// Module clients (src/runtime/module-clients.ts): one per store or channel this tile's stubs",
              "// use, each probed once before the process is ready; a failed probe fails startup.",
              ...(probed ? ["const probe = createProbeLog(config.tile);"] : []),
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
        broker: provisioned.some((store) => store.kind === "queue"),
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

/** The report's `stores` rows for a process: each store or channel its stubs use, what is
 * provisioned for it, or why it isn't. */
export function stubStoreRows(
  process: NormalizedProcess,
  views: readonly { resource: string; schema?: string; name: string }[],
): V2ProcessReport["stores"] {
  return stubStores(process).stores.map((store) => ({
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

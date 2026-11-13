import type { DesignDocument, StudioCommand } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import {
  moduleAuthored,
  runStudioCommands,
  tileLevelTwin,
} from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const on: StudioCommand = { type: "setRunnableProcesses", on: true };
const assemble = (design: DesignDocument) =>
  assembleV2({ designJson: canonicalJson(design) }, registry);
type Bundle = ReturnType<typeof assemble>;
const text = (bundle: Bundle, path: string) => {
  const file = bundle.files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
const json = (bundle: Bundle, path: string) => JSON.parse(text(bundle, path));
type Store = {
  store: string;
  kind: string;
  access: string;
  boundary?: string;
  modules: string[];
  provisioned?: string;
  unsupported?: string;
};
type Report = { processes: { runnable: boolean; tiles: { tile: string; stores: Store[] }[] } };
const processes = (bundle: Bundle) => (bundle.report as unknown as Report).processes;
const stores = (bundle: Bundle, tile: string) =>
  processes(bundle).tiles.find((row) => row.tile === tile)?.stores ?? [];
type Service = { depends_on: Record<string, unknown>; secrets: string[] };
const services = (bundle: Bundle) =>
  json(bundle, "compose.yaml").services as Record<string, Service>;
const tile = (from: string, id: string, name: string, kind: string): StudioCommand => ({
  type: "addTile",
  from: { tile: from },
  side: "after",
  tile: { id, name, kind } as Extract<StudioCommand, { type: "addTile" }>["tile"],
  linkId: `${from}-${id}`,
});
const edit = (element: string, settings: Record<string, unknown>): StudioCommand =>
  ({ type: "edit", element, settings }) as StudioCommand;
/** The stub stack with more of what a stub can use: a write-only bucket, an index writer, a module
 * link to a library stub, an external API and an Identity no template binds. */
const wider = () =>
  runStudioCommands(stubStackDesign(), [
    tile("stats-api", "partner", "Partner API", "external-api"),
    tile("stats-api", "login", "Login", "identity"),
    tile("visit-worker", "exports", "Exports", "object-store"),
    { type: "linkTiles", from: { tile: "visit-worker" }, to: "stats-index", linkId: "vw-index" },
    {
      type: "addModule",
      host: "stats-api",
      kind: "external-call",
      id: "partner-caller",
      name: "Partner caller",
    },
    {
      type: "connectModule",
      module: "partner-caller",
      slot: "target",
      target: { tile: "partner" },
    },
    // An Auth guard connected to Login would lead its sign-in template (V3-06); an External call
    // is a stub that still reaches the Identity no template binds.
    { type: "addModule", host: "stats-api", kind: "external-call", id: "gate", name: "Gate" },
    { type: "connectModule", module: "gate", slot: "target", target: { tile: "login" } },
    {
      type: "addModule",
      host: "visit-worker",
      kind: "cache-reader",
      id: "visit-cache",
      name: "Visit cache",
    },
    {
      type: "connectModule",
      module: "visit-cache",
      slot: "loader",
      target: { module: "visit-writer" },
    },
    {
      type: "addModule",
      host: "visit-worker",
      kind: "video-packager",
      id: "packer",
      name: "Packer",
    },
    { type: "connectModule", module: "packer", slot: "outputs", target: { tile: "exports" } },
    {
      type: "addModule",
      host: "visit-worker",
      kind: "index-writer",
      id: "indexer",
      name: "Indexer",
    },
    { type: "connectModule", module: "indexer", slot: "index", target: { tile: "stats-index" } },
    on,
  ]);

describe("provisioning for stubs (tile process contract, section 6)", () => {
  const stack = assemble(runStudioCommands(stubStackDesign(), [on]));
  const stackOff = assemble(stubStackDesign());
  const v2 = assemble(runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [on]));

  it("provisions every store and channel a stub links to, by kind", () => {
    expect(stack.report.findings).toEqual([]);
    expect(processes(stack).runnable).toBe(true);
    const plan = json(stack, "infra/local.json");
    // Database: the database, its setup-only owner and one runtime login per stub tile.
    expect(plan.databases).toEqual([
      {
        resource: "links-db",
        database: "d_links_db",
        owner: "o_links_db",
        secret: "owner-links-db",
        migrations: ["infra/postgres/links-db/000-foundation.sql"],
        // Link reader writes it (Links API created it), so it has its own SQL file and schema.
        modules: [
          {
            module: "link-reader",
            host: "links-api",
            schema: "m_link_reader",
            file: "infra/postgres/links-db/modules/link-reader.sql",
          },
        ],
      },
    ]);
    expect(
      plan.logins.map((login: { host: string; user: string; secret: string }) => [
        login.host,
        login.user,
        login.secret,
      ]),
    ).toEqual([
      ["links-api", "r_links_db__links_api", "sql-links-db--links-api"],
      ["visit-worker", "r_links_db__visit_worker", "sql-links-db--visit-worker"],
    ]);
    // No template tables: CONNECT and USAGE on public (migrate.mjs), no relation grants; the
    // product step grants published and the writer's own schema (products.mjs).
    expect(plan.grants).toEqual([]);
    expect(text(stack, "infra/postgres/links-db/000-foundation.sql")).toContain(
      "REVOKE ALL ON SCHEMA public FROM PUBLIC;",
    );
    // Queues: Visits a topic with the Visit worker's subscriber, Uploaded a work queue
    // (broker-init.mjs adds each queue's .failed).
    expect(plan.broker).toEqual([
      { resource: "uploaded", queues: ["uploaded"] },
      { resource: "visits", exchange: "visits", queues: ["visits--visit-worker"] },
    ]);
    // Object storage: the bucket and one key per tile, with its links' read and write.
    expect(plan.objects).toEqual([{ id: "archive", public: false }]);
    expect(plan.storage).toEqual([
      {
        resource: "archive",
        host: "upload-api",
        secret: "s3-upload-api",
        read: true,
        write: true,
        corsPut: false,
      },
      {
        resource: "archive",
        host: "visit-worker",
        secret: "s3-visit-worker",
        read: true,
        write: false,
        corsPut: false,
      },
    ]);
    expect(plan.generatedSecrets).toEqual(["s3-upload-api", "s3-visit-worker"]);
    // Cache and search: their own services; no index (no mapping), so no search setup.
    expect(plan.providers).toEqual([
      "cache-links-cache",
      "local-broker",
      "local-objects",
      "local-postgres",
      "search-stats-index",
    ]);
    expect(plan.search).toEqual([]);
    const compose = services(stack);
    expect(Object.keys(compose).filter((name) => name.startsWith("setup-"))).toEqual([
      "setup-broker",
      "setup-migrate",
    ]);
    expect(compose["setup-migrate"]?.secrets).toEqual([
      "postgres-admin",
      "owner-links-db",
      "sql-links-db--links-api",
      "sql-links-db--visit-worker",
    ]);
    // Each process gets its credentials and waits for each provider it uses, healthy.
    const needs = (name: string) => [
      Object.keys(compose[name]?.depends_on ?? {}),
      compose[name]?.secrets,
    ];
    expect(needs("app-links-api")).toEqual([
      ["cache-links-cache", "local-broker", "local-postgres"],
      ["sql-links-db--links-api", "cache-links-cache", "broker-password"],
    ]);
    expect(needs("app-stats-api")).toEqual([["search-stats-index"], []]);
    expect(needs("app-upload-api")).toEqual([
      ["local-broker", "local-objects"],
      ["s3-upload-api", "broker-password"],
    ]);
    expect(needs("app-visit-worker")).toEqual([
      ["local-broker", "local-objects", "local-postgres"],
      ["sql-links-db--visit-worker", "s3-visit-worker", "broker-password"],
    ]);
    // Credentials are generated at first run (setup.mjs and bootstrap.mjs); none is in the export.
    expect(stack.files.some((file) => file.path.startsWith(".runtime/"))).toBe(false);
    // Nothing is written to ownership: the exported design is the saved one.
    expect(JSON.parse(text(stack, ".jeeves/inputs/design.json"))).not.toHaveProperty("ownership");
    // Off, stubs provision nothing.
    const off = json(stackOff, "infra/local.json");
    expect([off.resources, off.logins, off.broker, off.storage, off.providers]).toEqual([
      [],
      [],
      [],
      [],
      [],
    ]);
  });

  it("gives a tile the widest access of its stubs' links, and another owner's published views", () => {
    // Links API created Links database (read & write); Visit worker's Data access only reads it.
    const resources = json(stack, "infra/local.json").resources as {
      id: string;
      users: { host: string; access?: string; channel?: string; boundary?: string }[];
    }[];
    const users = (id: string) =>
      resources
        .find((item) => item.id === id)
        ?.users.map((user) =>
          [user.host, user.access ?? user.channel, user.boundary].filter(Boolean).join(" "),
        );
    expect(users("links-db")).toEqual(["links-api read-write", "visit-worker read"]);
    expect(users("archive")).toEqual(["upload-api read-write", "visit-worker read"]);
    expect(users("visits")).toEqual(["links-api publish", "visit-worker consume"]);
    expect(users("uploaded")).toEqual(["links-api consume", "upload-api publish"]);
    // Two links of one tile to one bucket: its key gets both (Archiver reads, Packer writes).
    const wide = assemble(
      runStudioCommands(wider(), [
        {
          type: "addModule",
          host: "visit-worker",
          kind: "video-packager",
          id: "archive-packer",
          name: "Archive packer",
        },
        {
          type: "connectModule",
          module: "archive-packer",
          slot: "outputs",
          target: { tile: "archive" },
        },
      ]),
    );
    expect(
      (json(wide, "infra/local.json").storage as { host: string; resource: string }[]).filter(
        (item) => item.host === "visit-worker",
      ),
    ).toEqual([
      expect.objectContaining({ resource: "archive", read: true, write: true }),
      expect.objectContaining({ resource: "exports", read: false, write: true }),
    ]);
    // v2: View counts belongs to the event counter's owner. Watch's View count reader gets a
    // login with SELECT on the counter's published view only, and Watch's View publisher publishes.
    const plan = json(v2, "infra/local.json");
    expect(plan.logins).toContainEqual(
      expect.objectContaining({ host: "watch", user: "r_view_counts__watch" }),
    );
    expect(plan.grants.filter((grant: { host: string }) => grant.host === "watch")).toEqual([
      {
        resource: "view-counts",
        host: "watch",
        schema: "counter_sum_public",
        relation: "totals",
        kind: "view",
        privileges: ["SELECT"],
      },
    ]);
    expect(stores(v2, "watch")).toEqual([
      {
        store: "view-counts",
        name: "View counts",
        kind: "database",
        access: "read",
        boundary: "published-read",
        modules: ["watch-counts"],
        provisioned:
          "PostgreSQL database d_view_counts, login r_view_counts__watch (CONNECT, USAGE on public; SELECT on published; SELECT on its owner's template views counter_sum_public.totals)",
      },
      {
        store: "view-events",
        name: "View events",
        kind: "queue",
        access: "publish",
        modules: ["watch-views"],
        provisioned: "RabbitMQ exchange view-events",
      },
    ]);
    expect(Object.keys(services(v2)["app-watch"]?.depends_on ?? {})).toEqual([
      "cache-metadata-cache",
      "local-broker",
      "local-postgres",
    ]);
    // Templates keep their own provisioning: no other tile gets a stub row.
    expect(
      processes(v2)
        .tiles.filter((row) => row.stores.length)
        .map((row) => row.tile),
    ).toEqual(["watch"]);
  });

  it("leaves another saved provider or engine unprovisioned, as a required unsupported gap", () => {
    const design = runStudioCommands(stubStackDesign(), [
      edit("links-db", { kind: "database", engine: "mysql", provider: "self-hosted" }),
      edit("links-cache", { kind: "cache", engine: "redis-compatible", provider: "upstash" }),
      edit("archive", { kind: "object-store", provider: "aws-s3", access: "private" }),
      edit("stats-index", { kind: "search", engine: "elasticsearch", provider: "self-hosted" }),
      edit("uploaded", { kind: "queue", mode: "work-queue", provider: "aws" }),
      on,
    ]);
    const bundle = assemble(design);
    expect(bundle.report.findings).toEqual([]);
    expect(processes(bundle).runnable).toBe(false);
    const gaps = bundle.report.gaps.filter((gap) => gap.status === "unsupported");
    expect(gaps.map((gap) => [gap.id, gap.required])).toEqual([
      ["provider-archive-upload-archive", true],
      ["provider-archiver-archive", true],
      ["provider-limiter-links-cache", true],
      ["provider-link-reader-links-db", true],
      ["provider-stats-search-stats-index", true],
      ["provider-upload-consumer-uploaded", true],
      ["provider-upload-publisher-uploaded", true],
      ["provider-visit-writer-links-db", true],
    ]);
    expect(gaps.map((gap) => gap.description)).toContain(
      "Links database uses the mysql engine; a stub's database is provisioned locally only as PostgreSQL, with its engine unspecified or postgresql.",
    );
    expect(gaps.map((gap) => gap.description)).toContain(
      "Archive uses the aws-s3 provider; a stub's object storage is provisioned locally only when its provider is unspecified or self-hosted.",
    );
    // Only Visits (unspecified) is provisioned.
    const plan = json(bundle, "infra/local.json");
    expect(plan.resources.map((item: { id: string }) => item.id)).toEqual(["visits"]);
    expect(plan.providers).toEqual(["local-broker"]);
    // Each such dependency answers "Not implemented" naming why; the export still compiles.
    expect(text(bundle, "src/processes/links-api.ts")).toContain(
      'linksDb: unavailable<LinkReaderDependencies["linksDb"]>("Links database for Link reader (its provider isn\'t provisioned locally)"),',
    );
    expect(stores(bundle, "stats-api")).toEqual([
      expect.objectContaining({
        store: "stats-index",
        unsupported: expect.stringContaining("uses the elasticsearch engine"),
      }),
    ]);
  });

  it("builds every stub's dependencies from real clients, one probe each", () => {
    const links = text(stack, "src/processes/links-api.ts");
    expect(links).toContain(
      [
        "  const probe = createProbeLog(config.tile);",
        "  const clients = {",
        '    "links-cache": await cacheClient(scope, probe, { cache: "links-cache" }),',
        '    "links-db": await databaseClient(scope, probe, { tile: config.tile, resource: "links-db" }),',
        '    "stats-api": httpTarget("http://app-stats-api:3000"),',
        '    "visits": await queuePublisher(scope, probe, { queue: "visits", mode: "topic" }, brokerState(config.tile, failure, "broker publish visits")),',
        "  };",
      ].join("\n"),
    );
    // A module link calls the module it names, here a route stub with the caller's input.
    expect(links).toContain(
      '    linkReader: (input) => linkReader(dependencies["link-reader"], input as ModuleRequest),',
    );
    expect(links).toContain('    statsApi: clients["stats-api"],');
    expect(links).toContain('  dependencies["redirector"] = {};');
    // Clients are built and probed before the loops subscribe and the service listens.
    expect(links.indexOf("const clients = {")).toBeLessThan(links.indexOf("startModuleLoop("));
    expect(links).not.toContain("unprovisioned");
    // A worker builds its library stubs' clients too, so their stores are probed.
    const worker = text(stack, "src/processes/visit-worker.ts");
    expect(worker).toContain(
      '    "archive": await objectClient(scope, probe, { tile: config.tile, bucket: "archive", access: "read" }),',
    );
    expect(worker).toContain(
      "  // Visit writer (library): called only through another module's link.",
    );
    // What isn't provisioned answers "Not implemented"; a library stub is called with no input.
    const wide = assemble(wider());
    expect(processes(wide).runnable).toBe(true);
    const stats = text(wide, "src/processes/stats-api.ts");
    expect(stats).toContain(
      '    partner: unavailable<PartnerCallerDependencies["partner"]>("Partner API for Partner caller (an External API isn\'t provisioned locally)"),',
    );
    expect(stats).toContain(
      '    login: unavailable<GateDependencies["login"]>("Login for Gate (an Identity isn\'t provisioned for stubs)"),',
    );
    const visits = text(wide, "src/processes/visit-worker.ts");
    expect(visits).toContain('    visitWriter: () => visitWriter(dependencies["visit-writer"]),');
    expect(visits).toContain(
      '    "exports": await objectClient(scope, probe, { tile: config.tile, bucket: "exports", access: "write" }),',
    );
    expect(visits).toContain(
      '    "stats-index": await searchClient(scope, probe, { index: "stats-index" }),',
    );
  });

  it("emits module-clients.ts with only the sections and libraries the processes use", () => {
    const clients = text(stack, "src/runtime/module-clients.ts");
    for (const name of [
      "databaseClient",
      "queuePublisher",
      "cacheClient",
      "objectClient",
      "searchClient",
      "httpTarget",
      "unavailable",
      "createProbeLog",
    ])
      expect(clients).toContain(
        `export ${name === "unavailable" || name === "createProbeLog" || name === "httpTarget" ? "function" : "async function"} ${name}`,
      );
    expect(clients).not.toContain("// @");
    // v2's stubs use a database and a topic only.
    const v2Clients = text(v2, "src/runtime/module-clients.ts");
    expect(v2Clients).toContain("export async function databaseClient(");
    expect(v2Clients).toContain("export async function queuePublisher(");
    expect(v2Clients).not.toContain("cacheClient");
    expect(v2Clients).not.toContain('from "redis"');
    // Off, nothing changes: no clients, no process files.
    expect(stackOff.files.map((file) => file.path)).not.toContain("src/runtime/module-clients.ts");
    expect(stackOff.files.map((file) => file.path)).not.toContain("src/runtime/postgres.ts");
    // A design whose only stub reads a bucket keeps only that section and its library.
    const bare = assemble(
      runStudioCommands(stubStackDesign(), [
        ...[
          "link-reader",
          "link-cache",
          "limiter",
          "visit-publisher",
          "redirector",
          "stats-caller",
          "upload-consumer",
          "stats-search",
          "archive-upload",
          "upload-publisher",
          "visit-consumer",
          "visit-writer",
        ].map((module) => ({ type: "removeModule", module }) as StudioCommand),
        on,
      ]),
    );
    const only = text(bare, "src/runtime/module-clients.ts");
    expect(only).toContain("export async function objectClient(");
    expect(only).not.toContain("databaseClient");
    expect(only).not.toContain("queuePublisher");
    expect(only).not.toContain("searchClient");
    const runtime = bare.files
      .map((file) => file.path)
      .filter((path) => path.includes("/runtime/"));
    expect(runtime).toContain("src/runtime/objects.ts");
    for (const library of ["postgres", "amqp", "search", "identity"])
      expect(runtime).not.toContain(`src/runtime/${library}.ts`);
  });

  it("reports what is provisioned for each process's stubs", () => {
    expect(
      stores(stack, "links-api").map((row) => `${row.store} ${row.access}: ${row.provisioned}`),
    ).toEqual([
      "links-cache read-write: Valkey cache-links-cache with its password",
      "links-db read-write: PostgreSQL database d_links_db, login r_links_db__links_api (CONNECT, USAGE on public; SELECT on published; its own tables in m_link_reader)",
      "uploaded consume: RabbitMQ work queue uploaded and its .failed",
      "visits publish: RabbitMQ exchange visits",
    ]);
    expect(
      stores(stack, "visit-worker").map((row) => `${row.store} ${row.access}: ${row.provisioned}`),
    ).toEqual([
      "archive read: Garage bucket archive, key s3-visit-worker (read)",
      "links-db read: PostgreSQL database d_links_db, login r_links_db__visit_worker (CONNECT, USAGE on public; SELECT on published)",
      "visits consume: RabbitMQ subscriber visits--visit-worker and its .failed",
    ]);
    expect(stores(stack, "stats-api")).toEqual([
      {
        store: "stats-index",
        name: "Stats index",
        kind: "search",
        access: "read",
        modules: ["stats-search"],
        provisioned: "OpenSearch search-stats-index (no index until a mapping is written)",
      },
    ]);
    expect(stores(stack, "upload-api").map((row) => row.modules)).toEqual([
      ["archive-upload"],
      ["upload-publisher"],
    ]);
  });
});

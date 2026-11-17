import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { pathToFileURL } from "node:url";
import { type DesignDocument, emptyDesign, type StudioCommand } from "@jeeves/spec";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { withStubWorkloads } from "../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import {
  stubStackDesign,
  stubStackWithCacheRead,
} from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import {
  moduleAuthored,
  runStudioCommands,
  tileLevelTwin,
} from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";
import { idempotencyMigration } from "./client-wiring.ts";

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
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
type Store = {
  store: string;
  kind: string;
  access: string;
  boundary?: string;
  modules: string[];
  provisioned?: string;
  unsupported?: string;
};
type Report = {
  processes: { runnable: boolean; tiles: { tile: string; stores: Store[] }[] };
};
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
  runStudioCommands(withStubWorkloads(stubStackDesign()), [
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
  const stack = assemble(runStudioCommands(withStubWorkloads(stubStackDesign()), [on]));
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
        productSql: {
          version: 1,
          file: "infra/postgres/links-db/products.json",
          namespaces: [{ schema: "m_link_reader", role: "pm_links_db_m_link_reader" }],
          bindings: [
            { host: "links-api", module: "link-reader", access: "read-write" },
            { host: "visit-worker", module: "visit-writer", access: "read" },
          ],
        },
        database: "d_links_db",
        owner: "o_links_db",
        secret: "owner-links-db",
        // A stub writes it, so it has the idempotency records too (QL04).
        migrations: [
          "infra/postgres/links-db/000-foundation.sql",
          "infra/postgres/links-db/050-jeeves-idempotency.sql",
          "infra/postgres/links-db/051-jeeves-local-operations.sql",
          "infra/postgres/links-db/052-jeeves-durable-work.sql",
        ],
        // Link reader writes it (Links API created it), so it has its own SQL file and schema.
        modules: [
          {
            module: "link-reader",
            host: "links-api",
            schema: "m_link_reader",
            file: "infra/postgres/links-db/products/migrations/m_link_reader/0001-initial.sql",
          },
        ],
      },
      {
        resource: "workload-issuer",
        database: "i_workload_issuer",
        owner: "io_workload_issuer",
        secret: "identity-owner-workload-issuer",
        migrations: ["infra/postgres/workload-issuer/000-foundation.sql"],
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
    // No template tables: CONNECT and USAGE on public (migrate.mjs), and only the writing tile's
    // grant on the idempotency records (QL04); the product step grants published and the
    // writer's own schema (products.mjs).
    expect(plan.grants).toEqual([
      {
        resource: "links-db",
        host: "links-api",
        schema: "jeeves",
        relation: "idempotency_records",
        kind: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      },
      {
        resource: "links-db",
        host: "links-api",
        schema: "jeeves",
        relation: "work_records",
        kind: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      },
      {
        resource: "links-db",
        host: "links-api",
        schema: "jeeves",
        relation: "work_tickets",
        kind: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      },
    ]);
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
      "identity-workload-issuer",
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
      "identity-owner-workload-issuer",
      "sql-links-db--links-api",
      "sql-links-db--visit-worker",
      "product-links-db--links-api",
      "product-links-db--visit-worker",
      "identity-workload-issuer",
    ]);
    // Each process gets its credentials and waits for each provider it uses, healthy.
    const needs = (name: string) => [
      Object.keys(compose[name]?.depends_on ?? {}),
      compose[name]?.secrets,
    ];
    expect(needs("app-links-api")).toEqual([
      ["cache-links-cache", "identity-workload-issuer", "local-broker", "local-postgres"],
      [
        "workload-jeeves-workload-links-api",
        "sql-links-db--links-api",
        "product-links-db--links-api",
        "cache-links-cache",
        "broker-password",
      ],
    ]);
    expect(needs("app-stats-api")).toEqual([
      ["identity-workload-issuer", "search-stats-index"],
      ["workload-jeeves-workload-stats-api"],
    ]);
    expect(needs("app-upload-api")).toEqual([
      ["local-broker", "local-objects"],
      ["s3-upload-api", "broker-password"],
    ]);
    expect(needs("app-visit-worker")).toEqual([
      ["local-broker", "local-objects", "local-postgres"],
      [
        "sql-links-db--visit-worker",
        "product-links-db--visit-worker",
        "s3-visit-worker",
        "broker-password",
      ],
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
      users: {
        host: string;
        access?: string;
        channel?: string;
        boundary?: string;
      }[];
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
      (
        json(wide, "infra/local.json").storage as {
          host: string;
          resource: string;
        }[]
      ).filter((item) => item.host === "visit-worker"),
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
          "PostgreSQL database d_view_counts, login r_view_counts__watch (CONNECT, USAGE on public; SELECT on its owner's template views counter_sum_public.totals; no declared product access; no product DDL or migration credential)",
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
    const design = runStudioCommands(withStubWorkloads(stubStackDesign()), [
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
    expect(plan.providers).toEqual(["identity-workload-issuer", "local-broker", "local-postgres"]);
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
        '    "product:links-db:link-reader": await productDatabaseClient(scope, probe, preparedProduct["product:links-db:link-reader"]),',
        '    "stats-api:stats-caller": serviceTarget({ tile: "stats-api", operations: ["stats-search"], forwardUser: false, credentials: workload }),',
        '    "visits": await queuePublisher(scope, probe, { queue: "visits", mode: "topic" }, brokerState(config.tile, failure, "broker publish visits")),',
        "  };",
      ].join("\n"),
    );
    // A module link calls the module it names, here a route stub with the caller's input.
    expect(links).toContain(
      '    linkReader: (input) => moduleCall(() => invokeLocalModule((LinkReaderModule as { localOperation?: unknown }).localOperation, dependencies["link-reader"], input, () => linkReader(dependencies["link-reader"], input as ModuleRequest))),',
    );
    expect(links).toContain('    statsApi: clients["stats-api:stats-caller"],');
    // A stub with no connected slot still gets its own settings (QL05).
    expect(links).toContain(
      '  dependencies["redirector"] = {\n    settings: configuredSettings["redirector"] as RedirectorDependencies["settings"],\n  };',
    );
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
    // An External API is an HTTP client at its base URL (QG20); an Identity no sign-in binds isn't
    // provisioned.
    expect(stats).toContain('    "partner": externalTarget("JEEVES_EXTERNAL_PARTNER_URL"),');
    expect(stats).toContain("requires a registered product capability binding");
    expect(stats).toContain(
      '    login: unavailable<GateDependencies["login"]>("Login for Gate (requires a registered product capability binding)"),',
    );
    const visits = text(wide, "src/processes/visit-worker.ts");
    expect(visits).toContain(
      '    visitWriter: () => moduleCall(() => visitWriter(dependencies["visit-writer"])),',
    );
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
      runStudioCommands(withStubWorkloads(stubStackDesign()), [
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
    for (const library of ["postgres", "transaction", "amqp", "search", "identity"])
      expect(runtime).not.toContain(`src/runtime/${library}.ts`);
  });

  it("gives a stub's cache the cache read's bounded client, valkey.ts, written once", () => {
    const owner = (bundle: Bundle) =>
      bundle.manifest.files
        .filter((file) => file.path === "src/runtime/valkey.ts")
        .map((file) => (file.owner === "assembler" ? file.owner : file.owner.id));
    const imports = 'import { createValkeyCache } from "./valkey.ts";';
    // Stubs alone: the runtime primitives write it for the cache client.
    expect(owner(stack)).toEqual(["local.primitives"]);
    expect(text(stack, "src/runtime/module-clients.ts")).toContain(imports);
    expect(text(stack, "src/runtime/module-clients.ts")).not.toContain('from "redis"');
    // Beside a cache read, its emitter writes it and the stubs' client uses the same file.
    const both = assemble(runStudioCommands(withStubWorkloads(stubStackWithCacheRead()), [on]));
    expect(owner(both)).toEqual(["local.positive-cache"]);
    expect(text(both, "src/runtime/module-clients.ts")).toContain(imports);
    expect(text(both, "src/runtime/valkey.ts")).toBe(text(stack, "src/runtime/valkey.ts"));
    // A cache read whose tile's stubs use no cache (v2) keeps its own; the stubs' clients
    // don't import it.
    expect(owner(v2)).toEqual(["local.positive-cache"]);
    expect(text(v2, "src/runtime/module-clients.ts")).not.toContain("valkey");
    // No stub cache and no cache read (the stub stack with processes off): none.
    expect(owner(stackOff)).toEqual([]);
  });

  it("gives a stub's database client transaction.ts, written once (QL03)", () => {
    const owner = (bundle: Bundle) =>
      bundle.manifest.files
        .filter((file) => file.path === "src/runtime/transaction.ts")
        .map((file) => (file.owner === "assembler" ? file.owner : file.owner.id));
    const imports =
      'import { assertTransaction, transaction, type TransactionPool } from "./transaction.ts";';
    const library = readFileSync(
      new URL(
        "../../templates/local-v2/assets/src/runtime/transaction.ts.template",
        import.meta.url,
      ),
      "utf8",
    );
    // Stubs alone: the runtime primitives write it for the database client.
    expect(owner(stack)).toEqual(["local.primitives"]);
    expect(text(stack, "src/runtime/module-clients.ts")).toContain(imports);
    expect(text(stack, "src/runtime/transaction.ts")).toBe(library);
    // Beside Favorites (v2), local.durability writes it, the same bytes, and the stubs' client
    // uses that file.
    expect(owner(v2)).toEqual(["local.durability"]);
    expect(text(v2, "src/runtime/module-clients.ts")).toContain(imports);
    expect(text(v2, "src/runtime/transaction.ts")).toBe(library);
    // Processes off (no stub client, no durable template): none.
    expect(owner(stackOff)).toEqual([]);
  });

  it("gives each database a stub writes the idempotency records, granted to its writing tiles only (QL04)", () => {
    const migration = "infra/postgres/links-db/050-jeeves-idempotency.sql";
    type Plan = {
      databases: { resource: string; migrations: string[] }[];
      grants: { resource: string; host: string; schema?: string }[];
      logins: { resource: string; host: string }[];
    };
    const plan = (bundle: Bundle) => json(bundle, "infra/local.json") as Plan;
    const jeeves = (bundle: Bundle) => plan(bundle).grants.filter((g) => g.schema === "jeeves");
    // Links API writes Links database; Visit worker only reads it.
    expect(text(stack, migration)).toBe(idempotencyMigration.sql);
    expect(text(stack, migration)).toContain(
      "CREATE TABLE IF NOT EXISTS jeeves.idempotency_records (tile text NOT NULL, scope_kind text NOT NULL, scope_id text NOT NULL, idem_key text NOT NULL, request_hash bytea NOT NULL, status integer NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY (tile, scope_kind, scope_id, idem_key));",
    );
    expect(stack.manifest.files.find((file) => file.path === migration)?.ownership).toBe(
      "generated-scaffold",
    );
    expect(plan(stack).databases.find((db) => db.resource === "links-db")?.migrations).toEqual([
      "infra/postgres/links-db/000-foundation.sql",
      migration,
      "infra/postgres/links-db/051-jeeves-local-operations.sql",
      "infra/postgres/links-db/052-jeeves-durable-work.sql",
    ]);
    expect(jeeves(stack)).toEqual([
      {
        resource: "links-db",
        host: "links-api",
        schema: "jeeves",
        relation: "idempotency_records",
        kind: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      },
      {
        resource: "links-db",
        host: "links-api",
        schema: "jeeves",
        relation: "work_records",
        kind: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      },
      {
        resource: "links-db",
        host: "links-api",
        schema: "jeeves",
        relation: "work_tickets",
        kind: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      },
    ]);
    // The stub rows still declare the logins, in their order.
    expect(plan(stack).logins.map((login) => `${login.resource} ${login.host}`)).toEqual([
      "links-db links-api",
      "links-db visit-worker",
    ]);
    // Its product SQL header lists no Jeeves table as a template's.
    expect(
      text(stack, "infra/postgres/links-db/products/migrations/m_link_reader/0001-initial.sql"),
    ).not.toContain("jeeves");
    // Two tiles that write it (one owner package): one migration, a grant for each.
    const shared = runStudioCommands(withStubWorkloads(stubStackDesign()), [on]);
    const studio = shared.architecture?.studio;
    studio?.packages.push({
      id: "links-team",
      name: "Links team",
      description: "",
      members: ["links-api", "visit-worker"],
    });
    const store = studio?.elements.find((row) => row.element === "links-db");
    if (store) store.owner = { kind: "package", id: "links-team" };
    const both = assemble(shared);
    expect(plan(both).databases.find((db) => db.resource === "links-db")?.migrations).toEqual([
      "infra/postgres/links-db/000-foundation.sql",
      migration,
      "infra/postgres/links-db/051-jeeves-local-operations.sql",
      "infra/postgres/links-db/052-jeeves-durable-work.sql",
    ]);
    expect(jeeves(both).map((grant) => grant.host)).toEqual([
      "links-api",
      "links-api",
      "links-api",
      "visit-worker",
      "visit-worker",
      "visit-worker",
    ]);
    // A design whose stubs only read a database (v2), or processes off: none.
    for (const bundle of [v2, stackOff]) {
      expect(bundle.files.some((file) => file.path.endsWith("/050-jeeves-idempotency.sql"))).toBe(
        false,
      );
      expect(jeeves(bundle)).toEqual([]);
    }
  });

  it("reports what is provisioned for each process's stubs", () => {
    expect(
      stores(stack, "links-api").map((row) => `${row.store} ${row.access}: ${row.provisioned}`),
    ).toEqual([
      "links-cache read-write: Valkey cache-links-cache with its password",
      "links-db read-write: PostgreSQL database d_links_db, login r_links_db__links_api (CONNECT, USAGE on public; no declared product access; its private replay and work records in jeeves.idempotency_records and jeeves.work_records; no product DDL or migration credential)",
      "uploaded consume: RabbitMQ work queue uploaded and its .failed",
      "visits publish: RabbitMQ exchange visits",
    ]);
    expect(
      stores(stack, "visit-worker").map((row) => `${row.store} ${row.access}: ${row.provisioned}`),
    ).toEqual([
      "archive read: Garage bucket archive, key s3-visit-worker (read)",
      "links-db read: PostgreSQL database d_links_db, login r_links_db__visit_worker (CONNECT, USAGE on public; no declared product access; no product DDL or migration credential)",
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

/** A plan fixture, QRWTY's Q03 probe or its saved design r83, as the regeneration proof exports it. */
const fixture = (name: string) =>
  assembleV2(
    {
      designJson: readFileSync(
        new URL(`../../../docs/plans/qrwty-gaps/fixtures/${name}`, import.meta.url),
        "utf8",
      ),
    },
    registry,
  );
/** API (a Service) whose Caller stub calls Partner API (an External API), and whose Token check, an
 * Auth guard no sign-in template leads, verifies tokens with it. */
const callsPartner = () =>
  runStudioCommands(emptyDesign(), [
    { type: "addAction", lane: "download", name: "Run", system: { name: "Calls" } },
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "api", name: "API", kind: "service" },
      linkId: "download-api",
    },
    tile("api", "partner", "Partner API", "external-api"),
    { type: "addModule", host: "api", kind: "external-call", id: "caller", name: "Caller" },
    { type: "connectModule", module: "caller", slot: "target", target: { tile: "partner" } },
    { type: "addModule", host: "api", kind: "auth-guard", id: "token-check", name: "Token check" },
    {
      type: "connectModule",
      module: "token-check",
      slot: "identity",
      target: { tile: "partner" },
    },
    on,
  ]);

describe("External API and Identity tiles give stubs a configured HTTP client (QG20)", () => {
  const probe = fixture("probe-design.json");

  it("gives the probe's Probe externalTarget for Provider and the marked identityTarget for Identity", () => {
    expect(probe.report.findings).toEqual([]);
    const front = text(probe, "src/processes/front.ts");
    expect(front).toContain(
      [
        "  const clients = {",
        '    "events": await queuePublisher(scope, probe, { queue: "events", mode: "work-queue" }, brokerState(config.tile, failure, "broker publish events")),',
        '    "hot": await cacheClient(scope, probe, { cache: "hot" }),',
        '    "identity": identityTarget({ identity: "identity" }),',
        '    "product:store:front-internal-grant": await productDatabaseClient(scope, probe, preparedProduct["product:store:front-internal-grant"]),',
        '    "product:store:front-probe": await productDatabaseClient(scope, probe, preparedProduct["product:store:front-probe"]),',
        '    "provider": externalTarget("JEEVES_EXTERNAL_PROVIDER_URL"),',
        "  };",
      ].join("\n"),
    );
    expect(front).toContain(
      '    provider: unavailable<FrontProbeDependencies["provider"]>("Provider for Probe (requires a registered product capability binding)"),\n    identity: unavailable<FrontProbeDependencies["identity"]>("Identity for Probe (requires a registered product capability binding)"),\n',
    );
    expect(front).toContain(
      'import { brokerBinding, cacheClient, cacheClientEndpoint, checkConfiguration, createProbeLog, databaseEndpoint, externalTarget, identityTarget, prepareProductDatabase, productDatabaseClient, queuePublisher, unavailable } from "../runtime/module-clients.ts";',
    );
    expect(front).toContain("requires a registered product capability binding");
    // Neither has a probe: each is built before the sign-in and the service, and reads its URL then.
    expect(front.indexOf("identityTarget(")).toBeLessThan(front.indexOf("createTileGuard({"));
    const clients = text(probe, "src/runtime/module-clients.ts");
    for (const name of ["httpTarget", "externalTarget", "identityTarget"])
      expect(clients).toContain(`export function ${name}(`);
    expect(clients).not.toContain("// @");
  });

  it("checks every variable the probe's clients and Front's sign-in read in one pass, before the first probe (QG31)", () => {
    const front = text(probe, "src/processes/front.ts");
    expect(front).toContain(
      [
        "  // Configuration: every variable these clients, the tile's sign-in and its stubs' settings read,",
        "  // checked before any client is built or probed; one wrong setting fails startup naming it,",
        "  // several are named together (a stub's first).",
        "  checkConfiguration([",
        "    () => brokerBinding(),",
        '    () => cacheClientEndpoint("hot"),',
        '    () => identityTarget({ identity: "identity" }),',
        '    () => databaseEndpoint("store"),',
        '    () => externalTarget("JEEVES_EXTERNAL_PROVIDER_URL"),',
        '    () => readSecret("broker-password"),',
        '    () => readSecret("cache-hot"),',
        '    () => readSecret("product-store--front"),',
        '    () => readSecret("sql-store--front"),',
        "    () => signInSettings(),",
        // Then each stub's declared settings (QL05).
        '    () => configuredSettings["front-probe"] = readModuleSettings("front-probe", declared["front-probe"]),',
        '    () => configuredSettings["front-internal-grant"] = readModuleSettings("front-internal-grant", declared["front-internal-grant"]),',
        "  ]);",
        "  signInSettings();",
        "  validateTemplateSettings(config.tile);",
        "  // Module clients (src/runtime/module-clients.ts): one per store or channel this tile's stubs",
        "  // use, each probed once before the process is ready; a failed probe fails startup, except",
        "  // a cache's, which is logged.",
        "  const probe = createProbeLog(config.tile);",
      ].join("\n"),
    );
    expect(front).toContain(
      'import { createTileGuard, signInSettings } from "../runtime/tile-guard.ts";',
    );
    // The pass comes before every client, its probe and the sign-in, which read theirs again.
    const pass = front.indexOf("checkConfiguration([");
    for (const later of [
      "await queuePublisher(",
      "createTileGuard({",
      "const settings = signInSettings();",
    ])
      expect(pass, later).toBeLessThan(front.indexOf(later));
    // Each credential Compose's `secrets` gives the service is read in the pass too (QG35).
    expect(front).toContain('import { readSecret } from "../runtime/local.ts";');
    // Tally's: its database's endpoint, then its RabbitMQ loop's broker, then their credentials; no
    // sign-in.
    const tally = text(probe, "src/processes/tally.ts");
    expect(tally).toContain(
      [
        "  checkConfiguration([",
        '    () => databaseEndpoint("tally-db"),',
        "    () => brokerBinding(),",
        '    () => readSecret("broker-password"),',
        '    () => readSecret("product-tally-db--tally"),',
        '    () => readSecret("sql-tally-db--tally"),',
        '    () => configuredSettings["tally-count"] = readModuleSettings("tally-count", declared["tally-count"]),',
        "  ]);",
        "  // Module clients",
      ].join("\n"),
    );
    expect(tally).toContain(
      'import { brokerBinding, checkConfiguration, createProbeLog, databaseEndpoint, prepareProductDatabase, productDatabaseClient } from "../runtime/module-clients.ts";',
    );
    expect(tally).not.toContain("signInSettings");
    const clients = text(probe, "src/runtime/module-clients.ts");
    for (const name of ["checkConfiguration", "databaseEndpoint", "cacheClientEndpoint"])
      expect(clients).toContain(`export function ${name}(`);
    // In both fixtures every process is a stub tile's, so its pass reads exactly the credentials
    // Compose's `secrets` gives its service, each once, sorted (QG35).
    for (const bundle of [probe, fixture("qrwty-r83.json")]) {
      const services = json(bundle, "compose.yaml").services as Record<
        string,
        { secrets?: string[] }
      >;
      const files = bundle.files.filter((file) => file.path.startsWith("src/processes/"));
      expect(files.length).toBeGreaterThan(1);
      for (const { path } of files) {
        const tile = path.slice("src/processes/".length, -".ts".length);
        const read = [...text(bundle, path).matchAll(/\(\) => readSecret\("([^"]+)"\),/g)].map(
          (match) => match[1],
        );
        expect(read, path).toEqual([...(services[`app-${tile}`]?.secrets ?? [])].sort());
        expect(read.length, path).toBeGreaterThan(0);
      }
    }
  });

  it("reads each stub's declared settings last in the pass and gives them to its dependencies (QL05)", () => {
    const front = text(probe, "src/processes/front.ts");
    // Each stub's file is imported whole, so one without a `settings` export still builds.
    for (const line of [
      'import * as FrontProbeModule from "../modules/front/front-probe.ts";',
      'import * as FrontInternalGrantModule from "../modules/front/front-internal-grant.ts";',
      'import { type SettingsDeclaration, type SettingsOf, createSettingsReader, declareSettings } from "../runtime/settings.ts";',
    ])
      expect(front).toContain(`\n${line}\n`);
    expect(front.indexOf("import * as FrontProbeModule")).toBeLessThan(
      front.indexOf("import { frontProbe }"),
    );
    expect(front).toContain(
      [
        "  // Each stub's own settings: what its file's `settings` export declares (none without one).",
        "  const declared = {",
        '    "front-probe": (FrontProbeModule as { settings?: SettingsDeclaration }).settings ?? declareSettings({}),',
        '    "front-internal-grant": (FrontInternalGrantModule as { settings?: SettingsDeclaration }).settings ?? declareSettings({}),',
        "  };",
        "  const readModuleSettings = createSettingsReader();",
        "  const configuredSettings = {} as { [Name in keyof typeof declared]: SettingsOf<(typeof declared)[Name]> };",
        '  validateDurableWorkBinding((FrontProbeModule as { durableWork?: unknown }).durableWork, ["store"], []);',
        '  validateLocalOperationBinding((FrontProbeModule as { localOperation?: unknown }).localOperation, ["store"], { workload: false, requiredUser: false });',
        '  validateDurableWorkBinding((FrontInternalGrantModule as { durableWork?: unknown }).durableWork, ["store"], []);',
        '  validateLocalOperationBinding((FrontInternalGrantModule as { localOperation?: unknown }).localOperation, ["store"], { workload: false, requiredUser: false });',
        "  // Prepare all registered SQL and product credentials before any connection or probe.",
      ].join("\n"),
    );
    // Read once in the pass, before any client opens; dependencies receive the captured value.
    const pass = front.indexOf(
      '    () => configuredSettings["front-probe"] = readModuleSettings("front-probe", declared["front-probe"]),',
    );
    expect(pass).toBeGreaterThan(front.indexOf("    () => signInSettings(),"));
    for (const later of [
      "await queuePublisher(",
      "await productDatabaseClient(",
      "createTileGuard({",
    ])
      expect(pass, later).toBeLessThan(front.indexOf(later));
    expect(front).toContain(
      '    identity: unavailable<FrontProbeDependencies["identity"]>("Identity for Probe (requires a registered product capability binding)"),\n    settings: configuredSettings["front-probe"] as FrontProbeDependencies["settings"],\n  };',
    );
    expect(front.match(/readModuleSettings\(/g)).toHaveLength(2);
    expect(front.match(/createSettingsReader\(/g)).toHaveLength(1);
    // The report names each stub file a process reads settings from; Compose sets none of them.
    const rows = (probe.report as unknown as Report).processes.tiles as unknown as {
      tile: string;
      stubSettings?: unknown;
    }[];
    expect(rows.map((row) => [row.tile, row.stubSettings])).toEqual([
      [
        "front",
        [
          { module: "front-probe", file: "src/modules/front/front-probe.ts" },
          {
            module: "front-internal-grant",
            file: "src/modules/front/front-internal-grant.ts",
          },
        ],
      ],
      ["tally", [{ module: "tally-count", file: "src/modules/tally/tally-count.ts" }]],
    ]);
    expect(text(probe, "compose.yaml")).not.toContain("PROBE_");
    expect(text(probe, "README.md")).toContain(
      "its process reads them in its configuration pass, before any client is built or probed, and gives the same frozen values to the stub as `dependencies.settings` (rings yield purpose-bound handles, never raw keys): a missing or invalid one fails startup with `Invalid setting <NAME>`, never its value. `compose.yaml` sets none of them:",
    );
  });

  it("sets the Identity's address inside the network for a stub tile that calls it, and no External API URL in Compose", () => {
    type Service = {
      environment?: Record<string, string>;
      depends_on?: Record<string, unknown>;
    };
    const composed = (bundle: Bundle) =>
      json(bundle, "compose.yaml").services as Record<string, Service>;
    // Front's sign-in reads OIDC_ISSUER, the browser's issuer, which a container can't reach
    // (QG20's proof); its stub's client reads Keycloak's address inside the network (QGR2). Nothing
    // reads JEEVES_EXTERNAL_PROVIDER_URL from compose.yaml: it is the application's
    // (compose.override.yaml), so startup fails until set.
    const front = composed(probe)["app-front"]?.environment ?? {};
    expect(front.OIDC_ISSUER).toMatch(
      /^http:\/\/127\.0\.0\.1:\$\{LOCAL_IDENTITY_PORT:\?Set LOCAL_IDENTITY_PORT\}\/realms\/identity$/,
    );
    expect(front.JEEVES_IDENTITY_IDENTITY_URL).toBe("http://identity-identity:8080");
    expect(Object.keys(front).filter((name) => name.startsWith("JEEVES_EXTERNAL_"))).toEqual([]);
    // r83's Session API has no sign-in; its stubs call the Identity, so it reads the Identity's
    // address only (no OIDC_* at all) and waits for no Identity service.
    const r83 = fixture("qrwty-r83.json");
    const services = composed(r83);
    const session = services["app-session-api"] ?? {};
    expect(
      Object.keys(session.environment ?? {}).filter((name) => name.startsWith("OIDC_")),
    ).toEqual([]);
    expect(session.environment?.JEEVES_IDENTITY_IDENTITY_URL).toBe("http://identity-identity:8080");
    expect(services["app-account-api"]?.environment).not.toHaveProperty(
      "JEEVES_IDENTITY_IDENTITY_URL",
    );
    expect(Object.keys(session.depends_on ?? {})).toEqual(["local-postgres"]);
    expect(text(r83, "src/processes/session-api.ts")).toContain(
      '    "identity": identityTarget({ identity: "identity" }),',
    );
    for (const [process, variable] of [
      ["billing-api", "JEEVES_EXTERNAL_STRIPE_API_URL"],
      ["link-api", "JEEVES_EXTERNAL_REPUTATION_API_URL"],
    ])
      expect(text(r83, `src/processes/${process}.ts`)).toContain(`externalTarget("${variable}")`);
    for (const service of Object.values(services))
      expect(
        Object.keys(service.environment ?? {}).filter((name) =>
          name.startsWith("JEEVES_EXTERNAL_"),
        ),
      ).toEqual([]);
    // The report lists the Identity's variable as Compose sets it, and no OIDC_* for Session API.
    const row = (tile: string) =>
      processes(r83).tiles.find((item) => item.tile === tile) as unknown as {
        environment: string[];
      };
    const session83 = row("session-api");
    expect(session83.environment).toContain("JEEVES_IDENTITY_IDENTITY_URL");
    expect(session83.environment.filter((name) => name.startsWith("OIDC_"))).toEqual([]);
    // And an External API's URL with the process that reads it, which Compose doesn't set (QG26).
    expect(row("billing-api").environment).toContain("JEEVES_EXTERNAL_STRIPE_API_URL");
    expect(services["app-billing-api"]?.environment).not.toHaveProperty(
      "JEEVES_EXTERNAL_STRIPE_API_URL",
    );
  });

  it("reports each client's base URL in the stores rows, and the README names the URLs to set", () => {
    expect(
      stores(probe, "front")
        .filter((row) => row.kind !== "database")
        .slice(-2),
    ).toEqual([
      {
        store: "identity",
        name: "Identity",
        kind: "identity",
        access: "request",
        modules: ["front-probe"],
        provisioned:
          "HTTP client at JEEVES_IDENTITY_IDENTITY_URL, the Identity's base URL as the process reaches it (locally Keycloak identity-identity inside the network, realm identity); a failed call waits as an unreachable store's does",
      },
      {
        store: "provider",
        name: "Provider",
        kind: "external-api",
        access: "request",
        modules: ["front-probe"],
        provisioned:
          "HTTP client at JEEVES_EXTERNAL_PROVIDER_URL, which the application sets (compose.yaml doesn't, so startup fails until it is set); a failed call keeps the normal retries",
      },
    ]);
    const readme = text(probe, "README.md");
    for (const phrase of [
      "Each External API its stubs call is at `JEEVES_EXTERNAL_<ID>_URL`, by the same URL rule, which `compose.yaml` doesn't set",
      "until it is set the process fails startup with `Invalid endpoint JEEVES_EXTERNAL_<ID>_URL`. A failed call to an External API keeps a loop's normal retries.",
      "A process whose stubs call the Identity reads `JEEVES_IDENTITY_<ID>_URL`, the Identity's base URL as the process reaches it",
      // Locally the browser's issuer is unreachable from a container (QG20's proof), so the base
      // is Keycloak's address inside the network (QGR2).
      "`compose.yaml` sets Keycloak's address inside the network, `http://identity-<id>:8080`",
      "A sign-in's `OIDC_ISSUER` is what tokens carry, which a container can't reach locally, so it isn't the client's base.",
      "a `JEEVES_TILE_<ID>_URL`, `JEEVES_EXTERNAL_<ID>_URL`, `JEEVES_IDENTITY_<ID>_URL`, `OIDC_ISSUER` or `OIDC_JWKS_URL` that isn't `https:`",
    ])
      expect(readme).toContain(phrase);
    // Which process reads which URL is in the per-process list (QG26), not a sentence of its own.
    expect(readme).toMatch(/\n- `app-front`: [^\n]*`JEEVES_EXTERNAL_PROVIDER_URL`/);
    expect(readme).not.toContain("Here `app-front` reads");
    expect(readme).not.toContain("which a container can't reach, so locally such a call fails");
    // A design whose stubs call neither keeps its README as it was.
    const stack = assemble(runStudioCommands(withStubWorkloads(stubStackDesign()), [on]));
    expect(text(stack, "README.md")).not.toContain("JEEVES_EXTERNAL_");
    expect(text(stack, "README.md")).not.toContain("JEEVES_IDENTITY_");
    expect(stores(stack, "links-api").map((row) => row.kind)).not.toContain("external-api");
  });

  it("keeps unavailable for a token check and an Identity no sign-in binds", () => {
    const bundle = assemble(callsPartner());
    const api = text(bundle, "src/processes/api.ts");
    expect(api).toContain('    "partner": externalTarget("JEEVES_EXTERNAL_PARTNER_URL"),');
    // Token check's link verifies a token (a TokenVerifier), not an HTTP target.
    expect(api).toContain(
      '    partner: unavailable<TokenCheckDependencies["partner"]>("Partner API for Token check (requires a registered product capability binding)"),',
    );
    expect(stores(bundle, "api").map((row) => [row.store, row.modules])).toEqual([
      ["partner", ["caller"]],
    ]);
    // wider(): Gate's Login has no sign-in, so it isn't provisioned; nor is its address set.
    const wide = assemble(wider());
    expect(text(wide, "src/processes/stats-api.ts")).toContain(
      '    login: unavailable<GateDependencies["login"]>("Login for Gate (requires a registered product capability binding)"),',
    );
    expect(services(wide)["app-stats-api"]).not.toHaveProperty("environment.OIDC_ISSUER");
    expect(services(wide)["app-stats-api"]).not.toHaveProperty(
      "environment.JEEVES_IDENTITY_LOGIN_URL",
    );
    expect(stores(wide, "stats-api").map((row) => row.store)).toEqual(["stats-index", "partner"]);
  });
});

// The emitted API process of `callsPartner`, run with its relative imports resolved to the other
// emitted files and Fastify from the Jeeves server (the version the export pins), whose `listen`
// only readies the app. Caller's body is the application's: it calls Partner API and answers its
// status, bounding the call with its own signal.
describe("a process whose stub calls an External API (QG20)", () => {
  const bundle = assemble(callsPartner());
  const sources = new Map(
    bundle.files.map((file) => [file.path, new TextDecoder().decode(file.bytes)]),
  );
  // Caller declares one optional setting (QL05).
  sources.set(
    "src/modules/api/caller.ts",
    [
      'import { declareSettings, integer, optional } from "../../runtime/settings.ts";',
      "export const settings = declareSettings({ CALLER_LIMIT: optional(integer({ min: 1, max: 100 })) });",
      "export async function caller(dependencies, request) {",
      '  const response = await dependencies.partner.request("/v1/charges?limit=1", {',
      "    signal: AbortSignal.timeout(1000),",
      "  });",
      "  return { body: { status: response.status, limit: dependencies.settings.CALLER_LIMIT } };",
      "}",
    ].join("\n"),
  );
  // Token check's body is an older one, written before QL05: it has no `settings` export.
  sources.set(
    "src/modules/api/token-check.ts",
    [
      "export async function tokenCheck(dependencies, request) {",
      '  throw new Error("Not implemented: Token check");',
      "}",
    ].join("\n"),
  );
  const markerDirectory = mkdtempSync(join(tmpdir(), "jeeves-external-"));
  const serverRequire = createRequire(
    new URL("../../../jeeves/apps/server/package.json", import.meta.url),
  );
  const fastify =
    dataUrl(`import fastify from ${JSON.stringify(pathToFileURL(serverRequire.resolve("fastify")).href)};
export const apps = [];
export default function Fastify(options) {
  const app = fastify(options);
  app.listen = async () => { await app.ready(); apps.push(app); return "http://injected"; };
  return app;
}`);
  const urls = new Map<string, string>();
  const compile = (path: string): string => {
    const source = sources.get(path);
    if (source === undefined) throw new Error(`Missing ${path}`);
    return stripTypeScriptTypes(source)
      .replace(
        /from "(\.\.?\/[^"]+)"/g,
        (_match, relative: string) => `from "${load(posix.join(posix.dirname(path), relative))}"`,
      )
      .replace('from "fastify"', `from "${fastify}"`)
      .replace('"/tmp/application-ready"', JSON.stringify(join(markerDirectory, "ready")));
  };
  const load = (path: string): string => {
    const old = urls.get(path);
    if (old) return old;
    const url = dataUrl(compile(path));
    urls.set(path, url);
    return url;
  };
  const signals = ["SIGTERM", "SIGINT"] as const;
  const listening = Object.fromEntries(signals.map((name) => [name, process.listeners(name)]));
  const exitCode = process.exitCode;
  const dropListeners = () => {
    for (const name of signals)
      for (const listener of process.listeners(name))
        if (!listening[name]?.includes(listener)) process.removeListener(name, listener);
  };
  const names = ["JEEVES_EXTERNAL_PARTNER_URL", "JEEVES_REQUIRE_TLS", "CALLER_LIMIT"] as const;
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  afterEach(() => {
    for (const name of names)
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    dropListeners();
    process.exitCode = exitCode;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  afterAll(() => rmSync(markerDirectory, { recursive: true, force: true }));
  type App = {
    inject(request: unknown): Promise<{ statusCode: number; json(): unknown }>;
  };
  let runs = 0;
  /** Starts the process with `values` set (undefined unsets one), keeping its console lines. */
  async function run(values: Partial<Record<(typeof names)[number], string | undefined>>) {
    for (const [name, value] of Object.entries(values))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    const lines: unknown[] = [];
    const keep = (line: string) => lines.push(line.startsWith("{") ? JSON.parse(line) : line);
    vi.spyOn(console, "log").mockImplementation(keep);
    vi.spyOn(console, "error").mockImplementation(keep);
    const { apps } = (await import(fastify)) as { apps: App[] };
    const before = apps.length;
    process.exitCode = undefined;
    dropListeners();
    runs += 1;
    await import(dataUrl(`${compile("src/processes/api.ts")}\n// run ${runs}\n`));
    return { lines, app: apps.length > before ? apps.at(-1) : undefined };
  }
  const failed = (error: string) => [
    { level: "error", event: "startup-failed", error: `Error: ${error}` },
    "Application startup failed",
    ...["drain-started", "admission-stopped", "operations-cancelled", "drain-completed"].map(
      (event) => ({ level: "info", event }),
    ),
  ];

  it("fails startup naming JEEVES_EXTERNAL_<ID>_URL until it is set, never its value", async () => {
    for (const value of [
      undefined,
      "",
      "ftp://partner.example",
      "https://partner.example/?key=1",
    ]) {
      const { lines, app } = await run({ JEEVES_EXTERNAL_PARTNER_URL: value });
      expect(lines).toEqual(failed("Invalid endpoint JEEVES_EXTERNAL_PARTNER_URL"));
      expect(process.exitCode).toBe(1);
      expect(app === undefined).toBe(true);
      if (value) expect(JSON.stringify(lines)).not.toContain(value);
    }
    process.env.JEEVES_REQUIRE_TLS = "true";
    const { lines } = await run({ JEEVES_EXTERNAL_PARTNER_URL: "http://partner.example" });
    expect(lines).toEqual(failed("Insecure endpoint JEEVES_EXTERNAL_PARTNER_URL"));
  });

  it("keeps arbitrary external calls unavailable to guarded Custom code", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 418 }));
    vi.stubGlobal("fetch", fetch);
    const { lines, app } = await run({ JEEVES_EXTERNAL_PARTNER_URL: "http://127.0.0.1:47999" });
    expect(lines).toContain("Application ready");
    if (!app) throw new Error("The process did not start");
    const response = await app.inject({ method: "GET", url: "/modules/caller" });
    expect([response.statusCode, response.json()]).toEqual([
      501,
      {
        error: "NOT_IMPLEMENTED",
        message: "Not implemented.",
      },
    ]);
    expect(fetch).not.toHaveBeenCalled();
    expect((await app.inject({ method: "GET", url: "/modules/token-check" })).statusCode).toBe(501);
    const stop = process.listeners("SIGTERM").at(-1);
    if (!stop || listening.SIGTERM?.includes(stop)) throw new Error("No process runs");
    process.removeListener("SIGTERM", stop);
    stop("SIGTERM");
    await vi.waitFor(() => expect(process.exitCode).toBe(0));
  });

  it("fails startup naming a stub's invalid setting in the pass, never its value, and hands a valid one to the stub (QL05)", async () => {
    for (const value of ["0", "1000", "7.5", " 7", "seven"]) {
      const { lines, app } = await run({
        JEEVES_EXTERNAL_PARTNER_URL: "http://127.0.0.1:47999",
        CALLER_LIMIT: value,
      });
      expect(lines, value).toEqual(failed("Invalid setting CALLER_LIMIT"));
      expect(app === undefined).toBe(true);
      if (value.trim().length > 1) expect(JSON.stringify(lines)).not.toContain(value.trim());
    }
    // Named together with an endpoint, in the pass's order: the setting comes last.
    const both = await run({
      JEEVES_EXTERNAL_PARTNER_URL: undefined,
      CALLER_LIMIT: "0",
    });
    expect(both.lines).toEqual(
      failed(
        "Invalid configuration: Invalid endpoint JEEVES_EXTERNAL_PARTNER_URL; Invalid setting CALLER_LIMIT",
      ),
    );
    const fetch = vi.fn(async () => new Response(null, { status: 418 }));
    vi.stubGlobal("fetch", fetch);
    const { lines, app } = await run({
      JEEVES_EXTERNAL_PARTNER_URL: "http://127.0.0.1:47999",
      CALLER_LIMIT: "7",
    });
    expect(lines).toContain("Application ready");
    if (!app) throw new Error("The process did not start");
    const response = await app.inject({
      method: "GET",
      url: "/modules/caller",
    });
    expect([response.statusCode, response.json()]).toEqual([
      501,
      {
        error: "NOT_IMPLEMENTED",
        message: "Not implemented.",
      },
    ]);
    expect(fetch).not.toHaveBeenCalled();
    // Token check's older body, with no `settings` export, still runs and answers Not implemented.
    expect((await app.inject({ method: "GET", url: "/modules/token-check" })).statusCode).toBe(501);
    const stop = process.listeners("SIGTERM").at(-1);
    if (!stop || listening.SIGTERM?.includes(stop)) throw new Error("No process runs");
    process.removeListener("SIGTERM", stop);
    stop("SIGTERM");
    await vi.waitFor(() => expect(process.exitCode).toBe(0));
  });
});

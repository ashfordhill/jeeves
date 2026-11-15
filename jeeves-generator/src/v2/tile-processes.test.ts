import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type DesignDocument,
  designSchema,
  emptyDesign,
  generationExportBlockers,
  type StudioCommand,
} from "@jeeves/spec";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  stubStackDesign,
  stubStackWithCacheRead,
} from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import {
  moduleAuthored,
  runStudioCommands,
  tileLevelTwin,
} from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Dependencies, loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const on: StudioCommand = { type: "setRunnableProcesses", on: true };
const assemble = (design: DesignDocument, host = registry) =>
  assembleV2({ designJson: canonicalJson(design) }, host);
type Bundle = ReturnType<typeof assemble>;
const text = (bundle: Bundle, path: string) => {
  const file = bundle.files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
type Row = {
  tile: string;
  service: string;
  shape: string;
  exposure?: string;
  entry: string;
  settings: { setting: string; value: number; origin: string; selection?: string }[];
  routes: { method: string; path: string }[];
  loops: unknown[];
};
const processesOf = (bundle: Bundle) =>
  (bundle.report as { processes?: { runnable: boolean; tiles: Row[] } }).processes;
/** A Worker with one module that consumes nothing: a library stub, so the process idles. */
const emptyWorker = () =>
  runStudioCommands(emptyDesign(), [
    { type: "addAction", lane: "download", name: "Run", system: { name: "Idle" } },
    {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "api", name: "API", kind: "service" },
      linkId: "download-api",
    },
    {
      type: "addTile",
      from: { tile: "api" },
      side: "after",
      tile: { id: "jobs", name: "Jobs", kind: "queue" },
      linkId: "api-jobs",
    },
    {
      type: "addTile",
      from: { tile: "jobs" },
      side: "after",
      tile: { id: "idle", name: "Idle", kind: "worker" },
      linkId: "jobs-idle",
    },
    { type: "addModule", host: "idle", kind: "custom", name: "Thing" },
  ]);

describe("local.tile-processes", () => {
  const off = assemble(stubStackDesign());
  const bundle = assemble(runStudioCommands(stubStackDesign(), [on]));

  it("installs processes in the application registry only", () => {
    expect(registry.installed.processes).toBe(true);
    expect(loadLocalV2Dependencies().installed.processes).toBeUndefined();
    expect(registry.emitters.map((emitter) => emitter.id)).toContain("local.tile-processes");
  });

  it("adds an entry point per application tile and the libraries a process needs", () => {
    const paths = (b: Bundle) => b.files.map((file) => file.path);
    expect(paths(bundle).filter((path) => !paths(off).includes(path))).toEqual([
      "infra/edge/nginx.conf",
      "infra/postgres/links-db/000-foundation.sql",
      "infra/postgres/links-db/modules/link-reader.sql",
      "scripts/products.mjs",
      "src/modules/entry.ts",
      "src/processes/links-api.ts",
      "src/processes/stats-api.ts",
      "src/processes/upload-api.ts",
      "src/processes/visit-worker.ts",
      "src/runtime/admission.ts",
      "src/runtime/amqp.ts",
      "src/runtime/delivery.ts",
      "src/runtime/http.ts",
      "src/runtime/module-clients.ts",
      "src/runtime/objects.ts",
      "src/runtime/postgres.ts",
      "src/runtime/process.ts",
      "src/runtime/search.ts",
      "src/runtime/tile-http.ts",
      "src/runtime/tile-loop.ts",
      "src/runtime/tile-process.ts",
      // The stubs' cache (Links cache) uses the cache read's bounded client.
      "src/runtime/valkey.ts",
    ]);
    expect(paths(off).filter((path) => !paths(bundle).includes(path))).toEqual([]);
    const http = text(bundle, "src/processes/links-api.ts");
    expect(http).toContain(
      "// Generated scaffold: Links API (Microservice) runs as app-links-api, an HTTP process.",
    );
    expect(http).toContain('import { createHttpService } from "../runtime/http.ts";');
    expect(http).toContain('"exposure": "public"');
    expect(http).toContain('"requestTimeoutMs": 1000');
    expect(http).toContain('"port": 3000');
    expect(http).toContain("scope.own(() => service.close());");
    expect(http).toContain("scope.ready();");
    // A worker runs its loops (loop-wiring.test.ts); one with nothing to run holds a timer.
    const worker = text(bundle, "src/processes/visit-worker.ts");
    expect(worker).not.toContain("createHttpService");
    expect(worker).toContain("await startModuleLoop(scope, loopLog, config.loops[0], (message) =>");
    const idle = text(assemble(runStudioCommands(emptyWorker(), [on])), "src/processes/idle.ts");
    expect(idle).toContain("const idle = setInterval(() => {}, 2 ** 30);");
    expect(idle).toContain("scope.own(() => clearInterval(idle));");
    expect(idle).not.toContain("loopLog");
  });

  it("gives every process one failure log, and passes it to the HTTP service", () => {
    const http = text(bundle, "src/processes/links-api.ts");
    expect(http).toMatch(
      /import \{[^}]*createFailureLog[^}]*\} from "\.\.\/runtime\/tile-process\.ts";/,
    );
    expect(http).toContain("  const failure = createFailureLog(config.tile);");
    expect(http).toContain("    onFailure: failure,");
    const worker = text(bundle, "src/processes/visit-worker.ts");
    expect(worker).toContain("  const failure = createFailureLog(config.tile);");
    expect(worker).not.toContain("onFailure: failure");
  });

  it("composes one healthy-on-marker service per tile, with no restart policy or ports", () => {
    const compose = JSON.parse(text(bundle, "compose.yaml")) as {
      services: Record<string, Record<string, unknown>>;
    };
    expect(Object.keys(compose.services)).toEqual([
      "app-edge",
      "app-links-api",
      "app-stats-api",
      "app-upload-api",
      "app-visit-worker",
      "cache-links-cache",
      "local-broker",
      "local-objects",
      "local-postgres",
      "search-stats-index",
      "setup-broker",
      "setup-migrate",
    ]);
    // Each process depends on the providers of the stores its stubs use (client-wiring.test.ts).
    const healthy = (...names: string[]) =>
      Object.fromEntries(names.map((name) => [name, { condition: "service_healthy" }]));
    const providers: Record<string, object> = {
      "app-links-api": healthy("cache-links-cache", "local-broker", "local-postgres"),
      "app-stats-api": healthy("search-stats-index"),
      "app-upload-api": healthy("local-broker", "local-objects"),
      "app-visit-worker": healthy("local-broker", "local-objects", "local-postgres"),
    };
    for (const [name, service] of Object.entries(compose.services)) {
      if (name === "app-edge" || !name.startsWith("app-")) continue;
      expect(service.command).toEqual(["node", `dist/processes/${name.slice(4)}.js`]);
      expect(service.profiles).toEqual(["application"]);
      expect(service.init).toBe(true);
      expect(service.depends_on).toEqual(providers[name]);
      expect(service).not.toHaveProperty("restart");
      expect(service).not.toHaveProperty("ports");
      expect((service.healthcheck as { test: string[] }).test.at(-1)).toContain(
        "/tmp/application-ready",
      );
    }
    // The edge starts with the processes, after the providers.
    const plan = JSON.parse(text(bundle, "infra/local.json"));
    expect(plan.application).toEqual(
      Object.keys(compose.services).filter((name) => name.startsWith("app-")),
    );
    expect(plan.providers).toEqual([
      "cache-links-cache",
      "local-broker",
      "local-objects",
      "local-postgres",
      "search-stats-index",
    ]);
    const record = bundle.manifest.files.find((file) => file.path === "compose.yaml");
    expect(record?.contributors.map((item) => item.emitter.id)).toContain("local.tile-processes");
  });

  it("gates first-run and start on report.processes.runnable", () => {
    const gate = text(bundle, "scripts/local.mjs");
    expect(gate).toContain(
      '!JSON.parse(readFileSync(".jeeves/report.json", "utf8")).processes?.runnable\n',
    );
    expect(gate).not.toContain("applicationComplete");
    expect(text(off, "scripts/local.mjs")).toContain(").applicationComplete\n");
    expect(text(bundle, "README.md")).toContain("Runnable processes: each application tile");
    expect(text(off, "README.md")).not.toContain("Runnable processes");
  });

  it("reports each process, closes the services gap and records the option", () => {
    expect(bundle.report.findings).toEqual([]);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(bundle.report.gaps.map((gap) => gap.id)).not.toContain("application-services");
    expect(off.report.gaps.map((gap) => gap.id)).toContain("application-services");
    const processes = processesOf(bundle);
    expect(processes?.runnable).toBe(true);
    expect(
      processes?.tiles.map((row) => [row.tile, row.service, row.shape, row.exposure, row.entry]),
    ).toEqual([
      ["links-api", "app-links-api", "http", "public", "src/processes/links-api.ts"],
      ["stats-api", "app-stats-api", "http", "internal", "src/processes/stats-api.ts"],
      ["upload-api", "app-upload-api", "http", "public", "src/processes/upload-api.ts"],
      ["visit-worker", "app-visit-worker", "worker", undefined, "src/processes/visit-worker.ts"],
    ]);
    expect(processes?.tiles[0]?.routes[0]).toEqual({
      method: "GET",
      path: "/healthz",
      answers: "200 once ready, 503 before and while draining",
    });
    expect(processes?.tiles[3]?.routes).toEqual([]);
    expect(processes?.tiles[0]?.settings).toEqual([
      { setting: "requestTimeoutMs", value: 1000, origin: "fixed" },
      { setting: "concurrencyLimit", value: 1000, origin: "fixed" },
    ]);
    expect(processesOf(off)).toBeUndefined();
    expect(bundle.manifest).toHaveProperty("processes", true);
    expect(off.manifest).not.toHaveProperty("processes");
    const normalized = JSON.parse(text(bundle, ".jeeves/normalized.json"));
    expect(normalized.processes).toHaveLength(4);
    expect(JSON.parse(text(off, ".jeeves/normalized.json"))).not.toHaveProperty("processes");
  });

  it("takes a template's HTTP limits, and runs v2 built from modules", () => {
    const v2 = assemble(
      runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [on]),
    );
    const processes = processesOf(v2);
    expect(v2.report.findings).toEqual([]);
    expect(processes?.runnable).toBe(true);
    expect(processes?.tiles.map((row) => row.tile)).toEqual([
      "completion-handler",
      "search",
      "search-indexer",
      "transcoder",
      "upload",
      "view-counter",
      "watch",
    ]);
    expect(processes?.tiles.find((row) => row.tile === "upload")?.settings).toEqual([
      {
        setting: "requestTimeoutMs",
        value: 5000,
        origin: "template",
        selection: "upload-multipart",
      },
      {
        setting: "concurrencyLimit",
        value: 500,
        origin: "template",
        selection: "upload-multipart",
      },
    ]);
    expect(v2.report.gaps.map((gap) => gap.id)).not.toContain("application-services");
  });

  it("runs the legacy kinds and empty tiles", () => {
    const design = runStudioCommands(emptyDesign(), [
      { type: "addAction", lane: "download", name: "Go", system: { name: "Legacy" } },
      {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        tile: { id: "go", name: "Go", kind: "redirect" },
        linkId: "download-go",
      },
      {
        type: "addTile",
        from: { tile: "go" },
        side: "after",
        tile: { id: "mail-jobs", name: "Mail jobs", kind: "queue" },
        linkId: "go-mail-jobs",
      },
      {
        type: "addTile",
        from: { tile: "mail-jobs" },
        side: "after",
        tile: { id: "mail", name: "Mail", kind: "notification" },
        linkId: "mail-jobs-mail",
      },
      {
        type: "addTile",
        from: { tile: "go" },
        side: "after",
        tile: { id: "pay", name: "Pay", kind: "billing" },
        linkId: "go-pay",
      },
      { type: "addModule", host: "go", kind: "redirect-responder", name: "Responder" },
      on,
    ]);
    const processes = processesOf(assemble(design));
    expect(processes?.runnable).toBe(true);
    expect(processes?.tiles.map((row) => [row.tile, row.shape, row.exposure])).toEqual([
      ["go", "http", "public"],
      ["mail", "worker", undefined],
      ["pay", "http", "internal"],
    ]);
  });

  it("refuses export where processes aren't installed", () => {
    const design = runStudioCommands(stubStackDesign(), [on]);
    const dependencies = loadLocalV2Dependencies();
    expect(
      generationExportBlockers(design, dependencies.installed).map((item) => item.target.path),
    ).toContainEqual(["generation", "processes"]);
    const partial = assemble(design, dependencies);
    expect(processesOf(partial)).toEqual({ runnable: false, tiles: [] });
  });
});

describe("store and tile endpoints come from the environment (QG06)", () => {
  const stack = assemble(runStudioCommands(stubStackDesign(), [on]));
  const off = assemble(stubStackDesign());
  const services = (target: Bundle) =>
    (
      JSON.parse(text(target, "compose.yaml")) as {
        services: Record<string, { environment?: Record<string, string> }>;
      }
    ).services;
  const rows = (target: Bundle) =>
    (target.report as { processes?: { tiles: { service: string; environment: string[] }[] } })
      .processes?.tiles ?? [];
  const broker = { JEEVES_BROKER_HOST: "local-broker", JEEVES_BROKER_PORT: "5672" };
  const linksDb = {
    JEEVES_DATABASE_LINKS_DB_HOST: "local-postgres",
    JEEVES_DATABASE_LINKS_DB_PORT: "5432",
    JEEVES_DATABASE_LINKS_DB_TLS: "disable",
  };

  it("sets exactly the endpoints each process reads in its service, at today's local values", () => {
    const environment = Object.fromEntries(
      Object.entries(services(stack))
        .filter(([name]) => name.startsWith("app-"))
        .map(([name, service]) => [name, service.environment]),
    );
    expect(environment).toEqual({
      "app-edge": undefined,
      "app-links-api": {
        ...broker,
        JEEVES_CACHE_LINKS_CACHE_HOST: "cache-links-cache",
        JEEVES_CACHE_LINKS_CACHE_PORT: "6379",
        JEEVES_CACHE_LINKS_CACHE_TLS: "disable",
        ...linksDb,
        JEEVES_TILE_STATS_API_URL: "http://app-stats-api:3000",
      },
      // Its only store is a search index, which is still reached at its local name.
      "app-stats-api": {},
      "app-upload-api": broker,
      "app-visit-worker": { ...broker, ...linksDb },
    });
    // Beside a cache read's cache and source login, and a sign-in's OIDC_*.
    const v3 = assemble(
      designSchema.parse(
        JSON.parse(
          readFileSync(
            new URL("../../../field-projects/youtube/v3/inputs/design.json", import.meta.url),
            "utf8",
          ),
        ),
      ),
    );
    const watch = services(v3)["app-watch-api"]?.environment ?? {};
    expect(Object.keys(watch).filter((name) => name.startsWith("JEEVES_CACHE_"))).toEqual([
      "JEEVES_CACHE_HOT_METADATA_HOST",
      "JEEVES_CACHE_HOT_METADATA_PORT",
      "JEEVES_CACHE_HOT_METADATA_TLS",
    ]);
    expect(watch.JEEVES_CACHE_HOT_METADATA_HOST).toBe("cache-hot-metadata");
    expect(watch.OIDC_AUDIENCE).toBeDefined();
    // With processes off there is no process service, so nothing is set.
    expect(Object.keys(services(off)).filter((name) => name.startsWith("app-"))).toEqual([]);
  });

  it("reports and documents each process's variables: what its service sets and its External APIs' URLs", () => {
    // QRWTY's probe: Front's stub calls an External API, whose URL Compose doesn't set (QG26).
    const probe = assembleV2(
      {
        designJson: readFileSync(
          new URL("../../../docs/plans/qrwty-gaps/fixtures/probe-design.json", import.meta.url),
          "utf8",
        ),
      },
      registry,
    );
    for (const target of [
      stack,
      assemble(runStudioCommands(stubStackWithCacheRead(), [on])),
      probe,
    ]) {
      const composed = services(target);
      const readme = text(target, "README.md");
      expect(rows(target).length).toBeGreaterThan(0);
      for (const row of rows(target)) {
        // Compose's keys plus the process's JEEVES_EXTERNAL_*, which the application sets. Each
        // `externalTarget` call appears twice since QG31, in the configuration pass and its client.
        const external = new Set(
          [
            ...text(target, `src/processes/${row.service.slice("app-".length)}.ts`).matchAll(
              /externalTarget\("(JEEVES_EXTERNAL_\w+)"\)/g,
            ),
          ].map((match) => match[1]),
        );
        expect(row.environment, row.service).toEqual(
          [...Object.keys(composed[row.service]?.environment ?? {}), ...external].sort(),
        );
        // The README lists the same, per process.
        expect(readme, row.service).toContain(
          `\n- \`${row.service}\`: ${row.environment.length ? row.environment.map((name) => `\`${name}\``).join(", ") : "none"}\n`,
        );
      }
    }
    expect(rows(probe).find((row) => row.service === "app-front")?.environment).toContain(
      "JEEVES_EXTERNAL_PROVIDER_URL",
    );
    expect(rows(stack).map((row) => [row.service, row.environment])).toEqual([
      [
        "app-links-api",
        [
          "JEEVES_BROKER_HOST",
          "JEEVES_BROKER_PORT",
          "JEEVES_CACHE_LINKS_CACHE_HOST",
          "JEEVES_CACHE_LINKS_CACHE_PORT",
          "JEEVES_CACHE_LINKS_CACHE_TLS",
          "JEEVES_DATABASE_LINKS_DB_HOST",
          "JEEVES_DATABASE_LINKS_DB_PORT",
          "JEEVES_DATABASE_LINKS_DB_TLS",
          "JEEVES_TILE_STATS_API_URL",
        ],
      ],
      ["app-stats-api", []],
      ["app-upload-api", ["JEEVES_BROKER_HOST", "JEEVES_BROKER_PORT"]],
      [
        "app-visit-worker",
        [
          "JEEVES_BROKER_HOST",
          "JEEVES_BROKER_PORT",
          "JEEVES_DATABASE_LINKS_DB_HOST",
          "JEEVES_DATABASE_LINKS_DB_PORT",
          "JEEVES_DATABASE_LINKS_DB_TLS",
        ],
      ],
    ]);
    const readme = text(stack, "README.md");
    expect(readme).toContain(
      "\n- `app-links-api`: `JEEVES_BROKER_HOST`, `JEEVES_BROKER_PORT`, `JEEVES_CACHE_LINKS_CACHE_HOST`, `JEEVES_CACHE_LINKS_CACHE_PORT`, `JEEVES_CACHE_LINKS_CACHE_TLS`, `JEEVES_DATABASE_LINKS_DB_HOST`, `JEEVES_DATABASE_LINKS_DB_PORT`, `JEEVES_DATABASE_LINKS_DB_TLS`, `JEEVES_TILE_STATS_API_URL`\n- `app-stats-api`: none\n- `app-upload-api`: `JEEVES_BROKER_HOST`, `JEEVES_BROKER_PORT`\n- `app-visit-worker`: `JEEVES_BROKER_HOST`, `JEEVES_BROKER_PORT`, `JEEVES_DATABASE_LINKS_DB_HOST`, `JEEVES_DATABASE_LINKS_DB_PORT`, `JEEVES_DATABASE_LINKS_DB_TLS`\n",
    );
    expect(readme).toContain("fails startup with `Invalid endpoint <variable>`, never its value");
    expect(text(off, "README.md")).not.toContain("Endpoints from the environment");
  });

  it("compiles no database, cache, broker or tile host into a process or its clients", () => {
    const v3 = assemble(
      designSchema.parse(
        JSON.parse(
          readFileSync(
            new URL("../../../field-projects/youtube/v3/inputs/design.json", import.meta.url),
            "utf8",
          ),
        ),
      ),
    );
    const designs = [
      stack,
      assemble(runStudioCommands(stubStackWithCacheRead(), [on])),
      assemble(runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [on])),
      v3,
    ];
    let loops = 0;
    for (const target of designs)
      for (const file of target.files) {
        if (
          !/^src\/(processes\/|runtime\/module-clients\.ts$|features\/service-resources\.ts$)/.test(
            file.path,
          )
        )
          continue;
        const code = new TextDecoder().decode(file.bytes);
        for (const literal of [
          /local-postgres/,
          /local-broker/,
          /\b5432\b/,
          /\b5672\b/,
          /\b6379\b/,
          // A cache's host; its credential is also named `cache-<id>`, which the configuration
          // pass reads (QG35).
          /(?<!readSecret\()"cache-/,
          /app-[a-z0-9-]+:3000/,
        ])
          expect(code, `${file.path} ${literal}`).not.toMatch(literal);
        // Every loop passes the broker's endpoint, so none falls back to tile-loop.ts's default.
        for (const name of ["startModuleLoop(", "loopConsumer("]) {
          const calls = code.split(name).length - 1;
          loops += calls;
          expect(code.split("brokerBinding()").length - 1, file.path).toBeGreaterThanOrEqual(calls);
        }
      }
    expect(loops).toBeGreaterThan(5);
    // The cache read takes its cache's host and port from the environment, not its bindings.
    const watch = text(v3, "src/processes/watch-api.ts");
    expect(watch).toContain(
      "    binding: { ...cacheEndpoint(binding.resource), secret: binding.secret },",
    );
  });

  it("keeps local stacks as they were: every database and cache disable, and no JEEVES_REQUIRE_TLS (QG10)", () => {
    const v3 = assemble(
      designSchema.parse(
        JSON.parse(
          readFileSync(
            new URL("../../../field-projects/youtube/v3/inputs/design.json", import.meta.url),
            "utf8",
          ),
        ),
      ),
    );
    let bindings = 0;
    for (const target of [stack, assemble(runStudioCommands(stubStackWithCacheRead(), [on])), v3])
      for (const [name, service] of Object.entries(services(target))) {
        if (!name.startsWith("app-")) continue;
        const environment = service.environment ?? {};
        const keys = Object.keys(environment);
        // Each database and cache endpoint has its transport, locally disable; nothing else of
        // QG10's is set, so no CA file is read and nothing is refused.
        for (const key of keys.filter((item) => /^JEEVES_(DATABASE|CACHE)_.+_HOST$/.test(item))) {
          bindings += 1;
          expect(environment[key.replace(/_HOST$/, "_TLS")], `${name} ${key}`).toBe("disable");
        }
        expect(keys.filter((key) => key.endsWith("_TLS")).length, name).toBe(
          keys.filter((key) => /^JEEVES_(DATABASE|CACHE)_.+_HOST$/.test(key)).length,
        );
        expect(
          keys.filter((key) => /JEEVES_REQUIRE_TLS|_CA_FILE$|_TLS_SERVERNAME$/.test(key)),
          name,
        ).toEqual([]);
      }
    expect(bindings).toBeGreaterThan(5);
    // The README says what each value does and what the switch refuses.
    const readme = text(stack, "README.md");
    for (const phrase of [
      "`JEEVES_DATABASE_<ID>_TLS` or `JEEVES_CACHE_<ID>_TLS`, with no default: `disable` (plain text, which `PGSSLMODE` can't change) or `verify-full`",
      "`Unreadable CA file <variable>`",
      "With `JEEVES_REQUIRE_TLS=true` (else unset), startup fails with `Insecure endpoint <variable>`",
      "and any `PUBSUB_EMULATOR_HOST`; the broker, object storage and search are plain text and aren't checked.",
      // QG31: one pass before any client, several wrong settings named together.
      "Each process with stubs checks the endpoints its clients and sign-in use in one pass before any client is built or probed, and reads each again as it builds that client, with no default:",
      "never its value (several at once: `Invalid configuration: <message>; <message>`).",
      // QG30: Node's verification override under the switch.
      "With the switch, `NODE_TLS_REJECT_UNAUTHORIZED` must be unset or `1`, else startup fails with `Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED`: `0` would turn off certificate checks for every client that leaves them to Node.",
      "`compose.yaml` sets the local values (`disable`, and no `JEEVES_REQUIRE_TLS`); a deployment sets its own.",
    ])
      expect(readme).toContain(phrase);
  });
});

// The exact emitted HTTP service and process runtime. Only Fastify is replaced, by the little of
// it the service uses: `inject` runs a route's handler and gives what it throws to the error
// handler. The ready marker moves to a temporary directory.
const fakeFastify = `export default function Fastify() {
  const routes = new Map();
  let errorHandler, notFound;
  const app = {
    get(url, handler) { routes.set("GET " + url, handler); },
    addHook() {},
    decorateRequest() {},
    removeContentTypeParser() {},
    getDefaultJsonParser() { return () => {}; },
    addContentTypeParser() {},
    setErrorHandler(handler) { errorHandler = handler; },
    setNotFoundHandler(handler) { notFound = handler; },
    route(route) { routes.set(route.method + " " + route.url, route.handler); },
    async listen() { return "http://fake"; },
    async close() {},
    async inject({ method, url }) {
      const handler = routes.get(method + " " + url);
      const request = { method, url, routeOptions: { url: handler ? url : undefined } };
      const reply = {
        statusCode: 200,
        headers: {},
        hasHeader(name) { return name.toLowerCase() in this.headers; },
        header(name, value) { this.headers[name.toLowerCase()] = value; return this; },
        code(status) { this.statusCode = status; return this; },
        send(payload) { this.payload = payload; return this; },
      };
      try {
        reply.payload = await (handler ?? notFound).call(app, request, reply);
      } catch (error) {
        errorHandler(error, request, reply);
      }
      return { statusCode: reply.statusCode, json: () => reply.payload };
    },
  };
  return app;
}`;
const markerDirectory = mkdtempSync(join(tmpdir(), "jeeves-process-"));
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const runtimeUrls = new Map<string, string>();
function runtimeUrl(name: string, fastify = fakeFastify): string {
  const key = `${name}\n${fastify}`;
  const old = runtimeUrls.get(key);
  if (old) return old;
  const source = readFileSync(
    new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
    "utf8",
  );
  const url = dataUrl(
    stripTypeScriptTypes(source)
      .replace(
        /from "\.\/(.+)\.ts"/g,
        (_match, dependency: string) => `from "${runtimeUrl(dependency, fastify)}"`,
      )
      .replace('from "fastify"', `from "${dataUrl(fastify)}"`)
      .replace('"/tmp/application-ready"', JSON.stringify(join(markerDirectory, "ready"))),
  );
  runtimeUrls.set(key, url);
  return url;
}
const httpRuntime = await import(runtimeUrl("http"));
const processRuntime = await import(runtimeUrl("process"));
// The same http.ts and tile-http.ts on Fastify itself, from the Jeeves server, which pins the
// version the export pins. Only `listen` changes: it readies the app without a socket, so
// `inject` goes through the real body parsers, routes and error handler.
const serverRequire = createRequire(
  new URL("../../../jeeves/apps/server/package.json", import.meta.url),
);
const realFastify = `import fastify from ${JSON.stringify(pathToFileURL(serverRequire.resolve("fastify")).href)};
export default function Fastify(options) {
  const app = fastify(options);
  app.listen = async () => { await app.ready(); return "http://injected"; };
  return app;
}`;
const realHttpRuntime = await import(runtimeUrl("http", realFastify));
const tileHttpRuntime = await import(runtimeUrl("tile-http", realFastify));
type Failure = [what: string, error: unknown];

describe("emitted HTTP service and process runtime", () => {
  const signals = ["SIGTERM", "SIGINT"] as const;
  const listening = Object.fromEntries(signals.map((name) => [name, process.listeners(name)]));
  const exitCode = process.exitCode;
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // runProcess listens for signals and sets the exit code: give this worker its own back.
    for (const name of signals)
      for (const listener of process.listeners(name))
        if (!listening[name]?.includes(listener)) process.removeListener(name, listener);
    process.exitCode = exitCode;
  });
  afterAll(() => rmSync(markerDirectory, { recursive: true, force: true }));

  const service = (onFailure: (what: string, error: unknown) => void) =>
    httpRuntime.createHttpService({
      id: "watch-api",
      settings: { requestTimeoutMs: 1000, concurrencyLimit: 10 },
      configure: (routes: { route(route: unknown): void }) => {
        const fails = (url: string, error: unknown) =>
          routes.route({
            method: "GET",
            url,
            handler: async () => {
              throw error;
            },
          });
        fails("/boom", new Error("boom"));
        fails("/missing", new httpRuntime.HttpError(404, "NOT_FOUND", "No record for this key."));
        fails("/busy", new httpRuntime.HttpError(503, "OVERLOADED", "Service is busy."));
        fails("/unwritten", new httpRuntime.HttpError(501, "NOT_IMPLEMENTED", "Not implemented."));
      },
      initialize: async () => {},
      onFailure,
    });
  const answers = {
    "/boom": [503, { error: "UNAVAILABLE", message: "Service unavailable." }],
    "/missing": [404, { error: "NOT_FOUND", message: "No record for this key." }],
    "/busy": [503, { error: "OVERLOADED", message: "Service is busy." }],
    "/unwritten": [501, { error: "NOT_IMPLEMENTED", message: "Not implemented." }],
  };
  type Service = { inject(request: unknown): Promise<{ statusCode: number; json(): unknown }> };
  const get = async (http: Service, url: string) => {
    const response = await http.inject({ method: "GET", url });
    return [response.statusCode, response.json()];
  };

  it("tells onFailure of a failed request (an error or a 5xx but 501), and never changes an answer", async () => {
    const failures: Failure[] = [];
    const http = await service((what, error) => failures.push([what, error]));
    await http.start({ host: "127.0.0.1", port: 3000 });
    expect(await get(http, "/boom")).toEqual(answers["/boom"]);
    expect(failures).toEqual([["request GET /boom", new Error("boom")]]);
    expect(await get(http, "/missing")).toEqual(answers["/missing"]);
    expect(await get(http, "/unwritten")).toEqual(answers["/unwritten"]);
    expect(failures).toHaveLength(1);
    expect(await get(http, "/busy")).toEqual(answers["/busy"]);
    expect(failures.map(([what]) => what)).toEqual(["request GET /boom", "request GET /busy"]);
    expect(failures[1]?.[1]).toMatchObject({ statusCode: 503, code: "OVERLOADED" });
    await http.close();
    // An onFailure that throws changes no answer.
    const throwing = await service(() => {
      throw new Error("log unavailable");
    });
    await throwing.start({ host: "127.0.0.1", port: 3000 });
    for (const [url, answer] of Object.entries(answers))
      expect(await get(throwing, url)).toEqual(answer);
    await throwing.close();
  });

  it("periodic tells onFailure of a rejected effect and keeps ticking", async () => {
    vi.useFakeTimers();
    const drains: (() => Promise<void>)[] = [];
    const scope = { own: (drain: () => Promise<void>) => drains.push(drain) };
    const failures: unknown[] = [];
    let ticks = 0;
    processRuntime.periodic(
      scope,
      async () => {
        ticks += 1;
        throw new Error(`sweep ${ticks}`);
      },
      30000,
      (error: unknown) => failures.push(error),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(failures).toEqual([new Error("sweep 1")]);
    await vi.advanceTimersByTimeAsync(30000);
    expect(failures).toEqual([new Error("sweep 1"), new Error("sweep 2")]);
    for (const drain of drains) await drain();
    await vi.advanceTimersByTimeAsync(60000);
    expect(ticks).toBe(2);
  });

  it("runProcess writes why startup, the process or a drain failed", async () => {
    const lines: unknown[] = [];
    vi.spyOn(console, "error").mockImplementation((line: string) => {
      lines.push(line.startsWith("{") ? JSON.parse(line) : line);
    });
    type Scope = { own(drain: () => void): void; fail(error?: unknown): void };
    await processRuntime.runProcess(async (scope: Scope) => scope.fail(new Error("x")));
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(lines).toEqual([{ level: "error", event: "process-failed", error: "Error: x" }]);
    // A drain that throws, on SIGTERM: one drain-failed line, and the exit code is 1.
    lines.length = 0;
    process.exitCode = undefined;
    const before = process.listeners("SIGTERM");
    await processRuntime.runProcess(async (scope: Scope) =>
      scope.own(() => {
        throw new Error("pool stuck");
      }),
    );
    const stop = process.listeners("SIGTERM").find((listener) => !before.includes(listener));
    stop?.("SIGTERM");
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(lines).toEqual([{ level: "error", event: "drain-failed", error: "Error: pool stuck" }]);
    // A failed startup says why, then the existing line.
    lines.length = 0;
    await processRuntime.runProcess(async () => {
      throw new TypeError("no database");
    });
    expect(lines).toEqual([
      { level: "error", event: "startup-failed", error: "TypeError: no database" },
      "Application startup failed",
    ]);
  });

  type Injected = {
    statusCode: number;
    headers: Record<string, string | string[] | number | undefined>;
    json(): unknown;
  };
  type RealService = {
    inject(request: unknown): Promise<Injected>;
    close(): Promise<void>;
  };
  /** The service on real Fastify: one route that records what it receives and, with an entry,
   * the stub routes of module "probe". */
  const realService = async (entry?: (request: unknown) => Promise<unknown>) => {
    const seen: { rawBody: unknown; body: unknown }[] = [];
    const http: RealService & { start(listen: unknown): Promise<string> } =
      await realHttpRuntime.createHttpService({
        id: "front",
        settings: { requestTimeoutMs: 1000, concurrencyLimit: 10 },
        configure: (routes: { route(route: unknown): void }) => {
          routes.route({
            method: ["GET", "POST"],
            url: "/seen",
            handler: async (request: { rawBody?: unknown; body?: unknown }) => {
              seen.push({ rawBody: request.rawBody, body: request.body });
              return { ok: true };
            },
          });
          if (entry) tileHttpRuntime.stubRoutes(routes, () => {}, "probe", entry);
        },
        initialize: async () => {},
      });
    await http.start({ host: "127.0.0.1", port: 0 });
    return { http, seen };
  };
  const post = (http: RealService, url: string, type: string, payload: string | Buffer) =>
    http.inject({ method: "POST", url, headers: { "content-type": type }, payload });

  it("keeps a JSON or text body's bytes as received beside the parsed body", async () => {
    const pins = JSON.parse(
      readFileSync(
        new URL("../../templates/local-v2/assets/package.json", import.meta.url),
        "utf8",
      ),
    );
    expect(serverRequire("fastify/package.json").version).toBe(pins.dependencies.fastify);
    const { http, seen } = await realService();
    const json = Buffer.from('{"id":"evt_1",  "amount": 100,\n "name":"café", "n": 1.0}');
    expect(json.length).toBe(57);
    expect((await post(http, "/seen", "application/json", json)).statusCode).toBe(200);
    // A byte-order mark stays in the bytes; the parsed body is the same as without it.
    const marked = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"a":1}')]);
    expect((await post(http, "/seen", "application/json; charset=utf-8", marked)).statusCode).toBe(
      200,
    );
    // Text is not decoded in the bytes, even where it isn't UTF-8.
    const text = Buffer.concat([Buffer.from("t=1,v1=ab\r\n  café "), Buffer.from([0xff])]);
    expect((await post(http, "/seen", "text/plain", text)).statusCode).toBe(200);
    expect((await http.inject({ method: "GET", url: "/seen" })).statusCode).toBe(200);
    expect(seen).toEqual([
      { rawBody: json, body: { id: "evt_1", amount: 100, name: "café", n: 1 } },
      { rawBody: marked, body: { a: 1 } },
      { rawBody: text, body: text.toString("utf8") },
      { rawBody: undefined, body: undefined },
    ]);
    expect(Buffer.byteLength(JSON.stringify(seen[0]?.body))).toBe(48);
    await http.close();
  });

  it("answers a body that is too large, invalid or of another type as before", async () => {
    const { http, seen } = await realService();
    const answer = async (type: string, payload: string) => {
      const response = await post(http, "/seen", type, payload);
      return [response.statusCode, response.json()];
    };
    const invalid = { error: "INVALID_REQUEST", message: "Invalid request." };
    const large = `{"pad":"${"x".repeat(65537 - 10)}"}`;
    expect(Buffer.byteLength(large)).toBe(65537);
    expect(await answer("application/json", large)).toEqual([413, invalid]);
    expect(await answer("text/plain", "x".repeat(65537))).toEqual([413, invalid]);
    expect(await answer("application/json", '{"bad":')).toEqual([400, invalid]);
    expect(await answer("application/json", "")).toEqual([400, invalid]);
    expect(await answer("application/json", '{"__proto__":{"admin":true}}')).toEqual([
      400,
      invalid,
    ]);
    expect(await answer("application/x-www-form-urlencoded", "a=1")).toEqual([415, invalid]);
    expect(seen).toEqual([]);
    expect(await answer("text/plain", "x".repeat(65536))).toEqual([200, { ok: true }]);
    await http.close();
  });

  it("sends each value of a stub's array header on its own line, a string header as before", async () => {
    const entry = vi.fn(async () => ({
      status: 201,
      headers: { "Set-Cookie": ["a=1; Path=/", "b=2; Path=/"], "X-Probe": "one" },
      body: { ok: true },
    }));
    const { http } = await realService(entry);
    const payload = Buffer.from('{"id":"evt_1",  "amount": 100}');
    const response = await post(http, "/modules/probe/events", "application/json", payload);
    expect(response.statusCode).toBe(201);
    expect(response.headers["set-cookie"]).toEqual(["a=1; Path=/", "b=2; Path=/"]);
    expect(response.headers["x-probe"]).toBe("one");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({ ok: true });
    expect(entry).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/events",
        body: { id: "evt_1", amount: 100 },
        rawBody: payload,
      }),
    );
    await http.close();
  });

  /** A route whose handler waits until `release`, on a service with one slot and a 100 ms
   * deadline; `entered` resolves once a request reaches the handler. */
  const heldService = async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = () => {};
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const http: RealService & { start(listen: unknown): Promise<string> } =
      await realHttpRuntime.createHttpService({
        id: "front",
        settings: { requestTimeoutMs: 100, concurrencyLimit: 1 },
        configure: (routes: { route(route: unknown): void }) =>
          routes.route({
            method: "GET",
            url: "/held",
            handler: async () => {
              entered();
              await gate;
              return { ok: true };
            },
          }),
        initialize: async () => {},
      });
    return { http, release, reached };
  };
  const answer = (response: Injected) => ({
    status: response.statusCode,
    retryAfter: response.headers["retry-after"],
    cacheControl: response.headers["cache-control"],
    body: response.json(),
  });

  it("answers the admission's three 503s with Retry-After: 1, their status and body unchanged", async () => {
    const { http, release, reached } = await heldService();
    const busy = (error: string, message: string) => ({
      status: 503,
      retryAfter: "1",
      cacheControl: "no-store",
      body: { error, message },
    });
    // Not accepting: before the service starts.
    expect(answer(await http.inject({ method: "GET", url: "/held" }))).toEqual(
      busy("UNAVAILABLE", "Service unavailable."),
    );
    await http.start({ host: "127.0.0.1", port: 0 });
    const first = http.inject({ method: "GET", url: "/held" });
    await reached;
    // At the concurrency limit: the first request holds the only slot.
    expect(answer(await http.inject({ method: "GET", url: "/held" }))).toEqual(
      busy("OVERLOADED", "Service is busy."),
    );
    // At the request timeout: the handler still hasn't resolved.
    expect(answer(await first)).toEqual(
      busy("DEADLINE", "Request deadline exceeded; check status before retrying."),
    );
    release();
    await http.close();
  });

  it("gives a handler's thrown 503 Retry-After: 1 unless it set its own, and a 404 or a 400 none", async () => {
    const { HttpError } = realHttpRuntime;
    const entry = vi.fn(async (request: { path: string }) => {
      if (request.path === "/thrown") throw new HttpError(503, "DOWNSTREAM", "Try again.");
      return { status: 503, headers: { "Retry-After": "7" }, body: { error: "OWN" } };
    });
    const http: RealService & { start(listen: unknown): Promise<string> } =
      await realHttpRuntime.createHttpService({
        id: "front",
        settings: { requestTimeoutMs: 1000, concurrencyLimit: 10 },
        configure: (routes: { route(route: unknown): void }) => {
          routes.route({
            method: "GET",
            url: "/thrown",
            handler: async () => {
              throw new HttpError(503, "DOWNSTREAM", "Try again.");
            },
          });
          routes.route({
            method: "GET",
            url: "/own",
            handler: async (
              _request: unknown,
              reply: { header(name: string, value: string): unknown },
            ) => {
              reply.header("Retry-After", "30");
              throw new HttpError(503, "DOWNSTREAM", "Try again later.");
            },
          });
          routes.route({ method: "POST", url: "/json", handler: async () => ({ ok: true }) });
          tileHttpRuntime.stubRoutes(routes, () => {}, "probe", entry);
        },
        initialize: async () => {},
      });
    await http.start({ host: "127.0.0.1", port: 0 });
    const get = async (url: string) => answer(await http.inject({ method: "GET", url }));
    const thrown = {
      status: 503,
      retryAfter: "1",
      cacheControl: "no-store",
      body: { error: "DOWNSTREAM", message: "Try again." },
    };
    expect(await get("/thrown")).toEqual(thrown);
    expect(await get("/modules/probe/thrown")).toEqual(thrown);
    expect(await get("/own")).toEqual({
      ...thrown,
      retryAfter: "30",
      body: { error: "DOWNSTREAM", message: "Try again later." },
    });
    expect(await get("/modules/probe/own")).toEqual({
      status: 503,
      retryAfter: "7",
      cacheControl: "no-store",
      body: { error: "OWN" },
    });
    expect(await get("/nowhere")).toEqual({
      status: 404,
      retryAfter: undefined,
      cacheControl: "no-store",
      body: { error: "NOT_FOUND", message: "Route not found." },
    });
    expect(answer(await post(http, "/json", "application/json", '{"bad":'))).toEqual({
      status: 400,
      retryAfter: undefined,
      cacheControl: "no-store",
      body: { error: "INVALID_REQUEST", message: "Invalid request." },
    });
    await http.close();
  });

  it("gives the fallback 503 Retry-After: 1 unless the route set its own, a 400 none, and tells onFailure once (QG21)", async () => {
    // What a stub's dependency throws: pg's client-side bound (QG17), the bounded cache's
    // (QG04), and the Identity client's lost connection, marked as identityTarget marks it (QG20).
    const stalled = new Error("Query read timeout");
    const plain = new Error("Stub failed");
    const deadline = new Error("Cache deadline");
    const away = new Error("Cache unavailable");
    const identityLost = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED 10.0.0.9:8080"), {
        code: "ECONNREFUSED",
      }),
    });
    Reflect.set(identityLost, Symbol.for("jeeves.internal-call"), true);
    const thrown: Record<string, Error> = {
      "/plain": plain,
      "/cache-deadline": deadline,
      "/cache-unavailable": away,
      "/identity": identityLost,
    };
    const entry = vi.fn(async (request: { path: string }) => {
      throw thrown[request.path];
    });
    const failures: Failure[] = [];
    const http: RealService & { start(listen: unknown): Promise<string> } =
      await realHttpRuntime.createHttpService({
        id: "front",
        settings: { requestTimeoutMs: 1000, concurrencyLimit: 10 },
        configure: (routes: { route(route: unknown): void }) => {
          routes.route({
            method: "GET",
            url: "/stalled",
            handler: async () => {
              throw stalled;
            },
          });
          routes.route({
            method: "GET",
            url: "/own",
            handler: async (
              _request: unknown,
              reply: { header(name: string, value: string): unknown },
            ) => {
              reply.header("Retry-After", "30");
              throw stalled;
            },
          });
          routes.route({ method: "POST", url: "/json", handler: async () => ({ ok: true }) });
          tileHttpRuntime.stubRoutes(routes, () => {}, "probe", entry);
        },
        initialize: async () => {},
        onFailure: (what: string, error: unknown) => failures.push([what, error]),
      });
    await http.start({ host: "127.0.0.1", port: 0 });
    const get = async (url: string) => answer(await http.inject({ method: "GET", url }));
    const fallback = {
      status: 503,
      retryAfter: "1",
      cacheControl: "no-store",
      body: { error: "UNAVAILABLE", message: "Service unavailable." },
    };
    expect(await get("/stalled")).toEqual(fallback);
    expect(failures).toEqual([["request GET /stalled", stalled]]);
    for (const [path, error] of Object.entries(thrown)) {
      failures.length = 0;
      expect(await get(`/modules/probe${path}`)).toEqual(fallback);
      expect(failures).toEqual([["request GET /modules/probe/*", error]]);
    }
    expect(entry).toHaveBeenCalledTimes(4);
    failures.length = 0;
    expect(await get("/own")).toEqual({ ...fallback, retryAfter: "30" });
    expect(failures).toEqual([["request GET /own", stalled]]);
    failures.length = 0;
    expect(answer(await post(http, "/json", "application/json", '{"bad":'))).toEqual({
      status: 400,
      retryAfter: undefined,
      cacheControl: "no-store",
      body: { error: "INVALID_REQUEST", message: "Invalid request." },
    });
    expect(failures).toEqual([]);
    await http.close();
  });
});

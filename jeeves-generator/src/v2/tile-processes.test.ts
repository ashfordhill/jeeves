import {
  type DesignDocument,
  emptyDesign,
  generationExportBlockers,
  type StudioCommand,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
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
        tile: { id: "mail", name: "Mail", kind: "notification" },
        linkId: "go-mail",
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

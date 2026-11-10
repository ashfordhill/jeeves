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
      "src/processes/links-api.ts",
      "src/processes/stats-api.ts",
      "src/processes/upload-api.ts",
      "src/processes/visit-worker.ts",
      "src/runtime/admission.ts",
      "src/runtime/http.ts",
      "src/runtime/process.ts",
    ]);
    expect(paths(off).filter((path) => !paths(bundle).includes(path))).toEqual([]);
    // The stubs themselves are unchanged: templates and stubs are not wired yet.
    for (const file of off.files)
      if (file.path.startsWith("src/modules/"))
        expect(text(bundle, file.path), file.path).toBe(text(off, file.path));
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
    const worker = text(bundle, "src/processes/visit-worker.ts");
    expect(worker).not.toContain("createHttpService");
    expect(worker).toContain("const idle = setInterval(() => {}, 2 ** 30);");
    expect(worker).toContain("scope.own(() => clearInterval(idle));");
  });

  it("composes one healthy-on-marker service per tile, with no restart policy or ports", () => {
    const compose = JSON.parse(text(bundle, "compose.yaml")) as {
      services: Record<string, Record<string, unknown>>;
    };
    expect(Object.keys(compose.services)).toEqual([
      "app-links-api",
      "app-stats-api",
      "app-upload-api",
      "app-visit-worker",
    ]);
    for (const [name, service] of Object.entries(compose.services)) {
      expect(service.command).toEqual(["node", `dist/processes/${name.slice(4)}.js`]);
      expect(service.profiles).toEqual(["application"]);
      expect(service.init).toBe(true);
      expect(service.depends_on).toEqual({});
      expect(service).not.toHaveProperty("restart");
      expect(service).not.toHaveProperty("ports");
      expect((service.healthcheck as { test: string[] }).test.at(-1)).toContain(
        "/tmp/application-ready",
      );
    }
    expect(JSON.parse(text(bundle, "infra/local.json")).application).toEqual(
      Object.keys(compose.services),
    );
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
    expect(processes?.tiles[0]?.routes).toEqual([
      { method: "GET", path: "/healthz", answers: "200 once ready, 503 before and while draining" },
    ]);
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

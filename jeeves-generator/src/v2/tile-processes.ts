import { type NormalizedProcess, studioDefinitions } from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import type { V2Emitter, V2ProcessReport, V2TemplateFile } from "./registry.ts";

const pointer = (path: readonly (string | number)[]) =>
  `/${path.map((part) => pointerPart(String(part))).join("/")}`;
/** One comment line: names are the user's own text. */
const line = (text: string) => text.replace(/[\p{Cc}\u2028\u2029]/gu, " ");

/** Where each process's entry point lives and how Compose runs it (tile process contract, §2). */
export function processPaths(tile: string) {
  return { entry: `src/processes/${tile}.ts`, built: `dist/processes/${tile}.js` };
}

/**
 * A runnable process per application tile, with Runnable processes on: an HTTP process (Service,
 * Uploads and the HTTP legacy kinds) answers `/healthz`, a worker stays up idle. Each writes its
 * ready marker and drains on SIGTERM. Templates and stubs are not wired into processes here.
 */
export function createLocalTileProcesses(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.tile-processes",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "A runnable process per application tile: HTTP readiness or an idle worker, ready marker and graceful shutdown.",
    sourcePaths,
    provides: { processes: true },
    local: ({ model }) =>
      model.processes?.length
        ? {
            sourcePaths: ["/generation/processes"],
            services: model.processes.map((process) => ({
              host: process.tile,
              command: ["node", processPaths(process.tile).built],
              http: false,
              dependsOn: [],
              readiness: true,
            })),
          }
        : undefined,
    render: ({ model }) => {
      const processes = model.processes ?? [];
      return {
        files: processes.map(entryFile),
        processes: processes.map(reportRow),
      };
    },
  };
}

/** The process's settings: its HTTP limits, from a template on its tile or fixed. */
function settings(process: NormalizedProcess) {
  return process.http
    ? (["requestTimeoutMs", "concurrencyLimit"] as const).map((setting) => {
        const value = process.http?.[setting];
        return {
          setting,
          value: value?.value ?? 0,
          origin: value?.origin ?? "fixed",
          ...(value?.selection && { selection: value.selection }),
        };
      })
    : [];
}

function reportRow(process: NormalizedProcess): V2ProcessReport {
  return {
    tile: process.tile,
    name: process.name,
    kind: process.kind,
    service: `app-${process.tile}`,
    shape: process.shape,
    ...(process.exposure && { exposure: process.exposure }),
    entry: processPaths(process.tile).entry,
    settings: settings(process),
    routes:
      process.shape === "http"
        ? [
            {
              method: "GET",
              path: "/healthz",
              answers: "200 once ready, 503 before and while draining",
            },
          ]
        : [],
    loops: [],
  };
}

function entryFile(process: NormalizedProcess): V2TemplateFile {
  const kind = studioDefinitions[process.kind].name;
  const http = process.shape === "http";
  const config = {
    tile: process.tile,
    kind: process.kind,
    shape: process.shape,
    ...(process.exposure && { exposure: process.exposure }),
    ...(http && {
      settings: Object.fromEntries(settings(process).map((item) => [item.setting, item.value])),
      listen: { host: "0.0.0.0", port: 3000 },
    }),
  };
  const head = [
    `// Generated scaffold: ${line(process.name)} (${kind}) runs as app-${process.tile}, ${http ? "an HTTP process" : "a worker process"}.`,
    "// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.",
  ];
  const body = http
    ? [
        'import { createHttpService } from "../runtime/http.ts";',
        'import { runProcess } from "../runtime/process.ts";',
        "",
        "/** Compiled configuration: nothing is read from disk at runtime. */",
        `export const config = ${JSON.stringify(config, null, 2)} as const;`,
        "",
        "await runProcess(async (scope) => {",
        "  const service = await createHttpService({",
        "    id: config.tile,",
        "    settings: config.settings,",
        "    configure: () => {},",
        "    initialize: async () => {},",
        "  });",
        "  // Draining stops admission first, then waits for admitted requests.",
        "  scope.own(() => service.close());",
        "  await service.start(config.listen);",
        "  scope.ready();",
        "});",
      ]
    : [
        'import { runProcess } from "../runtime/process.ts";',
        "",
        "/** Compiled configuration: nothing is read from disk at runtime. */",
        `export const config = ${JSON.stringify(config, null, 2)} as const;`,
        "",
        "await runProcess(async (scope) => {",
        "  // An idle worker holds a timer until it is stopped, so the process stays up.",
        "  const idle = setInterval(() => {}, 2 ** 30);",
        "  scope.own(() => clearInterval(idle));",
        "  scope.ready();",
        "});",
      ];
  return {
    path: processPaths(process.tile).entry,
    content: `${[...head, ...body].join("\n")}\n`,
    ownership: "generated-scaffold",
    sourcePaths: ["/generation/processes", pointer(process.sourcePath)],
  };
}

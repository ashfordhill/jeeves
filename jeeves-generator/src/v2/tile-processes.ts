import { type NormalizedProcess, studioDefinitions } from "@jeeves/spec";
import { pointerPart, refuse } from "../json.ts";
import { httpMounts, importLines, type ProcessMount } from "./http-wiring.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import { loopMounts } from "./loop-wiring.ts";
import type { V2Emitter, V2ProcessReport, V2RenderContext, V2TemplateFile } from "./registry.ts";

const pointer = (path: readonly (string | number)[]) =>
  `/${path.map((part) => pointerPart(String(part))).join("/")}`;
/** One comment line: names are the user's own text. */
const line = (text: string) => text.replace(/[\p{Cc}\u2028\u2029]/gu, " ");
const unique = (items: readonly string[]) => [...new Set(items)].sort();
/** The scaffolds a process imports: "Not implemented" and the log, what a module's entry point
 * receives (tile process contract, section 4), the HTTP wrappers and the loops (section 5). */
const scaffolds = {
  core: ["src/runtime/tile-process.ts", "src/runtime/tile-process.ts.template"],
  entry: ["src/modules/entry.ts", "src/modules/entry.ts.template"],
  http: ["src/runtime/tile-http.ts", "src/runtime/tile-http.ts.template"],
  loop: ["src/runtime/tile-loop.ts", "src/runtime/tile-loop.ts.template"],
} as const;

/** Where each process's entry point lives and how Compose runs it (tile process contract, §2). */
export function processPaths(tile: string) {
  return { entry: `src/processes/${tile}.ts`, built: `dist/processes/${tile}.js` };
}

/** What each process mounts: an HTTP process its templates and route stubs, and any process its
 * worker templates and loop stubs. */
function mountsOf(model: V2RenderContext["model"]) {
  return new Map(
    (model.processes ?? []).map((process) => [
      process.tile,
      [
        ...(process.shape === "http" ? httpMounts(process, model.selections) : []),
        ...loopMounts(process, model.selections),
      ],
    ]),
  );
}

/**
 * A runnable process per application tile, with Runnable processes on. An HTTP process (Service,
 * Uploads and the HTTP legacy kinds) answers `/healthz`, mounts its tile's templates with
 * generated hooks and routes its stubs; the edge publishes the public ones. A worker stays up
 * idle. Each writes its ready marker and drains on SIGTERM.
 */
export function createLocalTileProcesses(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.tile-processes",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "A runnable process per application tile: HTTP routes and consume loops for its templates and stubs, the public edge, ready marker and graceful shutdown.",
    sourcePaths,
    provides: { processes: true },
    local: ({ model }) => {
      if (!model.processes?.length) return undefined;
      const mounts = mountsOf(model);
      const all = [...mounts.values()].flat();
      const contribution: V2LocalContribution = {
        sourcePaths: ["/generation/processes"],
        migrations: all.flatMap((mount) => mount.local.migrations ?? []),
        logins: all.flatMap((mount) => mount.local.logins ?? []),
        views: all.flatMap((mount) => mount.local.views ?? []),
        grants: all.flatMap((mount) => mount.local.grants ?? []),
        broker: all.flatMap((mount) => mount.local.broker ?? []),
        edge: model.processes
          .filter((process) => process.shape === "http" && process.exposure === "public")
          .map((process) => ({ host: process.tile })),
        services: model.processes.map((process) => {
          const wired = (mounts.get(process.tile) ?? []).map((mount) => mount.service);
          const identity = unique(wired.flatMap((item) => (item.identity ? [item.identity] : [])));
          if (identity.length > 1)
            refuse("LOCAL_IDENTITY_LIMIT", process.tile, "A process verifies one identity.");
          const environment = Object.assign({}, ...wired.map((item) => item.environment ?? {}));
          return {
            host: process.tile,
            command: ["node", processPaths(process.tile).built],
            http: false,
            dependsOn: unique(wired.flatMap((item) => item.dependsOn)),
            ...(wired.some((item) => item.sql.length) && {
              sql: unique(wired.flatMap((item) => item.sql)),
            }),
            ...(wired.some((item) => item.storage.length) && {
              storage: unique(wired.flatMap((item) => item.storage)),
            }),
            ...(wired.some((item) => item.cache.length) && {
              cache: unique(wired.flatMap((item) => item.cache)),
            }),
            ...(wired.some((item) => item.broker) && { broker: true }),
            ...(wired.some((item) => item.target === "media") && { target: "media" as const }),
            ...(identity[0] && { identity: identity[0] }),
            ...(Object.keys(environment).length && { environment }),
            readiness: true,
          };
        }),
      };
      return contribution;
    },
    render: ({ model, asset }) => {
      const processes = model.processes ?? [];
      const mounts = mountsOf(model);
      const all = [...mounts.values()].flat();
      const http = processes.some((process) => process.shape === "http");
      const looping = all.some((mount) => mount.loops.length);
      return {
        files: [
          ...processes.map((process) => entryFile(process, mounts.get(process.tile) ?? [])),
          ...all.flatMap((mount) => (mount.hooks ? [mount.hooks.file] : [])),
          // "Not implemented", the 501 wrapper and the loops, beside the processes that use them.
          ...[
            ...(http || looping ? [scaffolds.core, scaffolds.entry] : []),
            ...(http ? [scaffolds.http] : []),
            ...(looping ? [scaffolds.loop] : []),
          ].map(([path, source]) => ({
            path,
            content: asset(`jeeves-generator/templates/local-v2/assets/${source}`),
            ownership: "generated-scaffold" as const,
            sourcePaths: ["/generation/processes"],
          })),
        ],
        processes: processes.map((process) => reportRow(process, mounts.get(process.tile) ?? [])),
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

function reportRow(process: NormalizedProcess, mounts: readonly ProcessMount[]): V2ProcessReport {
  const http = process.shape === "http";
  return {
    tile: process.tile,
    name: process.name,
    kind: process.kind,
    service: `app-${process.tile}`,
    shape: process.shape,
    ...(process.exposure && { exposure: process.exposure }),
    ...(http && process.exposure === "public" && { edge: `/api/${process.tile}/` }),
    entry: processPaths(process.tile).entry,
    settings: settings(process),
    routes: http
      ? [
          {
            method: "GET",
            path: "/healthz",
            answers: "200 once ready, 503 before and while draining",
          },
          ...mounts.flatMap((mount) => mount.routes),
        ]
      : [],
    loops: mounts.flatMap((mount) =>
      mount.loops.map((loop) => ({
        queue: loop.queue,
        module: loop.module,
        answers: loop.answers,
      })),
    ),
    templates: mounts.flatMap((mount) => (mount.template ? [mount.template] : [])),
    hooks: mounts.flatMap((mount) =>
      mount.hooks && mount.template
        ? [
            {
              selection: mount.template.selection,
              file: mount.hooks.file.path,
              hooks: mount.hooks.members,
            },
          ]
        : [],
    ),
  };
}

const indent = (lines: readonly string[], depth: number) =>
  lines.map((item) => (item ? `${" ".repeat(depth)}${item}` : item));

function entryFile(process: NormalizedProcess, mounts: readonly ProcessMount[]): V2TemplateFile {
  const kind = studioDefinitions[process.kind].name;
  const http = process.shape === "http";
  const templates = Object.fromEntries(
    mounts.flatMap((mount) => (mount.config ? [mount.config] : [])),
  );
  const stubs = process.stubs
    .filter((stub) => stub.role === "route")
    .map((stub) => ({ module: stub.module, path: `/modules/${stub.module}` }));
  // What each loop consumes, in the order its code reads `config.loops[n]`.
  const loops = mounts.flatMap((mount) => mount.loops.map(({ answers: _, ...loop }) => loop));
  const config = {
    tile: process.tile,
    kind: process.kind,
    shape: process.shape,
    ...(process.exposure && { exposure: process.exposure }),
    ...(http && {
      settings: Object.fromEntries(settings(process).map((item) => [item.setting, item.value])),
      listen: { host: "0.0.0.0", port: 3000 },
    }),
    ...(Object.keys(templates).length && { templates }),
    ...(stubs.length && { stubs }),
    ...(loops.length && { loops }),
  };
  const head = [
    `// Generated scaffold: ${line(process.name)} (${kind}) runs as app-${process.tile}, ${http ? "an HTTP process" : "a worker process"}.`,
    "// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.",
  ];
  const routed = mounts.some((mount) => mount.configure.length);
  const setup = mounts.flatMap((mount) => mount.setup);
  const block = (key: "configure" | "initialize") => mounts.flatMap((mount) => mount[key]);
  const imports = importLines([
    ...(http ? [{ from: "../runtime/http.ts", name: "createHttpService" }] : []),
    { from: "../runtime/process.ts", name: "runProcess" },
    ...(routed ? [{ from: "../runtime/tile-process.ts", name: "createNotImplementedLog" }] : []),
    ...(loops.length ? [{ from: "../runtime/tile-loop.ts", name: "createLoopLog" }] : []),
    ...mounts.flatMap((mount) => mount.imports),
  ]);
  const configure = block("configure");
  const initialize = block("initialize");
  const logs = [
    ...(routed
      ? [
          '  // "Not implemented" answers 501 with one log line per module and hook a second.',
          "  const log = createNotImplementedLog(config.tile);",
        ]
      : []),
    ...(loops.length
      ? [
          '  // Loops subscribe before the process is ready. "Not implemented" sends a message to its',
          "  // queue's .failed with one log line per module and hook a second; stopping drains them.",
          "  const loopLog = createLoopLog(config.tile);",
        ]
      : []),
  ];
  const body = http
    ? [
        "await runProcess(async (scope) => {",
        ...logs,
        ...indent(setup, 2),
        "  const service = await createHttpService({",
        "    id: config.tile,",
        "    settings: config.settings,",
        ...(configure.length
          ? ["    configure: (routes) => {", ...indent(configure, 6), "    },"]
          : ["    configure: () => {},"]),
        ...(initialize.length
          ? ["    initialize: async () => {", ...indent(initialize, 6), "    },"]
          : ["    initialize: async () => {},"]),
        "  });",
        "  // Draining stops admission first, then waits for admitted requests.",
        "  scope.own(() => service.close());",
        "  await service.start(config.listen);",
        ...indent(
          mounts.flatMap((mount) => mount.started),
          2,
        ),
        "  scope.ready();",
        "});",
      ]
    : [
        "await runProcess(async (scope) => {",
        ...(setup.length
          ? [...logs, ...indent(setup, 2)]
          : [
              "  // An idle worker holds a timer until it is stopped, so the process stays up.",
              "  const idle = setInterval(() => {}, 2 ** 30);",
              "  scope.own(() => clearInterval(idle));",
            ]),
        "  scope.ready();",
        "});",
      ];
  return {
    path: processPaths(process.tile).entry,
    content: `${[
      ...head,
      ...imports,
      "",
      "/** Compiled configuration: nothing is read from disk at runtime. */",
      `export const config = ${JSON.stringify(config, null, 2)} as const;`,
      "",
      ...body,
    ].join("\n")}\n`,
    ownership: "generated-scaffold",
    sourcePaths: ["/generation/processes", pointer(process.sourcePath)],
  };
}

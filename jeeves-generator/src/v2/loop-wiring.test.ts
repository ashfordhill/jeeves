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
type Row = {
  tile: string;
  loops: { queue: string; module: string; answers: string }[];
  templates: { selection: string; template: string; level: string }[];
  hooks: { selection: string; file: string; hooks: string[] }[];
};
const processes = (bundle: Bundle) =>
  (bundle.report as unknown as { processes: { runnable: boolean; tiles: Row[] } }).processes;
const row = (bundle: Bundle, tile: string) => {
  const found = processes(bundle).tiles.find((item) => item.tile === tile);
  if (!found) throw new Error(`No process ${tile}`);
  return found;
};
const gap = (bundle: Bundle, id: string) => bundle.report.gaps.find((item) => item.id === id);
type Services = Record<string, { depends_on: object; secrets: string[]; [key: string]: unknown }>;

describe("consume loops (tile process contract, sections 3-5)", () => {
  const stack = assemble(runStudioCommands(stubStackDesign(), [on]));
  const stackOff = assemble(stubStackDesign());
  const v2 = assemble(runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [on]));

  it("runs a loop for each consumer stub, in a worker or beside HTTP routes", () => {
    expect(stack.report.findings).toEqual([]);
    expect(processes(stack).runnable).toBe(true);
    expect(row(stack, "visit-worker").loops).toEqual([
      {
        queue: "visits--visit-worker",
        module: "visit-consumer",
        answers:
          '"Not implemented: Visit consumer" sends the message to visits--visit-worker.failed (NOT_IMPLEMENTED) until it is written; other errors retry 5 times',
      },
    ]);
    expect(row(stack, "links-api").loops).toEqual([
      {
        queue: "uploaded",
        module: "upload-consumer",
        answers:
          '"Not implemented: Upload consumer" sends the message to uploaded.failed (NOT_IMPLEMENTED) until it is written; other errors retry 5 times',
      },
    ]);
    expect(row(stack, "upload-api").loops).toEqual([]);
    const worker = text(stack, "src/processes/visit-worker.ts");
    expect(worker).toContain(
      [
        "  // Visit consumer: a loop on visits--visit-worker.",
        "  await startModuleLoop(scope, loopLog, config.loops[0], (message) =>",
        '    visitConsumer(dependencies["visit-consumer"], message),',
        "  );",
        "  scope.ready();",
      ].join("\n"),
    );
    expect(worker).toContain('"failedQueue": "visits--visit-worker.failed"');
    expect(worker).not.toContain("setInterval");
    // Beside HTTP, the loop subscribes before the service listens, so it drains after it.
    const links = text(stack, "src/processes/links-api.ts");
    expect(links.indexOf("startModuleLoop(scope, loopLog, config.loops[0]")).toBeLessThan(
      links.indexOf("createHttpService({"),
    );
  });

  it("gives loop stubs the message signature; the consumed queue is no longer a dependency", () => {
    expect(text(stack, "src/modules/visit-worker/visit-consumer.ts")).toBe(
      [
        "// Visit consumer, an Event consumer in Visit worker: Consumes events.",
        "// Write the module here. Export never overwrites your edits: export afresh and carry them over.",
        'import type { ModuleMessage } from "../entry.ts";',
        'import type { Dependencies } from "./visit-consumer.slots.ts";',
        "",
        `/** Handles each message from the queues it consumes. "Not implemented" sends the message to its queue's .failed; any other error is retried. */`,
        "export async function visitConsumer(dependencies: Dependencies, message: ModuleMessage): Promise<void> {",
        '  throw new Error("Not implemented: Visit consumer");',
        "}",
        "",
      ].join("\n"),
    );
    const slots = text(stack, "src/modules/visit-worker/visit-consumer.slots.ts");
    expect(slots).toContain("  // visits: its loop delivers each message to the entry point.\n");
    expect(slots).not.toContain("QueueConsumer");
    // The descriptor keeps the slot.
    expect(slots).toContain('"property":"visits","tile":"visits"');
    // Off, both files keep today's bytes.
    expect(text(stackOff, "src/modules/visit-worker/visit-consumer.slots.ts")).toContain(
      "  visits: QueueConsumer;",
    );
    expect(text(stackOff, "src/modules/visit-worker/visit-consumer.ts")).toContain(
      "export async function visitConsumer(dependencies: Dependencies): Promise<void> {",
    );
    expect(text(stack, "src/modules/entry.ts")).toContain("export type ModuleMessage = {");
  });

  it("provisions the queues stub loops consume: the topic's subscriber and the work queue", () => {
    const plan = json(stack, "infra/local.json");
    expect(plan.broker).toEqual([
      { resource: "uploaded", queues: ["uploaded"] },
      { resource: "visits", exchange: "visits", queues: ["visits--visit-worker"] },
    ]);
    expect(
      plan.resources
        .filter((item: { kind: string }) => item.kind === "queue")
        .map((item: { id: string; mode: string }) => [item.id, item.mode]),
    ).toEqual([
      ["uploaded", "work-queue"],
      ["visits", "topic"],
    ]);
    expect(plan.providers).toContain("local-broker");
    const services = json(stack, "compose.yaml").services as Services;
    // The two loops' tiles, and Upload API, which publishes to Uploaded (client-wiring.test.ts).
    for (const name of ["app-links-api", "app-visit-worker", "app-upload-api"]) {
      expect(services[name]).toMatchObject({
        depends_on: { "local-broker": { condition: "service_healthy" } },
      });
      expect(services[name]?.secrets).toContain("broker-password");
    }
    expect(services["setup-broker"]?.command).toEqual(["node", "scripts/broker-init.mjs"]);
    // The generated README says what a loop does with a message.
    expect(text(stack, "README.md")).toContain("sends the message to `<queue>.failed`");
    // Off, nothing is provisioned for stubs.
    expect(json(stackOff, "infra/local.json").broker).toEqual([]);
  });

  it("leaves a queue on another provider unprovisioned, as an unsupported gap", () => {
    const design = runStudioCommands(stubStackDesign(), [
      {
        type: "edit",
        element: "visits",
        settings: { kind: "queue", mode: "topic", provider: "aws" },
      },
      on,
    ]);
    const bundle = assemble(design);
    expect(gap(bundle, "provider-visit-consumer-visits")).toMatchObject({
      status: "unsupported",
      required: true,
      description: expect.stringContaining("Visits uses the aws provider"),
    });
    expect(processes(bundle).runnable).toBe(false);
    expect(json(bundle, "infra/local.json").broker).toEqual([
      { resource: "uploaded", queues: ["uploaded"] },
    ]);
    expect(
      (json(bundle, "compose.yaml").services as Services)["app-visit-worker"]?.depends_on,
    ).not.toHaveProperty("local-broker");
    // Its loop still runs, so the design compiles; the stack won't start until it is provisioned.
    expect(text(bundle, "src/processes/visit-worker.ts")).toContain(
      "await startModuleLoop(scope, loopLog, config.loops[0], (message) =>",
    );
  });

  it("mounts the asset lifecycle, Video HLS and event counter on their tables and hooks files", () => {
    expect(v2.report.findings).toEqual([]);
    expect(processes(v2).runnable).toBe(true);
    const loops = (tile: string) =>
      row(v2, tile).loops.map((loop) => `${loop.queue} ${loop.module}`);
    expect(loops("completion-handler")).toEqual([
      "completion-events--completion-handler handler-writer",
    ]);
    expect(loops("transcoder")).toEqual(["upload-queue transcoder-encoder"]);
    expect(loops("view-counter")).toEqual(["view-events--view-counter counter-sum"]);
    expect(loops("search-indexer")).toEqual(["publication-events--search-indexer indexer-writer"]);
    expect(row(v2, "completion-handler").loops[0]?.answers).toBe(
      '"Not implemented: event for Lifecycle writer" sends the message to completion-events--completion-handler.failed (NOT_IMPLEMENTED) until its hooks are written',
    );
    expect(row(v2, "search-indexer").loops[0]?.answers).toBe(
      '"Not implemented: mapping for Index writer" sends the message to publication-events--search-indexer.failed (NOT_IMPLEMENTED) until its hooks are written; then each event\'s document is upserted at its version',
    );
    expect(
      ["completion-handler", "transcoder", "view-counter", "search-indexer"].flatMap(
        (tile) => row(v2, tile).templates,
      ),
    ).toEqual([
      { selection: "handler-writer", template: "asset-lifecycle", level: "mounted" },
      { selection: "transcoder-encoder", template: "video-hls", level: "mounted" },
      { selection: "counter-sum", template: "event-counter", level: "mounted" },
      { selection: "indexer-writer", template: "search-projection", level: "mounted" },
    ]);
    expect(
      ["completion-handler", "transcoder", "view-counter", "search-indexer"].flatMap((tile) =>
        row(v2, tile).hooks.map((item) => [item.file, item.hooks]),
      ),
    ).toEqual([
      [
        "src/modules/completion-handler/handler-writer.hooks.ts",
        [
          "metadata",
          "event",
          "result",
          "failure",
          "job.codec",
          "job.construct",
          "response",
          "publication.codec",
          "publication.construct",
          "identities.request",
          "identities.result",
          "identities.publication",
        ],
      ],
      [
        "src/modules/transcoder/transcoder-encoder.hooks.ts",
        ["job", "video", "result", "eventId", "event", "source.owns", "results.owns"],
      ],
      [
        "src/modules/view-counter/counter-sum.hooks.ts",
        ["event", "aggregateKey", "eventId", "identity"],
      ],
      [
        "src/modules/search-indexer/indexer-writer.hooks.ts",
        ["mapping", "document.parse", "document.id", "document.version", "event"],
      ],
    ]);
    for (const [file, hooks] of [
      ["src/modules/completion-handler/handler-writer.hooks.ts", ["event", "job.construct"]],
      ["src/modules/transcoder/transcoder-encoder.hooks.ts", ["job", "results.owns"]],
      ["src/modules/view-counter/counter-sum.hooks.ts", ["aggregateKey"]],
      ["src/modules/search-indexer/indexer-writer.hooks.ts", ["mapping", "document.version"]],
    ] as const) {
      const lead = file.includes("handler")
        ? "Lifecycle writer"
        : file.includes("transcoder")
          ? "Segmenter and encoder"
          : file.includes("indexer")
            ? "Index writer"
            : "Receipt and increment";
      for (const hook of hooks)
        expect(text(v2, file)).toContain(`throw new NotImplemented("${hook} for ${lead}");`);
      expect(v2.manifest.files.find((item) => item.path === file)?.ownership).toBe(
        "generated-extension",
      );
    }
    // Each template's application-bindings gap is custom work in its hooks file; search's names
    // both search templates' (V3-08).
    for (const [id, file] of [
      ["asset-lifecycle-application-bindings", "handler-writer.hooks.ts"],
      ["video-hls-worker-bindings", "transcoder-encoder.hooks.ts"],
      ["event-counter-application-bindings", "counter-sum.hooks.ts"],
      ["search-application-bindings", "indexer-writer.hooks.ts"],
      ["search-application-bindings", "search-query.hooks.ts"],
    ] as const)
      expect(gap(v2, id)).toMatchObject({
        status: "custom",
        required: true,
        description: expect.stringContaining(file),
      });
    expect(gap(v2, "video-hls-worker-bindings")?.description).toContain(
      "a message that reaches one ends in its queue's .failed",
    );
    // The Index writer's process asserts its index from its hooks, so no mapping gap is left.
    expect(gap(v2, "search-mappings")).toBeUndefined();
  });

  it("starts each template's worker in its process, with its hooks watched", () => {
    const lifecycle = text(v2, "src/processes/completion-handler.ts");
    expect(lifecycle).toContain(
      'const hooks = watchHooks(handlerWriterHooks(), loopLog, "handler-writer");',
    );
    // Each template consumes its loop row's queue (tile-processes review row 6).
    expect(lifecycle).toContain(
      "loopConsumer(config.loops[0], templateHandler(loopLog, config.loops[0], handle), {",
    );
    expect(lifecycle).toContain('openPublisher: () => publisher(s, "publication", scope),');
    expect(lifecycle).toContain(
      '"destinations": [\n            "jobs",\n            "publication"',
    );
    const media = text(v2, "src/processes/transcoder.ts");
    expect(media.indexOf("await verifyVideoRuntime();")).toBeLessThan(
      media.indexOf("await startMediaWorker({"),
    );
    expect(media).toContain(
      "loopConsumer(config.loops[0], templateHandler(loopLog, config.loops[0], handle), consumerHooks),",
    );
    expect(text(v2, "src/processes/view-counter.ts")).toContain(
      'counter: createEventCounter(binding.tables, watchHooks(counterSumHooks(), loopLog, "counter-sum")),',
    );
    const indexer = text(v2, "src/processes/search-indexer.ts");
    expect(indexer).toContain(
      'const hooks = watchHooks(indexerWriterHooks(), loopLog, "indexer-writer");',
    );
    // The search service answers first; then the index opens from the hooks' mapping.
    expect(indexer.indexOf("await client.cluster.health();")).toBeLessThan(
      indexer.indexOf(
        "const index = await openSearchIndex(client, binding.index.resource, hooks);",
      ),
    );
    expect(indexer).toContain("const worker = await startSearchIndexWorker({");
    for (const tile of ["completion-handler", "transcoder", "view-counter", "search-indexer"])
      expect(text(v2, `src/processes/${tile}.ts`)).toContain("scope.ready();");
  });

  it("logs what each template's startup ran, once it has passed and just before ready", () => {
    const started = (tile: string) => {
      const source = text(v2, `src/processes/${tile}.ts`);
      const lines = source.split("\n").filter((item) => item.includes("logStarted(config.tile"));
      expect(source).toMatch(
        /import \{[^}]*logStarted[^}]*\} from "\.\.\/runtime\/tile-process\.ts";/,
      );
      // The last line before the ready marker.
      expect(source.indexOf(lines.at(-1) ?? "?")).toBeLessThan(source.indexOf("scope.ready();"));
      expect(source.slice(source.indexOf(lines.at(-1) ?? "?")).split("\n")[1]).toBe(
        "  scope.ready();",
      );
      return lines.map((item) =>
        JSON.parse(item.trim().slice("logStarted(config.tile, ".length, -2)),
      );
    };
    expect(started("completion-handler")).toEqual([
      {
        module: "handler-writer",
        template: "asset-lifecycle",
        wiring: "mounted",
        checks: [
          "sweep at start",
          "publication relay started",
          "subscribed completion-events--completion-handler",
          "sweep every 30 s",
        ],
      },
    ]);
    expect(started("transcoder")[0]?.checks).toEqual([
      "pinned ffmpeg and ffprobe",
      "results publisher open",
      "subscribed upload-queue",
    ]);
    expect(started("view-counter")[0]?.checks).toEqual([
      "SELECT 1 on its state login",
      "subscribed view-events--view-counter",
    ]);
    expect(started("search-indexer")).toEqual([
      {
        module: "indexer-writer",
        template: "search-projection",
        wiring: "mounted",
        checks: [
          "cluster health",
          "index search-index asserted once its mapping is written",
          "subscribed publication-events--search-indexer",
        ],
      },
    ]);
    // A stub's process logs its probes instead.
    expect(text(stack, "src/processes/visit-worker.ts")).not.toContain("logStarted");
  });

  it("provisions the templates' tables, logins, subscriber and the media image", () => {
    const plan = json(v2, "infra/local.json");
    // The lifecycle's results subscriber, which its template never contributed.
    expect(plan.broker).toContainEqual({
      resource: "completion-events",
      exchange: "completion-events",
      queues: ["completion-events--completion-handler"],
    });
    expect(
      plan.grants.map(
        (item: { host: string; schema: string; relation: string; privileges: string[] }) =>
          `${item.host} ${item.schema}.${item.relation} ${item.privileges.join(",")}`,
      ),
    ).toEqual([
      "upload upload_multipart.assets SELECT,INSERT,UPDATE",
      "completion-handler upload_multipart.assets SELECT,UPDATE",
      "completion-handler upload_multipart.outbox SELECT,INSERT,UPDATE",
      "completion-handler upload_multipart.receipts SELECT,INSERT,UPDATE",
      "upload upload_multipart.uploads SELECT,INSERT,UPDATE",
      "upload upload_multipart.outbox SELECT,INSERT,UPDATE",
      "view-counter counter_sum.receipts SELECT,INSERT,UPDATE",
      "view-counter counter_sum.totals SELECT,INSERT,UPDATE",
      // Watch's View count reader stub reads another owner's database: its published view only.
      "watch counter_sum_public.totals SELECT",
    ]);
    expect(plan.views).toEqual([
      {
        resource: "view-counts",
        schema: "counter_sum_public",
        name: "totals",
        selectSql: 'SELECT aggregate_key,total FROM "counter_sum"."totals"',
      },
    ]);
    // One outbox in the shared schema: multipart creates it, the lifecycle its own tables.
    const lifecycleSql = text(v2, "infra/postgres/metadata-db/100-handler-writer.sql");
    expect(lifecycleSql).toContain('CREATE TABLE "upload_multipart"."assets" (');
    expect(lifecycleSql).toContain('CREATE TABLE "upload_multipart"."receipts" (');
    expect(lifecycleSql).not.toContain("outbox");
    expect(text(v2, "infra/postgres/view-counts/100-counter-sum.sql")).toContain(
      'CREATE TABLE "counter_sum"."totals" (',
    );
    const services = json(v2, "compose.yaml").services as Services;
    expect(services["app-transcoder"]).toMatchObject({
      image: `\${COMPOSE_PROJECT_NAME:?Set COMPOSE_PROJECT_NAME}-media`,
      build: { context: ".", target: "media" },
      stop_grace_period: "21m",
      depends_on: {
        "local-broker": { condition: "service_healthy" },
        "local-objects": { condition: "service_healthy" },
      },
      secrets: ["s3-transcoder", "broker-password"],
    });
    expect(services["app-completion-handler"]).toMatchObject({
      build: { context: ".", target: "app" },
      secrets: ["sql-metadata-db--completion-handler", "broker-password"],
    });
    expect(services["app-view-counter"]?.secrets).toEqual([
      "sql-view-counts--view-counter",
      "broker-password",
    ]);
    // The Index writer probes its index's search service too (tile-processes review row 8).
    expect(services["app-search-indexer"]?.depends_on).toEqual({
      "local-broker": { condition: "service_healthy" },
      "search-search-index": { condition: "service_healthy" },
    });
  });
});

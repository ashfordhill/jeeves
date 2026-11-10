import {
  generationLocalIdentity,
  type NormalizedGenerationSelection,
  type NormalizedProcess,
} from "@jeeves/spec";
import { refuse } from "../json.ts";
import { assetLifecycleSchema } from "./asset-lifecycle.ts";
import { outboxSchema, receiptSchema } from "./durability.ts";
import { eventCounterPersistence } from "./event-counter.ts";
import {
  camel,
  hooksFile,
  type Lead,
  type LoopRow,
  line,
  type ProcessMount,
  pascal,
  pointer,
  resource,
  resources,
  service,
  text,
  throws,
  tileProcess,
  uploadOutbox,
} from "./http-wiring.ts";
import { moduleEntryName, moduleStubPaths } from "./module-stubs.ts";

const tileLoop = "../runtime/tile-loop.ts";
/** A stub loop's bounds (contract section 5): one message at a time, the generic consumer limit. */
const stubLoop = { retryLimit: 5, concurrency: 1 } as const;
const number = (selection: NormalizedGenerationSelection, input: string) => {
  const value = selection.inputs[input];
  if (typeof value !== "number")
    refuse("INVALID_LOCAL_CONTRIBUTION", selection.id, `Its ${input} must be a number.`);
  return value;
};
/** The queue a host consumes: a topic's `<topic>--<host>` subscriber, or the work queue itself. */
function consumed(id: string, mode: string, host: string) {
  const queue = mode === "work-queue" ? id : `${id}--${host}`;
  return { queue, failedQueue: `${queue}.failed` };
}
/** A template's consumed field: its queue, `.failed`, retry limit and concurrency. */
function templateQueue(selection: NormalizedGenerationSelection, field: string, concurrency?: 1) {
  return {
    ...consumed(
      resource(selection, field),
      String(selection.inputs[`${field}.mode`]),
      selection.host,
    ),
    retryLimit: number(selection, `${field}.retryLimit`),
    concurrency: concurrency ?? number(selection, "host.concurrency"),
  };
}
const notImplementedLoop = (what: string, failedQueue: string, code: string) =>
  `${text(`Not implemented: ${what}`)} sends the message to ${failedQueue} (${code})`;
/** One line for each loop row, naming it in the process file. */
const loopLine = (index: number) => `config.loops[${index}]`;
/** Each mounted template's handler starts with its own code; these lines are what they share. */
const own = (name: string) => [
  `  scope.own(() => ${name}.close());`,
  `  scope.transport(${name});`,
];

type Builder = (
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  selections: readonly NormalizedGenerationSelection[],
  index: number,
) => ProcessMount;

/** Asset lifecycle: the worker on its tables (in its upload's schema), its results subscriber and,
 * when bound, its publication relay through the shared outbox. */
const assetLifecycle: Builder = (process, selection, lead, selections, index) => {
  const id = selection.id;
  const binding = selection.binding;
  if (binding.kind !== "asset-lifecycle") throw new Error("Expected an asset lifecycle");
  const hooks = `${camel(lead.module)}Hooks`;
  const types = pascal(lead.module);
  const state = resource(selection, "state");
  const results = resource(selection, "results");
  const publication = binding.publication ? resource(selection, "publication") : undefined;
  // One owner: the lifecycle's tables sit in its upload selection's schema, beside the uploads
  // and the outbox that multipart creates there.
  const upload = selections.find((item) => item.id === binding.upload);
  if (!upload) refuse("INVALID_LOCAL_CONTRIBUTION", id, "Bind its upload selection.");
  const outbox = uploadOutbox(upload.id, selections);
  const schema = outbox.schema;
  const sharedOutbox =
    upload.binding.kind === "owned-multipart" && upload.target.kind === "component";
  const relation = { schema, table: "assets" };
  const receipts = { schema, table: "receipts" };
  const loop = templateQueue(selection, "results");
  const members = [
    "metadata",
    "event",
    "result",
    "failure",
    "job.codec",
    "job.construct",
    "response",
    ...(publication ? ["publication.codec", "publication.construct"] : []),
    "identities.request",
    "identities.result",
    ...(publication ? ["identities.publication"] : []),
  ];
  const hook = (name: string, signature: string, comment: string, depth = 4) => [
    `${" ".repeat(depth)}/** ${comment} */`,
    `${" ".repeat(depth)}${signature} {`,
    `${" ".repeat(depth + 2)}${throws(name, lead)}`,
    `${" ".repeat(depth)}},`,
  ];
  const grants = [
    { host: upload.host, relation, privileges: ["SELECT", "INSERT", "UPDATE"] as const },
    ...(sharedOutbox
      ? []
      : [
          {
            host: upload.host,
            relation: outbox,
            privileges: ["SELECT", "INSERT", "UPDATE"] as const,
          },
        ]),
    { host: process.tile, relation, privileges: ["SELECT", "UPDATE"] as const },
    { host: process.tile, relation: outbox, privileges: ["SELECT", "INSERT", "UPDATE"] as const },
    { host: process.tile, relation: receipts, privileges: ["SELECT", "INSERT", "UPDATE"] as const },
  ];
  return {
    imports: [
      { from: resources, name: "consumer" },
      { from: resources, name: "pool" },
      ...(publication ? [{ from: resources, name: "publisher" }] : []),
      { from: resources, name: "selected" },
      { from: "../runtime/asset-lifecycle.ts", name: "createAssetLifecycle" },
      { from: "../runtime/asset-worker.ts", name: "startAssetLifecycleWorker" },
      { from: tileLoop, name: "templateHandler" },
      { from: tileLoop, name: "watchHooks" },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: the asset lifecycle's worker on its tables, its results subscriber${publication ? " and its publication relay" : ""}.`,
      "await (async () => {",
      `  const s = selected("asset-lifecycle", ${text(id)});`,
      `  const binding = config.templates[${text(id)}];`,
      `  const db = pool(scope, s, "state");`,
      `  const hooks = watchHooks(${hooks}(), loopLog, ${text(lead.module)});`,
      "  const lifecycle = createAssetLifecycle(",
      "    { ...binding.lifecycle, identities: hooks.identities },",
      publication
        ? "    { ...hooks, publication: { ...hooks.publication, destination: binding.publication } },"
        : "    hooks,",
      "  );",
      "  const worker = await startAssetLifecycleWorker({",
      "    pool: db,",
      "    lifecycle,",
      "    openConsumer: (handle) =>",
      `      consumer(s, "results", templateHandler(loopLog, ${loopLine(index)}, handle), {`,
      "        onFatal: scope.fail,",
      "      }),",
      ...(publication
        ? [
            "    publication: {",
            "      outbox: lifecycle.publications!,",
            `      openPublisher: () => publisher(s, "publication", scope),`,
            "    },",
          ]
        : []),
      "  });",
      ...own("worker"),
      "})();",
    ],
    configure: [],
    initialize: [],
    started: [],
    config: [
      id,
      {
        template: "asset-lifecycle",
        lead: lead.module,
        lifecycle: {
          relation,
          receipts,
          receiptScope: id,
          outbox,
          jobsDestination: "jobs",
        },
        ...(publication && { publication: "publication" }),
      },
    ],
    routes: [],
    loops: [
      {
        module: lead.module,
        ...loop,
        answers: `${notImplementedLoop(`event for ${lead.name}`, loop.failedQueue, "MALFORMED_MESSAGE")} until its hooks are written`,
      },
    ],
    template: { selection: id, template: "asset-lifecycle", level: "mounted" },
    hooks: {
      members,
      file: hooksFile(process, selection, lead, "asset lifecycle", {
        imports: [
          'import type { AssetLifecycleBinding, AssetLifecycleHooks } from "../../runtime/asset-lifecycle.ts";',
        ],
        types: [
          "type Hooks = AssetLifecycleHooks<unknown, unknown, unknown, unknown, unknown>;",
          `/** The template's hooks${publication ? "; its process names the publication's outbox destination" : ""}. */`,
          `export type ${types}Hooks = Omit<Hooks, "publication"> & {`,
          ...(publication
            ? ['  publication: Omit<NonNullable<Hooks["publication"]>, "destination">;']
            : []),
          '  identities: AssetLifecycleBinding["identities"];',
          "};",
        ],
        reached: "the first one a message reaches sends it to .failed",
        factory: [
          `export function ${hooks}(): ${types}Hooks {`,
          "  return {",
          ...hook("metadata", "metadata(input)", "Parses an asset's stored metadata."),
          ...hook("event", "event(input)", "Parses a processing event from the results queue."),
          ...hook(
            "result",
            "result(input, identity)",
            "Parses a succeeded event's result for its job.",
          ),
          ...hook(
            "failure",
            "failure(input)",
            "Maps a failed event's code to a bounded failure label.",
          ),
          "    job: {",
          ...hook(
            "job.codec",
            "codec(input, eventId)",
            "Parses the job a completed upload publishes.",
            6,
          ),
          ...hook(
            "job.construct",
            "async construct(tx, input)",
            "Builds that job inside the completion transaction.",
            6,
          ),
          "    },",
          ...hook("response", "response(input)", "What completing an upload answers."),
          ...(publication
            ? [
                "    publication: {",
                ...hook(
                  "publication.codec",
                  "codec(input, eventId)",
                  "Parses what a ready asset publishes.",
                  6,
                ),
                ...hook(
                  "publication.construct",
                  "async construct(tx, ready, eventId)",
                  "Builds it inside the transaction that marks the asset ready.",
                  6,
                ),
                "    },",
              ]
            : []),
          "    identities: {",
          ...hook(
            "identities.request",
            "request(identity)",
            "The stable event ID of a job request.",
            6,
          ),
          ...hook(
            "identities.result",
            "result(identity, kind)",
            "The stable event ID of a job's started, succeeded or failed event.",
            6,
          ),
          ...(publication
            ? hook(
                "identities.publication",
                "publication(assetId)",
                "The stable event ID of an asset's publication.",
                6,
              )
            : []),
          "    },",
          "  };",
          "}",
        ],
      }),
    },
    service: {
      ...service(),
      dependsOn: [state, results, ...(publication ? [publication] : [])],
      sql: [state],
      broker: true,
    },
    local: {
      migrations: [
        {
          resource: state,
          id: `100-${id}.sql`,
          sql:
            assetLifecycleSchema(relation) +
            receiptSchema(receipts) +
            (sharedOutbox ? "" : outboxSchema(outbox)),
        },
      ],
      logins: [...new Set([upload.host, process.tile])].map((host) => ({ resource: state, host })),
      grants: grants.map(({ host, relation, privileges }) => ({
        resource: state,
        host,
        schema: relation.schema,
        relation: relation.table,
        kind: "table" as const,
        privileges: [...privileges],
      })),
      // The results subscriber the lifecycle consumes (the template contributes none of its own).
      broker: [{ resource: results, host: process.tile }],
    },
  };
};

/** Video HLS: the media worker on its buckets, jobs queue and results publisher, after checking
 * the pinned FFmpeg. It runs in the media image. */
const videoHls: Builder = (process, selection, lead, _selections, index) => {
  const id = selection.id;
  const hooks = `${camel(lead.module)}Hooks`;
  const types = pascal(lead.module);
  const fields = ["originals", "outputs", "jobs", "results"].map((field) =>
    resource(selection, field),
  );
  const [originals = "", outputs = ""] = fields;
  const loop = templateQueue(selection, "jobs", 1);
  const codec = (name: string, signature: string, comment: string) => [
    `    /** ${comment} */`,
    `    ${signature} {`,
    `      ${throws(name, lead)}`,
    "    },",
  ];
  const owns = (name: "source" | "results", comment: string) => [
    `    ${name}: {`,
    `      /** ${comment} */`,
    "      owns(job: VideoHlsJob): boolean {",
    `        ${throws(`${name}.owns`, lead)}`,
    "      },",
    "    },",
  ];
  return {
    imports: [
      { from: resources, name: "consumer" },
      { from: resources, name: "objects" },
      { from: resources, name: "publisher" },
      { from: resources, name: "resource" },
      { from: resources, name: "selected" },
      { from: "../features/video-runtime.ts", name: "verifyVideoRuntime" },
      { from: "../runtime/media-objects.ts", name: "createMediaObjects" },
      { from: "../runtime/media-worker.ts", name: "startMediaWorker" },
      { from: tileLoop, name: "templateHandler" },
      { from: tileLoop, name: "watchHooks" },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: the video HLS media worker on its buckets, jobs queue and results publisher.`,
      "await (async () => {",
      `  const s = selected("video-hls", ${text(id)});`,
      `  const binding = config.templates[${text(id)}];`,
      "  await verifyVideoRuntime();",
      `  const originals = resource(s, "originals");`,
      `  const outputs = resource(s, "outputs");`,
      `  const hooks = watchHooks(${hooks}({ originals, outputs }), loopLog, ${text(lead.module)});`,
      "  const worker = await startMediaWorker({",
      "    codecs: hooks.codecs,",
      "    objects: createMediaObjects({",
      "      source: { client: objects(s), bucket: originals, owns: hooks.source.owns },",
      "      results: { client: objects(s), bucket: outputs, owns: hooks.results.owns },",
      "      sha256Metadata: binding.sha256Metadata,",
      "    }),",
      `    openPublisher: () => publisher(s, "results", scope),`,
      "    openConsumer: ({ handle, ...consumerHooks }) =>",
      `      consumer(s, "jobs", templateHandler(loopLog, ${loopLine(index)}, handle), consumerHooks),`,
      "    onFatal: scope.fail,",
      "  });",
      ...own("worker"),
      "})();",
    ],
    configure: [],
    initialize: [],
    started: [],
    config: [id, { template: "video-hls", lead: lead.module, sha256Metadata: "sha256" }],
    routes: [],
    loops: [
      {
        module: lead.module,
        ...loop,
        answers: `${notImplementedLoop(`job for ${lead.name}`, loop.failedQueue, "MALFORMED_MESSAGE")} until its hooks are written`,
      },
    ],
    template: { selection: id, template: "video-hls", level: "mounted" },
    hooks: {
      members: ["job", "video", "result", "eventId", "event", "source.owns", "results.owns"],
      file: hooksFile(process, selection, lead, "video HLS", {
        imports: [
          'import type { MediaCodecs } from "../../runtime/media-worker.ts";',
          'import type { VideoHlsJob } from "../../runtime/video-result.ts";',
        ],
        types: [
          "/** The template's generic resources: its source and results buckets. */",
          `export type ${types}Resources = { originals: string; outputs: string };`,
        ],
        reached: "the first one a message reaches sends it to .failed",
        factory: [
          `export function ${hooks}(resources: ${types}Resources) {`,
          "  const codecs: MediaCodecs<unknown, unknown> = {",
          ...codec("job", "job(raw, messageId)", "Parses a job message and binds its message ID."),
          ...codec("video", "video(job)", "The job's source object and immutable result prefix."),
          ...codec("result", "result(raw, job)", "Parses a finished job's result."),
          ...codec(
            "eventId",
            "eventId(job, kind)",
            "The stable event ID of a job's started, succeeded or failed event.",
          ),
          ...codec("event", "event(job, event)", "Builds the event the results queue receives."),
          "  };",
          "  return {",
          "    codecs,",
          ...owns("source", "Whether the job's source object is in this worker's namespace."),
          ...owns("results", "Whether the job's result prefix is in this worker's namespace."),
          "  };",
          "}",
        ],
      }),
    },
    service: {
      ...service(),
      dependsOn: [...new Set(fields)],
      storage: [...new Set([originals, outputs])],
      broker: true,
      target: "media",
    },
    local: {},
  };
};

/** Event counter: the counter worker on its tables and public totals view, on its events
 * subscriber. */
const eventCounter: Builder = (process, selection, lead, _selections, index) => {
  const id = selection.id;
  const hooks = `${camel(lead.module)}Hooks`;
  const state = resource(selection, "state");
  const events = resource(selection, "events");
  const schema = generationLocalIdentity(id).sql;
  const tables = {
    receipts: { schema, table: "receipts" },
    totals: { schema, table: "totals" },
  };
  const persistence = eventCounterPersistence({
    resource: state,
    writerHost: process.tile,
    tables,
    publicView: { schema: `${schema}_public`, table: "totals" },
    migrationId: `100-${id}.sql`,
    sourcePaths: [pointer(selection.sourcePath)],
  });
  const loop = templateQueue(selection, "events");
  const hook = (name: string, signature: string, comment: string) => [
    `    /** ${comment} */`,
    `    ${signature} {`,
    `      ${throws(name, lead)}`,
    "    },",
  ];
  return {
    imports: [
      { from: resources, name: "consumer" },
      { from: resources, name: "pool" },
      { from: resources, name: "selected" },
      { from: "../runtime/counter-worker.ts", name: "startCounterWorker" },
      { from: "../runtime/event-counter.ts", name: "createEventCounter" },
      { from: tileLoop, name: "templateHandler" },
      { from: tileLoop, name: "watchHooks" },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: the event counter's worker on its tables and its events subscriber.`,
      "await (async () => {",
      `  const s = selected("event-counter", ${text(id)});`,
      `  const binding = config.templates[${text(id)}];`,
      `  const db = pool(scope, s, "state");`,
      `  await db.query("SELECT 1");`,
      "  const worker = await startCounterWorker({",
      "    pool: db,",
      `    counter: createEventCounter(binding.tables, watchHooks(${hooks}(), loopLog, ${text(lead.module)})),`,
      "    openConsumer: (handle) =>",
      `      consumer(s, "events", templateHandler(loopLog, ${loopLine(index)}, handle), {`,
      "        onFatal: scope.fail,",
      "      }),",
      "  });",
      ...own("worker"),
      "})();",
    ],
    configure: [],
    initialize: [],
    started: [],
    config: [id, { template: "event-counter", lead: lead.module, tables }],
    routes: [],
    loops: [
      {
        module: lead.module,
        ...loop,
        answers: `${notImplementedLoop(`event for ${lead.name}`, loop.failedQueue, "MALFORMED_MESSAGE")} until its hooks are written`,
      },
    ],
    template: { selection: id, template: "event-counter", level: "mounted" },
    hooks: {
      members: ["event", "aggregateKey", "eventId", "identity"],
      file: hooksFile(process, selection, lead, "event counter", {
        imports: ['import type { CounterAdapter } from "../../runtime/event-counter.ts";'],
        types: [],
        reached: "the first one a message reaches sends it to .failed",
        factory: [
          `export function ${hooks}(): CounterAdapter<unknown> {`,
          "  return {",
          ...hook("event", "event(input, messageId)", "Parses an event and binds its message ID."),
          ...hook("aggregateKey", "aggregateKey(event)", "What the event counts towards."),
          ...hook("eventId", "eventId(event)", "The event's stable ID: a repeat counts once."),
          ...hook("identity", "identity(event)", "The event data a repeat must match."),
          "  };",
          "}",
        ],
      }),
    },
    service: { ...service(), dependsOn: [state, events], sql: [state], broker: true },
    local: {
      migrations: persistence.migrations ?? [],
      logins: persistence.logins ?? [],
      grants: persistence.grants ?? [],
      views: persistence.views ?? [],
    },
  };
};

/** Search projection: a placeholder. Its loop sends each message to .failed until a mapping and
 * an event codec exist, which are product data, not hooks (tile process contract, section 3). */
const searchProjection: Builder = (_process, selection, lead, _selections, index) => {
  const id = selection.id;
  const events = resource(selection, "events");
  const loop = templateQueue(selection, "events");
  const what = `search mapping and event codec for ${lead.name}`;
  return {
    imports: [
      { from: tileLoop, name: "startModuleLoop" },
      { from: tileProcess, name: "NotImplemented" },
    ],
    setup: [
      `// ${line(lead.name)} (placeholder): a loop on its events subscriber; no mapping or event codec exists yet.`,
      `await startModuleLoop(scope, loopLog, ${loopLine(index)}, async () => {`,
      `  throw new NotImplemented(${text(what)});`,
      "});",
    ],
    configure: [],
    initialize: [],
    started: [],
    config: [id, { template: "search-projection", lead: lead.module, placeholder: true }],
    routes: [],
    loops: [
      {
        module: lead.module,
        ...loop,
        answers: `${notImplementedLoop(what, loop.failedQueue, "NOT_IMPLEMENTED")} (placeholder)`,
      },
    ],
    template: { selection: id, template: "search-projection", level: "placeholder" },
    service: { ...service(), dependsOn: [events], broker: true },
    local: {},
  };
};

const builders: Record<string, Builder> = {
  "asset-lifecycle": assetLifecycle,
  "video-hls": videoHls,
  "event-counter": eventCounter,
  "search-projection": searchProjection,
};

/** A loop stub: one loop per queue it consumes, calling its entry point with each message and its
 * dependencies (`client-wiring.ts`). Its queues are provisioned with the tile's other stub stores. */
function stubLoops(
  process: NormalizedProcess,
  stub: NormalizedProcess["stubs"][number],
  selection: NormalizedGenerationSelection,
  first: number,
): ProcessMount {
  const module = selection.module;
  if (!module) refuse("INVALID_LOCAL_CONTRIBUTION", selection.id, "A loop stub needs its module.");
  const id = generationLocalIdentity(module.component).local;
  const paths = moduleStubPaths(process.tile, module.component);
  const entry = moduleEntryName(module.component);
  const from = (path: string) => `../${path.slice("src/".length)}`;
  const loops: LoopRow[] = (stub.consumes ?? []).map((queue) => {
    const names = consumed(generationLocalIdentity(queue.element).local, queue.mode, process.tile);
    return {
      module: id,
      ...names,
      ...stubLoop,
      answers: `${notImplementedLoop(module.name, names.failedQueue, "NOT_IMPLEMENTED")} until it is written; other errors retry ${stubLoop.retryLimit} times`,
    };
  });
  return {
    imports: [
      { from: tileLoop, name: "startModuleLoop" },
      { from: from(paths.module), name: entry },
    ],
    setup: loops.flatMap((loop, offset) => [
      `// ${line(module.name)}: a loop on ${loop.queue}.`,
      `await startModuleLoop(scope, loopLog, ${loopLine(first + offset)}, (message) =>`,
      `  ${entry}(dependencies[${text(id)}], message),`,
      ");",
    ]),
    configure: [],
    initialize: [],
    started: [],
    routes: [],
    loops,
    service: service(),
    local: {},
  };
}

/**
 * Everything a process runs in loops (tile process contract, sections 3-5): its worker templates
 * in order, then each loop stub's loops. Loops are numbered in this order: `config.loops[n]`.
 */
export function loopMounts(
  process: NormalizedProcess,
  selections: readonly NormalizedGenerationSelection[],
): ProcessMount[] {
  const mounts: ProcessMount[] = [];
  let next = 0;
  for (const row of process.templates) {
    const selection = selections.find((item) => item.id === row.selection);
    const build = selection && builders[selection.binding.kind];
    if (!selection || !build || !row.lead) continue;
    const mount = build(process, selection, row.lead, selections, next);
    next += mount.loops.length;
    mounts.push(mount);
  }
  for (const stub of process.stubs) {
    if (stub.role !== "loop") continue;
    const selection = selections.find((item) => item.id === stub.selection);
    if (!selection) continue;
    const mount = stubLoops(process, stub, selection, next);
    next += mount.loops.length;
    mounts.push(mount);
  }
  return mounts;
}

import {
  generationLocalIdentity,
  type NormalizedGenerationSelection,
  type NormalizedProcess,
  studioComponentDefinitions,
} from "@jeeves/spec";
import { pointerPart, refuse } from "../json.ts";
import { type OutboxTable, outboxSchema } from "./durability.ts";
import { favoritesBounds, favoritesSchema } from "./favorites.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import { moduleEntryName, moduleHooksPath, moduleStubPaths } from "./module-stubs.ts";
import type { V2TemplateFile } from "./registry.ts";
import { ownedUploadPersistence } from "./upload-state.ts";

export type Lead = NonNullable<NormalizedProcess["templates"][number]["lead"]>;
type Route = { method: string; path: string; answers: string };
/** One import binding: a value or a type, from a path relative to `src/processes/`. */
export type Import = { from: string; name: string; type?: true };
/** One loop a process runs (tile process contract, section 5): the process config's `loops` row
 * its code reads, and what a message that fails there answers, for the report. */
export type LoopRow = {
  module: string;
  queue: string;
  failedQueue: string;
  retryLimit: number;
  concurrency: number;
  answers: string;
};

/**
 * What a process mounts for one template or stub (tile process contract, sections 3-5): the
 * lines it adds to the process file, the routes and loops it answers, its hooks file and what the
 * foundation must provision for it.
 */
export type ProcessMount = {
  imports: Import[];
  /** Inside `runProcess`, before an HTTP service is created; a worker's whole start. */
  setup: string[];
  /** Inside `configure(routes)`. */
  configure: string[];
  /** Inside `initialize()`, before listening. */
  initialize: string[];
  /** After listening, before the ready marker. */
  started: string[];
  /** The process config's `templates` row. */
  config?: [string, unknown];
  routes: Route[];
  loops: LoopRow[];
  template?: { selection: string; template: string; level: "mounted" | "placeholder" };
  /** A template's `started` line, logged just before the ready marker: what its startup ran. */
  startup?: { module: string; checks: string[] };
  hooks?: { file: V2TemplateFile; members: string[] };
  /** The tile's sign-in (an Auth guard's): every module route of the process is mounted through
   * `<guard>.routes(...)`, and route stubs get `<guard>.caller`. */
  guard?: string;
  service: {
    dependsOn: string[];
    sql: string[];
    storage: string[];
    cache: string[];
    broker: boolean;
    identity?: string;
    environment?: Record<string, string>;
    /** The media image, for a process that runs Video HLS. */
    target?: "media";
  };
  local: Pick<V2LocalContribution, "logins" | "migrations" | "grants" | "views" | "broker">;
};

export const pointer = (path: readonly (string | number)[]) =>
  `/${path.map((part) => pointerPart(String(part))).join("/")}`;
/** One comment line: names are the user's own text. */
export const line = (text: string) => text.replace(/[\p{Cc}\u2028\u2029]/gu, " ");
export const camel = (slug: string) =>
  slug.replace(/-([a-z0-9])/g, (_match, next: string) => next.toUpperCase());
export const pascal = (slug: string) => camel(`-${slug}`);
export const text = (value: string) => JSON.stringify(value);
export const service = (): ProcessMount["service"] => ({
  dependsOn: [],
  sql: [],
  storage: [],
  cache: [],
  broker: false,
});
export const resource = (selection: NormalizedGenerationSelection, field: string) => {
  const binding = selection.resources.find((item) => item.field === field);
  if (!binding) refuse("INVALID_LOCAL_CONTRIBUTION", selection.id, `Bind its ${field}.`);
  return binding.identity.local;
};
const notImplementedAnswer = (what: string) =>
  `501 ${text(`Not implemented: ${what}`)} until its hooks are written`;
export const resources = "../features/service-resources.ts";
export const tileProcess = "../runtime/tile-process.ts";
const tileHttp = "../runtime/tile-http.ts";

/** The hooks file: a factory over the template's generic resources; every member throws. */
export function hooksFile(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  template: string,
  body: { imports: string[]; types: string[]; factory: string[]; reached?: string },
): V2TemplateFile {
  return {
    path: moduleHooksPath(process.tile, lead.module),
    content: `${[
      `// ${line(lead.name)} (${studioComponentDefinitions[lead.kind].name}) in ${line(process.name)}: the product hooks its ${template} template calls.`,
      "// Write them here. Export never overwrites your edits: export afresh and carry them over.",
      ...body.imports,
      'import { NotImplemented } from "../../runtime/tile-process.ts";',
      "",
      ...body.types,
      "",
      `/** Each hook throws "Not implemented" until written; ${body.reached ?? "the first one a route reaches answers 501"}. */`,
      ...body.factory,
    ].join("\n")}\n`,
    ownership: "generated-extension",
    sourcePaths: ["/generation/processes", pointer(selection.sourcePath)],
  };
}
/** The Index writer's hooks file and its factory: the mapping and document the search query on
 * the same index reads too (v3 contract, section 5). */
export function indexHooks(process: { tile: string }, lead: Lead) {
  return {
    path: moduleHooksPath(process.tile, lead.module),
    factory: `${camel(lead.module)}Hooks`,
    document: `${pascal(lead.module)}Document`,
  };
}

export const throws = (hook: string, lead: Lead) =>
  `throw new NotImplemented(${text(`${hook} for ${lead.name}`)});`;

/** Cache reader: the positive reader on its source login and cache, at GET /modules/<lead>/:key. */
function positiveCacheRead(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
): ProcessMount {
  const id = selection.id;
  const name = camel(id);
  const hooks = `${camel(lead.module)}Hooks`;
  const types = pascal(lead.module);
  const source = resource(selection, "source");
  const cache = resource(selection, "cache");
  const url = `/modules/${lead.module}/:key`;
  const members = ["key", "codec", "eligible", "load", "expiresAt"];
  return {
    imports: [
      { from: resources, name: "input" },
      { from: resources, name: "pool" },
      { from: resources, name: "selected" },
      { from: "../features/positive-cache-bindings.ts", name: "positiveCacheBindings" },
      { from: "../runtime/http.ts", name: "HttpError" },
      { from: "../runtime/positive-cache.ts", name: "createPositiveReader" },
      { from: "../runtime/valkey.ts", name: "createValkeyCache" },
      { from: tileHttp, name: "notImplementedRoutes" },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: the cache read template's reader on the source login and the cache.`,
      `const ${name} = await (async () => {`,
      `  const s = selected("positive-cache-read", ${text(id)});`,
      `  const source = pool(scope, s, "source");`,
      "  const cache = await createValkeyCache({",
      `    binding: positiveCacheBindings[${text(id)}].cache,`,
      "    onState: (state, error) =>",
      '      state === "unavailable"',
      `        ? failure(${text(`cache ${lead.module}`)}, error ?? new Error("Cache unavailable"))`,
      `        : console.log(JSON.stringify({ level: "info", event: "cache", tile: config.tile, module: ${text(lead.module)}, state })),`,
      "  });",
      "  scope.own(() => cache.close());",
      "  const read = createPositiveReader({",
      `    adapter: ${hooks}({ source }),`,
      "    cache,",
      `    ttlSeconds: input(s, "cache.ttlSeconds"),`,
      `    onFailure: (what, error) => failure(\`\${what} ${lead.module}\`, error),`,
      "  });",
      "  return { source, read };",
      "})();",
    ],
    configure: [
      `notImplementedRoutes(routes, log, ${text(lead.module)}).route({`,
      `  method: "GET",`,
      `  url: ${text(url)},`,
      "  handler: async (request) => {",
      `    const record = await ${name}.read({ key: (request.params as { key: string }).key });`,
      `    if (record === null) throw new HttpError(404, "NOT_FOUND", "No record for this key.");`,
      "    return record;",
      "  },",
      "});",
    ],
    initialize: [`await ${name}.source.query("SELECT 1");`],
    started: [],
    config: [id, { template: "positive-cache-read", lead: lead.module, route: url }],
    routes: [{ method: "GET", path: url, answers: notImplementedAnswer(`key for ${lead.name}`) }],
    loops: [],
    template: { selection: id, template: "positive-cache-read", level: "mounted" },
    startup: { module: lead.module, checks: ["SELECT 1 on its source login"] },
    hooks: {
      members,
      file: hooksFile(process, selection, lead, "cache read", {
        imports: [
          'import type pg from "pg";',
          'import type { PositiveReadAdapter } from "../../runtime/positive-cache.ts";',
        ],
        types: [
          `/** What GET ${url} reads: the path's key. */`,
          `export type ${types}Input = { key: string };`,
          "/** The template's generic resources: a pool on the source database's login. */",
          `export type ${types}Resources = { source: pg.Pool };`,
        ],
        factory: [
          `export function ${hooks}(resources: ${types}Resources): PositiveReadAdapter<${types}Input, unknown> {`,
          "  return {",
          "    /** The cache key for a request. */",
          "    key(input) {",
          `      ${throws("key", lead)}`,
          "    },",
          "    /** Parses a cached or loaded record. */",
          "    codec: {",
          "      parse(value) {",
          `        ${throws("codec", lead)}`,
          "      },",
          "    },",
          "    /** Whether a record may be answered for this request. */",
          "    eligible(record, input) {",
          `      ${throws("eligible", lead)}`,
          "    },",
          "    /** Reads the record from the source database: null when there is none. */",
          "    async load(input) {",
          `      ${throws("load", lead)}`,
          "    },",
          "    /** When a record stops being valid, in UTC milliseconds, or null. */",
          "    expiresAt(record) {",
          `      ${throws("expiresAt", lead)}`,
          "    },",
          "  };",
          "}",
        ],
      }),
    },
    service: { ...service(), dependsOn: [source, cache], sql: [source], cache: [cache] },
    local: { logins: [{ resource: source, host: process.tile }] },
  };
}

/**
 * The outbox in an upload selection's schema. Multipart enqueues its jobs there; an asset
 * lifecycle that names this upload shares the schema (one owner) and adds its publication.
 */
export function uploadOutbox(
  upload: string,
  selections: readonly NormalizedGenerationSelection[],
): OutboxTable {
  const publication = selections.some(
    (s) =>
      s.binding.kind === "asset-lifecycle" && s.binding.upload === upload && s.binding.publication,
  );
  return {
    schema: generationLocalIdentity(upload).sql,
    table: "outbox",
    destinations: ["jobs", ...(publication ? ["publication"] : [])],
  };
}

/**
 * The asset lifecycle that names an upload, and its binding: its tables sit in the upload
 * selection's schema beside the uploads and the shared outbox. Its worker runs it on its own tile;
 * the upload's tile runs its upload hooks (v3 contract, section 2, "Also in V3-06").
 */
export function uploadLifecycle(
  upload: NormalizedGenerationSelection,
  selections: readonly NormalizedGenerationSelection[],
) {
  const selection = selections.find(
    (item) => item.binding.kind === "asset-lifecycle" && item.binding.upload === upload.id,
  );
  if (selection?.binding.kind !== "asset-lifecycle") return undefined;
  const outbox = uploadOutbox(upload.id, selections);
  const lead = selection.target.kind === "component" ? selection.target.component : undefined;
  return {
    selection,
    lead,
    publication: !!selection.binding.publication,
    binding: {
      relation: { schema: outbox.schema, table: "assets" },
      receipts: { schema: outbox.schema, table: "receipts" },
      receiptScope: selection.id,
      outbox,
      jobsDestination: "jobs",
    },
  };
}

/** The process's sign-in, when its tile has an Auth guard's template: the variable it is in. */
export function tileGuard(
  process: NormalizedProcess,
  selections: readonly NormalizedGenerationSelection[],
) {
  const guard = selections.find(
    (item) => item.host === process.tile && item.binding.kind === "verified-identity",
  );
  return guard ? camel(guard.id) : undefined;
}

/** Auth guard: the tile's sign-in. Every module route checks its caller, Required or Optional,
 * and GET /modules/<guard>/me answers who it is. */
function verifiedIdentity(
  _process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
): ProcessMount {
  const id = selection.id;
  const name = camel(id);
  const identity = selection.identity?.element;
  if (!identity) refuse("INVALID_LOCAL_CONTRIBUTION", id, "An Auth guard needs its identity.");
  const signIn = selection.inputs["guard.signIn"] === "optional" ? "optional" : "required";
  const url = `/modules/${lead.module}/me`;
  return {
    imports: [
      { from: "../runtime/identity.ts", name: "createPrincipalVerifier" },
      { from: "../runtime/tile-guard.ts", name: "createTileGuard" },
    ],
    setup: [
      `// ${line(lead.name)}: the tile's sign-in, ${signIn === "required" ? "Required: every module route needs a valid token" : "Optional: a token sent with a request is verified; none is anonymous"}.`,
      `const ${name} = (() => {`,
      `  const binding = config.templates[${text(id)}];`,
      "  return createTileGuard({",
      "    signIn: binding.signIn,",
      "    verify: createPrincipalVerifier({",
      `      issuer: process.env.OIDC_ISSUER ?? "",`,
      `      audience: \`\${binding.identity}-web\`,`,
      `      jwksUrl: process.env.OIDC_JWKS_URL ?? "",`,
      `      algorithms: ["RS256"],`,
      "      jwksTimeoutMs: 3000,",
      "    }),",
      "  });",
      "})();",
    ],
    configure: [`${name}.me(routes, ${text(url)});`],
    initialize: [],
    started: [],
    config: [id, { template: "verified-identity", lead: lead.module, identity, signIn, me: url }],
    routes: [
      {
        method: "GET",
        path: url,
        answers: `200 {signedIn, subject, username} for a signed-in caller${signIn === "optional" ? " or {signedIn: false} without a token" : ""}; 401 SIGN_IN_REQUIRED for ${signIn === "required" ? "a missing or invalid token" : "an invalid token"}`,
      },
    ],
    loops: [],
    template: { selection: id, template: "verified-identity", level: "mounted" },
    startup: {
      module: lead.module,
      checks: [
        signIn === "required"
          ? "sign-in Required on every module route"
          : "sign-in Optional on every module route",
      ],
    },
    guard: name,
    service: { ...service(), identity },
    local: {},
  };
}

/** Multipart uploads: the engine on its own tables, objects and jobs outbox, with a sweep. Its
 * caller is the tile's Required sign-in, and an asset lifecycle naming it gets its upload hooks. */
function ownedMultipart(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  selections: readonly NormalizedGenerationSelection[],
  processes: readonly NormalizedProcess[],
): ProcessMount {
  const id = selection.id;
  const name = camel(id);
  const hooks = `${camel(lead.module)}Hooks`;
  const types = pascal(lead.module);
  const state = resource(selection, "state");
  const objects = resource(selection, "objects");
  const jobs = resource(selection, "jobs");
  const identity = selection.identity?.element;
  if (!identity) refuse("INVALID_LOCAL_CONTRIBUTION", id, "Multipart uploads needs its identity.");
  const guard = tileGuard(process, selections);
  if (!guard)
    refuse("INVALID_LOCAL_CONTRIBUTION", id, "Multipart uploads needs its tile's Auth guard.");
  const lifecycle = uploadLifecycle(selection, selections);
  const lifecycleHost = lifecycle?.selection.host;
  const lifecycleLead = lifecycle?.lead;
  const lifecycleHooks = lifecycleLead && `${camel(lifecycleLead)}Hooks`;
  // The generic schema rule: one private schema per template selection, named from its ID.
  const schema = generationLocalIdentity(id).sql;
  const uploads = { schema, table: "uploads" };
  const outbox = uploadOutbox(id, selections);
  const persistence = ownedUploadPersistence({
    resource: state,
    host: process.tile,
    relation: uploads,
    migrationId: `100-${id}.sql`,
    sourcePaths: [pointer(selection.sourcePath)],
  });
  const base = `/modules/${lead.module}/uploads`;
  const mounts = [
    { operation: "start", method: "POST", url: base },
    { operation: "list", method: "GET", url: base },
    { operation: "status", method: "GET", url: `${base}/:uploadId` },
    { operation: "sign", method: "POST", url: `${base}/:uploadId/parts/:partNumber` },
    { operation: "complete", method: "POST", url: `${base}/:uploadId/complete` },
    { operation: "abort", method: "POST", url: `${base}/:uploadId/abort` },
  ];
  // The hooks that answer "Not implemented" until written: the sign-in answers `principal`, and
  // an asset lifecycle naming the upload answers `reserve`, `complete` and `closed`.
  const members = [
    "validate",
    "metadata",
    "response",
    ...(lifecycle ? [] : ["reserve", "complete", "closed"]),
    "originalKey",
    "job",
  ];
  const upload = (hook: string, signature: string, comment: string) => [
    `    /** ${comment} */`,
    `    ${signature} {`,
    `      ${throws(hook, lead)}`,
    "    },",
  ];
  /** A hook the asset lifecycle naming this upload answers: it delegates to it. */
  const delegated = (hook: string, signature: string, call: string, comment: string) =>
    lifecycle
      ? [
          `    /** ${comment} The asset lifecycle answers it. */`,
          `    ${signature} {`,
          `      return resources.lifecycle.${hook}(${call});`,
          "    },",
        ]
      : upload(hook, signature, comment);
  // The lifecycle's lead and tile by name, for the hooks file.
  const lifecycleProcess = processes.find((item) => item.tile === lifecycleHost);
  const lifecycleName = lifecycle
    ? `${
        lifecycleProcess?.templates.find((item) => item.selection === lifecycle.selection.id)?.lead
          ?.name ?? lifecycle.selection.id
      } in ${lifecycleProcess?.name ?? lifecycleHost}`
    : undefined;
  return {
    imports: [
      { from: resources, name: "objects" },
      { from: resources, name: "pool" },
      { from: resources, name: "publisher" },
      { from: resources, name: "resource" },
      { from: resources, name: "selected" },
      ...(lifecycle && lifecycleHooks
        ? [
            { from: "../runtime/asset-lifecycle.ts", name: "createAssetLifecycle" },
            {
              from: `../modules/${lifecycleHost}/${lifecycleLead}.hooks.ts`,
              name: lifecycleHooks,
            },
          ]
        : []),
      { from: "../runtime/multipart-http.ts", name: "createMultipartHttpHandlers" },
      { from: "../runtime/multipart-objects.ts", name: "createMultipartObjects" },
      { from: "../runtime/multipart.ts", name: "createOwnedMultipart" },
      { from: "../runtime/outbox.ts", name: "createOutbox" },
      { from: "../runtime/outbox.ts", name: "startRelay" },
      { from: "../runtime/owned-upload.ts", name: "createOwnedUploads" },
      { from: "../runtime/process.ts", name: "periodic" },
      { from: "../runtime/transaction.ts", name: "transaction" },
      { from: "../runtime/transaction.ts", name: "Tx", type: true },
      { from: tileHttp, name: "notImplementedRoutes" },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: the multipart engine on its tables, objects and jobs outbox.`,
      `const ${name} = await (async () => {`,
      `  const s = selected("owned-multipart", ${text(id)});`,
      `  const binding = config.templates[${text(id)}];`,
      `  const db = pool(scope, s, "state");`,
      "  const control = objects(s);",
      "  const signing = objects(s, process.env.OBJECT_PUBLIC_ENDPOINT);",
      "  scope.own(() => {",
      "    control.destroy();",
      "    signing.destroy();",
      "  });",
      ...(lifecycle && lifecycleHooks
        ? [
            "  // The asset lifecycle that names this upload: its upload hooks run in this tile's",
            "  // transactions on the tables it shares with the lifecycle's worker.",
            `  const lifecycleHooks = ${lifecycleHooks}();`,
            "  const lifecycle = createAssetLifecycle(",
            "    { ...binding.lifecycle.binding, identities: lifecycleHooks.identities },",
            ...(lifecycle.publication
              ? [
                  "    {",
                  "      ...lifecycleHooks,",
                  "      publication: {",
                  "        ...lifecycleHooks.publication,",
                  "        destination: binding.lifecycle.publication,",
                  "      },",
                  "    },",
                ]
              : ["    lifecycleHooks,"]),
            "  );",
          ]
        : []),
      `  const hooks = ${hooks}({`,
      "    prefix: binding.prefix,",
      `    guard: ${guard},`,
      ...(lifecycle ? ["    lifecycle: lifecycle.uploadHooks,"] : []),
      "  });",
      "  const multipart = createOwnedMultipart({",
      "    repository: createOwnedUploads(",
      "      { ...binding.uploads, originalKey: hooks.originalKey },",
      "      hooks.upload,",
      "    ),",
      "    transaction: <T>(effect: (tx: Tx) => Promise<T>) => transaction(db, effect),",
      "    objects: createMultipartObjects({",
      "      control,",
      "      signing,",
      `      bucket: resource(s, "objects"),`,
      "      prefix: binding.prefix,",
      "      ownsKey: () => true,",
      "      metadata: binding.metadata,",
      "    }),",
      `    onFailure: (what, error, extra) => failure(\`\${what} ${lead.module}\`, error, extra),`,
      "  });",
      `  const jobs = await publisher(s, "jobs", scope);`,
      "  scope.own(() => jobs.close());",
      "  scope.transport(jobs);",
      `  const relay = startRelay(createOutbox(binding.outbox, "jobs", hooks.job), db, jobs, {`,
      `    onError: (error) => failure("outbox relay jobs", error),`,
      "  });",
      "  scope.own(() => relay.close());",
      "  return {",
      "    db,",
      "    multipart,",
      "    http: createMultipartHttpHandlers({ multipart, principal: hooks.principal }),",
      "  };",
      "})();",
    ],
    configure: [
      `${name}.http.mount(`,
      `  notImplementedRoutes(routes, log, ${text(lead.module)}),`,
      `  config.templates[${text(id)}].mounts,`,
      ");",
    ],
    // An upload the sweep can't finish is logged, and the sweep goes on to the next.
    initialize: [
      `await ${name}.db.query("SELECT 1");`,
      `for (const item of (await ${name}.multipart.sweep()).failed) failure(${text(`sweep ${lead.module}`)}, item.error, { upload: item.uploadId });`,
    ],
    started: [
      `periodic(scope, async () => { for (const item of (await ${name}.multipart.sweep()).failed) failure(${text(`sweep ${lead.module}`)}, item.error, { upload: item.uploadId }); }, 30000, (error) => failure(${text(`sweep ${lead.module}`)}, error));`,
    ],
    config: [
      id,
      {
        template: "owned-multipart",
        lead: lead.module,
        identity,
        prefix: `${lead.module}/`,
        uploads,
        outbox,
        metadata: {
          assetId: "asset-id",
          uploadId: "upload-id",
          sha256: "sha256",
          expectedSize: "expected-size",
        },
        mounts,
        ...(lifecycle && {
          lifecycle: {
            selection: lifecycle.selection.id,
            binding: lifecycle.binding,
            ...(lifecycle.publication && { publication: "publication" }),
          },
        }),
      },
    ],
    // The caller is the tile's sign-in (401 without it); then each route's first unwritten hook.
    routes: mounts.map((mount) => ({
      method: mount.method,
      path: mount.url,
      answers:
        mount.operation === "start"
          ? notImplementedAnswer(`validate for ${lead.name}`)
          : mount.operation === "list"
            ? "200 the caller's uploads: none until one is started"
            : "404 UPLOAD_NOT_FOUND until an upload is started",
    })),
    loops: [],
    template: { selection: id, template: "owned-multipart", level: "mounted" },
    startup: {
      module: lead.module,
      checks: [
        "jobs publisher open",
        "outbox relay started",
        "SELECT 1 on its state login",
        "sweep at start",
        "sweep every 30 s",
      ],
    },
    hooks: {
      members,
      file: hooksFile(process, selection, lead, "multipart uploads", {
        imports: [
          'import type { FastifyRequest } from "fastify";',
          'import type { VerifiedPrincipal } from "../../runtime/identity.ts";',
          'import type { UploadFile, UploadHooks } from "../../runtime/owned-upload.ts";',
          'import type { TileGuard } from "../../runtime/tile-guard.ts";',
        ],
        types: [
          lifecycle
            ? "/** The template's generic resources: the key prefix it owns, the tile's sign-in and the lifecycle's upload hooks. */"
            : "/** The template's generic resources: the object key prefix it owns and the tile's sign-in. */",
          `export type ${types}Resources = {`,
          "  prefix: string;",
          "  /** The tile's Auth guard, set to Required. */",
          "  guard: TileGuard;",
          ...(lifecycle
            ? [
                `  /** The asset lifecycle (${line(lifecycleName ?? "")}): it records each upload's asset. */`,
                '  lifecycle: Pick<UploadHooks<unknown, unknown>, "reserve" | "complete" | "closed">;',
              ]
            : []),
          "};",
        ],
        factory: [
          `export function ${hooks}(resources: ${types}Resources) {`,
          "  const upload: UploadHooks<unknown, unknown> = {",
          ...upload(
            "validate",
            "validate(input, principal)",
            "Checks a start request: its file and metadata.",
          ),
          ...upload("metadata", "metadata(input)", "Parses stored metadata."),
          ...upload("response", "response(input)", "Parses a stored completion response."),
          ...delegated(
            "reserve",
            "async reserve(tx, record)",
            "tx, record",
            "Runs in the start transaction.",
          ),
          ...delegated(
            "complete",
            "async complete(tx, record, original)",
            "tx, record, original",
            "Runs in the completion transaction: what completing answers.",
          ),
          ...delegated(
            "closed",
            "async closed(tx, record, terminal)",
            "tx, record, terminal",
            "Runs when an upload is aborted, expires or fails.",
          ),
          "  };",
          "  return {",
          "    /** The verified caller of a request: the tile's sign-in (401 without one). */",
          "    async principal(request: FastifyRequest): Promise<VerifiedPrincipal> {",
          "      return resources.guard.require(request);",
          "    },",
          "    upload,",
          "    /** An upload's object key, under resources.prefix. */",
          "    originalKey(identity: { assetId: string; uploadId: string; file: UploadFile }): string {",
          `      ${throws("originalKey", lead)}`,
          "    },",
          "    /** The job a completed upload publishes, from its outbox payload. */",
          "    job(payload: unknown, eventId: string): unknown {",
          `      ${throws("job", lead)}`,
          "    },",
          "  };",
          "}",
        ],
      }),
    },
    service: {
      ...service(),
      dependsOn: [state, objects, jobs],
      sql: [state],
      storage: [objects],
      broker: true,
      identity,
      environment: {
        OBJECT_PUBLIC_ENDPOINT: `http://127.0.0.1:\${LOCAL_OBJECT_PORT:?Set LOCAL_OBJECT_PORT}`,
      },
    },
    local: {
      migrations: (persistence.migrations ?? []).map((migration) => ({
        ...migration,
        sql: migration.sql + outboxSchema(outbox),
      })),
      logins: persistence.logins ?? [],
      grants: [
        ...(persistence.grants ?? []),
        {
          resource: state,
          host: process.tile,
          schema,
          relation: outbox.table,
          kind: "table",
          privileges: ["SELECT", "INSERT", "UPDATE"],
        },
      ],
    },
  };
}

/**
 * Favorites: each signed-in account's items in the template's own table, at
 * /modules/<lead>/items, behind the tile's Required sign-in. Adding asks `eligible`, which reads
 * the items Data access's database when one is connected.
 */
function favorites(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  selections: readonly NormalizedGenerationSelection[],
): ProcessMount {
  const id = selection.id;
  const name = camel(id);
  const hooks = `${camel(lead.module)}Hooks`;
  const types = pascal(lead.module);
  const state = resource(selection, "state");
  const items = selection.resources.find((item) => item.field === "items")?.identity.local;
  const guard = tileGuard(process, selections);
  if (!guard) refuse("INVALID_LOCAL_CONTRIBUTION", id, "Favorites needs its tile's Auth guard.");
  const sign = selections.find(
    (item) => item.host === process.tile && item.binding.kind === "verified-identity",
  );
  if (sign?.inputs["guard.signIn"] !== "required")
    refuse(
      "INVALID_LOCAL_CONTRIBUTION",
      id,
      "Favorites needs its tile's Auth guard set to Required.",
    );
  // The generic schema rule: one private schema per template selection, named from its ID.
  const table = { schema: generationLocalIdentity(id).sql, table: "favorites" };
  const bounds = favoritesBounds(selection);
  const base = `/modules/${lead.module}/items`;
  return {
    imports: [
      { from: resources, name: "pool" },
      { from: resources, name: "selected" },
      { from: "../runtime/favorites.ts", name: "createFavorites" },
      { from: "../runtime/favorites.ts", name: "mountFavorites" },
      { from: tileHttp, name: "notImplementedRoutes" },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: each signed-in account's favorite items, in the template's own table.`,
      `const ${name} = (() => {`,
      `  const s = selected("favorites", ${text(id)});`,
      `  const binding = config.templates[${text(id)}];`,
      `  const db = pool(scope, s, "state");`,
      ...(items ? [`  const items = pool(scope, s, "items");`] : []),
      "  const favorites = createFavorites({",
      "    db,",
      "    table: binding.table,",
      "    bounds: binding.bounds,",
      `    hooks: ${hooks}({${items ? " items " : ""}}),`,
      "  });",
      `  return { db,${items ? " items," : ""} favorites };`,
      "})();",
    ],
    configure: [
      `mountFavorites(notImplementedRoutes(routes, log, ${text(lead.module)}), {`,
      `  base: config.templates[${text(id)}].routes,`,
      `  favorites: ${name}.favorites,`,
      `  principal: (request) => ${guard}.require(request),`,
      "});",
    ],
    initialize: [
      `await ${name}.db.query("SELECT 1");`,
      ...(items ? [`await ${name}.items.query("SELECT 1");`] : []),
    ],
    started: [],
    config: [id, { template: "favorites", lead: lead.module, table, bounds, routes: base }],
    routes: [
      {
        method: "PUT",
        path: `${base}/:itemId`,
        answers: `${notImplementedAnswer(`eligible for ${lead.name}`)}; 200 {itemId, addedAt} once written, or 404 NOT_ELIGIBLE, 409 FAVORITES_FULL at ${bounds.perAccount}`,
      },
      { method: "DELETE", path: `${base}/:itemId`, answers: "204, also when it isn't a favorite" },
      {
        method: "GET",
        path: `${base}/:itemId`,
        answers: "200 {itemId, addedAt}, or 404 NOT_FAVORITE",
      },
      {
        method: "GET",
        path: base,
        answers: `200 {items, next}: newest first, ${bounds.pageSize} to a page`,
      },
    ],
    loops: [],
    template: { selection: id, template: "favorites", level: "mounted" },
    startup: {
      module: lead.module,
      checks: ["SELECT 1 on its state login", ...(items ? ["SELECT 1 on its items login"] : [])],
    },
    hooks: {
      members: ["eligible"],
      file: hooksFile(process, selection, lead, "favorites", {
        imports: [
          ...(items ? ['import type pg from "pg";'] : []),
          'import type { FavoritesHooks } from "../../runtime/favorites.ts";',
        ],
        types: items
          ? [
              `/** The template's generic resources: a pool on ${items}, the database its items Data access reads. This tile's login there sees that database's published views. */`,
              `export type ${types}Resources = { items: pg.Pool };`,
            ]
          : [
              "/** The template's generic resources: none, until an items Data access is connected. */",
              `export type ${types}Resources = Record<string, never>;`,
            ],
        factory: [
          `export function ${hooks}(resources: ${types}Resources): FavoritesHooks {`,
          "  return {",
          "    /** Whether an item may be added to favorites; only adding asks. */",
          "    async eligible(itemId) {",
          `      ${throws("eligible", lead)}`,
          "    },",
          "  };",
          "}",
        ],
        reached: "adding an item answers 501 until `eligible` is",
      }),
    },
    service: {
      ...service(),
      dependsOn: items ? [state, items] : [state],
      sql: items ? [state, items] : [state],
    },
    local: {
      migrations: [{ resource: state, id: `100-${id}.sql`, sql: favoritesSchema(table, bounds) }],
      logins: [
        { resource: state, host: process.tile },
        ...(items ? [{ resource: items, host: process.tile }] : []),
      ],
      grants: [
        {
          resource: state,
          host: process.tile,
          schema: table.schema,
          relation: table.table,
          kind: "table",
          privileges: ["SELECT", "INSERT", "DELETE"],
        },
      ],
    },
  };
}

/**
 * Search query: the search query template on its index, with the mapping and document from the
 * Index writer that fills it (v3 contract, section 5), at GET /modules/<lead>?q=&page=. Its own
 * hooks file holds the preset and each hit's answer.
 */
function searchQuery(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  selections: readonly NormalizedGenerationSelection[],
  processes: readonly NormalizedProcess[],
): ProcessMount {
  const id = selection.id;
  const name = camel(id);
  const index = resource(selection, "index");
  const url = `/modules/${lead.module}`;
  // The Index writer on the same index: the derivation makes a search query a template only then.
  const writer = selections.find(
    (item) =>
      item.binding.kind === "search-projection" &&
      item.resources.some((row) => row.field === "index" && row.identity.local === index),
  );
  const writerLead = processes
    .find((item) => item.tile === writer?.host)
    ?.templates.find((item) => item.selection === writer?.id)?.lead;
  if (!writer || !writerLead)
    refuse("INVALID_LOCAL_CONTRIBUTION", id, "A search query needs the Index writer on its index.");
  const writerHooks = indexHooks({ tile: writer.host }, writerLead);
  const hooks = `${camel(lead.module)}Hooks`;
  return {
    imports: [
      { from: resources, name: "input" },
      { from: resources, name: "selected" },
      { from: "../features/search-bindings.ts", name: "searchBindings" },
      { from: "../runtime/http.ts", name: "HttpError" },
      { from: "../runtime/search.ts", name: "createSearch" },
      { from: "../runtime/search-query.ts", name: "parseSearchInput" },
      { from: tileHttp, name: "notImplementedRoutes" },
      { from: "../runtime/tile-search.ts", name: "openSearchIndex" },
      { from: "../runtime/tile-search.ts", name: "createSearchHandler" },
      {
        from: `../modules/${writer.host}/${writerLead.module}.hooks.ts`,
        name: writerHooks.factory,
      },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: the search query template on its index, with ${line(writerLead.name)}'s mapping and document.`,
      `const ${name} = await (async () => {`,
      `  const s = selected("search-query", ${text(id)});`,
      `  const binding = searchBindings[${text(id)}];`,
      "  const client = createSearch({",
      "    endpoint: binding.index.endpoint,",
      `    requestTimeoutMs: input(s, "host.requestTimeoutMs"),`,
      "  });",
      "  scope.own(() => client.close());",
      "  // The search service answers; the index is asserted once its mapping is written.",
      "  await client.cluster.health();",
      `  const indexHooks = ${writerHooks.factory}();`,
      "  const index = await openSearchIndex(client, binding.index.resource, indexHooks);",
      `  return createSearchHandler({ client, index, indexHooks, hooks: ${hooks}() });`,
      "})();",
    ],
    configure: [
      `notImplementedRoutes(routes, log, ${text(lead.module)}).route({`,
      `  method: "GET",`,
      `  url: ${text(url)},`,
      "  handler: async (request) => {",
      "    try {",
      "      parseSearchInput(request.query);",
      "    } catch {",
      "      throw new HttpError(",
      "        400,",
      `        "SEARCH_QUERY",`,
      `        "Enter a query of 1–200 characters and a page from 1–100.",`,
      "      );",
      "    }",
      `    return ${name}(request.query);`,
      "  },",
      "});",
    ],
    initialize: [],
    started: [],
    config: [id, { template: "search-query", lead: lead.module, route: url, index }],
    routes: [
      {
        method: "GET",
        path: url,
        answers: `400 SEARCH_QUERY for a bad q or page; ${notImplementedAnswer(`mapping for ${writerLead.name}`)}; then {q, page, pageSize, total, hits}, 20 to a page`,
      },
    ],
    loops: [],
    template: { selection: id, template: "search-query", level: "mounted" },
    startup: {
      module: lead.module,
      checks: ["cluster health", `index ${index} asserted once its mapping is written`],
    },
    hooks: {
      members: ["preset", "hit"],
      file: hooksFile(process, selection, lead, "search query", {
        imports: [
          'import type { SearchQueryPreset } from "../../runtime/search-query.ts";',
          'import type { SearchQueryHooks } from "../../runtime/tile-search.ts";',
          `import type { ${writerHooks.document} } from "../${writer.host}/${writerLead.module}.hooks.ts";`,
        ],
        types: [
          `/** A document of the index: ${line(writerLead.name)}'s, whose hooks file holds its mapping. */`,
          `type Document = ${writerHooks.document};`,
        ],
        reached: `a search reaches ${line(writerLead.name)}'s \`mapping\` first, then these; the first one it reaches answers 501`,
        factory: [
          `export function ${hooks}(): SearchQueryHooks<Document> {`,
          "  return {",
          "    /** The compiled query preset: the query for a search's text and page, and its sort. */",
          "    preset(): SearchQueryPreset {",
          `      ${throws("preset", lead)}`,
          "    },",
          "    /** What each hit answers: a document of the index, as a search shows it. */",
          "    hit(document) {",
          `      ${throws("hit", lead)}`,
          "    },",
          "  };",
          "}",
        ],
      }),
    },
    service: { ...service(), dependsOn: [index] },
    local: {},
  };
}

const templates: Record<
  string,
  (
    process: NormalizedProcess,
    selection: NormalizedGenerationSelection,
    lead: Lead,
    selections: readonly NormalizedGenerationSelection[],
    processes: readonly NormalizedProcess[],
  ) => ProcessMount
> = {
  "verified-identity": verifiedIdentity,
  "owned-multipart": ownedMultipart,
  "positive-cache-read": positiveCacheRead,
  "search-query": searchQuery,
  favorites,
};

/** A route stub: any method on /modules/<module> and below, called with its dependencies
 * (`client-wiring.ts`) and the tile's sign-in's caller. */
function routeStub(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  guard: string | undefined,
): ProcessMount {
  const module = selection.module;
  if (!module) refuse("INVALID_LOCAL_CONTRIBUTION", selection.id, "A route stub needs its module.");
  const id = generationLocalIdentity(module.component).local;
  const paths = moduleStubPaths(process.tile, module.component);
  const entry = moduleEntryName(module.component);
  const from = (path: string) => `../${path.slice("src/".length)}`;
  const answers = `501 ${text(`Not implemented: ${module.name}`)} until it is written`;
  return {
    imports: [
      { from: tileHttp, name: "stubRoutes" },
      { from: from(paths.module), name: entry },
    ],
    setup: [],
    // In a tile with a sign-in, the stub's request carries its caller.
    configure: guard
      ? [
          "stubRoutes(",
          "  routes,",
          "  log,",
          `  ${text(id)},`,
          `  (request) => ${entry}(dependencies[${text(id)}], request),`,
          `  ${guard}.caller,`,
          ");",
        ]
      : [
          `stubRoutes(routes, log, ${text(id)}, (request) =>`,
          `  ${entry}(dependencies[${text(id)}], request),`,
          ");",
        ],
    initialize: [],
    started: [],
    routes: [
      { method: "ANY", path: `/modules/${id}`, answers },
      { method: "ANY", path: `/modules/${id}/*`, answers },
    ],
    loops: [],
    service: service(),
    local: {},
  };
}

/** Everything an HTTP process mounts: its sign-in first (the others use it), its other templates
 * in order, then its route stubs. */
export function httpMounts(
  process: NormalizedProcess,
  selections: readonly NormalizedGenerationSelection[],
  processes: readonly NormalizedProcess[] = [process],
): ProcessMount[] {
  const mounts: ProcessMount[] = [];
  const rows = [...process.templates].sort(
    (a, b) =>
      Number(a.template.id !== "verified-identity") - Number(b.template.id !== "verified-identity"),
  );
  for (const row of rows) {
    const selection = selections.find((item) => item.id === row.selection);
    const wire = selection && templates[selection.binding.kind];
    if (selection && wire && row.lead)
      mounts.push(wire(process, selection, row.lead, selections, processes));
  }
  const guard = tileGuard(process, selections);
  for (const stub of process.stubs) {
    if (stub.role !== "route") continue;
    const selection = selections.find((item) => item.id === stub.selection);
    if (selection) mounts.push(routeStub(process, selection, guard));
  }
  return mounts;
}

/** The process file's imports, merged per path and sorted. */
export function importLines(imports: readonly Import[]): string[] {
  const byPath = new Map<string, Set<string>>();
  for (const item of imports) {
    const names = byPath.get(item.from) ?? new Set<string>();
    names.add(item.type ? `type ${item.name}` : item.name);
    byPath.set(item.from, names);
  }
  const key = (name: string) => name.replace(/^type /, "");
  return [...byPath]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([from, names]) => {
      const sorted = [...names].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
      return sorted.every((name) => name.startsWith("type "))
        ? `import type { ${sorted.map(key).join(", ")} } from ${text(from)};`
        : `import { ${sorted.join(", ")} } from ${text(from)};`;
    });
}

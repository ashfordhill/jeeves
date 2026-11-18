import {
  generationLocalIdentity,
  type NormalizedGenerationSelection,
  type NormalizedProcess,
  studioComponentDefinitions,
} from "@jeeves/spec";
import { pointerPart, refuse } from "../json.ts";
import { browserSessionMount } from "./browser-session.ts";
import { type OutboxTable, outboxSchema } from "./durability.ts";
import { favoritesBounds, favoritesSchema } from "./favorites.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import { moduleEntryName, moduleHooksPath, moduleStubPaths } from "./module-stubs.ts";
import type { V2TemplateFile } from "./registry.ts";
import { ownedUploadPersistence } from "./upload-state.ts";

export type Lead = NonNullable<NormalizedProcess["templates"][number]["lead"]>;
type Route = { method: string; path: string; answers: string };
/** One import binding: a value or a type, from a path relative to `src/processes/`. */
/** One name a process file imports; `namespace` imports the whole module as `name` (QL05: a
 * stub's file, whose `settings` export may be missing). */
export type Import = {
  from: string;
  name: string;
  type?: true;
  namespace?: true;
};
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
  /** Configuration readers, before every module constructor and probe. */
  validation?: string[];
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
  template?: {
    selection: string;
    template: string;
    level: "mounted" | "placeholder";
  };
  /** A template's `started` line, logged just before the ready marker: what its startup ran. */
  startup?: { module: string; checks: string[] };
  hooks?: { file: V2TemplateFile; members: string[] };
  /** Private generated operator entry points, never HTTP routes or product hook dependencies. */
  operations?: V2TemplateFile[];
  /** The tile's sign-in (an Auth guard's): every module route of the process is mounted through
   * `<guard>.routes(...)`, and route stubs get `<guard>.caller`. */
  guard?: string;
  service: {
    dependsOn: string[];
    sql: string[];
    storage: string[];
    cache: string[];
    broker: boolean;
    /** It publishes to or consumes a Pub/Sub topic (`pubsubPublisher`, QG07; `pubsubLoop`, QG08). */
    pubsub?: boolean;
    /** The application tiles its stubs call (`httpTarget`), each at `JEEVES_TILE_<ID>_URL`. */
    calls?: string[];
    identity?: string;
    /** The Identity its stubs call (`identityTarget`, QG20), by its local ID, at its
     * `JEEVES_IDENTITY_<ID>_URL` (locally Keycloak inside the network). */
    issuer?: string;
    /** The External APIs its stubs call (`externalTarget`, QG20), each at
     * `JEEVES_EXTERNAL_<ID>_URL`. */
    external?: string[];
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
/** A broker publisher's or consumer's state hook (`brokerState` in tile-process.ts): one failure
 * line naming `what` when the broker is lost, one info line when it is back. */
export const brokerState = (what: string) => `brokerState(config.tile, failure, ${text(what)})`;
const tileHttp = "../runtime/tile-http.ts";

/** The hooks file: a factory over the template's generic resources; every member throws. */
export function hooksFile(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  template: string,
  body: {
    imports: string[];
    types: string[];
    factory: string[];
    reached?: string;
  },
): V2TemplateFile {
  return {
    path: moduleHooksPath(process.tile, lead.module),
    content: `${[
      body.imports.some((value) => value.includes("ProductQueries"))
        ? "// @jeeves-extension: operation"
        : "// @jeeves-extension: policy",
      `// ${line(lead.name)} (${studioComponentDefinitions[lead.kind].name}) in ${line(process.name)}: the product hooks its ${template} template calls.`,
      "// Write them here. Export never overwrites your edits: export afresh and carry them over.",
      ...body.imports.map((value) =>
        value.replace(/from "[^"]*runtime\/[^"/]+\.ts"/, 'from "../../extension-api/index.ts"'),
      ),
      'import { NotImplemented } from "../../extension-api/index.ts";',
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

/** Callable-only limiter: each host uses the same atomic cache namespace; no new HTTP endpoint. */
function rateLimiterMount(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  selections: readonly NormalizedGenerationSelection[],
): ProcessMount {
  const id = selection.id,
    name = camel(id),
    hooks = `${camel(lead.module)}Hooks`;
  if (selection.binding.kind !== "rate-limiter") throw Error("Rate limiter binding required");
  const identity = selection.binding.identity;
  if (
    !selections.some(
      (s) =>
        s.host === process.tile &&
        s.binding.kind === "verified-identity" &&
        s.target.kind === "component" &&
        s.target.component === identity.guard &&
        s.inputs["guard.signIn"] === "required",
    )
  )
    refuse(
      "INVALID_LOCAL_CONTRIBUTION",
      id,
      "Rate limiter requires its own host's Required Auth guard.",
    );
  const cache = resource(selection, "cache");
  return {
    imports: [
      { from: resources, name: "input" },
      { from: resources, name: "selected" },
      { from: "../runtime/rate-limiter.ts", name: "createRateLimiter" },
      { from: "../runtime/valkey.ts", name: "cacheEndpoint" },
      { from: "../runtime/valkey.ts", name: "createValkeyCache" },
      { from: "../runtime/local.ts", name: "readSecret" },
      { from: "../runtime/process.ts", name: "ownResource" },
      { from: "../runtime/process.ts", name: "processClient" },
      { from: "../runtime/operation.ts", name: "withLocalPolicy" },
      {
        from: `../modules/${process.tile}/${lead.module}.hooks.ts`,
        name: hooks,
      },
    ],
    validation: [`cacheEndpoint(${text(cache)});`, `readSecret(${text(`cache-${cache}`)});`],
    setup: [
      `const ${name} = await (async () => {`,
      `  const s = selected("rate-limiter", ${text(id)});`,
      `  const cacheBinding = { ...cacheEndpoint(${text(cache)}), secret: ${text(`cache-${cache}`)} };`,
      '  const cache = await processClient(scope, "valkey", cacheBinding, async () => ownResource(scope, await createValkeyCache({ binding: cacheBinding,',
      `    onState: (state, error) => state === "unavailable" ? failure(${text(`admission ${lead.module}`)}, error ?? new Error("Admission unavailable")) : console.log(JSON.stringify({ level: "info", event: "admission", tile: config.tile, module: ${text(lead.module)}, state })),`,
      '  }), "close"));',
      "  cache.required();",
      `  const limiter = createRateLimiter({ process: config.tile, module: ${text(lead.module)}, limit: input(s, "limiter.limit"), windowSeconds: input(s, "limiter.windowSeconds"), cache, hooks: withLocalPolicy(() => ${hooks}({})) });`,
      "  return { cache, limiter };",
      "})();",
    ],
    configure: [],
    initialize: [`await ${name}.cache.ping();`],
    started: [],
    config: [id, { template: "rate-limiter", lead: lead.module }],
    routes: [],
    loops: [],
    template: { selection: id, template: "rate-limiter", level: "mounted" },
    startup: {
      module: lead.module,
      checks: ["PING on required admission cache"],
    },
    hooks: {
      members: ["key"],
      file: hooksFile(process, selection, lead, "rate-limiter", {
        imports: ['import type { RateLimiterHooks } from "../../extension-api/index.ts";'],
        types: [
          "/** Pure policy receives only verified subject facts; no raw request or address trust. */",
        ],
        factory: [
          `export function ${hooks}(_resources: Record<string, never>): RateLimiterHooks {`,
          "  return {",
          "    key(caller) {",
          `      ${throws("key", lead)}`,
          "    },",
          "  };",
          "}",
        ],
        reached: "admission refuses until the key policy is written",
      }),
    },
    service: { ...service(), dependsOn: [cache], cache: [cache] },
    local: {},
  };
}

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
  const exposed = selection.inputs["reader.transport"] !== "in-process";
  const versioned = selection.inputs["reader.freshness"] === "versioned";
  const members = [
    "key",
    "codec",
    "eligible",
    "load",
    "expiresAt",
    ...(versioned ? ["version"] : []),
  ];
  return {
    imports: [
      { from: resources, name: "input" },
      { from: resources, name: "prepareCacheSource" },
      { from: resources, name: "cacheSource" },
      { from: resources, name: "selected" },
      {
        from: "../features/positive-cache-bindings.ts",
        name: "positiveCacheBindings",
      },
      { from: "../runtime/http.ts", name: "HttpError" },
      { from: "../runtime/positive-cache.ts", name: "createCacheReader" },
      { from: "../runtime/positive-cache.ts", name: "cacheReaderNamespace" },
      { from: "../runtime/positive-cache.ts", name: "cacheReaderCapability" },
      { from: "../runtime/operation.ts", name: "withLocalPolicy" },
      { from: "../runtime/valkey.ts", name: "cacheEndpoint" },
      { from: "../runtime/valkey.ts", name: "createValkeyCache" },
      { from: "../runtime/process.ts", name: "ownResource" },
      { from: "../runtime/process.ts", name: "processClient" },
      { from: tileHttp, name: "notImplementedRoutes" },
      {
        from: `../modules/${process.tile}/${lead.module}.hooks.ts`,
        name: hooks,
      },
    ],
    validation: [
      `const ${name}Source = prepareCacheSource(selected("positive-cache-read", ${text(id)}), ${text(lead.module)});`,
    ],
    setup: [
      `// ${line(lead.name)}: the cache read template's reader on the source login and the cache.`,
      `const ${name} = await (async () => {`,
      `  const s = selected("positive-cache-read", ${text(id)});`,
      `  const source = cacheSource(scope, ${name}Source);`,
      `  const binding = positiveCacheBindings[${text(id)}].cache;`,
      "  const cacheBinding = { ...cacheEndpoint(binding.resource), secret: binding.secret };",
      '  const cache = await processClient(scope, "valkey", cacheBinding, async () => ownResource(scope, await createValkeyCache({',
      "    // The cache's endpoint is the environment's: JEEVES_CACHE_<ID>_HOST, _PORT and _TLS.",
      "    binding: cacheBinding,",
      "    onState: (state, error) =>",
      '      state === "unavailable"',
      `        ? failure(${text(`cache ${lead.module}`)}, error ?? new Error("Cache unavailable"))`,
      `        : console.log(JSON.stringify({ level: "info", event: "cache", tile: config.tile, module: ${text(lead.module)}, state })),`,
      '  }), "close"));',
      "  const core = createCacheReader({",
      `    adapter: withLocalPolicy(() => ${hooks}({ source: source.queries })),`,
      `    freshness: ${text(versioned ? "versioned" : "immutable-positive")},`,
      `    namespace: cacheReaderNamespace(config.tile, ${text(lead.module)}, ${text(versioned ? "versioned" : "immutable-positive")}, input(s, "cache.ttlSeconds"), ${text(source)}),`,
      "    cache,",
      `    ttlSeconds: input(s, "cache.ttlSeconds"),`,
      `    onFailure: (what, error) => failure(\`\${what} ${lead.module}\`, error),`,
      "  });",
      `  const read = cacheReaderCapability(() => core, ${text(lead.module)}).read;`,
      "  return { source, read };",
      "})();",
    ],
    configure: exposed
      ? [
          `notImplementedRoutes(routes, log, ${text(lead.module)}).route({`,
          `  method: "GET",`,
          `  url: ${text(url)},`,
          "  handler: async (request, reply) => {",
          '    reply.header("Cache-Control", "no-store");',
          `    const record = await ${name}.read({ key: (request.params as { key: string }).key });`,
          `    if (record === null) throw new HttpError(404, "NOT_FOUND", "No record for this key.");`,
          '    reply.header("X-Jeeves-Cache-Freshness", record.freshness);',
          '    if (record.validUntil !== null) reply.header("X-Jeeves-Valid-Until", String(record.validUntil));',
          '    if (record.version !== null) reply.header("X-Jeeves-Cache-Version", record.version);',
          "    return record.record;",
          "  },",
          "});",
        ]
      : [],
    initialize: [`await ${name}.source.probe();`],
    started: [],
    config: [
      id,
      { template: "positive-cache-read", lead: lead.module, ...(exposed ? { route: url } : {}) },
    ],
    routes: exposed
      ? [{ method: "GET", path: url, answers: notImplementedAnswer(`key for ${lead.name}`) }]
      : [],
    loops: [],
    template: { selection: id, template: "positive-cache-read", level: "mounted" },
    startup: { module: lead.module, checks: ["SELECT 1 on its source login"] },
    hooks: {
      members,
      file: hooksFile(process, selection, lead, "cache read", {
        imports: [
          'import type { ProductQueries } from "../../extension-api/index.ts";',
          'import type { PositiveReadAdapter } from "../../extension-api/index.ts";',
        ],
        types: [
          `/** Read input shared by the callable and optional GET ${url} adapter. */`,
          `export type ${types}Input = { key: string };`,
          "/** Scoped registered read-only source queries; register the reader lead in products.json. */",
          `export type ${types}Resources = { source: ProductQueries };`,
        ],
        reached: "reads refuse until policies and a registered source SELECT are supplied",
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
          ...(versioned
            ? [
                "    /** Authoritative monotonically ordered uint64 decimal version. */",
                "    version(record) {",
                `      ${throws("version", lead)}`,
                "    },",
              ]
            : []),
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
    (item) =>
      item.host === process.tile &&
      ["verified-identity", "browser-session"].includes(item.binding.kind),
  );
  return guard ? camel(guard.id) : undefined;
}

/** Auth guard: the tile's sign-in. Every module route checks its caller, Required or Optional,
 * and GET /modules/<guard>/me answers who it is. */
function verifiedIdentity(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  _selections: readonly NormalizedGenerationSelection[],
  processes: readonly NormalizedProcess[],
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
      { from: "../runtime/tile-guard.ts", name: "signInSettings" },
    ],
    validation: [
      "signInSettings();",
      ...(processes.some((caller) =>
        caller.serviceCalls?.some((call) => call.target === process.tile && call.sessionUser),
      )
        ? [
            `if (signInSettings().audience !== ${text(`${identity}-web`)} || new URL(signInSettings().issuer).protocol !== "https:" || new URL(signInSettings().issuer).pathname !== ${text(`/realms/${identity}`)}) throw new Error("Incompatible session forwarding identity");`,
          ]
        : []),
    ],
    setup: [
      `// ${line(lead.name)}: the tile's sign-in, ${signIn === "required" ? "Required: every module route needs a valid token" : "Optional: a token sent with a request is verified; none is anonymous"}.`,
      `const ${name} = (() => {`,
      `  const binding = config.templates[${text(id)}];`,
      "  // Its audience, issuer and key set are the deployment's, checked by signInSettings (tile-guard.ts).",
      "  const settings = signInSettings();",
      "  return createTileGuard({",
      "    signIn: binding.signIn,",
      "    verify: createPrincipalVerifier({",
      "      issuer: settings.issuer,",
      "      audience: settings.audience,",
      "      jwksUrl: settings.jwksUrl,",
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
  _processes: readonly NormalizedProcess[],
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
  const delegated = (hook: string, signature: string, _call: string, comment: string) =>
    upload(hook, signature, comment);
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
      { from: "../runtime/hook-boundary.ts", name: "bindUploadHooks" },
      ...(lifecycle ? [{ from: "../runtime/hook-boundary.ts", name: "bindAssetHooks" }] : []),
      { from: "../runtime/multipart-http.ts", name: "createMultipartHttpHandlers" },
      { from: "../runtime/multipart-objects.ts", name: "createMultipartObjects" },
      { from: "../runtime/multipart.ts", name: "createOwnedMultipart" },
      { from: "../runtime/outbox.ts", name: "createOutbox" },
      { from: "../runtime/outbox.ts", name: "startRelay" },
      { from: "../runtime/owned-upload.ts", name: "createOwnedUploads" },
      { from: "../runtime/process.ts", name: "periodic" },
      { from: "../runtime/transaction.ts", name: "transaction" },
      { from: "../runtime/transaction.ts", name: "Tx", type: true },
      { from: "../runtime/hook-boundary.ts", name: "productHooks" },
      { from: "../runtime/hook-boundary.ts", name: "productQueries" },
      { from: tileHttp, name: "notImplementedRoutes" },
      { from: tileProcess, name: "brokerState" },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: the multipart engine on its tables, objects and jobs outbox.`,
      `const ${name} = await (async () => {`,
      `  const s = selected("owned-multipart", ${text(id)});`,
      `  const binding = config.templates[${text(id)}];`,
      `  const db = pool(scope, s, "state");`,
      "  const control = objects(scope, s);",
      "  const signing = objects(scope, s, process.env.OBJECT_PUBLIC_ENDPOINT);",
      ...(lifecycle && lifecycleHooks
        ? [
            "  // The asset lifecycle that names this upload: its upload hooks run in this tile's",
            "  // transactions on the tables it shares with the lifecycle's worker.",
            `  const lifecycleHooks = bindAssetHooks(${lifecycleHooks}());`,
            "  const lifecycle = createAssetLifecycle(",
            "    { ...binding.lifecycle.binding, identities: lifecycleHooks.identities },",
            lifecycle.publication
              ? "    { ...lifecycleHooks, publication: { ...lifecycleHooks.publication, destination: binding.lifecycle.publication } },"
              : "    lifecycleHooks,",
            "  );",
          ]
        : []),
      `  const hooks = bindUploadHooks(${hooks}({`,
      "    prefix: binding.prefix,",

      `  })${lifecycle ? ", lifecycle.uploadHooks" : ""});`,
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
      `  const jobs = await publisher(s, "jobs", scope, ${brokerState(`broker publish ${jobs}`)});`,
      "  scope.own(() => jobs.close());",
      "  scope.transport(jobs);",
      `  const relay = startRelay(createOutbox(binding.outbox, "jobs", hooks.job), db, jobs, {`,
      `    onError: (error) => failure("outbox relay jobs", error),`,
      "  });",
      "  scope.own(() => relay.close());",
      "  return {",
      "    db,",
      "    multipart,",
      `    http: createMultipartHttpHandlers({ multipart, principal: (request) => ${guard}.require(request) }),`,
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
        imports: ['import type { UploadFile, UploadHooks } from "../../runtime/owned-upload.ts";'],
        types: [
          "/** The generated object key prefix; sign-in and lifecycle controls remain private. */",
          `export type ${types}Resources = {`,
          "  prefix: string;",

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
            "reserve(record)",
            "tx, record",
            "Runs in the start transaction.",
          ),
          ...delegated(
            "complete",
            "complete(record, original)",
            "tx, record, original",
            "Runs in the completion transaction: what completing answers.",
          ),
          ...delegated(
            "closed",
            "closed(record, terminal)",
            "tx, record, terminal",
            "Runs when an upload is aborted, expires or fails.",
          ),
          "  };",
          "  return {",
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
export function favoritesMount(
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
      { from: "../runtime/hook-boundary.ts", name: "bindFavoritesHooks" },
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
      `    hooks: bindFavoritesHooks(${hooks}({})),`,
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
        imports: ['import type { FavoritesHooks } from "../../extension-api/index.ts";'],
        types: [
          "/** Synchronous product eligibility; no clients or credential access. */",
          `export type ${types}Resources = Record<string, never>;`,
        ],
        factory: [
          `export function ${hooks}(resources: ${types}Resources): FavoritesHooks {`,
          "  return {",
          "    /** Whether an item may be added to favorites; only adding asks. */",
          "    eligible(itemId) {",
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
      { from: "../runtime/process.ts", name: "ownResource" },
      { from: "../runtime/process.ts", name: "processClient" },
      { from: "../runtime/search-query.ts", name: "parseSearchInput" },
      { from: "../runtime/hook-boundary.ts", name: "productHooks" },
      { from: "../runtime/hook-boundary.ts", name: "productQueries" },
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
      "  const searchConfiguration = {",
      "    endpoint: binding.index.endpoint,",
      `    requestTimeoutMs: input(s, "host.requestTimeoutMs"),`,
      "  };",
      '  const client = processClient(scope, "search", searchConfiguration, () => ownResource(scope, createSearch(searchConfiguration), "close"));',
      "  // The search service answers; the index is asserted once its mapping is written.",
      "  await client.cluster.health();",
      `  const indexHooks = productHooks(${writerHooks.factory}());`,
      "  const index = await openSearchIndex(client, binding.index.resource, indexHooks);",
      `  return createSearchHandler({ client, index, indexHooks, hooks: productHooks(${hooks}()) });`,
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
        ],
        types: [
          `/** A document of the index: ${line(writerLead.name)}'s, whose hooks file holds its mapping. */`,
          "type Document = Record<string, unknown>;",
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
  "browser-session": browserSessionMount,
  "owned-multipart": ownedMultipart,
  "positive-cache-read": positiveCacheRead,
  "search-query": searchQuery,
  favorites: favoritesMount,
  "rate-limiter": rateLimiterMount,
};

/** Generated HMAC ingress; Required-user host compositions refuse before mounting. */
function webhookMount(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  guard: string | undefined,
): ProcessMount {
  const module = selection.module;
  if (!module) throw new Error("Webhook module required");
  const id = generationLocalIdentity(module.component).local;
  const name = `${camel(id)}Webhook`;
  const from = `../modules/${generationLocalIdentity(process.tile).local}/${id}`;
  return {
    imports: [
      { from: "../runtime/webhook.ts", name: "webhookRoutes" },
      { from: "../modules/dependencies.ts", name: "webhookReceivers" },
      { from: "../runtime/settings.ts", name: "privateWebhookVerifier" },
      { from: `${from}.ts`, name: `durableWork as ${name}Work` },
      { from: `${from}.mapping.hooks.ts`, name: `mapEvent as ${name}Map` },
    ],
    validation: [`const ${name}Verify = privateWebhookVerifier(${text(id)});`],
    setup: [],
    configure: [
      `webhookRoutes({ routes: ${guard ? "open" : "routes"}, module: ${text(id)}, dependencies: dependencies[${text(id)}], work: ${name}Work, map: ${name}Map, verify: ${name}Verify, ...webhookReceivers[${text(selection.id)}] });`,
    ],
    initialize: [],
    started: [],
    routes: [
      {
        method: "POST",
        path: `/modules/${id}`,
        answers:
          "202 after durable authenticated inbox acceptance; duplicate returns same acceptance; 409 WORK_IDENTITY_CONFLICT for changed bytes",
      },
    ],
    loops: [],
    service: service(),
    local: {},
  };
}

/** A route stub: any method on /modules/<module> and below, called with its dependencies
 * (`client-wiring.ts`), the tile's sign-in's caller and a signal bounded by its Request timeout
 * (`config.settings.requestTimeoutMs`). */
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
  const internalOnly = !!process.workloadCallers?.length && process.exposure !== "public";
  const workProtocol =
    !!process.workload &&
    !!process.workloadCallers?.length &&
    !!process.stubs
      .find((stub) => stub.module === module.component)
      ?.stores?.some((store) => store.kind === "database" && store.access !== "read");
  return {
    imports: [
      { from: tileHttp, name: "stubRoutes" },
      ...(workProtocol
        ? [{ from: "../runtime/local-operation.ts", name: "invokeWorkProtocol" }]
        : []),
      ...(process.workload && process.workloadCallers?.length
        ? [{ from: "../runtime/workload.ts", name: "workloadRoutes" }]
        : []),
      { from: from(paths.module), name: entry },
    ],
    setup: [],
    // The stub's request carries a signal aborted at the tile's Request timeout, and in a tile
    // with a sign-in its caller.
    configure: [
      ...(!internalOnly
        ? [
            "stubRoutes(",
            "  routes,",
            "  log,",
            `  ${text(id)},`,
            `  (request) => ${entry}(dependencies[${text(id)}], request),`,
            "  { deadlineMs: config.settings.requestTimeoutMs, stopping: scope.signal },",
            ...(guard ? [`  ${guard}.caller,`] : []),
            ");",
          ]
        : []),
      ...(process.workload && process.workloadCallers?.length
        ? [
            "stubRoutes(",
            `  workloadRoutes(routes, workload, allowedCallers[${text(id)}]),`,
            "  log,",
            `  ${text(id)},`,
            `  (request) => ${entry}(dependencies[${text(id)}], request),`,
            "  { deadlineMs: config.settings.requestTimeoutMs, stopping: scope.signal },",
            `  ${guard ? `${guard}.caller` : "undefined"},`,
            '  "/internal/modules",',
            ");",
            ...(workProtocol
              ? [
                  "stubRoutes(",
                  `  workloadRoutes(routes, workload, allowedCallers[${text(id)}]),`,
                  "  log,",
                  `  ${text(id)},`,
                  `  (request) => invokeWorkProtocol((${pascal(id)}Module as { localOperation?: unknown }).localOperation, dependencies[${text(id)}], request),`,
                  "  { deadlineMs: config.settings.requestTimeoutMs, stopping: scope.signal },",
                  `  ${guard ? `${guard}.caller` : "undefined"},`,
                  '  "/internal/work",',
                  ");",
                ]
              : []),
          ]
        : []),
    ],
    initialize: [],
    started: [],
    routes: [
      ...(workProtocol
        ? [
            {
              method: "POST",
              path: `/internal/work/${id}`,
              answers:
                "Root-only generated ticket/replay protocol; refuses unless the module explicitly declares a workload-only operation (Required user guards remain required)",
            },
          ]
        : []),
      ...(process.workload && process.workloadCallers?.length
        ? [
            {
              method: "GET/POST",
              path: `/internal/modules/${id}`,
              answers: "Workload-authenticated operation; user identity remains independent",
            },
          ]
        : []),
      ...(!internalOnly
        ? [
            { method: "ANY", path: `/modules/${id}`, answers },
            { method: "ANY", path: `/modules/${id}/*`, answers },
          ]
        : []),
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
    if (stub.role === "webhook-receiver") {
      const selection = selections.find((item) => item.id === stub.selection);
      if (selection) mounts.push(webhookMount(process, selection, guard));
      continue;
    }
    if (stub.role !== "route") continue;
    const selection = selections.find((item) => item.id === stub.selection);
    if (selection) mounts.push(routeStub(process, selection, guard));
  }
  return mounts;
}

/** The process file's imports, merged per path and sorted; a path's namespace import comes first,
 * on its own line. */
export function importLines(imports: readonly Import[]): string[] {
  const byPath = new Map<string, Set<string>>();
  const namespaces = new Map<string, string>();
  for (const item of imports) {
    if (item.namespace) {
      namespaces.set(item.from, item.name);
      continue;
    }
    const names = byPath.get(item.from) ?? new Set<string>();
    names.add(item.type ? `type ${item.name}` : item.name);
    byPath.set(item.from, names);
  }
  const key = (name: string) => name.replace(/^type /, "");
  return [...new Set([...byPath.keys(), ...namespaces.keys()])]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap((from) => {
      const namespace = namespaces.get(from);
      const sorted = [...(byPath.get(from) ?? [])].sort((a, b) =>
        key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
      );
      return [
        ...(namespace ? [`import * as ${namespace} from ${text(from)};`] : []),
        ...(!sorted.length
          ? []
          : sorted.every((name) => name.startsWith("type "))
            ? [`import type { ${sorted.map(key).join(", ")} } from ${text(from)};`]
            : [`import { ${sorted.join(", ")} } from ${text(from)};`]),
      ];
    });
}

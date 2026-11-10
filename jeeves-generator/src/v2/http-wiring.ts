import {
  generationLocalIdentity,
  type NormalizedGenerationSelection,
  type NormalizedProcess,
  studioComponentDefinitions,
} from "@jeeves/spec";
import { pointerPart, refuse } from "../json.ts";
import { outboxSchema } from "./durability.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import { moduleEntryName, moduleHooksPath, moduleStubPaths } from "./module-stubs.ts";
import type { V2TemplateFile } from "./registry.ts";
import { ownedUploadPersistence } from "./upload-state.ts";

type Lead = NonNullable<NormalizedProcess["templates"][number]["lead"]>;
type Route = { method: string; path: string; answers: string };
/** One import binding: a value or a type, from a path relative to `src/processes/`. */
type Import = { from: string; name: string; type?: true };

/**
 * What an HTTP process mounts for one template or stub (tile process contract, sections 3-4):
 * the lines it adds to the process file, the routes it answers, its hooks file and what the
 * foundation must provision for it.
 */
export type HttpMount = {
  imports: Import[];
  /** Before the HTTP service is created, inside `runProcess`. */
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
  template?: { selection: string; template: string; level: "mounted" | "placeholder" };
  hooks?: { file: V2TemplateFile; members: string[] };
  service: {
    dependsOn: string[];
    sql: string[];
    storage: string[];
    cache: string[];
    broker: boolean;
    identity?: string;
    environment?: Record<string, string>;
  };
  local: Pick<V2LocalContribution, "logins" | "migrations" | "grants">;
};

const pointer = (path: readonly (string | number)[]) =>
  `/${path.map((part) => pointerPart(String(part))).join("/")}`;
/** One comment line: names are the user's own text. */
const line = (text: string) => text.replace(/[\p{Cc}\u2028\u2029]/gu, " ");
const camel = (slug: string) =>
  slug.replace(/-([a-z0-9])/g, (_match, next: string) => next.toUpperCase());
const pascal = (slug: string) => camel(`-${slug}`);
const text = (value: string) => JSON.stringify(value);
const service = (): HttpMount["service"] => ({
  dependsOn: [],
  sql: [],
  storage: [],
  cache: [],
  broker: false,
});
const resource = (selection: NormalizedGenerationSelection, field: string) => {
  const binding = selection.resources.find((item) => item.field === field);
  if (!binding) refuse("INVALID_LOCAL_CONTRIBUTION", selection.id, `Bind its ${field}.`);
  return binding.identity.local;
};
const notImplementedAnswer = (what: string) =>
  `501 ${text(`Not implemented: ${what}`)} until its hooks are written`;
const resources = "../features/service-resources.ts";
const tileProcess = "../runtime/tile-process.ts";

/** The hooks file: a factory over the template's generic resources; every member throws. */
function hooksFile(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
  template: string,
  body: { imports: string[]; types: string[]; factory: string[] },
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
      `/** Each hook throws "Not implemented" until written; the first one a route reaches answers 501. */`,
      ...body.factory,
    ].join("\n")}\n`,
    ownership: "generated-extension",
    sourcePaths: ["/generation/processes", pointer(selection.sourcePath)],
  };
}
const throws = (hook: string, lead: Lead) =>
  `throw new NotImplemented(${text(`${hook} for ${lead.name}`)});`;

/** Cache reader: the positive reader on its source login and cache, at GET /modules/<lead>/:key. */
function positiveCacheRead(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
): HttpMount {
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
      { from: tileProcess, name: "notImplementedRoutes" },
      { from: `../modules/${process.tile}/${lead.module}.hooks.ts`, name: hooks },
    ],
    setup: [
      `// ${line(lead.name)}: the cache read template's reader on the source login and the cache.`,
      `const ${name} = await (async () => {`,
      `  const s = selected("positive-cache-read", ${text(id)});`,
      `  const source = pool(scope, s, "source");`,
      `  const cache = await createValkeyCache({ binding: positiveCacheBindings[${text(id)}].cache });`,
      "  scope.own(() => cache.close());",
      "  const read = createPositiveReader({",
      `    adapter: ${hooks}({ source }),`,
      "    cache,",
      `    ttlSeconds: input(s, "cache.ttlSeconds"),`,
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
    template: { selection: id, template: "positive-cache-read", level: "mounted" },
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

/** Multipart uploads: the engine on its own tables, objects and jobs outbox, with a sweep. */
function ownedMultipart(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
): HttpMount {
  const id = selection.id;
  const name = camel(id);
  const hooks = `${camel(lead.module)}Hooks`;
  const types = pascal(lead.module);
  const state = resource(selection, "state");
  const objects = resource(selection, "objects");
  const jobs = resource(selection, "jobs");
  const identity = selection.identity?.element;
  if (!identity) refuse("INVALID_LOCAL_CONTRIBUTION", id, "Multipart uploads needs its identity.");
  // The generic schema rule: one private schema per template selection, named from its ID.
  const schema = generationLocalIdentity(id).sql;
  const uploads = { schema, table: "uploads" };
  const outbox = { schema, table: "outbox", destinations: ["jobs"] };
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
  const members = [
    "principal",
    "validate",
    "metadata",
    "response",
    "reserve",
    "complete",
    "closed",
    "originalKey",
    "job",
  ];
  const upload = (hook: string, signature: string, comment: string) => [
    `    /** ${comment} */`,
    `    ${signature} {`,
    `      ${throws(hook, lead)}`,
    "    },",
  ];
  return {
    imports: [
      { from: resources, name: "objects" },
      { from: resources, name: "pool" },
      { from: resources, name: "publisher" },
      { from: resources, name: "resource" },
      { from: resources, name: "selected" },
      { from: "../runtime/identity.ts", name: "createPrincipalVerifier" },
      { from: "../runtime/multipart-http.ts", name: "createMultipartHttpHandlers" },
      { from: "../runtime/multipart-objects.ts", name: "createMultipartObjects" },
      { from: "../runtime/multipart.ts", name: "createOwnedMultipart" },
      { from: "../runtime/outbox.ts", name: "createOutbox" },
      { from: "../runtime/outbox.ts", name: "startRelay" },
      { from: "../runtime/owned-upload.ts", name: "createOwnedUploads" },
      { from: "../runtime/process.ts", name: "periodic" },
      { from: "../runtime/transaction.ts", name: "transaction" },
      { from: "../runtime/transaction.ts", name: "Tx", type: true },
      { from: tileProcess, name: "notImplementedRoutes" },
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
      `  const hooks = ${hooks}({`,
      "    prefix: binding.prefix,",
      "    verify: createPrincipalVerifier({",
      `      issuer: process.env.OIDC_ISSUER ?? "",`,
      `      audience: \`\${binding.identity}-web\`,`,
      `      jwksUrl: process.env.OIDC_JWKS_URL ?? "",`,
      `      algorithms: ["RS256"],`,
      "      jwksTimeoutMs: 3000,",
      "    }),",
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
      "  });",
      `  const jobs = await publisher(s, "jobs", scope);`,
      "  scope.own(() => jobs.close());",
      "  scope.transport(jobs);",
      `  const relay = startRelay(createOutbox(binding.outbox, "jobs", hooks.job), db, jobs);`,
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
    initialize: [`await ${name}.db.query("SELECT 1");`, `await ${name}.multipart.sweep();`],
    started: [`periodic(scope, () => ${name}.multipart.sweep(), 30000);`],
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
      },
    ],
    routes: mounts.map((mount) => ({
      method: mount.method,
      path: mount.url,
      answers: notImplementedAnswer(`principal for ${lead.name}`),
    })),
    template: { selection: id, template: "owned-multipart", level: "mounted" },
    hooks: {
      members,
      file: hooksFile(process, selection, lead, "multipart uploads", {
        imports: [
          'import type { FastifyRequest } from "fastify";',
          'import type { VerifiedPrincipal } from "../../runtime/identity.ts";',
          'import type { UploadFile, UploadHooks } from "../../runtime/owned-upload.ts";',
        ],
        types: [
          "/** The template's generic resources: the object key prefix it owns and a token verifier. */",
          `export type ${types}Resources = {`,
          "  prefix: string;",
          "  verify(bearer: string): Promise<VerifiedPrincipal>;",
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
          ...upload("reserve", "async reserve(tx, record)", "Runs in the start transaction."),
          ...upload(
            "complete",
            "async complete(tx, record, original)",
            "Runs in the completion transaction: what completing answers.",
          ),
          ...upload(
            "closed",
            "async closed(tx, record, terminal)",
            "Runs when an upload is aborted, expires or fails.",
          ),
          "  };",
          "  return {",
          "    /** The verified caller of a request. */",
          "    async principal(request: FastifyRequest): Promise<VerifiedPrincipal> {",
          `      ${throws("principal", lead)}`,
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

/** Search query: a placeholder. Its route answers "Not implemented" until a mapping and a query
 * preset exist, which are product data, not hooks (tile process contract, section 3). */
function searchQuery(
  _process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
  lead: Lead,
): HttpMount {
  const id = selection.id;
  const name = camel(id);
  const index = resource(selection, "index");
  const url = `/modules/${lead.module}`;
  const what = `search mapping and query preset for ${lead.name}`;
  return {
    imports: [
      { from: resources, name: "input" },
      { from: resources, name: "selected" },
      { from: "../features/search-bindings.ts", name: "searchBindings" },
      { from: "../runtime/search.ts", name: "createSearch" },
      { from: tileProcess, name: "NotImplemented" },
      { from: tileProcess, name: "notImplementedRoutes" },
    ],
    setup: [
      `// ${line(lead.name)} (placeholder): the search client; no mapping or query preset exists yet.`,
      `const ${name} = (() => {`,
      `  const s = selected("search-query", ${text(id)});`,
      "  const client = createSearch({",
      `    endpoint: searchBindings[${text(id)}].index.endpoint,`,
      `    requestTimeoutMs: input(s, "host.requestTimeoutMs"),`,
      "  });",
      "  scope.own(() => client.close());",
      "  return { client };",
      "})();",
    ],
    configure: [
      `notImplementedRoutes(routes, log, ${text(lead.module)}).route({`,
      `  method: "GET",`,
      `  url: ${text(url)},`,
      "  handler: async () => {",
      `    throw new NotImplemented(${text(what)});`,
      "  },",
      "});",
    ],
    initialize: [`await ${name}.client.cluster.health();`],
    started: [],
    config: [id, { template: "search-query", lead: lead.module, route: url, placeholder: true }],
    routes: [
      {
        method: "GET",
        path: url,
        answers: `501 ${text(`Not implemented: ${what}`)} (placeholder)`,
      },
    ],
    template: { selection: id, template: "search-query", level: "placeholder" },
    service: { ...service(), dependsOn: [index] },
    local: {},
  };
}

const templates: Record<
  string,
  (process: NormalizedProcess, selection: NormalizedGenerationSelection, lead: Lead) => HttpMount
> = {
  "owned-multipart": ownedMultipart,
  "positive-cache-read": positiveCacheRead,
  "search-query": searchQuery,
};

/** A route stub: any method on /modules/<module> and below, with dependencies that answer
 * "Not implemented" until their stores are provisioned. */
function routeStub(
  process: NormalizedProcess,
  selection: NormalizedGenerationSelection,
): HttpMount {
  const module = selection.module;
  if (!module) refuse("INVALID_LOCAL_CONTRIBUTION", selection.id, "A route stub needs its module.");
  const id = generationLocalIdentity(module.component).local;
  const paths = moduleStubPaths(process.tile, module.component);
  const entry = moduleEntryName(module.component);
  const dependencies = `${pascal(id)}Dependencies`;
  const from = (path: string) => `../${path.slice("src/".length)}`;
  const answers = `501 ${text(`Not implemented: ${module.name}`)} until it is written`;
  return {
    imports: [
      { from: tileProcess, name: "stubRoutes" },
      { from: tileProcess, name: "unprovisioned" },
      { from: from(paths.module), name: entry },
      { from: from(paths.slots), name: `Dependencies as ${dependencies}`, type: true },
    ],
    setup: [],
    configure: [
      `stubRoutes(routes, log, ${text(id)}, (request) =>`,
      `  ${entry}(unprovisioned<${dependencies}>(${text(module.name)}), request),`,
      ");",
    ],
    initialize: [],
    started: [],
    routes: [
      { method: "ANY", path: `/modules/${id}`, answers },
      { method: "ANY", path: `/modules/${id}/*`, answers },
    ],
    service: service(),
    local: {},
  };
}

/** Everything an HTTP process mounts: its templates in order, then its route stubs. */
export function httpMounts(
  process: NormalizedProcess,
  selections: readonly NormalizedGenerationSelection[],
): HttpMount[] {
  const mounts: HttpMount[] = [];
  for (const row of process.templates) {
    const selection = selections.find((item) => item.id === row.selection);
    const wire = selection && templates[selection.binding.kind];
    if (selection && wire && row.lead) mounts.push(wire(process, selection, row.lead));
  }
  for (const stub of process.stubs) {
    if (stub.role !== "route") continue;
    const selection = selections.find((item) => item.id === stub.selection);
    if (selection) mounts.push(routeStub(process, selection));
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

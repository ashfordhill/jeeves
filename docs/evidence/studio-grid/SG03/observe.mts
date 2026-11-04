// biome-ignore-all lint/suspicious/noExplicitAny: one-off evidence script over dynamically imported spec sources.
// SG03 one-off observations. Usage: tsx observe.mts <spec-src-index> <out-dir>
import { writeFileSync } from "node:fs";

const S: any = await import(process.argv[2]);
const outDir = process.argv[3];
const API = "http://127.0.0.1:4310";
const out: Record<string, unknown> = {};
const json = (v: unknown) => JSON.stringify(v);
const canon = (v: any): any =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canon(v[k])]),
        )
      : v;
const get = async (path: string) => {
  const r = await fetch(API + path);
  return {
    status: r.status,
    cache: r.headers.get("cache-control"),
    body: await r.json().catch(() => null),
  };
};
const summary = (b: any) => ({
  services: b.services.map((s: any) => `${s.kind}:${s.id}:${s.components.length}c`),
  resources: b.resources.map((r: any) => `${r.kind}:${r.id}`),
  externals: b.externals.map((e: any) => `${e.source}:${e.id}`),
  groups: b.groups.length,
  connections: b.connections.length,
  contextConnections: b.connections.filter((c: any) => c.source === "context").length,
  componentLinks: b.componentLinks.length,
  omitted: b.omitted.length,
  findings: b.findings.length,
});

// 1. Gateway kind: definition, defaults, schema.
out.gateway = {
  inKinds: S.studioKinds.includes("gateway"),
  isApplication: S.studioApplicationKinds.includes("gateway"),
  definition: S.studioDefinitionRef("gateway"),
  resolves: S.resolveStudioDefinition(S.studioDefinitionRef("gateway"))?.name,
  defaults: S.createStudioSettings("gateway"),
  inC2Catalog: S.studioCreationCatalog("c2").some((d: any) => d.kind === "gateway"),
  fields: S.studioDefinitions.gateway.fields.map((f: any) => f.path),
  performanceFields: S.studioPerformanceFields.gateway.map((f: any) => f.path),
  rejectsUnknownRouting: !S.studioGatewaySettingsSchema.safeParse({
    ...S.createStudioSettings("gateway"),
    routing: "regex",
  }).success,
  rejectsUnknownKey: !S.studioGatewaySettingsSchema.safeParse({
    ...S.createStudioSettings("gateway"),
    routes: [],
  }).success,
};

// 2. Every study: blueprint parses, is deterministic and does not change the design.
const studies: Record<string, unknown> = {};
for (const ex of S.studioArchitectureExamples) {
  const { design } = S.studioArchitectureExample(ex.id);
  const before = json(design);
  const a = S.designBlueprint(design, ex.id);
  const b = S.designBlueprint(design, ex.id);
  const parsed = S.designBlueprintSchema.safeParse(a);
  studies[ex.id] = {
    parses: parsed.success,
    ...(parsed.success ? {} : { issues: parsed.error.issues.slice(0, 3) }),
    deterministic: json(a) === json(b),
    designUnchanged: json(design) === before,
    ...summary(a),
  };
}
out.studies = studies;

// 3. Owner projects: read-only GETs only.
const owner: Record<string, unknown> = {};
const list = (await get("/projects")).body.projects;
for (const p of list) {
  const first = await get(`/projects/${p.id}/blueprint`);
  const second = await get(`/projects/${p.id}/blueprint`);
  const design = (await get(`/projects/${p.id}/design`)).body.design;
  const local = S.designBlueprint(S.designSchema.parse(design), p.name);
  const parsed = S.designBlueprintSchema.safeParse(first.body);
  owner[p.name] = {
    status: first.status,
    cacheControl: first.cache,
    parses: parsed.success,
    ...(parsed.success ? {} : { issues: parsed.error.issues.slice(0, 3) }),
    stableAcrossRequests: json(first.body) === json(second.body),
    // Key order follows the stored document; compare semantically.
    equalsPureFunction: json(canon(first.body)) === json(canon(local)),
    hasNoLayoutOrHistory: !/"(layout|history|positions|x|y|canUndo|operationId)"/.test(
      json(first.body),
    ),
    ...summary(first.body),
  };
}
const after = (await get("/projects")).body.projects;
out.ownerProjects = owner;
out.ownerProjectsUnchanged =
  json(list.map((p: any) => [p.id, p.revision, p.updatedAt])) ===
  json(after.map((p: any) => [p.id, p.revision, p.updatedAt]));
out.unknownProject = (await get("/projects/00000000-0000-4000-8000-000000000000/blueprint")).status;
out.malformedId = (await get("/projects/not-a-uuid/blueprint")).status;

// 4. TinyURL-shaped disposable project with a gateway and components, through the real API.
const created = await (
  await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: json({ name: "SG03 disposable blueprint probe" }),
  })
).json();
const pid = created.project.id;
out.disposableProject = pid;
try {
  let design = (await get(`/projects/${pid}/design`)).body.design;
  const send = async (command: any) => {
    const batch = S.buildStudioCommand(design, command);
    const r = await fetch(`${API}/projects/${pid}/operations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: json({ baseRevision: batch.baseRevision, ops: batch.ops, source: "api" }),
    });
    const body = await r.json();
    if (r.ok) design = body.design;
    return r.status;
  };
  const link = (
    id: string,
    from: string,
    to: string,
    label: string,
    protocol: string,
    kind: string,
    settings: any = {},
  ) => ({
    id,
    from,
    to,
    kind,
    planned: {
      label,
      protocol,
      interaction: protocol === "Messaging" ? "Asynchronous" : "Request / response",
      security: "Service identity",
    },
    settings,
  });
  const el = (id: string, name: string, settings: any, extra: any = {}) => ({
    id,
    name,
    settings,
    ...extra,
  });
  const steps: Record<string, number> = {};
  steps.create = await send({
    type: "create",
    system: { name: "TinyURL probe" },
    elements: [
      el("edge-gateway", "Edge gateway", {
        ...S.createStudioSettings("gateway"),
        provider: "envoy",
        minReplicas: 2,
        maxReplicas: 8,
        autoscaleOn: "requests-per-second",
        requestTimeoutMs: 1000,
      }),
      el("shorten-api", "Shorten API", {
        ...S.createStudioSettings("service"),
        requestTimeoutMs: 2000,
      }),
      el("redirect", "Redirect service", {
        ...S.createStudioSettings("service"),
        exposure: "public",
        concurrencyLimit: 5000,
      }),
      el("analytics", "Analytics worker", { ...S.createStudioSettings("worker"), concurrency: 8 }),
      el("links-db", "Links database", {
        kind: "database",
        engine: "postgresql",
        provider: "self-hosted",
        readReplicas: 2,
        partitionKey: "short_code",
      }),
      el("link-cache", "Link cache", {
        kind: "cache",
        engine: "redis-compatible",
        provider: "self-hosted",
        topology: "cluster",
        eviction: "lru",
      }),
      el(
        "clicks",
        "Click events",
        { kind: "queue", mode: "topic", provider: "self-hosted", partitions: 12 },
        { owner: { kind: "element", id: "redirect" } },
      ),
      el("reputation", "URL reputation API", {
        kind: "external-api",
        category: "generic",
        provider: "external",
      }),
    ],
    connections: [
      link(
        "gw-shorten",
        "edge-gateway",
        "shorten-api",
        "Routes shorten requests",
        "HTTPS",
        "calls",
        { timeoutMs: 1500, retry: { mode: "fixed", attempts: 2, delayMs: 50 } },
      ),
      link("gw-redirect", "edge-gateway", "redirect", "Routes redirects", "HTTPS", "calls", {
        timeoutMs: 200,
        retry: { mode: "none" },
      }),
      link("shorten-db", "shorten-api", "links-db", "Writes links", "SQL", "uses-database"),
      link("shorten-rep", "shorten-api", "reputation", "Checks URL reputation", "HTTPS", "calls", {
        timeoutMs: 800,
      }),
      link("redirect-cache", "redirect", "link-cache", "Reads links", "Redis", "depends-on"),
      link("redirect-db", "redirect", "links-db", "Reads links on miss", "SQL", "uses-database"),
      link("redirect-clicks", "redirect", "clicks", "Publishes clicks", "Messaging", "depends-on", {
        channelUse: "publish",
      }),
      link(
        "clicks-analytics",
        "clicks",
        "analytics",
        "Consumes clicks",
        "Messaging",
        "depends-on",
        { channelUse: "consume" },
      ),
    ],
  });
  const comp = (
    id: string,
    host: string,
    kind: string,
    name: string,
    extra: any = {},
    description?: string,
  ) => ({
    id,
    host,
    name,
    ...(description && { description }),
    settings: { ...S.createStudioComponentSettings(kind), ...extra },
  });
  const linkTo = (id: string, from: string, to: string, via: string) => ({
    link: { id, from, to: { kind: "element", id: to, via } },
  });
  steps.rateLimiter = await send({
    type: "createComponent",
    component: comp("rl", "shorten-api", "rate-limiter", "Rate limiter", {
      limit: 100,
      windowSeconds: 60,
    }),
  });
  steps.idGenerator = await send({
    type: "createComponent",
    component: comp("idgen", "shorten-api", "id-generator", "ID generator", {
      strategy: "range-allocation",
      blockSize: 1000,
    }),
    links: [linkTo("idgen-db", "idgen", "links-db", "shorten-db")],
  });
  steps.externalCall = await send({
    type: "createComponent",
    component: comp("rep-call", "shorten-api", "external-call", "Reputation check", {
      circuitBreaker: "enabled",
    }),
    links: [linkTo("rep-call-api", "rep-call", "reputation", "shorten-rep")],
  });
  steps.cacheReader = await send({
    type: "createComponent",
    component: comp("cr", "redirect", "cache-reader", "Cache reader", {
      l1MaxEntries: 10000,
      l1TtlSeconds: 30,
      stampede: "single-flight",
    }),
    links: [linkTo("cr-cache", "cr", "link-cache", "redirect-cache")],
  });
  steps.dataAccess = await send({
    type: "createComponent",
    component: comp("da", "redirect", "data-access", "Data access", { readRouting: "replica" }),
    links: [linkTo("da-db", "da", "links-db", "redirect-db")],
  });
  steps.responder = await send({
    type: "createComponent",
    component: comp("resp", "redirect", "redirect-responder", "Redirect responder", {
      edgeMaxAgeSeconds: 60,
    }),
  });
  steps.publisher = await send({
    type: "createComponent",
    component: comp("pub", "redirect", "event-publisher", "Click publisher", {
      batchSize: 500,
      lingerMs: 20,
    }),
    links: [linkTo("pub-clicks", "pub", "clicks", "redirect-clicks")],
  });
  steps.internal = await send({
    type: "connectComponent",
    links: [
      { link: { id: "cr-da", from: "cr", to: { kind: "component", id: "da" }, label: "on miss" } },
    ],
  });
  steps.consumer = await send({
    type: "createComponent",
    component: comp("cons", "analytics", "event-consumer", "Click consumer", { retryLimit: 5 }),
    links: [linkTo("cons-clicks", "cons", "clicks", "clicks-analytics")],
  });
  steps.custom = await send({
    type: "createComponent",
    component: comp(
      "agg",
      "analytics",
      "custom",
      "Aggregation",
      {},
      "Rolls clicks up per link and hour.",
    ),
  });
  const before = await get(`/projects/${pid}/design`);
  const blueprint = await get(`/projects/${pid}/blueprint`);
  const again = await get(`/projects/${pid}/design`);
  const parsed = S.designBlueprintSchema.safeParse(blueprint.body);
  out.disposable = {
    steps,
    status: blueprint.status,
    parses: parsed.success,
    ...(parsed.success ? {} : { issues: parsed.error.issues.slice(0, 5) }),
    readLeavesRevision: before.body.design.revision === again.body.design.revision,
    ...summary(blueprint.body),
    findingCodes: [...new Set(blueprint.body.findings.map((f: any) => f.code))],
  };
  writeFileSync(
    `${outDir}/tinyurl-probe-blueprint.json`,
    `${JSON.stringify(blueprint.body, null, 2)}\n`,
  );
} finally {
  const r = await fetch(`${API}/projects/${pid}`, { method: "DELETE" });
  out.disposableDeleted = r.status;
  out.disposableGoneAfterDelete = (await get(`/projects/${pid}/blueprint`)).status;
}

// 5. JSON Schema export.
const schema = S.designBlueprintJsonSchema();
out.jsonSchema = {
  dialect: schema.$schema,
  topLevel: Object.keys(schema.properties),
  required: schema.required,
  bytes: json(schema).length,
};
writeFileSync(`${outDir}/blueprint.schema.json`, `${JSON.stringify(schema, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));

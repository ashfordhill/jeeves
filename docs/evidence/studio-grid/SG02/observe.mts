// biome-ignore-all lint/suspicious/noExplicitAny: one-off evidence script over dynamically imported spec sources.
// SG02 one-off observations. Usage: node observe.mts <spec-src-index> [label]
const specPath = process.argv[2];
const S: any = await import(specPath);
const out: Record<string, unknown> = {};
const lookup = { get: () => undefined, versions: () => [] };
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
const same = (a: any, b: any) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const firstDiff = (a: any, b: any, path = ""): string | null => {
  if (JSON.stringify(canon(a)) === JSON.stringify(canon(b))) return null;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  return `${path}: ${JSON.stringify(a)?.slice(0, 120)} -> ${JSON.stringify(b)?.slice(0, 120)}`;
};
const codes = (f: any[]) => f.map((x) => `${x.code}:${(x.target.path ?? []).join(".")}`).sort();

// 1. Every existing study reads unchanged and validates exactly as before.
const studies: Record<string, unknown> = {};
for (const ex of S.studioArchitectureExamples) {
  const { design } = S.studioArchitectureExample(ex.id);
  const json = JSON.stringify(design);
  const parsed = S.designSchema.parse(JSON.parse(json));
  studies[ex.id] = {
    roundTripIdentical: JSON.stringify(parsed) === json,
    semanticallyIdentical: same(parsed, JSON.parse(json)),
    studioFindings: codes(S.validateStudio(parsed)),
    designFindings: codes(S.validateDesign(parsed, lookup)).length,
    generation: S.studioGenerationSupport(parsed).supported,
  };
}
out.studies = studies;

// 2. Owner projects (read-only GET) parse unchanged.
const owner: Record<string, unknown> = {};
try {
  const list = await (await fetch("http://127.0.0.1:4310/projects")).json();
  for (const p of list.projects) {
    const body = await (await fetch(`http://127.0.0.1:4310/projects/${p.id}/design`)).json();
    const design = body.design ?? body;
    const json = JSON.stringify(design);
    const parsed = S.designSchema.safeParse(JSON.parse(json));
    owner[p.name] = {
      parses: parsed.success,
      roundTripSemanticallyIdentical: parsed.success && same(parsed.data, JSON.parse(json)),
      firstDiff: parsed.success ? firstDiff(JSON.parse(json), parsed.data) : null,
      studioFindings: parsed.success ? codes(S.validateStudio(parsed.data)).length : null,
    };
  }
} catch (e) {
  owner.error = String(e);
}
out.ownerProjects = owner;
if (process.argv[3] === "head") {
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// 3. Command round trip on a small TinyURL-shaped design.
let design = S.emptyDesign();
const apply = (command: any) => {
  const batch = S.buildStudioCommand(design, command);
  const r = S.applyOperations(design, batch.ops, lookup, { baseRevision: batch.baseRevision });
  if (!r.ok) return { ok: false, errors: codes(r.errors) };
  design = r.design;
  return {
    ok: true,
    readiness: codes(r.findings.filter((f: any) => f.target.path?.[2]?.startsWith?.("component"))),
  };
};
const http = (id: string, from: string, to: string, label: string, protocol = "HTTPS") => ({
  id,
  from,
  to,
  kind: protocol === "HTTPS" ? "calls" : "uses-database",
  planned: { label, protocol, interaction: "Request / response", security: "Service identity" },
  settings: { retry: { mode: "unspecified" } },
});
const svc = (id: string, name: string, extra: any = {}) => ({
  id,
  name,
  settings: { ...S.createStudioSettings("service"), ...extra },
});
const steps: Record<string, unknown> = {};
steps.create = (() => {
  const r = apply({
    type: "create",
    system: { name: "TinyURL" },
    elements: [
      svc("shorten-api", "Shorten API", {
        minReplicas: 2,
        maxReplicas: 6,
        autoscaleOn: "cpu",
        requestTimeoutMs: 2000,
        concurrencyLimit: 200,
      }),
      {
        id: "analytics-worker",
        name: "Analytics worker",
        settings: {
          ...S.createStudioSettings("worker"),
          concurrency: 8,
          minReplicas: 1,
          maxReplicas: 4,
          autoscaleOn: "queue-lag",
        },
      },
      {
        id: "links-db",
        name: "Links database",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "self-hosted",
          readReplicas: 2,
          partitionKey: "short_code",
        },
      },
      {
        id: "link-cache",
        name: "Link cache",
        settings: {
          kind: "cache",
          engine: "redis-compatible",
          provider: "self-hosted",
          ttlSeconds: 3600,
          topology: "cluster",
          eviction: "lru",
        },
      },
      {
        id: "click-events",
        name: "Click events",
        owner: { kind: "element", id: "shorten-api" },
        settings: { kind: "queue", mode: "topic", provider: "self-hosted", partitions: 12 },
      },
      {
        id: "reputation",
        name: "URL reputation API",
        settings: { kind: "external-api", category: "generic", provider: "external" },
      },
      {
        id: "edge",
        name: "CDN",
        settings: {
          kind: "cdn",
          provider: "cloudflare",
          origin: "shorten-api",
          cacheRedirects: "enabled",
        },
      },
    ],
    connections: [
      { ...http("api-db", "shorten-api", "links-db", "Reads & writes", "SQL"), settings: {} },
      { ...http("api-cache", "shorten-api", "link-cache", "Reads", "Redis"), settings: {} },
      {
        id: "api-clicks",
        from: "shorten-api",
        to: "click-events",
        kind: "depends-on",
        planned: {
          label: "Publishes",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: { channelUse: "publish" },
      },
      {
        id: "clicks-worker",
        from: "click-events",
        to: "analytics-worker",
        kind: "depends-on",
        planned: {
          label: "Consumes",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: { channelUse: "consume" },
      },
    ],
  });
  return r;
})();
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
steps.createCacheReaderUnlinked = apply({
  type: "createComponent",
  component: comp("cache-reader", "shorten-api", "cache-reader", "Cache reader", {
    l1MaxEntries: 10000,
    l1TtlSeconds: 30,
    l2TtlSeconds: 3600,
    stampede: "single-flight",
  }),
});
steps.connectCacheReader = apply({
  type: "connectComponent",
  links: [
    {
      link: {
        id: "cr-cache",
        from: "cache-reader",
        to: { kind: "element", id: "link-cache", via: "api-cache" },
      },
    },
  ],
});
steps.createDataAccessReplica = apply({
  type: "createComponent",
  component: comp("data-access", "shorten-api", "data-access", "Data access", {
    poolSize: 20,
    readRouting: "replica",
    statementTimeoutMs: 500,
  }),
  links: [
    {
      link: {
        id: "da-db",
        from: "data-access",
        to: { kind: "element", id: "links-db", via: "api-db" },
      },
    },
  ],
});
steps.internalLink = apply({
  type: "connectComponent",
  links: [
    {
      link: {
        id: "cr-da",
        from: "cache-reader",
        to: { kind: "component", id: "data-access" },
        label: "on miss",
      },
    },
  ],
});
steps.createIdGeneratorRange = apply({
  type: "createComponent",
  component: comp("id-gen", "shorten-api", "id-generator", "ID generator", {
    strategy: "range-allocation",
    blockSize: 1000,
    minLength: 7,
  }),
  links: [
    {
      link: {
        id: "idg-db",
        from: "id-gen",
        to: { kind: "element", id: "links-db", via: "api-db" },
      },
    },
  ],
});
steps.createPublisherOutbox = apply({
  type: "createComponent",
  component: comp("publisher", "shorten-api", "event-publisher", "Click publisher", {
    batchSize: 100,
    lingerMs: 50,
    outbox: "enabled",
  }),
  links: [
    {
      link: {
        id: "pub-q",
        from: "publisher",
        to: { kind: "element", id: "click-events", via: "api-clicks" },
      },
    },
  ],
});
steps.createExternalCallWithNewC2Connection = apply({
  type: "createComponent",
  component: comp("reputation-check", "shorten-api", "external-call", "Reputation check", {
    circuitBreaker: "enabled",
  }),
  links: [
    {
      link: {
        id: "rc-ext",
        from: "reputation-check",
        to: { kind: "element", id: "reputation", via: "api-reputation" },
      },
      connection: {
        ...http("api-reputation", "shorten-api", "reputation", "Checks URL"),
        settings: { timeoutMs: 800, retry: { mode: "fixed", attempts: 1, delayMs: 100 } },
      },
    },
  ],
});
steps.createConsumer = apply({
  type: "createComponent",
  component: comp("consumer", "analytics-worker", "event-consumer", "Click consumer", {
    concurrency: 4,
    batchSize: 500,
    retryLimit: 5,
  }),
  links: [
    {
      link: {
        id: "con-q",
        from: "consumer",
        to: { kind: "element", id: "click-events", via: "clicks-worker" },
      },
    },
  ],
});
steps.publisherOutboxLinkClearsGap = apply({
  type: "connectComponent",
  links: [
    {
      link: {
        id: "pub-db",
        from: "publisher",
        to: { kind: "element", id: "links-db", via: "api-db" },
      },
    },
  ],
});
steps.createCustomNoPurpose = apply({
  type: "createComponent",
  component: comp("aggregate", "analytics-worker", "custom", "Aggregation"),
});
steps.editCustomPurpose = apply({
  type: "editComponent",
  component: "aggregate",
  description: "Rolls click events into hourly counts.",
});
steps.editComponentSettings = apply({
  type: "editComponent",
  component: "cache-reader",
  settings: {
    kind: "cache-reader",
    pattern: "cache-aside",
    l1MaxEntries: 20000,
    l1TtlSeconds: 30,
    l2TtlSeconds: 3600,
    negativeTtlSeconds: 60,
    stampede: "single-flight",
  },
});

// Round trip of the resulting document.
const json = JSON.stringify(design);
const reparsed = S.designSchema.parse(JSON.parse(json));
steps.roundTripIdentical = JSON.stringify(reparsed) === json;
steps.roundTripSemanticallyIdentical = same(reparsed, JSON.parse(json));
steps.roundTripFirstDiff = firstDiff(JSON.parse(json), reparsed);
steps.finalStudioFindings = codes(S.validateStudio(reparsed));
steps.generationSupported = S.studioGenerationSupport(reparsed).supported;
steps.componentCount = design.architecture.studio.components.length;
steps.componentLinkCount = design.architecture.studio.componentConnections.length;

// 4. Structural rejections (batch rejected, design unchanged).
const before = JSON.stringify(design);
const rejects: Record<string, unknown> = {};
rejects.hostIsResource = apply({
  type: "createComponent",
  component: comp("bad1", "links-db", "data-access", "Bad"),
});
rejects.crossHostComponentLink = apply({
  type: "connectComponent",
  links: [{ link: { id: "bad2", from: "consumer", to: { kind: "component", id: "data-access" } } }],
});
rejects.viaDoesNotJoinHost = apply({
  type: "connectComponent",
  links: [
    {
      link: {
        id: "bad3",
        from: "consumer",
        to: { kind: "element", id: "links-db", via: "api-db" },
      },
    },
  ],
});
rejects.wrongTargetKind = apply({
  type: "connectComponent",
  links: [
    {
      link: {
        id: "bad4",
        from: "cache-reader",
        to: { kind: "element", id: "links-db", via: "api-db" },
      },
    },
  ],
});
rejects.wrongChannelRole = apply({
  type: "createComponent",
  component: comp("bad5", "shorten-api", "event-consumer", "Bad"),
  links: [
    {
      link: {
        id: "bad5-q",
        from: "bad5",
        to: { kind: "element", id: "click-events", via: "api-clicks" },
      },
    },
  ],
});
rejects.idCollision = apply({
  type: "createComponent",
  component: comp("links-db", "shorten-api", "custom", "Dup", {}, "x"),
});
rejects.dlqNotQueue = apply({
  type: "editComponent",
  component: "consumer",
  settings: { kind: "event-consumer", deadLetterQueue: "links-db" },
});
rejects.dlqSameAsSource = apply({
  type: "editComponent",
  component: "consumer",
  settings: { kind: "event-consumer", deadLetterQueue: "click-events" },
});
rejects.kindChange = (() => {
  try {
    return apply({ type: "editComponent", component: "consumer", settings: { kind: "custom" } });
  } catch (e) {
    return { thrown: String((e as Error).message) };
  }
})();
rejects.designUnchanged = JSON.stringify(design) === before;

// 5. Schema rejections for settings.
const schema = (s: any, v: any) => {
  const r = s.safeParse(v);
  return r.success
    ? "accepted"
    : r.error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`);
};
out.schema = {
  blockSizeWithSnowflake: schema(S.studioComponentSettingsSchema, {
    kind: "id-generator",
    strategy: "snowflake",
    blockSize: 10,
    encoding: "base62",
  }),
  l1TtlWithoutSize: schema(S.studioComponentSettingsSchema, {
    kind: "cache-reader",
    pattern: "cache-aside",
    l1TtlSeconds: 5,
    stampede: "none",
  }),
  unknownField: schema(S.studioComponentSettingsSchema, {
    kind: "auth-guard",
    credential: "jwt",
    issuer: "x",
  }),
  redirect308: schema(S.studioComponentSettingsSchema, {
    kind: "redirect-responder",
    status: "308",
  }),
  minAboveMax: schema(S.studioSettingsSchema, {
    ...S.createStudioSettings("service"),
    minReplicas: 5,
    maxReplicas: 2,
  }),
  autoscaleWithoutMax: schema(S.studioSettingsSchema, {
    ...S.createStudioSettings("service"),
    autoscaleOn: "cpu",
  }),
  workerRequestTimeout: schema(S.studioSettingsSchema, {
    ...S.createStudioSettings("worker"),
    requestTimeoutMs: 10,
  }),
  managedServiceWithScaling: schema(S.studioSettingsSchema, {
    kind: "service",
    execution: "managed",
    host: "aws",
    language: "go",
    exposure: "public",
    minReplicas: 0,
    maxReplicas: 3,
    autoscaleOn: "requests-per-second",
  }),
  badPartitionKey: schema(S.studioSettingsSchema, {
    kind: "database",
    engine: "postgresql",
    provider: "neon",
    partitionKey: "orders.id",
  }),
  tooManyReplicas: schema(S.studioSettingsSchema, {
    kind: "database",
    engine: "postgresql",
    provider: "neon",
    readReplicas: 16,
  }),
  memcachedEviction: schema(S.studioSettingsSchema, {
    kind: "cache",
    engine: "memcached",
    provider: "aws",
    eviction: "lfu",
    topology: "standalone",
  }),
  unsupportedStudioVersion: schema(S.studioModelSchema, {
    version: 2,
    elements: [],
    packages: [],
    connections: [],
  }),
};

// 6. Remapping on copy/insertion.
const mapped = S.mapStudioModel(design.architecture.studio, {
  "shorten-api": "api-2",
  "click-events": "events-2",
  "api-clicks": "pub-2",
  publisher: "publisher-2",
});
out.remap = {
  publisherHost: mapped.components.find((c: any) => c.id === "publisher-2")?.host,
  publisherLink: mapped.componentConnections.find((l: any) => l.id === "pub-q"),
};

// 7. Removal semantics.
steps.disconnectInternal = apply({ type: "disconnectComponent", links: ["cr-da"] });
steps.removeComponent = apply({ type: "removeComponent", components: ["id-gen"] });
steps.afterRemove = {
  components: design.architecture.studio.components.map((c: any) => c.id),
  links: design.architecture.studio.componentConnections.map((l: any) => l.id),
  c2ConnectionKept: design.connections.some((c: any) => c.id === "api-db"),
};
steps.disconnectC2Connection = apply({ type: "delete", connections: ["api-reputation"] });
steps.afterC2Disconnect = {
  links: design.architecture.studio.componentConnections.map((l: any) => l.id),
};
steps.deleteHost = apply({ type: "delete", elements: ["analytics-worker"] });
steps.afterHostDelete = {
  components: design.architecture.studio.components.map((c: any) => c.id),
  links: design.architecture.studio.componentConnections.map((l: any) => l.id),
};
// Raw apply-level disconnect also prunes (via pruneStudioAfterDelete).
{
  const r = S.applyOperations(design, [{ op: "disconnect", id: "api-cache" }], lookup);
  steps.rawDisconnectPrunes = r.ok
    ? r.design.architecture.studio.componentConnections.map((l: any) => l.id)
    : codes(r.errors);
}
out.steps = steps;
out.rejects = rejects;
out.perfDescriptors = Object.fromEntries(
  Object.entries(S.studioPerformanceFields).map(([k, v]: any) => [k, v.map((f: any) => f.path)]),
);
out.componentCatalog = Object.fromEntries(
  Object.entries(S.studioComponentDefinitions).map(([k, d]: any) => [
    k,
    { targets: d.targets, fields: d.fields.map((f: any) => f.path) },
  ]),
);
// Descriptor/schema agreement: every non-kind settings key has a descriptor.
const missing: string[] = [];
for (const [kind, d] of Object.entries(S.studioComponentDefinitions) as any) {
  const keys = Object.keys(S.studioComponentSettingsSchemas[kind].shape).filter(
    (k) => k !== "kind",
  );
  for (const k of keys)
    if (!d.fields.some((f: any) => f.path === `settings.${k}`)) missing.push(`${kind}.${k}`);
}
out.componentDescriptorGaps = missing;
console.log(JSON.stringify(out, null, 2));

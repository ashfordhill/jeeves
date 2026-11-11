/**
 * Finite C3 component catalog. A component is a module inside exactly one studio
 * application. Settings are design intent. Each kind names the tiles it may live in, its slots
 * (the uses of a tile it can take) and what it generates: the lead of a template, a part of
 * templates or a stub (the module authoring contract, section 2). Third-party products are the
 * intended implementation; Jeeves code would only wire them.
 */
import { z } from "zod";
import { idSchema } from "./ids.ts";
import type { StudioKind } from "./studio-model.ts";

export const studioComponentLimits = {
  components: 500,
  componentConnections: 1000,
  name: 120,
  description: 240,
  action: 60,
  rateLimit: { min: 1, max: 1_000_000 },
  windowSeconds: { min: 1, max: 86_400 },
  l1MaxEntries: { min: 1, max: 10_000_000 },
  l1TtlSeconds: { min: 1, max: 86_400 },
  l2TtlSeconds: { min: 1, max: 604_800 },
  negativeTtlSeconds: { min: 1, max: 86_400 },
  blockSize: { min: 1, max: 1_000_000 },
  minLength: { min: 1, max: 32 },
  edgeMaxAgeSeconds: { min: 0, max: 31_536_000 },
  batchSize: { min: 1, max: 10_000 },
  lingerMs: { min: 0, max: 60_000 },
  concurrency: { min: 1, max: 1024 },
  retryLimit: { min: 0, max: 100 },
  poolSize: { min: 1, max: 1000 },
  statementTimeoutMs: { min: 1, max: 300_000 },
} as const;
const bounded = ({ min, max }: { min: number; max: number }) => z.int().min(min).max(max);

export const studioComponentKinds = [
  "rate-limiter",
  "cache-reader",
  "id-generator",
  "redirect-responder",
  "event-publisher",
  "event-consumer",
  "data-access",
  "auth-guard",
  "external-call",
  "custom",
  "multipart-uploads",
  "lifecycle-writer",
  "video-encoder",
  "video-packager",
  "video-thumbnailer",
  "event-counter",
  "index-writer",
  "search-query",
] as const;
export const studioComponentKindSchema = z.enum(studioComponentKinds);
export type StudioComponentKind = z.infer<typeof studioComponentKindSchema>;

export const rateLimiterAlgorithmSchema = z.enum(["token-bucket", "sliding-window"]);
export const rateLimiterKeySchema = z.enum(["ip", "api-key", "user"]);
export const rateLimiterStoreSchema = z.enum(["memory", "redis"]);
export const cacheReaderPatternSchema = z.enum(["cache-aside", "read-through"]);
export const cacheStampedeSchema = z.enum(["none", "single-flight"]);
export const idGeneratorStrategySchema = z.enum([
  "db-sequence",
  "redis-counter",
  "range-allocation",
  "snowflake",
  "random",
]);
export const idEncodingSchema = z.enum(["base62", "base58", "base36", "decimal"]);
export const redirectStatusSchema = z.enum(["301", "302", "307"]);
export const switchSchema = z.enum(["disabled", "enabled"]);
export const dataReadRoutingSchema = z.enum(["primary", "replica"]);
export const authCredentialSchema = z.enum(["jwt", "api-key", "session"]);

/** Every kind is a strict object; omitted optional numbers mean "unspecified", never zero. */
export const studioRateLimiterSettingsSchema = z.strictObject({
  kind: z.literal("rate-limiter"),
  algorithm: rateLimiterAlgorithmSchema,
  limit: bounded(studioComponentLimits.rateLimit).optional(),
  windowSeconds: bounded(studioComponentLimits.windowSeconds).optional(),
  key: rateLimiterKeySchema,
  store: rateLimiterStoreSchema,
});
export const studioCacheReaderSettingsSchema = z
  .strictObject({
    kind: z.literal("cache-reader"),
    pattern: cacheReaderPatternSchema,
    /** Absent means no in-process L1 tier. */
    l1MaxEntries: bounded(studioComponentLimits.l1MaxEntries).optional(),
    l1TtlSeconds: bounded(studioComponentLimits.l1TtlSeconds).optional(),
    l2TtlSeconds: bounded(studioComponentLimits.l2TtlSeconds).optional(),
    /** Absent means misses are not cached. */
    negativeTtlSeconds: bounded(studioComponentLimits.negativeTtlSeconds).optional(),
    stampede: cacheStampedeSchema,
  })
  .superRefine((value, ctx) => {
    if (value.l1TtlSeconds !== undefined && value.l1MaxEntries === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["l1TtlSeconds"],
        message: "An L1 TTL requires an L1 size; omit both for no in-process tier.",
      });
  });
export const studioIdGeneratorSettingsSchema = z
  .strictObject({
    kind: z.literal("id-generator"),
    strategy: idGeneratorStrategySchema,
    blockSize: bounded(studioComponentLimits.blockSize).optional(),
    encoding: idEncodingSchema,
    minLength: bounded(studioComponentLimits.minLength).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.blockSize !== undefined && value.strategy !== "range-allocation")
      ctx.addIssue({
        code: "custom",
        path: ["blockSize"],
        message: "Block size applies only to range allocation.",
      });
  });
export const studioRedirectResponderSettingsSchema = z.strictObject({
  kind: z.literal("redirect-responder"),
  status: redirectStatusSchema,
  edgeMaxAgeSeconds: bounded(studioComponentLimits.edgeMaxAgeSeconds).optional(),
});
export const studioEventPublisherSettingsSchema = z.strictObject({
  kind: z.literal("event-publisher"),
  batchSize: bounded(studioComponentLimits.batchSize).optional(),
  lingerMs: bounded(studioComponentLimits.lingerMs).optional(),
  /** Enabled requires the host to depend on a database; validation reports a readiness gap. */
  outbox: switchSchema,
});
export const studioEventConsumerSettingsSchema = z.strictObject({
  kind: z.literal("event-consumer"),
  concurrency: bounded(studioComponentLimits.concurrency).optional(),
  batchSize: bounded(studioComponentLimits.batchSize).optional(),
  retryLimit: bounded(studioComponentLimits.retryLimit).optional(),
  /** Queue element ID; graph validation requires a queue that is not the source queue. */
  deadLetterQueue: idSchema.optional(),
});
export const studioDataAccessSettingsSchema = z.strictObject({
  kind: z.literal("data-access"),
  poolSize: bounded(studioComponentLimits.poolSize).optional(),
  readRouting: dataReadRoutingSchema,
  statementTimeoutMs: bounded(studioComponentLimits.statementTimeoutMs).optional(),
});
export const studioAuthGuardSettingsSchema = z.strictObject({
  kind: z.literal("auth-guard"),
  credential: authCredentialSchema,
});
/**
 * Timeout and retries stay on the traced C2 connection binding (single destination rule);
 * the component owns only the circuit-breaker choice.
 */
export const studioExternalCallSettingsSchema = z.strictObject({
  kind: z.literal("external-call"),
  circuitBreaker: switchSchema,
});
/** The purpose is the component description; the generator later emits an interface and stub. */
export const studioCustomComponentSettingsSchema = z.strictObject({ kind: z.literal("custom") });
/** The leads and parts below have no settings of their own except the Lifecycle writer's SQL. */
export const studioMultipartUploadsSettingsSchema = z.strictObject({
  kind: z.literal("multipart-uploads"),
});
export const studioLifecycleWriterSettingsSchema = z.strictObject({
  kind: z.literal("lifecycle-writer"),
  poolSize: bounded(studioComponentLimits.poolSize).optional(),
  statementTimeoutMs: bounded(studioComponentLimits.statementTimeoutMs).optional(),
});
export const studioVideoEncoderSettingsSchema = z.strictObject({
  kind: z.literal("video-encoder"),
});
export const studioVideoPackagerSettingsSchema = z.strictObject({
  kind: z.literal("video-packager"),
});
export const studioVideoThumbnailerSettingsSchema = z.strictObject({
  kind: z.literal("video-thumbnailer"),
});
export const studioEventCounterSettingsSchema = z.strictObject({
  kind: z.literal("event-counter"),
});
export const studioIndexWriterSettingsSchema = z.strictObject({ kind: z.literal("index-writer") });
export const studioSearchQuerySettingsSchema = z.strictObject({ kind: z.literal("search-query") });

export const studioComponentSettingsSchemas = {
  "rate-limiter": studioRateLimiterSettingsSchema,
  "cache-reader": studioCacheReaderSettingsSchema,
  "id-generator": studioIdGeneratorSettingsSchema,
  "redirect-responder": studioRedirectResponderSettingsSchema,
  "event-publisher": studioEventPublisherSettingsSchema,
  "event-consumer": studioEventConsumerSettingsSchema,
  "data-access": studioDataAccessSettingsSchema,
  "auth-guard": studioAuthGuardSettingsSchema,
  "external-call": studioExternalCallSettingsSchema,
  custom: studioCustomComponentSettingsSchema,
  "multipart-uploads": studioMultipartUploadsSettingsSchema,
  "lifecycle-writer": studioLifecycleWriterSettingsSchema,
  "video-encoder": studioVideoEncoderSettingsSchema,
  "video-packager": studioVideoPackagerSettingsSchema,
  "video-thumbnailer": studioVideoThumbnailerSettingsSchema,
  "event-counter": studioEventCounterSettingsSchema,
  "index-writer": studioIndexWriterSettingsSchema,
  "search-query": studioSearchQuerySettingsSchema,
} as const;
export const studioComponentSettingsSchema = z.discriminatedUnion("kind", [
  studioRateLimiterSettingsSchema,
  studioCacheReaderSettingsSchema,
  studioIdGeneratorSettingsSchema,
  studioRedirectResponderSettingsSchema,
  studioEventPublisherSettingsSchema,
  studioEventConsumerSettingsSchema,
  studioDataAccessSettingsSchema,
  studioAuthGuardSettingsSchema,
  studioExternalCallSettingsSchema,
  studioCustomComponentSettingsSchema,
  studioMultipartUploadsSettingsSchema,
  studioLifecycleWriterSettingsSchema,
  studioVideoEncoderSettingsSchema,
  studioVideoPackagerSettingsSchema,
  studioVideoThumbnailerSettingsSchema,
  studioEventCounterSettingsSchema,
  studioIndexWriterSettingsSchema,
  studioSearchQuerySettingsSchema,
]);
export type StudioComponentSettings = z.infer<typeof studioComponentSettingsSchema>;
export type StudioComponentSettingsByKind = {
  [K in StudioComponentKind]: Extract<StudioComponentSettings, { kind: K }>;
};

/** Creation defaults only. Parsing never fills them into older documents. */
export function createStudioComponentSettings<K extends StudioComponentKind>(
  kind: K,
): StudioComponentSettingsByKind[K] {
  const defaults: StudioComponentSettingsByKind = {
    "rate-limiter": {
      kind: "rate-limiter",
      algorithm: "token-bucket",
      key: "ip",
      store: "memory",
    },
    "cache-reader": { kind: "cache-reader", pattern: "cache-aside", stampede: "none" },
    "id-generator": { kind: "id-generator", strategy: "db-sequence", encoding: "base62" },
    "redirect-responder": { kind: "redirect-responder", status: "302" },
    "event-publisher": { kind: "event-publisher", outbox: "disabled" },
    "event-consumer": { kind: "event-consumer" },
    "data-access": { kind: "data-access", readRouting: "primary" },
    "auth-guard": { kind: "auth-guard", credential: "jwt" },
    "external-call": { kind: "external-call", circuitBreaker: "disabled" },
    custom: { kind: "custom" },
    "multipart-uploads": { kind: "multipart-uploads" },
    "lifecycle-writer": { kind: "lifecycle-writer" },
    "video-encoder": { kind: "video-encoder" },
    "video-packager": { kind: "video-packager" },
    "video-thumbnailer": { kind: "video-thumbnailer" },
    "event-counter": { kind: "event-counter" },
    "index-writer": { kind: "index-writer" },
    "search-query": { kind: "search-query" },
  };
  return defaults[kind];
}

const componentName = z.string().trim().min(1).max(studioComponentLimits.name);
const componentDescription = z.string().trim().max(studioComponentLimits.description);
/** One component lives inside exactly one application element (its host). */
export const studioComponentSchema = z.strictObject({
  id: idSchema,
  host: idSchema,
  name: componentName,
  description: componentDescription.optional(),
  settings: studioComponentSettingsSchema,
});
export type StudioComponent = z.infer<typeof studioComponentSchema>;

/**
 * A component's use of something. A target component must share the host. A target element is
 * reached only through `via`, an existing C2 connection between the host and that element (either
 * direction), so C3 never contradicts C2. The C3 arrow follows the via connection's direction.
 */
export const studioComponentTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("component"), id: idSchema }),
  z.strictObject({ kind: z.literal("element"), id: idSchema, via: idSchema }),
]);
export type StudioComponentTarget = z.infer<typeof studioComponentTargetSchema>;
export const studioComponentConnectionSchema = z.strictObject({
  id: idSchema,
  from: idSchema,
  to: studioComponentTargetSchema,
  /** Optional short action; absent means a derived label. */
  label: z.string().trim().min(1).max(studioComponentLimits.action).optional(),
});
export type StudioComponentConnection = z.infer<typeof studioComponentConnectionSchema>;

/** Element target kinds a component may use (studio or legacy kind of the target element). */
export type StudioComponentTargetKind =
  | "application"
  | "identity"
  | "database"
  | "cache"
  | "queue"
  | "search"
  | "object-store"
  | "cdn"
  | "external-api";
type ComponentFieldBase = { label: string; group: "General" | "Options"; help?: string };
export type StudioComponentField =
  | (ComponentFieldBase & {
      path: "component.name" | "component.description";
      control: "text";
      min: number;
      max: number;
      optional?: true;
    })
  | (ComponentFieldBase & {
      path: `settings.${string}`;
      control: "select";
      choices: readonly { value: string; label: string }[];
    })
  | (ComponentFieldBase & {
      path: `settings.${string}`;
      control: "integer";
      min: number;
      max: number;
      unit?: string;
      optional: true;
    })
  | (ComponentFieldBase & {
      path: "settings.deadLetterQueue";
      control: "reference";
      reference: { target: "queue" };
      optional: true;
    });
/** The installed templates a module can lead or be part of (`generationTemplates` keys). */
export const studioModuleTemplates = [
  "owned-multipart",
  "asset-lifecycle",
  "video-hls",
  "positive-cache-read",
  "event-counter",
  "search-projection",
  "search-query",
] as const;
export type StudioModuleTemplate = (typeof studioModuleTemplates)[number];
/** The slot names across the catalog. */
export const studioModuleSlotIds = [
  "store",
  "cache",
  "loader",
  "channel",
  "outbox",
  "database",
  "identity",
  "target",
  "uses",
  "objects",
  "state",
  "originals",
  "outputs",
  "index",
] as const;
export const studioModuleSlotIdSchema = z.enum(studioModuleSlotIds);
export type StudioModuleSlotId = (typeof studioModuleSlotIds)[number];
/**
 * One named use of a tile through the host's link (its arrow follows that link), or, for the
 * Cache reader's loader, of another module in the same tile (`module`, `in-process`). `needed`
 * means needed for the module's template; an unconnected module is still allowed and is a stub.
 * A slot takes one connection unless `many`.
 */
export type StudioModuleSlot = {
  id: StudioModuleSlotId;
  /** Tile kinds it accepts; empty for an in-process slot. */
  targets: readonly StudioComponentTargetKind[];
  /** For an in-process slot: the module kind it uses in the same tile. */
  module?: StudioComponentKind;
  use:
    | "read"
    | "write"
    | "read-write"
    | "publish"
    | "consume"
    | "verify"
    | "request"
    | "in-process"
    | "uses";
  need: "needed" | "optional";
  many?: true;
};
/** What a module generates: its template as the lead, a part of these templates, or a stub. */
export type StudioModuleGeneration =
  | { kind: "lead"; template: StudioModuleTemplate }
  | { kind: "part"; templates: readonly StudioModuleTemplate[] }
  | { kind: "stub" };

export type StudioComponentDefinition<K extends StudioComponentKind = StudioComponentKind> = {
  kind: K;
  name: string;
  description: string;
  /** Typical third-party implementation; design intent, not an installed template. */
  thirdParty: readonly string[];
  /** Browser apps host only client-safe components. */
  browserHost: boolean;
  /** Tile kinds a new module of this kind may be added to (Identity, Gateway and Browser: none). */
  hosts: readonly StudioKind[];
  /** Video-specific kinds carry "Video" in their names. */
  scope: "generic" | "video";
  /** Its uses of tiles (and the loader's of a module), in order; none means it can't connect. */
  slots: readonly StudioModuleSlot[];
  generation: StudioModuleGeneration;
  /** Element kinds this component may use through a traced C2 connection. */
  targets: readonly StudioComponentTargetKind[];
  /** Queue links must trace through a C2 connection with this channel role. */
  channelUse?: "publish" | "consume";
  fields: readonly StudioComponentField[];
  defaults: Readonly<StudioComponentSettingsByKind[K]>;
  /** Reserved for a separately authorized exact runtime resolver. Always absent here. */
  runtimeSupport?: never;
};

const label = (value: string) =>
  ({
    "token-bucket": "Token bucket",
    "sliding-window": "Sliding window",
    ip: "IP address",
    "api-key": "API key",
    user: "User",
    memory: "In memory",
    redis: "Redis",
    "cache-aside": "Cache-aside",
    "read-through": "Read-through",
    none: "None",
    "single-flight": "Single-flight",
    "db-sequence": "Database sequence",
    "redis-counter": "Redis counter",
    "range-allocation": "Range allocation",
    snowflake: "Snowflake",
    random: "Random with collision check",
    base62: "Base62",
    base58: "Base58",
    base36: "Base36",
    decimal: "Decimal",
    "301": "301 Moved permanently",
    "302": "302 Found",
    "307": "307 Temporary redirect",
    disabled: "Disabled",
    enabled: "Enabled",
    primary: "Primary",
    replica: "Replica",
    jwt: "JWT",
    session: "Session",
  })[value] ?? value;
const select = (
  key: string,
  text: string,
  options: readonly string[],
  group: "General" | "Options" = "Options",
  help?: string,
): StudioComponentField => ({
  path: `settings.${key}`,
  label: text,
  group,
  control: "select",
  choices: options.map((value) => ({ value, label: label(value) })),
  ...(help && { help }),
});
const integer = (
  key: string,
  text: string,
  range: { min: number; max: number },
  unit?: string,
  help?: string,
): StudioComponentField => ({
  path: `settings.${key}`,
  label: text,
  group: "Options",
  control: "integer",
  ...range,
  ...(unit && { unit }),
  optional: true,
  ...(help && { help }),
});
const general: readonly StudioComponentField[] = [
  {
    path: "component.name",
    label: "Name",
    group: "General",
    control: "text",
    min: 1,
    max: studioComponentLimits.name,
  },
  {
    path: "component.description",
    label: "Purpose",
    group: "General",
    control: "text",
    min: 0,
    max: studioComponentLimits.description,
    optional: true,
  },
];
const L = studioComponentLimits;
/** Existing tiles of the legacy coded kinds keep their modules and offer the generic kinds. */
const anyHost: readonly StudioKind[] = [
  "service",
  "worker",
  "uploads",
  "redirect",
  "notification",
  "billing",
];
const slot = (
  id: StudioModuleSlotId,
  targets: readonly StudioComponentTargetKind[],
  use: StudioModuleSlot["use"],
  need: StudioModuleSlot["need"] = "needed",
): StudioModuleSlot => ({ id, targets, use, need });
const stub = { kind: "stub" } as const;
const lead = (template: StudioModuleTemplate) => ({ kind: "lead", template }) as const;
const part = (...templates: StudioModuleTemplate[]) => ({ kind: "part", templates }) as const;
const allTargets: readonly StudioComponentTargetKind[] = [
  "application",
  "identity",
  "database",
  "cache",
  "queue",
  "search",
  "object-store",
  "cdn",
  "external-api",
];
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function component<K extends StudioComponentKind>(
  kind: K,
  metadata: Omit<StudioComponentDefinition<K>, "kind" | "defaults" | "runtimeSupport">,
): StudioComponentDefinition<K> {
  return deepFreeze({
    ...metadata,
    kind,
    fields: [...general, ...metadata.fields],
    defaults: createStudioComponentSettings(kind),
  });
}

export const studioComponentDefinitions: {
  readonly [K in StudioComponentKind]: StudioComponentDefinition<K>;
} = Object.freeze({
  "rate-limiter": component("rate-limiter", {
    name: "Rate limiter",
    description: "Rejects requests above a per-key limit.",
    thirdParty: ["Redis"],
    browserHost: false,
    hosts: anyHost,
    scope: "generic",
    slots: [slot("store", ["cache"], "read-write", "optional")],
    generation: stub,
    targets: ["cache"],
    fields: [
      select("algorithm", "Algorithm", rateLimiterAlgorithmSchema.options),
      integer("limit", "Limit per window", L.rateLimit, "requests"),
      integer("windowSeconds", "Window", L.windowSeconds, "s"),
      select("key", "Key", rateLimiterKeySchema.options),
      select(
        "store",
        "Store",
        rateLimiterStoreSchema.options,
        "Options",
        "Redis needs a connection to a cache.",
      ),
    ],
  }),
  "cache-reader": component("cache-reader", {
    name: "Cache reader",
    description: "Reads from a cache before the database.",
    thirdParty: ["Redis", "Memcached"],
    browserHost: false,
    hosts: anyHost,
    scope: "generic",
    slots: [
      slot("cache", ["cache"], "read-write"),
      { id: "loader", targets: [], module: "data-access", use: "in-process", need: "needed" },
    ],
    generation: lead("positive-cache-read"),
    targets: ["cache"],
    fields: [
      select("pattern", "Pattern", cacheReaderPatternSchema.options),
      integer("l1MaxEntries", "L1 in-process size", L.l1MaxEntries, "entries", "Empty: no L1."),
      integer("l1TtlSeconds", "L1 TTL", L.l1TtlSeconds, "s"),
      integer("l2TtlSeconds", "Shared cache TTL", L.l2TtlSeconds, "s"),
      integer("negativeTtlSeconds", "Negative caching TTL", L.negativeTtlSeconds, "s"),
      select("stampede", "Stampede protection", cacheStampedeSchema.options),
    ],
  }),
  "id-generator": component("id-generator", {
    name: "ID generator",
    description: "Allocates unique short identifiers.",
    thirdParty: ["PostgreSQL", "Redis"],
    browserHost: false,
    hosts: anyHost,
    scope: "generic",
    slots: [slot("store", ["database", "cache"], "read-write", "optional")],
    generation: stub,
    targets: ["database", "cache"],
    fields: [
      select("strategy", "Strategy", idGeneratorStrategySchema.options),
      integer("blockSize", "Block size", L.blockSize, "ids"),
      select("encoding", "Encoding", idEncodingSchema.options),
      integer("minLength", "Minimum length", L.minLength, "characters"),
    ],
  }),
  "redirect-responder": component("redirect-responder", {
    name: "Redirect responder",
    description: "Answers with an HTTP redirect and edge cache headers.",
    thirdParty: ["CDN"],
    browserHost: false,
    hosts: anyHost,
    scope: "generic",
    slots: [],
    generation: stub,
    targets: [],
    fields: [
      select("status", "Status", redirectStatusSchema.options),
      integer("edgeMaxAgeSeconds", "Edge max-age", L.edgeMaxAgeSeconds, "s"),
    ],
  }),
  "event-publisher": component("event-publisher", {
    name: "Event publisher",
    description: "Publishes events.",
    thirdParty: ["Kafka", "Amazon SQS", "Redis Streams"],
    browserHost: false,
    hosts: anyHost,
    scope: "generic",
    // The outbox is needed for jobs and publication, not for results.
    slots: [
      slot("channel", ["queue"], "publish"),
      slot("outbox", ["database"], "write", "optional"),
    ],
    generation: part("owned-multipart", "asset-lifecycle", "video-hls"),
    targets: ["queue", "database"],
    channelUse: "publish",
    fields: [
      integer("batchSize", "Batch size", L.batchSize, "events"),
      integer("lingerMs", "Linger", L.lingerMs, "ms"),
      select(
        "outbox",
        "Transactional outbox",
        switchSchema.options,
        "Options",
        "Requires a database dependency.",
      ),
    ],
  }),
  "event-consumer": component("event-consumer", {
    name: "Event consumer",
    description: "Consumes events.",
    thirdParty: ["Kafka", "Amazon SQS", "Redis Streams"],
    browserHost: false,
    hosts: anyHost,
    scope: "generic",
    slots: [slot("channel", ["queue"], "consume")],
    generation: part("asset-lifecycle", "video-hls", "event-counter", "search-projection"),
    targets: ["queue"],
    channelUse: "consume",
    fields: [
      integer("concurrency", "Concurrency", L.concurrency),
      integer("batchSize", "Batch size", L.batchSize, "events"),
      integer("retryLimit", "Retry limit", L.retryLimit, "attempts"),
      {
        path: "settings.deadLetterQueue",
        label: "Dead-letter queue",
        group: "Options",
        control: "reference",
        reference: { target: "queue" },
        optional: true,
      },
    ],
  }),
  "data-access": component("data-access", {
    name: "Data access",
    description: "Reads and writes one database.",
    thirdParty: ["PostgreSQL"],
    browserHost: false,
    hosts: anyHost,
    scope: "generic",
    slots: [slot("database", ["database"], "read-write")],
    generation: part("owned-multipart", "positive-cache-read", "event-counter"),
    targets: ["database"],
    fields: [
      integer("poolSize", "Pool size", L.poolSize, "connections"),
      select(
        "readRouting",
        "Read routing",
        dataReadRoutingSchema.options,
        "Options",
        "Replica reads need database read replicas.",
      ),
      integer("statementTimeoutMs", "Statement timeout", L.statementTimeoutMs, "ms"),
    ],
  }),
  "auth-guard": component("auth-guard", {
    name: "Auth guard",
    description: "Verifies caller credentials against an identity provider.",
    thirdParty: ["Identity service"],
    browserHost: true,
    hosts: anyHost,
    scope: "generic",
    slots: [slot("identity", ["identity", "external-api"], "verify")],
    generation: part("owned-multipart"),
    targets: ["identity", "external-api"],
    fields: [select("credential", "Credential", authCredentialSchema.options)],
  }),
  "external-call": component("external-call", {
    name: "External call",
    description: "Calls another service or external API.",
    thirdParty: ["Any API"],
    browserHost: true,
    hosts: anyHost,
    scope: "generic",
    slots: [slot("target", ["external-api", "application", "identity"], "request", "optional")],
    generation: stub,
    targets: ["external-api", "application", "identity"],
    fields: [
      select(
        "circuitBreaker",
        "Circuit breaker",
        switchSchema.options,
        "Options",
        "Timeout and retries are set on the traced connection.",
      ),
    ],
  }),
  custom: component("custom", {
    name: "Custom",
    description: "Your own logic, generated as a stub.",
    thirdParty: [],
    browserHost: true,
    hosts: anyHost,
    scope: "generic",
    slots: [{ ...slot("uses", allTargets, "uses", "optional"), many: true }],
    generation: stub,
    targets: allTargets,
    fields: [],
  }),
  "multipart-uploads": component("multipart-uploads", {
    name: "Multipart uploads",
    description: "Uploads large files in resumable parts.",
    thirdParty: ["S3-compatible storage"],
    browserHost: false,
    hosts: ["uploads", "service"],
    scope: "generic",
    slots: [slot("objects", ["object-store"], "read-write")],
    generation: lead("owned-multipart"),
    targets: ["object-store"],
    fields: [],
  }),
  "lifecycle-writer": component("lifecycle-writer", {
    name: "Lifecycle writer",
    description: "Records each upload's processing state.",
    thirdParty: ["PostgreSQL"],
    browserHost: false,
    hosts: ["worker"],
    scope: "generic",
    slots: [slot("state", ["database"], "read-write")],
    generation: lead("asset-lifecycle"),
    targets: ["database"],
    fields: [
      integer("poolSize", "Pool size", L.poolSize, "connections"),
      integer("statementTimeoutMs", "Statement timeout", L.statementTimeoutMs, "ms"),
    ],
  }),
  "video-encoder": component("video-encoder", {
    name: "Video encoder",
    description: "Encodes a video into streamable renditions.",
    thirdParty: ["FFmpeg"],
    browserHost: false,
    hosts: ["worker"],
    scope: "video",
    slots: [slot("originals", ["object-store"], "read")],
    generation: lead("video-hls"),
    targets: ["object-store"],
    fields: [],
  }),
  "video-packager": component("video-packager", {
    name: "Video packager",
    description: "Stores a video's stream segments and playlists.",
    thirdParty: ["FFmpeg"],
    browserHost: false,
    hosts: ["worker"],
    scope: "video",
    slots: [slot("outputs", ["object-store"], "write")],
    generation: part("video-hls"),
    targets: ["object-store"],
    fields: [],
  }),
  "video-thumbnailer": component("video-thumbnailer", {
    name: "Video thumbnailer",
    description: "Creates a video's thumbnails.",
    thirdParty: ["FFmpeg"],
    browserHost: false,
    hosts: ["worker"],
    scope: "video",
    slots: [slot("outputs", ["object-store"], "write")],
    generation: part("video-hls"),
    targets: ["object-store"],
    fields: [],
  }),
  "event-counter": component("event-counter", {
    name: "Event counter",
    description: "Counts each event once.",
    thirdParty: ["PostgreSQL"],
    browserHost: false,
    hosts: ["worker"],
    scope: "generic",
    slots: [],
    generation: lead("event-counter"),
    targets: [],
    fields: [],
  }),
  "index-writer": component("index-writer", {
    name: "Index writer",
    description: "Adds records to a search index.",
    thirdParty: ["OpenSearch"],
    browserHost: false,
    hosts: ["worker"],
    scope: "generic",
    slots: [slot("index", ["search"], "write")],
    generation: lead("search-projection"),
    targets: ["search"],
    fields: [],
  }),
  "search-query": component("search-query", {
    name: "Search query",
    description: "Searches one search index.",
    thirdParty: ["OpenSearch"],
    browserHost: false,
    hosts: ["service"],
    scope: "generic",
    slots: [slot("index", ["search"], "read")],
    generation: lead("search-query"),
    targets: ["search"],
    fields: [],
  }),
});

/** Element links a component's settings require before it is ready (readiness, not structure). */
export function studioComponentRequirements(settings: StudioComponentSettings): {
  kinds: readonly StudioComponentTargetKind[];
  reason: string;
}[] {
  const need = (kinds: readonly StudioComponentTargetKind[], reason: string) => [{ kinds, reason }];
  switch (settings.kind) {
    case "rate-limiter":
      return settings.store === "redis"
        ? need(["cache"], "A Redis-backed rate limiter needs a cache connection.")
        : [];
    case "cache-reader":
      return need(["cache"], "A cache reader needs a cache connection.");
    case "id-generator":
      if (settings.strategy === "redis-counter")
        return need(["cache"], "A Redis counter needs a cache connection.");
      if (settings.strategy === "db-sequence" || settings.strategy === "range-allocation")
        return need(["database"], `${label(settings.strategy)} needs a database connection.`);
      return [];
    case "event-publisher":
      return [
        ...need(["queue"], "An event publisher needs a publish connection to a queue."),
        ...(settings.outbox === "enabled"
          ? need(["database"], "A transactional outbox needs a database connection.")
          : []),
      ];
    case "event-consumer":
      return need(["queue"], "An event consumer needs a consume connection from a queue.");
    case "data-access":
      return need(["database"], "Data access needs a database connection.");
    case "external-call":
      return need(
        studioComponentDefinitions["external-call"].targets,
        "An external call needs a target service or external system.",
      );
    default:
      return [];
  }
}

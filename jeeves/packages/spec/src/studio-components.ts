/**
 * Finite C3 component catalog. A component is a module inside exactly one studio
 * application. Settings are design intent; no template exists for any component yet.
 * Third-party products are the intended implementation; Jeeves code would only wire them.
 */
import { z } from "zod";
import { idSchema } from "./ids.ts";

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
export type StudioComponentDefinition<K extends StudioComponentKind = StudioComponentKind> = {
  kind: K;
  name: string;
  description: string;
  /** Typical third-party implementation; design intent, not an installed template. */
  thirdParty: readonly string[];
  /** Browser apps host only client-safe components. */
  browserHost: boolean;
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
    description: "Serves reads from cache tiers before the source of truth.",
    thirdParty: ["Redis", "Memcached"],
    browserHost: false,
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
    targets: [],
    fields: [
      select("status", "Status", redirectStatusSchema.options),
      integer("edgeMaxAgeSeconds", "Edge max-age", L.edgeMaxAgeSeconds, "s"),
    ],
  }),
  "event-publisher": component("event-publisher", {
    name: "Event publisher",
    description: "Publishes events to a queue or topic.",
    thirdParty: ["Kafka", "Amazon SQS", "Redis Streams"],
    browserHost: false,
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
    description: "Consumes events from a queue or topic.",
    thirdParty: ["Kafka", "Amazon SQS", "Redis Streams"],
    browserHost: false,
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
    description: "Reads and writes one database through a connection pool.",
    thirdParty: ["PostgreSQL"],
    browserHost: false,
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
    targets: ["identity", "external-api"],
    fields: [select("credential", "Credential", authCredentialSchema.options)],
  }),
  "external-call": component("external-call", {
    name: "External call",
    description: "Calls another service or external system with resilience settings.",
    thirdParty: ["Any API"],
    browserHost: true,
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
    description: "Project-specific logic; generation later emits an interface and stub.",
    thirdParty: [],
    browserHost: true,
    targets: [
      "application",
      "identity",
      "database",
      "cache",
      "queue",
      "search",
      "object-store",
      "cdn",
      "external-api",
    ],
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

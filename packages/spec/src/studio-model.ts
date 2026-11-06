/** Finite, design-only studio settings. Defaults are creation inputs, never read migrations. */
import { z } from "zod";
import { idSchema, versionSchema } from "./ids.ts";
import { relationshipInteractionSchema } from "./relationship-display.ts";
import {
  studioComponentConnectionSchema,
  studioComponentLimits,
  studioComponentSchema,
} from "./studio-components.ts";

export const studioLimits = {
  elements: 500,
  packages: 50,
  members: { min: 2, max: 50 },
  connections: 500,
  name: 120,
  description: 240,
  action: 60,
  /** A lane action's name: the one large word on its tile. */
  actionName: 24,
  concurrency: { min: 1, max: 1024 },
  ttlSeconds: { min: 1, max: 604800 },
  retentionSeconds: { min: 60, max: 1209600 },
  timeoutMs: { min: 1, max: 300000 },
  attempts: { min: 1, max: 10 },
  delayMs: { min: 1, max: 60000 },
  replicas: { min: 0, max: 1000 },
  requestTimeoutMs: { min: 1, max: 300000 },
  concurrencyLimit: { min: 1, max: 100000 },
  readReplicas: { min: 0, max: 15 },
  partitionKey: 63,
  partitions: { min: 1, max: 1024 },
} as const;
const boundedInteger = ({ min, max }: { min: number; max: number }) => z.int().min(min).max(max);

export const studioKinds = [
  "service",
  "browser",
  "worker",
  "billing",
  "redirect",
  "notification",
  "identity",
  "gateway",
  "database",
  "cache",
  "queue",
  "object-store",
  "search",
  "cdn",
  "external-api",
] as const;
export const studioKindSchema = z.enum(studioKinds);
export type StudioKind = z.infer<typeof studioKindSchema>;
export const studioApplicationKinds = [
  "service",
  "browser",
  "worker",
  "billing",
  "redirect",
  "notification",
  "identity",
  "gateway",
] as const;
export const studioResourceKinds = [
  "database",
  "cache",
  "queue",
  "object-store",
  "search",
] as const;

/** An exact immutable definition identity. */
export const definitionRefSchema = z.strictObject({ id: idSchema, version: versionSchema });
export type DefinitionRef = z.infer<typeof definitionRefSchema>;
export const studioDefinitionVersion = "1.0.0" as const;
export function studioDefinitionRef(kind: StudioKind): DefinitionRef {
  return { id: `studio-${kind}`, version: studioDefinitionVersion };
}
/** Unknown versions remain explicit unresolved intent, with no latest-version substitution. */
export function studioDefinitionStatus(ref: DefinitionRef, kind: StudioKind) {
  const declared = studioKinds.find((candidate) => `studio-${candidate}` === ref.id);
  if (declared && declared !== kind) return "kind-mismatch";
  return declared && ref.version === studioDefinitionVersion ? "known" : "unresolved";
}

export const studioExecutionSchema = z.enum(["docker", "managed"]);
export const studioLanguageSchema = z.enum(["typescript", "go"]);
export type StudioLanguage = z.infer<typeof studioLanguageSchema>;
/**
 * The two languages each coded application kind offers, default first. Gateway and CDN are
 * products, not code, and have no language; the browser app (not on the canvas) has none either.
 */
export const studioKindLanguages = {
  service: ["typescript", "go"],
  worker: ["typescript", "go"],
  redirect: ["go", "typescript"],
  identity: ["typescript", "go"],
  notification: ["typescript", "go"],
  billing: ["typescript", "go"],
} as const satisfies Partial<Record<StudioKind, readonly [StudioLanguage, StudioLanguage]>>;
export type StudioCodedKind = keyof typeof studioKindLanguages;
const languageNames: Record<StudioLanguage, string> = { typescript: "TypeScript", go: "Go" };
/** A coded kind's language: one of its two, refused in plain words otherwise. */
const kindLanguageSchema = (kind: StudioCodedKind) => {
  const pair = studioKindLanguages[kind];
  return z.enum(pair, {
    error: `Choose ${pair.map((value) => languageNames[value]).join(" or ")}; this kind offers no other language.`,
  });
};
export const studioHostSchema = z.enum([
  "unspecified",
  "cloudflare-workers",
  "aws",
  "google-cloud",
  "external",
]);
export const studioExposureSchema = z.enum(["internal", "public"]);
export const studioDeliverySchema = z.enum(["standalone", "bundled"]);
export const studioBrowserProviderSchema = z.enum([
  "unspecified",
  "cloudflare",
  "aws",
  "google-cloud",
  "external",
]);
export const studioBillingProviderSchema = z.enum(["unspecified", "stripe", "external"]);
export const studioNotificationProviderSchema = z.enum([
  "unspecified",
  "resend",
  "aws-ses",
  "external",
]);
export const studioIdentityProviderSchema = z.enum(["unspecified", "oidc", "external"]);
/** Gateway routing and product intent. Third-party gateways are the intended implementation. */
export const studioGatewayRoutingSchema = z.enum(["path-prefix", "host-name"]);
export const studioGatewayProviderSchema = z.enum([
  "unspecified",
  "envoy",
  "kong",
  "nginx",
  "traefik",
  "aws-api-gateway",
  "external",
]);

/** Scaling signal. Queue lag only makes sense for an application that consumes a queue. */
export const studioAutoscaleSignalSchema = z.enum(["cpu", "requests-per-second", "queue-lag"]);
/**
 * Performance intent, optional on every common application kind (absent = unspecified).
 * Workers keep their existing `concurrency` as their concurrency limit and have no request timeout.
 */
const scalingFields = {
  minReplicas: boundedInteger(studioLimits.replicas).optional(),
  maxReplicas: boundedInteger({ ...studioLimits.replicas, min: 1 }).optional(),
  autoscaleOn: studioAutoscaleSignalSchema.optional(),
};
const requestFields = {
  requestTimeoutMs: boundedInteger(studioLimits.requestTimeoutMs).optional(),
  concurrencyLimit: boundedInteger(studioLimits.concurrencyLimit).optional(),
};
type Scaling = { minReplicas?: number; maxReplicas?: number; autoscaleOn?: string };
function checkScaling(value: Scaling, ctx: z.RefinementCtx) {
  if (
    value.minReplicas !== undefined &&
    value.maxReplicas !== undefined &&
    value.minReplicas > value.maxReplicas
  )
    ctx.addIssue({
      code: "custom",
      path: ["maxReplicas"],
      message: "Maximum replicas must be at least the minimum.",
    });
  if (
    value.autoscaleOn !== undefined &&
    (value.maxReplicas === undefined || value.maxReplicas <= (value.minReplicas ?? 1))
  )
    ctx.addIssue({
      code: "custom",
      path: ["autoscaleOn"],
      message: "Autoscaling needs a maximum replica count above the minimum (default 1).",
    });
}
function applicationSettings<K extends StudioKind, S extends z.ZodRawShape>(kind: K, fields: S) {
  const common = { kind: z.literal(kind), ...fields };
  return z
    .discriminatedUnion("execution", [
      z.strictObject({ ...common, execution: z.literal(studioExecutionSchema.enum.docker) }),
      z.strictObject({
        ...common,
        execution: z.literal(studioExecutionSchema.enum.managed),
        host: studioHostSchema,
      }),
    ])
    .superRefine((value, ctx) => checkScaling(value as Scaling, ctx));
}
export const studioServiceSettingsSchema = applicationSettings("service", {
  language: kindLanguageSchema("service"),
  exposure: studioExposureSchema,
  ...scalingFields,
  ...requestFields,
});
export const studioWorkerSettingsSchema = applicationSettings("worker", {
  language: kindLanguageSchema("worker"),
  concurrency: boundedInteger(studioLimits.concurrency).optional(),
  ...scalingFields,
});
export const studioBillingSettingsSchema = applicationSettings("billing", {
  language: kindLanguageSchema("billing"),
  exposure: studioExposureSchema,
  ...scalingFields,
  ...requestFields,
  provider: studioBillingProviderSchema,
});
export const studioRedirectSettingsSchema = applicationSettings("redirect", {
  language: kindLanguageSchema("redirect"),
  exposure: studioExposureSchema,
  ...scalingFields,
  ...requestFields,
  lookupStoreConnection: idSchema.optional(),
  lookupCacheConnection: idSchema.optional(),
});
export const studioNotificationSettingsSchema = applicationSettings("notification", {
  language: kindLanguageSchema("notification"),
  exposure: studioExposureSchema,
  ...scalingFields,
  ...requestFields,
  provider: studioNotificationProviderSchema,
});
export const studioIdentitySettingsSchema = applicationSettings("identity", {
  language: kindLanguageSchema("identity"),
  exposure: studioExposureSchema,
  ...scalingFields,
  ...requestFields,
  provider: studioIdentityProviderSchema,
});
export const studioGatewaySettingsSchema = applicationSettings("gateway", {
  exposure: studioExposureSchema,
  ...scalingFields,
  ...requestFields,
  routing: studioGatewayRoutingSchema,
  provider: studioGatewayProviderSchema,
});
export const studioBrowserSettingsSchema = z.discriminatedUnion("delivery", [
  z.strictObject({
    kind: z.literal("browser"),
    delivery: z.literal(studioDeliverySchema.enum.standalone),
    provider: studioBrowserProviderSchema,
  }),
  z.strictObject({
    kind: z.literal("browser"),
    delivery: z.literal(studioDeliverySchema.enum.bundled),
    servedBy: idSchema.optional(),
  }),
]);

const undecidedProviders = ["unspecified", "external"] as const;
const hostedProviders = ["unspecified", "self-hosted", "aws", "google-cloud", "external"] as const;
export const studioDatabaseEngineSchema = z.enum([
  "unspecified",
  "postgresql",
  "mysql",
  "sqlite",
  "mongodb",
  "clickhouse",
]);
export const studioDatabaseProviderSchema = z.enum([
  ...hostedProviders,
  "neon",
  "supabase",
  "cloudflare-d1",
]);
export const studioDatabaseProviders = {
  unspecified: undecidedProviders,
  postgresql: [...hostedProviders, "neon", "supabase"],
  mysql: hostedProviders,
  sqlite: ["unspecified", "self-hosted", "cloudflare-d1", "external"],
  mongodb: ["unspecified", "self-hosted", "external"],
  /** Analytical column store (TinyURL analytics). */
  clickhouse: ["unspecified", "self-hosted", "aws", "google-cloud", "external"],
} as const;
export const studioCacheEngineSchema = z.enum(["unspecified", "redis-compatible", "memcached"]);
export const studioCacheProviderSchema = z.enum([...hostedProviders, "upstash"]);
export const studioCacheProviders = {
  unspecified: undecidedProviders,
  "redis-compatible": [...hostedProviders, "upstash"],
  memcached: hostedProviders,
} as const;
export const studioQueueModeSchema = z.enum(["work-queue", "topic"]);
export const studioQueueProviderSchema = z.enum([...hostedProviders, "cloudflare-queues"]);
export const studioObjectStoreProviderSchema = z.enum([
  "unspecified",
  "self-hosted",
  "cloudflare-r2",
  "aws-s3",
  "google-cloud-storage",
  "external",
]);
export const studioObjectAccessSchema = z.enum(["private", "public"]);
export const studioSearchEngineSchema = z.enum([
  "unspecified",
  "opensearch",
  "elasticsearch",
  "meilisearch",
  "external",
]);
export const studioSearchProviderSchema = z.enum(hostedProviders);
export const studioSearchProviders = {
  unspecified: undecidedProviders,
  opensearch: hostedProviders,
  elasticsearch: hostedProviders,
  meilisearch: hostedProviders,
  external: hostedProviders,
} as const;
export const studioCdnProviderSchema = z.enum([
  "unspecified",
  "cloudflare",
  "aws-cloudfront",
  "google-cloud-cdn",
  "external",
]);
export const studioExternalCategorySchema = z.enum([
  "generic",
  "payments",
  "email",
  "identity",
  "recognition",
  "workflow",
]);
export const studioExternalProviderSchema = studioBrowserProviderSchema;
/** Resource performance intent; every field is optional and absent means unspecified. */
export const studioCacheTopologySchema = z.enum(["standalone", "cluster"]);
export const studioCacheEvictionSchema = z.enum(["lru", "lfu", "ttl", "none"]);
export const studioCdnRedirectCachingSchema = z.enum(["disabled", "enabled"]);
/**
 * Whether the CDN resizes images from its origin per request (the width in the URL), caching each
 * size, so the origin keeps only originals. Absent means unspecified.
 */
export const studioCdnImageResizingSchema = z.enum(["disabled", "on-request"]);
/** A single column/attribute name; no table, entity or schema editor. */
export const studioPartitionKeySchema = z
  .string()
  .max(studioLimits.partitionKey)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use one column name: letters, digits and underscores");

export const studioDatabaseSettingsSchema = z
  .strictObject({
    kind: z.literal("database"),
    engine: studioDatabaseEngineSchema,
    provider: studioDatabaseProviderSchema,
    readReplicas: boundedInteger(studioLimits.readReplicas).optional(),
    partitionKey: studioPartitionKeySchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!studioDatabaseProviders[value.engine].some((provider) => provider === value.provider))
      ctx.addIssue({
        code: "custom",
        path: ["provider"],
        message: `Provider ${value.provider} is incompatible with database engine ${value.engine}.`,
      });
  });
export const studioCacheSettingsSchema = z
  .strictObject({
    kind: z.literal("cache"),
    engine: studioCacheEngineSchema,
    provider: studioCacheProviderSchema,
    ttlSeconds: boundedInteger(studioLimits.ttlSeconds).optional(),
    topology: studioCacheTopologySchema.optional(),
    eviction: studioCacheEvictionSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!studioCacheProviders[value.engine].some((provider) => provider === value.provider))
      ctx.addIssue({
        code: "custom",
        path: ["provider"],
        message: `Provider ${value.provider} is incompatible with cache engine ${value.engine}.`,
      });
  });
export const studioQueueSettingsSchema = z.strictObject({
  kind: z.literal("queue"),
  mode: studioQueueModeSchema,
  provider: studioQueueProviderSchema,
  retentionSeconds: boundedInteger(studioLimits.retentionSeconds).optional(),
  partitions: boundedInteger(studioLimits.partitions).optional(),
});
export const studioObjectStoreSettingsSchema = z.strictObject({
  kind: z.literal("object-store"),
  provider: studioObjectStoreProviderSchema,
  access: studioObjectAccessSchema,
});
export const studioSearchSettingsSchema = z
  .strictObject({
    kind: z.literal("search"),
    engine: studioSearchEngineSchema,
    provider: studioSearchProviderSchema,
  })
  .superRefine((value, ctx) => {
    if (!studioSearchProviders[value.engine].some((provider) => provider === value.provider))
      ctx.addIssue({
        code: "custom",
        path: ["provider"],
        message: `Provider ${value.provider} requires a specified search engine.`,
      });
  });
export const studioCdnSettingsSchema = z.strictObject({
  kind: z.literal("cdn"),
  provider: studioCdnProviderSchema,
  origin: idSchema.optional(),
  imageResizing: studioCdnImageResizingSchema.optional(),
  cacheRedirects: studioCdnRedirectCachingSchema.optional(),
});
export const studioExternalApiSettingsSchema = z.strictObject({
  kind: z.literal("external-api"),
  category: studioExternalCategorySchema,
  provider: studioExternalProviderSchema,
});

/** The catalog reuses these exact validators; it never reflects arbitrary legacy config. */
export const studioSettingsSchemas = {
  service: studioServiceSettingsSchema,
  browser: studioBrowserSettingsSchema,
  worker: studioWorkerSettingsSchema,
  billing: studioBillingSettingsSchema,
  redirect: studioRedirectSettingsSchema,
  notification: studioNotificationSettingsSchema,
  identity: studioIdentitySettingsSchema,
  gateway: studioGatewaySettingsSchema,
  database: studioDatabaseSettingsSchema,
  cache: studioCacheSettingsSchema,
  queue: studioQueueSettingsSchema,
  "object-store": studioObjectStoreSettingsSchema,
  search: studioSearchSettingsSchema,
  cdn: studioCdnSettingsSchema,
  "external-api": studioExternalApiSettingsSchema,
} as const;

export const studioSettingsSchema = z.discriminatedUnion("kind", [
  studioServiceSettingsSchema,
  studioBrowserSettingsSchema,
  studioWorkerSettingsSchema,
  studioBillingSettingsSchema,
  studioRedirectSettingsSchema,
  studioNotificationSettingsSchema,
  studioIdentitySettingsSchema,
  studioGatewaySettingsSchema,
  studioDatabaseSettingsSchema,
  studioCacheSettingsSchema,
  studioQueueSettingsSchema,
  studioObjectStoreSettingsSchema,
  studioSearchSettingsSchema,
  studioCdnSettingsSchema,
  studioExternalApiSettingsSchema,
]);
export type StudioSettings = z.infer<typeof studioSettingsSchema>;
export type StudioSettingsByKind = { [K in StudioKind]: Extract<StudioSettings, { kind: K }> };

/** Fresh values only. Parsing never applies these defaults or invents an optional number/ref. */
export function createStudioSettings<K extends StudioKind>(kind: K): StudioSettingsByKind[K] {
  const application = { execution: "docker", exposure: "internal" } as const;
  const language = <C extends StudioCodedKind>(coded: C) => studioKindLanguages[coded][0];
  // Preconfigured kinds start with their usual provider (studio settings, "Defaults").
  const defaults: StudioSettingsByKind = {
    service: { kind: "service", ...application, language: language("service") },
    browser: { kind: "browser", delivery: "standalone", provider: "unspecified" },
    worker: { kind: "worker", execution: application.execution, language: language("worker") },
    billing: { kind: "billing", ...application, language: language("billing"), provider: "stripe" },
    redirect: {
      kind: "redirect",
      ...application,
      language: language("redirect"),
      exposure: "public",
    },
    notification: {
      kind: "notification",
      ...application,
      language: language("notification"),
      provider: "resend",
    },
    identity: {
      kind: "identity",
      ...application,
      language: language("identity"),
      provider: "oidc",
    },
    gateway: {
      kind: "gateway",
      ...application,
      exposure: "public",
      routing: "path-prefix",
      provider: "traefik",
    },
    database: { kind: "database", engine: "unspecified", provider: "unspecified" },
    cache: { kind: "cache", engine: "unspecified", provider: "unspecified" },
    queue: { kind: "queue", mode: "work-queue", provider: "unspecified" },
    "object-store": { kind: "object-store", provider: "unspecified", access: "private" },
    search: { kind: "search", engine: "unspecified", provider: "unspecified" },
    cdn: { kind: "cdn", provider: "cloudflare" },
    "external-api": { kind: "external-api", category: "generic", provider: "unspecified" },
  };
  return defaults[kind];
}

export const studioProtocolSchema = z.enum([
  "Unspecified",
  "HTTPS",
  "HTTP",
  "gRPC",
  "WebSocket",
  "SSE",
  "SQL",
  "Redis",
  "Messaging",
  "Native binding",
]);
export const studioInteractionSchema = relationshipInteractionSchema;
export const studioRequestResponseProtocols = ["HTTP", "HTTPS", "gRPC"] as const;
export function studioAllowsRequestPolicies(protocol: string, interaction: string) {
  return (
    interaction === studioInteractionSchema.enum["Request / response"] &&
    studioRequestResponseProtocols.some((value) => value === protocol)
  );
}
export const studioAccessSchema = z.enum([
  "Service identity",
  "User identity",
  "Public",
  "Private network",
]);
export const studioActionSchema = z.string().trim().min(1).max(studioLimits.action);
export const studioChannelUseSchema = z.enum(["publish", "consume"]);
export const studioRetryModeSchema = z.enum(["unspecified", "none", "fixed"]);
export const studioRetrySchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal(studioRetryModeSchema.enum.unspecified) }),
  z.strictObject({ mode: z.literal(studioRetryModeSchema.enum.none) }),
  z.strictObject({
    mode: z.literal(studioRetryModeSchema.enum.fixed),
    attempts: boundedInteger(studioLimits.attempts),
    delayMs: boundedInteger(studioLimits.delayMs),
  }),
]);
export const studioConnectionSettingsSchema = z.strictObject({
  timeoutMs: boundedInteger(studioLimits.timeoutMs).optional(),
  retry: studioRetrySchema.optional(),
  channelUse: studioChannelUseSchema.optional(),
});
export type StudioConnectionSettings = z.infer<typeof studioConnectionSettingsSchema>;
export const studioOwnerSchema = z.strictObject({
  kind: z.enum(["element", "package"]),
  id: idSchema,
});
export type StudioOwner = z.infer<typeof studioOwnerSchema>;
/**
 * Stored settings as they read today: a coded kind's language outside its pair (or none) reads as
 * the kind's default, and a gateway's language is dropped. The one place stored designs are
 * normalised, beside the entry lane. Commands still parse settings strictly and refuse the rest.
 */
export function normalizeStoredStudioSettings(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("kind" in value)) return value;
  const kind = value.kind;
  if (kind === "gateway" && "language" in value) {
    const { language: _dropped, ...rest } = value;
    return rest;
  }
  if (typeof kind !== "string" || !Object.hasOwn(studioKindLanguages, kind)) return value;
  const pair: readonly string[] = studioKindLanguages[kind as StudioCodedKind];
  const language = "language" in value ? value.language : undefined;
  return typeof language === "string" && pair.includes(language)
    ? value
    : { ...value, language: pair[0] };
}
export const studioElementBindingSchema = z
  .strictObject({
    element: idSchema,
    definition: definitionRefSchema,
    settings: z.preprocess(normalizeStoredStudioSettings, studioSettingsSchema),
    owner: studioOwnerSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (studioDefinitionStatus(value.definition, value.settings.kind) === "kind-mismatch")
      ctx.addIssue({
        code: "custom",
        path: ["definition", "id"],
        message: "Definition kind must match settings kind.",
      });
    if (value.owner && !studioResourceKinds.some((kind) => kind === value.settings.kind))
      ctx.addIssue({
        code: "custom",
        path: ["owner"],
        message: "Only logical resources can have an owner.",
      });
    if (value.settings.kind === "queue" && !value.owner)
      ctx.addIssue({
        code: "custom",
        path: ["owner"],
        message: "A queue requires an application or package owner.",
      });
  });
export type StudioElementBinding = z.infer<typeof studioElementBindingSchema>;
export const studioPackageSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(studioLimits.name),
  description: z.string().trim().max(studioLimits.description),
  members: z.array(idSchema).min(studioLimits.members.min).max(studioLimits.members.max),
});
export type StudioPackage = z.infer<typeof studioPackageSchema>;
export const studioConnectionBindingSchema = z.strictObject({
  connection: idSchema,
  settings: studioConnectionSettingsSchema,
});
export type StudioConnectionBinding = z.infer<typeof studioConnectionBindingSchema>;
/** The actor's two lanes: download (receive, view, consume) above, upload (create, post) below. */
export const studioLanes = ["download", "upload"] as const;
export const studioLaneSchema = z.enum(studioLanes);
export type StudioLane = z.infer<typeof studioLaneSchema>;
/**
 * A link from the actor (the user, always present and never stored) to a tile, carrying one lane.
 * A tile has at most one entry. Which kinds may be entries and how many each lane holds are lane
 * rules (`studio-lanes.ts`). Designs stored while an entry could start both lanes read that entry
 * as `download`.
 */
export const studioEntrySchema = z.strictObject({
  id: idSchema,
  lane: z.preprocess((lane) => (lane === "both" ? "download" : lane), studioLaneSchema),
  element: idSchema,
});
export type StudioEntry = z.infer<typeof studioEntrySchema>;
/**
 * What the user does in a lane: at most one action per lane, drawn as an action tile between the
 * user and the lane's entries. The user links only to its actions; an entry links an action to a
 * tile. `name` is the one large word on the tile ("Watch", "Publish").
 */
export const studioLaneActionNameSchema = z
  .string()
  .trim()
  .min(1, "Name the action with a word.")
  .max(studioLimits.actionName, `Use ${studioLimits.actionName} characters or fewer.`);
export const studioLaneActionSchema = z.strictObject({
  lane: studioLaneSchema,
  name: studioLaneActionNameSchema,
});
export type StudioLaneAction = z.infer<typeof studioLaneActionSchema>;
/** Each lane's action name when none is given: the user consumes (download) or produces (upload). */
export const studioActionDefaults: Record<StudioLane, string> = {
  download: "Consume",
  upload: "Produce",
};
/**
 * The design's actions in lane order: the stored ones, plus one with the default name for each
 * lane that has entries but no action. Designs stored before actions read this way, and the
 * model's parse stores it.
 */
export function studioActions(
  studio:
    | { actions?: readonly StudioLaneAction[]; entries?: readonly { lane: StudioLane }[] }
    | undefined,
): StudioLaneAction[] {
  return studioLanes.flatMap((lane) => {
    const stored = studio?.actions?.find((action) => action.lane === lane);
    if (stored) return [{ ...stored }];
    return studio?.entries?.some((entry) => entry.lane === lane)
      ? [{ lane, name: studioActionDefaults[lane] }]
      : [];
  });
}
export const studioModelSchema = z
  .strictObject({
    version: z.literal(1, { error: "Unsupported studio version; only version 1 is supported." }),
    origin: z
      .strictObject({
        example: definitionRefSchema,
        goalManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .optional(),
    elements: z.array(studioElementBindingSchema).max(studioLimits.elements),
    packages: z.array(studioPackageSchema).max(studioLimits.packages),
    connections: z.array(studioConnectionBindingSchema).max(studioLimits.connections),
    /** Optional so version-1 documents without components read unchanged. */
    components: z.array(studioComponentSchema).max(studioComponentLimits.components).optional(),
    componentConnections: z
      .array(studioComponentConnectionSchema)
      .max(studioComponentLimits.componentConnections)
      .optional(),
    /** Optional so documents made before lanes read unchanged. */
    entries: z.array(studioEntrySchema).max(studioLimits.connections).optional(),
    /** Optional so documents made before actions read; a lane with entries gains its action. */
    actions: z.array(studioLaneActionSchema).optional(),
  })
  .superRefine((value, ctx) => {
    const unique = (items: string[], collection: string, field: string) => {
      const seen = new Set<string>();
      items.forEach((id, index) => {
        if (seen.has(id))
          ctx.addIssue({
            code: "custom",
            path: [collection, index, field],
            message: `Duplicate identity or binding: ${id}.`,
          });
        seen.add(id);
      });
    };
    unique(
      value.elements.map((item) => item.element),
      "elements",
      "element",
    );
    unique(
      value.connections.map((item) => item.connection),
      "connections",
      "connection",
    );
    unique(
      value.packages.map((item) => item.id),
      "packages",
      "id",
    );
    unique(
      (value.components ?? []).map((item) => item.id),
      "components",
      "id",
    );
    unique(
      (value.componentConnections ?? []).map((item) => item.id),
      "componentConnections",
      "id",
    );
    unique(
      (value.entries ?? []).map((item) => item.id),
      "entries",
      "id",
    );
    const members = new Set<string>();
    value.packages.forEach((item, index) => {
      item.members.forEach((id, memberIndex) => {
        if (members.has(id))
          ctx.addIssue({
            code: "custom",
            path: ["packages", index, "members", memberIndex],
            message: `Application ${id} can belong to only one package, once.`,
          });
        members.add(id);
      });
    });
    for (const lane of studioLanes) {
      const count = value.actions?.filter((action) => action.lane === lane).length ?? 0;
      if (count > 1)
        ctx.addIssue({
          code: "custom",
          path: ["actions"],
          message: `Each lane has one action; the ${lane} lane has ${count}.`,
        });
    }
  })
  // A lane with entries but no action (stored before actions) gains one with the default name.
  .transform((value) => {
    const actions = studioActions(value);
    return actions.length || value.actions ? { ...value, actions } : value;
  });
export type StudioModel = z.infer<typeof studioModelSchema>;

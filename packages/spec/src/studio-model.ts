/** Finite, design-only studio settings. Defaults are creation inputs, never read migrations. */
import { z } from "zod";
import { idSchema, versionSchema } from "./ids.ts";
import { relationshipInteractionSchema } from "./relationship-display.ts";

export const studioLimits = {
  elements: 500,
  packages: 50,
  members: { min: 2, max: 50 },
  connections: 500,
  name: 120,
  description: 240,
  action: 60,
  concurrency: { min: 1, max: 1024 },
  ttlSeconds: { min: 1, max: 604800 },
  retentionSeconds: { min: 60, max: 1209600 },
  timeoutMs: { min: 1, max: 300000 },
  attempts: { min: 1, max: 10 },
  delayMs: { min: 1, max: 60000 },
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
] as const;
export const studioResourceKinds = [
  "database",
  "cache",
  "queue",
  "object-store",
  "search",
] as const;

/** An exact immutable definition identity; it is deliberately independent of TemplateRef. */
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
export const studioLanguageSchema = z.enum([
  "unspecified",
  "typescript",
  "javascript",
  "python",
  "go",
  "java",
  "csharp",
  "rust",
]);
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

function applicationSettings<K extends StudioKind, S extends z.ZodRawShape>(kind: K, fields: S) {
  const common = { kind: z.literal(kind), language: studioLanguageSchema, ...fields };
  return z.discriminatedUnion("execution", [
    z.strictObject({ ...common, execution: z.literal(studioExecutionSchema.enum.docker) }),
    z.strictObject({
      ...common,
      execution: z.literal(studioExecutionSchema.enum.managed),
      host: studioHostSchema,
    }),
  ]);
}
export const studioServiceSettingsSchema = applicationSettings("service", {
  exposure: studioExposureSchema,
});
export const studioWorkerSettingsSchema = applicationSettings("worker", {
  concurrency: boundedInteger(studioLimits.concurrency).optional(),
});
export const studioBillingSettingsSchema = applicationSettings("billing", {
  exposure: studioExposureSchema,
  provider: studioBillingProviderSchema,
});
export const studioRedirectSettingsSchema = applicationSettings("redirect", {
  exposure: studioExposureSchema,
  lookupStoreConnection: idSchema.optional(),
  lookupCacheConnection: idSchema.optional(),
});
export const studioNotificationSettingsSchema = applicationSettings("notification", {
  exposure: studioExposureSchema,
  provider: studioNotificationProviderSchema,
});
export const studioIdentitySettingsSchema = applicationSettings("identity", {
  exposure: studioExposureSchema,
  provider: studioIdentityProviderSchema,
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

export const studioDatabaseSettingsSchema = z
  .strictObject({
    kind: z.literal("database"),
    engine: studioDatabaseEngineSchema,
    provider: studioDatabaseProviderSchema,
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
});
export const studioExternalApiSettingsSchema = z.strictObject({
  kind: z.literal("external-api"),
  category: studioExternalCategorySchema,
  provider: studioExternalProviderSchema,
});

export const studioSettingsSchema = z.discriminatedUnion("kind", [
  studioServiceSettingsSchema,
  studioBrowserSettingsSchema,
  studioWorkerSettingsSchema,
  studioBillingSettingsSchema,
  studioRedirectSettingsSchema,
  studioNotificationSettingsSchema,
  studioIdentitySettingsSchema,
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
  const application = {
    execution: "docker",
    language: "unspecified",
    exposure: "internal",
  } as const;
  const defaults: StudioSettingsByKind = {
    service: { kind: "service", ...application },
    browser: { kind: "browser", delivery: "standalone", provider: "unspecified" },
    worker: { kind: "worker", execution: application.execution, language: application.language },
    billing: { kind: "billing", ...application, provider: "unspecified" },
    redirect: { kind: "redirect", ...application, exposure: "public" },
    notification: { kind: "notification", ...application, provider: "unspecified" },
    identity: { kind: "identity", ...application, provider: "unspecified" },
    database: { kind: "database", engine: "unspecified", provider: "unspecified" },
    cache: { kind: "cache", engine: "unspecified", provider: "unspecified" },
    queue: { kind: "queue", mode: "work-queue", provider: "unspecified" },
    "object-store": { kind: "object-store", provider: "unspecified", access: "private" },
    search: { kind: "search", engine: "unspecified", provider: "unspecified" },
    cdn: { kind: "cdn", provider: "unspecified" },
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
export const studioElementBindingSchema = z
  .strictObject({
    element: idSchema,
    definition: definitionRefSchema,
    settings: studioSettingsSchema,
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
  preset: definitionRefSchema.optional(),
});
export type StudioPackage = z.infer<typeof studioPackageSchema>;
export const studioConnectionBindingSchema = z.strictObject({
  connection: idSchema,
  settings: studioConnectionSettingsSchema,
});
export type StudioConnectionBinding = z.infer<typeof studioConnectionBindingSchema>;
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
  });
export type StudioModel = z.infer<typeof studioModelSchema>;

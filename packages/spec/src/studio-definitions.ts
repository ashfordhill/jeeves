/** Immutable design vocabulary. Nothing in this catalog is an executable template. */
import type { Classification } from "./architecture-choices.ts";
import type {
  DefinitionRef,
  StudioConnectionSettings,
  StudioKind,
  StudioSettings,
  StudioSettingsByKind,
} from "./studio-model.ts";
import {
  createStudioSettings,
  studioAccessSchema,
  studioAllowsRequestPolicies,
  studioAutoscaleSignalSchema,
  studioBillingProviderSchema,
  studioBrowserProviderSchema,
  studioCacheEngineSchema,
  studioCacheEvictionSchema,
  studioCacheProviders,
  studioCacheTopologySchema,
  studioCdnProviderSchema,
  studioCdnRedirectCachingSchema,
  studioChannelUseSchema,
  studioDatabaseEngineSchema,
  studioDatabaseProviders,
  studioDefinitionRef,
  studioDeliverySchema,
  studioExecutionSchema,
  studioExposureSchema,
  studioExternalCategorySchema,
  studioExternalProviderSchema,
  studioHostSchema,
  studioIdentityProviderSchema,
  studioInteractionSchema,
  studioKinds,
  studioLanguageSchema,
  studioLimits,
  studioNotificationProviderSchema,
  studioObjectAccessSchema,
  studioObjectStoreProviderSchema,
  studioProtocolSchema,
  studioQueueModeSchema,
  studioQueueProviderSchema,
  studioRetryModeSchema,
  studioSearchEngineSchema,
  studioSearchProviders,
  studioSettingsSchemas,
} from "./studio-model.ts";

type UnionKeys<T> = T extends unknown ? keyof T : never;
type ValueAt<T, P extends PropertyKey> = T extends unknown
  ? P extends keyof T
    ? T[P]
    : never
  : never;
export type StudioFieldGroup = "General" | "Options" | "Connections";
export type StudioCreationScope = "c2" | "c3-service" | "c3-package";
export const studioLibraryGroups = [
  "Services",
  "Resources",
  "Integrations",
  "Presets",
  "Examples",
] as const;
export type StudioLibraryGroup = (typeof studioLibraryGroups)[number];
export type StudioVisual = {
  /** Existing TemplateIcon/Tabler name; no external image or logo request. */
  icon: string;
  /** Existing adaptive data-family theme color, including its dark-mode value. */
  color: "api" | "client" | "worker" | "data" | "messaging" | "external" | "generic";
  shape:
    | "service"
    | "browser"
    | "worker"
    | "cylinder"
    | "stack"
    | "channel"
    | "integration"
    | "box";
};
export type StudioChoice<V extends string = string> = { value: V; label: string };
type FieldBase = { label: string; group: StudioFieldGroup; help?: string; optional?: boolean };
type SettingCondition<K extends StudioKind> = {
  [P in Exclude<UnionKeys<StudioSettingsByKind[K]>, "kind"> & string]: {
    path: `settings.${P}`;
    equals: Extract<ValueAt<StudioSettingsByKind[K], P>, string>;
  };
}[Exclude<UnionKeys<StudioSettingsByKind[K]>, "kind"> & string];
export type StudioReference =
  | { target: "application"; excludeSelf?: true }
  | { target: "owner"; required: boolean }
  | { target: "origin"; kinds: readonly ["application", "object-store"] }
  | { target: "connection"; resource: "database" | "cache"; direction: "outgoing" };
type SettingField<K extends StudioKind> = {
  [P in Exclude<UnionKeys<StudioSettingsByKind[K]>, "kind"> & string]: FieldBase & {
    path: `settings.${P}`;
    when?: SettingCondition<K>;
  } & (
      | {
          control: "select";
          choices: readonly StudioChoice<Extract<ValueAt<StudioSettingsByKind[K], P>, string>>[];
          compatibility?: "engine";
        }
      | (Extract<ValueAt<StudioSettingsByKind[K], P>, number> extends never
          ? never
          : { control: "integer"; min: number; max: number; unit?: string })
      | (P extends "servedBy" | "origin" | "lookupStoreConnection" | "lookupCacheConnection"
          ? { control: "reference"; reference: StudioReference }
          : never)
    );
}[Exclude<UnionKeys<StudioSettingsByKind[K]>, "kind"> & string];
export type StudioCanonicalField = FieldBase & {
  path: "element.name" | "element.description";
  control: "text";
  min: number;
  max: number;
};
export type StudioElementField<K extends StudioKind = StudioKind> =
  | StudioCanonicalField
  | (FieldBase & {
      path: "owner";
      control: "reference";
      reference: Extract<StudioReference, { target: "owner" }>;
    })
  | SettingField<K>;
export type StudioDefinition<K extends StudioKind = StudioKind> = {
  id: `studio-${K}`;
  version: "1.0.0";
  kind: K;
  name: string;
  creationName: string;
  description: string;
  libraryGroup: Exclude<StudioLibraryGroup, "Examples">;
  creationScopes: readonly StudioCreationScope[];
  classification: Readonly<Pick<Classification, "kind">>;
  role: "application" | "browser" | "worker" | "data" | "messaging" | "integration";
  visual: Readonly<StudioVisual>;
  settingsSchema: (typeof studioSettingsSchemas)[K];
  defaults: Readonly<StudioSettingsByKind[K]>;
  /** Render through studioFieldGroups to apply conditions and engine/provider compatibility. */
  fields: readonly StudioElementField<K>[];
  /** Concrete graph reference selectors are field metadata, never inferred graph creation. */
  relationships: readonly (
    | "calls"
    | "uses-resource"
    | "publish"
    | "consume"
    | "origin"
    | "served-by"
  )[];
  c4bObligations: readonly string[];
  /** Reserved for a separately authorized exact runtime resolver. Always absent here. */
  runtimeSupport?: never;
};

const labels: Readonly<Record<string, string>> = {
  unspecified: "Unspecified",
  docker: "Docker",
  managed: "Managed",
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  go: "Go",
  java: "Java",
  csharp: "C#",
  rust: "Rust",
  internal: "Internal",
  public: "Public",
  private: "Private",
  standalone: "Standalone",
  bundled: "Bundled",
  "cloudflare-workers": "Cloudflare Workers",
  aws: "AWS",
  "google-cloud": "Google Cloud",
  external: "External",
  cloudflare: "Cloudflare",
  stripe: "Stripe",
  resend: "Resend",
  "aws-ses": "Amazon SES",
  oidc: "OpenID Connect",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  mongodb: "MongoDB",
  "self-hosted": "Self-hosted",
  neon: "Neon",
  supabase: "Supabase",
  "cloudflare-d1": "Cloudflare D1",
  "redis-compatible": "Redis-compatible",
  memcached: "Memcached",
  upstash: "Upstash",
  "work-queue": "Work queue",
  topic: "Topic",
  "cloudflare-queues": "Cloudflare Queues",
  "cloudflare-r2": "Cloudflare R2",
  "aws-s3": "Amazon S3",
  "google-cloud-storage": "Google Cloud Storage",
  opensearch: "OpenSearch",
  elasticsearch: "Elasticsearch",
  meilisearch: "Meilisearch",
  "aws-cloudfront": "Amazon CloudFront",
  "google-cloud-cdn": "Google Cloud CDN",
  generic: "Generic",
  payments: "Payments",
  email: "Email",
  identity: "Identity",
  recognition: "Recognition",
  workflow: "Workflow",
  none: "None",
  fixed: "Fixed",
  publish: "Publish",
  consume: "Consume",
};
const choices = <V extends string>(values: readonly V[]): StudioChoice<V>[] =>
  values.map((value) => ({ value, label: labels[value] ?? value }));
const general: readonly StudioCanonicalField[] = [
  {
    path: "element.name",
    label: "Name",
    group: "General",
    control: "text",
    min: 1,
    max: studioLimits.name,
  },
  {
    path: "element.description",
    label: "Purpose",
    group: "General",
    control: "text",
    min: 0,
    max: studioLimits.description,
    optional: true,
  },
];
const commonApplication = [
  {
    path: "settings.execution",
    label: "Execution",
    group: "General",
    control: "select",
    choices: choices(studioExecutionSchema.options),
    help: "Execution intent; no deployment is started.",
  },
  {
    path: "settings.language",
    label: "Language",
    group: "General",
    control: "select",
    choices: choices(studioLanguageSchema.options),
    help: "Language intent; runtime support is reviewed in Generate.",
  },
  {
    path: "settings.host",
    label: "Host",
    group: "Options",
    control: "select",
    choices: choices(studioHostSchema.options),
    when: { path: "settings.execution", equals: "managed" },
  },
] as const;
const exposure = {
  path: "settings.exposure",
  label: "Exposure",
  group: "General",
  control: "select",
  choices: choices(studioExposureSchema.options),
  help: "Network intent; this does not establish authentication or authorization.",
} as const;
const owner = (required = false) =>
  ({
    path: "owner",
    label: "Owner",
    group: "General",
    control: "reference",
    optional: !required,
    reference: { target: "owner", required },
  }) as const;
const scopes: readonly StudioCreationScope[] = ["c2", "c3-service", "c3-package"];
const applicationScopes: readonly StudioCreationScope[] = ["c2", "c3-package"];
const applicationClassification = { kind: "Application" } as const;
const dataClassification = { kind: "Data store" } as const;
const externalClassification = { kind: "External system" } as const;
const integrationObligation =
  "Provider adapters, credentials and product-specific integration remain C4b until an exact runtime and evidence are supplied.";
const applicationObligations = [
  "Application behavior and packaging require a separately implemented exact runtime template.",
  integrationObligation,
];

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function define<K extends StudioKind>(
  kind: K,
  metadata: Omit<
    StudioDefinition<NoInfer<K>>,
    "id" | "version" | "kind" | "settingsSchema" | "defaults" | "runtimeSupport"
  >,
): StudioDefinition<K> {
  // Zod schemas own internal caches; immutable metadata is frozen without freezing those validators.
  const ref = studioDefinitionRef(kind);
  return Object.freeze({
    ...freeze(metadata),
    id: ref.id as `studio-${K}`,
    version: "1.0.0",
    kind,
    settingsSchema: studioSettingsSchemas[kind],
    defaults: freeze(createStudioSettings(kind)),
  });
}

export const studioDefinitions = Object.freeze({
  service: define("service", {
    name: "Microservice",
    creationName: "Microservice",
    description: "One independently deployed application responsibility.",
    libraryGroup: "Services",
    creationScopes: applicationScopes,
    classification: applicationClassification,
    role: "application",
    visual: { icon: "server", color: "api", shape: "service" },
    fields: [...general, ...commonApplication, exposure],
    relationships: ["calls", "uses-resource", "publish", "consume"],
    c4bObligations: applicationObligations,
  }),
  browser: define("browser", {
    name: "Browser app",
    creationName: "Browser app",
    description: "Browser assets delivered independently or by an actual application.",
    libraryGroup: "Services",
    creationScopes: applicationScopes,
    classification: applicationClassification,
    role: "browser",
    visual: { icon: "browser", color: "client", shape: "browser" },
    fields: [
      ...general,
      {
        path: "settings.delivery",
        label: "Delivery",
        group: "General",
        control: "select",
        choices: choices(studioDeliverySchema.options),
      },
      {
        path: "settings.provider",
        label: "Hosting provider",
        group: "Options",
        control: "select",
        choices: choices(studioBrowserProviderSchema.options),
        when: { path: "settings.delivery", equals: "standalone" },
      },
      {
        path: "settings.servedBy",
        label: "Served by",
        group: "Connections",
        control: "reference",
        optional: true,
        reference: { target: "application", excludeSelf: true },
        when: { path: "settings.delivery", equals: "bundled" },
        help: "Select the actual serving application; a package is not a deployment.",
      },
    ],
    relationships: ["calls", "served-by"],
    c4bObligations: applicationObligations,
  }),
  worker: define("worker", {
    name: "Worker service",
    creationName: "Worker service",
    description: "An independently executed background application.",
    libraryGroup: "Services",
    creationScopes: applicationScopes,
    classification: applicationClassification,
    role: "worker",
    visual: { icon: "cpu", color: "worker", shape: "worker" },
    fields: [
      ...general,
      ...commonApplication,
      {
        path: "settings.concurrency",
        label: "Concurrency",
        group: "Options",
        control: "integer",
        ...studioLimits.concurrency,
        optional: true,
        help: "Design setting; no throughput or scaling guarantee.",
      },
    ],
    relationships: ["calls", "uses-resource", "publish", "consume"],
    c4bObligations: applicationObligations,
  }),
  billing: define("billing", {
    name: "Billing",
    creationName: "Billing",
    description: "One Billing service with a payment integration choice.",
    libraryGroup: "Presets",
    creationScopes: applicationScopes,
    classification: applicationClassification,
    role: "application",
    visual: { icon: "credit-card", color: "api", shape: "service" },
    fields: [
      ...general,
      ...commonApplication,
      exposure,
      {
        path: "settings.provider",
        label: "Payment provider",
        group: "Options",
        control: "select",
        choices: choices(studioBillingProviderSchema.options),
      },
    ],
    relationships: ["calls", "uses-resource", "publish", "consume"],
    c4bObligations: [
      ...applicationObligations,
      "Payment callbacks and project-specific billing policy require C4b; no plans, trials or entitlements are supplied.",
    ],
  }),
  redirect: define("redirect", {
    name: "Redirect",
    creationName: "Redirect",
    description: "One public Redirect service with identity-backed lookup dependencies.",
    libraryGroup: "Presets",
    creationScopes: applicationScopes,
    classification: applicationClassification,
    role: "application",
    visual: { icon: "route", color: "api", shape: "service" },
    fields: [
      ...general,
      ...commonApplication,
      exposure,
      {
        path: "settings.lookupStoreConnection",
        label: "Lookup store",
        group: "Connections",
        control: "reference",
        optional: true,
        reference: { target: "connection", resource: "database", direction: "outgoing" },
      },
      {
        path: "settings.lookupCacheConnection",
        label: "Lookup cache",
        group: "Connections",
        control: "reference",
        optional: true,
        reference: { target: "connection", resource: "cache", direction: "outgoing" },
      },
    ],
    relationships: ["calls", "uses-resource", "publish", "consume"],
    c4bObligations: [
      ...applicationObligations,
      "Redirect, short-code and expiry behavior require an exact template or project-owned C4b implementation.",
    ],
  }),
  notification: define("notification", {
    name: "Notifications",
    creationName: "Notifications",
    description: "One notification application with email delivery integration intent.",
    libraryGroup: "Presets",
    creationScopes: applicationScopes,
    classification: applicationClassification,
    role: "application",
    visual: { icon: "mail", color: "api", shape: "service" },
    fields: [
      ...general,
      ...commonApplication,
      exposure,
      {
        path: "settings.provider",
        label: "Delivery provider",
        group: "Options",
        control: "select",
        choices: choices(studioNotificationProviderSchema.options),
      },
    ],
    relationships: ["calls", "uses-resource", "publish", "consume"],
    c4bObligations: [
      ...applicationObligations,
      "Sender verification, email content and recipient rules remain integration/application work.",
    ],
  }),
  identity: define("identity", {
    name: "Identity",
    creationName: "Identity",
    description: "One application integrating an existing identity provider.",
    libraryGroup: "Presets",
    creationScopes: applicationScopes,
    classification: applicationClassification,
    role: "application",
    visual: { icon: "lock", color: "api", shape: "service" },
    fields: [
      ...general,
      ...commonApplication,
      exposure,
      {
        path: "settings.provider",
        label: "Identity integration",
        group: "Options",
        control: "select",
        choices: choices(studioIdentityProviderSchema.options),
      },
    ],
    relationships: ["calls", "uses-resource", "publish", "consume"],
    c4bObligations: [
      ...applicationObligations,
      "Identity integration does not supply application authorization, role or tenant policy.",
    ],
  }),
  database: define("database", {
    name: "Database",
    creationName: "Database",
    description: "One logical authoritative store; engine and provider are separate choices.",
    libraryGroup: "Resources",
    creationScopes: scopes,
    classification: dataClassification,
    role: "data",
    visual: { icon: "database", color: "data", shape: "cylinder" },
    fields: [
      ...general,
      owner(),
      {
        path: "settings.engine",
        label: "Engine",
        group: "Options",
        control: "select",
        choices: choices(studioDatabaseEngineSchema.options),
      },
      {
        path: "settings.provider",
        label: "Provider",
        group: "Options",
        control: "select",
        choices: choices([...new Set(Object.values(studioDatabaseProviders).flat())]),
        compatibility: "engine",
      },
    ],
    relationships: ["uses-resource"],
    c4bObligations: [
      integrationObligation,
      "Data models, queries and migrations require template-owned contracts or C4b; this selection provisions no store.",
    ],
  }),
  cache: define("cache", {
    name: "Cache",
    creationName: "Cache",
    description: "A logical cache with an optional technical TTL policy.",
    libraryGroup: "Resources",
    creationScopes: scopes,
    classification: dataClassification,
    role: "data",
    visual: { icon: "archive", color: "data", shape: "stack" },
    fields: [
      ...general,
      owner(),
      {
        path: "settings.engine",
        label: "Engine",
        group: "Options",
        control: "select",
        choices: choices(studioCacheEngineSchema.options),
      },
      {
        path: "settings.provider",
        label: "Provider",
        group: "Options",
        control: "select",
        choices: choices([...new Set(Object.values(studioCacheProviders).flat())]),
        compatibility: "engine",
      },
      {
        path: "settings.ttlSeconds",
        label: "TTL",
        group: "Options",
        control: "integer",
        ...studioLimits.ttlSeconds,
        unit: "seconds",
        optional: true,
        help: "Cache policy, not user-data retention.",
      },
    ],
    relationships: ["uses-resource"],
    c4bObligations: [
      integrationObligation,
      "Cache integration, invalidation and source-of-truth fallback require implementation.",
    ],
  }),
  queue: define("queue", {
    name: "Queue or topic",
    creationName: "Queue",
    description: "One shared logical channel, owned explicitly and shown at C3.",
    libraryGroup: "Resources",
    creationScopes: ["c3-service", "c3-package"],
    classification: dataClassification,
    role: "messaging",
    visual: { icon: "list", color: "messaging", shape: "channel" },
    fields: [
      ...general,
      owner(true),
      {
        path: "settings.mode",
        label: "Mode",
        group: "Options",
        control: "select",
        choices: choices(studioQueueModeSchema.options),
      },
      {
        path: "settings.provider",
        label: "Provider",
        group: "Options",
        control: "select",
        choices: choices(studioQueueProviderSchema.options),
      },
      {
        path: "settings.retentionSeconds",
        label: "Retention",
        group: "Options",
        control: "integer",
        ...studioLimits.retentionSeconds,
        unit: "seconds",
        optional: true,
        help: "Technical channel retention; provider feasibility remains unresolved.",
      },
    ],
    relationships: ["publish", "consume"],
    c4bObligations: [
      integrationObligation,
      "Broker product, delivery guarantees, retries, deduplication and provisioning require implementation; no exactly-once guarantee is implied.",
    ],
  }),
  "object-store": define("object-store", {
    name: "Object storage",
    creationName: "Object storage",
    description: "A logical byte store with explicit access intent.",
    libraryGroup: "Resources",
    creationScopes: scopes,
    classification: dataClassification,
    role: "data",
    visual: { icon: "archive", color: "data", shape: "stack" },
    fields: [
      ...general,
      owner(),
      {
        path: "settings.provider",
        label: "Provider",
        group: "Options",
        control: "select",
        choices: choices(studioObjectStoreProviderSchema.options),
      },
      {
        path: "settings.access",
        label: "Access",
        group: "Options",
        control: "select",
        choices: choices(studioObjectAccessSchema.options),
      },
    ],
    relationships: ["uses-resource", "origin"],
    c4bObligations: [
      integrationObligation,
      "Access intent does not create buckets, signing behavior or an upload workflow.",
    ],
  }),
  search: define("search", {
    name: "Search index",
    creationName: "Search index",
    description: "A logical derived search index with engine and hosting intent.",
    libraryGroup: "Resources",
    creationScopes: scopes,
    classification: dataClassification,
    role: "data",
    visual: { icon: "search", color: "data", shape: "cylinder" },
    fields: [
      ...general,
      owner(),
      {
        path: "settings.engine",
        label: "Engine",
        group: "Options",
        control: "select",
        choices: choices(studioSearchEngineSchema.options),
      },
      {
        path: "settings.provider",
        label: "Provider",
        group: "Options",
        control: "select",
        choices: choices([...new Set(Object.values(studioSearchProviders).flat())]),
        compatibility: "engine",
        help: "Hosting/integration intent; this is not managed engine compatibility certification.",
      },
    ],
    relationships: ["uses-resource"],
    c4bObligations: [
      integrationObligation,
      "Index definitions, indexing, query behavior and relevance require implementation.",
    ],
  }),
  cdn: define("cdn", {
    name: "CDN",
    creationName: "CDN",
    description: "External content delivery with an explicit existing origin.",
    libraryGroup: "Integrations",
    creationScopes: scopes,
    classification: externalClassification,
    role: "integration",
    visual: { icon: "world", color: "external", shape: "integration" },
    fields: [
      ...general,
      {
        path: "settings.provider",
        label: "Provider",
        group: "Options",
        control: "select",
        choices: choices(studioCdnProviderSchema.options),
      },
      {
        path: "settings.origin",
        label: "Origin",
        group: "Connections",
        control: "reference",
        optional: true,
        reference: { target: "origin", kinds: ["application", "object-store"] },
      },
    ],
    relationships: ["origin"],
    c4bObligations: [
      integrationObligation,
      "Origin wiring, domains, TLS and cache rules are not provisioned.",
    ],
  }),
  "external-api": define("external-api", {
    name: "External API",
    creationName: "External API",
    description: "An external integration boundary, named for the actual provider when known.",
    libraryGroup: "Integrations",
    creationScopes: scopes,
    classification: externalClassification,
    role: "integration",
    visual: { icon: "plug", color: "external", shape: "integration" },
    fields: [
      ...general,
      {
        path: "settings.category",
        label: "Category",
        group: "Options",
        control: "select",
        choices: choices(studioExternalCategorySchema.options),
      },
      {
        path: "settings.provider",
        label: "Provider",
        group: "Options",
        control: "select",
        choices: choices(studioExternalProviderSchema.options),
      },
    ],
    relationships: ["calls"],
    c4bObligations: [
      integrationObligation,
      "Request/response mapping, callbacks and failure behavior remain explicit C4b integration work.",
    ],
  }),
});

/**
 * SG02 performance descriptors. Deliberately not merged into `definition.fields` yet, so the
 * current inspector renders unchanged; the component/performance inspector unit (SG09) adopts them.
 * Every field is optional: an empty input means unspecified and is never filled on read.
 */
export type StudioPerformanceField = FieldBase & {
  path: `settings.${string}`;
  group: "Options";
  optional: true;
} & (
    | { control: "integer"; min: number; max: number; unit?: string }
    | { control: "select"; choices: readonly StudioChoice[] }
    | { control: "text"; min: number; max: number }
  );
const perfInteger = (
  key: string,
  label: string,
  range: { min: number; max: number },
  unit?: string,
  help?: string,
): StudioPerformanceField => ({
  path: `settings.${key}`,
  label,
  group: "Options",
  optional: true,
  control: "integer",
  ...range,
  ...(unit && { unit }),
  ...(help && { help }),
});
const perfSelect = (
  key: string,
  label: string,
  values: readonly string[],
  names: Readonly<Record<string, string>>,
  help?: string,
): StudioPerformanceField => ({
  path: `settings.${key}`,
  label,
  group: "Options",
  optional: true,
  control: "select",
  choices: values.map((value) => ({ value, label: names[value] ?? labels[value] ?? value })),
  ...(help && { help }),
});
const scalingPerformance = [
  perfInteger("minReplicas", "Minimum replicas", studioLimits.replicas),
  perfInteger("maxReplicas", "Maximum replicas", { ...studioLimits.replicas, min: 1 }),
  perfSelect(
    "autoscaleOn",
    "Autoscale on",
    studioAutoscaleSignalSchema.options,
    { cpu: "CPU", "requests-per-second": "Requests per second", "queue-lag": "Queue lag" },
    "Needs a maximum above the minimum. Design intent; no autoscaler is provisioned.",
  ),
];
const requestPerformance = [
  perfInteger("requestTimeoutMs", "Request timeout", studioLimits.requestTimeoutMs, "ms"),
  perfInteger("concurrencyLimit", "Concurrency limit", studioLimits.concurrencyLimit, "requests"),
];
const servicePerformance = freeze([...scalingPerformance, ...requestPerformance]);
export const studioPerformanceFields: Readonly<
  Record<StudioKind, readonly StudioPerformanceField[]>
> = freeze({
  service: servicePerformance,
  browser: [],
  worker: scalingPerformance,
  billing: servicePerformance,
  redirect: servicePerformance,
  notification: servicePerformance,
  identity: servicePerformance,
  database: [
    perfInteger("readReplicas", "Read replicas", studioLimits.readReplicas),
    {
      path: "settings.partitionKey",
      label: "Partition key",
      group: "Options",
      optional: true,
      control: "text",
      min: 1,
      max: studioLimits.partitionKey,
      help: "One column name; no table or schema editor.",
    },
  ],
  cache: [
    perfSelect("topology", "Topology", studioCacheTopologySchema.options, {
      standalone: "Standalone",
      cluster: "Cluster",
    }),
    perfSelect("eviction", "Eviction", studioCacheEvictionSchema.options, {
      lru: "Least recently used",
      lfu: "Least frequently used",
      ttl: "Shortest TTL first",
      none: "No eviction",
    }),
  ],
  queue: [perfInteger("partitions", "Partitions or shards", studioLimits.partitions)],
  "object-store": [],
  search: [],
  cdn: [
    perfSelect("cacheRedirects", "Cache redirects", studioCdnRedirectCachingSchema.options, {
      disabled: "Disabled",
      enabled: "Enabled",
    }),
  ],
  "external-api": [],
});

/** Exact local resolution only. No latest substitution and no template-registry registration. */
export function resolveStudioDefinition(ref: DefinitionRef): StudioDefinition | undefined {
  return Object.values(studioDefinitions).find(
    (definition) => definition.id === ref.id && definition.version === ref.version,
  ) as StudioDefinition | undefined;
}
export function studioCreationCatalog(scope: StudioCreationScope) {
  return studioKinds
    .map((kind) => studioDefinitions[kind])
    .filter((definition) => definition.creationScopes.includes(scope));
}
export const studioNeutralVisual: Readonly<StudioVisual> = freeze({
  icon: "box",
  color: "generic",
  shape: "box",
});
export function studioVisual(kind?: StudioKind): Readonly<StudioVisual> {
  return kind ? studioDefinitions[kind].visual : studioNeutralVisual;
}

/** Provider labels identify only what was selected. Generic clouds never imply a hidden product. */
export type StudioProviderId =
  | (typeof studioHostSchema.options)[number]
  | (typeof studioBrowserProviderSchema.options)[number]
  | (typeof studioBillingProviderSchema.options)[number]
  | (typeof studioNotificationProviderSchema.options)[number]
  | (typeof studioIdentityProviderSchema.options)[number]
  | (typeof studioQueueProviderSchema.options)[number]
  | (typeof studioObjectStoreProviderSchema.options)[number]
  | (typeof studioCdnProviderSchema.options)[number]
  | StudioSettingsByKind["database"]["provider"]
  | StudioSettingsByKind["cache"]["provider"];
const providerIdentity: Record<
  StudioProviderId,
  "unspecified" | "external" | "hosting" | "ecosystem" | "product" | "integration"
> = {
  unspecified: "unspecified",
  external: "external",
  "self-hosted": "hosting",
  aws: "ecosystem",
  "google-cloud": "ecosystem",
  cloudflare: "ecosystem",
  "cloudflare-workers": "product",
  stripe: "product",
  resend: "product",
  "aws-ses": "product",
  oidc: "integration",
  neon: "product",
  supabase: "product",
  "cloudflare-d1": "product",
  upstash: "product",
  "cloudflare-queues": "product",
  "cloudflare-r2": "product",
  "aws-s3": "product",
  "google-cloud-storage": "product",
  "aws-cloudfront": "product",
  "google-cloud-cdn": "product",
};
export const studioProviders = freeze(
  Object.fromEntries(
    Object.entries(providerIdentity).map(([id, identity]) => [
      id,
      {
        id,
        label: labels[id] ?? id,
        identity,
        artwork: "capability-symbol" as const,
        c4bObligation:
          identity === "unspecified"
            ? "Select and implement an integration when required."
            : integrationObligation,
      },
    ]),
  ) as Record<
    StudioProviderId,
    {
      id: StudioProviderId;
      label: string;
      identity: (typeof providerIdentity)[StudioProviderId];
      artwork: "capability-symbol";
      c4bObligation: string;
    }
  >,
);
export const studioProviderCompatibility = freeze({
  database: studioDatabaseProviders,
  cache: studioCacheProviders,
  search: studioSearchProviders,
});

/** Visible provider options use the very same finite compatibility rows as validation. */
export function studioProviderChoices(settings: StudioSettings): readonly StudioChoice[] {
  if (settings.kind === "database") return choices(studioDatabaseProviders[settings.engine]);
  if (settings.kind === "cache") return choices(studioCacheProviders[settings.engine]);
  if (settings.kind === "search") return choices(studioSearchProviders[settings.engine]);
  const field = studioDefinitions[settings.kind].fields.find(
    (field) =>
      field.path === "settings.provider" &&
      (!("when" in field) ||
        !field.when ||
        settingValue(settings, field.when.path) === field.when.equals),
  );
  return field?.control === "select" ? field.choices : [];
}
function settingValue(settings: StudioSettings, path: string): unknown {
  return (settings as unknown as Record<string, unknown>)[path.replace(/^settings\./, "")];
}

/** Hide inapplicable fields and empty tabs without manufacturing optional values. */
export function studioFieldGroups(settings: StudioSettings) {
  const fields = studioDefinitions[settings.kind].fields as readonly StudioElementField[];
  return (["General", "Options", "Connections"] as const).flatMap((group) => {
    const visible = fields
      .filter(
        (field) =>
          field.group === group &&
          (!("when" in field) ||
            !field.when ||
            settingValue(settings, field.when.path) === field.when.equals),
      )
      .map((field) =>
        field.path === "settings.provider" && field.control === "select"
          ? { ...field, choices: studioProviderChoices(settings) }
          : field,
      );
    return visible.length ? [{ group, fields: visible }] : [];
  });
}

/** Pure pending-edit normalization, used by later forms/chat. No document/graph mutation or I/O. */
export function changeStudioSetting(
  settings: StudioSettings,
  key: Exclude<UnionKeys<StudioSettings>, "kind">,
  value: unknown,
): StudioSettings {
  if (
    !(studioDefinitions[settings.kind].fields as readonly StudioElementField[]).some(
      (field) => field.path === `settings.${key}`,
    )
  )
    throw new Error(`No ${key} field exists on studio-${settings.kind}.`);
  const next = { ...settings, [key]: value } as unknown as Record<string, unknown>;
  if (key === "execution" && value !== settingValue(settings, "settings.execution")) {
    if (value === "docker") delete next.host;
    else if (value === "managed") next.host = "unspecified";
  }
  if (key === "delivery" && value !== settingValue(settings, "settings.delivery")) {
    if (value === "bundled") {
      delete next.provider;
      delete next.servedBy;
    } else if (value === "standalone") {
      delete next.servedBy;
      next.provider = "unspecified";
    }
  }
  if (
    key === "engine" &&
    (settings.kind === "database" || settings.kind === "cache" || settings.kind === "search")
  ) {
    const rows = studioProviderCompatibility[settings.kind] as Readonly<
      Record<string, readonly string[]>
    >;
    if (typeof value === "string" && rows[value] && !rows[value].includes(String(next.provider)))
      next.provider = "unspecified";
  }
  // Each exact kind's validator rejects hidden controls, illegal choices, decimals and bounds.
  return studioSettingsSchemas[settings.kind].parse(next);
}

type StudioConnectionValues = {
  "planned.label": string;
  "planned.protocol": (typeof studioProtocolSchema.options)[number];
  "planned.interaction": (typeof studioInteractionSchema.options)[number];
  "planned.security": (typeof studioAccessSchema.options)[number];
  "settings.timeoutMs": number;
  "settings.retry.mode": (typeof studioRetryModeSchema.options)[number];
  "settings.retry.attempts": number;
  "settings.retry.delayMs": number;
  "settings.channelUse": (typeof studioChannelUseSchema.options)[number];
};
export type StudioConnectionField = {
  [P in keyof StudioConnectionValues]: FieldBase & {
    path: P;
    applicability?: "request-policy" | "fixed-retry" | "queue";
  } & (P extends "planned.label"
      ? { control: "text"; min: number; max: number }
      : StudioConnectionValues[P] extends number
        ? { control: "integer"; min: number; max: number; unit?: string }
        : {
            control: "select";
            choices: readonly StudioChoice<Extract<StudioConnectionValues[P], string>>[];
          });
}[keyof StudioConnectionValues];
export const studioConnectionFields: readonly StudioConnectionField[] = freeze([
  {
    path: "planned.label",
    label: "Action",
    group: "General",
    control: "text",
    min: 1,
    max: studioLimits.action,
  },
  {
    path: "planned.protocol",
    label: "Protocol",
    group: "General",
    control: "select",
    choices: choices(studioProtocolSchema.options),
  },
  {
    path: "planned.interaction",
    label: "Interaction",
    group: "General",
    control: "select",
    choices: choices(studioInteractionSchema.options),
  },
  {
    path: "planned.security",
    label: "Access",
    group: "Options",
    control: "select",
    choices: choices(studioAccessSchema.options),
    help: "Intent; no authorization or secret is supplied.",
  },
  {
    path: "settings.timeoutMs",
    label: "Timeout",
    group: "Options",
    control: "integer",
    ...studioLimits.timeoutMs,
    unit: "ms",
    optional: true,
    applicability: "request-policy",
  },
  {
    path: "settings.retry.mode",
    label: "Retry",
    group: "Options",
    control: "select",
    choices: choices(studioRetryModeSchema.options),
    applicability: "request-policy",
    help: "Attempts are additional attempts; unsafe operations need implementation review.",
  },
  {
    path: "settings.retry.attempts",
    label: "Attempts",
    group: "Options",
    control: "integer",
    ...studioLimits.attempts,
    applicability: "fixed-retry",
  },
  {
    path: "settings.retry.delayMs",
    label: "Delay",
    group: "Options",
    control: "integer",
    ...studioLimits.delayMs,
    unit: "ms",
    applicability: "fixed-retry",
  },
  {
    path: "settings.channelUse",
    label: "Channel role",
    group: "Options",
    control: "select",
    choices: choices(studioChannelUseSchema.options),
    applicability: "queue",
  },
]);

/** Only applicable technical groups; queue roles are explicit, never guessed from labels. */
export function studioConnectionFieldGroups(input: {
  protocol: string;
  interaction: string;
  settings: StudioConnectionSettings;
  queue: boolean;
}) {
  const policy = !input.queue && studioAllowsRequestPolicies(input.protocol, input.interaction);
  return (["General", "Options"] as const).flatMap((group) => {
    const fields = studioConnectionFields.filter(
      (field) =>
        field.group === group &&
        (!field.applicability ||
          (field.applicability === "request-policy" && policy) ||
          (field.applicability === "fixed-retry" &&
            policy &&
            input.settings.retry?.mode === "fixed") ||
          (field.applicability === "queue" && input.queue)),
    );
    return fields.length ? [{ group, fields }] : [];
  });
}

/** Typed defaults for a newly created connection; optional numbers stay absent. */
export function createStudioConnectionSettings(
  protocol: string,
  interaction: string,
): StudioConnectionSettings {
  return studioAllowsRequestPolicies(protocol, interaction)
    ? { retry: { mode: "unspecified" } }
    : {};
}
export const studioPackageFields = freeze([
  {
    path: "package.name",
    label: "Name",
    group: "General",
    control: "text",
    min: 1,
    max: studioLimits.name,
  },
  {
    path: "package.description",
    label: "Purpose",
    group: "General",
    control: "text",
    min: 0,
    max: studioLimits.description,
    optional: true,
  },
  {
    path: "package.members",
    label: "Members",
    group: "Connections",
    control: "members",
    min: studioLimits.members.min,
    max: studioLimits.members.max,
    target: "application",
  },
] as const);
export const studioContextFields = freeze([
  {
    path: "name",
    label: "Name",
    group: "General",
    control: "text",
    min: 1,
    max: studioLimits.name,
  },
  {
    path: "description",
    label: "Purpose",
    group: "General",
    control: "text",
    min: 0,
    max: studioLimits.description,
    optional: true,
  },
] as const);
export const studioContextRelationshipFields = freeze([
  {
    path: "description",
    label: "Action",
    group: "General",
    control: "text",
    min: 1,
    max: studioLimits.action,
  },
] as const);

/** Deterministic JSON metadata; validators stay in the model, defaults remain typed and explicit. */
export function describeStudioDefinition(ref: DefinitionRef) {
  const definition = resolveStudioDefinition(ref);
  if (!definition) return undefined;
  const { settingsSchema: _schema, ...description } = definition;
  return structuredClone(description);
}

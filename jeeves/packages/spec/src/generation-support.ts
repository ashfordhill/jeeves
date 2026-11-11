/** Finite compilation requirements. These descriptors install no executable implementation. */
import { freezeRecord } from "./content-hash.ts";
import type { GenerationResourceKind } from "./generation.ts";
import { type GenerationBindingKind, generationTemplates } from "./generation-catalog.ts";
import type { ExactContractRef } from "./operation-records.ts";
import type { DeclaredAccess } from "./ownership.ts";
import { type StudioComponentKind, studioComponentKinds } from "./studio-components.ts";
import type { StudioKind } from "./studio-model.ts";

export type GenerationValue = string | number;
export type GenerationSupportedValues =
  | { values: readonly GenerationValue[] }
  | { integer: { min: number; max: number } };
export type GenerationSettingRule = {
  input: string;
  setting: string;
  source: "host" | "resource" | "component";
  /** The binding field whose module it reads; a component rule without one reads the lead. */
  field?: string;
  component?: StudioComponentKind;
  supported: GenerationSupportedValues;
  required?: boolean;
  /** Only a versioned internal default; never writes a missing declaration into source. */
  default?: GenerationValue;
  consumer: string;
  /** Absent means fixed/internal, even when an implementation consumes the value. */
  userNeed?: string;
  mirror?: { component: StudioComponentKind; setting: string; field: string };
};
export type GenerationResourceRequirement = {
  field: string;
  kind: GenerationResourceKind;
  access?: DeclaredAccess;
  authority?: "source" | "projection";
  channel?: "publish" | "consume";
  mode?: "work-queue" | "topic";
  optional?: boolean;
  /** A database field the lead fills itself with no SQL settings of its own (Favorites' state):
   * its pool runs the initial values, fixed, and the module page shows no control for them. */
  pool?: "fixed";
};
export type GenerationCapability = {
  template: ExactContractRef;
  /** Absent for the module stub, which needs no role. */
  role?: "api" | "worker";
  hosts: readonly StudioKind[];
  componentTargets: readonly StudioComponentKind[];
  resources: readonly GenerationResourceRequirement[];
  settings: readonly GenerationSettingRule[];
};
/** The host supplies actual implementation identities and consumer/output responsibility. */
export type GenerationInstalledTemplate = {
  ref: ExactContractRef;
  /** Each listed input must actually be wired into the named generated consumer. */
  consumers: readonly { input: string; consumer: string; outputPaths: readonly string[] }[];
};
export type GenerationInstalledSupport = {
  runtime?: ExactContractRef;
  presets?: readonly ExactContractRef[];
  templates: readonly GenerationInstalledTemplate[];
  /** The host runs a process per application tile (tile process contract, section 1). */
  processes?: true;
};
/**
 * The application tile kinds that run as a process with Runnable processes on, and each one's
 * shape (tile process contract, section 2): every tile that holds modules runs.
 */
export const generationProcessShapes = {
  service: "http",
  uploads: "http",
  redirect: "http",
  billing: "http",
  worker: "worker",
  notification: "worker",
} as const satisfies Partial<Record<StudioKind, "http" | "worker">>;
export type GenerationProcessKind = keyof typeof generationProcessShapes;
/** A process's HTTP limits when no template on its tile consumes them: the initial values. */
export const generationProcessHttpDefaults = { requestTimeoutMs: 1000, concurrencyLimit: 1000 };
const choice = (...values: GenerationValue[]): GenerationSupportedValues => ({ values });
const integer = (min: number, max: number): GenerationSupportedValues => ({
  integer: { min, max },
});
/**
 * The tile settings a process consumes when no template on its tile does (v3 contract, section 4,
 * D5): with Runnable processes on, a Service or Uploads tile (and the legacy Redirect and Billing)
 * shows Request timeout and Concurrency limit, and a Worker Concurrency, which its stub loops use.
 * With no saved value the process runs the initial one; a saved value is the tile's.
 */
export const generationProcessSettings = {
  http: [
    {
      setting: "requestTimeoutMs",
      supported: integer(1, 300000),
      initial: generationProcessHttpDefaults.requestTimeoutMs,
      userNeed: "Bound how long a request may occupy this service.",
    },
    {
      setting: "concurrencyLimit",
      supported: integer(1, 100000),
      initial: generationProcessHttpDefaults.concurrencyLimit,
      userNeed: "Bound concurrent admitted requests.",
    },
  ],
  worker: [
    {
      setting: "concurrency",
      supported: integer(1, 1024),
      initial: 1,
      userNeed: "Bound concurrent deliveries handled by this worker.",
    },
  ],
} as const satisfies Record<
  "http" | "worker",
  readonly {
    setting: string;
    supported: GenerationSupportedValues;
    initial: number;
    userNeed: string;
  }[]
>;
/** The process kinds whose tile settings hold each process setting: Notifications has no
 * Concurrency field, so its loops run the initial one. */
export const generationProcessSettingKinds: Readonly<
  Record<string, readonly GenerationProcessKind[]>
> = {
  requestTimeoutMs: ["service", "uploads", "redirect", "billing"],
  concurrencyLimit: ["service", "uploads", "redirect", "billing"],
  concurrency: ["worker"],
};
const rule = (
  input: string,
  source: GenerationSettingRule["source"],
  setting: string,
  supported: GenerationSupportedValues,
  consumer: string,
  extra: Partial<GenerationSettingRule> = {},
): GenerationSettingRule => ({ input, source, setting, supported, consumer, ...extra });
const host = [
  rule("host.execution", "host", "execution", choice("docker"), "local-project.execution", {
    required: true,
  }),
  rule("host.language", "host", "language", choice("typescript"), "typescript-service.language", {
    required: true,
  }),
  rule("host.minReplicas", "host", "minReplicas", choice(1), "local-project.replicas"),
  rule("host.maxReplicas", "host", "maxReplicas", choice(1), "local-project.replicas"),
];
const http = [
  ...host,
  rule(
    "host.requestTimeoutMs",
    "host",
    "requestTimeoutMs",
    integer(1, 300000),
    "http-service.requestTimeoutMs",
    { required: true, userNeed: "Bound how long a request may occupy this service." },
  ),
  rule(
    "host.concurrencyLimit",
    "host",
    "concurrencyLimit",
    integer(1, 100000),
    "http-service.concurrencyLimit",
    { required: true, userNeed: "Bound concurrent admitted requests." },
  ),
  rule("host.exposure", "host", "exposure", choice("public", "internal"), "local-project.exposure"),
];
const resourceRules = (r: GenerationResourceRequirement): GenerationSettingRule[] => {
  const add = (
    setting: string,
    supported: GenerationSupportedValues,
    extra: Partial<GenerationSettingRule> = {},
  ) =>
    rule(`${r.field}.${setting}`, "resource", setting, supported, `local-${r.kind}.${setting}`, {
      field: r.field,
      ...extra,
    });
  const rules = [add("provider", choice("self-hosted"), { required: true })];
  if (r.kind === "database")
    rules.push(
      add("engine", choice("postgresql"), { required: true }),
      add("readReplicas", choice(0)),
    );
  if (r.kind === "search") rules.push(add("engine", choice("opensearch"), { required: true }));
  if (r.kind === "object-store")
    rules.push(
      add("access", choice(r.field === "outputs" ? "public" : "private"), { required: true }),
    );
  if (r.kind === "queue") rules.push(add("mode", choice(r.mode ?? "topic"), { required: true }));
  if (r.kind === "cache")
    rules.push(
      add("engine", choice("redis-compatible"), { required: true }),
      add("topology", choice("standalone")),
      add("eviction", choice("lru")),
      add("ttlSeconds", integer(1, 604800), {
        required: true,
        consumer: "positive-cache-reader.ttlSeconds",
        userNeed: "Choose how long eligible immutable records remain cached.",
        mirror: { component: "cache-reader", setting: "l2TtlSeconds", field: r.field },
      }),
    );
  if (r.access && r.kind === "database") {
    const component = (
      setting: string,
      supported: GenerationSupportedValues,
      extra: Partial<GenerationSettingRule> = {},
    ) =>
      rule(`${r.field}.${setting}`, "component", setting, supported, `sql-client.${setting}`, {
        field: r.field,
        component: "data-access",
        ...extra,
      });
    rules.push(
      ...(r.pool === "fixed"
        ? [
            component("poolSize", choice(10), { default: 10 }),
            component("statementTimeoutMs", choice(2000), { default: 2000 }),
          ]
        : [
            component("poolSize", integer(1, 1000), {
              userNeed: "Bound connections to this database.",
            }),
            component("statementTimeoutMs", integer(1, 300000), {
              userNeed: "Bound database statement execution.",
            }),
          ]),
      component("readRouting", choice("primary")),
    );
  }
  if (r.channel) {
    const kind = r.channel === "consume" ? "event-consumer" : "event-publisher";
    const component = (setting: string, supported: GenerationSupportedValues) =>
      rule(
        `${r.field}.${setting}`,
        "component",
        setting,
        supported,
        `amqp-${r.channel}.${setting}`,
        {
          field: r.field,
          component: kind,
          ...(setting === "batchSize"
            ? { default: 1 }
            : setting === "lingerMs"
              ? { default: 0 }
              : {}),
        },
      );
    rules.push(component("batchSize", choice(1)));
    if (r.channel === "consume") rules.push(component("retryLimit", integer(0, 100)));
    else
      rules.push(
        component("lingerMs", choice(0)),
        component(
          "outbox",
          choice(r.field === "jobs" || r.field === "publication" ? "enabled" : "disabled"),
        ),
      );
  }
  return rules;
};
const store = (
  field: string,
  kind: GenerationResourceKind,
  access: DeclaredAccess,
  authority: "source" | "projection" = "source",
): GenerationResourceRequirement => ({ field, kind, access, authority });
const queue = (
  field: string,
  channel: "publish" | "consume",
  mode: "work-queue" | "topic",
  optional = false,
): GenerationResourceRequirement => ({ field, kind: "queue", channel, mode, optional });
const worker = (field: string, fixed = false): GenerationSettingRule[] => [
  ...host,
  rule(
    "host.concurrency",
    "host",
    "concurrency",
    fixed ? choice(1) : integer(1, 1024),
    "amqp-consume.concurrency",
    {
      required: true,
      ...(fixed ? {} : { userNeed: "Bound concurrent deliveries handled by this worker." }),
      mirror: { component: "event-consumer", setting: "concurrency", field },
    },
  ),
];
function capability(
  kind: GenerationBindingKind,
  role: GenerationCapability["role"],
  hosts: StudioKind[],
  resources: GenerationResourceRequirement[],
  settings: GenerationSettingRule[],
  /** The module kinds a component-target selection may name: a template's one lead kind. */
  componentTargets: StudioComponentKind[] = ["custom"],
): GenerationCapability {
  const retryLimit = kind === "video-hls" ? 3 : kind === "asset-lifecycle" ? 10 : 5;
  const resolved = resources
    .flatMap(resourceRules)
    .map((setting) =>
      setting.setting === "retryLimit"
        ? { ...setting, supported: choice(retryLimit), default: retryLimit }
        : setting,
    );
  return {
    template: generationTemplates[kind].ref,
    role,
    hosts,
    componentTargets,
    resources,
    settings: [...settings, ...resolved],
  };
}
export const generationCapabilities = freezeRecord({
  "owned-multipart": capability(
    "owned-multipart",
    "api",
    ["uploads", "service"],
    [
      store("state", "database", "read-write"),
      store("objects", "object-store", "read-write"),
      queue("jobs", "publish", "work-queue"),
    ],
    [
      ...http,
      rule("host.transfer", "host", "transfer", choice("signed-url"), "owned-multipart.transfer"),
    ],
    ["multipart-uploads"],
  ),
  "asset-lifecycle": capability(
    "asset-lifecycle",
    "worker",
    ["worker"],
    [
      store("state", "database", "read-write"),
      queue("results", "consume", "topic"),
      queue("publication", "publish", "topic", true),
    ],
    worker("results"),
    ["lifecycle-writer"],
  ),
  "video-hls": capability(
    "video-hls",
    "worker",
    ["worker"],
    [
      store("originals", "object-store", "read"),
      store("outputs", "object-store", "read-write"),
      queue("jobs", "consume", "work-queue"),
      queue("results", "publish", "topic"),
    ],
    worker("jobs", true),
    ["video-encoder"],
  ),
  "positive-cache-read": capability(
    "positive-cache-read",
    "api",
    ["service", "redirect"],
    [store("source", "database", "read"), store("cache", "cache", "read-write", "projection")],
    http,
    ["cache-reader"],
  ),
  "event-counter": capability(
    "event-counter",
    "worker",
    ["worker"],
    [store("state", "database", "read-write"), queue("events", "consume", "topic")],
    worker("events"),
    ["event-counter"],
  ),
  "search-projection": capability(
    "search-projection",
    "worker",
    ["worker"],
    [store("index", "search", "read-write", "projection"), queue("events", "consume", "topic")],
    worker("events"),
    ["index-writer"],
  ),
  "search-query": capability(
    "search-query",
    "api",
    ["service"],
    [store("index", "search", "read", "projection")],
    http,
    ["search-query"],
  ),
  /** The Auth guard's own settings (v3 contract, section 2): Sign-in, and the fixed JWT. */
  "verified-identity": capability(
    "verified-identity",
    "api",
    ["service", "uploads"],
    [],
    [
      rule(
        "guard.signIn",
        "component",
        "signIn",
        choice("required", "optional"),
        "tile-guard.signIn",
        {
          component: "auth-guard",
          default: "required",
          userNeed: "Choose whether every caller must sign in, or only some.",
        },
      ),
      rule("guard.credential", "component", "credential", choice("jwt"), "tile-guard.credential", {
        component: "auth-guard",
        required: true,
      }),
    ],
    ["auth-guard"],
  ),
  /** Favorites (v3 contract, section 3): its own table in `state`, read and written through the
   * lead's own link, and the optional database its items Data access reads. */
  favorites: capability(
    "favorites",
    "api",
    ["service"],
    [
      { ...store("state", "database", "read-write"), pool: "fixed" },
      { ...store("items", "database", "read"), optional: true },
    ],
    http,
    ["favorites"],
  ),
  "youtube-upload": capability("youtube-upload", "api", ["uploads", "service"], [], []),
  "youtube-watch": capability(
    "youtube-watch",
    "api",
    ["service"],
    [store("counts", "database", "read"), queue("events", "publish", "topic")],
    [],
  ),
  "youtube-search": capability("youtube-search", "api", ["service"], [], []),
  "module-stub": capability(
    "module-stub",
    undefined,
    ["service", "worker", "uploads", "redirect", "notification", "billing"],
    [],
    [],
    [...studioComponentKinds],
  ),
} satisfies Record<GenerationBindingKind, GenerationCapability>);

/** Finite compilation requirements. These descriptors install no executable implementation. */
import { freezeRecord } from "./content-hash.ts";
import type { GenerationResourceKind } from "./generation.ts";
import { type GenerationBindingKind, generationTemplates } from "./generation-catalog.ts";
import type { ExactContractRef } from "./operation-records.ts";
import type { DeclaredAccess } from "./ownership.ts";
import type { StudioComponentKind } from "./studio-components.ts";
import type { StudioKind } from "./studio-model.ts";

export type GenerationValue = string | number;
export type GenerationSupportedValues =
  | { values: readonly GenerationValue[] }
  | { integer: { min: number; max: number } };
export type GenerationSettingRule = {
  input: string;
  setting: string;
  source: "host" | "resource" | "component";
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
};
export type GenerationCapability = {
  template: ExactContractRef;
  role: "api" | "worker";
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
};
const choice = (...values: GenerationValue[]): GenerationSupportedValues => ({ values });
const integer = (min: number, max: number): GenerationSupportedValues => ({
  integer: { min, max },
});
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
      component("poolSize", integer(1, 1000), { userNeed: "Bound connections to this database." }),
      component("statementTimeoutMs", integer(1, 300000), {
        userNeed: "Bound database statement execution.",
      }),
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
  ),
  "positive-cache-read": capability(
    "positive-cache-read",
    "api",
    ["service", "redirect"],
    [store("source", "database", "read"), store("cache", "cache", "read-write", "projection")],
    http,
    ["cache-reader", "custom"],
  ),
  "event-counter": capability(
    "event-counter",
    "worker",
    ["worker"],
    [store("state", "database", "read-write"), queue("events", "consume", "topic")],
    worker("events"),
  ),
  "search-projection": capability(
    "search-projection",
    "worker",
    ["worker"],
    [store("index", "search", "read-write", "projection"), queue("events", "consume", "topic")],
    worker("events"),
  ),
  "search-query": capability(
    "search-query",
    "api",
    ["service"],
    [store("index", "search", "read", "projection")],
    http,
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
} satisfies Record<GenerationBindingKind, GenerationCapability>);

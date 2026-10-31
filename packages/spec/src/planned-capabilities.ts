/** Design-time catalog. These contracts describe intent; they provide no runtime. */
import { z } from "zod";
import {
  relationshipInteractionSchema,
  relationshipLabelSchema,
  relationshipProtocolSchema,
} from "./relationship-display.ts";

export type CapabilityField = {
  key: string;
  label: string;
  description?: string;
  options?: readonly string[];
  default: string | number | boolean;
};
export type PlannedCapability = {
  id: string;
  name: string;
  group: string;
  scope: "container" | "component";
  role: "frontend" | "service" | "worker" | "database" | "external";
  icon: string;
  description: string;
  fields: CapabilityField[];
};
const choice = (
  key: string,
  label: string,
  options: string[],
  description?: string,
): CapabilityField => ({ key, label, options, default: options[0]!, description });
const text = (key: string, label: string, value = ""): CapabilityField => ({
  key,
  label,
  default: value,
});
const number = (key: string, label: string, value: number): CapabilityField => ({
  key,
  label,
  default: value,
});
const toggle = (key: string, label: string, value = true): CapabilityField => ({
  key,
  label,
  default: value,
});
const availability = () =>
  choice(
    "availability",
    "Availability target",
    ["Single region", "Multiple zones", "Multiple regions"],
    "A design target; deployment and failover are not implemented.",
  );
const isolation = () =>
  choice("tenancy", "Tenant isolation", [
    "Owner scoped",
    "Organization scoped",
    "Shared public data",
    "Dedicated per tenant",
  ]);
const capability = (
  id: string,
  name: string,
  group: string,
  role: PlannedCapability["role"],
  icon: string,
  description: string,
  fields: CapabilityField[],
  scope: PlannedCapability["scope"] = "container",
): PlannedCapability => ({
  id,
  name,
  group,
  role,
  icon,
  description,
  scope,
  fields: [
    ...fields,
    ...(scope === "component" || ["service", "worker", "database"].includes(role)
      ? [
          choice(
            "workloadShape",
            "Traffic pattern",
            ["Unspecified", "Light / occasional", "Steady", "Bursty"],
            "Design intent; this does not provision capacity.",
          ),
          {
            ...number("peakRate", "Peak workload target", 0),
            description:
              "0 leaves the target unspecified. A future load test must verify this target.",
          },
          choice("workloadUnit", "Workload unit", [
            "Requests / second",
            "Jobs / second",
            "Events / second",
            "Data operations / second",
          ]),
          {
            ...number("p95LatencyMs", "P95 latency target (ms)", 0),
            description:
              "0 leaves the target unspecified. Measure with representative application data.",
          },
        ]
      : []),
  ],
});

export const plannedCapabilities: readonly PlannedCapability[] = [
  capability(
    "browser-client",
    "Web application",
    "Clients",
    "frontend",
    "browser",
    "Browser experience connected to your application APIs.",
    [
      choice("audience", "Audience", ["Customers", "Internal staff & admins", "Both"]),
      choice("kind", "Kind", ["Single-page app", "Server-rendered site", "Static marketing site"]),
      choice("rendering", "Rendering", ["Client rendered", "Server rendered", "Hybrid"]),
      toggle("responsive", "Responsive layout"),
      choice("access", "Entry access", ["Public + signed-in areas", "Sign-in required", "Public"]),
    ],
  ),
  capability(
    "mobile-client",
    "Mobile application",
    "Clients",
    "frontend",
    "device-mobile",
    "Mobile client with the same domain services and its own platform concerns.",
    [
      choice("platforms", "Platforms", ["iOS + Android", "iOS", "Android"]),
      choice("offline", "Offline behavior", [
        "Online first",
        "Read cached content",
        "Queue changes for sync",
      ]),
      toggle("push", "Push notifications"),
    ],
  ),
  capability(
    "desktop-client",
    "Desktop application",
    "Clients",
    "frontend",
    "device-desktop",
    "Desktop client using shared APIs, with explicit local capabilities.",
    [
      choice("platforms", "Platforms", [
        "Windows + macOS + Linux",
        "Windows + macOS",
        "Windows",
        "macOS",
        "Linux",
      ]),
      choice("storage", "Local state", ["Cache only", "Offline workspace", "No local persistence"]),
      toggle("updates", "Automatic updates"),
    ],
  ),
  capability(
    "application-api",
    "Application API",
    "Application",
    "service",
    "server",
    "A cohesive application boundary for domain operations and access rules.",
    [
      choice("interface", "API style", ["REST", "GraphQL", "RPC"]),
      isolation(),
      choice("state", "Process state", ["Stateless; shared stores", "Explicit stateful service"]),
      availability(),
    ],
  ),
  capability(
    "background-worker",
    "Background worker",
    "Application",
    "worker",
    "cpu",
    "Consumes jobs or events outside the request path.",
    [
      choice("trigger", "Trigger", ["Job queue", "Event stream", "Schedule"]),
      number("concurrency", "Concurrency target", 4),
      choice("delivery", "Delivery expectation", [
        "At least once; idempotent handler",
        "Best effort",
      ]),
      toggle("deadLetter", "Dead-letter handling"),
    ],
  ),
  capability(
    "serverless-function",
    "Serverless function",
    "Application",
    "worker",
    "cpu",
    "Runs bounded work on an HTTP, queue, schedule or storage event trigger.",
    [
      choice("trigger", "Trigger", ["HTTP", "Queue", "Schedule", "Storage event"]),
      {
        ...number("timeoutSeconds", "Timeout target (seconds)", 30),
        description: "A design target; the selected platform must support and enforce it.",
      },
      choice("coldStart", "Cold-start tolerance", [
        "Seconds acceptable",
        "Sub-second target",
        "No cold starts acceptable",
      ]),
    ],
  ),
  capability(
    "realtime-service",
    "Realtime service",
    "Application",
    "service",
    "plug",
    "Pushes live activity, presence or collaboration updates to connected clients.",
    [
      choice("transport", "Transport", ["WebSocket", "Server-sent events"]),
      choice("fanout", "Fan-out", ["Shared pub/sub", "Single instance"]),
      toggle("reconnect", "Resume after reconnect"),
      availability(),
    ],
  ),
  capability(
    "api-gateway",
    "API gateway",
    "Traffic & security",
    "service",
    "route",
    "Routes public requests to application services and applies edge policies.",
    [
      choice("routing", "Routing", ["Path based", "Host based", "Host + path"]),
      choice("auth", "Authentication boundary", [
        "Validate identity; authorize in services",
        "Pass through to services",
      ]),
      number("rateLimit", "Requests per minute / client target", 120),
      toggle("requestIds", "Propagate request IDs"),
    ],
  ),
  capability(
    "load-balancer",
    "Load balancer",
    "Traffic & security",
    "service",
    "arrows-split",
    "Distributes requests across instances of one logical application.",
    [
      choice("algorithm", "Balancing", ["Least connections", "Round robin", "Consistent hash"]),
      number("instances", "Instance target", 2),
      text("readiness", "Readiness path", "/ready"),
      toggle("drain", "Drain connections on shutdown"),
      availability(),
    ],
  ),
  capability(
    "edge-delivery",
    "CDN & edge protection",
    "Traffic & security",
    "external",
    "world",
    "Caches public content near clients and protects the public entry point.",
    [
      choice("cache", "Cache policy", [
        "Static assets only",
        "Explicit public responses",
        "Bypass cache",
      ]),
      toggle("waf", "Web application firewall"),
      toggle("tls", "TLS required"),
      choice("botPolicy", "Bot policy", [
        "Observe",
        "Challenge suspicious traffic",
        "Block known abusive traffic",
      ]),
    ],
  ),
  capability(
    "identity-provider",
    "Identity provider",
    "Traffic & security",
    "external",
    "lock",
    "Account identity, login and federation shared by application clients.",
    [
      choice("method", "Sign-in", [
        "Email + password",
        "Passkeys",
        "OIDC / social login",
        "Enterprise SSO",
      ]),
      choice("mfa", "Multi-factor authentication", [
        "Optional",
        "Required for admins",
        "Required for everyone",
      ]),
      isolation(),
    ],
  ),
  capability(
    "relational-store",
    "Relational database",
    "Data & storage",
    "database",
    "database",
    "Transactional records with explicit consistency, ownership and recovery goals.",
    [
      choice("engine", "Database family", ["PostgreSQL", "MySQL", "Undecided"]),
      choice("topology", "Topology", [
        "Primary",
        "Primary + read replicas",
        "Partitioned / sharded",
      ]),
      isolation(),
      number("retention", "Backup retention (days)", 30),
      availability(),
    ],
  ),
  capability(
    "document-store",
    "Document database",
    "Data & storage",
    "database",
    "database",
    "Document-oriented records for aggregate-shaped data.",
    [
      choice("consistency", "Read consistency", ["Strong where supported", "Eventual"]),
      text("partition", "Partition key", "tenantId"),
      isolation(),
      availability(),
    ],
  ),
  capability(
    "analytics-store",
    "Analytics store / warehouse",
    "Data & storage",
    "database",
    "database",
    "Retains analytical data for internal dashboards and customer-facing reports.",
    [
      choice("family", "Store family", ["Columnar warehouse", "Time-series", "Data lake"]),
      choice("load", "Load", ["Streaming", "Micro-batch", "Nightly batch"]),
      number("retention", "Retention target (days; 0 = indefinite)", 90),
      choice("access", "Access", ["Internal dashboards", "Customer-facing reports"]),
    ],
  ),
  capability(
    "distributed-cache",
    "Cache",
    "Data & storage",
    "database",
    "bolt",
    "Caches derived data with an explicit freshness and invalidation policy.",
    [
      choice("engine", "Cache family", ["Redis compatible", "Memcached", "In-process"]),
      choice("strategy", "Read/write strategy", ["Cache aside", "Read through", "Write through"]),
      number("ttl", "Default TTL (seconds)", 300),
      choice("invalidation", "Invalidation", [
        "TTL + explicit invalidation",
        "TTL only",
        "Versioned keys",
      ]),
      choice("failure", "On cache failure", ["Fall back to source", "Fail the request"]),
    ],
  ),
  capability(
    "object-storage",
    "Object storage",
    "Data & storage",
    "database",
    "archive",
    "Stores media and exports separately from transactional records.",
    [
      choice("api", "Storage API", ["S3 compatible", "Cloud provider native", "Undecided"]),
      choice("access", "Object access", ["Private; signed URLs", "Public read", "Service only"]),
      toggle("versioning", "Object versioning"),
      number("retention", "Retention target (days; 0 = indefinite)", 0),
      availability(),
    ],
  ),
  capability(
    "search-index",
    "Search index",
    "Data & storage",
    "database",
    "search",
    "A derived index for search and discovery; source records remain authoritative.",
    [
      choice("search", "Search mode", ["Full text", "Full text + facets", "Hybrid text + vector"]),
      choice("sync", "Index updates", [
        "Domain events",
        "Change data capture",
        "Scheduled rebuild",
      ]),
      choice("freshness", "Freshness target", ["Seconds", "Minutes", "Batch"]),
    ],
  ),
  capability(
    "job-queue",
    "Job queue",
    "Messaging",
    "service",
    "list",
    "Buffers background work with retry and failure handling.",
    [
      choice("ordering", "Ordering", ["Best effort", "Per key", "FIFO"]),
      number("retries", "Retry limit target", 5),
      toggle("deadLetter", "Dead-letter queue"),
      choice("priority", "Priority lanes", ["One lane", "Interactive + bulk"]),
    ],
  ),
  capability(
    "event-stream",
    "Event stream",
    "Messaging",
    "service",
    "activity",
    "Retains domain events for independent consumers and replay.",
    [
      text("partition", "Partition key", "aggregateId"),
      number("retention", "Retention (days)", 7),
      choice("schema", "Schema evolution", ["Backward compatible", "Explicit versioned topics"]),
      toggle("replay", "Consumer replay"),
    ],
  ),
  capability(
    "third-party-service",
    "Third-party service",
    "Integrations",
    "external",
    "world",
    "Connects to an external provider with explicit data sharing and failure behavior.",
    [
      choice("category", "Category", [
        "Payments",
        "E-mail delivery",
        "SMS",
        "Push notifications",
        "Maps & geocoding",
        "Analytics vendor",
        "CRM & support",
        "AI model API",
        "Other",
      ]),
      choice("authentication", "Authentication", ["API key", "OAuth client", "mTLS"]),
      toggle("webhooks", "Inbound webhooks", false),
      text("dataShared", "Data shared"),
      choice("unavailable", "Behavior when unavailable", [
        "Fail request",
        "Degrade",
        "Queue and retry",
      ]),
    ],
  ),
  capability(
    "notification-service",
    "Notification service",
    "Integrations",
    "service",
    "mail",
    "Delivers transactional messages and respects recipient preferences.",
    [
      choice("channels", "Channels", ["Email", "Email + push", "Email + SMS + push"]),
      toggle("preferences", "Recipient preferences"),
      toggle("deduplication", "Deduplicate delivery"),
      choice("provider", "Provider", ["Adapter; decide later", "Self hosted", "Managed service"]),
    ],
  ),
  capability(
    "billing-provider",
    "Billing integration",
    "Integrations",
    "external",
    "credit-card",
    "Subscriptions, billing events and entitlement synchronization.",
    [
      choice("pricing", "Pricing model", [
        "Subscription tiers",
        "Usage based",
        "Subscription + usage",
      ]),
      toggle("webhooks", "Signed webhook verification"),
      toggle("idempotency", "Idempotent event processing"),
      text("provider", "Provider", "Decide later"),
    ],
  ),
  capability(
    "observability",
    "Observability",
    "Operations",
    "external",
    "chart-bar",
    "Logs, metrics, traces and actionable service alerts.",
    [
      toggle("logs", "Structured logs"),
      toggle("metrics", "Service metrics"),
      toggle("traces", "Distributed traces"),
      number("retention", "Log retention (days)", 30),
      text("slo", "Service-level objective", "Define availability and latency targets"),
    ],
  ),
  capability(
    "domain-module",
    "Domain responsibility",
    "Components",
    "service",
    "puzzle",
    "A cohesive business responsibility inside an application.",
    [
      text("owns", "Owns / manages"),
      text("operations", "Key operations"),
      choice("access", "Access", [
        "Authenticated owner",
        "Organization member",
        "Public read",
        "Internal only",
      ]),
      text("events", "Events produced"),
    ],
    "component",
  ),
  capability(
    "authorization-module",
    "Authorization",
    "Components",
    "service",
    "lock",
    "Decides which principals can act on which records.",
    [
      choice("policy", "Policy model", ["Owner based", "Roles + permissions", "Attribute based"]),
      isolation(),
      toggle("audit", "Audit privileged actions"),
    ],
    "component",
  ),
  capability(
    "feed-module",
    "Feed & discovery",
    "Components",
    "service",
    "list",
    "Builds and reads a user's feed or community content listing.",
    [
      choice("delivery", "Feed assembly", ["Fan-out on read", "Fan-out on write", "Hybrid"]),
      choice("ranking", "Ranking", ["Chronological", "Scored", "Personalized"]),
      choice("paging", "Pagination", ["Cursor based", "Time window"]),
    ],
    "component",
  ),
  capability(
    "moderation-module",
    "Content moderation",
    "Components",
    "service",
    "shield",
    "Applies content rules, handles reports and records moderation decisions.",
    [
      choice("review", "Review", [
        "Reports + human review",
        "Automated screening + review",
        "Pre-publication review",
      ]),
      toggle("appeals", "Appeal workflow"),
      toggle("audit", "Decision audit trail"),
    ],
    "component",
  ),
  capability(
    "analytics-module",
    "Analytics",
    "Components",
    "service",
    "chart-bar",
    "Turns domain events into aggregates with explicit freshness and retention.",
    [
      choice("aggregation", "Aggregation", ["Asynchronous", "On demand", "Scheduled batch"]),
      text("dimensions", "Dimensions", "time, resource"),
      number("retention", "Event retention (days)", 90),
    ],
    "component",
  ),
  capability(
    "media-module",
    "Media processing",
    "Components",
    "worker",
    "photo",
    "Validates and transforms uploaded or generated media.",
    [
      choice("processing", "Processing", ["Background jobs", "Bounded synchronous work"]),
      text("formats", "Output formats", "WebP, PNG"),
      toggle("scan", "Validate uploaded content"),
      toggle("variants", "Version derived assets"),
    ],
    "component",
  ),
];

export function plannedCapability(id: string | undefined) {
  return plannedCapabilities.find((entry) => entry.id === id);
}

export function plannedConfigSchema(id: string) {
  const entry = plannedCapability(id);
  if (!entry) throw new Error(`Unknown planned capability: ${id}`);
  const fields: Record<string, z.ZodType> = {};
  for (const field of entry.fields) {
    const type: z.ZodType = field.options
      ? z.enum(field.options as [string, ...string[]])
      : typeof field.default === "boolean"
        ? z.boolean()
        : typeof field.default === "number"
          ? z.int().min(0).max(1_000_000_000)
          : z.string().max(2000);
    fields[field.key] = type
      .default(field.default)
      .meta({ title: field.label, description: field.description });
  }
  return z.strictObject(fields);
}

export const plannedConnectionSchema = z.strictObject({
  label: relationshipLabelSchema.min(1),
  protocol: relationshipProtocolSchema.default("HTTPS"),
  interaction: relationshipInteractionSchema.default("Request / response"),
  security: z
    .enum(["Service identity", "User identity", "Public", "Private network"])
    .default("Service identity"),
});

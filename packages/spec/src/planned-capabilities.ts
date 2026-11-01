/** Design-time catalog. These contracts describe intent; they provide no runtime. */
import { z } from "zod";
import type { Element } from "./design.ts";
import type { TemplateLookup } from "./manifest.ts";
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
  architectureKind?: "Application" | "Data store" | "External system" | "Deployment infrastructure";
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
  choice(
    "tenancy",
    "Legacy tenancy intent",
    ["Owner scoped", "Organization scoped", "Shared public data", "Dedicated per tenant"],
    "Legacy combined intent only. Choose business tenancy, authorization and isolation independently in system context.",
  );
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
  architectureKind:
    scope === "component"
      ? undefined
      : id === "load-balancer"
        ? "Deployment infrastructure"
        : ["job-queue", "event-stream"].includes(id) || role === "database"
          ? "Data store"
          : role === "external"
            ? "External system"
            : "Application",
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
    "A named logical work queue. Broker instances and clusters belong in deployment.",
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
    "A named logical event channel for consumers and replay. Broker placement belongs in deployment.",
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
    "An internal application for notification delivery and recipient preferences; separate from an external delivery provider.",
    [
      choice("channels", "Channels", ["Email", "Email + push", "Email + SMS + push"]),
      toggle("preferences", "Recipient preferences"),
      toggle("deduplication", "Deduplicate delivery"),
      choice("provider", "Provider", ["Adapter; decide later", "Self hosted", "Managed service"]),
    ],
  ),
  capability(
    "billing-provider",
    "Payment provider preset",
    "Integrations",
    "external",
    "credit-card",
    "External payment-provider preset retained with its original options; application billing policy belongs in a C3 component.",
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
    "Telemetry collection and alerts. Classify an owned collector as Application, or an outside monitoring product as External system.",
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
    "request-boundary",
    "Request handling",
    "Application components",
    "service",
    "api",
    "Validates incoming requests, establishes caller context and delegates to domain responsibilities.",
    [
      choice("transport", "Interface style", ["HTTP / REST", "GraphQL", "gRPC", "WebSocket"]),
      choice("validation", "Request validation", ["Schema at boundary", "Explicit custom policy"]),
      text("errors", "Error contract", "Stable error codes; no internal details"),
      text("versioning", "Compatibility policy"),
    ],
    "component",
  ),
  capability(
    "repository-module",
    "Data access & transactions",
    "Application components",
    "service",
    "database",
    "Owns persistence queries and transaction boundaries for domain aggregates, independently of table layout.",
    [
      text("aggregates", "Owned aggregates"),
      choice("consistency", "Consistency", [
        "Strong within transaction",
        "Eventual across boundaries",
        "Explicit policy",
      ]),
      choice("concurrency", "Concurrent writes", [
        "Optimistic version check",
        "Pessimistic locking",
        "Append only",
      ]),
      text("atomicity", "Atomic changes", "Domain state and outbox intent share one transaction"),
    ],
    "component",
  ),
  capability(
    "cache-module",
    "Cache & freshness",
    "Application components",
    "service",
    "bolt",
    "Owns cache keys, bounded staleness, invalidation and source fallback for derived application data.",
    [
      choice("strategy", "Strategy", ["Cache aside", "Read through", "Write through"]),
      number("ttlSeconds", "Maximum age (seconds)", 60),
      choice("invalidation", "Invalidation", [
        "On write + TTL",
        "Versioned keys",
        "Event driven + TTL",
      ]),
      choice("failure", "Cache failure", [
        "Source fallback",
        "Serve bounded stale",
        "Fail request",
      ]),
      toggle("coalesce", "Coalesce concurrent cache misses"),
    ],
    "component",
  ),
  capability(
    "workflow-module",
    "Workflow & orchestration",
    "Application components",
    "service",
    "route",
    "Coordinates a multi-step business process with persisted progress, idempotency and recovery.",
    [
      text("steps", "Business steps"),
      choice("execution", "Execution", ["Persisted state machine", "In-process bounded workflow"]),
      choice("failure", "Partial failure", [
        "Retry then operator review",
        "Compensating actions",
        "Explicit policy",
      ]),
      text("idempotency", "Idempotency key"),
      text("timeout", "Completion deadline"),
    ],
    "component",
  ),
  capability(
    "outbox-module",
    "Transactional event publishing",
    "Application components",
    "service",
    "mail",
    "Records domain changes and event intent atomically, then publishes with retained progress and duplicate-safe delivery.",
    [
      text("events", "Published events"),
      choice("atomicity", "Atomic persistence", [
        "Domain state + outbox in one transaction",
        "Unresolved",
      ]),
      choice("delivery", "Delivery", ["At least once; idempotent consumer", "Unresolved"]),
      text("deduplication", "Consumer deduplication key", "Event ID"),
      number("retentionDays", "Outbox retention (days)", 7),
    ],
    "component",
  ),
  capability(
    "traffic-policy",
    "Rate limits & admission",
    "Application components",
    "service",
    "shield",
    "Protects an application boundary with caller budgets, overload decisions and bounded concurrency.",
    [
      choice("scope", "Limit scope", [
        "Principal + operation",
        "Tenant + operation",
        "Anonymous IP + operation",
      ]),
      number("ratePerMinute", "Requests per minute target", 120),
      number("burst", "Burst allowance", 30),
      choice("overload", "Overload outcome", [
        "Reject with retry guidance",
        "Bounded queue",
        "Degrade optional work",
      ]),
      text("bypass", "Trusted caller policy"),
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
  capability(
    "integration-adapter",
    "Integration adapter",
    "Components",
    "service",
    "plug",
    "Maps application operations to an external provider and verifies incoming webhooks.",
    [
      text("target", "Target external service"),
      number("retries", "Retry limit target", 3),
      number("timeoutMs", "Timeout target (ms)", 5000),
      text("mapping", "Request / response mapping"),
      toggle("verifyWebhooks", "Verify webhook signatures"),
    ],
    "component",
  ),
  capability(
    "notifications-module",
    "Notifications",
    "Components",
    "service",
    "mail",
    "Composes messages, selects channels and respects recipient preferences.",
    [
      choice("channels", "Channels", ["Email", "Email + push", "Email + SMS + push"]),
      text("templates", "Message templates"),
      toggle("preferences", "Recipient preferences"),
    ],
    "component",
  ),
  capability(
    "billing-module",
    "Billing & plans",
    "Components",
    "service",
    "credit-card",
    "Manages plans, trials and entitlements with explicit provider synchronization.",
    [
      text("plans", "Plans", "Free, Pro"),
      number("trialDays", "Trial duration (days)", 14),
      text("entitlements", "Entitlements"),
      choice("providerSync", "Provider synchronization", [
        "Signed webhooks + reconciliation",
        "Scheduled reconciliation",
        "Manual review",
      ]),
    ],
    "component",
  ),
  capability(
    "organizations-module",
    "Organizations & members",
    "Components",
    "service",
    "user",
    "Manages teams, membership invitations and organization roles.",
    [
      text("teams", "Team structure"),
      choice("invitations", "Invitations", ["Email invitation", "Invite link", "Admin managed"]),
      text("roles", "Member roles", "Owner, Admin, Member"),
    ],
    "component",
  ),
  capability(
    "developer-api-module",
    "Developer API & webhooks",
    "Components",
    "service",
    "api",
    "Exposes developer access and versioned outbound webhook contracts.",
    [
      toggle("apiKeys", "API key access"),
      number("rateLimit", "Requests per minute / key target", 120),
      toggle("outboundWebhooks", "Outbound webhooks"),
      choice("versioning", "Versioning", [
        "URL version",
        "Header version",
        "Explicit compatibility policy",
      ]),
    ],
    "component",
  ),
  capability(
    "reports-module",
    "Reports & exports",
    "Components",
    "service",
    "archive",
    "Builds reports and exports with explicit generation and retention policies.",
    [
      text("formats", "Export formats", "CSV, PDF"),
      toggle("asyncGeneration", "Asynchronous generation"),
      number("retention", "Export retention (days)", 7),
    ],
    "component",
  ),
  capability(
    "search-module",
    "Search & indexing",
    "Components",
    "service",
    "search",
    "Builds search documents from authoritative records and serves discovery queries.",
    [
      text("documents", "Indexed documents"),
      choice("updates", "Index updates", ["Domain events", "Scheduled rebuild", "On write"]),
      choice("freshness", "Freshness target", ["Seconds", "Minutes", "Batch"]),
      toggle("accessFilter", "Filter results by access"),
    ],
    "component",
  ),
  capability(
    "scheduled-jobs-module",
    "Scheduled jobs",
    "Components",
    "worker",
    "cpu",
    "Runs scheduled application work with explicit overlap and failure policies.",
    [
      text("schedule", "Schedule", "Daily"),
      text("timezone", "Time zone", "UTC"),
      choice("overlap", "Overlapping runs", [
        "Skip while running",
        "Queue next run",
        "Allow overlap",
      ]),
      number("retries", "Retry limit target", 3),
    ],
    "component",
  ),
  capability(
    "event-handlers-module",
    "Event handlers",
    "Components",
    "worker",
    "activity",
    "Handles domain events with explicit idempotency, retry and failure intent.",
    [
      text("events", "Event contracts"),
      text("idempotency", "Idempotency key", "eventId"),
      number("retries", "Retry limit target", 5),
      toggle("deadLetter", "Dead-letter handling"),
    ],
    "component",
  ),
  capability(
    "audit-log-module",
    "Audit log",
    "Components",
    "service",
    "list",
    "Records attributable application actions with explicit retention and access.",
    [
      text("actions", "Audited actions"),
      text("actor", "Actor attribution", "Principal, organization, request ID"),
      number("retention", "Audit retention (days)", 365),
      choice("access", "Audit access", ["Admins only", "Organization auditors", "Internal only"]),
    ],
    "component",
  ),
  capability(
    "entitlements-module",
    "Entitlements & quotas",
    "Components",
    "service",
    "lock",
    "Owns plan limits, usage decisions and downgrade policy.",
    [
      text("limits", "Plan limits"),
      choice("usage", "Usage counters", ["Unspecified", "Per tenant", "Per principal", "Shared"]),
      choice("enforcement", "Limit enforcement", ["Unspecified", "Hard limit", "Soft limit"]),
      choice("downgrade", "Downgrade policy", [
        "Unspecified",
        "Retain existing access",
        "Restrict new actions",
        "Explicit transition policy",
      ]),
    ],
    "component",
  ),
  capability(
    "abuse-module",
    "Abuse & trust/safety",
    "Components",
    "service",
    "lock",
    "Owns destination review, quarantine and abuse-report decisions.",
    [
      choice("screening", "Destination screening", [
        "Unspecified",
        "Before publication",
        "Continuous review",
        "On report",
      ]),
      choice("quarantine", "Quarantine policy", [
        "Unspecified",
        "Block pending review",
        "Review before restriction",
      ]),
      choice("reports", "Report handling", [
        "Unspecified",
        "Staff review",
        "Automated triage and review",
      ]),
      choice("appeals", "Appeal handling", ["Unspecified", "Staff review", "No appeal process"]),
    ],
    "component",
  ),
  capability(
    "custom-domains-module",
    "Custom domains",
    "Components",
    "service",
    "world",
    "Owns domain verification, transfer and removal. TLS termination and placement also belong in deployment.",
    [
      choice("verification", "Ownership verification", [
        "Unspecified",
        "DNS challenge",
        "HTTP challenge",
      ]),
      choice("certificates", "Certificate lifecycle", [
        "Unspecified",
        "Provider managed",
        "Application managed",
      ]),
      choice("transfer", "Domain transfer", [
        "Unspecified",
        "Reverify new owner",
        "Reviewed handoff",
      ]),
      choice("takeover", "Takeover protection", [
        "Unspecified",
        "Reverify before activation",
        "Reserve until reviewed removal",
      ]),
    ],
    "component",
  ),
  capability(
    "data-lifecycle-module",
    "Data lifecycle",
    "Components",
    "service",
    "database",
    "Owns export, deletion, retention and anonymization policy for application data.",
    [
      choice("export", "Export access", [
        "Unspecified",
        "Tenant owner",
        "Authorized roles",
        "Staff only",
      ]),
      choice("deletion", "Deletion policy", [
        "Unspecified",
        "Immediate",
        "Retention window",
        "Reviewed request",
      ]),
      text("retention", "Retention policy"),
      choice("anonymization", "Anonymization", [
        "Unspecified",
        "Before aggregation",
        "On deletion",
        "No anonymization",
      ]),
    ],
    "component",
  ),
  capability(
    "screen-group",
    "Screen group / feature area",
    "Client components",
    "frontend",
    "browser",
    "Groups client pages around a cohesive user feature and its data needs.",
    [
      text("pages", "Pages"),
      choice("access", "Page access", ["Public", "Signed-in", "Admin"]),
      text("dataUsed", "Data used"),
    ],
    "component",
  ),
  capability(
    "client-session",
    "Client session & access",
    "Client components",
    "frontend",
    "lock",
    "Maintains client session state and presents access-aware navigation.",
    [
      choice("identity", "Session source", [
        "Application session",
        "OIDC provider",
        "Platform identity",
      ]),
      text("roles", "Client access roles"),
      choice("expiry", "On session expiry", [
        "Prompt sign-in",
        "Return to public area",
        "Read-only mode",
      ]),
    ],
    "component",
  ),
  capability(
    "api-facade",
    "API facade",
    "Client components",
    "frontend",
    "api",
    "Presents application API contracts to client features through a cohesive facade.",
    [
      text("target", "Target application API"),
      choice("transport", "Transport", ["HTTPS/JSON", "GraphQL over HTTPS", "RPC over HTTPS"]),
      text("mapping", "Client data mapping"),
      choice("errors", "Error handling", [
        "Typed errors",
        "Feature fallback",
        "Retry transient reads",
      ]),
    ],
    "component",
  ),
  capability(
    "local-state",
    "Local state & offline sync",
    "Client components",
    "frontend",
    "device-mobile",
    "Manages local client state and reconciles changes after reconnecting.",
    [
      choice("storage", "Local storage", ["Platform database", "Browser database", "Memory only"]),
      choice("sync", "Synchronization", [
        "Queue changes for sync",
        "Read cached content",
        "Online first",
      ]),
      choice("conflicts", "Conflict handling", [
        "Ask the user",
        "Server wins",
        "Explicit merge rules",
      ]),
      text("data", "Locally retained data"),
    ],
    "component",
  ),
  capability(
    "realtime-client",
    "Realtime client",
    "Client components",
    "frontend",
    "plug",
    "Reuses a streaming client to receive events, reconnect and reconcile application state.",
    [
      choice("transport", "Transport", ["WebSocket", "Server-sent events"]),
      text("implementation", "Client library / implementation"),
      choice("recovery", "After connection loss", [
        "Resynchronize from source",
        "Resume from cursor",
        "Explicit policy",
      ]),
      text("authority", "Authoritative source for missed updates"),
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

/** Resolve a host role from design intent or its actual registered element template. */
export function componentHostRole(element: Element, lookup?: TemplateLookup) {
  if (element.planned) return plannedCapability(element.planned)?.role;
  const manifest = element.template && lookup?.get(element.template);
  return manifest?.kind === "element" ? manifest.elementKind : undefined;
}

/** Backend responsibilities can share service/worker hosts; client responsibilities stay client-side. */
export function componentCompatible(capability: PlannedCapability, role: string | undefined) {
  return (
    capability.scope === "component" &&
    (capability.role === "frontend"
      ? role === "frontend"
      : ["service", "worker"].includes(role ?? ""))
  );
}

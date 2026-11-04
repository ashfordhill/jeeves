/** Fresh finite studio study; historical sources and live applications remain unchanged. */
import initialLayout from "./community.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const COMMUNITY_STUDIO_EXAMPLE = {
  id: "studio-community",
  version: "1.0.0",
  name: "Community · studio study",
  description:
    "A discussion foundation with browser/API, content data, discovery, queued background work and subscription notifications.",
  goalManifestSha256: "f5aa00026e257ac295b319af75bdd364d7bdc7a1bb6a4a9d30f71ba571a69704",
} as const;

export function communityStudioExample() {
  return createStudioStudy(
    COMMUNITY_STUDIO_EXAMPLE,
    [
      {
        id: "web",
        name: "Web application",
        description: "Creates and manages content through a signed-in browser experience.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "api",
        name: "Application API",
        description: "Owns account access, domain operations and application contracts.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
        },
      },
      {
        id: "db",
        name: "Primary data",
        description: "Stores authoritative accounts, ownership and domain records.",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "cache",
        name: "Application cache",
        description: "Caches derived lookups with bounded freshness and source fallback.",
        settings: {
          kind: "cache",
          engine: "redis-compatible",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "queue",
        name: "Background jobs",
        description: "Buffers visit events and background tasks for independent processing.",
        settings: {
          kind: "queue",
          mode: "work-queue",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "worker",
        name: "Background worker",
        description: "Processes queued work and scheduled tasks outside interactive requests.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "typescript",
        },
      },
      {
        id: "search",
        name: "Discovery index",
        description: "Indexes public content for access-filtered discovery.",
        settings: {
          kind: "search",
          engine: "opensearch",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "assets",
        name: "Media storage",
        description: "Retains source media and derived delivery variants.",
        settings: {
          kind: "object-store",
          provider: "unspecified",
          access: "private",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "notifications",
        name: "Notifications",
        description: "Composes subscription messages and respects delivery preferences.",
        settings: {
          kind: "notification",
          execution: "docker",
          language: "typescript",
          exposure: "internal",
          provider: "unspecified",
        },
      },
      {
        id: "billing",
        name: "Payment provider",
        description: "Processes subscriptions and sends signed billing events.",
        settings: {
          kind: "external-api",
          category: "payments",
          provider: "external",
        },
      },
      {
        id: "email",
        name: "E-mail delivery provider",
        description: "Delivers transactional messages without owning application accounts.",
        settings: {
          kind: "external-api",
          category: "email",
          provider: "external",
        },
      },
      {
        id: "edge",
        name: "CDN & edge",
        description:
          "Delivers static application assets and public artwork; redirects remain uncached.",
        settings: {
          kind: "cdn",
          provider: "unspecified",
          origin: "assets",
        },
      },
      {
        id: "telemetry",
        name: "Observability",
        description: "Collects redacted service logs, metrics and traces.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "external",
        },
      },
      {
        id: "identity",
        name: "Identity provider",
        description: "Authenticates members and supplies verified sign-in identities.",
        settings: {
          kind: "external-api",
          category: "identity",
          provider: "external",
        },
      },
    ],
    [
      {
        id: "web-api",
        from: "web",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Uses application API",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-db",
        from: "api",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads / writes records",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-cache",
        from: "api",
        to: "cache",
        kind: "depends-on",
        planned: {
          label: "Caches derived reads",
          protocol: "Redis",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-queue",
        from: "api",
        to: "queue",
        kind: "depends-on",
        planned: {
          label: "Enqueues work",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "publish",
        },
      },
      {
        id: "queue-worker",
        from: "queue",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Delivers jobs",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "consume",
        },
      },
      {
        id: "worker-db",
        from: "worker",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads / writes task data",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-search",
        from: "api",
        to: "search",
        kind: "depends-on",
        planned: {
          label: "Searches public content",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-assets",
        from: "worker",
        to: "assets",
        kind: "depends-on",
        planned: {
          label: "Processes media",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-notifications",
        from: "worker",
        to: "notifications",
        kind: "depends-on",
        planned: {
          label: "Delivers subscriptions",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-billing",
        from: "api",
        to: "billing",
        kind: "depends-on",
        planned: {
          label: "Synchronizes plans and subscriptions",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "billing-api",
        from: "billing",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Delivers signed billing events",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-email",
        from: "worker",
        to: "email",
        kind: "depends-on",
        planned: {
          label: "Delivers transactional messages",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "edge-web",
        from: "edge",
        to: "web",
        kind: "depends-on",
        planned: {
          label: "Loads application assets",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "edge-assets",
        from: "edge",
        to: "assets",
        kind: "depends-on",
        planned: {
          label: "Loads public artwork and media",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-telemetry",
        from: "api",
        to: "telemetry",
        kind: "depends-on",
        planned: {
          label: "Exports redacted telemetry",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "worker-telemetry",
        from: "worker",
        to: "telemetry",
        kind: "depends-on",
        planned: {
          label: "Exports job metrics and traces",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "notifications-email",
        from: "notifications",
        to: "email",
        kind: "depends-on",
        planned: {
          label: "Sends subscription messages",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "web-identity",
        from: "web",
        to: "identity",
        kind: "depends-on",
        planned: {
          label: "Authenticates members",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-identity",
        from: "api",
        to: "identity",
        kind: "depends-on",
        planned: {
          label: "Validates member identities",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
    ],
    {
      system: {
        name: "Community · studio study",
        description:
          "A discussion foundation with browser/API, content data, discovery, queued background work and subscription notifications.",
      },
      nodes: [
        {
          id: "member",
          kind: "person",
          name: "Member",
          description: "Creates and manages owned content.",
        },
        {
          id: "visitor",
          kind: "person",
          name: "Visitor",
          description: "Browses public content or follows a shared link.",
        },
        {
          id: "payment-provider",
          kind: "external-system",
          name: "Payment provider",
          description: "Processes subscriptions and supplies billing events.",
          container: "billing",
        },
        {
          id: "email-provider",
          kind: "external-system",
          name: "E-mail delivery provider",
          description: "Delivers account, invitation and report-ready messages.",
          container: "email",
        },
      ],
      relationships: [
        {
          id: "member-system",
          from: "member",
          to: "system",
          description: "Manages content and artwork",
          container: "web",
        },
        {
          id: "visitor-system",
          from: "visitor",
          to: "system",
          description: "Browses public content",
          container: "web",
        },
        {
          id: "system-payment",
          from: "system",
          to: "payment-provider",
          description: "Synchronizes subscriptions and entitlements",
          container: "api",
        },
        {
          id: "system-email",
          from: "system",
          to: "email-provider",
          description: "Delivers transactional messages",
          container: "worker",
        },
      ],
    },
    initialLayout,
  );
}

/** Fresh finite studio study; historical sources and live applications remain unchanged. */
import initialLayout from "./links.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const LINKS_STUDIO_EXAMPLE = {
  id: "studio-link-platform",
  version: "1.0.0",
  name: "Links & QR · studio study",
  description:
    "A small management and fast redirect reference with cache fallback, artwork storage and asynchronous analytics.",
  goalManifestSha256: "bfa131dd14d79092414e019ae469a65d6a202fd51cd2496780aed9d27bc5f00b",
} as const;

export function linksStudioExample() {
  return createStudioStudy(
    LINKS_STUDIO_EXAMPLE,
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
        id: "redirect",
        name: "Redirect service",
        description: "Resolves public short links independently of management requests.",
        settings: {
          kind: "redirect",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          lookupStoreConnection: "redirect-db",
          lookupCacheConnection: "redirect-cache",
        },
      },
      {
        id: "assets",
        name: "Artwork storage",
        description: "Versions QR artwork and generated export objects.",
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
        id: "redirect-cache",
        from: "redirect",
        to: "cache",
        kind: "depends-on",
        planned: {
          label: "Looks up destinations",
          protocol: "Redis",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "redirect-db",
        from: "redirect",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads on cache miss",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "redirect-queue",
        from: "redirect",
        to: "queue",
        kind: "depends-on",
        planned: {
          label: "Records visit events",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "publish",
        },
      },
      {
        id: "api-assets",
        from: "api",
        to: "assets",
        kind: "depends-on",
        planned: {
          label: "Stores artwork",
          protocol: "HTTPS",
          interaction: "Request / response",
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
        name: "Links & QR · studio study",
        description:
          "A small management and fast redirect reference with cache fallback, artwork storage and asynchronous analytics.",
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
          description: "Follows a short link",
          container: "redirect",
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

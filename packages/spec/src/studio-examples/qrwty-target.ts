/** Fresh finite studio study; historical sources and live applications remain unchanged. */
import initialLayout from "./qrwty-target.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const QRWTY_TARGET_STUDIO_EXAMPLE = {
  id: "studio-qrwty-target",
  version: "1.0.0",
  name: "QRWTY target · studio study",
  description:
    "Owner and staff apps, Management, Redirect, one Billing service, authority/cache and C3 visit analytics with source-linked custom behavior.",
  goalManifestSha256: "1f4b2adbeab2c32fc65509e756e63b4f4c98e3471d2b8bd81f39925da69cc7bb",
} as const;

export function qrwtyTargetStudioExample() {
  return createStudioStudy(
    QRWTY_TARGET_STUDIO_EXAMPLE,
    [
      {
        id: "api",
        name: "Management",
        description: "Owns tenant-authorized product operations and authoritative state.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
        },
      },
      {
        id: "worker",
        name: "Analytics worker",
        description: "Checks tenant scope again before reports, exports and delivery.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "typescript",
        },
      },
      {
        id: "db",
        name: "Primary data",
        description: "Authoritative tenant records and product data; shared scoped storage.",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "unspecified",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "redirect",
        name: "Redirect",
        description: "Separately scalable public resolution; browser follows Location.",
        settings: {
          kind: "redirect",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          lookupStoreConnection: "delivery-persist-domain",
          lookupCacheConnection: "lookup-read-cache",
        },
      },
      {
        id: "delivery-channel",
        name: "Visit events",
        description: "Logical job-queue with explicit responsibility and editable policies.",
        settings: {
          kind: "queue",
          mode: "work-queue",
          provider: "unspecified",
        },
        owner: {
          kind: "element",
          id: "redirect",
        },
      },
      {
        id: "billing-provider",
        name: "Payment provider",
        description: "Logical billing-provider with explicit responsibility and editable policies.",
        settings: {
          kind: "external-api",
          category: "payments",
          provider: "external",
        },
      },
      {
        id: "lookup-cache",
        name: "Lookup cache",
        description:
          "Logical distributed-cache with explicit responsibility and editable policies.",
        settings: {
          kind: "cache",
          engine: "redis-compatible",
          provider: "unspecified",
        },
        owner: {
          kind: "element",
          id: "redirect",
        },
      },
      {
        id: "web",
        name: "Owner web app",
        description: "Signed-in feature areas using exact tenant-scoped API contracts.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "admin",
        name: "Staff console",
        description: "Audited support and abuse decisions with explicit staff authorization.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "assets",
        name: "Artwork and export storage",
        description: "Versioned artwork, hosted content assets and expiring authorized exports.",
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
        id: "email",
        name: "E-mail provider",
        description:
          "External delivery only; invitation and revocation policy stays in the application.",
        settings: {
          kind: "external-api",
          category: "email",
          provider: "external",
        },
      },
      {
        id: "dns",
        name: "DNS and certificate provider",
        description:
          "External ownership challenges and certificate lifecycle; application owns domain policy.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "external",
        },
      },
      {
        id: "api-client",
        name: "Developer integration",
        description:
          "External API-key caller; tenant checks and revocation use the same access authority.",
        settings: {
          kind: "external-api",
          category: "generic",
          provider: "external",
        },
      },
      {
        id: "billing",
        name: "Billing",
        description:
          "Owns subscription callback integration, billing policy and effective entitlement decisions as one service boundary.",
        settings: {
          kind: "billing",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          provider: "unspecified",
        },
      },
    ],
    [
      {
        id: "tenant-save-membership",
        from: "api",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Manages tenant records",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Private network",
        },
        settings: {},
      },
      {
        id: "delivery-persist-domain",
        from: "redirect",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads lookup authority",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Private network",
        },
        settings: {},
      },
      {
        id: "delivery-publish-work",
        from: "redirect",
        to: "delivery-channel",
        kind: "depends-on",
        planned: {
          label: "Publishes best-effort work",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Private network",
        },
        settings: {
          channelUse: "publish",
        },
      },
      {
        id: "delivery-consume-work",
        from: "delivery-channel",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Consumes named work channel",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Private network",
        },
        settings: {
          channelUse: "consume",
        },
      },
      {
        id: "billing-receive-callback",
        from: "billing-provider",
        to: "billing",
        kind: "depends-on",
        planned: {
          label: "Delivers signed billing callback",
          protocol: "HTTPS",
          interaction: "Asynchronous",
          security: "Public",
        },
        settings: {},
      },
      {
        id: "lookup-read-cache",
        from: "redirect",
        to: "lookup-cache",
        kind: "depends-on",
        planned: {
          label: "Reads and invalidates lookups",
          protocol: "Redis",
          interaction: "Request / response",
          security: "Private network",
        },
        settings: {},
      },
      {
        id: "manage-edge",
        from: "web",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Uses tenant product APIs",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "export-access-edge",
        from: "worker",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Check current tenant and principal remotely",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "export-job-edge",
        from: "api",
        to: "worker",
        kind: "depends-on",
        planned: {
          label: "Authorize export execution",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "export-write-edge",
        from: "worker",
        to: "assets",
        kind: "depends-on",
        planned: {
          label: "Expiring authorized exports",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "aggregate-write-edge",
        from: "worker",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Reads / writes authoritative data",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "artwork-write-edge",
        from: "api",
        to: "assets",
        kind: "depends-on",
        planned: {
          label: "Versioned artwork",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "lookup-change-edge",
        from: "api",
        to: "redirect",
        kind: "depends-on",
        planned: {
          label: "Commit lookup change or disable",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "dns-binding-edge",
        from: "api",
        to: "dns",
        kind: "depends-on",
        planned: {
          label: "Attach, transfer or remove custom domain",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "abuse-binding-edge",
        from: "admin",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Disable or appeal abusive link",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-key-edge",
        from: "api-client",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Create or edit link and payload",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "email-binding-edge",
        from: "worker",
        to: "email",
        kind: "depends-on",
        planned: {
          label: "Deliver tenant invitation",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "management-billing",
        from: "api",
        to: "billing",
        kind: "depends-on",
        planned: {
          label: "Checks effective entitlements",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "billing-authority",
        from: "billing",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Persists billing acceptance and entitlements",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "billing-payment",
        from: "billing",
        to: "billing-provider",
        kind: "depends-on",
        planned: {
          label: "Reconciles subscription state",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
    ],
    {
      system: {
        name: "QRWTY target · studio study",
        description:
          "Owner and staff apps, Management, Redirect, one Billing service, authority/cache and C3 visit analytics with source-linked custom behavior.",
      },
      nodes: [
        {
          id: "member",
          kind: "person",
          name: "Link owner",
          description: "Acts inside an authorized tenant workspace.",
        },
        {
          id: "visitor",
          kind: "person",
          name: "QR visitor",
          description: "Scans a stable public URL; their browser follows the destination.",
        },
        {
          id: "staff",
          kind: "person",
          name: "Support staff",
          description: "Uses audited scoped support privileges.",
        },
        {
          id: "payment-provider",
          kind: "external-system",
          name: "Payment provider",
          description: "Signed subscription callbacks and external payment processing.",
          container: "billing-provider",
        },
        {
          id: "email-provider",
          kind: "external-system",
          name: "E-mail provider",
          description: "Delivers transactional messages.",
          container: "email",
        },
        {
          id: "domain-provider",
          kind: "external-system",
          name: "DNS and certificate provider",
          description: "Validates DNS challenges and operates certificate issuance.",
          container: "dns",
        },
        {
          id: "destination",
          kind: "external-system",
          name: "Destination website",
          description:
            "Receives navigation from the visitor browser, never from the redirect service.",
        },
        {
          id: "developer",
          kind: "external-system",
          name: "Developer integration",
          description: "Uses tenant-scoped API keys.",
          container: "api-client",
        },
      ],
      relationships: [
        {
          id: "member-system",
          from: "member",
          to: "system",
          description: "Manages tenant-owned records",
          container: "web",
        },
        {
          id: "visitor-system",
          from: "visitor",
          to: "system",
          description: "Resolves a printed URL",
          container: "redirect",
        },
        {
          id: "staff-system",
          from: "staff",
          to: "system",
          description: "Investigates abuse and support cases",
          container: "admin",
        },
        {
          id: "system-payment",
          from: "system",
          to: "payment-provider",
          description: "Accepts signed billing events",
          container: "billing",
        },
        {
          id: "system-email",
          from: "system",
          to: "email-provider",
          description: "Delivers invitations and report notices",
          container: "worker",
        },
        {
          id: "system-domains",
          from: "system",
          to: "domain-provider",
          description: "Verifies domain ownership and TLS lifecycle",
          container: "api",
        },
        {
          id: "visitor-destination",
          from: "visitor",
          to: "destination",
          description: "Browser follows returned Location",
        },
        {
          id: "developer-system",
          from: "developer",
          to: "system",
          description: "Manages links through a tenant API key",
          container: "api",
        },
      ],
    },
    initialLayout,
  );
}

/** Fresh finite studio interpretation; historical factory and source contracts remain unchanged. */
import initialLayout from "./enterprise.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const ENTERPRISE_STUDIO_EXAMPLE = {
  id: "studio-enterprise-web",
  version: "1.0.0",
  name: "Enterprise · studio study",
  description:
    "Customer and staff browser apps, one domain API and independent order worker with owned/shared data and external providers.",
  goalManifestSha256: "00809a59e4a2c1458fdb8de7f7b9e15be78c4dea5aab4ec9c81973fbed6417b8",
} as const;

export function enterpriseStudioExample() {
  return createStudioStudy(
    ENTERPRISE_STUDIO_EXAMPLE,
    [
      {
        id: "web",
        name: "Customer web app",
        description: "Lets customers browse the catalog, check out and follow their orders.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "backoffice",
        name: "Back-office console",
        description:
          "Lets operations and finance staff fulfil orders, manage the catalog and reconcile payments.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "api",
        name: "Orders API",
        description:
          "Owns customers, catalog, orders and payment state behind one authorized HTTP contract.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
        },
      },
      {
        id: "worker",
        name: "Order worker",
        description:
          "Captures payments, sends notifications and reconciles settlements outside interactive requests.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "typescript",
        },
      },
      {
        id: "queue",
        name: "Order jobs",
        description: "Buffers fulfilment, payment and notification work for the worker.",
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
        id: "db",
        name: "Primary database",
        description: "Stores authoritative customers, catalog, orders, payments and audit records.",
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
        description:
          "Caches catalog reads and session lookups with bounded freshness and source fallback.",
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
        id: "storage",
        name: "Document storage",
        description: "Keeps invoices, export files and product images behind signed URLs.",
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
        id: "identity",
        name: "Identity provider",
        description:
          "Authenticates customers and staff and issues verified identities; staff use enterprise SSO.",
        settings: {
          kind: "external-api",
          category: "identity",
          provider: "external",
        },
      },
      {
        id: "billing",
        name: "Payment provider",
        description:
          "Authorizes, captures and refunds card payments and sends signed payment events.",
        settings: {
          kind: "external-api",
          category: "payments",
          provider: "external",
        },
      },
      {
        id: "email",
        name: "E-mail delivery provider",
        description: "Delivers transactional order messages without owning customer accounts.",
        settings: {
          kind: "external-api",
          category: "email",
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
          label: "Browses catalog, places and tracks orders",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "backoffice-api",
        from: "backoffice",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Fulfils orders and manages catalog",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "web-identity",
        from: "web",
        to: "identity",
        kind: "depends-on",
        planned: {
          label: "Signs customers in",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "backoffice-identity",
        from: "backoffice",
        to: "identity",
        kind: "depends-on",
        planned: {
          label: "Signs staff in with SSO",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "api-identity",
        from: "api",
        to: "identity",
        kind: "depends-on",
        planned: {
          label: "Validates access tokens",
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
          label: "Reads and writes orders, catalog and customers",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Private network",
        },
        settings: {},
      },
      {
        id: "api-cache",
        from: "api",
        to: "cache",
        kind: "depends-on",
        planned: {
          label: "Caches catalog and session lookups",
          protocol: "Redis",
          interaction: "Request / response",
          security: "Private network",
        },
        settings: {},
      },
      {
        id: "api-storage",
        from: "api",
        to: "storage",
        kind: "depends-on",
        planned: {
          label: "Stores invoices and product images",
          protocol: "HTTPS",
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
          label: "Enqueues order work",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Private network",
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
          label: "Delivers order jobs",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Private network",
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
          label: "Reads and writes order and payment state",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Private network",
        },
        settings: {},
      },
      {
        id: "worker-billing",
        from: "worker",
        to: "billing",
        kind: "depends-on",
        planned: {
          label: "Captures and refunds payments",
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
          label: "Delivers signed payment events",
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
          label: "Sends order confirmations and updates",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
    ],
    {
      system: {
        name: "Enterprise · studio study",
        description:
          "Customer and staff browser apps, one domain API and independent order worker with owned/shared data and external providers.",
      },
      nodes: [
        {
          id: "customer",
          kind: "person",
          name: "Customer",
          description: "Browses the catalog, places orders and follows their delivery.",
        },
        {
          id: "staff",
          kind: "person",
          name: "Operations staff",
          description: "Fulfils orders and maintains the product catalog.",
        },
        {
          id: "finance",
          kind: "person",
          name: "Finance team",
          description: "Reconciles payments and exports settlement reports.",
        },
        {
          id: "identity-provider",
          kind: "external-system",
          name: "Identity provider",
          description: "Authenticates customers and staff; staff sign in with enterprise SSO.",
          container: "identity",
        },
        {
          id: "payment-provider",
          kind: "external-system",
          name: "Payment provider",
          description: "Authorizes and captures card payments and reports settlements.",
          container: "billing",
        },
        {
          id: "email-provider",
          kind: "external-system",
          name: "E-mail delivery provider",
          description: "Delivers transactional order messages.",
          container: "email",
        },
      ],
      relationships: [
        {
          id: "customer-system",
          from: "customer",
          to: "system",
          description: "Browses the catalog and places orders",
          container: "web",
        },
        {
          id: "staff-system",
          from: "staff",
          to: "system",
          description: "Fulfils orders and manages the catalog",
          container: "backoffice",
        },
        {
          id: "finance-system",
          from: "finance",
          to: "system",
          description: "Reconciles payments and exports reports",
          container: "backoffice",
        },
        {
          id: "system-identity",
          from: "system",
          to: "identity-provider",
          description: "Authenticates customers and staff",
          container: "api",
        },
        {
          id: "system-payments",
          from: "system",
          to: "payment-provider",
          description: "Captures payments and receives payment events",
          container: "worker",
        },
        {
          id: "system-email",
          from: "system",
          to: "email-provider",
          description: "Sends order confirmations and updates",
          container: "worker",
        },
      ],
    },
    initialLayout,
  );
}

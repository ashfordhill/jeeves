/**
 * The default starting design: a conventional enterprise web application modeled at C1–C3.
 *
 * Customers order through a web app, operations staff fulfil through a back-office console, one
 * application API owns the domain, a worker handles asynchronous work, and three external
 * providers (identity, payments, e-mail) stay outside the system boundary. Every box is a planned
 * capability with an explicit proposed technology; nothing here claims a runtime exists.
 */
import type { Architecture, ArchitectureComponent } from "./architecture.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import type { LayoutDocument } from "./layout.ts";

export const ENTERPRISE_WEB_EXAMPLE = {
  id: "enterprise-web",
  name: "Enterprise web application",
  description:
    "Customer web app and staff console over one application API, a background worker, primary data, cache, object storage and external identity, payment and e-mail providers.",
  useCases: "Order management · customer portals · line-of-business applications",
  accent: "blue",
} as const;

type PlannedProtocol = NonNullable<DesignDocument["connections"][number]["planned"]>["protocol"];

export function enterpriseWebExample(): {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
} {
  const design = emptyDesign();
  const layout: LayoutDocument = { schemaVersion: 1, items: {} };

  const container = (
    id: string,
    planned: string,
    name: string,
    description: string,
    technology: string,
    config: Record<string, unknown> = {},
  ) =>
    design.elements.push({
      id,
      name,
      planned,
      template: null,
      config,
      attachments: [],
      notes: "",
      description,
      technology,
    });
  const link = (
    from: string,
    to: string,
    label: string,
    protocol: PlannedProtocol = "HTTPS/JSON",
    async = false,
    security:
      | "Service identity"
      | "User identity"
      | "Public"
      | "Private network" = "Service identity",
  ) =>
    design.connections.push({
      id: `${from}-${to}`,
      kind: "depends-on",
      from: { element: from },
      to: { element: to },
      planned: {
        label,
        protocol,
        interaction: async ? "Asynchronous" : "Request / response",
        security,
      },
    });

  // C2: clients
  container(
    "web",
    "browser-client",
    "Customer web app",
    "Lets customers browse the catalog, check out and follow their orders.",
    "React · TypeScript",
    { audience: "Customers", kind: "Single-page app", access: "Public + signed-in areas" },
  );
  container(
    "backoffice",
    "browser-client",
    "Back-office console",
    "Lets operations and finance staff fulfil orders, manage the catalog and reconcile payments.",
    "React · TypeScript",
    { audience: "Internal staff & admins", kind: "Single-page app", access: "Sign-in required" },
  );
  // C2: application
  container(
    "api",
    "application-api",
    "Orders API",
    "Owns customers, catalog, orders and payment state behind one authorized HTTP contract.",
    "Node.js · Fastify",
    { interface: "REST", state: "Stateless; shared stores" },
  );
  container(
    "worker",
    "background-worker",
    "Order worker",
    "Captures payments, sends notifications and reconciles settlements outside interactive requests.",
    "Node.js · TypeScript",
    { trigger: "Job queue", delivery: "At least once; idempotent handler", deadLetter: true },
  );
  container(
    "queue",
    "job-queue",
    "Order jobs",
    "Buffers fulfilment, payment and notification work for the worker.",
    "RabbitMQ",
  );
  // C2: data
  container(
    "db",
    "relational-store",
    "Primary database",
    "Stores authoritative customers, catalog, orders, payments and audit records.",
    "PostgreSQL",
    { engine: "PostgreSQL", topology: "Primary + read replicas" },
  );
  container(
    "cache",
    "distributed-cache",
    "Application cache",
    "Caches catalog reads and session lookups with bounded freshness and source fallback.",
    "Redis compatible",
    { engine: "Redis compatible", strategy: "Cache aside", failure: "Fall back to source" },
  );
  container(
    "storage",
    "object-storage",
    "Document storage",
    "Keeps invoices, export files and product images behind signed URLs.",
    "S3-compatible storage",
    { api: "S3 compatible", access: "Private; signed URLs", versioning: true },
  );
  // C2: external providers
  container(
    "identity",
    "identity-provider",
    "Identity provider",
    "Authenticates customers and staff and issues verified identities; staff use enterprise SSO.",
    "OpenID Connect provider",
    { method: "Enterprise SSO", mfa: "Required for admins" },
  );
  container(
    "billing",
    "third-party-service",
    "Payment provider",
    "Authorizes, captures and refunds card payments and sends signed payment events.",
    "Payment provider API",
    {
      category: "Payments",
      authentication: "API key",
      webhooks: true,
      dataShared: "Order reference, amount and customer identifier",
      unavailable: "Queue and retry",
    },
  );
  container(
    "email",
    "third-party-service",
    "E-mail delivery provider",
    "Delivers transactional order messages without owning customer accounts.",
    "E-mail provider API",
    {
      category: "E-mail delivery",
      authentication: "API key",
      dataShared: "Recipient address and message content",
      unavailable: "Queue and retry",
    },
  );

  // C2 relationships. Arrow direction is dependency direction; the label says what happens.
  link(
    "web",
    "api",
    "Browses catalog, places and tracks orders",
    "HTTPS/JSON",
    false,
    "User identity",
  );
  link(
    "backoffice",
    "api",
    "Fulfils orders and manages catalog",
    "HTTPS/JSON",
    false,
    "User identity",
  );
  link("web", "identity", "Signs customers in", "OIDC/HTTPS", false, "User identity");
  link("backoffice", "identity", "Signs staff in with SSO", "OIDC/HTTPS", false, "User identity");
  link("api", "identity", "Validates access tokens", "OIDC/HTTPS");
  link(
    "api",
    "db",
    "Reads and writes orders, catalog and customers",
    "SQL",
    false,
    "Private network",
  );
  link("api", "cache", "Caches catalog and session lookups", "RESP/TLS", false, "Private network");
  link("api", "storage", "Stores invoices and product images", "HTTPS/S3");
  link("api", "queue", "Enqueues order work", "AMQP/TLS", true, "Private network");
  link("queue", "worker", "Delivers order jobs", "AMQP/TLS", true, "Private network");
  link("worker", "db", "Reads and writes order and payment state", "SQL", false, "Private network");
  link("worker", "billing", "Captures and refunds payments");
  link("billing", "api", "Delivers signed payment events", "HTTPS/JSON", true);
  link("worker", "email", "Sends order confirmations and updates", "HTTPS");

  // C3 components. One component is one cohesive responsibility, never one endpoint.
  const components: ArchitectureComponent[] = [];
  const relationships: NonNullable<Architecture["componentRelationships"]> = [];
  const component = (
    id: string,
    element: string,
    name: string,
    capability: string,
    responsibility: string,
    usesConnections: string[],
    config: Record<string, unknown> = {},
  ) =>
    components.push({
      id,
      element,
      name,
      capability,
      responsibility,
      technology: ["screen-group", "client-session", "api-facade"].includes(capability)
        ? "React · TypeScript"
        : "TypeScript module",
      config,
      members: [],
      usesConnections,
      usesResources: [],
    });
  const relate = (from: string, to: string, description: string, async = false) =>
    relationships.push({
      id: `${from}-${to}`,
      from,
      to,
      description,
      protocol: "In process",
      interaction: async ? "Asynchronous" : "Request / response",
    });

  // Orders API
  component(
    "auth",
    "api",
    "Authentication & authorization",
    "authorization-module",
    "Validates identities from the identity provider and enforces customer and staff permissions.",
    ["api-identity", "api-cache"],
    { policy: "Roles + permissions", audit: true },
  );
  component(
    "customers",
    "api",
    "Customers & accounts",
    "domain-module",
    "Owns customer profiles, addresses and account preferences.",
    ["api-db"],
    { owns: "Customers and addresses", access: "Authenticated owner" },
  );
  component(
    "catalog",
    "api",
    "Product catalog",
    "domain-module",
    "Owns products, prices and availability; serves cached catalog reads.",
    ["api-db", "api-cache", "api-storage"],
    { owns: "Products, prices and stock levels", access: "Public read" },
  );
  component(
    "orders",
    "api",
    "Order management",
    "domain-module",
    "Creates orders, tracks their lifecycle and hands asynchronous work to the queue.",
    ["api-db", "api-queue"],
    {
      owns: "Orders and order lines",
      operations: "Place, amend, cancel, fulfil",
      events: "OrderPlaced, OrderPaid, OrderShipped",
    },
  );
  component(
    "payments",
    "api",
    "Payment events",
    "integration-adapter",
    "Verifies signed payment events from the provider and applies outcomes to orders.",
    ["billing-api", "api-db"],
    { target: "Payment provider webhooks", verifyWebhooks: true },
  );
  component(
    "documents",
    "api",
    "Invoices & documents",
    "reports-module",
    "Renders invoices and exports and stores them for signed download.",
    ["api-storage"],
    { formats: "PDF, CSV", asyncGeneration: true },
  );
  component(
    "audit",
    "api",
    "Audit log",
    "audit-log-module",
    "Records who changed orders, catalog and customer data, and when.",
    ["api-db"],
    { actions: "Order, catalog and customer changes", access: "Admins only" },
  );
  relate("auth", "orders", "Authorizes order operations");
  relate("auth", "catalog", "Authorizes catalog changes");
  relate("orders", "customers", "Resolves the ordering customer");
  relate("orders", "catalog", "Validates items, prices and availability");
  relate("orders", "documents", "Requests the order invoice");
  relate("orders", "audit", "Records order changes");
  relate("payments", "orders", "Applies payment outcomes");

  // Order worker
  component(
    "fulfilment",
    "worker",
    "Order fulfilment jobs",
    "event-handlers-module",
    "Consumes order jobs idempotently and advances order state.",
    ["queue-worker", "worker-db"],
    {
      events: "OrderPlaced, OrderPaid",
      idempotency: "Order and job identifiers",
      deadLetter: true,
    },
  );
  component(
    "capture",
    "worker",
    "Payment capture",
    "integration-adapter",
    "Captures and refunds payments with the provider and records the result.",
    ["worker-billing", "worker-db"],
    { target: "Payment provider API", retries: 3 },
  );
  component(
    "notify",
    "worker",
    "Order notifications",
    "notifications-module",
    "Sends confirmation, shipping and refund messages according to customer preferences.",
    ["worker-email"],
    { channels: "Email", preferences: true },
  );
  component(
    "reconcile",
    "worker",
    "Settlement reconciliation",
    "scheduled-jobs-module",
    "Compares provider settlements with recorded payments every night and flags mismatches.",
    ["worker-billing", "worker-db"],
    { schedule: "Nightly 02:00", overlap: "Skip while running" },
  );
  relate("fulfilment", "capture", "Captures payment before dispatch");
  relate("fulfilment", "notify", "Sends order status updates", true);
  relate("reconcile", "notify", "Reports settlement mismatches", true);

  // Customer web app
  component(
    "shell",
    "web",
    "App shell & routing",
    "screen-group",
    "Hosts navigation, layout and route-level loading for every customer screen.",
    [],
    { pages: "Home, catalog, checkout, orders, account", access: "Public" },
  );
  component(
    "session",
    "web",
    "Customer session",
    "client-session",
    "Signs customers in through the identity provider and keeps access tokens fresh.",
    ["web-identity"],
    { identity: "OIDC provider", expiry: "Return to public area" },
  );
  component(
    "shop",
    "web",
    "Catalog & checkout screens",
    "screen-group",
    "Presents products, the basket and checkout.",
    [],
    { pages: "Catalog, product, basket, checkout", access: "Public" },
  );
  component(
    "account",
    "web",
    "Orders & account screens",
    "screen-group",
    "Shows order history, tracking and profile settings.",
    [],
    { pages: "Orders, order detail, profile", access: "Signed-in" },
  );
  component(
    "client",
    "web",
    "Orders API client",
    "api-facade",
    "Maps the Orders API contract to typed calls with consistent error handling.",
    ["web-api"],
    { target: "Orders API", transport: "HTTPS/JSON", errors: "Typed errors" },
  );
  relate("shell", "session", "Gates signed-in areas");
  relate("shell", "shop", "Routes to shopping screens");
  relate("shell", "account", "Routes to account screens");
  relate("shop", "client", "Loads catalog and submits orders");
  relate("account", "client", "Loads order history");
  relate("session", "client", "Attaches access tokens");

  // Back-office console
  component(
    "staff-session",
    "backoffice",
    "Staff session (SSO)",
    "client-session",
    "Signs staff in through enterprise SSO and exposes their roles to the screens.",
    ["backoffice-identity"],
    { identity: "OIDC provider", roles: "Operations, finance, admin", expiry: "Prompt sign-in" },
  );
  component(
    "staff-screens",
    "backoffice",
    "Fulfilment & catalog screens",
    "screen-group",
    "Order queues, fulfilment actions, catalog editing and payment reconciliation views.",
    [],
    { pages: "Order queue, order detail, catalog, reconciliation", access: "Admin" },
  );
  component(
    "staff-client",
    "backoffice",
    "Orders API client",
    "api-facade",
    "Calls staff operations on the Orders API with the signed-in staff identity.",
    ["backoffice-api"],
    { target: "Orders API", transport: "HTTPS/JSON", errors: "Typed errors" },
  );
  relate("staff-session", "staff-screens", "Supplies roles to screens");
  relate("staff-screens", "staff-client", "Executes staff operations");
  relate("staff-session", "staff-client", "Attaches access tokens");

  design.architecture = {
    system: {
      name: "Orders platform",
      description:
        "Customers place orders online; operations staff fulfil them and finance reconciles payments.",
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
    components,
    componentRelationships: relationships,
    scenarios: [
      {
        id: "place-order",
        name: "Customer places an order",
        scope: { level: "containers" },
        steps: [
          {
            id: "place-1",
            relationship: { kind: "connection", id: "web-api" },
            text: "The signed-in customer submits the basket from checkout.",
          },
          {
            id: "place-2",
            relationship: { kind: "connection", id: "api-db" },
            text: "Order management validates items and prices and saves the order as placed.",
          },
          {
            id: "place-3",
            relationship: { kind: "connection", id: "api-queue" },
            text: "An order job is enqueued; the customer sees the order immediately.",
          },
          {
            id: "place-4",
            relationship: { kind: "connection", id: "queue-worker" },
            text: "The worker consumes the job idempotently.",
          },
          {
            id: "place-5",
            relationship: { kind: "connection", id: "worker-billing" },
            text: "Payment capture charges the authorized card.",
          },
          {
            id: "place-6",
            relationship: { kind: "connection", id: "worker-email" },
            text: "A confirmation e-mail is sent once payment succeeds.",
          },
        ],
      },
      {
        id: "payment-event",
        name: "Provider reports a payment outcome",
        scope: { level: "containers" },
        steps: [
          {
            id: "event-1",
            relationship: { kind: "connection", id: "billing-api" },
            text: "The provider posts a signed payment event; the signature is verified before use.",
          },
          {
            id: "event-2",
            relationship: { kind: "connection", id: "api-db" },
            text: "The matching order is marked paid or failed exactly once.",
          },
          {
            id: "event-3",
            relationship: { kind: "connection", id: "api-queue" },
            text: "A follow-up job notifies the customer and releases fulfilment.",
          },
        ],
      },
    ],
  };

  // Authored C2 positions: clients, application and data in three rows; providers on the right.
  const rows: string[][] = [
    ["web", "backoffice", "identity"],
    ["api", "queue", "worker", "billing"],
    ["db", "cache", "storage", "email"],
  ];
  for (const [rowIndex, row] of rows.entries())
    for (const [column, id] of row.entries())
      layout.items[id] = { x: column * 460 + 40, y: rowIndex * 330 + 40 };
  layout.architecture = {
    "focus-ordering": {
      name: "Ordering path",
      members: [
        "container:web",
        "container:api",
        "container:db",
        "container:queue",
        "container:worker",
      ],
      includeDependencies: false,
      positions: {},
    },
    "focus-integrations": {
      name: "External providers",
      members: [
        "container:api",
        "container:worker",
        "container:identity",
        "container:billing",
        "container:email",
      ],
      includeDependencies: false,
      positions: {},
    },
  };
  return { name: ENTERPRISE_WEB_EXAMPLE.name, design, layout };
}

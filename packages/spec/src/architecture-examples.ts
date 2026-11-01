/** Editable planning examples, not assertions about the internals of any named company. */
import type { Architecture, ArchitectureComponent } from "./architecture.ts";
import { architectureProof } from "./architecture-proofs.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { ENTERPRISE_WEB_EXAMPLE, enterpriseWebExample } from "./enterprise-web-example.ts";
import type { LayoutDocument } from "./layout.ts";
import { MATTERMOST_EXAMPLE, mattermostExample } from "./mattermost-example.ts";
import { VIDEO_PLATFORM_EXAMPLE, videoPlatformExample } from "./video-platform-example.ts";

/** The first entry is the default starting design for a new Jeeves installation. */
export const architectureExamples = [
  MATTERMOST_EXAMPLE,
  VIDEO_PLATFORM_EXAMPLE,
  ENTERPRISE_WEB_EXAMPLE,
  {
    id: "qrwty-target",
    name: "QRWTY target architecture",
    description:
      "A planned SaaS for teams to manage QR links, artwork, billing and visit analytics.",
    useCases: "Target architecture · editable study · separate from live QRWTY",
    accent: "teal",
  },
  {
    id: "link-platform",
    name: "Links & QR platform",
    description:
      "A management plane, fast redirect path, cached lookups and asynchronous analytics.",
    useCases: "Short links · QR products · campaign tools",
    accent: "cyan",
  },
  {
    id: "community",
    name: "Community & discussion",
    description:
      "Communities, posts and comments with moderation, discovery and background notifications.",
    useCases: "Forums · knowledge communities · discussion SaaS",
    accent: "violet",
  },
  {
    id: "social",
    name: "Social & content platform",
    description:
      "Profiles, a social graph, feeds and media with independent processing and delivery.",
    useCases: "Social networks · creator platforms · activity feeds",
    accent: "orange",
  },
] as const;

export function architectureExample(id: string): {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
} {
  if (id === MATTERMOST_EXAMPLE.id) return mattermostExample();
  if (id === VIDEO_PLATFORM_EXAMPLE.id) return videoPlatformExample();
  if (id === ENTERPRISE_WEB_EXAMPLE.id) return enterpriseWebExample();
  return id === "qrwty-target" ? architectureProof("qrwty") : legacyArchitectureExample(id);
}

/** Historical P43/P45 fixture retained for lossless migration and authoring regression checks. */
export function legacyArchitectureExample(id: string): {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
} {
  const example = architectureExamples.find((entry) => entry.id === id);
  if (!example) throw new Error("Unknown architecture example");
  const design = emptyDesign();
  const layout: LayoutDocument = { schemaVersion: 1, items: {} };
  const add = (
    id: string,
    planned: string,
    name: string,
    description: string,
    technology: string,
    config: Record<string, unknown> = {},
  ) => {
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
  };
  const link = (
    from: string,
    to: string,
    label: string,
    protocol: NonNullable<
      DesignDocument["connections"][number]["planned"]
    >["protocol"] = "HTTPS/JSON",
    async = false,
  ) => {
    design.connections.push({
      id: `${from}-${to}`,
      kind: "depends-on",
      from: { element: from },
      to: { element: to },
      planned: {
        label,
        protocol,
        interaction: async ? "Asynchronous" : "Request / response",
        security: "Service identity",
      },
    });
  };
  add(
    "web",
    "browser-client",
    id === "qrwty-target" ? "Owner web app" : "Web application",
    "Creates and manages content through a signed-in browser experience.",
    "React · TypeScript",
    { audience: "Customers" },
  );
  add(
    "api",
    "application-api",
    "Application API",
    "Owns account access, domain operations and application contracts.",
    "Node.js · Fastify",
  );
  add(
    "db",
    "relational-store",
    "Primary data",
    "Stores authoritative accounts, ownership and domain records.",
    "PostgreSQL",
  );
  add(
    "cache",
    "distributed-cache",
    id === "qrwty-target" ? "Lookup cache" : "Application cache",
    "Caches derived lookups with bounded freshness and source fallback.",
    "Redis compatible",
  );
  add(
    "queue",
    "job-queue",
    id === "qrwty-target" ? "Visit queue" : "Background jobs",
    "Buffers visit events and background tasks for independent processing.",
    "RabbitMQ",
  );
  add(
    "worker",
    "background-worker",
    id === "qrwty-target" ? "Analytics worker" : "Background worker",
    "Processes queued work and scheduled tasks outside interactive requests.",
    "Node.js · TypeScript",
  );
  link("web", "api", "Uses application API");
  link("api", "db", "Reads / writes records", "SQL");
  link("api", "cache", "Caches derived reads", "RESP/TLS");
  link("api", "queue", "Enqueues work", "AMQP/TLS", true);
  link("queue", "worker", "Delivers jobs", "AMQP/TLS", true);
  link("worker", "db", "Reads / writes task data", "SQL");
  const components: ArchitectureComponent[] = [];
  const componentRelationships: NonNullable<Architecture["componentRelationships"]> = [];
  const component = (
    id: string,
    element: string,
    name: string,
    capability: string,
    responsibility: string,
    config: Record<string, unknown> = {},
    usesConnections: string[] = [],
  ) =>
    components.push({
      id,
      element,
      name,
      capability,
      responsibility,
      technology: capability === "screen-group" ? "React · TypeScript" : "TypeScript module",
      config,
      members: [],
      usesConnections,
      usesResources: [],
    });
  component(
    "accounts",
    "api",
    "Accounts & access",
    "authorization-module",
    "Owns account access and tenant permissions.",
    {},
    ["api-db"],
  );
  if (id === "link-platform" || id === "qrwty-target") {
    add(
      "redirect",
      "application-api",
      "Redirect service",
      "Resolves public short links independently of management requests.",
      "Node.js · Fastify",
    );
    add(
      "assets",
      "object-storage",
      "Artwork storage",
      "Versions QR artwork and generated export objects.",
      "S3-compatible storage",
    );
    link("redirect", "cache", "Looks up destinations", "RESP/TLS");
    link("redirect", "db", "Reads on cache miss", "SQL");
    link("redirect", "queue", "Records visit events", "AMQP/TLS", true);
    link("api", "assets", "Stores artwork", "HTTPS/S3");
    component(
      "links",
      "api",
      "Link management",
      "domain-module",
      "Creates links, changes destinations and manages ownership.",
      { owns: "Links and campaigns", operations: "Create, update, archive" },
      ["api-db"],
    );
    component(
      "artwork",
      "api",
      "QR artwork",
      "media-module",
      "Previews and versions QR artwork without changing link identity.",
      {},
      ["api-assets"],
    );
    component(
      "analytics",
      "api",
      "Analytics queries",
      "analytics-module",
      "Reads aggregates with explicit freshness and retention.",
      {},
      ["api-db"],
    );
    component(
      "resolution",
      "redirect",
      "Destination lookup",
      "domain-module",
      "Resolves a stable link identity to its current destination.",
      { access: "Public read" },
      ["redirect-cache", "redirect-db"],
    );
    component(
      "visits",
      "redirect",
      "Visit capture",
      "analytics-module",
      "Records request events for later aggregation.",
      {},
      ["redirect-queue"],
    );
    component(
      "aggregation",
      "worker",
      "Visit aggregation",
      "analytics-module",
      "Processes visit events into queryable aggregates.",
      {},
      ["queue-worker", "worker-db"],
    );
  } else {
    add(
      "search",
      "search-index",
      "Discovery index",
      "Indexes public content for access-filtered discovery.",
      "OpenSearch",
    );
    add(
      "assets",
      "object-storage",
      "Media storage",
      "Retains source media and derived delivery variants.",
      "S3-compatible storage",
    );
    link("api", "search", "Searches public content");
    link("worker", "assets", "Processes media", "HTTPS/S3");
    component(
      "content",
      "api",
      id === "community" ? "Posts & discussions" : "Posts & profiles",
      "domain-module",
      "Owns content, revisions and visibility rules.",
      { owns: "Posts, comments and profiles", operations: "Publish, edit, reply, archive" },
      ["api-db"],
    );
    component(
      "feed",
      "api",
      id === "community" ? "Community discovery" : "Feed & social graph",
      "feed-module",
      "Builds bounded content listings for the current audience.",
      {},
      ["api-cache", "api-search"],
    );
    component(
      "moderation",
      "api",
      "Moderation",
      "moderation-module",
      "Handles reports and records review decisions.",
      {},
      ["api-db"],
    );
    component(
      "media",
      "worker",
      "Media processing",
      "media-module",
      "Validates media and produces delivery variants.",
      {},
      ["worker-assets"],
    );
    if (id === "social") {
      add(
        "mobile",
        "mobile-client",
        "Mobile application",
        "Provides mobile publishing, feeds and cached reading.",
        "React Native · TypeScript",
      );
      add(
        "realtime",
        "realtime-service",
        "Realtime updates",
        "Distributes authorized presence and activity updates.",
        "Node.js · WebSocket",
      );
      link("mobile", "api", "Uses shared API");
      link("web", "realtime", "Receives updates", "WebSocket");
      component(
        "mobile-facade",
        "mobile",
        "Mobile API facade",
        "api-facade",
        "Maps shared API contracts to mobile publishing and feed features.",
        {},
        ["mobile-api"],
      );
      component(
        "mobile-state",
        "mobile",
        "Offline reading",
        "local-state",
        "Retains cached feed entries for mobile reading.",
        { sync: "Read cached content", data: "Recent feed entries" },
        ["mobile-api"],
      );
      component(
        "presence",
        "realtime",
        "Presence & activity",
        "domain-module",
        "Distributes authorized live updates to connected clients.",
        {},
        ["web-realtime"],
      );
    } else {
      add(
        "notifications",
        "notification-service",
        "Notifications",
        "Composes subscription messages and respects delivery preferences.",
        "Node.js · TypeScript",
      );
      link("worker", "notifications", "Delivers subscriptions", "HTTPS", true);
      // The delivery adapter is modeled after providers are added below.
      component(
        "communities",
        "api",
        "Communities & membership",
        "domain-module",
        "Owns membership, roles and community settings.",
        { owns: "Communities and memberships" },
        ["api-db"],
      );
    }
  }
  add(
    "billing",
    "third-party-service",
    "Payment provider",
    "Processes subscriptions and sends signed billing events.",
    "Payment provider API",
    {
      category: "Payments",
      webhooks: true,
      dataShared: "Customer identity and subscription reference",
    },
  );
  add(
    "email",
    "third-party-service",
    "E-mail delivery provider",
    "Delivers transactional messages without owning application accounts.",
    "E-mail provider API",
    {
      category: "E-mail delivery",
      unavailable: "Queue and retry",
      dataShared: "Recipient and message content",
    },
  );
  add(
    "edge",
    "edge-delivery",
    "CDN & edge",
    "Delivers static application assets and public artwork; redirects remain uncached.",
    "HTTPS CDN",
  );
  add(
    "telemetry",
    "observability",
    "Observability",
    "Collects redacted service logs, metrics and traces.",
    "OpenTelemetry collector",
  );
  link("api", "billing", "Synchronizes plans and subscriptions");
  link("billing", "api", "Delivers signed billing events", "HTTPS/JSON", true);
  link("worker", "email", "Delivers transactional messages");
  link("edge", "web", "Loads application assets", "HTTPS");
  link("edge", "assets", "Loads public artwork and media", "HTTPS/S3");
  link("api", "telemetry", "Exports redacted telemetry", "OTLP/HTTPS", true);
  link("worker", "telemetry", "Exports job metrics and traces", "OTLP/HTTPS", true);
  if (id === "community") {
    link("notifications", "email", "Sends subscription messages");
    component(
      "subscription-delivery",
      "notifications",
      "Subscription messages",
      "notifications-module",
      "Applies subscriber preferences and sends discussion updates.",
      {},
      ["worker-notifications", "notifications-email"],
    );
  }
  if (id !== "qrwty-target") {
    add(
      "identity",
      "identity-provider",
      "Identity provider",
      "Authenticates members and supplies verified sign-in identities.",
      "OpenID Connect provider",
    );
    link("web", "identity", "Authenticates members", "OIDC/HTTPS");
    link("api", "identity", "Validates member identities", "OIDC/HTTPS");
    component(
      "billing-plans",
      "api",
      "Billing & plans",
      "billing-module",
      "Synchronizes subscriptions and evaluates feature entitlements.",
      {},
      ["api-billing", "billing-api", "api-db"],
    );
    component(
      "delivery",
      "worker",
      "Notification delivery",
      "notifications-module",
      "Delivers preference-aware transactional messages.",
      {},
      ["worker-email"],
    );
    component(
      "client-features",
      "web",
      "Content workspace",
      "screen-group",
      "Presents content management and discovery screens.",
      {
        pages: "Library, editor, discovery, settings",
        access: "Signed-in",
        dataUsed: "Owned and public content",
      },
      ["web-api"],
    );
  }
  if (id === "qrwty-target") {
    add(
      "admin",
      "browser-client",
      "Admin console",
      "Lets authorized staff investigate accounts and manage support actions.",
      "React · TypeScript",
      { audience: "Internal staff & admins", access: "Sign-in required" },
    );
    add(
      "analytics-data",
      "analytics-store",
      "Analytics store",
      "Retains aggregate visit metrics for customer reports.",
      "ClickHouse",
      { load: "Micro-batch", access: "Customer-facing reports", retention: 90 },
    );
    link("admin", "api", "Manages support and staff operations");
    link("api", "analytics-data", "Queries aggregate visit reports", "HTTPS/SQL");
    link("worker", "analytics-data", "Reads reports and writes visit aggregates", "HTTPS/SQL");
    link("worker", "assets", "Stores scheduled exports", "HTTPS/S3");
    link("redirect", "telemetry", "Exports redirect metrics", "OTLP/HTTPS", true);
    // The visitor browser follows Location; the redirect service never fetches the destination.
    component(
      "organizations",
      "api",
      "Organizations & members",
      "organizations-module",
      "Owns team membership, invitations and organization roles.",
      { teams: "Organizations with shared link libraries" },
      [],
    );
    component(
      "billing-plans",
      "api",
      "Billing & plans",
      "billing-module",
      "Synchronizes plans and evaluates team entitlements.",
      { plans: "Free, Pro, Team", entitlements: "Team seats, link limits, exports" },
      ["api-billing", "billing-api"],
    );
    component(
      "developer-access",
      "api",
      "Developer API & webhooks",
      "developer-api-module",
      "Authenticates API keys and queues versioned outbound webhook work.",
      {},
      [],
    );
    component(
      "notification-adapter",
      "api",
      "Notifications adapter",
      "integration-adapter",
      "Maps account and team events into queued delivery requests.",
      {
        target: "E-mail delivery provider via worker",
        mapping: "Invitation and account event to message job",
      },
      ["api-queue"],
    );
    component(
      "exports",
      "worker",
      "Scheduled exports",
      "reports-module",
      "Builds scheduled visit reports and stores expiring downloads.",
      { formats: "CSV, JSON", retention: 7 },
      ["worker-analytics-data", "worker-assets"],
    );
    component(
      "delivery",
      "worker",
      "Notification delivery",
      "notifications-module",
      "Delivers invitation, account and report-ready messages.",
      { templates: "Invitation, account verification, report ready" },
      ["worker-email"],
    );
    for (const [key, name, pages, access, dataUsed] of [
      [
        "entry",
        "Public landing & sign-in",
        "Landing, sign-in, registration",
        "Public",
        "Account session",
      ],
      ["library", "Library & create", "Library, create link", "Signed-in", "Links and teams"],
      ["studio", "Studio", "QR studio, artwork versions", "Signed-in", "Link identity and artwork"],
      [
        "analytics",
        "Analytics",
        "Visit overview, report downloads",
        "Signed-in",
        "Aggregate visits and exports",
      ],
      [
        "settings",
        "Settings & billing",
        "Team settings, members, billing",
        "Signed-in",
        "Membership, plans, entitlements",
      ],
    ])
      component(
        `owner-${key}`,
        "web",
        name!,
        "screen-group",
        `Presents ${pages!.toLowerCase()} for link owners.`,
        { pages, access, dataUsed },
        ["web-api"],
      );
    component(
      "staff-screens",
      "admin",
      "Support & administration",
      "screen-group",
      "Presents audited account and subscription support actions.",
      {
        pages: "Account lookup, support actions, billing review",
        access: "Admin",
        dataUsed: "Accounts and subscriptions",
      },
      ["admin-api"],
    );
    for (const [from, to, description] of [
      ["organizations", "accounts", "Resolves member access"],
      ["developer-access", "links", "Executes link operations"],
      ["billing-plans", "organizations", "Resolves billing organization"],
    ])
      componentRelationships.push({
        id: `${from}-${to}`,
        from: from!,
        to: to!,
        description: description!,
        protocol: "In process",
        interaction: "Request / response",
      });
    components.find((c) => c.id === "accounts")!.name = "Accounts & sessions";
    components.find((c) => c.id === "accounts")!.usesConnections = ["api-db"];
    components.find((c) => c.id === "analytics")!.usesConnections = ["api-analytics-data"];
    components.find((c) => c.id === "aggregation")!.usesConnections = [
      "queue-worker",
      "worker-analytics-data",
    ];
  }
  design.architecture = {
    system: { name: example.name, description: example.description },
    nodes: [
      {
        id: "member",
        kind: "person",
        name: id === "qrwty-target" ? "Link owner" : "Member",
        description: "Creates and manages owned content.",
      },
      {
        id: "visitor",
        kind: "person",
        name: id === "qrwty-target" ? "QR visitor" : "Visitor",
        description: "Browses public content or follows a shared link.",
      },
      ...(id === "qrwty-target"
        ? [
            {
              id: "team-admin",
              kind: "person" as const,
              name: "Team administrator",
              description: "Manages team membership and subscriptions.",
            },
            {
              id: "destination",
              kind: "external-system" as const,
              name: "Destination website",
              description: "Receives the visitor after their browser follows a redirect.",
            },
          ]
        : []),
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
        description:
          id === "link-platform" || id === "qrwty-target"
            ? "Follows a short link"
            : "Browses public content",
        container: id === "link-platform" || id === "qrwty-target" ? "redirect" : "web",
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
      ...(id === "qrwty-target"
        ? [
            {
              id: "team-system",
              from: "team-admin",
              to: "system",
              description: "Manages team members and billing",
              container: "web",
            },
            {
              id: "visitor-destination",
              from: "visitor",
              to: "destination",
              description: "Follows the returned destination in their browser",
            },
          ]
        : []),
    ],
    components,
    ...(id === "qrwty-target"
      ? {
          scenarios: [
            {
              id: "visitor-qr",
              name: "Visitor follows a QR",
              scope: { level: "containers" as const },
              steps: [
                {
                  id: "qr-step-1",
                  relationship: { kind: "connection" as const, id: "redirect-cache" },
                  text: "A visitor opens the scanned short URL; the redirect service looks up its destination.",
                },
                {
                  id: "qr-step-2",
                  relationship: { kind: "connection" as const, id: "redirect-db" },
                  text: "On a cache miss, read the saved destination from primary data.",
                },
                {
                  id: "qr-step-3",
                  relationship: { kind: "connection" as const, id: "redirect-queue" },
                  text: "Queue a visit event and return the destination. The visitor browser follows it; the service does not fetch it.",
                },
                {
                  id: "qr-step-4",
                  relationship: { kind: "connection" as const, id: "queue-worker" },
                  text: "The analytics worker consumes the visit asynchronously.",
                },
                {
                  id: "qr-step-5",
                  relationship: { kind: "connection" as const, id: "worker-analytics-data" },
                  text: "Write aggregate visit metrics for later reporting.",
                },
              ],
            },
            {
              id: "owner-link",
              name: "Owner creates a link",
              scope: { level: "containers" as const },
              steps: [
                {
                  id: "qr-step-6",
                  relationship: { kind: "connection" as const, id: "web-api" },
                  text: "The signed-in owner submits a destination and alias from Library & create.",
                },
                {
                  id: "qr-step-7",
                  relationship: { kind: "connection" as const, id: "api-db" },
                  text: "Validate ownership and save the new link in primary data.",
                },
                {
                  id: "qr-step-8",
                  relationship: { kind: "connection" as const, id: "web-api" },
                  text: "Return the saved short URL to the owner's library.",
                },
              ],
            },
          ],
        }
      : {}),
    ...(componentRelationships.length ? { componentRelationships } : {}),
  };
  // Tags describe proposed choices. No example claims these technologies run today.
  // Compact authored rows keep the editable board manageable; derived geometry stays unsaved.
  let internal = 0;
  for (const element of design.elements) {
    layout.items[element.id] = {
      x: (internal % 3) * 420 + 40,
      y: Math.floor(internal / 3) * 310 + 40,
    };
    if (
      !["third-party-service", "identity-provider", "edge-delivery", "observability"].includes(
        element.planned!,
      )
    )
      internal++;
  }
  if (id === "qrwty-target")
    layout.architecture = {
      "focus-management": {
        name: "Management",
        members: [
          "container:web",
          "container:api",
          "container:db",
          "container:assets",
          "context:member",
        ],
        includeDependencies: false,
        positions: {},
      },
      "focus-redirect": {
        name: "Public redirect",
        members: ["container:redirect"],
        includeDependencies: true,
        positions: {},
      },
      "focus-analytics": {
        name: "Analytics",
        members: [
          "container:redirect",
          "container:queue",
          "container:worker",
          "container:analytics-data",
        ],
        includeDependencies: false,
        positions: {},
      },
    };
  return { name: example.name, design, layout };
}

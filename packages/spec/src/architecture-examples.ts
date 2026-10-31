/** Editable planning examples, not assertions about the internals of any named company. */
import type { ArchitectureComponent } from "./architecture.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import type { LayoutDocument } from "./layout.ts";

export const architectureExamples = [
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
  const example = architectureExamples.find((entry) => entry.id === id);
  if (!example) throw new Error("Unknown architecture example");
  const design = emptyDesign();
  const layout: LayoutDocument = { schemaVersion: 1, items: {} };
  const add = (id: string, planned: string, name: string, x: number, y: number, notes = "") => {
    design.elements.push({ id, name, planned, template: null, config: {}, attachments: [], notes });
    layout.items[id] = { x, y };
  };
  const link = (
    from: string,
    to: string,
    label: string,
    protocol: NonNullable<DesignDocument["connections"][number]["planned"]>["protocol"] = "HTTPS",
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
  add("web", "browser-client", "Web application", 40, 40);
  add("api", "application-api", "Application API", 420, 40);
  add("db", "relational-store", "Primary data", 800, 40);
  add("cache", "distributed-cache", "Application cache", 800, 310);
  add("queue", "job-queue", "Background jobs", 420, 580);
  add("worker", "background-worker", "Background worker", 800, 580);
  link("web", "api", "Uses application API");
  link("api", "db", "Reads / writes records", "SQL");
  link("api", "cache", "Caches derived reads", "Cache protocol");
  link("api", "queue", "Enqueues work", "Message protocol", true);
  link("queue", "worker", "Delivers jobs", "Message protocol", true);
  link("worker", "db", "Reads / writes task data", "SQL");
  const components: ArchitectureComponent[] = [];
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
  );
  if (id === "link-platform") {
    add(
      "redirect",
      "application-api",
      "Redirect service",
      40,
      310,
      "Resolves public short links independently of management requests.",
    );
    add("assets", "object-storage", "Artwork storage", 1180, 40);
    link("redirect", "cache", "Looks up destinations", "Cache protocol");
    link("redirect", "db", "Reads on cache miss", "SQL");
    link("redirect", "queue", "Records visit events", "Message protocol", true);
    link("api", "assets", "Stores artwork", "Object API");
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
    );
  } else {
    add("search", "search-index", "Discovery index", 1180, 40);
    add("assets", "object-storage", "Media storage", 1180, 580);
    link("api", "search", "Searches public content");
    link("worker", "assets", "Processes media", "Object API");
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
      add("mobile", "mobile-client", "Mobile application", 40, 580);
      add("realtime", "realtime-service", "Realtime updates", 40, 310);
      link("mobile", "api", "Uses shared API");
      link("web", "realtime", "Receives updates", "WebSocket");
      component(
        "presence",
        "realtime",
        "Presence & activity",
        "domain-module",
        "Distributes authorized live updates to connected clients.",
      );
    } else {
      add("notifications", "notification-service", "Notifications", 1180, 310);
      link("worker", "notifications", "Delivers subscriptions", "HTTPS", true);
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
  design.architecture = {
    system: { name: example.name, description: example.description },
    nodes: [
      {
        id: "member",
        kind: "person",
        name: "Member",
        description: "Creates and manages their content.",
      },
      {
        id: "visitor",
        kind: "person",
        name: "Visitor",
        description: "Browses or follows publicly available content.",
      },
    ],
    relationships: [
      {
        id: "member-system",
        from: "member",
        to: "system",
        description: "Manages content",
        container: "web",
      },
      {
        id: "visitor-system",
        from: "visitor",
        to: "system",
        description: id === "link-platform" ? "Follows a short link" : "Browses public content",
        container: id === "link-platform" ? "redirect" : "web",
      },
    ],
    components,
  };
  return { name: example.name, design, layout };
}

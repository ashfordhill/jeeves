/** A YouTube-style product study, not a claim about YouTube's private architecture. */
import type { Architecture, ArchitectureComponent } from "./architecture.ts";
import type { RelationshipPolicies } from "./architecture-bindings.ts";
import type { ArchitectureContract, ContractOwner } from "./architecture-contracts.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import type { LayoutDocument } from "./layout.ts";

export const VIDEO_PLATFORM_EXAMPLE = {
  id: "video-platform",
  name: "Streamly · video platform",
  description:
    "A YouTube-style design: public discovery and playback, creator uploads, asynchronous media processing, moderation and edge delivery. Includes capacity targets and failure scenarios.",
  useCases: "High traffic · media processing · cache freshness · 6 focused views",
  accent: "violet",
} as const;

export function videoPlatformExample(): {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
} {
  const design = emptyDesign();
  const layout: LayoutDocument = { schemaVersion: 1, items: {}, architecture: {} };
  const model: Architecture = {
    system: {
      name: "Streamly",
      description:
        "Viewers discover and watch video. Creators publish a channel library. Trust & safety staff review content and enforce access. A design study inspired by public YouTube workflows; technology and capacity are proposed choices.",
      businessTenancy: "Personal workspaces",
      authorization: "Roles and permissions",
      dataIsolation: "Shared scoped data",
      deliveryModel: "Hosted",
    },
    nodes: [],
    relationships: [],
    components: [],
    componentRelationships: [],
    contracts: [],
    interfaces: [],
    bindings: [],
    datasets: [],
    objectives: [],
    scenarios: [],
    decisions: [],
  };
  design.architecture = model;
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
      planned,
      name,
      description,
      technology,
      template: null,
      config,
      attachments: [],
      notes:
        "Architecture intent; runtime implementation and capacity verification are separate work.",
    });
  };
  add(
    "web",
    "browser-client",
    "Viewer & creator web",
    "Discovery, watch pages, channel management and resumable creator uploads.",
    "React · TypeScript · adaptive player",
    { rendering: "Hybrid" },
  );
  add(
    "console",
    "browser-client",
    "Trust & safety console",
    "Staff review reports, suspend content and inspect an audited moderation history.",
    "React · TypeScript",
    { audience: "Internal staff & admins", access: "Sign-in required" },
  );
  add(
    "api",
    "application-api",
    "Platform API",
    "A modular application owns channels, video metadata, upload sessions and moderation decisions.",
    "Kotlin · Spring Boot",
    { peakRate: 2000, workloadShape: "Bursty", p95LatencyMs: 300 },
  );
  add(
    "playback",
    "application-api",
    "Playback API",
    "Independently scaled read path checks video visibility and issues short-lived media access grants.",
    "Go · HTTP",
    { peakRate: 5000, workloadShape: "Bursty", p95LatencyMs: 150 },
  );
  add(
    "processor",
    "background-worker",
    "Media processor",
    "Scans originals, creates encoded renditions and records completion before publication.",
    "Containerized FFmpeg workers",
    { peakRate: 20, workloadUnit: "Jobs / second" },
  );
  add(
    "activity",
    "background-worker",
    "Activity worker",
    "Consumes catalog events to update discovery indexes and deliver creator notifications.",
    "Kotlin · background workers",
  );
  add(
    "db",
    "relational-store",
    "Catalog database",
    "Authoritative channels, access policy, video states, upload sessions and transactional outbox.",
    "PostgreSQL",
  );
  add(
    "cache",
    "distributed-cache",
    "Playback metadata cache",
    "Derived visibility and rendition descriptors with bounded age; the catalog remains authoritative.",
    "Redis",
  );
  add(
    "originals",
    "object-storage",
    "Original uploads",
    "Private quarantine for uploaded source files, addressed by upload identity and checksum.",
    "S3-compatible object storage",
  );
  add(
    "media",
    "object-storage",
    "Published renditions",
    "Versioned immutable media segments, manifests and thumbnails, restricted to the delivery provider.",
    "S3-compatible object storage",
  );
  add(
    "jobs",
    "job-queue",
    "Media processing jobs",
    "Named work queue for durable, duplicate-safe media processing. Broker placement is a later deployment choice.",
    "AMQP work queue",
  );
  add(
    "events",
    "event-stream",
    "Catalog change events",
    "Named channel for publication, visibility changes and removal; retained for consumer replay.",
    "Kafka topic",
  );
  add(
    "search",
    "search-index",
    "Discovery index",
    "Rebuildable public-video and channel search documents. Never the authority for playback permission.",
    "OpenSearch",
  );
  add(
    "cdn",
    "edge-delivery",
    "Media delivery provider",
    "An external CDN serves immutable segments and enforces short-lived access grants.",
    "Managed CDN · HTTPS/HLS/DASH",
  );
  add(
    "identity",
    "identity-provider",
    "Identity provider",
    "External login and token issuance for viewers, creators and staff.",
    "OIDC provider",
  );
  add(
    "email",
    "third-party-service",
    "Email provider",
    "Delivers creator processing outcomes and moderation notices.",
    "Transactional email API",
  );

  const component = (
    id: string,
    element: string,
    name: string,
    capability: string,
    responsibility: string,
    config: Record<string, unknown> = {},
  ) => {
    const c: ArchitectureComponent = {
      id,
      element,
      name,
      capability,
      responsibility,
      config,
      members: [],
      usesResources: [],
      usesConnections: [],
      technology: "In process",
    };
    model.components!.push(c);
    return c;
  };
  component(
    "watch",
    "web",
    "Watch experience",
    "screen-group",
    "Owns player state, accessible controls, playback errors and continuation after a grant refresh.",
  );
  component(
    "discovery",
    "web",
    "Discovery & channels",
    "screen-group",
    "Search, channel browsing, subscriptions and paged public video listings.",
  );
  component(
    "studio",
    "web",
    "Creator studio",
    "screen-group",
    "Upload progress, resumable transfer, processing state and publish/visibility controls.",
  );
  component(
    "web-session",
    "web",
    "Session & identity",
    "client-session",
    "OIDC sign-in and signed-in client state; authorization remains server-side.",
  );
  component(
    "web-api",
    "web",
    "Platform access",
    "api-facade",
    "Typed boundary for catalog commands and playback grants; maps failures to user-visible states.",
  );
  component(
    "casework",
    "console",
    "Moderation casework",
    "screen-group",
    "Review a report, inspect context, record a reason and decide the content's disposition.",
  );
  component(
    "staff-session",
    "console",
    "Staff access",
    "client-session",
    "Staff sign-in and role-aware navigation; privileged decisions are rechecked by the API.",
  );
  component(
    "staff-api",
    "console",
    "Moderation API access",
    "api-facade",
    "Sends staff decisions with case identity and displays explicit authorization failures.",
  );
  component(
    "api-boundary",
    "api",
    "Request boundary",
    "request-boundary",
    "Validates public and creator requests and carries actor, trace and idempotency context.",
  );
  component(
    "api-access",
    "api",
    "Access policy",
    "authorization-module",
    "Checks channel ownership, viewer visibility and staff permissions for every command.",
  );
  component(
    "catalog",
    "api",
    "Video catalog",
    "domain-module",
    "Owns video metadata and the draft, processing, ready, published and removed lifecycle.",
  );
  component(
    "uploads",
    "api",
    "Upload coordination",
    "workflow-module",
    "Allocates bounded upload sessions, verifies completed originals and schedules processing exactly once per source version.",
  );
  component(
    "moderation",
    "api",
    "Moderation policy",
    "moderation-module",
    "Owns reports, staff decisions and immediately authoritative content restrictions.",
  );
  component(
    "catalog-data",
    "api",
    "Catalog transactions",
    "repository-module",
    "Commits domain changes and outbox intent in one database transaction.",
  );
  component(
    "outbox",
    "api",
    "Event publishing",
    "outbox-module",
    "Relays persisted outbox records to jobs and catalog events with retained acknowledgements and duplicate-safe consumers.",
  );
  component(
    "playback-limits",
    "playback",
    "Admission & limits",
    "traffic-policy",
    "Applies caller budgets and caps source fallbacks during cache failure.",
  );
  component(
    "playback-access",
    "playback",
    "Playback authorization",
    "authorization-module",
    "Authorizes each grant against published visibility and revocation policy.",
  );
  component(
    "manifest",
    "playback",
    "Playback grants",
    "domain-module",
    "Issues rendition selection and a signed media grant valid for at most 60 seconds.",
  );
  component(
    "playback-cache",
    "playback",
    "Metadata & freshness",
    "cache-module",
    "Reads current descriptors, coalesces cache misses and bounds stale visibility to 15 seconds.",
    { ttlSeconds: 15 },
  );
  component(
    "job-handler",
    "processor",
    "Processing coordinator",
    "event-handlers-module",
    "Leases a source-version job, tracks stages and deduplicates repeat delivery.",
  );
  component(
    "scanner",
    "processor",
    "Upload validation",
    "media-module",
    "Checks checksum, format and content safety before any public rendition can be produced.",
  );
  component(
    "transcoder",
    "processor",
    "Rendition pipeline",
    "media-module",
    "Produces immutable HLS/DASH variants and thumbnails with bounded CPU and time budgets.",
    { formats: "HLS, DASH, AVIF" },
  );
  component(
    "publication",
    "processor",
    "Completion reporting",
    "integration-adapter",
    "Reports durable media completion to the catalog; processing does not itself grant public access.",
  );
  component(
    "indexer",
    "activity",
    "Search projection",
    "search-module",
    "Applies versioned catalog changes idempotently and rebuilds the derived search index.",
  );
  component(
    "notifier",
    "activity",
    "Creator notifications",
    "notifications-module",
    "Sends processing and moderation updates using event identity as a duplicate-suppression key.",
  );
  component(
    "cache-invalidation",
    "activity",
    "Visibility propagation",
    "cache-module",
    "Invalidates metadata on visibility changes and purges media delivery paths on removal.",
    { ttlSeconds: 15 },
  );

  const owner = (id: string): ContractOwner => ({
    kind: model.components!.some((c) => c.id === id) ? "component" : "element",
    id,
  });
  const containerOf = (id: string) => model.components!.find((c) => c.id === id)?.element ?? id;
  const field = (name: string) => ({
    id: `field-${name.toLowerCase()}`,
    name,
    type: "text" as const,
    required: true,
    description: "Declared design contract",
  });
  const connect = (
    id: string,
    from: string,
    to: string,
    label: string,
    protocol: string,
    options: {
      event?: boolean;
      consume?: boolean;
      fields?: string[];
      policies?: RelationshipPolicies;
    } = {},
  ) => {
    const fromElement = containerOf(from),
      toElement = containerOf(to);
    const local = fromElement === toElement;
    if (local)
      model.componentRelationships!.push({
        id,
        from,
        to,
        description: label,
        protocol: "In process",
        interaction: "Request / response",
      });
    else
      design.connections.push({
        id,
        kind: "depends-on",
        from: { element: fromElement },
        to: { element: toElement },
        planned: {
          label,
          protocol,
          interaction: options.event
            ? "Asynchronous"
            : protocol.includes("HLS")
              ? "Streaming"
              : "Request / response",
          security: ["web", "console"].includes(fromElement) ? "User identity" : "Service identity",
        },
      });
    for (const componentId of [from, to]) {
      const c = model.components!.find((c) => c.id === componentId);
      if (c && !local) c.usesConnections.push(id);
    }
    const contract: ArchitectureContract = {
      id: `contract-${id}`,
      name: label,
      version: "v1",
      kind: options.event ? "event" : local ? "in-process" : "api",
      description: `${label}. Proposed interface; implementation is separate.`,
      shape: {
        operations: options.event
          ? []
          : [
              {
                id: `op-${id}`,
                name: label,
                description: label,
                input: (options.fields ?? ["videoId"]).map(field),
                output: [field("outcome")],
              },
            ],
        payload: options.event
          ? (options.fields ?? ["eventId", "videoId", "version"]).map(field)
          : [],
      },
    };
    model.contracts!.push(contract);
    const ref = { id: contract.id, version: contract.version };
    model.interfaces!.push(
      {
        id: `provides-${id}`,
        name: label,
        owner: owner(to),
        direction: "provided",
        necessity: "required",
        contract: ref,
      },
      {
        id: `requires-${id}`,
        name: label,
        owner: owner(from),
        direction: "required",
        necessity: "required",
        contract: ref,
      },
    );
    model.bindings!.push({
      id: `binding-${id}`,
      name: label,
      relationship: { kind: local ? "component-relationship" : "connection", id },
      provided: `provides-${id}`,
      required: `requires-${id}`,
      contract: ref,
      role: options.consume ? "consume" : options.event ? "publish" : "request",
      transport: local ? "In process" : protocol,
      businessSynchrony: options.event ? "Asynchronous" : "Synchronous",
      policies: {
        access: {
          identity: ["web", "console"].includes(fromElement) ? "User" : "Service",
          tenant: "Tenant scoped",
          network: ["web", "console"].includes(fromElement) ? "Public" : "Private",
        },
        failure: {
          outcome: options.event ? "Buffer" : "Fail request",
          detail: options.event
            ? "Retain durable progress; replay by event identity. No silent loss."
            : "Return an explicit error within the request deadline.",
          timeoutMs: options.event ? 30000 : 1500,
        },
        ...(options.event
          ? {
              retry: {
                maxAttempts: 8,
                idempotency: "Required" as const,
                key: "Event ID + source version",
              },
              delivery: {
                guarantee: "At least once" as const,
                ordering: "Per key" as const,
                acknowledgement: "Persisted" as const,
              },
            }
          : {}),
        ...options.policies,
      },
    });
  };
  connect("web-platform", "web-api", "api-boundary", "Browses and manages videos", "HTTPS/JSON");
  connect("web-playback", "watch", "playback-access", "Requests playback grant", "HTTPS/JSON", {
    policies: { access: { identity: "Public", tenant: "Public", network: "Public" } },
  });
  connect("web-delivery", "watch", "cdn", "Streams granted media", "HTTPS · HLS/DASH");
  connect("web-upload", "studio", "originals", "Uploads with scoped grant", "HTTPS multipart", {
    fields: ["uploadId", "checksum", "partNumber"],
  });
  connect("web-login", "web-session", "identity", "Authenticates viewer or creator", "HTTPS/OIDC");
  connect("staff-login", "staff-session", "identity", "Authenticates staff", "HTTPS/OIDC");
  connect(
    "staff-moderation",
    "staff-api",
    "moderation",
    "Reviews reports and restricts content",
    "HTTPS/JSON",
  );
  connect("api-identity", "api-access", "identity", "Retrieves signing keys", "HTTPS/JWKS");
  connect("api-db", "catalog-data", "db", "Commits catalog and outbox", "PostgreSQL transaction");
  connect("api-originals", "uploads", "originals", "Verifies uploaded source", "HTTPS object API");
  connect("api-search", "catalog", "search", "Queries public discovery", "HTTPS/JSON");
  connect("api-jobs", "outbox", "jobs", "Publishes processing requests", "AMQP", { event: true });
  connect("api-events", "outbox", "events", "Publishes catalog changes", "Kafka", { event: true });
  connect(
    "playback-cache-read",
    "playback-cache",
    "cache",
    "Reads bounded-age descriptors",
    "Redis RESP",
    {
      policies: {
        failure: {
          outcome: "Source fallback",
          timeoutMs: 25,
          detail:
            "Coalesce misses; cap fallback concurrency; fail closed when the source is unavailable.",
        },
        freshness: {
          invalidation: "Event driven",
          maxAgeSeconds: 15,
          detail: "TTL is the backstop if visibility invalidation is delayed.",
        },
      },
    },
  );
  connect("playback-source", "playback-cache", "db", "Loads authoritative visibility", "SQL read", {
    policies: {
      failure: {
        outcome: "Fail request",
        timeoutMs: 100,
        detail:
          "Fail closed if current access cannot be established; never issue an unchecked grant.",
      },
    },
  });
  connect("process-jobs", "job-handler", "jobs", "Consumes media work", "AMQP", {
    event: true,
    consume: true,
  });
  connect(
    "process-original",
    "scanner",
    "originals",
    "Reads quarantined source",
    "HTTPS object API",
  );
  connect(
    "process-media",
    "transcoder",
    "media",
    "Writes versioned renditions",
    "HTTPS object API",
  );
  connect("process-complete", "publication", "catalog", "Records processing result", "HTTPS/JSON", {
    fields: ["videoId", "sourceVersion", "manifestKey", "checksum"],
  });
  connect("cdn-origin", "cdn", "media", "Fetches private media origin", "HTTPS object API");
  connect("activity-events", "indexer", "events", "Consumes catalog changes", "Kafka", {
    event: true,
    consume: true,
  });
  connect("activity-search", "indexer", "search", "Updates public search documents", "HTTPS/JSON");
  connect("activity-source", "indexer", "db", "Rebuilds from catalog", "SQL read");
  connect(
    "activity-cache",
    "cache-invalidation",
    "cache",
    "Invalidates visibility entries",
    "Redis RESP",
  );
  connect("activity-purge", "cache-invalidation", "cdn", "Purges removed media", "HTTPS purge API");
  connect("activity-email", "notifier", "email", "Sends creator notices", "HTTPS/JSON");
  const local: [string, string, string][] = [
    ["watch", "web-api", "Loads watch context"],
    ["discovery", "web-api", "Requests discovery results"],
    ["studio", "web-api", "Manages upload session"],
    ["web-api", "web-session", "Gets signed-in context"],
    ["casework", "staff-api", "Submits a moderation decision"],
    ["staff-api", "staff-session", "Gets staff context"],
    ["api-boundary", "api-access", "Authorizes caller"],
    ["api-boundary", "catalog", "Dispatches catalog commands"],
    ["api-boundary", "uploads", "Coordinates upload lifecycle"],
    ["catalog", "catalog-data", "Persists domain state and intent"],
    ["uploads", "catalog-data", "Commits processing request and intent"],
    ["moderation", "catalog-data", "Commits restriction and event intent"],
    ["outbox", "catalog-data", "Leases committed outbox records"],
    ["moderation", "api-access", "Checks staff authority"],
    ["playback-access", "playback-limits", "Checks admission budget"],
    ["playback-access", "playback-cache", "Resolves current visibility"],
    ["playback-access", "manifest", "Issues authorized grant"],
    ["job-handler", "scanner", "Validates source version"],
    ["scanner", "transcoder", "Processes approved source"],
    ["transcoder", "publication", "Reports durable rendition set"],
    ["indexer", "cache-invalidation", "Propagates visibility changes"],
    ["indexer", "notifier", "Schedules creator notice"],
  ];
  for (const [from, to, label] of local)
    connect(`local-${from}-${to}`, from, to, label, "In process");
  model.nodes = [
    {
      id: "viewer",
      kind: "person",
      name: "Viewer",
      description: "Discovers and watches public video; signs in for subscriptions.",
    },
    {
      id: "creator",
      kind: "person",
      name: "Creator",
      description: "Uploads, publishes and manages videos belonging to their channel.",
    },
    {
      id: "reviewer",
      kind: "person",
      name: "Trust & safety staff",
      description: "Reviews reports and records accountable moderation decisions.",
    },
    ...["cdn", "identity", "email"].map((id) => ({
      id: `external-${id}`,
      kind: "external-system" as const,
      name: design.elements.find((e) => e.id === id)!.name,
      description: design.elements.find((e) => e.id === id)!.description!,
      container: id,
    })),
  ];
  model.relationships = [
    {
      id: "viewer-system",
      from: "viewer",
      to: "system",
      description: "Discovers and watches video",
      container: "web",
    },
    {
      id: "creator-system",
      from: "creator",
      to: "system",
      description: "Uploads and publishes channel video",
      container: "web",
    },
    {
      id: "reviewer-system",
      from: "reviewer",
      to: "system",
      description: "Reviews reports and restricts content",
      container: "console",
    },
    {
      id: "system-delivery",
      from: "system",
      to: "external-cdn",
      description: "Delivers authorized media to viewers",
      container: "web",
    },
    {
      id: "system-identity",
      from: "system",
      to: "external-identity",
      description: "Authenticates viewers, creators and staff",
      container: "api",
    },
    {
      id: "system-email",
      from: "system",
      to: "external-email",
      description: "Sends creator status updates",
      container: "activity",
    },
  ];
  const datasets: [string, string, string, string, string[]][] = [
    [
      "video-records",
      "Video catalog & permissions",
      "catalog",
      "db",
      ["catalog-data", "playback-cache", "indexer"],
    ],
    ["source-files", "Quarantined originals", "uploads", "originals", ["scanner"]],
    ["rendition-files", "Versioned media renditions", "transcoder", "media", ["cdn"]],
  ];
  for (const [id, name, responsible, store, readers] of datasets) {
    const contract = { id: `data-${id}`, version: "v1" };
    model.contracts!.push({
      ...contract,
      name,
      kind: "data",
      description: name,
      shape: { operations: [], payload: [field("videoId"), field("ownerId"), field("version")] },
    });
    model.datasets!.push({
      id,
      name,
      contract,
      owners: [owner(responsible)],
      ownershipDecision:
        "Domain owner decides lifecycle; persistence and processing act under that authority.",
      store,
      readers: readers.map(owner),
      writers: [owner(responsible)],
      tenant: "Tenant scoped",
      retentionDays: id === "source-files" ? 7 : 365,
      deletion: "Delete",
      exportAccess: "Owner",
    });
  }
  model.objectives = [
    {
      id: "playback-throughput",
      name: "Playback grant peak",
      scope: { kind: "element", id: "playback" },
      metric: "throughput",
      value: 5000,
      unit: "requests/second",
      boundary: "Authorization/grant HTTP boundary; excludes media bytes and CDN requests.",
      window:
        "Illustrative 15-minute peak with representative ACL and hot/cold content mix. Unverified.",
    },
    {
      id: "playback-latency",
      name: "Playback grant p95",
      scope: { kind: "element", id: "playback" },
      metric: "response-time",
      value: 150,
      unit: "milliseconds",
      boundary:
        "Ingress to signed grant response at the target request rate; excludes player buffering.",
      window: "p95 over a 15-minute peak. Unverified.",
    },
    {
      id: "media-traffic",
      name: "Edge segment traffic",
      scope: { kind: "element", id: "cdn" },
      metric: "throughput",
      value: 50000,
      unit: "requests/second",
      boundary:
        "CDN media segment requests, assuming 4-second segments and a mixed bitrate workload.",
      window: "Illustrative burst target; provider quota, cost and geography need measurement.",
    },
    {
      id: "catalog-recovery",
      name: "Catalog recovery point",
      scope: { kind: "element", id: "db" },
      metric: "recovery-point",
      value: 5,
      unit: "minutes",
      boundary:
        "Authoritative catalog and outbox restored together; object and search reconciliation follows.",
      window: "Backup/restore drill required. No recovery evidence supplied.",
    },
    {
      id: "discovery-freshness",
      name: "Search freshness",
      scope: { kind: "element", id: "search" },
      metric: "analytics-lag",
      value: 30,
      unit: "seconds",
      boundary:
        "Committed publication to searchable document. Playback independently rechecks authority.",
      window: "p95 during normal processing. Unverified.",
    },
  ];
  const scenario = (
    id: string,
    name: string,
    actor: string,
    startCondition: string,
    steps: [string, string][],
    outcome: string,
  ) => {
    const value = {
      id,
      name,
      actor,
      startCondition,
      scope: { level: "containers" as const },
      steps: steps.map(([relationship, text], i) => ({
        id: `${id}-${i + 1}`,
        relationship: { kind: "connection" as const, id: relationship },
        binding: `binding-${relationship}`,
        text,
      })),
      mainOutcomes: [`${id}-success`],
      outcomes: [
        {
          id: `${id}-success`,
          text: outcome,
          invariants: ["Architecture expectation; runtime verification remains outstanding."],
          requirements: [],
          decisions: [],
        },
      ],
      alternatives: [] as NonNullable<
        NonNullable<Architecture["scenarios"]>[number]["alternatives"]
      >,
    };
    model.scenarios!.push(value);
    return value;
  };
  const watch = scenario(
    "watch-video",
    "Watch a popular video",
    "viewer",
    "A published video has immutable renditions and the viewer may access it.",
    [
      ["web-playback", "The watch experience requests an authorized, short-lived playback grant."],
      ["playback-cache-read", "Playback checks bounded-age visibility and rendition descriptors."],
      [
        "web-delivery",
        "The player fetches media segments directly from the delivery provider using the grant.",
      ],
      ["cdn-origin", "On an edge miss, the provider fetches the private immutable origin object."],
    ],
    "Playback is served at the edge; platform API and media processing are outside the segment request path.",
  );
  watch.outcomes.push({
    id: "watch-unavailable",
    text: "When authority is unavailable, no new playback grant is issued; the player displays a retryable unavailable state.",
    invariants: ["Never trade authorization for availability."],
    requirements: [],
    decisions: [],
  });
  watch.alternatives.push({
    id: "cache-failure",
    name: "Cache unavailable",
    kind: "failure",
    condition: "Redis times out or has no current descriptor.",
    afterStep: "watch-video-2",
    steps: [
      {
        id: "watch-fallback",
        relationship: { kind: "connection", id: "playback-source" },
        binding: "binding-playback-source",
        text: "Coalesce misses and read the authoritative catalog within a bounded concurrency and time budget; fail closed if it cannot answer.",
      },
    ],
    outcomes: ["watch-video-success"],
  });
  watch.alternatives.push({
    id: "authority-failure",
    name: "Authoritative catalog unavailable",
    kind: "failure",
    condition:
      "Neither current cached visibility nor the authoritative catalog can establish permission.",
    afterStep: "watch-video-2",
    steps: [
      {
        id: "watch-denied",
        relationship: { kind: "connection", id: "playback-source" },
        binding: "binding-playback-source",
        text: "The bounded source read fails; return a retryable unavailable state without issuing a grant.",
      },
    ],
    outcomes: ["watch-unavailable"],
  });
  const upload = scenario(
    "publish-video",
    "Upload, process and publish",
    "creator",
    "A creator owns a channel and has permission and quota to upload.",
    [
      [
        "web-platform",
        "Create a scoped upload session; the source version identifies all subsequent processing.",
      ],
      ["web-upload", "Upload parts directly into private quarantine using a scoped grant."],
      ["api-originals", "Verify completion and checksum before accepting the processing request."],
      ["api-db", "Commit processing state and outbox event intent atomically."],
      [
        "api-jobs",
        "Relay committed intent; retain it until the work queue acknowledges persistence.",
      ],
      ["process-jobs", "Consume idempotently by video and source version."],
      ["process-original", "Validate the private source before transcoding."],
      ["process-media", "Write all immutable renditions and manifests."],
      [
        "process-complete",
        "Record a durable result in the catalog; creator publication still governs visibility.",
      ],
      ["api-events", "Publish the committed visibility change from the outbox."],
    ],
    "A published catalog version references a complete rendition set; duplicate work cannot publish a second logical version.",
  );
  upload.outcomes.push({
    id: "upload-buffered",
    text: "Processing remains pending with durable outbox intent while the queue is unavailable. The creator sees pending status and may cancel.",
    invariants: ["No accepted processing intent is silently discarded."],
    requirements: [],
    decisions: [],
  });
  upload.alternatives.push({
    id: "queue-failure",
    name: "Queue outage or duplicate delivery",
    kind: "failure",
    condition:
      "The queue cannot acknowledge a publish, or the same source version is delivered again.",
    afterStep: "publish-video-4",
    steps: [
      {
        id: "publish-retry",
        relationship: { kind: "connection", id: "api-jobs" },
        binding: "binding-api-jobs",
        text: "Keep the outbox record and retry with its stable event ID; consumers resume persisted progress or acknowledge an already completed version.",
      },
    ],
    outcomes: ["upload-buffered"],
  });
  scenario(
    "restrict-video",
    "Restrict a reported video",
    "reviewer",
    "A staff member has a report, a recorded reason and permission to moderate.",
    [
      ["staff-moderation", "Authorize staff and submit the case decision with an idempotency key."],
      ["api-db", "Commit the visibility restriction and event intent in the same transaction."],
      ["api-events", "Publish the committed restriction event."],
      ["activity-events", "Consume the event idempotently, preserving video version order."],
      ["activity-cache", "Invalidate visibility metadata; its 15-second TTL remains the backstop."],
      ["activity-purge", "Purge delivery paths; existing grants expire within 60 seconds."],
    ],
    "New grants honor the restriction within the bounded metadata age. Previously issued grants may last up to 60 seconds; already downloaded media cannot be recalled.",
  );
  scenario(
    "discover-video",
    "Discover newly published content",
    "viewer",
    "A publication event has committed and the viewer searches by channel or topic.",
    [
      ["activity-events", "Consume the publication version; ignore older or duplicate versions."],
      [
        "activity-search",
        "Upsert the public discovery projection, or remove a newly restricted item.",
      ],
      ["web-platform", "The discovery experience sends a public catalog query."],
      [
        "api-search",
        "Read the derived search index. Playback independently verifies visibility before issuing a grant.",
      ],
    ],
    "Search may lag by the declared freshness target, but stale discovery never authorizes playback.",
  );
  model.decisions = [
    {
      id: "read-plane",
      name: "Separate playback from catalog writes",
      status: "Accepted",
      context: "Popular video bursts should not consume creator-command capacity.",
      decision:
        "Keep the domain as a modular application; split only the playback authorization path and heavy processing workloads.",
      consequence:
        "Catalog reads and cache policy must remain compatible. This is a proposed design choice, not evidence of production scalability.",
      links: [
        { kind: "element", id: "api" },
        { kind: "element", id: "playback" },
      ],
      acknowledgements: [],
    },
    {
      id: "removal-window",
      name: "Bounded media revocation",
      status: "Accepted",
      context: "Edge delivery and preissued grants cannot make content revocation instantaneous.",
      decision:
        "Use 15-second metadata TTL, event invalidation, CDN purge and grants lasting at most 60 seconds. Fail closed for unknown authority.",
      consequence:
        "Already downloaded media is not recoverable; strict immediate revocation requires a different delivery protocol and separate cost analysis.",
      links: [
        { kind: "component", id: "playback-access" },
        { kind: "component", id: "cache-invalidation" },
      ],
      acknowledgements: [],
    },
    {
      id: "capacity-review",
      name: "Validate workload, cost and recovery",
      status: "Unresolved",
      context: "Traffic, latency and recovery numbers in this study are illustrative targets.",
      decision:
        "Measure mixed bitrate workloads, hot-key storms, origin egress, cache outages and restore drills before selecting production capacity.",
      consequence:
        "No production capacity, budget or recovery guarantee is approved by this example.",
      links: model.objectives!.map((o) => ({ kind: "objective" as const, id: o.id })),
      acknowledgements: [],
    },
  ];
  const focuses: [string, string, string[]][] = [
    ["watch", "01 · Watch & delivery", ["web", "playback", "cache", "db", "cdn", "media"]],
    [
      "upload",
      "02 · Upload & processing",
      ["web", "api", "originals", "jobs", "processor", "media", "db"],
    ],
    ["discovery", "03 · Discovery & events", ["web", "api", "db", "events", "activity", "search"]],
    [
      "moderation",
      "04 · Moderation & revocation",
      ["console", "api", "db", "events", "activity", "cache", "cdn"],
    ],
    [
      "providers",
      "05 · Identity & providers",
      ["web", "console", "api", "activity", "identity", "email"],
    ],
    [
      "data",
      "06 · Data ownership",
      ["api", "playback", "processor", "activity", "db", "originals", "media", "search"],
    ],
  ];
  for (const [id, name, members] of focuses)
    layout.architecture![`focus-${id}`] = {
      name,
      members: members.map((id) => `container:${id}`),
      includeDependencies: false,
      positions: {},
    };
  design.elements.forEach((element, index) => {
    layout.items[element.id] = { x: (index % 4) * 410, y: Math.floor(index / 4) * 420 };
  });
  return { name: VIDEO_PLATFORM_EXAMPLE.name, design, layout };
}

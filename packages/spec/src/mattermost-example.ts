/** A traceable C4 translation of public Mattermost diagrams and source, not a runtime recipe. */
import { type Architecture, architectureSchema } from "./architecture.ts";
import type { RelationshipBinding } from "./architecture-bindings.ts";
import type {
  ArchitectureContract,
  ContractOwner,
  ContractShape,
} from "./architecture-contracts.ts";
import {
  type DeploymentEnvironment,
  deploymentEnvironmentSchema,
} from "./architecture-deployments.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import type { LayoutDocument } from "./layout.ts";
import { deepenMattermostBackend } from "./mattermost-backend.ts";

export const MATTERMOST_EXAMPLE = {
  id: "mattermost-reference",
  name: "Mattermost · architecture reference",
  description:
    "An editable translation of Mattermost's published architecture: messaging, WebSocket delivery, SQL/file storage and background jobs. Includes the AWS 5,000-user reference layout and a Kubernetes adaptation.",
  useCases: "Published diagrams · source-linked C3 · AWS + Kubernetes deployment",
  accent: "blue",
} as const;

const revision = "2b3fb21fe39e6d8178625aabd8b9176596ad4cf5";
const source = `https://github.com/mattermost/mattermost/blob/${revision}/`;
const docsRevision = "bd09d959514c34e72a33c24663b5946682b656ec";

export function mattermostExample(): {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
} {
  const design = emptyDesign();
  const model: Architecture = architectureSchema.parse({
    system: {
      name: "Mattermost · reference translation",
      description:
        "Team messaging and file sharing. C2 is translated from the published application/HA diagrams; C3 is a selected decomposition traced to source. Scope: web messaging, notifications and background jobs. Calls, plugins and enterprise search are omitted.",
      businessTenancy: "Organizations",
      authorization: "Roles and permissions",
      dataIsolation: "Shared scoped data",
      deliveryModel: "Hosted and private",
    },
    components: [],
    componentRelationships: [],
    contracts: [],
    interfaces: [],
    bindings: [],
    decisions: [],
    scenarios: [],
  });
  design.architecture = model;
  const add = (
    id: string,
    planned: string,
    name: string,
    description: string,
    technology: string,
  ) => {
    design.elements.push({
      id,
      planned,
      name,
      description,
      technology,
      template: null,
      config: {},
      attachments: [],
      notes:
        "Reference architecture; see docs/examples/mattermost.md for source mapping and scope. No Jeeves runtime template is selected.",
    });
  };
  // Server first: C3 opens on useful application boundaries, not an invented page hierarchy.
  add(
    "server",
    "application-api",
    "Mattermost server",
    "Serves REST commands/history, authorizes channel access, stores posts and delivers live events. One modular Go application, replicated at deployment.",
    "Go · Mattermost server",
  );
  add(
    "web",
    "browser-client",
    "Web client",
    "Browser client using the REST API and a persistent WebSocket connection. Page composition is outside this architecture study.",
    "React · TypeScript · Mattermost client library",
  );
  add(
    "jobs",
    "background-worker",
    "Job server",
    "Runs scheduled and background jobs using the same server codebase in a separate process role. Job status is persisted in PostgreSQL.",
    "Go · Mattermost job server",
  );
  add(
    "db",
    "relational-store",
    "Application database",
    "Authoritative users, teams, channels, posts, file metadata and job records. Writer/reader placement is shown in Deployment.",
    "PostgreSQL",
  );
  add(
    "files",
    "object-storage",
    "Shared file storage",
    "Shared attachment bytes and export/import objects; access and file metadata remain in the application. All server replicas use the same backend.",
    "S3-compatible object storage",
  );
  add(
    "push",
    "third-party-service",
    "Mobile push service",
    "Mattermost hosted push service forwards notifications to mobile push providers. Mobile UI is outside this study.",
    "Mattermost HPNS · HTTPS",
  );
  add(
    "email",
    "third-party-service",
    "Email service",
    "Delivers mention and offline notifications through configured SMTP. Selected from the application architecture, beyond the AWS diagram's core boxes.",
    "SMTP provider",
  );

  const component = (
    id: string,
    element: string,
    name: string,
    capability: string,
    responsibility: string,
    technology: string,
    config: Record<string, unknown> = {},
  ) => {
    model.components!.push({
      id,
      element,
      name,
      capability,
      responsibility,
      technology,
      config,
      members: [],
      usesResources: [],
      usesConnections: [],
    });
  };
  component(
    "rest",
    "server",
    "REST API handlers",
    "request-boundary",
    "Parse API v4 requests, establish session context and delegate commands/queries. Endpoints are operations on this interface, not separate C3 boxes.",
    "Go · channels/api4",
  );
  component(
    "access",
    "server",
    "Session & channel authorization",
    "authorization-module",
    "Validate sessions and permission to act on a channel, post or file. Shared by transport and application operations.",
    "Go · app/authentication.go + authorization.go",
    { policy: "Roles + permissions" },
  );
  component(
    "posts",
    "server",
    "Post service",
    "domain-module",
    "Create and retrieve channel posts; enforce post rules, persist through Store and initiate post-processing. Owns message lifecycle.",
    "Go · channels/app/post.go",
    {
      owns: "Channel posts and message lifecycle",
      operations: "CreatePost, GetPosts, edit/delete",
      events: "posted, post_edited, post_deleted",
    },
  );
  component(
    "sockets",
    "server",
    "WebSocket hub",
    "request-boundary",
    "Maintain authenticated client connections and distribute eligible events. Peers coordinate delivery across server instances; this is not a durable message broker.",
    "Go · app/platform/web_hub.go",
    { transport: "WebSocket" },
  );
  component(
    "sql",
    "server",
    "SQL store",
    "repository-module",
    "Implement Store interfaces for posts, channels and file metadata. Route reads/writes to configured SQL connections; cache layers remain in process.",
    "Go · channels/store/sqlstore",
    {
      consistency: "Explicit policy",
      atomicity:
        "Operation-specific SQL transactions; no generic transactional outbox is asserted.",
    },
  );
  component(
    "file-adapter",
    "server",
    "File service & backend",
    "integration-adapter",
    "Authorize attachment operations, record file metadata and stream bytes through the configured shared file backend.",
    "Go · app/file.go + shared/filestore",
    {
      target: "Shared S3-compatible storage",
      mapping: "FileBackend: ReadFile / WriteFile / RemoveFile",
      verifyWebhooks: false,
    },
  );
  component(
    "notifications",
    "server",
    "Notification service",
    "notifications-module",
    "Determine recipients and preferences; publish channel events and send eligible email/mobile notifications after a post is saved.",
    "Go · app/notification*.go",
  );
  component(
    "scheduler",
    "jobs",
    "Job scheduler",
    "workflow-module",
    "Schedule enabled job types. Cluster leadership controls scheduled work; durable job records coordinate execution.",
    "Go · channels/jobs/schedulers.go",
    {
      execution: "In-process bounded workflow",
      steps: "Check enabled schedules; create pending job records",
      idempotency: "Job-type-specific scheduling policy",
    },
  );
  component(
    "workers",
    "jobs",
    "Job watcher & workers",
    "workflow-module",
    "Poll pending jobs, dispatch by type, claim work and record status. Import/export workers use shared file storage.",
    "Go · channels/jobs/jobs_watcher.go + workers.go",
    {
      steps: "Poll pending; dispatch by type; claim; run; update status",
      idempotency: "Optimistic job status transition; task-specific recovery",
    },
  );
  component(
    "job-store",
    "jobs",
    "Job persistence",
    "repository-module",
    "Store and query job records; claim pending work with optimistic status updates. Uses the same database identity as the application server.",
    "Go · jobs/jobs.go + store/sqlstore/job_store.go",
    {
      consistency: "Explicit policy",
      atomicity: "Optimistic job status transitions in PostgreSQL; no separate queue broker.",
    },
  );
  component(
    "client-api",
    "web",
    "REST client",
    "api-facade",
    "Expose typed API calls to the web application, including post creation and channel history. Reuses the Mattermost client package.",
    "TypeScript · platform/client/src/client4.ts",
    { target: "Mattermost API v4", mapping: "Existing Client4 implementation" },
  );
  component(
    "client-events",
    "web",
    "Realtime client",
    "realtime-client",
    "Open the authenticated event stream, dispatch received events and reconnect. Refresh authoritative state when stream recovery is insufficient.",
    "TypeScript · platform/client/src/websocket.ts",
    { implementation: "Mattermost WebSocketClient", recovery: "Resynchronize from source" },
  );

  const owner = (id: string): ContractOwner => ({
    kind: model.components!.some((c) => c.id === id) ? "component" : "element",
    id,
  });
  const element = (id: string) => model.components!.find((c) => c.id === id)?.element ?? id;
  const connect = (
    id: string,
    from: string,
    to: string,
    label: string,
    protocol: string,
    interaction: "Request / response" | "Streaming" = "Request / response",
  ) => {
    design.connections.push({
      id,
      kind: "depends-on",
      from: { element: element(from) },
      to: { element: element(to) },
      planned: {
        label,
        protocol,
        interaction,
        security:
          element(from) === "web" || element(to) === "web" ? "User identity" : "Service identity",
      },
    });
    for (const endpoint of [from, to])
      model.components!.find((c) => c.id === endpoint)?.usesConnections.push(id);
  };
  connect(
    "web-rest",
    "client-api",
    "rest",
    "Creates posts / reads channel history",
    "HTTPS · API v4",
  );
  connect(
    "web-connect",
    "client-events",
    "sockets",
    "Opens authenticated event stream",
    "WSS · /api/v4/websocket",
  );
  connect(
    "server-events",
    "sockets",
    "client-events",
    "Pushes permitted channel events",
    "WebSocket · JSON",
    "Streaming",
  );
  connect("server-write", "sql", "db", "Commits posts & metadata", "PostgreSQL · write");
  connect("server-read", "sql", "db", "Reads channels & history", "PostgreSQL · read");
  connect(
    "server-files",
    "file-adapter",
    "files",
    "Reads / writes attachment bytes",
    "HTTPS · S3 API",
  );
  connect(
    "server-push",
    "notifications",
    "push",
    "Submits mobile notifications",
    "HTTPS · push API",
  );
  connect("server-email", "notifications", "email", "Sends mention / offline email", "SMTP/TLS");
  connect("jobs-db", "job-store", "db", "Polls / claims / updates jobs", "PostgreSQL");
  connect(
    "jobs-files",
    "workers",
    "files",
    "Reads / writes import and export files",
    "HTTPS · S3 API",
  );
  const local = (id: string, from: string, to: string, description: string) =>
    model.componentRelationships!.push({
      id,
      from,
      to,
      description,
      protocol: "In process",
      interaction: "Request / response",
    });
  local("rest-access", "rest", "access", "Checks session & channel permission");
  local("rest-posts", "rest", "posts", "Dispatches post commands / queries");
  local("rest-files", "rest", "file-adapter", "Dispatches attachment operations");
  local("socket-access", "sockets", "access", "Checks session & event visibility");
  local("posts-sql", "posts", "sql", "Persists / loads posts");
  local("posts-notify", "posts", "notifications", "Triggers post notifications");
  local("notify-sockets", "notifications", "sockets", "Publishes filtered posted events");
  local("files-sql", "file-adapter", "sql", "Stores / reads file metadata");
  local("scheduler-store", "scheduler", "job-store", "Creates scheduled job records");
  local("workers-store", "workers", "job-store", "Claims pending jobs / records outcome");
  local("client-recovery", "client-events", "client-api", "Refreshes history after reconnect");

  // Source excerpts stay explicitly partial; the backend review adds behavior and richer shapes.
  const field = (
    name: string,
    type: ContractShape["payload"][number]["type"],
    description: string,
    required = true,
  ) => ({ id: name.replaceAll("_", "-"), name, type, required, description });
  const postFields = [
    field("id", "text", "Mattermost 26-character post ID; not a UUID."),
    field("channel_id", "text", "Channel ID."),
    field("message", "text", "Message body."),
    field("create_at", "integer", "Unix epoch milliseconds."),
  ];
  const contracts: ArchitectureContract[] = [
    {
      id: "post-api",
      version: "v4",
      name: "Create post · API excerpt",
      kind: "api",
      description: `Selected fields from ${source}api/v4/source/posts.yaml. Full Post responses, errors, arrays and nested props remain defined upstream; this excerpt is not a complete OpenAPI import.`,
      shape: {
        payload: [],
        operations: [
          {
            id: "create-post",
            name: "POST /api/v4/posts",
            description:
              "Requires a session and permission to post in the channel. Returns the created Post; permission/validation failures do not create a post.",
            input: [
              field("channel_id", "text", "Target channel."),
              field("message", "text", "Post content."),
              field("root_id", "text", "Parent post for a thread.", false),
              {
                ...field(
                  "file_ids",
                  "array",
                  "Attachment IDs; the API documents at most five files per post.",
                  false,
                ),
                items: { type: "text" },
                maxItems: 5,
              },
            ],
            output: postFields,
          },
        ],
      },
    },
    {
      id: "posted-event",
      version: "v4",
      name: "posted · event data excerpt",
      kind: "event",
      description: `Selected data fields emitted by ${source}server/channels/app/notification.go. The outer event/broadcast envelope and full Post object remain upstream. Live delivery is not a durable queue contract.`,
      shape: {
        operations: [],
        payload: [
          field("post", "text", "JSON-encoded Post object in the event data."),
          field("channel_type", "text", "Channel type discriminator."),
          field("sender_name", "text", "Sender display name."),
        ],
      },
    },
    {
      id: "post-record",
      version: "reference-1",
      name: "Persisted post · selected fields",
      kind: "data",
      description: `Selected domain fields; not a complete database schema. See ${source}server/public/model/post.go and server/channels/store/sqlstore/post_store.go.`,
      shape: { operations: [], payload: postFields },
    },
  ];
  model.contracts = contracts;
  const bind = (
    id: string,
    contract: ArchitectureContract,
    providedOwner: string,
    requiredOwner: string,
    role: RelationshipBinding["role"],
    policies: RelationshipBinding["policies"],
  ) => {
    const ref = { id: contract.id, version: contract.version };
    model.interfaces!.push(
      ...(["provided", "required"] as const).map((direction) => ({
        id: `${id}-${direction}`,
        name: contract.name,
        owner: owner(direction === "provided" ? providedOwner : requiredOwner),
        direction,
        necessity: "required" as const,
        contract: ref,
      })),
    );
    model.bindings!.push({
      id: `binding-${id}`,
      name: contract.name,
      relationship: { kind: "connection", id },
      provided: `${id}-provided`,
      required: `${id}-required`,
      contract: ref,
      operation: contract.shape?.operations[0]?.id,
      role,
      transport: design.connections.find((c) => c.id === id)!.planned!.protocol,
      businessSynchrony: role === "publish" ? "Asynchronous" : "Synchronous",
      policies,
    });
  };
  bind("web-rest", contracts[0]!, "rest", "client-api", "request", {
    access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
    failure: {
      outcome: "Fail request",
      detail:
        "Surface the API's validation/permission/server error. Only a successful saved Post is confirmed to the caller.",
    },
  });
  // Publication is provided by the server, consumed by the browser: do not reverse interface ownership.
  bind("server-events", contracts[1]!, "sockets", "client-events", "publish", {
    access: { identity: "User", tenant: "Tenant scoped", network: "Public" },
    failure: {
      outcome: "Source fallback",
      detail:
        "Reconnect and reconcile using the REST API when live stream recovery is insufficient. Do not promise durable or exactly-once delivery.",
    },
  });
  for (const [id, role] of [
    ["server-read", "read"],
    ["server-write", "write"],
  ] as const)
    bind(id, contracts[2]!, "db", "sql", role, {
      access: { identity: "Service", tenant: "Tenant scoped", network: "Private" },
    });
  model.datasets = [
    {
      id: "posts-data",
      name: "Channel posts",
      contract: { id: "post-record", version: "reference-1" },
      owners: [owner("posts")],
      ownershipDecision:
        "Post service owns lifecycle; SQL store implements persistence. Teams and channel membership govern visibility; teams are not independent security tenants.",
      store: "db",
      readers: [owner("sql")],
      writers: [owner("sql")],
      tenant: "Tenant scoped",
      deletion: "Unknown",
      exportAccess: "Unknown",
    },
  ];
  model.nodes = [
    {
      id: "member",
      kind: "person",
      name: "Team member",
      description: "Posts messages, reads channels and shares files.",
    },
    {
      id: "admin",
      kind: "person",
      name: "System administrator",
      description: "Manages users, policy and operational configuration.",
    },
    {
      id: "push-context",
      kind: "external-system",
      name: "Mobile push service",
      description: "Delivers eligible mobile notifications.",
      container: "push",
    },
    {
      id: "email-context",
      kind: "external-system",
      name: "Email service",
      description: "Delivers notification mail.",
      container: "email",
    },
  ];
  model.relationships = [
    {
      id: "member-system",
      from: "member",
      to: "system",
      description: "Collaborates through messages and files",
      container: "web",
    },
    {
      id: "admin-system",
      from: "admin",
      to: "system",
      description: "Administers the deployment and access",
      container: "web",
    },
    {
      id: "system-push",
      from: "system",
      to: "push-context",
      description: "Sends mobile notifications",
      container: "server",
    },
    {
      id: "system-email",
      from: "system",
      to: "email-context",
      description: "Sends notification mail",
      container: "server",
    },
  ];
  model.objectives = [
    {
      id: "interactive-latency",
      name: "Post creation p95 · target undecided",
      scope: { kind: "element", id: "server" },
      metric: "response-time",
      unit: "milliseconds",
      boundary:
        "Load balancer receipt to successful post response, including authorization and SQL persistence.",
      window:
        "Choose a budget and representative workload before capacity approval. The 5,000-user reference label is not an RPS measurement.",
    },
    {
      id: "event-latency",
      name: "Live delivery p95 · target undecided",
      scope: { kind: "binding", id: "binding-server-events" },
      metric: "response-time",
      unit: "milliseconds",
      boundary:
        "Saved post to reception by an authorized WebSocket client on another application replica.",
      window:
        "Include concurrent sockets, message rate, fan-out, reconnect bursts and one failed replica. No benchmark is claimed.",
    },
  ];
  const decision = (
    id: string,
    name: string,
    context: string,
    text: string,
    consequence: string,
    links: NonNullable<Architecture["decisions"]>[number]["links"],
    status: "Accepted" | "Unresolved" = "Accepted",
  ) =>
    model.decisions!.push({
      id,
      name,
      context,
      decision: text,
      consequence,
      status,
      links,
      acknowledgements: [],
    });
  decision(
    "reference-provenance",
    "Source and translation boundary",
    "Use an externally documented application to exercise Jeeves.",
    `C2: https://docs.mattermost.com/deployment-guide/application-architecture . AWS topology: https://github.com/mattermost/docs/blob/${docsRevision}/source/images/MattermostDeployment5kaws.png . C3: selected modules at source revision ${revision}; this decomposition is our interpretation, not an upstream C4 drawing.`,
    "Messaging slice only. Desktop/mobile internals, Calls, plugins and advanced search are excluded. HA and some operational features require the appropriate Mattermost commercial edition; no runtime availability is implied.",
    [{ kind: "system", id: "system" }],
  );
  const trace: [string, string][] = [
    ["rest", "server/channels/api4/post.go"],
    ["access", "server/channels/app/authorization.go"],
    ["posts", "server/channels/app/post.go"],
    ["sockets", "server/channels/app/platform/web_hub.go"],
    ["sql", "server/channels/store/sqlstore/post_store.go"],
    ["file-adapter", "server/platform/shared/filestore/filesstore.go"],
    ["notifications", "server/channels/app/notification.go"],
    ["scheduler", "server/channels/jobs/schedulers.go"],
    ["workers", "server/channels/jobs/jobs_watcher.go"],
    ["job-store", "server/channels/jobs/jobs.go"],
    ["client-api", "webapp/platform/client/src/client4.ts"],
    ["client-events", "webapp/platform/client/src/websocket.ts"],
  ];
  for (const [id, path] of trace)
    decision(
      `source-${id}`,
      `${model.components!.find((c) => c.id === id)!.name} · source`,
      "Selected responsibility from the public source snapshot.",
      `${source}${path}`,
      "A C3 responsibility may group several files and reuse existing libraries. This reference does not select or supply a Jeeves runtime template.",
      [{ kind: "component", id }],
    );
  decision(
    "deployment-choice",
    "AWS reference and Kubernetes adaptation",
    "The published 5,000-user AWS image uses two application VMs, one job VM, an Aurora writer/reader and S3.",
    "Preserve that layout as the reference. Offer a separate Kubernetes adaptation using OCI images, two app pods, a separate job workload and managed backing services. Ingress/controller, image digest, resources, scaling limits and rollout policy need explicit selection.",
    "The Kubernetes arrangement is a design alternative, not a reproduction of the AWS image or a measured sizing recommendation. See https://docs.mattermost.com/deployment-guide/server/kubernetes/deploy-k8s .",
    [
      { kind: "element", id: "server" },
      { kind: "element", id: "jobs" },
    ],
    "Unresolved",
  );
  decision(
    "capacity-choice",
    "Workload and failover sizing",
    "A user-count label alone does not specify request rate, fan-out or latency.",
    "Measure peak active sockets, posts/second, recipients/post, attachment throughput and reconnect bursts; choose latency/error budgets and size remaining nodes for a replica outage. Retention, recovery targets and restore procedures remain open.",
    "The reference proves that Jeeves can represent the architecture. It does not prove capacity or give complete production settings.",
    [
      { kind: "objective", id: "interactive-latency" },
      { kind: "objective", id: "event-latency" },
    ],
    "Unresolved",
  );
  model.scenarios = [
    {
      id: "post-journey",
      name: "Post a message and deliver it live",
      actor: "member",
      startCondition:
        "Signed-in member may post in the selected channel; another authorized member is connected.",
      scope: { level: "containers" },
      steps: [
        {
          id: "post-request",
          relationship: { kind: "connection", id: "web-rest" },
          binding: "binding-web-rest",
          text: "Create a post through API v4. The server checks session and channel permissions.",
        },
        {
          id: "post-save",
          relationship: { kind: "connection", id: "server-write" },
          binding: "binding-server-write",
          text: "Commit the post through SQL store. A persistence failure must not confirm success.",
        },
        {
          id: "post-deliver",
          relationship: { kind: "connection", id: "server-events" },
          binding: "binding-server-events",
          text: "Publish a posted event to eligible connected clients. Peer communication distributes events across application replicas.",
        },
      ],
      mainOutcomes: ["post-visible"],
      outcomes: [
        {
          id: "post-visible",
          text: "The saved post is available in history and delivered to eligible live clients.",
          invariants: ["Channel permissions apply to both history reads and event visibility."],
          requirements: [],
          decisions: [],
        },
        {
          id: "post-resynced",
          text: "After reconnect, the client reconciles with authoritative history; missing a live event does not delete the saved post.",
          invariants: ["WebSocket transport is not the authoritative post store."],
          requirements: [],
          decisions: [],
        },
      ],
      alternatives: [
        {
          id: "disconnected-client",
          name: "Recipient reconnects",
          kind: "failure",
          condition: "The recipient connection closes or cannot recover the complete event stream.",
          afterStep: "post-deliver",
          steps: [
            {
              id: "history-refresh",
              relationship: { kind: "connection", id: "web-rest" },
              text: "Reconnect and load missing channel history through the REST client.",
            },
          ],
          outcomes: ["post-resynced"],
        },
      ],
    },
  ];
  model.deployments = [deployment("aws"), deployment("k8s")];
  const layout: LayoutDocument = { schemaVersion: 1, items: {}, architecture: {} };
  for (const [id, name, members] of [
    ["messaging", "01 · Messaging & live delivery", ["web", "server", "db"]],
    ["files", "02 · Files & background jobs", ["web", "server", "jobs", "db", "files"]],
    ["notifications", "03 · Notification delivery", ["web", "server", "db", "push", "email"]],
  ] as const)
    layout.architecture![`focus-${id}`] = {
      name,
      members: members.map((id) => `container:${id}`),
      includeDependencies: false,
      positions: {},
    };
  design.elements.forEach((item, index) => {
    layout.items[item.id] = { x: (index % 3) * 440, y: Math.floor(index / 3) * 520 };
  });
  deepenMattermostBackend(design);
  return { name: MATTERMOST_EXAMPLE.name, design, layout };
}

function deployment(kind: "aws" | "k8s"): DeploymentEnvironment {
  const k8s = kind === "k8s";
  const key = (id: string) => `${kind}-${id}`;
  const env = deploymentEnvironmentSchema.parse({
    id: key("environment"),
    name: k8s ? "Kubernetes · proposed adaptation" : "AWS · published 5,000-user layout",
    kind: "Hosted",
    description: k8s
      ? "Proposed OCI/Kubernetes placement of the same C2 architecture. Image, controller, resources and scaling policies remain open decisions; not a measured capacity claim."
      : "Translated from Mattermost's published AWS image: two c7i.large app VMs, one c7i.large job VM, Aurora writer/reader and S3. User count is the source's reference category.",
  });
  const node = (
    id: string,
    name: string,
    technology: string,
    responsibility: string,
    parent?: string,
    infra = false,
  ) =>
    env.nodes.push({
      id: key(id),
      name,
      kind: infra ? "infrastructure" : "deployment",
      parent: parent ? key(parent) : undefined,
      replicas: 1,
      technology,
      responsibility,
      region: "",
      zone: "",
      operation: ["writer", "reader", "bucket", "edge"].includes(id)
        ? "Externally operated"
        : "Self operated",
      mappingReason: "",
    });
  node("client", "User device", "Browser", "Runs the web application outside server hosting.");
  node(
    "cloud",
    k8s ? "Hosted environment" : "Corporate AWS account",
    "AWS",
    "Single-region reference. Site/failure-domain selection is an open operational decision.",
  );
  if (k8s)
    node(
      "cluster",
      "Kubernetes cluster",
      "Kubernetes",
      "Application and job workloads use OCI images. Managed database and file storage remain outside the cluster.",
      "cloud",
    );
  node(
    "edge",
    k8s ? "Ingress / load balancer" : "Elastic Load Balancing",
    k8s ? "Managed load balancer · ingress controller undecided" : "AWS ELB",
    "TLS termination and health-based HTTP/WebSocket routing. The selected controller must support long-lived connections.",
    "cloud",
    true,
  );
  if (k8s)
    node(
      "service",
      "Application Service",
      "Kubernetes Service",
      "Select ready application pods; job workload receives no public traffic.",
      "cluster",
      true,
    );
  const parent = k8s ? "cluster" : "cloud";
  for (const n of [1, 2])
    node(
      `app-${n}`,
      k8s ? `App pod ${n}` : `MM-APP-0${n}`,
      k8s ? "OCI container · Kubernetes pod" : "EC2 c7i.large",
      "Mattermost application instance; REST and WebSocket traffic share this process. Same version/configuration across peers.",
      parent,
    );
  node(
    "job",
    k8s ? "Job workload" : "MM-JOB-01",
    k8s ? "OCI container · Kubernetes workload" : "EC2 c7i.large",
    "Separate job role of the server codebase; no client ingress.",
    parent,
  );
  node(
    "writer",
    "Aurora writer",
    "Aurora PostgreSQL · db.r7g.large",
    "Authoritative writer endpoint; application and job writes use this instance.",
    "cloud",
  );
  node(
    "reader",
    "Aurora reader",
    "Aurora PostgreSQL · db.r7g.large",
    "Reader endpoint for configured application reads. Read-after-write operations may require the writer.",
    "cloud",
  );
  node(
    "bucket",
    "Shared S3 bucket",
    "Amazon S3",
    "Shared attachment bytes and import/export objects.",
    "cloud",
  );
  for (const [id, element, placement] of [
    ["web", "web", "client"],
    ["app-1", "server", "app-1"],
    ["app-2", "server", "app-2"],
    ["job", "jobs", "job"],
    ["writer", "db", "writer"],
    ["reader", "db", "reader"],
    ["files", "files", "bucket"],
  ])
    env.instances.push({
      id: key(`instance-${id}`),
      element: element!,
      node: key(placement!),
      replicas: 1,
    });
  env.externals = ["push", "email"].map((id) => ({
    id: key(`external-${id}`),
    reference: { kind: "element", id },
  }));
  const endpoint = (id: string) => ({ kind: "instance" as const, id: key(`instance-${id}`) });
  const infrastructure = (
    id: string,
    from: DeploymentEnvironment["interactions"][number]["from"],
    to: DeploymentEnvironment["interactions"][number]["to"],
    description: string,
    protocol: string,
  ) =>
    env.interactions.push({ id: key(id), kind: "infrastructure", from, to, description, protocol });
  const logical = (id: string, from: string, to: string, connection: string, external = false) =>
    env.interactions.push({
      id: key(id),
      kind: "logical",
      from: endpoint(from),
      to: external ? { kind: "external", id: key(`external-${to}`) } : endpoint(to),
      relationship: { kind: "connection", id: connection },
    });
  infrastructure(
    "client-edge",
    endpoint("web"),
    { kind: "node", id: key("edge") },
    "Routes API and event-stream traffic",
    "HTTPS / WSS · 443",
  );
  if (k8s)
    infrastructure(
      "ingress-service",
      { kind: "node", id: key("edge") },
      { kind: "node", id: key("service") },
      "Routes to application Service",
      "HTTP / WebSocket",
    );
  for (const app of ["app-1", "app-2"]) {
    infrastructure(
      `route-${app}`,
      { kind: "node", id: key(k8s ? "service" : "edge") },
      endpoint(app),
      "Forwards to healthy application",
      "HTTP / WebSocket · 8065",
    );
    logical(`${app}-writer`, app, "writer", "server-write");
    logical(`${app}-reader`, app, "reader", "server-read");
    logical(`${app}-files`, app, "files", "server-files");
    logical(`${app}-push`, app, "push", "server-push", true);
    logical(`${app}-email`, app, "email", "server-email", true);
  }
  logical("job-db", "job", "writer", "jobs-db");
  logical("job-files", "job", "files", "jobs-files");
  env.interactions.push(
    {
      id: key("peer-1-2"),
      kind: "replica",
      from: endpoint("app-1"),
      to: endpoint("app-2"),
      description: "Distributes events / cache invalidations",
      protocol: "Cluster traffic · TCP/UDP 8074",
    },
    {
      id: key("peer-2-1"),
      kind: "replica",
      from: endpoint("app-2"),
      to: endpoint("app-1"),
      description: "Distributes events / cache invalidations",
      protocol: "Cluster traffic · TCP/UDP 8074",
    },
    {
      id: key("db-replication"),
      kind: "replica",
      from: endpoint("writer"),
      to: endpoint("reader"),
      description: "Replicates committed database changes",
      protocol: "Aurora managed replication",
    },
  );
  return env;
}

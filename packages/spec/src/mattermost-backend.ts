/** Backend design depth for the source-linked example. Proposed choices remain explicit. */
import { architectureComponentSchema } from "./architecture.ts";
import type {
  ArchitectureContract,
  ContractField,
  ContractShape,
  OperationOutcome,
} from "./architecture-contracts.ts";
import type { DesignDocument } from "./design.ts";

const source =
  "https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/";
const field = (
  name: string,
  type: ContractField["type"],
  description = "",
  required = true,
): ContractField => ({
  id: name.replaceAll("_", "-"),
  name,
  type,
  description,
  required,
});
const outcome = (
  id: string,
  name: string,
  kind: OperationOutcome["kind"],
  state: OperationOutcome["state"],
  retry: OperationOutcome["retry"],
  condition: string,
  status?: number,
): OperationOutcome => ({
  id,
  name,
  kind,
  state,
  retry,
  condition,
  ...(status && { status }),
});

export function deepenMattermostBackend(design: DesignDocument) {
  const m = design.architecture!;
  const components = m.components!;
  const component = (id: string) => components.find((c) => c.id === id)!;
  const contracts = m.contracts!;
  const postApi = contracts.find((c) => c.id === "post-api")!;
  const create = postApi.shape!.operations[0]!;
  for (const contract of contracts) contract.coverage = "Partial";
  postApi.description = `Selected API v4 fields and behavior, not a full import. ${source}api/v4/source/posts.yaml and server/channels/app/post.go. Query flags, complete Post/errors and enterprise hooks remain upstream. Implementation boundaries describe a future TypeScript design, not available templates.`;
  create.input.push({
    ...field(
      "metadata",
      "object",
      "Selected priority metadata; other members remain upstream.",
      false,
    ),
    fields: [
      {
        ...field("priority", "object", "Optional priority settings.", false),
        fields: [
          {
            ...field("priority", "text", "Priority label.", false),
            enumValues: ["", "important", "urgent"],
          },
          field("requested_ack", "boolean", "Request acknowledgements.", false),
        ],
      },
    ],
  });
  create.behavior = {
    kind: "Command",
    authorization:
      "Authenticated session; create_post permission for the channel. Teams and channel membership are access scopes, not isolated customer tenants.",
    preconditions:
      "Channel and optional thread root must be valid. Enforce message rules and attachment eligibility in server-side domain logic. Plugins, silent-post flags and enterprise variants are outside this excerpt.",
    stateChanges:
      "Post service owns message lifecycle; SQL store persists posts. File association and derived activity/notifications are additional steps.",
    transaction:
      "Store.Post.Save persists the post. File association, pending-post cache bookkeeping and notification processing are outside that save; this is not a single transaction covering all effects.",
    idempotency: "Not guaranteed",
    idempotencyKey:
      "The source uses optional pending_post_id with a bounded in-process cache and authorization on replay. Cross-replica/restart durability is not established. A future template must choose its own scope/lifetime before promising safe retries.",
    sideEffects:
      "After save, attach files and initiate post-processing/live delivery. SQL remains authoritative. A cache error after save can produce a failed response with a persisted post; reconcile before retrying.",
    implementation: "Composition",
    extensionPoint:
      "Proposed TypeScript boundary: template validates the transport/schema and calls a post policy hook with authenticated principal, channel, thread and file metadata. The hook returns allowed/rejected; persistence and publication remain explicit adapters.",
    acceptance:
      "Allowed member creates a readable post; denied member changes nothing; invalid thread is rejected; a lost response is reconciled before retry; file/notification failure does not imply the saved post was rolled back.",
  };
  create.outcomes = [
    outcome(
      "created",
      "Post created",
      "Success",
      "Committed",
      "Reconcile first",
      "Saved Post returned. Repeating the command is not a universal idempotency guarantee.",
      201,
    ),
    outcome(
      "invalid",
      "Invalid request",
      "Rejection",
      "Unchanged",
      "After correction",
      "Request/permission validation rejects this attempt before persistence.",
      400,
    ),
    outcome(
      "unauthenticated",
      "Session required",
      "Rejection",
      "Unchanged",
      "After correction",
      "No valid session.",
      401,
    ),
    outcome(
      "forbidden",
      "Channel permission denied",
      "Rejection",
      "Unchanged",
      "After correction",
      "Caller lacks permission to create a post in the channel.",
      403,
    ),
    outcome(
      "uncertain",
      "Save outcome uncertain",
      "Failure",
      "Unknown",
      "Reconcile first",
      "Connection loss or a server error after persistence/cache bookkeeping; read authoritative state before resubmitting.",
    ),
  ];

  component("sockets").capability = "realtime-hub";
  component("sockets").config = {
    transport: "WebSocket",
    audience: "ShouldSendEvent filters each recipient using session/channel eligibility.",
    delivery: "Best effort; source reconciliation",
    ordering: "Unspecified",
    fanout: "Peer exchange",
    recovery:
      "Reconnect with the existing client; refresh authoritative channel history when stream recovery is insufficient. No durable queue guarantee.",
    backpressure:
      "The inspected hub closes/removes a connection when its send buffer is full. Buffer size and client recovery budget remain configuration decisions.",
    revocation:
      "Source includes session-cache invalidation and per-recipient visibility checks. Specify and verify the allowed revocation propagation delay before implementation.",
    workloadUnit: "Concurrent connections",
    workloadBoundary:
      "Active sockets, events/second, recipients/event, slow consumers and reconnect bursts with a replica unavailable.",
  };
  component("file-adapter").capability = "file-lifecycle";
  component("file-adapter").config = {
    upload: "Through application",
    maxBytes: 0,
    authorization:
      "Session, upload/download permissions and channel/post access. File bytes must not bypass these checks.",
    validation:
      "Source file.go handles configured upload limits and processing. Exact accepted content and optional scan/quarantine requirements remain undecided for the TypeScript target.",
    lifecycle:
      "Uploaded bytes plus file metadata, then association to a post. Define permitted attach/reuse/delete transitions before templating.",
    consistency:
      "SQL metadata and S3 bytes are separate authorities; no distributed transaction. Specify write order and compensation for either half succeeding alone.",
    cleanup:
      "Abandoned-upload cleanup, retention/holds and deletion of derived assets need explicit policies; no generic safe default is asserted.",
    workloadUnit: "Bytes / second",
    workloadBoundary:
      "Concurrent uploads/downloads, maximum file size, transformations and object-store failure.",
  };
  Object.assign(component("access").config, {
    principal: "Authenticated Mattermost session established at the request/stream boundary.",
    scope:
      "Channel action permissions use membership and roles. Authorize history, live recipients and file access independently.",
    revocation:
      "Bound session and permission cache lifetimes; propagate invalidation to replicas and active sockets. Exact target latency remains open.",
  });
  Object.assign(component("notifications").config, {
    channels: "Email + push",
    audience: "Channel eligibility, mentions, user preferences and presence influence recipients.",
    delivery:
      "Post-processing follows save; outbound email/push is not atomic with the post. Retry/deduplication, sensitive notification payload and outage policy must be specified per channel.",
  });
  Object.assign(component("sql").config, {
    aggregates:
      "Posts, channels, memberships and file metadata; ownership remains with domain components.",
    readRouting:
      "Writer/reader placement does not establish read-after-write behavior. Inspect operation routing and define the required freshness for history and permission reads.",
  });
  Object.assign(component("workers").config, {
    claiming:
      "Claim pending -> in_progress with an optimistic database update. A losing worker does not execute that claim. Job-type-specific restart, cancellation and side-effect replay policy remain open.",
  });
  Object.assign(component("job-store").config, {
    aggregates: "Job records",
    concurrency: "Optimistic version check",
  });
  Object.assign(component("client-events").config, {
    authority: "REST channel history; the socket stream is not the post store.",
  });
  design.elements.find((e) => e.id === "jobs")!.config = {
    trigger: "Database polling",
    delivery: "Unspecified",
    deadLetter: false,
    claiming:
      "Optimistic persisted job status; no separate broker, generic lease or universal exactly-once behavior is implied.",
  };

  components.push(
    architectureComponentSchema.parse({
      id: "channels",
      element: "server",
      name: "Channels & membership",
      capability: "domain-module",
      responsibility:
        "Own channel lifecycle and membership state used by post rules, authorization and recipient selection. Separate policy decisions from the data they consult.",
      technology: "Go · channels/app/channel.go",
      config: {
        owns: "Channels and channel membership",
        operations: "Join/leave, membership lookup, archive channel",
        events: "Membership and channel changes",
      },
    }),
  );
  const local = (id: string, from: string, to: string, description: string) =>
    m.componentRelationships!.push({
      id,
      from,
      to,
      description,
      protocol: "In process",
      interaction: "Request / response",
    });
  local(
    "access-membership",
    "access",
    "channels",
    "Resolves channel membership for permission checks",
  );
  local("channels-sql", "channels", "sql", "Reads / changes channels and membership");
  local("files-access", "file-adapter", "access", "Checks upload / download permission");
  local(
    "posts-files",
    "posts",
    "file-adapter",
    "Associates eligible uploaded files after post save",
  );
  m.decisions!.push({
    id: "source-channels",
    name: "Channels & membership · source",
    status: "Accepted",
    context: "C3 interpretation of channel state ownership; authorization consumes this state.",
    decision: `${source}server/channels/app/channel.go`,
    consequence:
      "This decomposition does not create another process or claim a new runtime template.",
    links: [{ kind: "component", id: "channels" }],
    acknowledgements: [],
  });
  m.decisions!.find((d) => d.id === "source-file-adapter")!.decision =
    `${source}server/channels/app/file.go`;

  const define = (
    id: string,
    name: string,
    kind: ArchitectureContract["kind"],
    shape: ContractShape,
    description: string,
  ) => {
    const contract: ArchitectureContract = {
      id,
      name,
      kind,
      version: "reference-1",
      coverage: "Partial",
      shape,
      description,
    };
    contracts.push(contract);
    return contract;
  };
  const bind = (
    id: string,
    relation: string,
    provided: string,
    required: string,
    contract: ArchitectureContract,
    operation?: string,
    role: "request" | "read" | "write" = "request",
  ) => {
    const isC2 = design.connections.some((c) => c.id === relation);
    const ref = { id: contract.id, version: contract.version };
    for (const direction of ["provided", "required"] as const) {
      const target = direction === "provided" ? provided : required;
      m.interfaces!.push({
        id: `${id}-${direction}`,
        name: contract.name,
        owner: {
          kind: components.some((c) => c.id === target) ? "component" : "element",
          id: target,
        },
        direction,
        necessity: "required",
        contract: ref,
      });
    }
    m.bindings!.push({
      id: `binding-${id}`,
      name: contract.name,
      relationship: { kind: isC2 ? "connection" : "component-relationship", id: relation },
      provided: `${id}-provided`,
      required: `${id}-required`,
      contract: ref,
      operation,
      role,
      transport: isC2
        ? design.connections.find((c) => c.id === relation)!.planned!.protocol
        : "In process",
      businessSynchrony: "Synchronous",
    });
  };
  const command = define(
    "post-command",
    "Post command · internal boundary",
    "in-process",
    {
      payload: [],
      operations: [
        {
          ...structuredClone(create),
          name: "CreatePost",
          outcomes: create.outcomes!.map(({ status: _status, ...o }) => o),
        },
      ],
    },
    "Selected domain behavior behind REST. Shares the source semantics of CreatePost; future template/hook split is proposed, not implemented.",
  );
  bind("post-command", "rest-posts", "posts", "rest", command, "create-post");

  const history = define(
    "history-api",
    "Read channel history · API excerpt",
    "api",
    {
      payload: [],
      operations: [
        {
          id: "read-history",
          name: "GET /api/v4/channels/{channel_id}/posts",
          description:
            "Selected request fields. Full PostList response, pagination and thread variants remain upstream.",
          input: [
            field("channel_id", "text"),
            { ...field("page", "integer", "Page number.", false), minimum: 0 },
            {
              ...field(
                "per_page",
                "integer",
                "Bounded page size; exact supported maximum must be checked.",
                false,
              ),
              minimum: 1,
            },
          ],
          output: [
            { ...field("order", "array", "Ordered post IDs."), items: { type: "text" } },
            field(
              "posts",
              "unresolved",
              "Dictionary keyed by post ID; dynamic-key maps are not yet modeled.",
            ),
          ],
          behavior: {
            kind: "Query",
            authorization: "Authorize the caller for the requested channel before returning posts.",
            idempotency: "Read only",
            implementation: "Composition",
            extensionPoint:
              "Membership/visibility policy hook; bounded query and response mapping around it.",
            acceptance:
              "Denied channel returns no post data; repeated reads do not mutate posts; reconnect reconciliation respects current membership.",
            transaction:
              "Choose primary/replica freshness for reconnect and immediate post reads; no cross-request snapshot is asserted.",
          },
          outcomes: [
            outcome(
              "history-read",
              "History returned",
              "Success",
              "Unchanged",
              "Safe",
              "Caller may read the selected channel.",
              200,
            ),
            outcome(
              "history-denied",
              "Access denied",
              "Rejection",
              "Unchanged",
              "After correction",
              "Session/channel access is invalid.",
            ),
          ],
        },
      ],
    },
    `${source}api/v4/source/posts.yaml; dictionary response and cursor/since alternatives remain partial.`,
  );
  bind("history", "web-rest", "rest", "client-api", history, "read-history");
  const refresh = m.scenarios![0]!.alternatives![0]!.steps[0]!;
  refresh.binding = "binding-history";

  const membership = define(
    "membership-query",
    "Channel membership lookup",
    "in-process",
    {
      payload: [],
      operations: [
        {
          id: "membership-lookup",
          name: "GetChannelMember",
          description: "Selected source responsibility consumed by authorization.",
          input: [field("channel_id", "text"), field("user_id", "text")],
          output: [
            field(
              "roles",
              "text",
              "Membership roles used by policy; not a universal allow decision.",
            ),
          ],
          behavior: {
            kind: "Query",
            authorization:
              "Internal authorization context; caller-supplied user IDs do not establish identity.",
            idempotency: "Read only",
            implementation: "Composition",
            extensionPoint:
              "Define membership/role interpretation separately from persistence and session identity.",
            acceptance:
              "A missing/removed membership cannot be treated as an allowed channel action. Specify stale membership behavior before implementation.",
          },
          outcomes: [
            outcome(
              "membership-found",
              "Membership found",
              "Success",
              "Unchanged",
              "Safe",
              "Membership record is available.",
            ),
            outcome(
              "membership-absent",
              "No eligible membership",
              "Rejection",
              "Unchanged",
              "After correction",
              "Permission evaluation must handle absence explicitly.",
            ),
          ],
        },
      ],
    },
    `${source}server/channels/app/channel.go; not the full public membership API.`,
  );
  bind("membership", "access-membership", "channels", "access", membership, "membership-lookup");
  const claim = define(
    "job-claim",
    "Claim pending job",
    "in-process",
    {
      payload: [],
      operations: [
        {
          id: "claim-job",
          name: "ClaimJob",
          description:
            "Optimistically change pending to in_progress; the losing worker receives no claimed record.",
          input: [field("job_id", "text")],
          output: [
            {
              ...field("claimed_job", "object", "Absent/null if another worker won."),
              nullable: true,
              fields: [field("id", "text"), field("status", "text")],
            },
          ],
          behavior: {
            kind: "Command",
            authorization:
              "Internal job process acting on a persisted job; job-specific tenant/access context must remain attached to work.",
            stateChanges: "Pending job -> in_progress only for the successful optimistic update.",
            transaction:
              "The claim transition is atomic; the worker's later side effects and success status are separate.",
            idempotency: "Idempotent effect",
            implementation: "Composition",
            extensionPoint:
              "Template claim/status adapter plus job-type handler; handler must specify retryable effects, cancellation and restart recovery.",
            acceptance:
              "Two workers race for the same pending job: one receives it. A crash after an external effect cannot be declared exactly-once by the claim alone.",
          },
          outcomes: [
            outcome(
              "claimed",
              "Claim acquired",
              "Success",
              "Committed",
              "Reconcile first",
              "Optimistic pending -> in_progress update returns the job.",
            ),
            outcome(
              "claim-lost",
              "Claim not acquired",
              "Rejection",
              "Unchanged",
              "Safe",
              "Another worker already changed status; do not run the task.",
            ),
            outcome(
              "claim-unknown",
              "Claim result uncertain",
              "Failure",
              "Unknown",
              "Reconcile first",
              "Database response was lost; inspect current status before executing.",
            ),
          ],
        },
      ],
    },
    `${source}server/channels/jobs/jobs.go; recovery and handler-specific effects remain incomplete.`,
  );
  bind("job-claim", "workers-store", "job-store", "workers", claim, "claim-job");

  for (const [id, name, owner, payload] of [
    [
      "channel-record",
      "Channels & membership data",
      "channels",
      [field("channel_id", "text"), field("user_id", "text"), field("roles", "text")],
    ],
    [
      "file-record",
      "File metadata",
      "file-adapter",
      [
        field("id", "text"),
        field("user_id", "text"),
        field("post_id", "text", "Association may be pending.", false),
        field("size", "integer", "Bytes."),
      ],
    ],
  ] as const) {
    const contract = define(
      id,
      name,
      "data",
      { operations: [], payload: [...payload] },
      "Selected logical fields; relationships, indexes, retention and complete schema remain to be designed.",
    );
    for (const mode of ["read", "write"] as const)
      bind(`${id}-${mode}`, `server-${mode}`, "db", "sql", contract, undefined, mode);
    m.datasets!.push({
      id: `${id}-data`,
      name,
      contract: { id, version: contract.version },
      owners: [{ kind: "component", id: owner }],
      ownershipDecision:
        "Domain component owns lifecycle; SQL store implements access. Channel-scoped visibility does not imply isolated tenant databases.",
      store: "db",
      readers: [{ kind: "component", id: "sql" }],
      writers: [{ kind: "component", id: "sql" }],
      tenant: "Tenant scoped",
      deletion: "Unknown",
      exportAccess: "Unknown",
    });
  }
  m.decisions!.push({
    id: "backend-template-boundary",
    name: "Backend implementation boundary remains a design",
    status: "Unresolved",
    context:
      "Jeeves targets TypeScript templates; this reference describes a Go implementation and intentionally partial contracts.",
    decision:
      "Template candidates: request validation, bounded persistence, job claims, live transport and file adapters. Application hooks: channel/post permission policy, thread rules, recipient selection and job-specific side effects. Choose transaction/retry/revocation guarantees explicitly.",
    consequence:
      "No complete Mattermost clone or runtime is generated. Nested fixed shapes are supported; maps, unions, complete API import and state-machine authoring remain future work. See docs/reviews/mattermost-backend-review-2026-11-01.md.",
    links: [{ kind: "system", id: "system" }],
    acknowledgements: [],
  });
  addFailureScenarios(design);
  // Channel membership constrains resources; it is not evidence of customer-tenant isolation.
  for (const dataset of m.datasets ?? []) dataset.tenant = "Resource scoped";
  for (const binding of m.bindings ?? [])
    if (binding.policies?.access) binding.policies.access.tenant = "Resource scoped";
}

function addFailureScenarios(design: DesignDocument) {
  const m = design.architecture!;
  const messaging = m.scenarios![0]!;
  messaging.outcomes!.push({
    id: "post-uncertain",
    text: "A failed response does not establish rollback. Reconcile with the post store before attempting another create.",
    invariants: ["Post persistence and notification/file effects are separate."],
    requirements: [],
    decisions: [],
  });
  messaging.alternatives!.push({
    id: "lost-ack",
    name: "Response lost after save",
    kind: "failure",
    condition: "Post save succeeds but acknowledgement is lost or post-save bookkeeping fails.",
    afterStep: "post-save",
    steps: [
      {
        id: "reconcile-create",
        relationship: { kind: "connection", id: "web-rest" },
        binding: "binding-history",
        text: "Read current channel history and reconcile the pending operation; do not assume the failed response means no post exists.",
      },
    ],
    outcomes: ["post-uncertain"],
  });
  m.scenarios!.push(
    {
      id: "file-consistency",
      name: "Attachment bytes / metadata failure",
      actor: "member",
      scope: { level: "components", container: "server" },
      startCondition:
        "A signed-in member uploads a permitted attachment. This scenario records a required recovery design, not an asserted upstream cleanup guarantee.",
      steps: [
        {
          id: "file-request",
          relationship: { kind: "componentRelationship", id: "rest-files" },
          text: "Delegate the attachment request to file lifecycle.",
        },
        {
          id: "file-authorize",
          relationship: { kind: "componentRelationship", id: "files-access" },
          text: "Validate caller, channel and upload policy before accepting bytes.",
        },
        {
          id: "file-bytes",
          relationship: { kind: "connection", id: "server-files" },
          text: "Write bytes to the selected backend. Metadata and bytes are not one transaction.",
        },
        {
          id: "file-metadata",
          relationship: { kind: "componentRelationship", id: "files-sql" },
          text: "Record authoritative file metadata; define which state becomes attachable.",
        },
      ],
      mainOutcomes: ["file-available"],
      outcomes: [
        {
          id: "file-available",
          text: "Authorized attachment metadata refers to available bytes.",
          invariants: ["File access follows current post/channel permissions."],
          requirements: [],
          decisions: [],
        },
        {
          id: "file-recovery-needed",
          text: "An orphan is identified for retry/compensation. Cleanup timing and retained evidence remain an open design decision.",
          invariants: ["An object-store write cannot prove metadata persistence."],
          requirements: [],
          decisions: ["backend-template-boundary"],
        },
      ],
      alternatives: [
        {
          id: "metadata-failure",
          name: "Bytes saved; metadata fails",
          kind: "failure",
          condition: "Database persistence fails after bytes were accepted.",
          afterStep: "file-bytes",
          steps: [
            {
              id: "orphan-reconcile",
              relationship: { kind: "connection", id: "server-files" },
              text: "Proposed recovery: identify the orphan and retry metadata or remove bytes according to the selected lifecycle policy. Do not mark attachment complete.",
            },
          ],
          outcomes: ["file-recovery-needed"],
        },
      ],
    },
    {
      id: "job-competition",
      name: "Competing workers and interrupted effects",
      scope: { level: "components", container: "jobs" },
      startCondition: "Two workers observe the same pending persisted job.",
      steps: [
        {
          id: "claim-race",
          relationship: { kind: "componentRelationship", id: "workers-store" },
          binding: "binding-job-claim",
          text: "Attempt an optimistic claim. Only the worker receiving the changed job runs it.",
        },
        {
          id: "job-effect",
          relationship: { kind: "connection", id: "jobs-files" },
          text: "A file/export job performs its external effect; a database claim does not make this effect exactly-once.",
        },
        {
          id: "job-status",
          relationship: { kind: "componentRelationship", id: "workers-store" },
          text: "Record job-type-specific success/failure status.",
        },
      ],
      mainOutcomes: ["job-finished"],
      outcomes: [
        {
          id: "job-finished",
          text: "One claim winner records the job outcome.",
          invariants: ["A losing claim must not execute the task."],
          requirements: [],
          decisions: [],
        },
        {
          id: "job-recovery-open",
          text: "Recovery must reconcile any completed external effect before rerunning. The handler's restart/cancellation contract remains unresolved.",
          invariants: [
            "Persisted status alone does not prove the external effect did or did not occur.",
          ],
          requirements: [],
          decisions: ["backend-template-boundary"],
        },
      ],
      alternatives: [
        {
          id: "worker-crash",
          name: "Crash after effect",
          kind: "failure",
          condition: "Worker exits after writing an export but before saving success.",
          afterStep: "job-effect",
          steps: [
            {
              id: "inspect-effect",
              relationship: { kind: "connection", id: "jobs-files" },
              text: "Proposed handler recovery: inspect the prior effect and apply a job-specific idempotency/reconciliation policy before rerunning.",
            },
          ],
          outcomes: ["job-recovery-open"],
        },
      ],
    },
  );
}

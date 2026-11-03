/** Views, expected scenarios and deployment/workload intent over the same semantic identities. */
import type { DesignDocument } from "./design.ts";
import type { LayoutDocument } from "./layout.ts";
import type { ArchitectureScenario } from "./scenarios.ts";
export function discourseCoreJourneys(result: {
  name: string;
  design: DesignDocument;
  layout: LayoutDocument;
}) {
  const { design } = result,
    a = design.architecture!;
  a.decisions!.push({
    id: "dc-design-gate",
    name: "P71 complete design; implementation unavailable",
    context:
      "Frozen D01–D20, 66 observations, eight H seams and five independent fixture scenarios. Source pin is Discourse v3.5.0 / 05a304006600f36c3e45d19c9c5919f43f5541c9; the old P71a v3.4.0 label is historical and superseded here.",
    decision:
      "This editable model resolves design obligations using exact contracts, policies, finite protocol plans and typed hooks. Existing session adapter alone owns identity and sessions; no domain user/session schema. All runtime implementations remain unsupported; all application observations remain absent/not run, zero points. Preserved v1 declarations are historical exact definitions, not current duplicate routes.",
    status: "Accepted",
    consequence:
      "No generation readiness, provider integration, benchmark pass or measured capacity. Runtime/template execution requires a separately assigned package.",
    links: [{ kind: "system", id: "system" }],
    acknowledgements: [],
  });
  a.scenarios = structuredClone(discourseScenarios);
  a.objectives = [
    {
      id: "dc-workload-rate",
      name: "Unverified D-core offered throughput",
      scope: { kind: "system" },
      metric: "throughput",
      value: 50,
      unit: "requests/second",
      boundary:
        "10000 principals /100000 topics /1000000 posts; mix70% reads/20% search/10% writes; >=20 active clients",
      window:
        "Unmeasured target: open-loop600s after warm-up; record host/DB limits, seed, achieved rate, failures, queues and resources; 8CPU/16GiB/SSD suggested",
    },
    {
      id: "dc-read-latency",
      name: "Unverified read/search p95",
      scope: { kind: "element", id: "dc-api" },
      metric: "response-time",
      value: 500,
      unit: "milliseconds",
      boundary:
        "Full request including failed requests; expected policy rejections reported separately",
      window: "D-core600s, one and two API instances; not measured",
    },
    {
      id: "dc-command-latency",
      name: "Unverified command p95",
      scope: { kind: "element", id: "dc-api" },
      metric: "response-time",
      value: 1000,
      unit: "milliseconds",
      boundary: "Request through transaction/receipt commit or declared error",
      window: "D-core600s; unexpected failures target<0.1%; no measurement",
    },
    {
      id: "dc-worker-lag",
      name: "Unverified notification/projection p95 lag",
      scope: { kind: "element", id: "dc-worker" },
      metric: "analytics-lag",
      value: 10,
      unit: "seconds",
      boundary:
        "Source commit to eligible inbox/projection; suppressions and uncertain provider outcomes recorded separately",
      window:
        "D-core600s; record queue growth; separate restart/recovery and25 stale-write/two-worker contention runs; not measured",
    },
  ];
  a.deployments = [1, 2].map((count) => ({
    id: `dc-local-${count}-api`,
    name: count === 1 ? "Declared local API + worker" : "Later two-API target · unverified",
    kind: "Private" as const,
    description:
      "Loopback-only intended arrangement; no running health/capacity or cloud failover claim.",
    nodes: [
      {
        id: `dc-host-${count}`,
        name: "Local reference host",
        kind: "deployment" as const,
        replicas: 1,
        technology: "Docker Compose · planned",
        region: "local",
        zone: "one-host",
        responsibility:
          "8 logical CPUs /16GiB /SSD suggested; record actual allocations and DB connection budgets",
        operation: "Self operated" as const,
        mappingReason: "",
      },
    ],
    instances: [
      ...Array.from({ length: count }, (_, i) => ({
        id: `dc-api-${count}-${i + 1}`,
        element: "dc-api",
        node: `dc-host-${count}`,
        replicas: 1,
      })),
      { id: `dc-worker-${count}`, element: "dc-worker", node: `dc-host-${count}`, replicas: 1 },
      { id: `dc-db-${count}`, element: "dc-db", node: `dc-host-${count}`, replicas: 1 },
    ],
    externals: ["files", "email", "client"].map((id) => ({
      id: `dc-external-${id}-${count}`,
      reference: { kind: "element" as const, id: `dc-${id}` },
    })),
    interactions: [],
  }));
  result.layout.architecture = {
    "focus-dc-content-mutation": {
      name: "Content mutation",
      members: ["container:dc-client", "container:dc-api", "container:dc-db"],
      includeDependencies: true,
      positions: {},
    },
    "focus-dc-permission-revocation": {
      name: "Permission & revocation",
      members: ["container:dc-api", "container:dc-db", "container:dc-files", "container:dc-worker"],
      includeDependencies: true,
      positions: {},
    },
    "focus-dc-async-delivery": {
      name: "Async delivery",
      members: [
        "container:dc-api",
        "container:dc-worker",
        "container:dc-db",
        "container:dc-email",
        "container:dc-files",
      ],
      includeDependencies: true,
      positions: {},
    },
  };
}
const discourseScenarios: ArchitectureScenario[] = [
  {
    id: "d-create",
    name: "d-create",
    scope: {
      level: "containers",
    },
    actor: "dc-member",
    startCondition:
      "Reset full seed. Session/grant isolation, private create with lost response, rollback, receipt replay and trust/render hook contracts. No application has run.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "dc-client-api",
        },
        text: "Authenticate and authorize exact private content create; external client is outside generated scope.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "dc-api-db",
        },
        text: "Commit topic, first post, command receipt and one intent together; precommit failure rolls back.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "dc-client-api",
        },
        text: "Lost response uses same-key/current-policy replay; concurrent identical key has one writer; inspect frozen D-create oracle.",
      },
    ],
    mainOutcomes: [
      "d01-session-cycle",
      "d01-session-boundary",
      "d01-restart-session",
      "d02-privilege-escalation",
      "d02-category-grants",
      "d02-grant-replay",
      "d03-denied-create",
      "d03-atomicity",
      "d03-lost-response-retry",
      "d03-topic-first-post",
      "d06-denied-detail",
      "d06-denied-search",
      "d13-trust-progression",
      "d13-activity-replay",
      "d13-untrusted-counters",
      "d16-safe-render-mentions",
      "d16-unsafe-render-recipient",
      "d16-renderer-unavailable",
    ],
    outcomes: [
      {
        id: "d01-session-cycle",
        text: "Register, log in, mutate with the protected session, and log out; credentials never appear in responses or logs.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d01-session-boundary",
        text: "Unauthenticated, forged or cross-application sessions and missing mutation protections are rejected.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d01-restart-session",
        text: "A valid durable session survives API restart; a logged-out session remains invalid after restart.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d02-privilege-escalation",
        text: "An ordinary member cannot self-grant moderator access or use cross-scope group/category references.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d02-category-grants",
        text: "Public categories are readable and current group grants permit the intended private-category actions.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d02-grant-replay",
        text: "Repeated membership/grant commands preserve one effective relationship and recheck current authority.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d03-denied-create",
        text: "An unauthorized category reference is rejected without a topic, post or event intent.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d03-atomicity",
        text: "Failure before the initial post insert leaves neither topic nor post nor committed event intent.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d03-lost-response-retry",
        text: "After a committed response is lost, same-key/body retry returns the original topic and post; changed body conflicts.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d03-topic-first-post",
        text: "An authorized create persists one topic and its initial post together.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d06-denied-detail",
        text: "Revoked members cannot read topic/post detail or protected revision text.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d06-denied-search",
        text: "Revoked members cannot see private titles, snippets or counts in search, including stale projections.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d13-trust-progression",
        text: "Recorded activity and the frozen threshold policy propose promote/demote levels with reasons and privileged overrides.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d13-activity-replay",
        text: "Repeated/reordered activity evaluation does not count activity twice or bypass the authorized level-change command.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d13-untrusted-counters",
        text: "Client activity counters or unauthorized override requests cannot grant trust or privileges.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d16-safe-render-mentions",
        text: "The selected bounded renderer produces sanitized text/markup and typed mention identities.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d16-unsafe-render-recipient",
        text: "Executable markup and excessive parse input are rejected/sanitized; inaccessible recipients receive no mention notification.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d16-renderer-unavailable",
        text: "Cancelled, timed-out or unavailable required rendering never becomes a successful mutation or unvalidated output.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
    ],
    alternatives: [],
  },
  {
    id: "d-revoke",
    name: "d-revoke",
    scope: {
      level: "containers",
    },
    actor: "dc-member",
    startCondition:
      "Reset full seed. Grant Bob red, watch and queue a private reply, revoke before delivery, recheck every route and receipt. Digest/private export/erase include hold and resume contracts.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "dc-client-api",
        },
        text: "Grant Bob, issue authorized private detail/bytes/cursor and watch preferences; queue a reply.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "dc-api-db",
        },
        text: "Revoke current membership; pending recipient is no longer authorized.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "dc-worker-db",
        },
        text: "Recheck current persisted recipient authority/preferences; suppress private inbox/delivery.",
      },
      {
        id: "step-4",
        relationship: {
          kind: "connection",
          id: "dc-worker-email",
        },
        text: "Digest uncertainty reconciles one identity; privacy resumes one durable subject plan.",
      },
      {
        id: "step-5",
        relationship: {
          kind: "connection",
          id: "dc-client-api",
        },
        text: "Recheck all detail/list/history/search/bytes/inbox/replay paths; frozen oracle forbids private titles/text/counts.",
      },
    ],
    mainOutcomes: [
      "d02-category-grants",
      "d06-granted-access",
      "d07-watch-mute-preferences",
      "d07-duplicate-subscription",
      "d07-foreign-preferences",
      "d06-denied-detail",
      "d06-denied-list",
      "d06-denied-search",
      "d06-denied-bytes",
      "d02-grant-replay",
      "d06-pending-notification",
      "d15-digest-window",
      "d15-digest-exclusions",
      "d15-digest-delivery-retry",
      "d18-privacy-plan",
      "d18-privacy-boundary",
      "d18-privacy-resume",
    ],
    outcomes: [
      {
        id: "d02-category-grants",
        text: "Public categories are readable and current group grants permit the intended private-category actions.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d06-granted-access",
        text: "Current category members can observe content through every authorized surface before revocation.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d07-watch-mute-preferences",
        text: "Watch/mute and channel preferences change the authorized principal's effective subscription.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d07-duplicate-subscription",
        text: "Duplicate/retried commands preserve one subscription under its scoped principal/topic key.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d07-foreign-preferences",
        text: "Another principal cannot change or enumerate a private subscription by direct identity.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d06-denied-detail",
        text: "Revoked members cannot read topic/post detail or protected revision text.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d06-denied-list",
        text: "Revoked members cannot see private titles, counts or records in lists and pages.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d06-denied-search",
        text: "Revoked members cannot see private titles, snippets or counts in search, including stale projections.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d06-denied-bytes",
        text: "Revoked members cannot download private attachment bytes, including through a previously issued byte URL.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d02-grant-replay",
        text: "Repeated membership/grant commands preserve one effective relationship and recheck current authority.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d06-pending-notification",
        text: "Revocation before queued notification materialization/delivery prevents private content from being disclosed.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d15-digest-window",
        text: "Digest selection uses the declared timezone/window and bounded eligible references.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d15-digest-exclusions",
        text: "Muted or inaccessible content and private recipient information are absent from digest output.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d15-digest-delivery-retry",
        text: "Duplicate schedules/retries follow the declared delivery identity and recheck access before materialization.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d18-privacy-plan",
        text: "Authorized export/erasure produces the declared bounded plan, retained audit reasons and legal-hold decisions.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d18-privacy-boundary",
        text: "Another subject cannot export/erase private data or bypass retention/hold authority.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d18-privacy-resume",
        text: "Interrupted/repeated execution resumes safely and cancels affected queued deliveries without disclosing erased content.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
    ],
    alternatives: [],
  },
  {
    id: "d-edit",
    name: "d-edit",
    scope: {
      level: "containers",
    },
    actor: "dc-member",
    startCondition:
      "Reset full seed. Reply and version-3 edit contention, close/reopen/archive guards, post transitions, atomic split/merge and authenticated mail replay.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "dc-client-api",
        },
        text: "Race two post edits at version3; close rejects ordinary replies; hide/restore use exact dispatch.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "dc-api-db",
        },
        text: "One v4 and one new immutable previous revision; split/merge preserve IDs/history/subscriptions atomically.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "dc-client-api",
        },
        text: "Verified inbound message deduplicates after current posting checks; compare exact D-edit oracle.",
      },
    ],
    mainOutcomes: [
      "d04-reply-edit-history",
      "d04-stale-write",
      "d04-foreign-author",
      "d05-transition-race",
      "d05-allowed-transitions",
      "d05-invalid-transition",
      "d17-split-merge-history",
      "d17-merge-authority",
      "d17-split-merge-recovery",
      "d19-email-reply",
      "d19-email-deduplication",
      "d19-email-source-authority",
    ],
    outcomes: [
      {
        id: "d04-reply-edit-history",
        text: "Authorized replies and edits preserve immutable previous text, author and timestamp in revision history.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d04-stale-write",
        text: "Two edits at one expectedVersion produce exactly one next version and one new revision; the loser conflicts.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d04-foreign-author",
        text: "An unauthorized author cannot edit another principal's post or read a protected revision.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d05-transition-race",
        text: "Stale/repeated lifecycle commands cannot apply a transition or audit/effect twice.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d05-allowed-transitions",
        text: "Authorized close/reopen/archive and hide/restore/remove commands follow their declared transitions.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d05-invalid-transition",
        text: "An invalid or unauthorized transition, including an ordinary reply to a closed topic, leaves state unchanged.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d17-split-merge-history",
        text: "Authorized split/merge preserves post identities/history and applies explicit access/subscription decisions.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d17-merge-authority",
        text: "Foreign topics, unauthorized post selections and stale expected versions are rejected.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d17-split-merge-recovery",
        text: "Interrupted split/merge is atomic or follows the declared recovery plan without lost/duplicated posts or widened visibility.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d19-email-reply",
        text: "Authenticated inbound source and sender mapping produce an authorized topic reply with message provenance.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d19-email-deduplication",
        text: "Repeated message IDs and delivery retries create one logical reply; unavailable mapping remains explicit.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d19-email-source-authority",
        text: "Unauthenticated sources, ambiguous topic/sender mappings and unauthorized posting are rejected.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
    ],
    alternatives: [],
  },
  {
    id: "d-failure",
    name: "d-failure",
    scope: {
      level: "containers",
    },
    actor: "dc-member",
    startCondition:
      "Reset full seed. Public reply -> eligible inbox with crash after SQL commit before ack; restart deduplicates. Stage/upload/associate bytes, injected object and SQL faults, bounded orphan cleanup and unauthorized paths.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "dc-worker-db",
        },
        text: "Materialize inbox and effect receipt together; crash before acknowledgement, restart after30s lease.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "dc-worker-db",
        },
        text: "Fence new claim; stale acknowledgement rejects; retry preserves one inbox/receipt.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "dc-api-files",
        },
        text: "Stage committed metadata; verify actual private bytes outside SQL, partial objects unavailable.",
      },
      {
        id: "step-4",
        relationship: {
          kind: "connection",
          id: "dc-api-db",
        },
        text: "SQL association failure leaves validated v2 orphan; same-key retry creates one attached v3/link.",
      },
      {
        id: "step-5",
        relationship: {
          kind: "connection",
          id: "dc-worker-files",
        },
        text: "After24h recheck exact unlinked/version claim and delete selected orphan only; preserve attached unrelated objects.",
      },
    ],
    mainOutcomes: [
      "d08-crash-deduplication",
      "d08-eligible-inbox",
      "d08-ineligible-recipient",
      "d09-file-lifecycle",
      "d09-association-orphan",
      "d09-foreign-byte-access",
      "d09-invalid-upload",
    ],
    outcomes: [
      {
        id: "d08-crash-deduplication",
        text: "Crash after inbox commit before acknowledgement, then restart/retry, leaves one logical inbox item per recipient/event.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d08-eligible-inbox",
        text: "A currently eligible recipient receives the declared durable inbox item and delivery intent.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d08-ineligible-recipient",
        text: "Muted, unauthorized or revoked recipients receive no private notification projection.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d09-file-lifecycle",
        text: "Allowed bounded bytes can be staged, inspected, attached and downloaded by an authorized principal.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d09-association-orphan",
        text: "Failed SQL association or interrupted object persistence leaves no available partial file and a recoverable orphan for bounded cleanup.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d09-foreign-byte-access",
        text: "Foreign/private files cannot be associated or fetched; incomplete/quarantined bytes are never downloadable.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d09-invalid-upload",
        text: "Oversized or disallowed MIME uploads are rejected without an available attachment.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
    ],
    alternatives: [],
  },
  {
    id: "d-moderate",
    name: "d-moderate",
    scope: {
      level: "containers",
    },
    actor: "dc-member",
    startCondition:
      "Reset full seed. Unique flag, two moderator claims, hidden/removed history and search redaction, interleaved keyset pages/rebuild and abuse/ranking hooks.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "dc-client-api",
        },
        text: "Deduplicate active flag across keys; race two current moderator claims.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "dc-api-db",
        },
        text: "One winner moves flag/hides post/audits; stale claim has zero state/effect writes.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "dc-worker-db",
        },
        text: "Rebuild bounded projection from current source state; removed/hidden text never resurrects.",
      },
      {
        id: "step-4",
        relationship: {
          kind: "connection",
          id: "dc-client-api",
        },
        text: "Safe tombstones/audit, policy-before-page cursors, abuse appeal/override and ranking freshness compare fixed oracle.",
      },
    ],
    mainOutcomes: [
      "d10-flag-review-audit",
      "d10-duplicate-stale-review",
      "d10-unauthorized-review",
      "d12-removed-history-visibility",
      "d12-removed-search-visibility",
      "d12-tombstone-audit",
      "d05-allowed-transitions",
      "d05-invalid-transition",
      "d12-repeated-removal",
      "d11-bounded-search-pages",
      "d11-invalid-cursor-scope",
      "d11-projection-rebuild",
      "d14-adjudication-appeal",
      "d14-policy-authority",
      "d14-adjudication-unavailable",
      "d20-deterministic-ranking",
      "d20-ranking-visibility",
      "d20-ranking-rebuild",
    ],
    outcomes: [
      {
        id: "d10-flag-review-audit",
        text: "A member submits a flag; an authorized moderator reviews it and applies the declared action with immutable actor audit.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d10-duplicate-stale-review",
        text: "Duplicate flags preserve one active review; competing/stale review claims cause one action and one logical effect.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d10-unauthorized-review",
        text: "Ordinary members cannot invoke moderator review or claim another scope's flag.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d12-removed-history-visibility",
        text: "Removed text is absent from ordinary detail and revision-history outputs.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d12-removed-search-visibility",
        text: "Removed text, snippets and disclosing counts remain absent from ordinary search, including stale projections.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d12-tombstone-audit",
        text: "Authorized removal produces the declared tombstone and preserved safe audit history.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d05-allowed-transitions",
        text: "Authorized close/reopen/archive and hide/restore/remove commands follow their declared transitions.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d05-invalid-transition",
        text: "An invalid or unauthorized transition, including an ordinary reply to a closed topic, leaves state unchanged.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d12-repeated-removal",
        text: "Repeated removal/recovery is safe and cannot restore removed text or duplicate logical audit/effects.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d11-bounded-search-pages",
        text: "Topic/post lists and search use bounded stable cursor pages with authoritative access filtering before counts and snippets.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d11-invalid-cursor-scope",
        text: "Invalid, foreign or oversized paging input is rejected; interleaved inaccessible hits are absent.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d11-projection-rebuild",
        text: "Rebuild and retry restore the projection without resurrecting removed content or bypassing current category access.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d14-adjudication-appeal",
        text: "The selected abuse policy returns allow/review/reject and supports explicit appeal and moderator override.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d14-policy-authority",
        text: "Untrusted content cannot execute policy, disclose private history or grant itself a moderator override.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d14-adjudication-unavailable",
        text: "Timeout/unavailable policy remains explicit and fail-closed before a required mutation; replay does not apply an action twice.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d20-deterministic-ranking",
        text: "Ranking orders authorized candidates with deterministic tie-breaks and declared freshness.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d20-ranking-visibility",
        text: "A strategy cannot add inaccessible candidates or disclose hidden features through ranking/counts.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
      {
        id: "d20-ranking-rebuild",
        text: "Rebuild/repeated evaluation preserves the defined ordering/freshness and current visibility; unavailable strategy is explicit.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed literal requests/control assertions: benchmarks/discourse-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["dc-design-gate"],
      },
    ],
    alternatives: [],
  },
];

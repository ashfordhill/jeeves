/** Explicit bounded worker and mechanism declarations. No queue, provider or parser runs here. */
import type { ArchitectureContract, ContractField } from "./architecture-contracts.ts";
import type { BackendOperation } from "./backend-behavior-model.ts";
import type {
  BackendCapabilityConfig,
  BackendProviderReference,
} from "./backend-capability-configs-model.ts";
import type { BackendEffect } from "./backend-effects-model.ts";
import type { BackendProtocolPlan } from "./backend-protocol-model.ts";
import type { DesignDocument } from "./design.ts";
import { dcRef as ref } from "./discourse-core-data.ts";
import { discourseCoreTrace } from "./discourse-core-trace.ts";

const entity = (name: string) => ref(`dc-${name}-entity`);
const owner = (id: string) => ({ kind: "component" as const, id: `dc-${id}` });
const field = (id: string, type: ContractField["type"] = "uuid"): ContractField => ({
  id,
  name: id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
  type,
  required: true,
  description: "Trusted bounded delivery context; never client authority.",
  ...(type === "text" ? { minLength: 1, maxLength: 200 } : {}),
});
export function discourseCoreMechanisms(design: DesignDocument) {
  const a = design.architecture!,
    m = a.backend!;
  const event = a.contracts!.find((c) => c.id === "dc-post-created-event")!;
  event.shape!.payload.push(field("command-key", "text"));
  for (const e of m.effects!.filter((e) => e.payload.id === event.id)) {
    const o = m.operations!.find((o) => o.id === e.source.id)!;
    e.values.push({
      field: "command-key",
      value: {
        kind: "input",
        path: [o.target.operation === "inbound-email" ? "message-id" : "header-idempotency-key"],
      },
    });
  }
  const jobEvent = (id: string, name: string, extras: ContractField[]) => {
    const c: ArchitectureContract = {
      id,
      version: "v1",
      name,
      kind: "event",
      coverage: "Complete",
      description:
        "Exact durable causal identifiers for one bounded channel; source IDs are persisted records, never invented stand-ins.",
      shape: {
        operations: [],
        payload: [
          ...event
            .shape!.payload.filter((f) => f.id !== "post-id")
            .map((f) => ({
              ...structuredClone(f),
              description:
                "Trusted source scope/event/cutoff/provenance and stable command identity.",
            })),
          ...extras,
        ],
      },
    };
    a.contracts!.push(c);
    return c;
  };
  const cleanupEvent = jobEvent("dc-private-cleanup-event", "Private cleanup selector", [
    field("attachment-id"),
  ]);
  const projectionEvent = jobEvent("dc-projection-work-event", "Projection work selector", [
    { ...field("post-id"), nullable: true },
    { ...field("mode", "text"), enumValues: ["upsert", "rebuild"] },
  ]);
  const digestEvent = jobEvent("dc-digest-ready-event", "Digest window delivery selector", [
    field("digest-id"),
    field("principal-id"),
    { ...field("delivery-id", "text"), maxLength: 128 },
  ]);
  const privacyEvent = jobEvent("dc-privacy-progress-event", "Durable privacy progress selector", [
    field("progress-id"),
    field("subject-id"),
    { ...field("kind", "text"), enumValues: ["export", "erase"] },
    { ...field("policy-version", "text"), enumValues: ["privacy-v1"] },
  ]);
  const emailEvent = jobEvent("dc-recipient-email-event", "Per-recipient email selector", [
    field("post-id"),
    field("recipient-id"),
    field("subscription-id"),
    { ...field("delivery-id", "text"), maxLength: 128 },
  ]);
  const makeService = (name: string) => {
    const base =
      m.accessPolicies!.find((p) => p.id === `dc-${name}-entity-service-policy`) ??
      m.accessPolicies!.find((p) => p.id === `dc-${name}-entity-policy`)!;
    const p = structuredClone(base);
    p.id = `dc-${name}-worker-policy`;
    p.name = `${name} bounded service execution`;
    p.context = {
      identity: "verified-service",
      authentication: "server-established",
      scope: "authorized-scope",
      correlation: "server-established",
      service: {
        purpose: "discussion-delivery",
        authority: "server-service-identity",
        scope: "authorized-scope",
        initiatingActor: "provenance-only",
      },
    };
    p.clauses = [
      ...p.clauses.filter(
        (c) =>
          c.kind === "visibility" ||
          (c.kind === "group-grant" && c.subject.kind === "resource-field"),
      ),
      { id: "service", kind: "service-purpose", purpose: "discussion-delivery" },
    ];
    const guard = [
      "service",
      ...(p.clauses.some((c) => c.id === "category-read") ? ["category-read"] : []),
    ];
    p.rules = [
      {
        id: "service-access",
        effect: "allow",
        actions: ["read", "write", "job", "materialization", "delivery", "idempotent-replay"],
        when: { operator: "all", clauses: guard },
      },
    ];
    for (const projection of p.projections) {
      projection.when = { operator: "all", clauses: guard };
      if (projection.conditional)
        projection.conditional = projection.conditional.map((v) => ({
          ...v,
          allow: [{ operator: "all", clauses: ["visible"] }],
        }));
    }
    m.accessPolicies!.push(p);
    return ref(p.id);
  };
  const servicePolicies = new Map<string, ReturnType<typeof ref>>();
  const service = (name: string) => {
    let p = servicePolicies.get(name);
    if (!p) {
      p = makeService(name);
      servicePolicies.set(name, p);
    }
    return p;
  };
  // Recipient query retains the actual grant/member join and current persisted recipient identity.
  const recipients = structuredClone(m.queries!.find((q) => q.id === "dc-subscriptions-query")!);
  recipients.id = "dc-eligible-recipients-query";
  recipients.name = "Bounded current persisted recipients";
  recipients.accessPolicy = {
    kind: "policy",
    reference: ref("dc-subscription-entity-service-policy"),
  };
  recipients.filters.push(
    { id: "recipient", field: { source: "root", field: "principal-id" }, comparisons: ["eq"] },
    { id: "event-cutoff", field: { source: "root", field: "created-at" }, comparisons: ["lte"] },
  );
  m.queries!.push(recipients);
  const byteProvider = (
    operation: string,
    binding = "dc-private-bytes-write-object",
  ): BackendProviderReference => ({
    contract: ref("dc-private-bytes"),
    interface: "dc-private-bytes-dc-files-provided",
    operation,
    binding,
    environment: { kind: "fixture", id: "discourse-object-v1" },
    deduplication: "none",
  });
  const originalBytesBinding = a.bindings!.find((b) => b.id === "dc-private-bytes-api")!;
  a.bindings!.push({
    ...structuredClone(originalBytesBinding),
    id: "dc-private-bytes-write-object",
    operation: "write-object",
  });
  const mailProvider: BackendProviderReference = {
    contract: ref("dc-email-delivery"),
    interface: "dc-email-delivery-dc-email-provided",
    operation: "deliver-email",
    binding: "dc-email-deliver",
    environment: { kind: "fixture", id: "discourse-mail-v1" },
    deduplication: "none",
  };
  const originalMailBinding = a.bindings!.find((b) => b.id === "dc-email-send")!;
  a.bindings!.push({
    ...structuredClone(originalMailBinding),
    id: "dc-email-deliver",
    operation: "deliver-email",
  });
  const emailAdapter = structuredClone(
    a.contracts!.find((c) => c.id === "dc-email-delivery" && c.version === "v1")!,
  );
  emailAdapter.version = "v2";
  emailAdapter.coverage = "Complete";
  emailAdapter.shape!.operations.push({
    id: "lookup-delivery",
    name: "Reconcile exact delivery identity",
    description:
      "Explicit provider lookup when supported; absent lookup stays unknown/operator-visible, never a new send.",
    input: [{ ...field("delivery-id", "text"), maxLength: 128 }],
    output: [{ ...field("state", "text"), enumValues: ["accepted", "rejected", "unknown"] }],
  });
  a.contracts!.push(emailAdapter);
  const mailProvided = a.interfaces!.find((i) => i.id === mailProvider.interface)!;
  a.interfaces!.push({
    ...structuredClone(mailProvided),
    id: "dc-email-v2-provided",
    contract: ref(emailAdapter.id, "v2"),
  });
  const mailRequired = a.interfaces!.find((i) => i.id === originalMailBinding.required)!;
  a.interfaces!.push({
    ...structuredClone(mailRequired),
    id: "dc-email-v2-required",
    contract: ref(emailAdapter.id, "v2"),
  });
  a.bindings!.push(
    {
      ...structuredClone(originalMailBinding),
      id: "dc-email-v2-deliver",
      provided: "dc-email-v2-provided",
      required: "dc-email-v2-required",
      contract: ref(emailAdapter.id, "v2"),
      operation: "deliver-email",
    },
    {
      ...structuredClone(originalMailBinding),
      id: "dc-email-v2-lookup",
      provided: "dc-email-v2-provided",
      required: "dc-email-v2-required",
      contract: ref(emailAdapter.id, "v2"),
      operation: "lookup-delivery",
    },
  );
  mailProvider.contract.version = "v2";
  mailProvider.interface = "dc-email-v2-provided";
  mailProvider.binding = "dc-email-v2-deliver";
  const bytesRead = a.bindings!.find((b) => b.id === "dc-private-bytes-api")!,
    bytesCleanup = a.bindings!.find((b) => b.id === "dc-private-bytes-cleanup")!;
  a.bindings!.push(
    { ...structuredClone(bytesRead), id: "dc-private-bytes-read-object", operation: "read-object" },
    {
      ...structuredClone(bytesCleanup),
      id: "dc-private-bytes-delete-orphan",
      operation: "delete-orphan",
    },
  );
  const internal: ArchitectureContract = {
    id: "dc-worker-protocol",
    version: "v1",
    name: "Internal bounded worker operations",
    kind: "api",
    coverage: "Complete",
    description:
      "Internal module contracts on named PostgreSQL channels, never public fixture-control HTTP routes. Verified service purpose, persisted recipients/current policy, actor provenance only.",
    shape: { payload: [], operations: [] },
  };
  a.contracts!.push(internal);
  const wireOutcomes = () => [
    {
      id: "success",
      name: "Bounded attempt completed",
      kind: "Success" as const,
      condition: "Validated finite plan committed",
      state: "Committed" as const,
      retry: "Safe" as const,
      payload: [],
    },
    ...(["conflict", "rejected", "failed", "unavailable", "cancelled"] as const).map((id) => ({
      id,
      name: id,
      kind: (id === "conflict" || id === "rejected" ? "Rejection" : "Failure") as
        | "Rejection"
        | "Failure",
      condition: "Attempt unchanged; source domain command remains committed",
      state: "Unchanged" as const,
      retry: "Safe" as const,
      payload: [],
    })),
    {
      id: "uncertain",
      name: "Unknown commit or provider acknowledgement",
      kind: "Failure" as const,
      condition: "Reconcile same persisted identity before retry",
      state: "Unknown" as const,
      retry: "Reconcile first" as const,
      payload: [],
    },
  ];
  const internalOp = (
    id: string,
    component: string,
    root: string,
    procedure: BackendProtocolPlan["procedure"],
    names: string[],
    writeFields: Record<string, string[]>,
    post: string[],
    inputs: ContractField[] = event.shape!.payload,
  ) => {
    const g =
      m.aggregates.find((g) => g.version === "v2" && g.root.id === entity(root).id) ??
      m.aggregates.find((g) => g.id === "dc-discussion-aggregate" && g.version === "v2")!;
    const records: BackendProtocolPlan["records"] = names.map((name) => {
      const ent = m.entities.find((e) => e.id === entity(name).id)!;
      const policy = service(name),
        writes = (writeFields[name] ?? []).map((f) => ({
          field: f,
          source:
            f === "version"
              ? { kind: "server" as const, factory: "next-version" as const }
              : f === "id"
                ? { kind: "server" as const, factory: "uuid" as const }
                : f === "scope-id"
                  ? { kind: "context" as const, value: "scope" as const }
                  : f === "created-at"
                    ? { kind: "server" as const, factory: "clock" as const }
                    : f === "state"
                      ? { kind: "derived" as const, rule: "selected-lifecycle-transition" as const }
                      : {
                          kind: "derived" as const,
                          rule: (procedure === "projection-rebuild"
                            ? "validated-move-plan"
                            : procedure === "notification-materialize"
                              ? "post-created-event"
                              : "privacy-progress-plan") as
                            | "validated-move-plan"
                            | "post-created-event"
                            | "privacy-progress-plan",
                        },
        }));
      const d = a.datasets!.find((d) => d.id === ent.dataset)!;
      if (
        writes.length &&
        !d.writers.some((w) => w.kind === "component" && w.id === `dc-${component}`)
      )
        d.writers.push(owner(component));
      return {
        entity: entity(name),
        policy,
        action: writes.length ? "write" : "job",
        readProjection: "read",
        ...(writes.length ? { writeProjection: "write" } : {}),
        selection: inputs.some((f) => f.id === `${name}-id` && !f.nullable)
          ? "input-key"
          : name === "privacy-request" && inputs.some((f) => f.id === "progress-id")
            ? "bounded-plan"
            : "current-recipient",
        keys: inputs.some((f) => f.id === `${name}-id` && !f.nullable)
          ? [{ field: "id", input: [`${name}-id`] }]
          : name === "privacy-request" && inputs.some((f) => f.id === "progress-id")
            ? [{ field: "progress-id", input: ["progress-id"] }]
            : [],
        writes,
      };
    });
    const transitions = records.flatMap((r) => {
      const l = m.lifecycles!.find((l) => l.state.entity.id === r.entity.id);
      return l && r.writes.some((w) => w.field === "state")
        ? l.transitions.map((t) => ({ lifecycle: ref(l.id), transition: t.id, action: t.id }))
        : [];
    });
    internal.shape!.operations.push({
      id,
      name: id,
      description: post.join(" ").slice(0, 1200),
      input: structuredClone(inputs),
      output: [],
      outcomes: wireOutcomes(),
    });
    const o: BackendOperation = {
      id: `dc-${id}-operation`,
      version: "v1",
      name: id,
      target: { contract: ref(internal.id), operation: id, owner: owner(component) },
      kind: "command",
      aggregate: ref(g.id, "v2"),
      access: {
        policy: { kind: "policy", reference: service(root) },
        action: "write",
        readProjection: "read",
        writeProjection: "write",
        participants: records
          .filter((r) => r.entity.id !== entity(root).id)
          .map((r) => ({
            entity: r.entity,
            policy: { kind: "policy", reference: r.policy },
            action: r.action,
            readProjection: "read",
            ...(r.writeProjection ? { writeProjection: r.writeProjection } : {}),
          })),
      },
      guards: [],
      actions: [],
      writes: records.flatMap((r) => r.writes.map((w) => ({ entity: r.entity, field: w.field }))),
      expectedVersion: { kind: "none" },
      transaction: {
        kind: "local",
        store: "dc-db",
        participants: records.map((r) => r.entity),
        connection: "single",
        externalIO: "forbidden",
        access: "current-state-in-transaction",
        concurrency: "aggregate-policy",
        failure: "rollback",
        commit: "disconnect-is-unknown",
      },
      idempotency: {
        kind: "command-key",
        key: ["command-key"],
        identity: "operation-version-scope-principal-key",
        hash: "canonical-normalized-input-sha256",
        hashInputs: inputs.filter((f) => f.id !== "command-key").map((f) => [f.id]),
        retentionSeconds: 604800,
        publishedWindow: true,
        expired: "new-command",
        receipt: "terminal-result-in-same-transaction",
        concurrent: "one-writer-bounded-wait-or-retry",
        replay: "current-policy-before-result",
        cleanup: "separate-controlled-policy",
      },
      cancellation: {
        kind: "cooperative",
        startsWork: true,
        deadlineSeconds: 30,
        beforeCommit: "rollback",
        afterCommit: "committed-or-unknown",
      },
      outcomes: wireOutcomes().map((w) => ({
        outcome: w.id,
        trigger: w.id as
          | "success"
          | "conflict"
          | "rejected"
          | "failed"
          | "unavailable"
          | "cancelled"
          | "uncertain",
        values: [],
      })),
      protocol: {
        schemaVersion: 1,
        execution:
          a.components!.find((c) => c.id === `dc-${component}`)?.element === "dc-worker"
            ? "authorized-worker"
            : "authority-owner",
        procedure,
        locking: "all-selected-existing-rows-stable-order-then-recheck",
        inputs: inputs.map((f) => ({
          path: [f.id],
          use:
            f.id === "scope-id"
              ? "scope"
              : f.id === "command-key"
                ? "command-key"
                : "accepted-value",
        })),
        records,
        queries:
          procedure === "notification-materialize" || procedure === "external-delivery"
            ? [ref(recipients.id)]
            : [],
        hookInputs: [],
        transitions,
        versionChecks: [],
        outputs: [],
        limits: { batch: 100, deadlineSeconds: 30 },
        replay: "current-policy-before-receipt-before-version",
        failure: "no-partial-domain-writes",
        externalIO: "none",
        receipt: "atomic-terminal-command",
        preconditions: [
          "Verified bounded discussion-delivery service purpose and authorized scope; event actor is provenance only. Read persisted target/current policy at claim, materialization and delivery.",
        ],
        postconditions: post,
        acceptance: discourseCoreTrace
          .filter((r) =>
            (procedure === "notification-materialize" || procedure === "external-delivery"
              ? ["D08"]
              : procedure === "projection-rebuild"
                ? ["D11", "D20"]
                : procedure === "orphan-cleanup"
                  ? ["D09"]
                  : procedure === "privacy-resume"
                    ? ["D18"]
                    : ["D15"]
            ).includes(r.id),
          )
          .flatMap((r) => r.observations.map((o) => o.id)),
      },
    };
    m.operations!.push(o);
    if (!a.interfaces!.some((i) => i.id === `${internal.id}-${component}`))
      a.interfaces!.push({
        id: `${internal.id}-${component}`,
        name: internal.name,
        owner: owner(component),
        direction: "provided",
        necessity: "required",
        contract: ref(internal.id),
      });
    return o;
  };
  const notify = internalOp(
    "materialize-inbox",
    "notifications",
    "notification",
    "notification-materialize",
    ["notification", "subscription", "post", "topic"],
    {
      notification: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "principal-id",
        "post-id",
        "event-id",
        "subscription-id",
        "text",
      ],
    },
    [
      "Page persisted subscriptions by stable keyset and event cutoff, exclude actor/mute/revoked/hidden/removed; each channel preference checked independently before content projection.",
      "One scope/event/recipient inbox row and effect receipt commit together. Worker death before ack never duplicates; 30s fenced lease rejects stale token; selected batch≤100, durable continuation never truncates eligible recipients.",
    ],
  );
  const dispatch = internalOp(
    "dispatch-email",
    "notifications",
    "subscription",
    "external-delivery",
    ["subscription", "post", "topic"],
    {},
    [
      "Only after committed per-recipient email intent: select the exact persisted subscription/recipient IDs, recheck current access/email preference, project safe source text, then use the exact email adapter outside SQL. Inbox-disabled recipients may still select email. Stable delivery/message identity; persist sent/rejected/uncertain before ack; no blind new-key send.",
    ],
    emailEvent.shape!.payload,
  );
  dispatch.protocol!.externalIO = "committed-intent-provider-call";
  const rebuild = internalOp(
    "rebuild-projection",
    "projections",
    "search-projection",
    "projection-rebuild",
    ["search-projection", "post", "topic"],
    {
      "search-projection": [
        "post-id",
        "title",
        "plain-text",
        "projection-version",
        "as-of",
        "version",
      ],
    },
    [
      "Read current source/category/removal state in bounded100-row batches. mode=upsert selects the exact post; mode=rebuild requires postId:null and a complete scoped rebuild with atomic projection version. No stale projection resurrects hidden/removed text.",
    ],
    projectionEvent.shape!.payload,
  );
  const cleanup = internalOp(
    "cleanup-orphans",
    "cleanup",
    "attachment",
    "orphan-cleanup",
    ["attachment", "attachment-link"],
    { attachment: ["state", "version"] },
    [
      "Select only the event attachmentId, unlinked/incomplete for≥24h. Atomically fence/recheck association/version and claim staged/validated→orphan before external deletion; orphan cannot attach or validate. Delete only that immutable object key outside SQL; persist confirmed deleted or retain operator-visible uncertainty. Attached unrelated objects never selected; no broad prefix delete or forced provider cancellation.",
    ],
    cleanupEvent.shape!.payload,
  );
  cleanup.protocol!.externalIO = "committed-intent-provider-call";
  const reconcile = internalOp(
    "reconcile-email",
    "notifications",
    "digest",
    "delivery-reconcile",
    ["digest", "subscription", "topic"],
    { digest: ["state", "version"] },
    [
      "Select exact digestId/deliveryId and recipient; same stable identity, no blind resend. Fixture provider accepted lookup marks sent; absent/unknown lookup stays operator-visible uncertain, possible SMTP duplicates.",
    ],
    digestEvent.shape!.payload,
  );
  const reconcileNotification = internalOp(
    "reconcile-notification-email",
    "notifications",
    "subscription",
    "delivery-reconcile",
    ["subscription", "post", "topic"],
    {},
    [
      "Look up the exact per-recipient deliveryId; retain uncertain without resending, recheck current recipient policy before sensitive output.",
    ],
    emailEvent.shape!.payload,
  );
  const digest = internalOp(
    "deliver-digest",
    "notifications",
    "digest",
    "digest-deliver",
    ["digest", "subscription", "topic", "post"],
    {},
    [
      "Select exact digestId and persisted window/recipient. Recheck current topic/mute/email preference before creating one stable external-send intent; this source commit cannot claim provider success.",
    ],
    digestEvent.shape!.payload,
  );
  const dispatchDigest = internalOp(
    "dispatch-digest",
    "notifications",
    "digest",
    "external-delivery",
    ["digest", "subscription", "topic", "post"],
    { digest: ["state", "version"] },
    [
      "Only after committed digest email intent, recheck every current recipient/topic/preference and call the email adapter outside SQL. Accepted→sent, lost acknowledgement→uncertain v2, suppression→suppressed; no redrain send until explicit lookup accepted→sent v3.",
    ],
    digestEvent.shape!.payload,
  );
  dispatchDigest.protocol!.externalIO = "committed-intent-provider-call";
  const resume = internalOp(
    "resume-privacy",
    "notifications",
    "privacy-request",
    "privacy-resume",
    ["privacy-request", "post", "revision", "hold", "notification"],
    {
      "privacy-request": ["state", "version"],
      post: ["state", "text", "version"],
      notification: ["text"],
    },
    [
      "Select the exact progressId, subjectId, kind and policy; resume the same persisted plan/fencing token in batches≤100, current holds override erasure. Cancel only selected pending subject deliveries, preserve protected audit/holds and current export redaction. No second plan/tombstone/effect on restart/replay; terminal receipt/version advances only on completion.",
    ],
    privacyEvent.shape!.payload,
  );
  for (const [operation, contract, version, method, providerInterface, binding] of [
    [
      "put-file-bytes",
      "dc-private-bytes",
      "v1",
      "write-object",
      "dc-private-bytes-dc-files-provided",
      "dc-private-bytes-write-object",
    ],
    [
      "download-file",
      "dc-private-bytes",
      "v1",
      "read-object",
      "dc-private-bytes-dc-files-provided",
      "dc-private-bytes-read-object",
    ],
    [
      "cleanup-orphans",
      "dc-private-bytes",
      "v1",
      "delete-orphan",
      "dc-private-bytes-dc-files-provided",
      "dc-private-bytes-delete-orphan",
    ],
    [
      "dispatch-email",
      "dc-email-delivery",
      "v2",
      "deliver-email",
      "dc-email-v2-provided",
      "dc-email-v2-deliver",
    ],
    [
      "dispatch-digest",
      "dc-email-delivery",
      "v2",
      "deliver-email",
      "dc-email-v2-provided",
      "dc-email-v2-deliver",
    ],
    [
      "reconcile-email",
      "dc-email-delivery",
      "v2",
      "lookup-delivery",
      "dc-email-v2-provided",
      "dc-email-v2-lookup",
    ],
    [
      "reconcile-notification-email",
      "dc-email-delivery",
      "v2",
      "lookup-delivery",
      "dc-email-v2-provided",
      "dc-email-v2-lookup",
    ],
  ]) {
    const operationBinding = m.operations!.find((o) => o.target.operation === operation)!;
    operationBinding.protocol!.provider = {
      contract: ref(contract!, version!),
      operation: method!,
      interface: providerInterface!,
      binding: binding!,
    };
    if (operation!.startsWith("reconcile"))
      operationBinding.protocol!.externalIO = "committed-intent-provider-call";
  }
  void cleanup;
  void digest;
  void resume;
  design.connections.push({
    id: "dc-api-worker",
    kind: "depends-on",
    from: { element: "dc-api" },
    to: { element: "dc-worker" },
    planned: {
      label:
        "Publishes bounded notification/projection/cleanup/digest/privacy channels through PostgreSQL",
      protocol: "SQL",
      interaction: "Asynchronous",
      security: "Service identity",
    },
  });
  const connect = (
    source: BackendOperation,
    target: BackendOperation,
    contract: string,
    id: string,
    role: "request" | "publish" = "request",
  ) => {
    id = id
      .replaceAll("operation-", "")
      .replaceAll("discussion-", "")
      .replaceAll("post-created", "post")
      .replaceAll("projection", "proj")
      .replaceAll("transition", "state")
      .replaceAll("request", "req");
    const provided = `${id}-provided`,
      required = `${id}-required`;
    a.interfaces!.push(
      {
        id: provided,
        name: id,
        owner: role === "publish" ? source.target.owner : target.target.owner,
        direction: "provided",
        necessity: "required",
        contract: ref(contract),
      },
      {
        id: required,
        name: id,
        owner: role === "publish" ? target.target.owner : source.target.owner,
        direction: "required",
        necessity: "required",
        contract: ref(contract),
      },
    );
    a.bindings!.push({
      id,
      name: id,
      provided,
      required,
      contract: ref(contract),
      ...(role === "request" ? { operation: target.target.operation } : {}),
      relationship: { kind: "connection", id: "dc-api-worker" },
      role,
      transport: "SQL",
      businessSynchrony: "Asynchronous",
      policies: { access: { identity: "Service", tenant: "Tenant scoped", network: "Private" } },
    });
    return id;
  };
  m.capabilityConfigs ??= [];
  const configs: BackendCapabilityConfig[] = m.capabilityConfigs;
  const queue = (
    e: BackendEffect,
    component: string,
    channel: string,
    delaySeconds = 0,
    provider?: BackendProviderReference,
    reconciliation: BackendOperation = reconcileNotification,
  ) => {
    const id = `${e.id}-delivery`
      .replaceAll("operation-", "")
      .replaceAll("discussion-", "")
      .replaceAll("projection", "proj");
    configs.push({
      id,
      version: "v1",
      schemaVersion: 1,
      name: channel,
      owner: owner(component),
      kind: "delivery",
      effect: ref(e.id),
      queue: { channel, event: e.payload },
      due: { kind: "event-time", field: "at", delaySeconds },
      attempts: e.delivery.attempts,
      backoff: { kind: "sequence", seconds: [1, 5, 30] },
      leaseSeconds: 30,
      timeoutSeconds: e.delivery.timeoutSeconds,
      deadlineSeconds: 300,
      claim: "atomic-fenced-token",
      staleAcknowledgement: "reject",
      shutdown: "stop-claiming-cooperative-cancellation",
      acknowledgement: "persist-terminal-before-ack",
      unknown: provider
        ? { kind: "reconcile", operation: ref(reconciliation.id), outcome: "uncertain" }
        : { kind: "same-delivery-identity" },
      exhausted: "operator-visible",
      duplicates: e.delivery.duplicates,
      ...(provider ? { provider } : {}),
    });
    return ref(id);
  };
  for (const e of [...m.effects!].filter((e) => e.payload.id === event.id)) {
    const source = m.operations!.find((o) => o.id === e.source.id)!;
    e.target = { kind: "notification", operation: ref(notify.id), recipients: ref(recipients.id) };
    e.delivery.recipient = "each-eligible-recipient";
    e.relationshipBinding = connect(source, notify, internal.id, `${e.id}-worker`);
    queue(e, source.target.owner.id.replace(/^dc-/, ""), "discussion-notifications");
    for (const channel of ["inbox", "email"]) {
      configs.push({
        id: `${e.id}-${channel}-settings`,
        version: "v1",
        schemaVersion: 1,
        name: `Post-created ${channel} eligibility`,
        owner: owner("notifications"),
        kind: "notifications",
        effect: ref(e.id),
        recipients: ref(recipients.id),
        cutoff: {
          event: ref(event.id),
          field: "at",
          subscriptions: "created-at-or-before-event",
          filter: "event-cutoff",
        },
        preferences: {
          query: ref(recipients.id),
          principal: "principal-id",
          principalFilter: "recipient",
          enabled: channel === "inbox" ? "inbox-enabled" : "email-enabled",
          missing: "deny",
        },
        recipient: "principal-id",
        access: {
          policy: ref("dc-subscription-entity-service-policy"),
          action: "job",
          projection: "read",
        },
        fields: ["principal-id", "topic-id"],
        redaction: "current-policy-projection-before-materialization-and-delivery",
        pageSize: 100,
        maximumRecipients: 100000,
        continuation: "durable-keyset-cutoff-no-loss",
        identity: "operation-version-scope-command-effect-recipient-channel",
        channels: [{ kind: "inbox", operation: ref(notify.id) }],
      });
    }
  }
  // Reusable exact delivery intent factory for private cleanup, projection and digest work.
  const envelope = (
    source: BackendOperation,
    extra: BackendEffect["values"],
  ): BackendEffect["values"] => [
    { field: "event-id", value: { kind: "server", factory: "uuid" } },
    { field: "scope-id", value: { kind: "context", value: "scope" } },
    { field: "actor-id", value: { kind: "context", value: "principal" } },
    { field: "at", value: { kind: "server", factory: "clock" } },
    {
      field: "command-key",
      value: {
        kind: "input",
        path: [
          source.idempotency.kind === "command-key" ? source.idempotency.key[0]! : "message-id",
        ],
      },
    },
    ...extra,
  ];
  const deferred = (
    source: BackendOperation,
    target: BackendOperation,
    label: string,
    payload: ArchitectureContract,
    values: BackendEffect["values"],
    delay = 0,
  ) => {
    const base = structuredClone(m.effects!.find((e) => e.payload.id === event.id)!);
    base.id = `dc-${source.target.operation}-${label.replace("discussion-", "")}-intent`;
    base.name = label;
    base.source = ref(source.id);
    base.target = { kind: "operation", operation: ref(target.id) };
    base.payload = ref(payload.id);
    base.values = values;
    base.delivery.recipient = "single-target";
    if (source.target.operation === "privacy") base.when = ["progress-persisted"];
    if (
      a.components!.find((c) => c.id === source.target.owner.id)?.element ===
      a.components!.find((c) => c.id === target.target.owner.id)?.element
    )
      delete base.relationshipBinding;
    else base.relationshipBinding = connect(source, target, internal.id, `${base.id}-binding`);
    base.recovery = base.recovery.map((r) => ({
      ...r,
      operation: ref(source.id),
      invariants: [{ aggregate: source.aggregate, invariant: "version-fence" }],
    }));
    m.effects!.push(base);
    return {
      effect: base,
      delivery: queue(base, source.target.owner.id.replace(/^dc-/, ""), label, delay),
    };
  };
  const emailIntent = structuredClone(m.effects!.find((e) => e.payload.id === event.id)!);
  emailIntent.id = "dc-inbox-email-intent";
  emailIntent.name = "Per-recipient email intent";
  emailIntent.source = ref(notify.id);
  emailIntent.target = { kind: "operation", operation: ref(dispatch.id) };
  emailIntent.payload = ref(emailEvent.id);
  delete emailIntent.relationshipBinding;
  emailIntent.delivery.recipient = "each-eligible-recipient";
  emailIntent.values = [
    ...event
      .shape!.payload.filter((f) => f.id !== "command-key")
      .map((f) => ({ field: f.id, value: { kind: "input" as const, path: [f.id] } })),
    { field: "command-key", value: { kind: "server", factory: "delivery-identity" } },
    {
      field: "recipient-id",
      value: { kind: "current", entity: entity("subscription"), field: "principal-id" },
    },
    {
      field: "subscription-id",
      value: { kind: "current", entity: entity("subscription"), field: "id" },
    },
    { field: "delivery-id", value: { kind: "server", factory: "delivery-identity" } },
  ];
  emailIntent.recovery = emailIntent.recovery.map((r) => ({
    ...r,
    operation: ref(notify.id),
    scenario: { id: "d-failure", outcome: "d08-crash-deduplication" },
    invariants: [{ aggregate: notify.aggregate, invariant: "version-fence" }],
  }));
  m.effects!.push(emailIntent);
  const send = structuredClone(emailIntent);
  send.id = "dc-email-send-effect";
  send.name = "External eligible email dispatch";
  send.execution = "external";
  send.boundary = "after-commit";
  send.after = [ref(emailIntent.id)];
  send.delivery.acknowledgement = "unknown-is-reconcile";
  send.delivery.duplicates = "possible";
  send.recovery.push({
    trigger: "external-timeout",
    strategy: "reconcile-before-retry",
    operation: ref(dispatch.id),
    outcome: "uncertain",
    scenario: { id: "d-revoke", outcome: "d15-digest-delivery-retry" },
    invariants: [{ aggregate: notify.aggregate, invariant: "version-fence" }],
    reconcileOperation: ref(reconcileNotification.id),
  });
  m.effects!.push(send);
  const mailDelivery = queue(send, "notifications", "discussion-email", 0, mailProvider);
  for (const c of configs)
    if (c.kind === "notifications" && c.id.endsWith("email-settings"))
      c.channels = [
        {
          kind: "external",
          channel: "email",
          delivery: mailDelivery,
          provider: structuredClone(mailProvider),
        },
      ];
  const stage = m.operations!.find((o) => o.target.operation === "stage-file")!;
  const cleanupDelivery = deferred(
    stage,
    cleanup,
    "discussion-private-cleanup",
    cleanupEvent,
    envelope(stage, [
      {
        field: "attachment-id",
        value: { kind: "current", entity: entity("attachment"), field: "id" },
      },
    ]),
    86400,
  ).delivery;
  const create = m.operations!.find((o) => o.target.operation === "create-topic")!;
  const projectionDelivery = deferred(
    create,
    rebuild,
    "discussion-projections",
    projectionEvent,
    envelope(create, [
      { field: "post-id", value: { kind: "current", entity: entity("post"), field: "id" } },
      { field: "mode", value: { kind: "literal", value: "upsert" } },
    ]),
  ).delivery;
  for (const source of m.operations!.filter((o) =>
    ["reply", "edit-post", "transition-post", "inbound-email"].includes(o.target.operation),
  ))
    deferred(
      source,
      rebuild,
      `projection-${source.target.operation}`,
      projectionEvent,
      envelope(source, [
        { field: "post-id", value: { kind: "current", entity: entity("post"), field: "id" } },
        { field: "mode", value: { kind: "literal", value: "upsert" } },
      ]),
    );
  const requestRebuild = internalOp(
    "request-projection-rebuild",
    "search",
    "search-projection",
    "projection-rebuild",
    ["search-projection"],
    {},
    [
      "Privileged internal operator/fixture control request, no public HTTP route; enqueue a complete bounded scoped rebuild.",
    ],
    projectionEvent.shape!.payload,
  );
  deferred(
    requestRebuild,
    rebuild,
    "projection-rebuild",
    projectionEvent,
    projectionEvent.shape!.payload.map((f) => ({
      field: f.id,
      value: { kind: "input", path: [f.id] },
    })),
  );
  const schedule = m.operations!.find((o) => o.target.operation === "schedule-digest")!;
  deferred(
    schedule,
    digest,
    "discussion-digests",
    digestEvent,
    envelope(schedule, [
      { field: "digest-id", value: { kind: "current", entity: entity("digest"), field: "id" } },
      {
        field: "principal-id",
        value: { kind: "current", entity: entity("digest"), field: "principal-id" },
      },
      {
        field: "delivery-id",
        value: { kind: "current", entity: entity("digest"), field: "delivery-id" },
      },
    ]),
  );
  const digestIntent = deferred(
    digest,
    dispatchDigest,
    "digest-email",
    digestEvent,
    digestEvent.shape!.payload.map((f) => ({
      field: f.id,
      value: { kind: "input", path: [f.id] },
    })),
  ).effect;
  const digestSend = structuredClone(digestIntent);
  digestSend.id = "dc-digest-email-send-effect";
  digestSend.name = "External digest send after durable intent";
  digestSend.execution = "external";
  digestSend.boundary = "after-commit";
  digestSend.after = [ref(digestIntent.id)];
  digestSend.delivery.acknowledgement = "unknown-is-reconcile";
  digestSend.delivery.duplicates = "possible";
  digestSend.recovery.push({
    trigger: "external-timeout",
    strategy: "reconcile-before-retry",
    operation: ref(dispatchDigest.id),
    outcome: "uncertain",
    scenario: { id: "d-revoke", outcome: "d15-digest-delivery-retry" },
    invariants: [{ aggregate: digest.aggregate, invariant: "version-fence" }],
    reconcileOperation: ref(reconcile.id),
  });
  m.effects!.push(digestSend);
  queue(digestSend, "notifications", "discussion-digest-email", 0, mailProvider, reconcile);
  const privacy = m.operations!.find((o) => o.target.operation === "privacy")!;
  deferred(
    privacy,
    resume,
    "discussion-privacy",
    privacyEvent,
    envelope(privacy, [
      {
        field: "progress-id",
        value: { kind: "current", entity: entity("privacy-request"), field: "progress-id" },
      },
      {
        field: "subject-id",
        value: { kind: "current", entity: entity("privacy-request"), field: "principal-id" },
      },
      {
        field: "kind",
        value: { kind: "current", entity: entity("privacy-request"), field: "kind" },
      },
      { field: "policy-version", value: { kind: "input", path: ["policy-version"] } },
    ]),
  );
  configs.push({
    id: "dc-private-file-settings",
    version: "v1",
    schemaVersion: 1,
    name: "Private files and recoverable associations",
    owner: owner("attachments"),
    kind: "files",
    entity: entity("attachment"),
    parent: entity("post"),
    associationEntity: entity("attachment-link"),
    store: byteProvider("write-object"),
    maximumBytes: 10485760,
    acceptedTypes: ["text/plain", "image/png"],
    inspection: { kind: "mime-signature", mismatch: "quarantine" },
    parentAccess: { policy: ref("dc-post-entity-policy"), action: "bytes", projection: "read" },
    lifecycle: ref("dc-attachment-lifecycle"),
    states: { staged: "staged", quarantined: "orphan", attached: "attached", deleted: "deleted" },
    bytes: "current-parent-policy-attached-only",
    association: "same-scope-authorized-parent",
    cleanup: {
      delivery: cleanupDelivery,
      unattachedAfterSeconds: 86400,
      batchSize: 100,
      race: "recheck-unattached-version-before-delete",
      partialBytes: "durable-cleanup-intent",
      attached: "preserve",
    },
  });
  configs.push({
    id: "dc-search-settings",
    version: "v1",
    schemaVersion: 1,
    name: "Current-policy PostgreSQL search",
    owner: owner("search"),
    kind: "search",
    source: entity("post"),
    fields: ["text"],
    query: ref("dc-current-search-query"),
    strategy: { id: "postgresql-full-text", version: "v1", language: "simple" },
    projection: { dataset: "dc-search-projection-dataset", version: 1 },
    access: { policy: ref("dc-post-entity-policy"), action: "search", projection: "read" },
    authorization: "current-policy-before-pagination-counts-snippets",
    maximumQueryLength: 2000,
    maximumResults: 100,
    nullableText: "exclude-null-before-index-and-match",
    freshness: { kind: "bounded-staleness", maximumLagSeconds: 10, delivery: projectionDelivery },
    rebuild: {
      operation: ref(rebuild.id),
      batchSize: 100,
      swap: "atomic-projection-version",
      deletion: "current-authority-tombstone-filter",
    },
  });
  for (const o of m.operations ?? [])
    for (const r of o.protocol?.records ?? []) {
      const e = m.entities.find((e) => e.id === r.entity.id && e.version === r.entity.version)!,
        dataset = a.datasets!.find((d) => d.id === e.dataset)!;
      const host = a.components!.find((c) => c.id === o.target.owner.id)?.element;
      if (
        r.writes.length &&
        !dataset.writers.some((w) => w.kind === o.target.owner.kind && w.id === o.target.owner.id)
      )
        dataset.writers.push(o.target.owner);
      const contract = dataset.contract,
        provided = `${contract.id}-store-provided`;
      if (!a.interfaces!.some((i) => i.id === provided))
        a.interfaces!.push({
          id: provided,
          name: dataset.name,
          owner: { kind: "element", id: "dc-db" },
          direction: "provided",
          necessity: "required",
          contract,
        });
      const stem = `dc-${o.target.owner.id.replace(/^dc-/, "")}-${e.id.replace(/^dc-/, "").replace(/-entity$/, "")}-sql`;
      if (a.bindings!.some((b) => b.id === stem)) continue;
      const required = `${stem}-required`;
      a.interfaces!.push({
        id: required,
        name: dataset.name,
        owner: o.target.owner,
        direction: "required",
        necessity: "required",
        contract,
      });
      a.bindings!.push({
        id: stem,
        name: `${dataset.name} ${r.writes.length ? "write" : "read"}`,
        relationship: {
          kind: "connection",
          id: host === "dc-worker" ? "dc-worker-db" : "dc-api-db",
        },
        provided,
        required,
        contract,
        role: r.writes.length ? "write" : "read",
        transport: "SQL",
        businessSynchrony: "Synchronous",
        policies: {
          access: {
            identity: host === "dc-worker" ? "Service" : "User",
            tenant: "Tenant scoped",
            network: "Private",
          },
        },
      });
    }
  // Provider execution is after committed intent, separate from SQL; retained adapter refs are explicit.
  a.decisions!.push({
    id: "dc-provider-limits",
    name: "Provider and worker boundaries",
    context:
      "Internal worker contracts have no production HTTP routes. Object-store/SMTP implementations and credentials are unresolved; fixture environment identities are not production approval.",
    decision:
      "Byte write/delete/send occurs only outside SQL after committed stage/intent, with current policy and stable identities. Claims lease30s, three bounded delays1/5/30s, stop claiming on shutdown; stale acknowledgements reject. SMTP duplicates possible; ambiguous sends remain uncertain until explicit provider lookup/operator reconciliation. No new secret or provider network execution.",
    status: "Accepted",
    consequence:
      "Delivery remains unsupported runtime; current design is not measured crash safety or exactly-once external delivery.",
    links: [
      { kind: "binding", id: mailProvider.binding },
      { kind: "binding", id: "dc-private-bytes-cleanup" },
    ],
    acknowledgements: [],
  });
}

/** Same-store effects and bounded worker plans; no runtime or provider calls. */
import type { ArchitectureContract } from "./architecture-contracts.ts";
import type { BackendOperation } from "./backend-behavior-model.ts";
import type { BackendEffect } from "./backend-effects-model.ts";
import type { DesignDocument } from "./design.ts";
import { vcEntity as entity, vcField as field, vcRef as ref } from "./vendure-core-data.ts";
import type { VendureRecipe } from "./vendure-core-recipes.ts";
import { vendureCoreTrace } from "./vendure-core-trace.ts";

type Builder = (
  d: DesignDocument,
  c: ArchitectureContract,
  w: NonNullable<ArchitectureContract["shape"]>["operations"][number],
  r: VendureRecipe,
) => BackendOperation;
export function vendureCoreMechanisms(d: DesignDocument, build: Builder) {
  const a = d.architecture!,
    m = a.backend!;
  a.contracts!.push({
    id: "vc-command-intent",
    version: "v1",
    name: "Committed commerce command intent",
    kind: "event",
    coverage: "Complete",
    description:
      "Trusted causal identifiers; no address, cost, credentials or initiating actor authority.",
    shape: {
      operations: [],
      payload: [
        field("eventId", { type: "uuid" }),
        field("scopeId", { type: "uuid" }),
        field("commandKey", { type: "text", minLength: 1, maxLength: 200 }),
        field("at", { type: "timestamp" }),
        field("targetId", { type: "uuid" }),
      ],
    },
  });
  d.connections.push({
    id: "vc-api-worker-intent",
    kind: "depends-on",
    from: { element: "vc-api" },
    to: { element: "vc-worker" },
    planned: {
      label: "Commits SQL intent; worker claims shared database channels",
      protocol: "SQL",
      interaction: "Asynchronous",
      security: "Service identity",
    },
  });
  for (const c of a.components!.filter((c) =>
    ["vc-expiry", "vc-projections", "vc-notifications"].includes(c.id),
  ))
    c.usesConnections = [...(c.usesConnections ?? []), "vc-api-worker-intent"];
  const workers = addWorkers(d, build);
  addProviderHookEffect(d);
  for (const o of [...m.operations!].filter((o) => o.kind === "command")) {
    const key =
      o.idempotency.kind === "command-key"
        ? o.idempotency.key
        : o.idempotency.kind === "source-message"
          ? o.idempotency.message
          : [];
    const obs = vendureCoreTrace
        .flatMap((r) => r.observations)
        .find((ob) => o.protocol!.acceptance.includes(ob.id))!,
      sc = obs.scenarios[0]!;
    const e: BackendEffect = {
      id: `${o.id}-intent`,
      version: "v1",
      name: `${o.name} durable intent`,
      source: ref(o.id),
      when: ["success"],
      target: { kind: "event", contract: ref("vc-command-intent") },
      boundary: "atomic-intent",
      execution: "durable-intent",
      payload: ref("vc-command-intent"),
      values: [
        { field: "event-id", value: { kind: "server", factory: "uuid" } },
        { field: "scope-id", value: { kind: "context", value: "scope" } },
        { field: "command-key", value: { kind: "input", path: key } },
        { field: "at", value: { kind: "server", factory: "clock" } },
        {
          field: "target-id",
          value: {
            kind: "current",
            entity: m.aggregates.find(
              (g) => g.id === o.aggregate.id && g.version === o.aggregate.version,
            )!.root,
            field: "id",
          },
        },
      ],
      required: true,
      loss: { kind: "forbidden" },
      after: [],
      delivery: {
        identity: "operation-version-scope-command-effect-recipient",
        context: "verified-service-actor-provenance-only",
        recheck: "current-policy-before-effect",
        recipient: "single-target",
        guarantee: "at-least-once",
        acknowledgement: "durable-terminal-result",
        attempts: 3,
        backoffSeconds: 1,
        timeoutSeconds: 5,
        exhausted: "operator-visible",
        duplicates: "deduplicated-local-effect",
      },
      recovery: (["uncertain-commit", "lost-acknowledgement"] as const).map((trigger) => ({
        trigger,
        strategy: "same-command-key",
        operation: ref(o.id),
        outcome: "uncertain",
        scenario: { id: sc.id.toLowerCase(), outcome: obs.id.toLowerCase() },
        invariants: [{ aggregate: o.aggregate, invariant: "version-fence" }],
      })),
    };
    m.effects!.push(e);
    // Order-affecting commands append safe history and audit on the same connection; these
    // source-authorized local effect participants have no second independent observation policy.
    if (o.protocol!.execution === "authorized-worker") continue;
    if (!o.transaction.participants.some((p) => p.id === entity("order").id)) continue;
    for (const name of ["history", "audit"]) {
      if (o.protocol!.records.some((r) => r.entity.id === entity(name).id)) continue;
      const local: BackendEffect = {
        ...structuredClone(e),
        id: `${o.id}-${name}`,
        name: `${o.name} ${name}`,
        target: { kind: "audit", dataset: `vc-${name}-dataset`, contract: ref(`vc-${name}-data`) },
        boundary: "before-commit",
        execution: "local",
        payload: ref(`vc-${name}-data`),
        values: [
          { field: "id", value: { kind: "server", factory: "uuid" } },
          { field: "scope-id", value: { kind: "context", value: "scope" } },
          { field: "version", value: { kind: "server", factory: "initial-version" } },
          { field: "created-at", value: { kind: "server", factory: "clock" } },
          { field: "order-id", value: { kind: "current", entity: entity("order"), field: "id" } },
          { field: "actor-id", value: { kind: "context", value: "principal" } },
          { field: "action", value: { kind: "literal", value: o.target.operation } },
          { field: "at", value: { kind: "server", factory: "clock" } },
        ],
        delivery: {
          ...e.delivery,
          context: "source-transaction-context",
          guarantee: "local-atomic",
          acknowledgement: "same-commit",
          attempts: 1,
          backoffSeconds: 0,
        },
      };
      m.effects!.push(local);
      o.transaction.participants.push(entity(name));
      o.protocol!.records.push({
        entity: entity(name),
        policy: ref(`vc-${name}-policy`),
        action: "read",
        readProjection: "read",
        selection: "local-effect",
        keys: [],
        writes: [],
      });
    }
  }
  for (const [source, consumer] of workers) {
    const e = m.effects!.find((e) => e.id === `vc-${source}-operation-intent`);
    if (e && e.target.kind === "event") {
      e.target.consumer = ref(`vc-${consumer}-operation`);
      const sourceOp = m.operations!.find((o) => o.id === e.source.id)!,
        target = m.operations!.find((o) => o.id === `vc-${consumer}-operation`)!;
      if (
        a.components!.find((c) => c.id === sourceOp.target.owner.id)?.element ===
        a.components!.find((c) => c.id === target.target.owner.id)?.element
      )
        continue;
      const id = `vc-channel-${source}`;
      a.interfaces!.push(
        {
          id: id + "-provided",
          name: id,
          owner: sourceOp.target.owner,
          direction: "provided",
          necessity: "required",
          contract: e.payload,
        },
        {
          id: id + "-required",
          name: id,
          owner: target.target.owner,
          direction: "required",
          necessity: "required",
          contract: e.payload,
        },
      );
      a.bindings!.push({
        id,
        name: id,
        relationship: { kind: "connection", id: "vc-api-worker-intent" },
        provided: id + "-provided",
        required: id + "-required",
        contract: e.payload,
        role: "publish",
        transport: "SQL",
        businessSynchrony: "Asynchronous",
      });
      e.relationshipBinding = id;
    }
  }
  m.capabilityConfigs = [
    {
      id: "vc-money",
      version: "v1",
      schemaVersion: 1,
      name: "Exact immutable USD arithmetic",
      owner: { kind: "component", id: "vc-carts" },
      kind: "money",
      fields: m.entities.flatMap((e) =>
        e.fields
          .filter((f) => f.storage.kind === "money")
          .map((f) => ({ entity: ref(e.id), field: f.field })),
      ),
      currencies: ["USD"],
      minimumMinorUnits: 0,
      maximumMinorUnits: 9007199254740991,
      maximumTotalMinorUnits: 9007199254740991,
      maximumQuantity: 1000,
      maximumLines: 100,
      arithmetic: "checked-integer-minor-units",
      overflow: "reject-before-write",
      currency: "single-currency-per-quote",
    },
  ];
  for (const [source, consumer] of workers) {
    const e = m.effects!.find((e) => e.id === `vc-${source}-operation-intent`);
    if (!e) continue;
    m.capabilityConfigs.push({
      id: `vc-${source}-${consumer}-delivery`,
      version: "v1",
      schemaVersion: 1,
      name: `${consumer} bounded channel`,
      owner: m.operations!.find((o) => o.id === e.source.id)!.target.owner,
      kind: "delivery",
      effect: ref(e.id),
      queue: { channel: `vc-${consumer}`, event: e.payload },
      due:
        consumer === "expire-reservations"
          ? { kind: "event-time", field: "at", delaySeconds: 900 }
          : { kind: "immediate" },
      attempts: 3,
      backoff: { kind: "sequence", seconds: [1, 5, 30] },
      leaseSeconds: 30,
      timeoutSeconds: 5,
      deadlineSeconds: 60,
      claim: "atomic-fenced-token",
      staleAcknowledgement: "reject",
      shutdown: "stop-claiming-cooperative-cancellation",
      acknowledgement: "persist-terminal-before-ack",
      unknown: { kind: "same-delivery-identity" },
      exhausted: "operator-visible",
      duplicates: "deduplicated-local-effect",
    });
  }
}

function addWorkers(d: DesignDocument, build: Builder): [string, string][] {
  const a = d.architecture!,
    m = a.backend!,
    event = a.contracts!.find((c) => c.id === "vc-command-intent")!;
  const internal: ArchitectureContract = {
    id: "vc-worker-protocol",
    version: "v1",
    name: "Bounded internal commerce channels",
    kind: "api",
    coverage: "Complete",
    description:
      "Internal module calls only, no HTTP route or fixture fault/reset controls. Trusted service purpose and current persisted scope/recipient.",
    shape: { payload: [], operations: [] },
  };
  a.contracts!.push(internal);
  const services = new Map<string, { id: string; version: string }>();
  const service = (name: string) => {
    const existing = services.get(name);
    if (existing) return existing;
    const base =
      m.accessPolicies!.find((p) => p.id === `vc-${name}-command-policy`) ??
      m.accessPolicies!.find((p) => p.id === `vc-${name}-policy`)!;
    const p = structuredClone(base);
    p.id = `vc-${name}-worker-policy`;
    p.context = {
      identity: "verified-service",
      authentication: "server-established",
      scope: "authorized-scope",
      correlation: "server-established",
      service: {
        purpose: "commerce-work",
        authority: "server-service-identity",
        scope: "authorized-scope",
        initiatingActor: "provenance-only",
      },
    };
    p.clauses = [{ id: "service", kind: "service-purpose", purpose: "commerce-work" }];
    p.rules = [
      {
        id: "service",
        effect: "allow",
        actions: ["read", "write", "job", "idempotent-replay"],
        when: { operator: "all", clauses: ["service"] },
      },
    ];
    const fs = m.entities.find((e) => e.id === entity(name).id)!.fields;
    p.projections = [
      {
        id: "read",
        mode: "read",
        fields: fs.map((f) => f.field),
        when: { operator: "all", clauses: ["service"] },
        unknownFields: "reject",
      },
      {
        id: "write",
        mode: "write",
        fields: fs.filter((f) => !f.serverOwned).map((f) => f.field),
        when: { operator: "all", clauses: ["service"] },
        unknownFields: "reject",
      },
    ];
    m.accessPolicies!.push(p);
    const r = ref(p.id);
    services.set(name, r);
    return r;
  };
  const specs: [string, string, VendureRecipe, string[]][] = [
    [
      "expire-reservations",
      "expiry",
      {
        procedure: "reservation-expire",
        root: "reservation",
        records: ["order", "stock", "payment"],
        writes: { reservation: ["state", "version"] },
        pre: [
          "Bounded due claims use persisted deadline; lock order/reservations then stockUUID, recheck claim token/current state/version/due. No invented seed expiry or active expiry while a submitted/unknown attempt exists.",
        ],
        post: [
          "Only active+awaiting-payment expires once after restart. Held/consumed never expire. Race with start-payment: if payment wins before deadline keep held; if expiry wins start-payment422 with no provider call.",
        ],
      },
      ["V06-expiration-payment-race", "V06-held-payment-expiry"],
    ],
    [
      "submit-payment",
      "expiry",
      {
        procedure: "payment-submit",
        root: "payment",
        records: [],
        writes: { payment: ["state", "version"] },
        pre: [
          "Original attempt is createdv1 with committed hold and stable provider/request/amount. No provider call in this command.",
        ],
        post: [
          "One local commit sets submittedv2 and durable dispatch intent. Crash before commit retries original; crash after commit replays receipt, then dispatches from the persisted intent.",
        ],
      },
      ["V08-unknown-outcome"],
    ],
    [
      "submit-payout",
      "expiry",
      {
        procedure: "financial-submit",
        root: "settlement",
        records: [],
        writes: { settlement: ["state", "version"] },
        pre: [
          "Original seller entitlement is planned with immutable payout identity. No provider call in this command.",
        ],
        post: [
          "One local commit sets submitted and durable dispatch intent before external payout; retries preserve original identity.",
        ],
      },
      ["V17-settlement-recovery"],
    ],
    [
      "dispatch-payment",
      "expiry",
      {
        procedure: "payment-dispatch",
        root: "payment",
        records: ["order", "reservation", "stock", "reconciliation"],
        writes: {
          payment: ["state", "provider-id", "version"],
          order: ["state", "version"],
          reservation: ["state", "version"],
          stock: ["allocated", "version"],
        },
        external: "committed-intent-provider-call",
        pre: [
          "Persist attempt/held stock, then separate submit-payment commits submittedv2/dispatch intent before this operation. Send outside SQL and acquire current locks for the result only. Configured provider/request/amount identity only; availability before source mutation.",
        ],
        post: [
          "Accepted response loss leaves providerId:null, unknownv3/reviewv3 and heldv2. Never invent returned ID or new key. Authoritative settled result consumes/allocates exactly once. Reference7day retention differs from Stripe23hour same-key automatic retry; later uncertainty requires account reconciliation.",
        ],
      },
      ["V08-unknown-outcome"],
    ],
    [
      "dispatch-refund",
      "expiry",
      {
        procedure: "financial-dispatch",
        root: "refund",
        records: ["order", "reconciliation"],
        writes: { refund: ["state", "version"] },
        external: "committed-intent-provider-call",
        pre: [
          "Committed approved refund identity/quantity/amount ceilings before dispatch; after-inspection stock remains independent.",
        ],
        post: [
          "One original refund key, unknown after send/ack loss; authoritative read-only reconciliation settles that identity, no new dispatch or release of pending ceiling.",
        ],
      },
      ["V16-refund-uncertainty"],
    ],
    [
      "dispatch-payout",
      "expiry",
      {
        procedure: "financial-dispatch",
        root: "settlement",
        records: ["seller", "reconciliation"],
        writes: { settlement: ["state", "version"] },
        external: "committed-intent-provider-call",
        pre: [
          "Committed seller/window entitlement and payout identity before external send; current seller scope.",
        ],
        post: [
          "Unknown remains visible; lookup original payout identity, never closing-window duplicate or customer charge rollback.",
        ],
      },
      ["V17-settlement-recovery"],
    ],
    [
      "materialize-notification",
      "notifications",
      {
        procedure: "commerce-notify",
        root: "notification",
        records: ["order", "membership", "delivery"],
        writes: {
          notification: [
            "id",
            "scope-id",
            "created-at",
            "version",
            "order-id",
            "recipient-id",
            "event-id",
            "action",
            "state",
            "at",
          ],
          delivery: [
            "id",
            "scope-id",
            "created-at",
            "version",
            "notification-id",
            "request-key",
            "state",
          ],
        },
        creates: ["notification", "delivery"],
        pre: [
          "Resolve persisted order owner/current active membership, event cutoff and source action; actor is provenance. Current recipient policy before constructing safe metadata.",
        ],
        post: [
          "Unique event/recipient inbox and delivery identity/worker effect receipt commit together. Revoked suppresses before materialize/read/send. Crash after SQL before ack then fenced reclaim preserves one logical notification.",
        ],
      },
      ["V12-internal-effect-retry"],
    ],
    [
      "deliver-notification",
      "notifications",
      {
        procedure: "commerce-delivery",
        root: "delivery",
        records: ["notification", "order", "membership"],
        writes: { delivery: ["state", "version"] },
        external: "committed-intent-provider-call",
        pre: [
          "Current persisted recipient membership/order owner, never initiating actor authority; stable committed delivery key.",
        ],
        post: [
          "Send outside SQL; unknown acknowledgement requires original delivery identity reconciliation. SMTP may duplicate, never exactly-once claim or source shipment rollback.",
        ],
      },
      ["V12-notification-redaction"],
    ],
    [
      "rebuild-catalog",
      "projections",
      {
        procedure: "commerce-projection",
        root: "search-projection",
        records: ["product", "variant"],
        writes: {
          "search-projection": [
            "id",
            "scope-id",
            "created-at",
            "version",
            "variant-id",
            "product-id",
            "text",
            "projection-version",
          ],
        },
        pre: [
          "Bounded max100 keyset source pages, current authoritative product/variant publication; no private cost/stock.",
        ],
        post: [
          "Upsert public projection with stable source IDs/version, durable continuation. Current read policy still precedes matching/snippets/pages so hidden source cannot resurrect after rebuild.",
        ],
      },
      ["V10-search-rebuild"],
    ],
  ];
  for (const [id, component, r, acceptance] of specs) {
    const w: NonNullable<ArchitectureContract["shape"]>["operations"][number] = {
      id,
      name: id,
      description: "Internal bounded service command; not publicly routed.",
      input: structuredClone(event.shape!.payload),
      output: [],
      behavior: { kind: "Command" },
      outcomes: [
        {
          id: "success",
          name: "Committed bounded step",
          kind: "Success",
          condition: "Exact finite local step committed",
          state: "Committed",
          retry: "Safe",
          payload: [],
        },
        ...["conflict", "rejected", "failed", "unavailable", "cancelled"].map((id) => ({
          id,
          name: id,
          kind: "Failure" as const,
          condition: "Delivery attempt unchanged; source remains committed",
          state: "Unchanged" as const,
          retry: "Safe" as const,
          ...(id === "unavailable" ? { status: 503 } : {}),
          payload: [],
        })),
        {
          id: "uncertain",
          name: "Unknown acknowledgement",
          kind: "Failure",
          condition: "Reconcile the same durable identity",
          state: "Unknown",
          retry: "Reconcile first",
          payload: [],
        },
      ],
    };
    internal.shape!.operations.push(w);
    a.interfaces!.push({
      id: `vc-${id}-provided`,
      name: id,
      owner: { kind: "component", id: `vc-${component}` },
      direction: "provided",
      necessity: "required",
      contract: ref(internal.id),
    });
    // The common module contract has a different exact owner per operation. Pass a scoped interface
    // while building, then retain every original interface; explicit owner is recorded on operation.
    const first = a.interfaces!.find(
      (i) => i.direction === "provided" && i.contract.id === internal.id,
    )!;
    const oldOwner = first.owner;
    first.owner = { kind: "component", id: `vc-${component}` };
    if (r.records.includes("order")) {
      r.records.push("history", "audit");
      r.creates = [...(r.creates ?? []), "history", "audit"];
      for (const name of ["history", "audit"])
        r.writes![name] = [
          "id",
          "scope-id",
          "created-at",
          "version",
          "order-id",
          "actor-id",
          "action",
          "at",
        ];
    }
    const o = build(d, internal, w, r);
    first.owner = oldOwner;
    o.target.owner = { kind: "component", id: `vc-${component}` };
    o.protocol!.execution = "authorized-worker";
    o.protocol!.acceptance = acceptance;
    o.expectedVersion = { kind: "none" };
    for (const rec of o.protocol!.records) {
      const name = rec.entity.id.slice(3, -7);
      rec.policy = service(name);
      rec.action = rec.writes.length ? "write" : "job";
      if (id === "materialize-notification" && name === "notification") {
        rec.selection = "server-created";
        rec.writes.find((w) => w.field === "state")!.source = {
          kind: "derived",
          rule: "selected-lifecycle-transition",
        };
        o.protocol!.transitions.push({
          lifecycle: ref("vc-notification-lifecycle"),
          transition: "materialize",
          action: "materialize",
        });
      }
      const ds = a.datasets!.find(
        (ds) => ds.id === m.entities.find((e) => e.id === rec.entity.id)!.dataset,
      )!;
      if (
        rec.writes.length &&
        !ds.writers.some((x) => x.kind === "component" && x.id === `vc-${component}`)
      )
        ds.writers.push({ kind: "component", id: `vc-${component}` });
    }
    const root = m.aggregates.find(
        (g) => g.id === o.aggregate.id && g.version === o.aggregate.version,
      )!.root,
      rec = o.protocol!.records.find((r) => r.entity.id === root.id)!;
    o.access = {
      policy: { kind: "policy", reference: rec.policy },
      action: rec.action,
      readProjection: "read",
      ...(rec.writeProjection ? { writeProjection: rec.writeProjection } : {}),
      participants: o
        .protocol!.records.filter((r) => r !== rec)
        .map((r) => ({
          entity: r.entity,
          policy: { kind: "policy", reference: r.policy },
          action: r.action,
          readProjection: "read",
          ...(r.writeProjection ? { writeProjection: r.writeProjection } : {}),
        })),
    };
    o.idempotency = { ...o.idempotency, kind: "command-key" } as BackendOperation["idempotency"];
    o.outcomes = o.outcomes.map((v) => ({
      ...v,
      trigger:
        v.outcome === "success"
          ? "success"
          : v.outcome === "uncertain"
            ? "uncertain"
            : v.outcome === "failed"
              ? "failed"
              : v.outcome === "cancelled"
                ? "cancelled"
                : v.outcome === "unavailable"
                  ? "unavailable"
                  : v.outcome === "conflict"
                    ? "conflict"
                    : "rejected",
    }));
  }
  for (const o of m.operations!.filter((o) => o.protocol?.execution !== "authorized-worker")) {
    const root = m.aggregates.find(
      (g) => g.id === o.aggregate.id && g.version === o.aggregate.version,
    )!.root;
    for (const rec of o.protocol!.records) {
      if (rec.entity.id === root.id) continue;
      const name = rec.entity.id.slice(3, -7);
      if (
        ["payment-callback", "warehouse-apply"].includes(o.protocol!.procedure) ||
        name === "stock" ||
        name === "reconciliation" ||
        (o.target.operation === "seller-settlement" && ["order", "payment"].includes(name))
      ) {
        rec.policy = service(name);
        rec.authority = "source-authorized-module";
        const use = o.access.participants!.find((v) => v.entity.id === rec.entity.id)!;
        use.policy = { kind: "policy", reference: rec.policy };
      }
    }
  }
  return [
    ["checkout", "expire-reservations"],
    ["start-payment", "submit-payment"],
    ["submit-payment", "dispatch-payment"],
    ["stripe-payment", "submit-payment"],
    ["return-refund", "dispatch-refund"],
    ["seller-settlement", "submit-payout"],
    ["submit-payout", "dispatch-payout"],
    ["create-shipment", "materialize-notification"],
    ["materialize-notification", "deliver-notification"],
    ["publish", "rebuild-catalog"],
  ];
}

function addProviderHookEffect(d: DesignDocument) {
  const a = d.architecture!,
    m = a.backend!,
    h = m.hooks!.find((h) => h.id === "vc-jh-provider")!,
    source = m.operations!.find((o) => o.id === h.operation.id)!,
    delivery = m.operations!.find((o) => o.id === "vc-dispatch-payment-operation")!;
  delete source.protocol!.hook;
  source.protocol!.hookInputs = [];
  h.services = [ref(delivery.id)];
  h.kind = "effectful";
  h.boundary = "after-commit";
  h.context.push("service-purpose");
  h.failure = {
    operation: ref(delivery.id),
    scope: "separate-delivery-attempt",
    error: "failed",
    invalidResult: "failed",
    timeout: "failed",
    cancelled: "cancelled",
  };
  h.recovery = [];
  // Materialized source attempt identity is the sole authority; no external call is pure/precommit.
  const f = (field: string) => ({ kind: "current" as const, entity: entity("payment"), field });
  const payload = a.contracts!.find((c) => c.id === h.contracts.input.id)!.shape!.payload;
  const values = payload.map((p) => ({
    field: p.id,
    value:
      p.id === "scope-id"
        ? { kind: "context" as const, value: "scope" as const }
        : p.id === "principal-id"
          ? { kind: "context" as const, value: "principal" as const }
          : p.id === "payment-id"
            ? f("id")
            : ["request-key", "amount", "provider-id"].includes(p.id)
              ? f(p.id)
              : {
                  kind: "literal" as const,
                  value:
                    p.id === "action"
                      ? "dispatch"
                      : p.id === "api-version"
                        ? "2025-03-31.basil"
                        : p.id === "verified-body-sha256"
                          ? null
                          : "stripe-provider-v1",
                },
  }));
  const ob = vendureCoreTrace
      .find((r) => r.id === "V19")!
      .observations.find((o) => o.category === "failure")!,
    sc = ob.scenarios[0]!;
  const recovery = (["uncertain-commit", "lost-acknowledgement", "external-timeout"] as const).map(
    (trigger) => ({
      trigger,
      strategy: "reconcile-before-retry" as const,
      operation: ref(trigger === "uncertain-commit" ? source.id : delivery.id),
      outcome: "uncertain",
      scenario: { id: sc.id.toLowerCase(), outcome: ob.id.toLowerCase() },
      invariants: [{ aggregate: delivery.aggregate, invariant: "version-fence" }],
      reconcileOperation: ref("vc-reconcile-payment-operation"),
    }),
  );
  const e: BackendEffect = {
    id: "vc-stripe-provider-effect",
    version: "v1",
    name: "Required concrete Stripe adapter after committed hold",
    source: ref(source.id),
    when: ["success"],
    target: { kind: "hook", hook: ref(h.id) },
    boundary: "after-commit",
    execution: "external",
    payload: h.contracts.input,
    values,
    required: true,
    loss: { kind: "forbidden" },
    after: [ref(`${source.id}-intent`)],
    delivery: {
      identity: "operation-version-scope-command-effect-recipient",
      context: "verified-service-actor-provenance-only",
      recheck: "current-policy-before-effect",
      recipient: "single-target",
      guarantee: "at-least-once",
      acknowledgement: "unknown-is-reconcile",
      attempts: 1,
      backoffSeconds: 0,
      timeoutSeconds: 5,
      exhausted: "operator-visible",
      duplicates: "destination-key",
    },
    recovery,
  };
  m.effects!.push(e);
}

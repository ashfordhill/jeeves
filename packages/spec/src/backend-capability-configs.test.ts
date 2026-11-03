import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { contractKey } from "./architecture-contracts.ts";
import {
  buildArchitectureHandoff,
  handoffFingerprint,
  handoffJson,
  handoffMarkdown,
} from "./architecture-handoff.ts";
import {
  type ArchitectureLibraryEntry,
  extractArchitectureTemplate,
  previewArchitectureTemplate,
} from "./architecture-library.ts";
import { fragmentIds, mappedArchitecture } from "./architecture-patterns.ts";
import { reviewArchitecture } from "./architecture-review.ts";
import { targetChanges } from "./architecture-targets.ts";
import { validateBackendBehavior } from "./backend-behavior.ts";
import {
  backendCapabilityExactReferences,
  backendCapabilityReferences,
  validateBackendCapabilityConfigs,
  validateBackendCapabilityTransition,
} from "./backend-capability-configs.ts";
import {
  type BackendCapabilityConfig,
  type BackendProviderReference,
  backendCapabilityConfigSchema,
} from "./backend-capability-configs-model.ts";
import { backendDataRemovalFindings } from "./backend-data.ts";
import {
  type BackendEffect,
  type BackendRecovery,
  backendEffectSchema,
  backendHookSchema,
} from "./backend-effects-model.ts";
import { backendModelSchema, mapBackendModel } from "./backend-model.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { blocksGenerate, isStructural } from "./findings.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

const ref = (id: string, version = "v1") => ({ id, version });
function need<T>(v: T | undefined | null): T {
  if (v == null) throw new Error("Missing fixture");
  return v;
}
const model = (d: DesignDocument) => need(d.architecture?.backend);
const operation = (d: DesignDocument, i = 0) => need(model(d).operations?.[i]);
const wire = (d: DesignDocument) =>
  need(d.architecture?.contracts?.find((c) => c.id === "commands")?.shape?.operations[0]);
const input = (id: string) => ({ kind: "input" as const, path: [id] });
const literal = (value: string | number | boolean | null) => ({ kind: "literal" as const, value });
const current = (field: string) => ({ kind: "current" as const, entity: ref("record"), field });
const errors = (d: DesignDocument) => validateDesign(d, testLookup).filter(isStructural);
const save = (before: DesignDocument, after: DesignDocument) =>
  applyOperations(
    before,
    [{ op: "setArchitecture", architecture: after.architecture ?? null }],
    testLookup,
  );
// Synthetic command/recovery fixture adapted from P65/P66a; never application evidence.
function baseFixture(domain: "post" | "order" | "ticket" = "post"): DesignDocument {
  const states =
    domain === "post"
      ? ["open", "closed"]
      : domain === "order"
        ? ["cart", "submitted", "paid"]
        : ["unassigned", "assigned", "resolved"];
  const action = domain === "post" ? "edit" : domain === "order" ? "checkout" : "assign";
  const fields = [
    { id: "id", type: "uuid" },
    { id: "scope", type: "uuid" },
    { id: "author", type: "uuid" },
    { id: "version", type: "integer", minimum: 0, maximum: 1000000 },
    { id: "state", type: "text", enumValues: states },
    { id: "body", type: "text", minLength: 1, maxLength: 16000 },
    { id: "assignee", type: "uuid", nullable: true },
    { id: "updated", type: "timestamp" },
  ].map((f) => ({ ...f, name: f.id, required: true }));
  const outcomes = [
    {
      id: "ok",
      name: "Success",
      kind: "Success",
      state: "Committed",
      retry: "Safe",
      condition: "Committed one local transaction",
      status: 200,
    },
    {
      id: "conflict",
      name: "Conflict",
      kind: "Rejection",
      state: "Unchanged",
      retry: "After correction",
      condition: "CAS, lifecycle or changed-input command-key conflict",
      status: 409,
    },
    {
      id: "rejected",
      name: "Rejected",
      kind: "Rejection",
      state: "Unchanged",
      retry: "After correction",
      condition: "Denied or guard rejected",
      status: 422,
    },
    {
      id: "failed",
      name: "Failed",
      kind: "Failure",
      state: "Unchanged",
      retry: "Safe",
      condition: "Confirmed rollback",
      status: 500,
    },
    {
      id: "unavailable",
      name: "Unavailable",
      kind: "Failure",
      state: "Unchanged",
      retry: "Safe",
      condition: "Required capability not ready; zero mutation",
      status: 503,
    },
    {
      id: "cancelled",
      name: "Cancelled",
      kind: "Failure",
      state: "Unchanged",
      retry: "Safe",
      condition: "Cooperative cancellation before commit",
      status: 408,
    },
    {
      id: "uncertain",
      name: "Unknown commit",
      kind: "Failure",
      state: "Unknown",
      retry: "Reconcile first",
      condition: "Disconnect after commit may have occurred",
      status: 503,
    },
  ];
  const values = [
    { field: "version", value: { kind: "server", factory: "next-version" } },
    {
      field: domain === "ticket" ? "assignee" : "body",
      value: input(domain === "ticket" ? "assignee" : "body"),
    },
    { field: "updated", value: { kind: "server", factory: "clock" } },
  ];
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [
      { id: "api", name: "API", template: null, planned: "application-api" },
      { id: "store", name: "SQL authority", template: null, planned: "relational-store" },
    ],
    architecture: {
      system: { name: "Synthetic command design", description: "Finite semantics only" },
      components: [
        {
          id: "module",
          element: "api",
          name: "Domain",
          capability: "domain-module",
          config: {},
          members: [],
          usesResources: [],
          usesConnections: [],
          responsibility: "",
        },
      ],
      contracts: [
        {
          id: "record-data",
          version: "v1",
          name: "Record",
          kind: "data",
          coverage: "Complete",
          shape: { payload: fields, operations: [] },
        },
        {
          id: "strategy-result",
          version: "v1",
          name: "Checkout result",
          kind: "data",
          coverage: "Complete",
          shape: {
            payload: [{ id: "order-id", name: "orderId", type: "uuid", required: true }],
            operations: [],
          },
        },
        {
          id: "commands",
          version: "v1",
          name: "Commands",
          kind: "api",
          coverage: "Complete",
          shape: {
            payload: [],
            operations: [
              {
                id: action,
                name: action,
                input: [
                  {
                    id: "key",
                    name: "key",
                    type: "text",
                    required: true,
                    minLength: 1,
                    maxLength: 200,
                  },
                  {
                    id: "expected",
                    name: "expected",
                    type: "integer",
                    required: true,
                    minimum: 0,
                    maximum: 1000000,
                  },
                  {
                    id: "body",
                    name: "body",
                    type: "text",
                    required: true,
                    minLength: 1,
                    maxLength: 16000,
                  },
                  { id: "assignee", name: "assignee", type: "uuid", required: true },
                  { id: "cart-id", name: "cartId", type: "uuid", required: true },
                ],
                output: [
                  {
                    id: "body",
                    name: "body",
                    type: "text",
                    required: true,
                    minLength: 1,
                    maxLength: 16000,
                  },
                ],
                behavior: {
                  kind: "Command",
                  preconditions: "Explanation is not parsed",
                  transaction: "Explanation only",
                },
                outcomes,
              },
            ],
          },
        },
      ],
      interfaces: [
        {
          id: "provided",
          name: "Commands",
          owner: { kind: "component", id: "module" },
          direction: "provided",
          contract: ref("commands"),
          necessity: "required",
        },
      ],
      datasets: [
        {
          id: "records",
          name: "Records",
          contract: ref("record-data"),
          owners: [{ kind: "element", id: "api" }],
          readers: [],
          writers: [],
          ownershipDecision: "",
          store: "store",
          tenant: "Tenant scoped",
          deletion: "Retain",
          exportAccess: "Authorized staff",
        },
      ],
      backend: {
        schemaVersion: 1,
        entities: [
          {
            id: "record",
            version: "v1",
            name: "Record",
            dataset: "records",
            contract: ref("record-data"),
            storageId: "record-table",
            fields: fields.map((f) => ({
              field: f.id,
              storageId: `${f.id}-column`,
              required: true,
              nullable: !!f.nullable,
              storage: { kind: "scalar" },
              ...(["id", "scope", "author", "version", "updated"].includes(f.id)
                ? {
                    serverOwned:
                      f.id === "author" ? "principal" : f.id === "updated" ? "clock" : f.id,
                  }
                : {}),
            })),
            primaryKey: ["scope", "id"],
            scope: { kind: "field", field: "scope" },
            relations: [],
          },
        ],
        aggregates: [
          {
            id: "aggregate",
            version: "v1",
            name: "Aggregate",
            root: ref("record"),
            children: [],
            owner: { kind: "component", id: "module" },
            store: "store",
            concurrency: {
              kind: "optimistic",
              version: { entity: ref("record"), field: "version" },
            },
            invariants: [],
          },
        ],
        accessPolicies: [
          {
            id: "policy",
            version: "v1",
            name: "Owner commands",
            resource: ref("record"),
            context: {
              identity: "session-principal",
              authentication: "server-established",
              scope: "authorized-scope",
              correlation: "server-established",
            },
            default: "deny",
            conflict: "deny-wins",
            clauses: [{ id: "auth", kind: "authenticated" }],
            rules: [
              {
                id: "allow",
                effect: "allow",
                actions: [action, "close", "resolve", "pay", "read"],
                when: { operator: "all", clauses: ["auth"] },
              },
            ],
            projections: [
              {
                id: "write",
                mode: "write",
                fields: ["body", "assignee", "state"],
                when: { operator: "all", clauses: ["auth"] },
                unknownFields: "reject",
              },
              {
                id: "read",
                mode: "read",
                fields: fields.map((f) => f.id),
                when: { operator: "all", clauses: ["auth"] },
                unknownFields: "reject",
              },
            ],
            revocation: {
              strategy: "current-state",
              cache: "none",
              recheck: ["write", "read", "idempotent-replay"],
            },
          },
        ],
        lifecycles: [
          {
            id: "lifecycle",
            version: "v1",
            name: "State",
            aggregate: ref("aggregate"),
            state: { entity: ref("record"), field: "state" },
            states,
            initial: states[0],
            guards: [],
            transitions: states
              .slice(1)
              .map((s, i) => ({ id: `to-${s}`, from: states[i], to: s, guards: [] })),
          },
        ],
        operations: [
          {
            id: `${domain}-command`,
            version: "v1",
            name: action,
            target: {
              contract: ref("commands"),
              operation: action,
              owner: { kind: "component", id: "module" },
            },
            kind: "command",
            aggregate: ref("aggregate"),
            identity: [
              { field: "scope", value: { kind: "context", value: "scope" } },
              { field: "id", value: input("cart-id") },
            ],
            access: {
              policy: { kind: "policy", reference: ref("policy") },
              action,
              readProjection: "read",
              writeProjection: "write",
            },
            guards: [
              {
                id: "editable",
                kind: "compare",
                left: current("state"),
                operator: "eq",
                right: literal(states[0] ?? ""),
              },
            ],
            actions: [
              { id: "patch", kind: "patch", entity: ref("record"), values },
              ...(domain === "post"
                ? []
                : [
                    {
                      id: "move",
                      kind: "transition",
                      lifecycle: ref("lifecycle"),
                      transition: `to-${states[1]}`,
                    },
                  ]),
            ],
            writes: [
              ...values.map((v) => ({ entity: ref("record"), field: v.field })),
              ...(domain === "post" ? [] : [{ entity: ref("record"), field: "state" }]),
            ],
            expectedVersion: { kind: "input", path: ["expected"] },
            transaction: {
              kind: "local",
              store: "store",
              participants: [ref("record")],
              connection: "single",
              externalIO: "forbidden",
              access: "current-state-in-transaction",
              concurrency: "aggregate-policy",
              failure: "rollback",
              commit: "disconnect-is-unknown",
            },
            idempotency: {
              kind: "command-key",
              key: ["key"],
              identity: "operation-version-scope-principal-key",
              hash: "canonical-normalized-input-sha256",
              hashInputs: [["expected"], ["body"], ["assignee"], ["cart-id"]],
              publishedWindow: true,
              expired: "new-command",
              receipt: "terminal-result-in-same-transaction",
              concurrent: "one-writer-bounded-wait-or-retry",
              replay: "current-policy-before-result",
              cleanup: "separate-controlled-policy",
            },
            cancellation: {
              kind: "cooperative",
              startsWork: domain === "order",
              deadlineSeconds: 30,
              beforeCommit: "rollback",
              afterCommit: "committed-or-unknown",
            },
            outcomes: outcomes.map((o) => ({
              outcome: o.id,
              trigger: o.id === "ok" ? "success" : o.id,
              values: o.id === "ok" ? [{ field: "body", value: current("body") }] : [],
            })),
          },
        ],
      },
    },
  });
}

/** Reuse the P65 synthetic command shape; no application implementation or benchmark evidence. */
function fixture(domain: "post" | "order" | "ticket" = "post") {
  const d = baseFixture(domain),
    a = need(d.architecture),
    m = model(d),
    o = operation(d);
  need(m.aggregates[0]).invariants = [
    {
      id: "version-nonnegative",
      strategy: "nonnegative",
      value: { entity: ref("record"), field: "version" },
    },
  ];
  a.components?.push({
    ...structuredClone(need(a.components?.[0])),
    id: "audit-module",
    name: "Audit",
  });
  a.componentRelationships = [
    {
      id: "audit-link",
      from: "module",
      to: "audit-module",
      description: "Records local audit intent",
    },
  ];
  a.scenarios = [
    {
      id: "recovery",
      name: "Failure recovery",
      scope: { level: "components", container: "api" },
      steps: [
        {
          id: "commit",
          relationship: { kind: "componentRelationship", id: "audit-link" },
          text: "Record source transaction",
        },
      ],
      outcomes: [
        {
          id: "safe",
          text: "Retain original command and effect identity",
          invariants: ["No invented success or duplicate source state"],
          requirements: [],
          decisions: [],
        },
      ],
      mainOutcomes: ["safe"],
    },
  ];
  const body = {
    id: "body",
    name: "body",
    type: "text" as const,
    required: true,
    minLength: 1,
    maxLength: 16000,
  };
  for (const id of ["hook-input", "hook-output", "hook-error", "effect-data"])
    a.contracts?.push({
      id,
      version: "v1",
      name: id,
      kind: "data",
      description: "",
      coverage: "Complete",
      shape: { payload: [{ ...body, description: "" }], operations: [] },
    });
  a.contracts?.push({
    id: "domain-event",
    version: "v1",
    name: "Changed",
    kind: "event",
    description: "",
    coverage: "Complete",
    shape: { payload: [{ ...body, description: "" }], operations: [] },
  });
  const q = {
    id: "recipients",
    version: "v1",
    name: "Eligible recipients",
    root: ref("record"),
    joins: [],
    filters: [],
    projection: [{ id: "id", field: { source: "root", field: "id" } }],
    order: [
      { field: { source: "root", field: "scope" }, direction: "asc" as const },
      { field: { source: "root", field: "id" }, direction: "asc" as const },
    ],
    limit: { default: 25, maximum: 100 },
    cursor: {
      kind: "keyset" as const,
      fields: [
        { source: "root", field: "scope" },
        { source: "root", field: "id" },
      ],
    },
    accessPolicy: { kind: "policy" as const, reference: ref("policy") },
    accessProjection: "read",
    freshness: { kind: "authoritative" as const },
  };
  m.queries = [q];
  const servicePolicy = structuredClone(need(m.accessPolicies?.[0]));
  servicePolicy.id = "service-policy";
  servicePolicy.context.identity = "verified-service";
  servicePolicy.context.service = {
    purpose: "delivery",
    authority: "server-service-identity",
    scope: "authorized-scope",
    initiatingActor: "provenance-only",
  };
  servicePolicy.clauses = [{ id: "service", kind: "service-purpose", purpose: "delivery" }];
  for (const rule of servicePolicy.rules) rule.when.clauses = ["service"];
  for (const projection of servicePolicy.projections) projection.when.clauses = ["service"];
  servicePolicy.revocation.recheck.push("job", "materialization", "delivery");
  m.accessPolicies?.push(servicePolicy);
  q.accessPolicy.reference = ref("service-policy");
  const consumer = structuredClone(o);
  consumer.id = `${domain}-delivery`;
  consumer.name = "Delivery attempt";
  consumer.target.operation = "deliver";
  consumer.access.policy = { kind: "policy", reference: ref("service-policy") };
  consumer.actions = [
    {
      id: "patch",
      kind: "patch",
      entity: ref("record"),
      values: [
        { field: "version", value: { kind: "server", factory: "next-version" } },
        { field: "body", value: input("body") },
      ],
    },
  ];
  consumer.writes = [
    { entity: ref("record"), field: "version" },
    { entity: ref("record"), field: "body" },
  ];
  const dw = structuredClone(wire(d));
  dw.id = "deliver";
  dw.name = "Delivery attempt";
  need(a.contracts?.find((c) => c.id === "commands")?.shape).operations.push(dw);
  m.operations?.push(consumer);
  return d;
}
const recovery = (d: DesignDocument, trigger: BackendRecovery["trigger"]): BackendRecovery => ({
  trigger,
  strategy:
    trigger === "uncertain-commit"
      ? "same-command-key"
      : trigger === "lost-acknowledgement"
        ? "same-delivery-identity"
        : trigger === "partial-bytes"
          ? "cleanup-unattached-bytes"
          : trigger === "hook-failure"
            ? "confirmed-rollback"
            : "reconcile-before-retry",
  operation: ref(
    need(
      model(d).operations?.[["lost-acknowledgement", "external-timeout"].includes(trigger) ? 1 : 0],
    ).id,
  ),
  outcome: ["uncertain-commit", "lost-acknowledgement", "external-timeout"].includes(trigger)
    ? "uncertain"
    : "failed",
  scenario: { id: "recovery", outcome: "safe" },
  invariants: [{ aggregate: ref("aggregate"), invariant: "version-nonnegative" }],
  ...(trigger === "external-timeout"
    ? { reconcileOperation: ref(need(model(d).operations?.[1]).id) }
    : {}),
});
function effect(
  d: DesignDocument,
  kind: "outbox" | "audit" | "external" = "outbox",
): BackendEffect {
  const local = kind === "audit",
    external = kind === "external";
  return backendEffectSchema.parse({
    id: kind,
    version: "v1",
    name: kind,
    source: ref(operation(d).id),
    target: local
      ? { kind: "audit", dataset: "audit-data", contract: ref("effect-data") }
      : external
        ? { kind: "hook", hook: ref("provider-hook") }
        : { kind: "event", contract: ref("domain-event") },
    boundary: local ? "before-commit" : external ? "after-commit" : "atomic-intent",
    execution: local ? "local" : external ? "external" : "durable-intent",
    payload: ref(local ? "effect-data" : external ? "hook-input" : "domain-event"),
    values: [{ field: "body", value: input("body") }],
    required: true,
    loss: { kind: "forbidden" },
    after: [],
    delivery: {
      identity: "operation-version-scope-command-effect-recipient",
      context: local ? "source-transaction-context" : "verified-service-actor-provenance-only",
      recheck: "current-policy-before-effect",
      recipient: "single-target",
      guarantee: local ? "local-atomic" : "at-least-once",
      acknowledgement: local
        ? "same-commit"
        : external
          ? "unknown-is-reconcile"
          : "durable-terminal-result",
      attempts: local ? 1 : 5,
      backoffSeconds: 2,
      timeoutSeconds: 30,
      exhausted: "operator-visible",
      duplicates: local ? "deduplicated-local-effect" : "possible",
    },
    recovery: [
      recovery(d, "uncertain-commit"),
      ...(!local ? [recovery(d, "lost-acknowledgement")] : []),
      ...(external ? [recovery(d, "external-timeout")] : []),
    ],
  });
}
const owner = { kind: "component" as const, id: "module" };
const access = { policy: ref("policy"), action: "read", projection: "read" };
const named = (id: string) => ({ id, version: "v1", schemaVersion: 1 as const, name: id, owner });
const providerRef: BackendProviderReference = {
  contract: ref("provider-api"),
  interface: "provider-provided",
  operation: "send",
  binding: "provider-binding",
  environment: { kind: "fixture", id: "local-provider" },
  deduplication: "none",
};
function settingsFixture(): DesignDocument {
  const d = fixture(),
    a = need(d.architecture),
    m = model(d);
  const entity = need(m.entities[0]),
    data = need(a.contracts?.find((c) => c.id === "record-data")?.shape),
    lifecycle = need(m.lifecycles?.[0]);
  const extra = [
    { id: "parent", name: "parent", description: "", type: "uuid" as const, required: true },
    { id: "enabled", name: "enabled", description: "", type: "boolean" as const, required: true },
  ];
  data.payload.push(...extra);
  entity.fields.push(
    ...extra.map((f) => ({
      field: f.id,
      storageId: `${f.id}-column`,
      required: true,
      nullable: false,
      storage: { kind: "scalar" as const },
    })),
  );
  const state = need(data.payload.find((f) => f.id === "state"));
  state.enumValues = ["open", "closed", "quarantined", "deleted"];
  lifecycle.states = [...state.enumValues];
  lifecycle.transitions.push(
    { id: "quarantine", from: "open", to: "quarantined", guards: [] },
    { id: "delete", from: "quarantined", to: "deleted", guards: [] },
  );
  const parent = structuredClone(entity);
  parent.id = "parent-entity";
  parent.name = "Parent";
  parent.dataset = "parents";
  parent.storageId = "parent-table";
  m.entities.push(parent);
  const ds = structuredClone(need(a.datasets?.[0]));
  ds.id = "parents";
  ds.name = "Parents";
  a.datasets?.push(ds);
  entity.relations.push({
    id: "parent-link",
    target: ref(parent.id),
    fields: [
      { source: "scope", target: "scope" },
      { source: "parent", target: "id" },
    ],
    cardinality: "many-to-one",
    ownership: "reference",
    scope: "same-scope",
    onDelete: "restrict",
  });
  const policy = need(m.accessPolicies?.[0]);
  policy.revocation.recheck.push("bytes", "search");
  for (const p of [policy, need(m.accessPolicies?.[1])])
    need(p.projections.find((p) => p.id === "read")).fields.push(...extra.map((f) => f.id));
  const event = need(a.contracts?.find((c) => c.id === "domain-event"));
  need(event.shape).payload = [
    { id: "time", name: "time", type: "timestamp", required: true, description: "" },
  ];
  a.contracts?.push({ ...structuredClone(event), id: "stopped-event", name: "Clock stopped" });
  const q = need(m.queries?.[0]);
  q.filters = [{ id: "cutoff", field: { source: "root", field: "updated" }, comparisons: ["lte"] }];
  q.projection = ["id", "body", "updated", "enabled"].map((id) => ({
    id,
    field: { source: "root", field: id },
  }));
  const prefs = structuredClone(q);
  prefs.id = "preferences";
  prefs.name = "Preferences";
  prefs.filters.push({
    id: "principal",
    field: { source: "root", field: "id" },
    comparisons: ["eq"],
  });
  m.queries?.push(prefs);
  const search = structuredClone(q);
  search.id = "search-query";
  search.name = "Search";
  search.accessPolicy = { kind: "policy", reference: ref("policy") };
  search.accessSite = "search";
  m.queries?.push(search);
  const outbox = effect(d);
  outbox.values = [{ field: "time", value: { kind: "server", factory: "clock" } }];
  const noticeWire = need(
    a.contracts
      ?.find((c) => c.id === "commands")
      ?.shape?.operations.find((w) => w.id === "deliver"),
  );
  const notificationPayload = structuredClone(event);
  notificationPayload.id = "notification-data";
  notificationPayload.kind = "data";
  need(notificationPayload.shape).payload = structuredClone(noticeWire.input);
  a.contracts?.push(notificationPayload);
  const notification = structuredClone(outbox);
  notification.payload = ref("notification-data");
  notification.values = noticeWire.input.map((f) => ({ field: f.id, value: input(f.id) }));
  notification.id = "notification-effect";
  notification.target = {
    kind: "notification",
    operation: ref("post-delivery"),
    recipients: ref("recipients"),
  };
  notification.delivery.recipient = "each-eligible-recipient";
  const audit = effect(d, "audit");
  const ads = structuredClone(ds);
  ads.id = "audit-data";
  ads.name = "Audit";
  ads.contract = ref("effect-data");
  a.datasets?.push(ads);
  m.effects = [outbox, notification, audit];
  d.elements.push({
    ...structuredClone(need(d.elements[0])),
    id: "provider",
    name: "External adapter",
    planned: "application-api",
  });
  d.connections.push({
    id: "provider-link",
    kind: "depends-on",
    from: { element: "api" },
    to: { element: "provider" },
    planned: {
      label: "Uses explicit adapter",
      protocol: "HTTPS",
      interaction: "Request / response",
      security: "Service identity",
    },
  });
  a.contracts?.push({
    id: "provider-api",
    version: "v1",
    name: "Provider",
    kind: "api",
    coverage: "Complete",
    description: "",
    shape: { payload: [], operations: [{ ...structuredClone(wire(d)), id: "send", name: "Send" }] },
  });
  a.interfaces?.push(
    {
      id: "provider-provided",
      name: "Provider",
      direction: "provided",
      owner: { kind: "element", id: "provider" },
      contract: ref("provider-api"),
      necessity: "required",
    },
    {
      id: "provider-required",
      name: "Client",
      direction: "required",
      owner,
      contract: ref("provider-api"),
      necessity: "required",
    },
  );
  a.bindings = [
    {
      id: "provider-binding",
      name: "Adapter binding",
      provided: "provider-provided",
      required: "provider-required",
      relationship: { kind: "connection", id: "provider-link" },
      contract: ref("provider-api"),
      operation: "send",
      role: "request",
      businessSynchrony: "Asynchronous",
    },
  ];
  const configs: BackendCapabilityConfig[] = [
    {
      ...named("jobs"),
      kind: "delivery",
      effect: ref("outbox"),
      queue: { channel: "notification-jobs", event: ref("domain-event") },
      due: { kind: "event-time", field: "time" },
      attempts: 5,
      backoff: { kind: "fixed", seconds: 2 },
      leaseSeconds: 60,
      timeoutSeconds: 30,
      deadlineSeconds: 3600,
      claim: "atomic-fenced-token",
      staleAcknowledgement: "reject",
      shutdown: "stop-claiming-cooperative-cancellation",
      acknowledgement: "persist-terminal-before-ack",
      unknown: { kind: "same-delivery-identity" },
      exhausted: "operator-visible",
      duplicates: "possible",
    },
    {
      ...named("files"),
      kind: "files",
      entity: ref("record"),
      parent: ref("parent-entity"),
      store: providerRef,
      maximumBytes: 10485760,
      acceptedTypes: ["image/png", "application/pdf"],
      inspection: { kind: "mime-signature", mismatch: "quarantine" },
      parentAccess: { ...access, policy: ref("parent-policy") },
      lifecycle: ref("lifecycle"),
      states: {
        staged: "open",
        quarantined: "quarantined",
        attached: "closed",
        deleted: "deleted",
      },
      bytes: "current-parent-policy-attached-only",
      association: "same-scope-authorized-parent",
      cleanup: {
        delivery: ref("jobs"),
        unattachedAfterSeconds: 86400,
        batchSize: 100,
        race: "recheck-unattached-version-before-delete",
        partialBytes: "durable-cleanup-intent",
        attached: "preserve",
      },
    },
    {
      ...named("notifications"),
      kind: "notifications",
      effect: ref("notification-effect"),
      recipients: ref("recipients"),
      cutoff: {
        event: ref("domain-event"),
        field: "time",
        subscriptions: "created-at-or-before-event",
        filter: "cutoff",
      },
      preferences: {
        query: ref("preferences"),
        principal: "id",
        principalFilter: "principal",
        enabled: "enabled",
        missing: "deny",
      },
      recipient: "id",
      access: { ...access, policy: ref("service-policy") },
      fields: ["id", "body"],
      redaction: "current-policy-projection-before-materialization-and-delivery",
      pageSize: 25,
      maximumRecipients: 10000,
      continuation: "durable-keyset-cutoff-no-loss",
      identity: "operation-version-scope-command-effect-recipient-channel",
      channels: [{ kind: "inbox", operation: ref("post-delivery") }],
    },
    {
      ...named("search"),
      kind: "search",
      source: ref("record"),
      fields: ["body"],
      query: ref("search-query"),
      strategy: { id: "postgresql-full-text", version: "v1", language: "english" },
      projection: { dataset: "search-data", version: 1 },
      access,
      authorization: "current-policy-before-pagination-counts-snippets",
      maximumQueryLength: 200,
      maximumResults: 100,
      freshness: { kind: "bounded-staleness", maximumLagSeconds: 30, delivery: ref("jobs") },
      rebuild: {
        operation: ref("post-command"),
        batchSize: 100,
        swap: "atomic-projection-version",
        deletion: "current-authority-tombstone-filter",
      },
    },
    {
      ...named("calendar"),
      kind: "calendar",
      timezone: "America/Chicago",
      weekly: [
        {
          day: 1,
          intervals: [
            { startMinute: 540, endMinute: 720 },
            { startMinute: 780, endMinute: 1020 },
          ],
        },
      ],
      holidays: [{ date: "2026-12-25", intervals: [] }],
      intervalMeaning: "local-half-open-no-overnight",
      daylightSaving: "elapsed-real-minutes-in-local-open-intervals",
    },
    {
      ...named("business-time"),
      kind: "business-time",
      calendar: ref("calendar"),
      entity: ref("record"),
      durationMinutes: 480,
      startEvents: [ref("domain-event")],
      stopEvents: [ref("stopped-event")],
      restart: "never",
      calendarChange: "existing-clocks-pin-version",
      due: { entity: ref("record"), field: "updated" },
      clockVersion: { entity: ref("record"), field: "version" },
      lifecycle: ref("lifecycle"),
      runningStates: ["open"],
      staleJob: "recheck-clock-version-state-and-current-policy",
    },
    {
      ...named("routing"),
      kind: "routing",
      operation: ref("post-command"),
      match: "first",
      rules: [
        {
          id: "route",
          priority: 1,
          predicates: ["editable"],
          condition: "all",
          actions: ["patch"],
        },
      ],
      maximumActions: 1,
      deduplication: "source-command-rule-action",
      audit: ref("audit"),
      repeat: "no-recursive-rule-execution",
    },
  ];
  const parentPolicy = structuredClone(policy);
  parentPolicy.id = "parent-policy";
  parentPolicy.resource = ref("parent-entity");
  m.accessPolicies?.push(parentPolicy);
  const sds = structuredClone(ds);
  sds.id = "search-data";
  sds.name = "Rebuildable search";
  a.datasets?.push(sds);
  m.capabilityConfigs = configs.map((c) => backendCapabilityConfigSchema.parse(c));
  return d;
}
function config<K extends BackendCapabilityConfig["kind"]>(
  d: DesignDocument,
  kind: K,
): Extract<BackendCapabilityConfig, { kind: K }> {
  const c = model(d).capabilityConfigs?.find((c) => c.kind === kind);
  if (!c || c.kind !== kind) throw new Error("Missing configuration");
  return c as Extract<BackendCapabilityConfig, { kind: K }>;
}
const messages = (d: DesignDocument) =>
  validateBackendCapabilityConfigs(d)
    .map((f) => f.message)
    .join("\n");

it("models delivery/files/notification/search/business time/routing with typed references and no runtime claim", () => {
  const d = settingsFixture();
  expect(validateBackendCapabilityConfigs(d)).toEqual([]);
  expect(errors(d)).toEqual([]);
  const before = structuredClone(d);
  delete model(before).capabilityConfigs;
  expect(save(before, d).ok).toBe(true);
  expect(blocksGenerate(validateDesign(d, testLookup))).toBe(true);
  expect(model(d).capabilityConfigs).toHaveLength(7);
});

it("rejects unsupported or opaque settings, extra provider secrets and nonpositive/unbounded options", () => {
  const d = settingsFixture();
  for (const kind of [
    "delivery",
    "files",
    "notifications",
    "search",
    "calendar",
    "business-time",
    "routing",
  ] as const) {
    const c = config(d, kind);
    expect(backendCapabilityConfigSchema.safeParse({ ...c, config: "{}" }).success).toBe(false);
    expect(backendCapabilityConfigSchema.safeParse({ ...c, schemaVersion: 2 }).success).toBe(false);
  }
  for (const [kind, field] of [
    ["files", "maximumBytes"],
    ["delivery", "attempts"],
    ["delivery", "leaseSeconds"],
    ["notifications", "maximumRecipients"],
    ["search", "maximumResults"],
    ["business-time", "durationMinutes"],
    ["routing", "maximumActions"],
  ] as const) {
    expect(
      backendCapabilityConfigSchema.safeParse({ ...config(d, kind), [field]: 0 }).success,
    ).toBe(false);
  }
  expect(
    backendCapabilityConfigSchema.safeParse({
      ...config(d, "files"),
      store: { ...providerRef, apiKey: "forbidden" },
    }).success,
  ).toBe(false);
  expect(
    backendCapabilityConfigSchema.safeParse({
      ...config(d, "search"),
      strategy: { id: "javascript", source: "eval()" },
    }).success,
  ).toBe(false);
  expect(
    backendCapabilityConfigSchema.safeParse({ ...config(d, "files"), acceptedTypes: ["image/*"] })
      .success,
  ).toBe(false);
  expect(
    backendModelSchema.safeParse({
      ...model(d),
      capabilityConfigs: Array(101).fill(config(d, "calendar")),
    }).success,
  ).toBe(false);
});

it("checks real IANA zones, half-open intervals, dates and immutable calendar versions", () => {
  const base = settingsFixture();
  for (const zone of ["UTC", "Europe/Berlin", "Australia/Lord_Howe"]) {
    const d = structuredClone(base);
    config(d, "calendar").timezone = zone;
    expect(validateBackendCapabilityConfigs(d)).toEqual([]);
  }
  for (const change of [
    (d: DesignDocument) => {
      config(d, "calendar").timezone = "Mars/Phobos";
    },
    (d: DesignDocument) => {
      config(d, "calendar").timezone = "+01:00";
    },
    (d: DesignDocument) => {
      need(config(d, "calendar").weekly[0]).intervals.push({ startMinute: 719, endMinute: 800 });
    },
    (d: DesignDocument) => {
      need(need(config(d, "calendar").weekly[0]).intervals[0]).endMinute = 540;
    },
    (d: DesignDocument) => {
      need(config(d, "calendar").holidays[0]).date = "2026-02-30";
    },
    (d: DesignDocument) => {
      config(d, "calendar").weekly.push(structuredClone(need(config(d, "calendar").weekly[0])));
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
    expect(save(base, d).ok).toBe(false);
  }
  const touching = structuredClone(base);
  need(need(config(touching, "calendar").weekly[0]).intervals[1]).startMinute = 720;
  expect(validateBackendCapabilityConfigs(touching)).toEqual([]);
  const renamed = structuredClone(base);
  config(renamed, "calendar").name = "Renamed";
  expect(validateBackendCapabilityTransition(base, renamed)).toEqual([]);
  const removed = structuredClone(base);
  model(removed).capabilityConfigs = [];
  expect(save(base, removed).ok).toBe(false);
  const successor = structuredClone(base);
  const next = structuredClone(config(successor, "calendar"));
  next.version = "v2";
  next.timezone = "Europe/Berlin";
  model(successor).capabilityConfigs?.push(next);
  config(successor, "business-time").calendar = ref("calendar", "v2");
  expect(save(base, successor).ok).toBe(true);
});

it("keeps fenced bounded delivery and external uncertainty separate from local SQL atomicity", () => {
  const base = settingsFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "delivery").leaseSeconds = 10;
    },
    (d: DesignDocument) => {
      config(d, "delivery").deadlineSeconds = 20;
    },
    (d: DesignDocument) => {
      config(d, "delivery").attempts = 6;
    },
    (d: DesignDocument) => {
      config(d, "delivery").due = { kind: "event-time", field: "body" };
    },
    (d: DesignDocument) => {
      config(d, "delivery").backoff = {
        kind: "exponential",
        initialSeconds: 10,
        maximumSeconds: 5,
      };
    },
    (d: DesignDocument) => {
      config(d, "delivery").provider = providerRef;
    },
    (d: DesignDocument) => {
      config(d, "delivery").due = { kind: "business-deadline", config: ref("calendar") };
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  const external = structuredClone(base),
    jobs = config(external, "delivery");
  const externalEffect = need(model(external).effects?.find((e) => e.id === "notification-effect"));
  externalEffect.execution = "external";
  externalEffect.boundary = "after-commit";
  externalEffect.after = [ref("outbox")];
  externalEffect.delivery.acknowledgement = "unknown-is-reconcile";
  jobs.effect = ref("notification-effect");
  jobs.provider = providerRef;
  jobs.unknown = { kind: "reconcile", operation: ref("post-delivery"), outcome: "uncertain" };
  expect(validateBackendCapabilityConfigs(external)).toEqual([]);
  jobs.unknown.outcome = "ok";
  expect(messages(external)).toContain("Unknown/Reconcile first");
  jobs.unknown.outcome = "uncertain";
  jobs.duplicates = "destination-key";
  expect(messages(external)).toContain("possible duplicates");
});

it("requires actual provider interfaces, exact versions, C2 operations and explicit private environment references", () => {
  const base = settingsFixture();
  for (const patch of [
    { interface: "missing" },
    { binding: "missing" },
    { operation: "other" },
    { contract: ref("provider-api", "v2") },
    { interface: "provided" },
  ]) {
    const d = structuredClone(base);
    Object.assign(config(d, "files").store, patch);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  const d = structuredClone(base);
  need(d.architecture?.bindings?.[0]).operation = "edit";
  expect(messages(d)).toContain("actual provided interface");
  const production = structuredClone(base);
  config(production, "files").store.environment = {
    kind: "deployment",
    id: "private-object-store",
    credentialRef: "object-store-credential",
  };
  expect(validateBackendCapabilityConfigs(production)).toEqual([]);
});

it("checks private file state/parent policy, inspection and durable race-safe orphan cleanup references", () => {
  const base = settingsFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "files").states.attached = "open";
    },
    (d: DesignDocument) => {
      config(d, "files").states.attached = "unknown";
    },
    (d: DesignDocument) => {
      config(d, "files").parentAccess.policy = ref("policy");
    },
    (d: DesignDocument) => {
      config(d, "files").cleanup.delivery = ref("calendar");
    },
    (d: DesignDocument) => {
      config(d, "files").inspection = {
        kind: "hook",
        hook: ref("missing"),
        unavailable: "quarantine",
      };
    },
    (d: DesignDocument) => {
      need(model(d).entities[0]).relations = [];
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  const d = structuredClone(base);
  need(model(d).accessPolicies?.find((p) => p.id === "parent-policy")).revocation.recheck = [
    "read",
  ];
  expect(messages(d)).toContain("bytes current-state");
  expect(save(base, d).ok).toBe(false);
});

it("bounds recipient/preference queries, cutoff timestamps, projections and current service rechecks", () => {
  const base = settingsFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "notifications").cutoff.field = "body";
    },
    (d: DesignDocument) => {
      config(d, "notifications").recipient = "body";
    },
    (d: DesignDocument) => {
      config(d, "notifications").fields.push("hidden");
    },
    (d: DesignDocument) => {
      config(d, "notifications").preferences.enabled = "body";
    },
    (d: DesignDocument) => {
      config(d, "notifications").pageSize = 100;
      need(model(d).queries?.[0]).limit.maximum = 25;
    },
    (d: DesignDocument) => {
      config(d, "notifications").access.policy = ref("policy");
    },
    (d: DesignDocument) => {
      config(d, "notifications").channels.push({
        kind: "external",
        channel: "mail",
        delivery: ref("jobs"),
        provider: providerRef,
      });
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  const d = structuredClone(base);
  need(model(d).accessPolicies?.[1]).revocation.recheck = ["read"];
  expect(messages(d)).toContain("materialization");
  expect(messages(d)).toContain("delivery");
  expect(messages(d)).toContain("job");
});

it("validates scoped search fields, source policy, query bounds, projection ownership and rebuild references", () => {
  const base = settingsFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "search").fields = ["id"];
    },
    (d: DesignDocument) => {
      config(d, "search").projection.dataset = "missing";
    },
    (d: DesignDocument) => {
      config(d, "search").query = ref("recipients");
    },
    (d: DesignDocument) => {
      config(d, "search").rebuild.operation = ref("missing");
    },
    (d: DesignDocument) => {
      config(d, "search").projection.dataset = "records";
    },
    (d: DesignDocument) => {
      need(model(d).queries?.find((q) => q.id === "search-query")).limit.maximum = 25;
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
});

it("pins business-clock inputs, lifecycle and revision guards and rejects contradictory start/stop decisions", () => {
  const base = settingsFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "business-time").calendar = ref("calendar", "v0");
    },
    (d: DesignDocument) => {
      config(d, "business-time").stopEvents = [ref("domain-event")];
    },
    (d: DesignDocument) => {
      config(d, "business-time").startEvents = [ref("record-data")];
    },
    (d: DesignDocument) => {
      config(d, "business-time").clockVersion.field = "body";
    },
    (d: DesignDocument) => {
      config(d, "business-time").due.entity = ref("parent-entity");
    },
    (d: DesignDocument) => {
      config(d, "business-time").runningStates = ["undefined"];
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
});

it("reuses finite guards/actions for first/all-match rules and required same-commit audit", () => {
  const base = settingsFixture();
  for (const change of [
    (d: DesignDocument) => {
      need(config(d, "routing").rules[0]).predicates = ["missing"];
    },
    (d: DesignDocument) => {
      need(config(d, "routing").rules[0]).actions = ["missing"];
    },
    (d: DesignDocument) => {
      config(d, "routing").rules.push({
        id: "again",
        priority: 1,
        predicates: ["editable"],
        condition: "all",
        actions: ["patch"],
      });
    },
    (d: DesignDocument) => {
      config(d, "routing").match = "all";
      config(d, "routing").rules.push({
        id: "again",
        priority: 2,
        predicates: ["editable"],
        condition: "all",
        actions: ["patch"],
      });
    },
    (d: DesignDocument) => {
      config(d, "routing").audit = ref("outbox");
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  const all = structuredClone(base);
  const second = { ...structuredClone(need(operation(all).actions[0])), id: "second-patch" };
  operation(all).actions.push(second);
  const routing = config(all, "routing");
  routing.match = "all";
  routing.maximumActions = 2;
  routing.rules.push({
    id: "second-rule",
    priority: 2,
    predicates: ["editable"],
    condition: "all",
    actions: ["second-patch"],
  });
  expect(validateBackendCapabilityConfigs(all)).toEqual([]);
  routing.maximumActions = 1;
  expect(messages(all)).toContain("cannot truncate");
});

it("collects every exact setting reference and rejects dangling versions/removal with source paths", () => {
  const base = settingsFixture();
  for (const c of model(base).capabilityConfigs ?? [])
    for (const r of backendCapabilityExactReferences(c)) {
      const d = structuredClone(base);
      if (r.collection === "contracts")
        need(d.architecture).contracts = d.architecture?.contracts?.filter(
          (v) => contractKey(v) !== contractKey(r.reference),
        );
      else {
        const collection = r.collection;
        // Removal is deliberately invalid; the descriptor graph must report its source.
        Object.assign(model(d), {
          [collection]: model(d)[collection]?.filter(
            (v) => contractKey(v) !== contractKey(r.reference),
          ),
        });
      }
      expect(
        validateBackendCapabilityConfigs(d).some(
          (f) => f.code === "UNKNOWN_REFERENCE" && f.target.path?.includes(contractKey(c)),
        ),
        `${c.kind}/${r.collection}/${contractKey(r.reference)}`,
      ).toBe(true);
      expect(backendDataRemovalFindings(d).some(isStructural)).toBe(true);
    }
  const missing = structuredClone(base);
  config(missing, "files").store.binding = "missing";
  expect(save(base, missing).ok).toBe(false);
});

it("preserves immutable event/provider contracts, lifecycle and policy semantics even with consumer removal", () => {
  const base = settingsFixture();
  const changed = structuredClone(base);
  need(
    changed.architecture?.contracts?.find((c) => c.id === "provider-api")?.shape?.operations[0],
  ).name = "different wire operation";
  model(changed).capabilityConfigs = [];
  expect(save(base, changed).ok).toBe(false);
  const lifecycle = structuredClone(base);
  need(model(lifecycle).lifecycles?.[0]).initial = "closed";
  model(lifecycle).capabilityConfigs = [config(lifecycle, "calendar")];
  expect(save(base, lifecycle).ok).toBe(false);
  const removed = structuredClone(base);
  need(removed.architecture).contracts = removed.architecture?.contracts?.filter(
    (c) => c.id !== "provider-api",
  );
  model(removed).capabilityConfigs = [];
  need(removed.architecture).bindings = [];
  need(removed.architecture).interfaces = removed.architecture?.interfaces?.filter(
    (i) => !i.id.startsWith("provider-"),
  );
  expect(save(base, removed).ok).toBe(false);
});

it("remaps outer setting references while preserving fields, rules, channels, timezones and environment identities", () => {
  const base = settingsFixture(),
    m = model(base);
  const outer = new Set(
    (m.capabilityConfigs ?? []).flatMap((c) => [c.id, ...backendCapabilityReferences(c)]),
  );
  const ids = Object.fromEntries([...outer].map((id) => [id, `copy-${id}`]));
  for (const local of [
    "body",
    "time",
    "route",
    "patch",
    "read",
    "open",
    "notification-jobs",
    "local-provider",
  ])
    ids[local] = `wrong-${local}`;
  const mapped = mapBackendModel(m, ids);
  for (let i = 0; i < (m.capabilityConfigs?.length ?? 0); i++) {
    const c = need(m.capabilityConfigs?.[i]),
      copy = need(mapped.capabilityConfigs?.[i]);
    expect(copy.id).toBe(`copy-${c.id}`);
    expect(backendCapabilityExactReferences(copy)).toEqual(
      backendCapabilityExactReferences(c).map((r) => ({
        ...r,
        reference: { ...r.reference, id: `copy-${r.reference.id}` },
      })),
    );
  }
  const copied = { ...base, architecture: { ...need(base.architecture), backend: mapped } };
  expect(config(copied, "calendar").timezone).toBe("America/Chicago");
  expect(config(copied, "routing").rules[0]).toEqual(config(base, "routing").rules[0]);
  expect(config(copied, "delivery").queue.channel).toBe("notification-jobs");
  expect(config(copied, "files").store.environment).toEqual(providerRef.environment);
  expect(config(copied, "files").states.attached).toBe("closed");
});

it("retains settings through extraction, insertion, whole-boundary reuse, deterministic handoff and target copy", async () => {
  const source = settingsFixture();
  expect(errors(source)).toEqual([]);
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api", "store", "provider"] },
    {
      id: "capability-settings",
      version: "1.0.0",
      name: "Settings",
      purpose: "Portable bounded settings",
    },
    testLookup,
  );
  expect(fragment.architecture.backend?.capabilityConfigs).toHaveLength(7);
  expect(fragment.roles.filter((r) => r.create)).toHaveLength(3);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `copy-${id}`]));
  expect(mappedArchitecture(fragment, ids).backend?.capabilityConfigs).toHaveLength(7);
  const entry: ArchitectureLibraryEntry = {
    id: fragment.id,
    version: fragment.version,
    fragment,
    metadata,
    state: "published",
    draftRevision: 1,
    contentHash: "a".repeat(64),
    availability: "architecture only",
  };
  const empty = designSchema.parse({ schemaVersion: 2, revision: 0 });
  const preview = previewArchitectureTemplate(
    empty,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "copy",
      name: "Copy",
      baseRevision: 0,
    },
    testLookup,
  );
  expect(preview.errors).toEqual([]);
  const saved = applyOperations(empty, preview.ops, testLookup);
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  expect(errors(saved.design)).toEqual([]);
  const pinned = need(saved.design.architecture?.patternInstances?.[0]);
  const reuse = previewArchitectureTemplate(
    saved.design,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "reuse",
      name: "Reuse",
      baseRevision: saved.design.revision,
      roles: Object.fromEntries(
        fragment.roles.map((r) => [
          r.id,
          { mode: "reuse" as const, id: need(pinned.identities[r.id]) },
        ]),
      ),
    },
    testLookup,
  );
  expect(reuse.errors).toEqual([]);
  const reused = applyOperations(saved.design, reuse.ops, testLookup);
  expect(reused.ok).toBe(true);
  if (reused.ok) {
    expect(model(reused.design)).toEqual(model(saved.design));
    expect(reused.design.connections).toEqual(saved.design.connections);
    expect(reused.design.architecture?.bindings).toEqual(saved.design.architecture?.bindings);
    expect(reused.design.architecture?.interfaces).toEqual(saved.design.architecture?.interfaces);
  }
  const args = {
    design: saved.design,
    project: { id: "capability-settings", name: "Settings" },
    lookup: testLookup,
  };
  const handoff = await buildArchitectureHandoff(args);
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(model(saved.design));
  expect(handoffJson(await buildArchitectureHandoff(args))).toBe(handoffJson(handoff));
  expect(handoffMarkdown(handoff)).toContain("Capability configuration");
  const changed = structuredClone(saved.design);
  config(changed, "search").maximumQueryLength = 201;
  expect(
    targetChanges(saved.design, changed).some((c) =>
      c.path.startsWith("architecture/backend/capabilityConfigs/"),
    ),
  ).toBe(true);
  expect(await handoffFingerprint(changed, args.project)).not.toBe(
    await handoffFingerprint(saved.design, args.project),
  );
  expect(designSchema.parse(JSON.parse(JSON.stringify(saved.design)))).toEqual(saved.design);
  const incomplete = structuredClone(source);
  need(model(incomplete).accessPolicies?.find((p) => p.id === "parent-policy")).revocation.recheck =
    ["read"];
  expect(
    reviewArchitecture(incomplete).findings.some((f) =>
      JSON.stringify(f).includes("bytes current-state"),
    ),
  ).toBe(true);
});

it("exports structured chat schemas and leaves legacy designs and frozen fixtures unmodified", () => {
  const schema = JSON.stringify(operationBatchJsonSchema());
  for (const value of [
    "capabilityConfigs",
    "atomic-fenced-token",
    "current-parent-policy-attached-only",
    "source-command-rule-action",
    "existing-clocks-pin-version",
  ])
    expect(schema).toContain(value);
  expect(backendModelSchema.parse({ schemaVersion: 1 })).toEqual({
    schemaVersion: 1,
    entities: [],
    aggregates: [],
  });
  for (const file of ["link-shortener", "resource-workspace", "generated-workspace"]) {
    const raw = JSON.parse(
      readFileSync(new URL(`../../../fixtures/designs/${file}.json`, import.meta.url), "utf8"),
    );
    const d = designSchema.parse(raw);
    expect(d.architecture?.backend?.capabilityConfigs).toBeUndefined();
  }
});

it("represents external notification delivery after exact durable intent without conflating data and event contracts", () => {
  const d = settingsFixture(),
    m = model(d);
  const e = need(m.effects?.find((e) => e.id === "notification-effect"));
  e.execution = "external";
  e.boundary = "after-commit";
  e.after = [ref("outbox")];
  e.delivery.acknowledgement = "unknown-is-reconcile";
  e.recovery.push(recovery(d, "external-timeout"));
  const delivery = structuredClone(config(d, "delivery"));
  delivery.id = "external-jobs";
  delivery.name = "External jobs";
  delivery.effect = ref(e.id);
  delivery.provider = providerRef;
  delivery.unknown = { kind: "reconcile", operation: ref("post-delivery"), outcome: "uncertain" };
  m.capabilityConfigs?.push(delivery);
  config(d, "notifications").channels.push({
    kind: "external",
    channel: "mail",
    delivery: ref(delivery.id),
    provider: providerRef,
  });
  expect(validateBackendCapabilityConfigs(d)).toEqual([]);
  expect(errors(d)).toEqual([]);
  e.after = [];
  expect(messages(d)).toContain("durable intent payload preceding");
});

it("supports a first-response clock that never restarts and immutable business-deadline settings", () => {
  const before = settingsFixture();
  config(before, "delivery").due = { kind: "business-deadline", config: ref("business-time") };
  expect(config(before, "business-time").restart).toBe("never");
  expect(validateBackendCapabilityConfigs(before)).toEqual([]);
  const changed = structuredClone(before);
  config(changed, "business-time").durationMinutes = 120;
  expect(validateBackendCapabilityTransition(before, changed)).toHaveLength(1);
  expect(save(before, changed).ok).toBe(false);
});

it("prevents routing from invoking hooks or changing policy membership/role authority", () => {
  const d = settingsFixture();
  operation(d).actions.push({ id: "hook", kind: "hook", hook: ref("missing"), input: [] });
  need(config(d, "routing").rules[0]).actions = ["hook"];
  expect(messages(d)).toContain("finite patch/transition");
  need(config(d, "routing").rules[0]).actions = ["patch"];
  need(model(d).accessPolicies?.[0]).clauses.push({
    id: "grant",
    kind: "role",
    authority: "persisted-role-store",
    entity: ref("record"),
    principal: "author",
    field: "state",
    values: ["open"],
  });
  expect(messages(d)).toContain("cannot mutate persisted role or membership authority");
});

/** Combined P66 synthetic fixture, not the future P71/P72/P73 application designs. */
function commerceFixture(): DesignDocument {
  const d = settingsFixture(),
    a = need(d.architecture),
    m = model(d);
  const baseEntity = need(m.entities[0]),
    baseDataset = need(a.datasets?.find((v) => v.id === baseEntity.dataset));
  const baseContract = need(a.contracts?.find((v) => v.id === baseEntity.contract.id));
  const payload = need(baseContract.shape).payload;
  const extra = [
    { id: "quantity", type: "integer", minimum: 1, maximum: 1000 },
    ...["on-hand", "reserved", "paid", "fulfilled"].map((id) => ({
      id,
      type: "integer",
      minimum: 0,
      maximum: 1_000_000,
    })),
    ...["location", "variant"].map((id) => ({ id, type: "uuid" })),
    { id: "expires", type: "timestamp" },
    ...["address", "provenance", "provider-key"].map((id) => ({
      id,
      type: "text",
      minLength: 1,
      maxLength: 2000,
    })),
    ...["price", "total"].map((id) => ({
      id,
      type: "object",
      fields: [
        {
          id: "minor",
          name: "minor",
          type: "integer",
          required: true,
          minimum: 0,
          maximum: 1_000_000_000,
        },
        { id: "currency", name: "currency", type: "text", required: true, enumValues: ["USD"] },
      ],
    })),
  ];
  // Parse through the existing wire schema rather than maintaining another field representation.
  const expanded = designSchema.parse({
    ...d,
    architecture: {
      ...a,
      contracts: a.contracts?.map((c) =>
        c.id === baseContract.id
          ? {
              ...c,
              shape: {
                ...c.shape,
                payload: [
                  ...payload,
                  ...extra.map((f) => ({ ...f, name: f.id.replaceAll("-", "_"), required: true })),
                ],
              },
            }
          : c,
      ),
    },
  });
  need(baseContract.shape).payload = need(
    expanded.architecture?.contracts?.find((c) => c.id === baseContract.id)?.shape,
  ).payload;
  baseEntity.fields.push(
    ...extra.map((f) => ({
      field: f.id,
      storageId: `${f.id}-column`,
      required: true,
      nullable: false,
      storage:
        f.type === "object"
          ? {
              kind: "money" as const,
              minorUnits: "minor",
              currency: "currency",
              currencyStorageId: `${f.id}-currency`,
            }
          : { kind: "scalar" as const },
    })),
  );
  need(m.entities.find((e) => e.id === "parent-entity")).fields = structuredClone(
    baseEntity.fields,
  );
  const cloneEntity = (id: string, states?: string[]) => {
    const e = structuredClone(baseEntity),
      ct = structuredClone(baseContract),
      ds = structuredClone(baseDataset);
    e.id = id;
    e.name = id;
    e.storageId = `${id}-table`;
    e.contract = ref(`${id}-data`);
    e.dataset = `${id}-dataset`;
    e.relations = [];
    ct.id = e.contract.id;
    ct.name = id;
    if (states) need(ct.shape?.payload.find((f) => f.id === "state")).enumValues = states;
    ds.id = e.dataset;
    ds.name = id;
    ds.contract = e.contract;
    m.entities.push(e);
    a.contracts?.push(ct);
    a.datasets?.push(ds);
    return e;
  };
  const line = cloneEntity("cart-line"),
    stock = cloneEntity("stock"),
    reservation = cloneEntity("reservation", ["active", "held", "consumed", "released", "expired"]),
    order = cloneEntity("order", [
      "awaiting",
      "paid",
      "partial",
      "fulfilled",
      "cancelled",
      "review",
    ]),
    orderLine = cloneEntity("order-line"),
    payment = cloneEntity("payment-attempt", [
      "created",
      "submitted",
      "settled",
      "failed",
      "unknown",
    ]),
    shipment = cloneEntity("shipment", ["pending", "shipped", "cancelled"]),
    shipmentLine = cloneEntity("shipment-line");
  for (const [child, parent] of [
    [line, baseEntity],
    [reservation, stock],
    [orderLine, order],
    [shipmentLine, shipment],
  ] as const)
    child.relations.push({
      id: "parent-link",
      target: ref(parent.id),
      fields: [
        { source: "scope", target: "scope" },
        { source: "parent", target: "id" },
      ],
      cardinality: "many-to-one",
      ownership: "owned",
      scope: "same-scope",
      onDelete: "cascade",
    });
  need(m.aggregates[0]).children = [ref(line.id)];
  for (const o of m.operations ?? []) o.transaction.participants.push(ref(line.id));
  const newAggregate = (id: string, root: string, children: string[], lock = false) => {
    const g = structuredClone(need(m.aggregates[0]));
    g.id = id;
    g.name = id;
    g.root = ref(root);
    g.children = children.map((id) => ref(id));
    g.invariants = [];
    g.concurrency = lock
      ? {
          kind: "row-lock",
          entities: [root, ...children].sort().map((id) => ref(id)),
          order: "entity-id-primary-key",
        }
      : { kind: "optimistic", version: { entity: ref(root), field: "version" } };
    m.aggregates.push(g);
    return g;
  };
  newAggregate("inventory-aggregate", stock.id, [reservation.id], true);
  newAggregate("order-aggregate", order.id, [orderLine.id]);
  newAggregate("payment-aggregate", payment.id, []);
  newAggregate("shipment-aggregate", shipment.id, [shipmentLine.id]);
  const newLifecycle = (root: string, aggregate: string) => {
    const e = need(m.entities.find((e) => e.id === root)),
      ct = need(a.contracts?.find((ct) => ct.id === e.contract.id));
    const states = need(ct.shape?.payload.find((f) => f.id === "state")?.enumValues);
    const l = structuredClone(need(m.lifecycles?.[0]));
    l.id = `${root}-lifecycle`;
    l.name = l.id;
    l.aggregate = ref(aggregate);
    l.state = { entity: ref(root), field: "state" };
    l.states = states;
    l.initial = need(states[0]);
    l.transitions = states
      .slice(1)
      .map((s) => ({ id: `to-${s}`, from: l.initial, to: s, guards: [] }));
    m.lifecycles?.push(l);
    return { reference: ref(l.id), guards: [] };
  };
  payment.uniqueKeys.push({
    id: "provider-key-unique",
    fields: ["scope", "provider-key"],
    scope: "entity-scope",
    nulls: "forbidden",
  });
  const inventoryLifecycle = newLifecycle(reservation.id, "inventory-aggregate"),
    orderLifecycle = newLifecycle(order.id, "order-aggregate"),
    paymentLifecycle = newLifecycle(payment.id, "payment-aggregate"),
    shipmentLifecycle = newLifecycle(shipment.id, "shipment-aggregate");
  const newOperation = (id: string, aggregate: string, root: string, participants: string[]) => {
    const o = need(
      mapBackendModel(
        {
          schemaVersion: 1,
          entities: [],
          aggregates: [],
          operations: [structuredClone(operation(d))],
        },
        { record: root, aggregate, policy: `${root}-policy` },
      ).operations?.[0],
    );
    o.id = id;
    o.name = id;
    o.target.operation = id;
    if (m.aggregates.find((g) => g.id === aggregate)?.concurrency.kind === "row-lock")
      o.expectedVersion = { kind: "none" };
    o.transaction.participants = participants.map((id) => ref(id));
    const state = need(
      a.contracts
        ?.find((c) => c.id === need(m.entities.find((e) => e.id === root)).contract.id)
        ?.shape?.payload.find((f) => f.id === "state")?.enumValues?.[0],
    );
    const guard = need(o.guards[0]);
    if (guard.kind === "compare") guard.right = literal(state);
    const p = structuredClone(need(m.accessPolicies?.find((v) => v.id === "policy")));
    p.id = `${root}-policy`;
    p.resource = ref(root);
    if (!m.accessPolicies?.some((v) => v.id === p.id)) m.accessPolicies?.push(p);
    const w = structuredClone(wire(d));
    w.id = id;
    w.name = id.replaceAll("-", "_");
    need(a.contracts?.find((c) => c.id === "commands")?.shape).operations.push(w);
    m.operations?.push(o);
    return ref(id);
  };
  const add = newOperation("cart-add", "aggregate", "record", ["record", "cart-line"]),
    change = newOperation("cart-change", "aggregate", "record", ["record", "cart-line"]),
    remove = newOperation("cart-remove", "aggregate", "record", ["record", "cart-line"]);
  const checkout = newOperation("checkout", "order-aggregate", "order", [
      "record",
      "cart-line",
      "stock",
      "reservation",
      "order",
      "order-line",
    ]),
    cancel = newOperation("cancel-order", "order-aggregate", "order", [
      "order",
      "order-line",
      "stock",
      "reservation",
    ]),
    expire = newOperation("expire-stock", "inventory-aggregate", "stock", ["stock", "reservation"]),
    callback = newOperation("payment-callback", "payment-aggregate", "payment-attempt", [
      "payment-attempt",
      "order",
      "order-line",
      "stock",
      "reservation",
    ]),
    reconcile = newOperation("payment-reconcile", "payment-aggregate", "payment-attempt", [
      "payment-attempt",
      "order",
      "order-line",
      "stock",
      "reservation",
    ]),
    ship = newOperation("ship", "shipment-aggregate", "shipment", [
      "shipment",
      "shipment-line",
      "order",
      "order-line",
      "reservation",
      "stock",
    ]);
  const guarded = (operation: { id: string; version: string }) => ({
    operation,
    guards: ["editable"],
  });
  const f = (entity: string, field: string) => ({ entity: ref(entity), field });
  const jobs = (id: string, consumer: { id: string; version: string }) => {
    const e = structuredClone(need(m.effects?.find((v) => v.id === "outbox")));
    e.id = `${id}-effect`;
    const consumerOp = need(m.operations?.find((o) => o.id === consumer.id));
    const consumerWire = need(
      a.contracts
        ?.find((c) => c.id === consumerOp.target.contract.id)
        ?.shape?.operations.find((o) => o.id === consumerOp.target.operation),
    );
    consumerWire.input.push({
      id: "due",
      name: "due",
      type: "timestamp",
      required: true,
      description: "",
    });
    if (consumerOp.idempotency.kind === "command-key")
      consumerOp.idempotency.hashInputs.push(["due"]);
    const event = structuredClone(need(a.contracts?.find((c) => c.id === "domain-event")));
    event.id = `${id}-event`;
    need(event.shape).payload = structuredClone(consumerWire.input);
    a.contracts?.push(event);
    e.payload = ref(event.id);
    e.values = consumerWire.input.map((f) => ({
      field: f.id,
      value: f.id === "due" ? current("updated") : input(f.id),
    }));
    e.target = { kind: "event", contract: ref(event.id), consumer };
    m.effects?.push(e);
    const c = structuredClone(config(d, "delivery"));
    c.id = id;
    c.effect = ref(e.id);
    c.queue.event = e.payload;
    c.due = { kind: "event-time", field: "due" };
    c.unknown = { kind: "reconcile", operation: consumer, outcome: "uncertain" };
    m.capabilityConfigs?.push(c);
    return ref(id);
  };
  const expiryDelivery = jobs("stock-expiry-jobs", expire),
    reconcileDelivery = jobs("reconcile-jobs", reconcile);
  const dispatch = effect(d, "external");
  dispatch.id = "payment-dispatch";
  dispatch.after = [ref("outbox")];
  dispatch.delivery.duplicates = "destination-key";
  for (const r of dispatch.recovery)
    if (r.trigger === "external-timeout") r.reconcileOperation = reconcile;
  m.effects?.push(dispatch);
  // Exact typed seam remains a required after-commit provider hook, not an opaque adapter string.
  m.hooks = [
    backendHookSchema.parse({
      id: "provider-hook",
      version: "v1",
      name: "Typed provider seam",
      operation: ref("post-command"),
      owner,
      kind: "effectful",
      boundary: "after-commit",
      contracts: { input: ref("hook-input"), output: ref("hook-output"), error: ref("hook-error") },
      context: ["authorized-scope", "correlation", "service-purpose", "cancellation", "deadline"],
      authority: "current-policy-at-observation",
      dependencies: [],
      repositories: [],
      services: [reconcile],
      allowedWrites: [],
      writeMode: "validated-proposals-only",
      allowedEffects: [],
      result: "validate-exact-contract-before-use",
      privateData: "authorized-input-only",
      required: true,
      readiness: "before-mutation",
      timeoutSeconds: 20,
      cancellation: "cooperative-no-forced-termination",
      unavailable: { outcome: "unavailable", status: 503, writes: "none" },
      failure: {
        operation: ref("post-delivery"),
        scope: "separate-delivery-attempt",
        error: "failed",
        invalidResult: "failed",
        timeout: "failed",
        cancelled: "cancelled",
      },
      acceptance: ["V19-provider", "V19-unavailable"],
      seam: { file: "src/hooks/provider.ts", ownership: "scaffold-once-project-owned" },
      recovery: [],
    }),
  ];
  const moneyFields = ["record", "cart-line", "order", "order-line", "payment-attempt"].flatMap(
    (id) => [f(id, "price"), f(id, "total")],
  );
  const commerce: BackendCapabilityConfig[] = [
    {
      ...named("money-settings"),
      kind: "money",
      fields: moneyFields,
      currencies: ["USD"],
      minimumMinorUnits: 0,
      maximumMinorUnits: 1_000_000,
      maximumTotalMinorUnits: 1_000_000_000,
      maximumQuantity: 1000,
      maximumLines: 100,
      arithmetic: "checked-integer-minor-units",
      overflow: "reject-before-write",
      currency: "single-currency-per-quote",
    },
    {
      ...named("cart-settings"),
      kind: "cart",
      aggregate: ref("aggregate"),
      line: ref("cart-line"),
      relation: "parent-link",
      quantity: f("cart-line", "quantity"),
      variant: f("cart-line", "variant"),
      money: ref("money-settings"),
      quote: {
        strategy: { kind: "fixed-price", version: "v1", price: f("cart-line", "price") },
        shipping: { kind: "flat", minorUnits: 500 },
        tax: {
          kind: "fixture-rate",
          version: "v1",
          basisPoints: 750,
          rounding: "half-up-on-subtotal",
          production: "unsupported",
        },
        pricingHooks: [],
        expiresAfterSeconds: 900,
        expiresAt: f("record", "expires"),
        snapshot: [f("cart-line", "price"), f("cart-line", "quantity")],
        provenance: [f("record", "provenance")],
        inputAuthority: "server-catalog-and-validated-hooks",
        stale: "reject-before-write",
      },
      mutations: { add, change, remove },
      concurrency: "expected-version-and-command-receipt",
    },
    {
      ...named("inventory-settings"),
      kind: "inventory",
      aggregate: ref("inventory-aggregate"),
      stock: ref("stock"),
      reservation: ref("reservation"),
      relation: "parent-link",
      location: f("stock", "location"),
      variant: f("stock", "variant"),
      onHand: f("stock", "on-hand"),
      reserved: f("stock", "reserved"),
      quantity: f("reservation", "quantity"),
      countMeaning: "on-hand-includes-reserved",
      available: "on-hand-minus-active-and-held-reservations",
      concurrency: "stable-stock-and-reservation-row-locks",
      lifecycle: inventoryLifecycle,
      states: {
        active: "active",
        held: "held",
        consumed: "consumed",
        released: "released",
        expired: "expired",
      },
      expiry: {
        lifetimeSeconds: 1200,
        expiresAt: f("reservation", "expires"),
        delivery: expiryDelivery,
        operation: guarded(expire),
        eligible: "active-only-before-payment",
        race: "same-lock-recheck-state-version-and-due",
      },
      heldPayment: {
        payment: ref("payment-settings"),
        expiry: "never-automatically-release",
        resolution: "confirmed-terminal-payment-or-explicit-reconciliation",
      },
    },
    {
      ...named("order-settings"),
      kind: "order",
      concurrency: "stable-aggregate-entity-primary-key",
      aggregate: ref("order-aggregate"),
      cart: ref("cart-settings"),
      inventory: ref("inventory-settings"),
      money: ref("money-settings"),
      checkout: guarded(checkout),
      cancellation: guarded(cancel),
      lifecycle: orderLifecycle,
      snapshots: (
        [
          ["variant", "cart-line", "variant", "order-line"],
          ["quantity", "cart-line", "quantity", "order-line"],
          ["unit-price", "cart-line", "price", "order-line"],
          ["line-total", "cart-line", "total", "order-line"],
          ["address", "record", "address", "order"],
          ["order-total", "record", "total", "order"],
          ["quote-provenance", "record", "provenance", "order"],
        ] as const
      ).map(([purpose, source, field, target]) => ({
        purpose,
        source: f(source, field),
        target: f(target, field),
      })),
      snapshotMutation: "immutable-after-checkout",
      checkoutBoundary: "order-lines-reservations-and-receipt-one-store-transaction",
      quote: "recheck-version-expiry-currency-and-total-before-write",
      paymentReview: "review",
      cancellationWhileUncertain: "reconcile-before-release",
    },
    {
      ...named("payment-settings"),
      kind: "payment",
      concurrency: "stable-aggregate-entity-primary-key",
      entity: ref("payment-attempt"),
      order: ref("order-settings"),
      inventory: ref("inventory-settings"),
      money: ref("money-settings"),
      amount: f("payment-attempt", "total"),
      lifecycle: paymentLifecycle,
      states: {
        created: "created",
        submitted: "submitted",
        settled: "settled",
        failed: "failed",
        unknown: "unknown",
      },
      provider: { ...providerRef, deduplication: "destination-key" },
      dispatch: ref(dispatch.id),
      providerIdentity: f("payment-attempt", "provider-key"),
      identity: "persisted-attempt-key-reused-after-uncertainty",
      callback: {
        operation: guarded(callback),
        verification: "original-bytes-provider-credential-timestamp-replay",
        replayWindowSeconds: 300,
        receipt: "durable-provider-event-before-ack",
      },
      reconciliation: { operation: reconcile, delivery: reconcileDelivery, outcome: "uncertain" },
      uncertainty: "unknown-order-review-stock-held",
      terminal: "monotone-settlement-no-older-failure-regression",
      paymentsPerOrder: 1,
    },
    {
      ...named("fulfillment-settings"),
      kind: "fulfillment",
      concurrency: "stable-aggregate-entity-primary-key",
      aggregate: ref("shipment-aggregate"),
      order: ref("order-settings"),
      payment: ref("payment-settings"),
      inventory: ref("inventory-settings"),
      lifecycle: shipmentLifecycle,
      shipment: guarded(ship),
      identity: f("shipment", "id"),
      ordered: f("order-line", "quantity"),
      paid: f("order-line", "paid"),
      reserved: f("reservation", "quantity"),
      fulfilled: f("order-line", "fulfilled"),
      quantity: f("shipment-line", "quantity"),
      maximumQuantity: 1000,
      constraint: "positive-at-most-paid-reserved-and-unfulfilled",
      partial: "sum-committed-shipments-under-order-line-lock",
      retry: "same-command-returns-same-shipment",
    },
  ];
  m.capabilityConfigs?.push(...commerce);
  return designSchema.parse(d);
}

it("closes P66 with all thirteen typed setting kinds and preserved command/effect/hook/recovery declarations", () => {
  const d = commerceFixture();
  expect(validateBackendCapabilityConfigs(d)).toEqual([]);
  expect(errors(d)).toEqual([]);
  expect(new Set(model(d).capabilityConfigs?.map((c) => c.kind)).size).toBe(13);
  expect(blocksGenerate(validateDesign(d, testLookup))).toBe(true);
});

it("rejects opaque commerce settings, executable strings, unsupported choices and out-of-bound numeric options", () => {
  const d = commerceFixture();
  for (const kind of ["money", "cart", "inventory", "order", "payment", "fulfillment"] as const) {
    const c = config(d, kind);
    expect(backendCapabilityConfigSchema.safeParse({ ...c, config: "{}" }).success).toBe(false);
    expect(backendCapabilityConfigSchema.safeParse({ ...c, script: "charge()" }).success).toBe(
      false,
    );
    expect(backendCapabilityConfigSchema.safeParse({ ...c, schemaVersion: 2 }).success).toBe(false);
  }
  const money = config(d, "money"),
    cart = config(d, "cart"),
    inventory = config(d, "inventory"),
    payment = config(d, "payment"),
    shipment = config(d, "fulfillment");
  for (const value of [-1, 1.1, Number.MAX_SAFE_INTEGER + 1, Infinity])
    expect(
      backendCapabilityConfigSchema.safeParse({ ...money, maximumMinorUnits: value }).success,
    ).toBe(false);
  for (const [key, value] of [
    ["maximumQuantity", 0],
    ["maximumQuantity", 1_000_001],
    ["maximumLines", 1001],
    ["currencies", ["usd"]],
  ] as const)
    expect(backendCapabilityConfigSchema.safeParse({ ...money, [key]: value }).success).toBe(false);
  expect(
    backendCapabilityConfigSchema.safeParse({
      ...cart,
      quote: { ...cart.quote, expiresAfterSeconds: 0 },
    }).success,
  ).toBe(false);
  expect(
    backendCapabilityConfigSchema.safeParse({
      ...cart,
      quote: { ...cart.quote, strategy: { kind: "javascript", source: "1+1" } },
    }).success,
  ).toBe(false);
  expect(
    backendCapabilityConfigSchema.safeParse({
      ...inventory,
      heldPayment: { ...inventory.heldPayment, expiry: "release-at-deadline" },
    }).success,
  ).toBe(false);
  expect(
    backendCapabilityConfigSchema.safeParse({
      ...inventory,
      expiry: { ...inventory.expiry, lifetimeSeconds: 0 },
    }).success,
  ).toBe(false);
  expect(
    backendCapabilityConfigSchema.safeParse({
      ...payment,
      uncertainty: "assume-failed-and-retry-new-key",
    }).success,
  ).toBe(false);
  expect(
    backendCapabilityConfigSchema.safeParse({
      ...payment,
      provider: { ...payment.provider, secret: "forbidden" },
    }).success,
  ).toBe(false);
  expect(backendCapabilityConfigSchema.safeParse({ ...shipment, maximumQuantity: 0 }).success).toBe(
    false,
  );
});

it("validates exact minor-unit storage, currencies and amount bounds without attempting floating point arithmetic", () => {
  const base = commerceFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "money").minimumMinorUnits = 2_000_000;
    },
    (d: DesignDocument) => {
      config(d, "money").maximumTotalMinorUnits = 1;
    },
    (d: DesignDocument) => {
      config(d, "money").maximumTotalMinorUnits = Number.MAX_SAFE_INTEGER;
    },
    (d: DesignDocument) => {
      config(d, "money").currencies = ["EUR"];
    },
    (d: DesignDocument) => {
      config(d, "money").currencies = ["USD", "USD"];
    },
    (d: DesignDocument) => {
      config(d, "money").fields.push(structuredClone(need(config(d, "money").fields[0])));
    },
    (d: DesignDocument) => {
      need(
        model(d)
          .entities.find((e) => e.id === "cart-line")
          ?.fields.find((f) => f.field === "price"),
      ).storage = { kind: "json", query: "opaque" };
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  // A bound is a rejection limit, not a promise that multiplying all allowed inputs fits it.
  config(base, "money").maximumMinorUnits = 1_000_000_000;
  expect(validateBackendCapabilityConfigs(base)).toEqual([]);
  expect(config(base, "money").overflow).toBe("reject-before-write");
});

it("requires authoritative cart fields, expected versions, finite quote strategies and typed required pricing hooks", () => {
  const base = commerceFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "cart").quantity.field = "body";
    },
    (d: DesignDocument) => {
      config(d, "cart").quote.expiresAt.field = "quantity";
    },
    (d: DesignDocument) => {
      config(d, "cart").quote.provenance[0] = { entity: ref("stock"), field: "provenance" };
    },
    (d: DesignDocument) => {
      config(d, "cart").quote.shipping = { kind: "flat", minorUnits: 1_000_000_001 };
    },
    (d: DesignDocument) => {
      config(d, "cart").quote.strategy = { kind: "hook", hook: ref("provider-hook") };
    },
    (d: DesignDocument) => {
      need(model(d).operations?.find((o) => o.id === "cart-add")).expectedVersion = {
        kind: "none",
      };
    },
    (d: DesignDocument) => {
      config(d, "cart").relation = "absent";
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  // A production tax/shipping quote remains an explicit required hook obligation.
  config(base, "cart").quote.tax = { kind: "hook", hook: ref("provider-hook") };
  config(base, "cart").quote.shipping = { kind: "hook", hook: ref("provider-hook") };
  expect(validateBackendCapabilityConfigs(base)).toEqual([]);
  need(model(base).hooks?.[0]).required = false;
  expect(messages(base)).toContain("Pricing hooks must be required");
});

it("rejects incompatible stock counts, row locks, state roles and expiry/payment-hold references", () => {
  const base = commerceFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "inventory").reserved = structuredClone(config(d, "inventory").onHand);
    },
    (d: DesignDocument) => {
      config(d, "inventory").location.entity = ref("reservation");
    },
    (d: DesignDocument) => {
      config(d, "inventory").quantity.field = "body";
    },
    (d: DesignDocument) => {
      config(d, "inventory").states.held = "active";
    },
    (d: DesignDocument) => {
      config(d, "inventory").states.expired = "missing";
    },
    (d: DesignDocument) => {
      config(d, "inventory").expiry.expiresAt.entity = ref("stock");
    },
    (d: DesignDocument) => {
      config(d, "inventory").heldPayment.payment = ref("money-settings");
    },
    (d: DesignDocument) => {
      config(d, "inventory").expiry.operation.guards = ["absent"];
    },
    (d: DesignDocument) => {
      config(d, "inventory").expiry.delivery = ref("delivery");
    },
    (d: DesignDocument) => {
      need(model(d).aggregates.find((g) => g.id === "inventory-aggregate")).concurrency = {
        kind: "optimistic",
        version: { entity: ref("stock"), field: "version" },
      };
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  expect(config(base, "inventory").expiry.eligible).toBe("active-only-before-payment");
  expect(config(base, "inventory").heldPayment.expiry).toBe("never-automatically-release");
});

it("retains all order snapshot meanings, exact value shapes and a one-store checkout transaction", () => {
  const base = commerceFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "order").snapshots = config(d, "order").snapshots.filter(
        (s) => s.purpose !== "address",
      );
    },
    (d: DesignDocument) => {
      need(config(d, "order").snapshots.find((s) => s.purpose === "unit-price")).target.field =
        "body";
    },
    (d: DesignDocument) => {
      need(config(d, "order").snapshots.find((s) => s.purpose === "address")).source.entity =
        ref("stock");
    },
    (d: DesignDocument) => {
      config(d, "order").paymentReview = "absent";
    },
    (d: DesignDocument) => {
      config(d, "order").cancellation.operation = ref("cart-add");
    },
    (d: DesignDocument) => {
      need(model(d).operations?.find((o) => o.id === "checkout")).transaction.participants = [
        ref("order"),
        ref("order-line"),
      ];
    },
    (d: DesignDocument) => {
      need(model(d).aggregates.find((g) => g.id === "inventory-aggregate")).store = "other-store";
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
});

it("allows only the finite exact commerce transaction union and preserves ordinary aggregate/access boundaries", () => {
  const base = commerceFixture();
  expect(validateBackendBehavior(base)).toEqual([]);
  const without = structuredClone(base);
  model(without).capabilityConfigs = model(without).capabilityConfigs?.filter(
    (c) => c.kind !== "order",
  );
  expect(
    validateBackendBehavior(without).some((f) =>
      f.message.includes("exactly its aggregate participants"),
    ),
  ).toBe(true);
  const arbitrary = structuredClone(base);
  operation(arbitrary).transaction.participants.push(ref("stock"));
  expect(validateBackendBehavior(arbitrary).some(isStructural)).toBe(true);
  const scoped = structuredClone(base);
  need(scoped.architecture?.components).push({
    ...structuredClone(need(scoped.architecture?.components?.[0])),
    id: "other-module",
    element: "provider",
  });
  need(model(scoped).aggregates.find((g) => g.id === "inventory-aggregate")).owner = {
    kind: "component",
    id: "other-module",
  };
  expect(
    validateBackendBehavior(scoped).some((f) =>
      f.message.includes("Composed commerce transactions"),
    ),
  ).toBe(true);
  const privateChild = structuredClone(base),
    checkout = need(model(privateChild).operations?.find((o) => o.id === "checkout"));
  checkout.actions.push({
    id: "stock-write",
    kind: "patch",
    entity: ref("stock"),
    values: [{ field: "body", value: input("body") }],
  });
  checkout.writes.push({ entity: ref("stock"), field: "body" });
  expect(
    validateBackendBehavior(privateChild).some(
      (f) => f.code === "CONFIG_REQUIRED" && f.message.includes("stock@v1"),
    ),
  ).toBe(true);
  const crossStore = structuredClone(base);
  need(model(crossStore).aggregates.find((g) => g.id === "inventory-aggregate")).store =
    "other-store";
  expect(
    validateBackendBehavior(crossStore).some((f) => f.message.includes("cross-store atomicity")),
  ).toBe(true);
});

it("keeps provider uncertainty, monotone settlement, raw-byte callback and reconciliation identities exact", () => {
  const base = commerceFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "payment").provider.deduplication = "none";
    },
    (d: DesignDocument) => {
      config(d, "payment").provider.binding = "absent";
    },
    (d: DesignDocument) => {
      config(d, "payment").provider.interface = "provider-required";
    },
    (d: DesignDocument) => {
      config(d, "payment").amount.entity = ref("order");
    },
    (d: DesignDocument) => {
      config(d, "payment").providerIdentity.field = "quantity";
    },
    (d: DesignDocument) => {
      config(d, "payment").states.unknown = "failed";
    },
    (d: DesignDocument) => {
      config(d, "payment").reconciliation.outcome = "ok";
    },
    (d: DesignDocument) => {
      config(d, "payment").callback.operation.operation = ref("cart-add");
    },
    (d: DesignDocument) => {
      need(model(d).lifecycles?.find((l) => l.id === "payment-attempt-lifecycle")).transitions.push(
        { id: "older-failure", from: "settled", to: "failed", guards: [] },
      );
    },
    (d: DesignDocument) => {
      need(model(d).effects?.find((e) => e.id === "payment-dispatch")).boundary = "before-commit";
    },
    (d: DesignDocument) => {
      need(model(d).effects?.find((e) => e.id === "payment-dispatch")).recovery = [];
    },
    (d: DesignDocument) => {
      config(d, "payment").reconciliation.delivery = ref("stock-expiry-jobs");
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  expect(config(base, "payment").identity).toBe("persisted-attempt-key-reused-after-uncertainty");
});

it("bounds partial fulfillment by exact paid/reserved/unfulfilled authorities with stable retry identity", () => {
  const base = commerceFixture();
  for (const change of [
    (d: DesignDocument) => {
      config(d, "fulfillment").maximumQuantity = 1001;
    },
    (d: DesignDocument) => {
      config(d, "fulfillment").paid = structuredClone(config(d, "fulfillment").ordered);
    },
    (d: DesignDocument) => {
      config(d, "fulfillment").reserved.entity = ref("order-line");
    },
    (d: DesignDocument) => {
      config(d, "fulfillment").quantity.entity = ref("order-line");
    },
    (d: DesignDocument) => {
      config(d, "fulfillment").identity.entity = ref("order");
    },
    (d: DesignDocument) => {
      config(d, "fulfillment").shipment.guards = ["missing"];
    },
    (d: DesignDocument) => {
      need(model(d).operations?.find((o) => o.id === "ship")).transaction.participants = [
        ref("shipment"),
        ref("shipment-line"),
      ];
    },
  ]) {
    const d = structuredClone(base);
    change(d);
    expect(validateBackendCapabilityConfigs(d).some(isStructural)).toBe(true);
  }
  expect(config(base, "fulfillment").partial).toContain("sum-committed-shipments");
  expect(config(base, "fulfillment").retry).toBe("same-command-returns-same-shipment");
});

it("source-addresses every exact commerce reference on removal and protects referenced settings/hooks/lifecycles", () => {
  const base = commerceFixture();
  for (const c of model(base).capabilityConfigs?.filter((c) =>
    ["money", "cart", "inventory", "order", "payment", "fulfillment"].includes(c.kind),
  ) ?? []) {
    for (const r of backendCapabilityExactReferences(c)) {
      const d = structuredClone(base);
      if (r.collection === "contracts")
        need(d.architecture).contracts = d.architecture?.contracts?.filter(
          (v) => contractKey(v) !== contractKey(r.reference),
        );
      else
        Object.assign(model(d), {
          [r.collection]: model(d)[r.collection]?.filter(
            (v) => contractKey(v) !== contractKey(r.reference),
          ),
        });
      expect(
        validateBackendCapabilityConfigs(d).some(
          (f) => f.code === "UNKNOWN_REFERENCE" && f.target.path?.includes(contractKey(c)),
        ),
        `${c.kind}/${r.collection}/${contractKey(r.reference)}`,
      ).toBe(true);
      expect(backendDataRemovalFindings(d).some(isStructural)).toBe(true);
    }
  }
  const changed = structuredClone(base);
  config(changed, "money").maximumLines++;
  expect(save(base, changed).ok).toBe(false);
  const removed = structuredClone(base);
  model(removed).capabilityConfigs = [];
  need(model(removed).hooks?.[0]).timeoutSeconds++;
  expect(save(base, removed).ok).toBe(false);
  const renamed = structuredClone(base);
  config(renamed, "money").name = "Display rename";
  expect(save(base, renamed).ok).toBe(true);
});

it("retains all commerce refs and local identities through combined extraction/insertion/reuse/copy/export", async () => {
  const source = commerceFixture(),
    before = structuredClone(model(source));
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api", "store", "provider"] },
    {
      id: "all-settings",
      version: "1.0.0",
      name: "All settings",
      purpose: "Combined P66 portability",
    },
    testLookup,
  );
  expect(fragment.architecture.backend?.capabilityConfigs).toHaveLength(15);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `copy-${id}`]));
  for (const local of [
    "quantity",
    "parent-link",
    "minor",
    "currency",
    "review",
    "editable",
    "price",
    "provenance",
    "local-provider",
    "send",
  ])
    ids[local] = `wrong-${local}`;
  const mapped = mappedArchitecture(fragment, ids),
    remapped = need(mapped.backend);
  for (const original of fragment.architecture.backend?.capabilityConfigs ?? []) {
    const copy = need(remapped.capabilityConfigs?.find((c) => c.id === `copy-${original.id}`));
    expect(backendCapabilityExactReferences(copy)).toEqual(
      backendCapabilityExactReferences(original).map((r) => ({
        ...r,
        reference: { ...r.reference, id: ids[r.reference.id] ?? r.reference.id },
      })),
    );
  }
  const entry: ArchitectureLibraryEntry = {
    id: fragment.id,
    version: fragment.version,
    fragment,
    metadata,
    state: "published",
    draftRevision: 1,
    contentHash: "b".repeat(64),
    availability: "architecture only",
  };
  const empty = designSchema.parse({ schemaVersion: 2, revision: 0 });
  const selection = {
    id: entry.id,
    version: entry.version,
    contentHash: entry.contentHash,
    instanceId: "copy",
    name: "Copy",
    baseRevision: 0,
  };
  const preview = previewArchitectureTemplate(empty, entry, selection, testLookup);
  expect(preview.errors).toEqual([]);
  const saved = applyOperations(empty, preview.ops, testLookup);
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  expect(errors(saved.design)).toEqual([]);
  expect(designSchema.parse(JSON.parse(JSON.stringify(saved.design)))).toEqual(saved.design);
  const pin = need(saved.design.architecture?.patternInstances?.[0]);
  const reuse = previewArchitectureTemplate(
    saved.design,
    entry,
    {
      ...selection,
      instanceId: "reuse",
      baseRevision: saved.design.revision,
      roles: Object.fromEntries(
        fragment.roles.map((r) => [
          r.id,
          { mode: "reuse" as const, id: need(pin.identities[r.id]) },
        ]),
      ),
    },
    testLookup,
  );
  expect(reuse.errors).toEqual([]);
  const reused = applyOperations(saved.design, reuse.ops, testLookup);
  expect(reused.ok).toBe(true);
  if (reused.ok) expect(model(reused.design)).toEqual(model(saved.design));
  const args = { design: source, project: { id: "p66", name: "P66 complete" }, lookup: testLookup };
  const handoff = await buildArchitectureHandoff(args);
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(before);
  expect(handoffJson(await buildArchitectureHandoff(args))).toBe(handoffJson(handoff));
  expect(handoffMarkdown(handoff)).toContain("payment-settings");
  expect(model(source)).toEqual(before);
  const changed = structuredClone(source);
  config(changed, "money").maximumLines++;
  expect(
    targetChanges(source, changed).some((c) =>
      c.path.startsWith("architecture/backend/capabilityConfigs/"),
    ),
  ).toBe(true);
  expect(await handoffFingerprint(changed, args.project)).not.toBe(
    await handoffFingerprint(source, args.project),
  );
  const copied = {
    ...source,
    architecture: {
      ...need(source.architecture),
      backend: mapBackendModel(
        before,
        Object.fromEntries(
          [
            ...(before.capabilityConfigs ?? []).flatMap((c) => [
              c.id,
              ...backendCapabilityReferences(c),
            ]),
            ...(before.effects ?? []).map((e) => e.id),
            ...(before.hooks ?? []).map((h) => h.id),
          ].map((id) => [id, `copy-${id}`]),
        ),
      ),
    },
  };
  expect(config(copied, "cart").quote).toMatchObject({
    strategy: { kind: "fixed-price", version: "v1", price: { field: "price" } },
    provenance: [{ field: "provenance" }],
  });
  expect(config(copied, "inventory").relation).toBe("parent-link");
  expect(config(copied, "order").paymentReview).toBe("review");
  expect(config(copied, "payment").provider.operation).toBe("send");
  expect(config(copied, "payment").provider.environment).toEqual(providerRef.environment);
  expect(config(copied, "fulfillment").quantity.field).toBe("quantity");
  expect(
    need(model(copied).effects?.find((e) => e.id === "copy-payment-dispatch")).recovery[2]
      ?.reconcileOperation,
  ).toEqual(ref("copy-payment-reconcile"));
});

it("represents the three examples' mechanism settings with typed fields and preserves all exact behavior declarations in export", async () => {
  const d = commerceFixture(),
    m = model(d);
  const obligations = {
    discourse: ["delivery", "files", "notifications", "search", "routing"],
    vendure: [
      "money",
      "cart",
      "inventory",
      "order",
      "payment",
      "fulfillment",
      "search",
      "notifications",
      "delivery",
    ],
    zammad: [
      "calendar",
      "business-time",
      "delivery",
      "files",
      "notifications",
      "search",
      "routing",
    ],
  };
  for (const kinds of Object.values(obligations))
    for (const kind of kinds) expect(m.capabilityConfigs?.some((c) => c.kind === kind)).toBe(true);
  const schema = JSON.stringify(operationBatchJsonSchema());
  for (const token of [
    "checked-integer-minor-units",
    "single-currency-per-quote",
    "immutable-after-checkout",
    "never-automatically-release",
    "unknown-order-review-stock-held",
    "positive-at-most-paid-reserved-and-unfulfilled",
    "pricingHooks",
    "callback",
    "reconciliation",
  ])
    expect(schema).toContain(token);
  expect(schema).not.toContain('"sourceCode"');
  const output = JSON.parse(
    handoffJson(
      await buildArchitectureHandoff({
        design: d,
        project: { id: "settings-gate", name: "Settings gate" },
        lookup: testLookup,
      }),
    ),
  ).intent.backend;
  for (const collection of [
    "capabilityConfigs",
    "operations",
    "lifecycles",
    "effects",
    "hooks",
  ] as const)
    expect(output[collection]).toEqual(m[collection]);
  expect(config(d, "cart").quote.tax).toEqual({
    kind: "fixture-rate",
    version: "v1",
    basisPoints: 750,
    rounding: "half-up-on-subtotal",
    production: "unsupported",
  });
  // Frozen fixture settings fit the typed choices without rewriting an expected amount.
  const frozen = JSON.parse(
    readFileSync(
      new URL("../../../benchmarks/vendure-core/v1/fixtures.json", import.meta.url),
      "utf8",
    ),
  );
  const quotes = frozen.datasets.find((v: { id: string }) => v.id === "quotes").rows;
  expect(quotes[0]).toMatchObject({
    subtotal: { minor: 1999, currency: "USD" },
    tax: { minor: 150, currency: "USD" },
    shipping: { minor: 500, currency: "USD" },
    total: { minor: 2649, currency: "USD" },
    taxPolicy: "fixture-tax-750bps-v1",
  });
  expect(m.effects?.some((e) => e.recovery.some((r) => r.trigger === "external-timeout"))).toBe(
    true,
  );
  expect(
    m.hooks?.every(
      (h) =>
        h.contracts.input.version &&
        h.contracts.output.version &&
        h.contracts.error.version &&
        h.acceptance.length,
    ),
  ).toBe(true);
});

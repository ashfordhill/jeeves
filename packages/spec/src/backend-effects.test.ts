import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { z } from "zod";
import { applyOperations } from "./apply.ts";
import {
  architectureContractSchema,
  type ContractField,
  type ContractValue,
  contractKey,
} from "./architecture-contracts.ts";
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
import { backendActionSchema } from "./backend-behavior-model.ts";
import { backendDataRemovalFindings } from "./backend-data.ts";
import { validateBackendEffects, validateBackendEffectsTransition } from "./backend-effects.ts";
import {
  type BackendEffect,
  type BackendHook,
  type BackendRecovery,
  backendEffectSchema,
  backendHookSchema,
} from "./backend-effects-model.ts";
import { backendModelSchema, mapBackendModel } from "./backend-model.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { discourseHookSchemas } from "./discourse-benchmark.ts";
import { blocksGenerate, isStructural } from "./findings.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";
import { vendureHookSchemas } from "./vendure-benchmark.ts";
import { zammadHookSchemas } from "./zammad-benchmark.ts";

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
function hook(d: DesignDocument, kind: "pure" | "effectful" = "pure"): BackendHook {
  return backendHookSchema.parse({
    id: kind === "pure" ? "render-hook" : "provider-hook",
    version: "v1",
    name: "Typed finishing seam",
    operation: ref(operation(d).id),
    owner: { kind: "component", id: "module" },
    kind,
    boundary: kind === "pure" ? "before-commit" : "after-commit",
    contracts: { input: ref("hook-input"), output: ref("hook-output"), error: ref("hook-error") },
    context: [
      "authorized-scope",
      "correlation",
      "cancellation",
      "deadline",
      ...(kind === "effectful" ? ["service-purpose"] : []),
    ],
    authority: "current-policy-at-observation",
    dependencies: [],
    repositories: [],
    services: [],
    allowedWrites: kind === "pure" ? [{ entity: ref("record"), field: "body" }] : [],
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
      operation: ref(need(model(d).operations?.[kind === "pure" ? 0 : 1]).id),
      scope: kind === "pure" ? "source-transaction" : "separate-delivery-attempt",
      error: "failed",
      invalidResult: "failed",
      timeout: "failed",
      cancelled: "cancelled",
    },
    acceptance: ["D16-rendering", "D16-unavailable"],
    seam: { file: `src/hooks/${kind}.ts`, ownership: "scaffold-once-project-owned" },
    recovery: kind === "pure" ? [recovery(d, "hook-failure")] : [],
  });
}
function addPure(d: DesignDocument) {
  const h = hook(d);
  model(d).hooks = [h];
  operation(d).actions.unshift({
    id: "render",
    kind: "hook",
    hook: ref(h.id),
    input: [{ field: "body", value: input("body") }],
  });
  const patch = operation(d).actions.find((a) => a.id === "patch");
  if (patch && "values" in patch)
    need(patch.values.find((v) => v.field === "body")).value = {
      kind: "result",
      action: "render",
      path: ["body"],
    };
}
function addAudit(d: DesignDocument) {
  const a = need(d.architecture),
    ds = structuredClone(need(a.datasets?.[0]));
  ds.id = "audit-data";
  ds.name = "Audit intent";
  ds.contract = ref("effect-data");
  a.datasets?.push(ds);
  model(d).effects = [effect(d, "audit")];
}
const structuralEffects = (d: DesignDocument) => validateBackendEffects(d).filter(isStructural);

it("traces post creation to atomic outbox and eligible per-recipient notification without inventing delivery", () => {
  const d = fixture();
  addAudit(d);
  const outbox = effect(d);
  outbox.after = [ref("audit")];
  const notification = effect(d);
  notification.id = "notification";
  const deliveryPayload = architectureContractSchema.parse({
    id: "notification-input",
    version: "v1",
    name: "Notification command input",
    kind: "data",
    coverage: "Complete",
    shape: { payload: structuredClone(wire(d).input), operations: [] },
  });
  d.architecture?.contracts?.push(deliveryPayload);
  notification.payload = ref("notification-input");
  notification.values = wire(d).input.map((f) => ({ field: f.id, value: input(f.id) }));
  notification.target = {
    kind: "notification",
    operation: ref(need(model(d).operations?.[1]).id),
    recipients: ref("recipients"),
  };
  notification.after = [ref("outbox")];
  notification.delivery.recipient = "each-eligible-recipient";
  const o = operation(d);
  o.identity = [];
  o.guards = [];
  o.target.operation = "create-post";
  wire(d).id = "create-post";
  o.actions = [
    {
      id: "new-post",
      kind: "create",
      entity: ref("record"),
      values: [
        { field: "id", value: { kind: "server", factory: "uuid" } },
        { field: "scope", value: { kind: "context", value: "scope" } },
        { field: "author", value: { kind: "context", value: "principal" } },
        { field: "version", value: { kind: "server", factory: "initial-version" } },
        { field: "state", value: literal("open") },
        { field: "body", value: input("body") },
        { field: "assignee", value: literal(null) },
        { field: "updated", value: { kind: "server", factory: "clock" } },
      ],
    },
  ];
  const createAction = need(o.actions[0]);
  if (createAction.kind === "create")
    o.writes = createAction.values.map((v) => ({ entity: ref("record"), field: v.field }));
  need(o.outcomes.find((v) => v.trigger === "success")).values = [
    { field: "body", value: { kind: "result", action: "new-post", path: ["body"] } },
  ];
  model(d).effects?.push(outbox, notification);
  expect(structuralEffects(d)).toEqual([]);
  expect(errors(d)).toEqual([]);
  expect(validateBackendEffects(d)).toEqual([]);
  expect(outbox).toMatchObject({
    boundary: "atomic-intent",
    execution: "durable-intent",
    delivery: { guarantee: "at-least-once" },
  });
  expect(notification.delivery.recipient).toBe("each-eligible-recipient");
});

it("traces checkout intent to an effectful payment adapter and exact reconciliation after timeout", () => {
  const d = fixture("order"),
    m = model(d);
  m.hooks = [hook(d, "effectful")];
  const outbox = effect(d),
    dispatch = effect(d, "external");
  dispatch.after = [ref("outbox")];
  const callback = structuredClone(need(m.operations?.[1]));
  callback.id = "payment-callback";
  callback.name = "Verified payment callback";
  callback.target.operation = "callback";
  callback.target.contract = ref("payment-callback-api");
  callback.access.action = "pay";
  callback.guards = [
    {
      id: "pending",
      kind: "compare",
      left: current("state"),
      operator: "eq",
      right: literal("submitted"),
    },
  ];
  callback.actions.push({
    id: "settle",
    kind: "transition",
    lifecycle: ref("lifecycle"),
    transition: "to-paid",
  });
  callback.writes.push({ entity: ref("record"), field: "state" });
  const callbackWire = structuredClone(wire(d));
  callbackWire.id = "callback";
  callbackWire.name = "Verified payment callback";
  d.architecture?.contracts?.push(
    architectureContractSchema.parse({
      id: "payment-callback-api",
      version: "v1",
      name: "Verified callback",
      kind: "api",
      coverage: "Complete",
      shape: { payload: [], operations: [callbackWire] },
    }),
  );
  d.architecture?.interfaces?.push({
    ...structuredClone(need(d.architecture.interfaces[0])),
    id: "callback-provided",
    contract: ref("payment-callback-api"),
  });
  m.operations?.push(callback);
  need(m.hooks[0]).services = [ref(callback.id), ref("order-delivery")];
  need(m.hooks[0]).repositories = [ref("recipients")];
  need(m.hooks[0]).privateData = "current-policy-recheck";
  addAudit(d);
  const callbackAudit = effect(d, "audit");
  callbackAudit.id = "settlement-audit";
  callbackAudit.source = ref(callback.id);
  need(callbackAudit.recovery[0]).operation = ref(callback.id);
  m.effects = [outbox, dispatch, callbackAudit];
  expect(structuralEffects(d)).toEqual([]);
  expect(validateBackendBehavior(d)).toEqual([]);
  expect(errors(d)).toEqual([]);
  expect(dispatch.recovery.find((r) => r.trigger === "external-timeout")).toMatchObject({
    strategy: "reconcile-before-retry",
    reconcileOperation: ref("order-delivery"),
  });
  expect(need(m.hooks[0]).failure.scope).toBe("separate-delivery-attempt");
  expect(need(m.hooks[0]).services).toEqual([ref("payment-callback"), ref("order-delivery")]);
  expect(save(fixture("order"), d).ok).toBe(true);
  const portable = mapBackendModel(m, {
    "order-command": "copy-checkout",
    "order-delivery": "copy-reconcile",
    "payment-callback": "copy-callback",
    recipients: "copy-recipients",
    module: "copy-owner",
  });
  expect(portable.hooks?.[0]).toMatchObject({
    operation: ref("copy-checkout"),
    owner: { id: "copy-owner" },
    repositories: [ref("copy-recipients")],
    services: [ref("copy-callback"), ref("copy-reconcile")],
    failure: { operation: ref("copy-reconcile"), scope: "separate-delivery-attempt" },
  });
});

it("traces a deadline to durable escalation intent with stable order and exact failure invariants", () => {
  const d = fixture("ticket");
  addAudit(d);
  operation(d).name = "Handle due deadline version";
  wire(d).name = "Handle due deadline version";
  operation(d).guards.push({
    id: "deadline-version",
    kind: "compare",
    left: current("version"),
    operator: "eq",
    right: input("expected"),
  });
  const escalation = effect(d);
  escalation.id = "escalation";
  escalation.name = "Deadline version escalation";
  escalation.after = [ref("audit")];
  model(d).effects?.push(escalation);
  expect(errors(d)).toEqual([]);
  expect(validateBackendEffects(d)).toEqual([]);
  expect(escalation.recovery[0]?.invariants).toEqual([
    { aggregate: ref("aggregate"), invariant: "version-nonnegative" },
  ]);
});

it("binds a pure hook input/result to explicit finite command writes with safe missing/invalid/timeout outcomes", () => {
  const d = fixture();
  addPure(d);
  expect(errors(d)).toEqual([]);
  expect(validateBackendBehavior(d)).toEqual([]);
  expect(validateBackendEffects(d).map((f) => f.code)).toEqual(["NEEDS_TEMPLATE"]);
  const h = need(model(d).hooks?.[0]);
  expect(h.unavailable).toEqual({ outcome: "unavailable", status: 503, writes: "none" });
  expect(h.result).toBe("validate-exact-contract-before-use");
  expect(save(fixture(), d).ok).toBe(true);
});

it("rejects external SQL atomicity, outbox callbacks, invalid guarantees, reversed order and effect cycles atomically", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      need(model(d).effects?.[0]).execution = "external";
    },
    (d) => {
      need(model(d).effects?.[0]).boundary = "after-commit";
    },
    (d) => {
      need(model(d).effects?.[0]).delivery.guarantee = "local-atomic";
    },
    (d) => {
      need(model(d).effects?.[0]).delivery.acknowledgement = "same-commit";
    },
    (d) => {
      need(model(d).effects?.[0]).loss = { kind: "permitted", reason: "best effort" };
    },
    (d) => {
      need(model(d).effects?.[0]).delivery.guarantee = "best-effort";
    },
    (d) => {
      need(model(d).effects?.[0]).after = [ref("outbox")];
    },
    (d) => {
      const e = need(model(d).effects?.[0]);
      const b = structuredClone(e);
      b.id = "second";
      e.after = [ref("second")];
      b.after = [ref("outbox")];
      model(d).effects?.push(b);
    },
    (d) => {
      const e = need(model(d).effects?.[0]);
      const b = effect(d, "external");
      e.after = [ref("external")];
      model(d).effects?.push(b);
      model(d).hooks = [hook(d, "effectful")];
    },
  ];
  for (const mutate of mutations) {
    const before = fixture();
    model(before).effects = [effect(before)];
    const d = structuredClone(before);
    mutate(d);
    expect(structuralEffects(d).length).toBeGreaterThan(0);
    expect(save(before, d).ok).toBe(false);
  }
});

it("rejects dangling exact effect/source/payload/dataset/query/hook/recovery identities and bad typed values", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      need(model(d).effects?.[0]).source.version = "v2";
    },
    (d) => {
      need(model(d).effects?.[0]).target = { kind: "operation", operation: ref("missing") };
    },
    (d) => {
      need(model(d).effects?.[0]).target = {
        kind: "dataset",
        dataset: "missing",
        contract: ref("effect-data"),
      };
    },
    (d) => {
      need(model(d).effects?.[0]).target = {
        kind: "projection",
        dataset: "records",
        query: ref("recipients", "v2"),
      };
    },
    (d) => {
      need(model(d).effects?.[0]).target = { kind: "hook", hook: ref("missing") };
    },
    (d) => {
      need(model(d).effects?.[0]).payload.version = "v2";
    },
    (d) => {
      need(need(model(d).effects?.[0]).values[0]).value = input("expected");
    },
    (d) => {
      need(model(d).effects?.[0]).values = [];
    },
    (d) => {
      need(need(model(d).effects?.[0]).recovery[0]).scenario.outcome = "missing";
    },
    (d) => {
      need(need(need(model(d).effects?.[0]).recovery[0]).invariants[0]).invariant = "missing";
    },
    (d) => {
      need(need(model(d).effects?.[0]).recovery[0]).outcome = "ok";
    },
    (d) => {
      need(need(model(d).effects?.[0]).recovery[0]).operation.version = "v2";
    },
    (d) => {
      need(model(d).effects?.[0]).after = [ref("missing")];
    },
  ];
  for (const mutate of mutations) {
    const d = fixture();
    model(d).effects = [effect(d)];
    mutate(d);
    expect(structuralEffects(d).length).toBeGreaterThan(0);
  }
});

it("rejects pure I/O, effectful in-transaction hooks, dependency cycles, forbidden outputs and untruthful outcomes", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      need(model(d).hooks?.[0]).repositories = [ref("record")];
    },
    (d) => {
      need(model(d).hooks?.[0]).services = [ref("post-delivery")];
    },
    (d) => {
      need(model(d).hooks?.[0]).kind = "effectful";
    },
    (d) => {
      need(model(d).hooks?.[0]).boundary = "after-commit";
    },
    (d) => {
      need(model(d).hooks?.[0]).contracts.output.version = "v2";
    },
    (d) => {
      need(model(d).hooks?.[0]).unavailable.outcome = "ok";
    },
    (d) => {
      need(model(d).hooks?.[0]).unavailable.status = 501;
    },
    (d) => {
      need(model(d).hooks?.[0]).failure.invalidResult = "ok";
    },
    (d) => {
      need(model(d).hooks?.[0]).failure.cancelled = "failed";
    },
    (d) => {
      need(model(d).hooks?.[0]).failure.scope = "separate-delivery-attempt";
    },
    (d) => {
      need(model(d).hooks?.[0]).dependencies = [ref("render-hook")];
    },
    (d) => {
      const h = need(model(d).hooks?.[0]);
      const second = structuredClone(h);
      second.id = "second-hook";
      second.seam.file = "src/hooks/second.ts";
      h.dependencies = [ref("second-hook")];
      second.dependencies = [ref("render-hook")];
      model(d).hooks?.push(second);
    },
    (d) => {
      need(model(d).hooks?.[0]).allowedWrites = [{ entity: ref("record"), field: "author" }];
    },
    (d) => {
      need(model(d).hooks?.[0]).allowedWrites = [];
    },
    (d) => {
      const a = need(operation(d).actions[0]);
      if (a.kind === "hook") a.input = [{ field: "body", value: input("expected") }];
    },
    (d) => {
      const a = need(operation(d).actions[0]);
      if (a.kind === "hook") a.input = [];
    },
  ];
  for (const mutate of mutations) {
    const before = fixture();
    addPure(before);
    const d = structuredClone(before);
    mutate(d);
    expect(errors(d).length).toBeGreaterThan(0);
    expect(save(before, d).ok).toBe(false);
  }
});

it("keeps absent recovery decisions saveable but source addressed, and requires exact optional-loss choices", () => {
  const d = fixture();
  model(d).effects = [effect(d)];
  need(model(d).effects?.[0]).recovery = [];
  expect(errors(d)).toEqual([]);
  expect(save(fixture(), d).ok).toBe(true);
  expect(
    reviewArchitecture(d).findings.some(
      (f) => f.code === "BACKEND_EFFECT_GAP" && f.message.includes("uncertain-commit"),
    ),
  ).toBe(true);
  const e = need(model(d).effects?.[0]);
  e.required = false;
  e.loss = { kind: "permitted", reason: "Disposable telemetry loss is accepted" };
  expect(structuralEffects(d)).toEqual([]);
  e.loss = { kind: "forbidden" };
  expect(structuralEffects(d).length).toBeGreaterThan(0);
});

it("models partial bytes and lost acknowledgement recovery without automatic compensation or invented success", () => {
  const d = fixture();
  const e = effect(d);
  e.recovery.push(recovery(d, "partial-bytes"));
  model(d).effects = [e];
  expect(structuralEffects(d)).toEqual([]);
  const partial = need(e.recovery.find((r) => r.trigger === "partial-bytes"));
  partial.strategy = "same-command-key";
  expect(structuralEffects(d).length).toBeGreaterThan(0);
});

it("protects referenced hook semantics and all signature/event contracts even through consumer removal", () => {
  const d = fixture();
  addPure(d);
  model(d).effects = [effect(d)];
  for (const mutate of [
    (n: DesignDocument) => {
      model(n).hooks = [];
      operation(n).actions.shift();
    },
    (n: DesignDocument) => {
      need(model(n).hooks?.[0]).timeoutSeconds = 999;
    },
    (n: DesignDocument) => {
      need(n.architecture).contracts = n.architecture?.contracts?.filter(
        (c) => c.id !== "hook-error",
      );
      model(n).hooks = [];
      operation(n).actions.shift();
    },
    (n: DesignDocument) => {
      const c = need(n.architecture?.contracts?.find((c) => c.id === "domain-event"));
      need(c.shape?.payload[0]).maxLength = 12;
      model(n).effects = [];
    },
  ]) {
    const n = structuredClone(d);
    mutate(n);
    expect(save(d, n).ok).toBe(false);
  }
  const renamed = structuredClone(d);
  need(model(renamed).hooks?.[0]).name = "Presentation only";
  expect(validateBackendEffectsTransition(d, renamed)).toEqual([]);
  expect(save(d, renamed).ok).toBe(true);
  const successor = structuredClone(d);
  const h = structuredClone(need(model(successor).hooks?.[0]));
  h.version = "v2";
  h.seam.file = "src/hooks/pure-v2.ts";
  h.timeoutSeconds = 10;
  model(successor).hooks?.push(h);
  const a = need(operation(successor).actions[0]);
  if (a.kind === "hook") a.hook.version = "v2";
  expect(save(d, successor).ok).toBe(true);
});

it("requires matching exact C2 bindings for cross-container delivery and preserves them through copy/reuse", () => {
  const d = fixture(),
    a = need(d.architecture),
    m = model(d);
  const ids = Object.fromEntries(
    [
      "record",
      "aggregate",
      "records",
      "policy",
      "service-policy",
      "lifecycle",
      "post-command",
      "post-delivery",
      "recipients",
      "module",
    ].map((id) => [id, `worker-${id}`]),
  );
  const workerModel = mapBackendModel(m, ids);
  need(workerModel.entities[0]).storageId = "worker-record-table";
  const sourcePolicy = need(
    workerModel.accessPolicies?.find((p) => p.id === "worker-service-policy"),
  );
  const workerOp = need(workerModel.operations?.[1]);
  workerModel.operations = [workerOp];
  workerOp.access.policy = { kind: "policy", reference: ref(sourcePolicy.id) };
  m.entities.push(...workerModel.entities);
  m.aggregates.push(...workerModel.aggregates);
  m.accessPolicies?.push(...(workerModel.accessPolicies ?? []));
  m.lifecycles?.push(...(workerModel.lifecycles ?? []));
  m.operations?.push(workerOp);
  const dataset = structuredClone(need(a.datasets?.[0]));
  dataset.id = "worker-records";
  dataset.owners = [{ kind: "element", id: "worker" }];
  a.datasets?.push(dataset);
  d.elements.push({
    ...structuredClone(need(d.elements[0])),
    id: "worker",
    name: "Worker",
    planned: "background-worker",
  });
  a.components?.push({
    ...structuredClone(need(a.components[0])),
    id: "worker-module",
    element: "worker",
  });
  a.interfaces?.push(
    {
      ...structuredClone(need(a.interfaces?.[0])),
      id: "worker-provided",
      owner: { kind: "component", id: "worker-module" },
    },
    { ...structuredClone(need(a.interfaces?.[0])), id: "worker-required", direction: "required" },
  );
  d.connections.push({
    id: "api-worker",
    kind: "depends-on",
    from: { element: "api" },
    to: { element: "worker" },
    planned: {
      label: "Dispatches bounded work",
      protocol: "HTTPS",
      interaction: "Request / response",
      security: "Service identity",
    },
  });
  a.bindings = [
    {
      id: "delivery-binding",
      name: "Worker delivery",
      relationship: { kind: "connection", id: "api-worker" },
      provided: "worker-provided",
      required: "worker-required",
      contract: ref("commands"),
      operation: "deliver",
      role: "request",
      businessSynchrony: "Asynchronous",
    },
  ];
  const pc = {
    id: "delivery-input",
    version: "v1",
    name: "Delivery input",
    kind: "data" as const,
    description: "",
    coverage: "Complete" as const,
    shape: { payload: structuredClone(wire(d).input), operations: [] },
  };
  a.contracts?.push(pc);
  const e = effect(d);
  e.target = { kind: "operation", operation: ref(workerOp.id) };
  e.payload = ref("delivery-input");
  e.values = wire(d).input.map((f) => ({ field: f.id, value: input(f.id) }));
  m.effects = [e];
  expect(structuralEffects(d).some((f) => f.message.includes("Cross-container"))).toBe(true);
  e.relationshipBinding = "delivery-binding";
  expect(errors(d)).toEqual([]);
  expect(validateBackendEffects(d)).toEqual([]);
  e.relationshipBinding = "missing";
  expect(structuralEffects(d).length).toBeGreaterThan(0);
  e.relationshipBinding = "delivery-binding";
  const { fragment, metadata } = extractArchitectureTemplate(
    d,
    { elements: ["api", "store", "worker"] },
    { id: "delivery", version: "1.0.0", name: "Delivery", purpose: "Exact C2 delivery references" },
    testLookup,
  );
  const mapped = mappedArchitecture(
    fragment,
    Object.fromEntries(fragmentIds(fragment).map((id) => [id, `copy-${id}`])),
  );
  expect(mapped.backend?.effects?.[0]?.relationshipBinding).toBe(
    `copy-${fragment.architecture.backend?.effects?.[0]?.relationshipBinding}`,
  );
  const entry: ArchitectureLibraryEntry = {
    id: fragment.id,
    version: fragment.version,
    fragment,
    metadata,
    state: "published",
    draftRevision: 1,
    contentHash: "e".repeat(64),
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
  const copied = applyOperations(empty, preview.ops, testLookup);
  expect(copied.ok).toBe(true);
  if (!copied.ok) return;
  const pinned = need(copied.design.architecture?.patternInstances?.[0]);
  const reuse = previewArchitectureTemplate(
    copied.design,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "reuse",
      name: "Reuse",
      baseRevision: copied.design.revision,
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
  const reused = applyOperations(copied.design, reuse.ops, testLookup);
  expect(reused.ok).toBe(true);
  if (reused.ok) {
    expect(model(reused.design)).toEqual(model(copied.design));
    expect(reused.design.connections).toEqual(copied.design.connections);
    expect(reused.design.architecture?.componentRelationships).toEqual(
      copied.design.architecture?.componentRelationships,
    );
    expect(reused.design.architecture?.bindings).toEqual(copied.design.architecture?.bindings);
    expect(reused.design.architecture?.scenarios).toEqual(copied.design.architecture?.scenarios);
  }
});

it("preserves exact hook/effect recovery references through atomic saves, extraction, pinned reuse, target copy and handoff", async () => {
  const source = fixture();
  addPure(source);
  addAudit(source);
  const outbox = effect(source);
  outbox.after = [ref("audit")];
  outbox.values = [{ field: "body", value: current("body") }];
  model(source).effects?.push(outbox);
  expect(errors(source)).toEqual([]);
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api", "store"] },
    { id: "effects", version: "1.0.0", name: "Effects", purpose: "Portable safe extension seams" },
    testLookup,
  );
  expect(fragment.architecture.backend?.hooks).toHaveLength(1);
  expect(fragment.architecture.backend?.effects).toHaveLength(2);
  expect(fragment.architecture.scenarios).toHaveLength(1);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `copy-${id}`]));
  for (const local of ["body", "safe", "failed", "version-nonnegative", "render", "D16-rendering"])
    ids[local] = `wrong-${local}`;
  const mapped = need(mappedArchitecture(fragment, ids).backend),
    h = need(mapped.hooks?.[0]),
    e = need(mapped.effects?.[1]);
  const localHook = need(fragment.architecture.backend?.hooks?.[0]),
    localEffect = need(fragment.architecture.backend?.effects?.[1]);
  expect(h.operation.id).toBe(`copy-${localHook.operation.id}`);
  expect(h.contracts.error.id).toBe(`copy-${localHook.contracts.error.id}`);
  expect(h.allowedWrites[0]).toEqual({
    entity: ref(`copy-${need(localHook.allowedWrites[0]).entity.id}`),
    field: "body",
  });
  expect(h.seam.file).toBe("src/hooks/pure.ts");
  expect(h.acceptance).toEqual(["D16-rendering", "D16-unavailable"]);
  expect(e.recovery[0]).toMatchObject({
    operation: ref(`copy-${localEffect.source.id}`),
    outcome: "uncertain",
    scenario: { id: `copy-${need(localEffect.recovery[0]).scenario.id}`, outcome: "safe" },
    invariants: [
      {
        aggregate: ref(`copy-${need(need(localEffect.recovery[0]).invariants[0]).aggregate.id}`),
        invariant: "version-nonnegative",
      },
    ],
  });
  expect(e.after).toEqual(localEffect.after.map((r) => ref(`copy-${r.id}`)));
  expect(e.values[0]?.value).toEqual({
    kind: "current",
    entity: ref(`copy-${need(localHook.allowedWrites[0]).entity.id}`),
    field: "body",
  });
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
  const copied = applyOperations(empty, preview.ops, testLookup);
  expect(copied.ok).toBe(true);
  if (!copied.ok) return;
  expect(errors(copied.design)).toEqual([]);
  expect(validateBackendEffects(copied.design).filter((f) => f.code !== "NEEDS_TEMPLATE")).toEqual(
    [],
  );
  const pinned = need(copied.design.architecture?.patternInstances?.[0]);
  const reuse = previewArchitectureTemplate(
    copied.design,
    entry,
    {
      id: entry.id,
      version: entry.version,
      contentHash: entry.contentHash,
      instanceId: "reuse",
      name: "Reuse",
      baseRevision: copied.design.revision,
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
  const reused = applyOperations(copied.design, reuse.ops, testLookup);
  expect(reused.ok).toBe(true);
  if (reused.ok) {
    expect(model(reused.design)).toEqual(model(copied.design));
    expect(reused.design.connections).toEqual(copied.design.connections);
    expect(reused.design.architecture?.componentRelationships).toEqual(
      copied.design.architecture?.componentRelationships,
    );
    expect(reused.design.architecture?.bindings).toEqual(copied.design.architecture?.bindings);
    expect(reused.design.architecture?.scenarios).toEqual(copied.design.architecture?.scenarios);
  }
  const args = {
    design: copied.design,
    project: { id: "effects", name: "Effects" },
    lookup: testLookup,
  };
  const handoff = await buildArchitectureHandoff(args);
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(model(copied.design));
  expect(handoffJson(await buildArchitectureHandoff(args))).toBe(handoffJson(handoff));
  expect(handoffMarkdown(handoff)).toContain("- Effect ");
  expect(handoffMarkdown(handoff)).toContain("- Hook ");
  const changed = structuredClone(copied.design);
  need(model(changed).effects?.[0]).delivery.timeoutSeconds = 15;
  expect(
    targetChanges(copied.design, changed).some((c) =>
      c.path.startsWith("architecture/backend/effects/"),
    ),
  ).toBe(true);
  expect(await handoffFingerprint(changed, args.project)).not.toBe(
    await handoffFingerprint(copied.design, args.project),
  );
  const removed = structuredClone(copied.design);
  need(removed.architecture).scenarios = [];
  expect(
    backendDataRemovalFindings(removed).some(
      (f) => isStructural(f) && f.message.includes("scenario"),
    ),
  ).toBe(true);
  const schema = JSON.stringify(operationBatchJsonSchema());
  for (const value of [
    "atomic-intent",
    "validated-proposals-only",
    "reconcile-before-retry",
    "scaffold-once-project-owned",
  ])
    expect(schema).toContain(value);
  expect(designSchema.parse(JSON.parse(JSON.stringify(copied.design)))).toEqual(copied.design);
  expect(blocksGenerate(validateDesign(source, testLookup))).toBe(true);
  expect(contractKey(h)).toBe(`copy-${localHook.id}@v1`);
});

it("rejects executable/opaque schemas, unsafe hook paths and unbounded collections while preserving old JSON", () => {
  const d = fixture();
  const e = effect(d),
    h = hook(d);
  for (const value of [
    { ...e, sql: "insert into hidden" },
    { ...e, delivery: { ...e.delivery, attempts: 0 } },
    { ...e, after: Array(21).fill(ref("outbox")) },
  ])
    expect(backendEffectSchema.safeParse(value).success).toBe(false);
  for (const value of [
    { ...h, config: "{}" },
    { ...h, timeoutSeconds: 0 },
    { ...h, seam: { ...h.seam, file: "../../secrets.ts" } },
    { ...h, result: "trust-the-returned-value" },
    { ...h, unavailable: { ...h.unavailable, status: 200 } },
  ])
    expect(backendHookSchema.safeParse(value).success).toBe(false);
  expect(
    backendActionSchema.safeParse({
      id: "hook",
      kind: "hook",
      hook: ref("render-hook"),
      input: [],
      code: "eval",
    }).success,
  ).toBe(false);
  expect(backendModelSchema.safeParse({ ...model(d), effects: Array(101).fill(e) }).success).toBe(
    false,
  );
  const legacy = JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/architecture-scenarios.json", import.meta.url),
      "utf8",
    ),
  );
  const parsed = designSchema.parse(legacy);
  expect(parsed.architecture).not.toHaveProperty("backend");
  const old = backendModelSchema.parse({ schemaVersion: 1, entities: [], aggregates: [] });
  expect(old).toEqual({ schemaVersion: 1, entities: [], aggregates: [] });
  expect(mapBackendModel(old, {})).toEqual(old);
});

it("represents input/result field shapes and exact acceptance references for all 24 frozen H seams", () => {
  // Test-only field-shape projection; wire regex constraints stay in the frozen acceptance contracts.
  // This is no production schema importer or claim that these H features are implemented.
  type Shape = {
    type?: string;
    format?: string;
    const?: string;
    enum?: string[];
    properties?: Record<string, Shape>;
    required?: readonly string[];
    items?: Shape;
    anyOf?: Shape[];
    oneOf?: Shape[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
  };
  const fieldId = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const value = (s: Shape): ContractValue => {
    if (s.anyOf) {
      const n = need(s.anyOf.find((s) => s.type !== "null"));
      expect(s.anyOf.some((s) => s.type === "null")).toBe(true);
      return { ...value(n), nullable: true };
    }
    if (s.oneOf)
      return { type: "tagged-union", discriminator: "kind", variants: s.oneOf.map(value) };
    const scalar = {
      minimum: s.minimum,
      maximum: s.maximum,
      minLength: s.minLength,
      maxLength: s.maxLength,
      minItems: s.minItems,
      maxItems: s.maxItems,
    };
    if (s.type === "object") return { type: "object", fields: fields(s) };
    if (s.type === "array") return { type: "array", ...scalar, items: value(need(s.items)) };
    if (s.type === "string")
      return {
        type: s.format === "uuid" ? "uuid" : s.format === "date-time" ? "timestamp" : "text",
        ...scalar,
        ...(s.const !== undefined
          ? { enumValues: [s.const] }
          : s.enum
            ? { enumValues: s.enum }
            : {}),
      };
    if (s.type === "boolean" || s.type === "integer" || s.type === "number")
      return { type: s.type, ...scalar };
    throw new Error(`Unsupported frozen fixture type ${s.type}`);
  };
  const fields = (s: Shape): ContractField[] =>
    Object.entries(s.properties ?? {}).map(([name, schema]) => ({
      ...value(schema),
      id: fieldId(name),
      name,
      description: "",
      required: s.required?.includes(name) ?? false,
    }));
  let count = 0;
  const packs = [
    ["discourse-core", discourseHookSchemas()],
    ["vendure-core", vendureHookSchemas()],
    ["zammad-core", zammadHookSchemas()],
  ] as const;
  for (const [profile, signatures] of packs) {
    const sourceMap = JSON.parse(
      readFileSync(
        new URL(`../../../benchmarks/${profile}/v1/source-map.json`, import.meta.url),
        "utf8",
      ),
    ) as {
      rows: {
        targetOrigin: string;
        caseId: string;
        primary: { id: string };
        requiredObservationIds: string[];
      }[];
    };
    const d = fixture(),
      a = need(d.architecture);
    model(d).hooks = [];
    for (const row of sourceMap.rows.filter((row) => row.targetOrigin === "H")) {
      const signature = need(
        (signatures as unknown as Record<string, { input: Shape; result: Shape }>)[row.primary.id],
      );
      const prefix = row.caseId.toLowerCase();
      for (const [part, shape] of [
        ["input", signature.input],
        ["output", signature.result],
        [
          "error",
          {
            type: "object",
            properties: { message: { type: "string", maxLength: 200 } },
            required: ["message"],
          },
        ],
      ] as const) {
        a.contracts?.push(
          architectureContractSchema.parse({
            id: `${prefix}-${part}`,
            version: "v1",
            name: `${row.caseId} ${part}`,
            kind: "data",
            coverage: "Complete",
            shape: { payload: fields(shape), operations: [] },
          }),
        );
      }
      const h = hook(d);
      h.id = `${prefix}-hook`;
      h.allowedWrites = [];
      h.contracts = {
        input: ref(`${prefix}-input`),
        output: ref(`${prefix}-output`),
        error: ref(`${prefix}-error`),
      };
      h.acceptance = row.requiredObservationIds;
      h.seam.file = `src/hooks/${prefix}.ts`;
      model(d).hooks?.push(h);
      count++;
    }
    expect(structuralEffects(d)).toEqual([]);
    expect(validateDesign(d, testLookup).filter(isStructural)).toEqual([]);
    expect(model(d).hooks).toHaveLength(8);
  }
  expect(count).toBe(24);
  expect(JSON.stringify(z.toJSONSchema(backendHookSchema))).toContain("contracts");
});

it("rejects mixed hook/effect recursion, undeclared dependency order and missing background authority", () => {
  const d = fixture(),
    m = model(d);
  m.hooks = [hook(d, "effectful")];
  m.effects = [effect(d, "external")];
  const second = structuredClone(need(m.hooks[0]));
  second.id = "second-provider";
  second.seam.file = "src/hooks/second-provider.ts";
  const secondEffect = structuredClone(need(m.effects[0]));
  secondEffect.id = "second-dispatch";
  secondEffect.target = { kind: "hook", hook: ref(second.id) };
  need(m.hooks[0]).allowedEffects = [ref(secondEffect.id)];
  second.allowedEffects = [ref("external")];
  m.hooks.push(second);
  m.effects.push(secondEffect);
  expect(structuralEffects(d).some((f) => f.message.includes("cycle"))).toBe(true);
  second.allowedEffects = [];
  need(m.hooks[0]).allowedEffects = [];
  second.dependencies = [ref("provider-hook")];
  expect(structuralEffects(d).some((f) => f.message.includes("ordering"))).toBe(true);
  secondEffect.after = [ref("external")];
  expect(structuralEffects(d)).toEqual([]);
  const wrong = structuredClone(d);
  need(model(wrong).hooks?.[0]).failure.operation = ref(operation(wrong).id);
  expect(structuralEffects(wrong).length).toBeGreaterThan(0);
  const current = fixture();
  const e = effect(current);
  e.target = { kind: "operation", operation: ref(operation(current).id) };
  e.payload = ref("hook-input");
  model(current).effects = [e];
  expect(structuralEffects(current).some((f) => f.message.includes("cycle"))).toBe(true);
  expect(
    validateBackendEffects(current).some(
      (f) => f.code === "CONFIG_REQUIRED" && f.message.includes("service"),
    ),
  ).toBe(true);
});

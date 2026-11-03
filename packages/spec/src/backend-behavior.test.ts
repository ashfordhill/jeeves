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
  backendActionSchema,
  backendLifecycleSchema,
  backendOperationSchema,
} from "./backend-behavior-model.ts";
import { backendDataRemovalFindings } from "./backend-data.ts";
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
const lifecycle = (d: DesignDocument) => need(model(d).lifecycles?.[0]);
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

/** Synthetic descriptors only: no benchmark apps, runtime or evidence is manufactured. */
function fixture(domain: "post" | "order" | "ticket" = "post"): DesignDocument {
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

it("expresses post edit/close, checkout/order and ticket assign/resolve with exact success/conflict outcomes", () => {
  for (const domain of ["post", "order", "ticket"] as const) {
    const d = fixture(domain);
    expect(errors(d)).toEqual([]);
    expect(validateBackendBehavior(d)).toEqual([]);
    expect(operation(d).idempotency).toMatchObject({
      retentionSeconds: 604800,
      identity: "operation-version-scope-principal-key",
      receipt: "terminal-result-in-same-transaction",
    });
    if (domain === "order")
      operation(d).actions.unshift({
        id: "checkout",
        kind: "capability",
        strategy: {
          kind: "registered",
          name: "checkout-order",
          version: "v1",
          options: { maximumLines: 100 },
          result: ref("strategy-result"),
        },
        input: [{ field: "cart-id", value: input("cart-id") }],
      });
    const nextName = domain === "post" ? "close" : domain === "order" ? "pay" : "resolve";
    const followup = structuredClone(operation(d));
    followup.id = `${domain}-${nextName}`;
    followup.name = nextName;
    followup.target.operation = nextName;
    followup.access.action = nextName;
    const nextWire = { ...structuredClone(wire(d)), id: nextName, name: nextName };
    need(d.architecture?.contracts?.find((c) => c.id === "commands")?.shape).operations.push(
      nextWire,
    );
    followup.guards = [
      {
        id: "current-state",
        kind: "compare",
        left: current("state"),
        operator: "eq",
        right: literal(domain === "post" ? "open" : domain === "order" ? "submitted" : "assigned"),
      },
    ];
    followup.actions = [
      {
        id: "move",
        kind: "transition",
        lifecycle: ref("lifecycle"),
        transition:
          domain === "post" ? "to-closed" : domain === "order" ? "to-paid" : "to-resolved",
      },
      {
        id: "cas",
        kind: "patch",
        entity: ref("record"),
        values: [{ field: "version", value: { kind: "server", factory: "next-version" } }],
      },
    ];
    followup.writes = [
      { entity: ref("record"), field: "state" },
      { entity: ref("record"), field: "version" },
    ];
    model(d).operations?.push(followup);
    expect(validateBackendBehavior(d)).toEqual([]);
    expect(errors(d)).toEqual([]);
    expect(model(d).operations).toHaveLength(2);
    expect(blocksGenerate(validateDesign(d, testLookup))).toBe(true);
  }
});

it("rejects nonexistent/unreachable/duplicate transitions, enum disagreement and wrong guard types", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      need(lifecycle(d).transitions[0]).to = "invented";
    },
    (d) => {
      lifecycle(d).initial = "closed";
    },
    (d) => {
      lifecycle(d).transitions.push(need(lifecycle(d).transitions[0]));
    },
    (d) => {
      lifecycle(d).states.push("extra");
    },
    (d) => {
      need(lifecycle(d).transitions[0]).guards = ["missing"];
    },
    (d) => {
      operation(d).guards = [
        {
          id: "wrong",
          kind: "compare",
          left: current("state"),
          operator: "gte",
          right: literal(3),
        },
      ];
    },
    (d) => {
      lifecycle(d).guards = [{ id: "wrong", kind: "present", value: input("body") }];
    },
    (d) => {
      operation(d).guards = [
        {
          id: "wrong",
          kind: "present",
          value: { kind: "result", action: "patch", path: ["body"] },
        },
      ];
    },
    (d) => {
      lifecycle(d).state.field = "body";
    },
  ];
  for (const mutate of mutations) {
    const d = fixture();
    mutate(d);
    expect(validateBackendBehavior(d).filter(isStructural).length).toBeGreaterThan(0);
  }
});

it("rejects duplicate writers, undeclared fields, state bypass and server-authority injection atomically", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      operation(d).actions.push({ ...need(operation(d).actions[0]), id: "duplicate" });
    },
    (d) => {
      operation(d).writes = [];
    },
    (d) => {
      const a = need(operation(d).actions[0]);
      if ("values" in a) a.values.push({ field: "author", value: input("assignee") });
      operation(d).writes.push({ entity: ref("record"), field: "author" });
    },
    (d) => {
      const a = need(operation(d).actions[0]);
      if ("values" in a) a.values.push({ field: "state", value: literal("closed") });
      operation(d).writes.push({ entity: ref("record"), field: "state" });
    },
    (d) => {
      operation(d).writes.push({ entity: ref("record"), field: "missing" });
    },
    (d) => {
      operation(d).kind = "query";
    },
    (d) => {
      operation(d).transaction.store = "other-store";
    },
    (d) => {
      operation(d).transaction.participants = [];
    },
    (d) => {
      operation(d).expectedVersion = { kind: "none" };
    },
    (d) => {
      operation(d).expectedVersion = { kind: "input", path: ["body"] };
    },
    (d) => {
      const a = need(operation(d).actions[0]);
      if ("values" in a) need(a.values[1]).value = input("expected");
    },
    (d) => {
      operation(d).target.owner.id = "api";
    },
    (d) => {
      operation(d).target.operation = "missing";
    },
    (d) => {
      operation(d).actions.push({
        id: "bad",
        kind: "transition",
        lifecycle: ref("lifecycle", "v2"),
        transition: "to-closed",
      });
    },
  ];
  for (const mutate of mutations) {
    const before = fixture(),
      d = structuredClone(before);
    mutate(d);
    expect(save(before, d).ok).toBe(false);
    expect(before).toEqual(fixture());
  }
});

it("requires complete hash inputs, scoped receipts, replay policy and truthful conflict/unknown/cancellation outcomes", () => {
  const mutations: ((d: DesignDocument) => void)[] = [
    (d) => {
      const i = operation(d).idempotency;
      if (i.kind === "command-key") i.hashInputs = [["body"]];
    },
    (d) => {
      const i = operation(d).idempotency;
      if (i.kind === "command-key") i.hashInputs.push(["body"]);
    },
    (d) => {
      const i = operation(d).idempotency;
      if (i.kind === "command-key") i.key = ["expected"];
    },
    (d) => {
      need(wire(d).outcomes?.find((o) => o.id === "uncertain")).state = "Unchanged";
    },
    (d) => {
      need(wire(d).outcomes?.find((o) => o.id === "uncertain")).retry = "Safe";
    },
    (d) => {
      need(wire(d).outcomes?.find((o) => o.id === "conflict")).state = "Committed";
    },
    (d) => {
      need(wire(d).outcomes?.find((o) => o.id === "cancelled")).state = "Committed";
    },
    (d) => {
      need(model(d).accessPolicies?.[0]).revocation.recheck = ["write", "read"];
    },
    (d) => {
      operation(d).outcomes = operation(d).outcomes.filter((o) => o.trigger !== "unavailable");
    },
  ];
  for (const mutate of mutations) {
    const d = fixture();
    mutate(d);
    expect(validateBackendBehavior(d).length).toBeGreaterThan(0);
  }
  const d = fixture();
  operation(d).outcomes = operation(d).outcomes.filter((o) => o.trigger !== "conflict");
  expect(errors(d)).toEqual([]);
  expect(save(fixture(), d).ok).toBe(true);
  expect(
    reviewArchitecture(d).findings.some(
      (f) => f.code === "BACKEND_BEHAVIOR_GAP" && f.message.includes("conflict"),
    ),
  ).toBe(true);
});

it("represents safe create factories, result mappings and insert-only child/revision actions", () => {
  const d = fixture();
  const op = operation(d);
  op.identity = [];
  op.guards = [];
  op.actions = [
    {
      id: "new",
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
  const create = need(op.actions[0]);
  op.writes =
    create.kind === "create"
      ? create.values.map((v) => ({ entity: ref("record"), field: v.field }))
      : [];
  need(op.outcomes[0]).values = [
    { field: "body", value: { kind: "result", action: "new", path: ["body"] } },
  ];
  expect(validateBackendBehavior(d)).toEqual([]);
  for (const kind of ["create-child", "append-revision"] as const) {
    const childDesign = structuredClone(d),
      childModel = model(childDesign),
      childCommand = operation(childDesign);
    const child = structuredClone(need(childModel.entities[0]));
    child.id = "child";
    child.dataset = "child-data";
    child.storageId = "child-table";
    child.relations = [
      {
        id: "parent",
        target: ref("record"),
        fields: [
          { source: "scope", target: "scope" },
          { source: "assignee", target: "id" },
        ],
        ownership: "owned",
        cardinality: "many-to-one",
        scope: "same-scope",
        onDelete: "cascade",
      },
    ];
    childModel.entities.push(child);
    const dataset = structuredClone(need(childDesign.architecture?.datasets?.[0]));
    dataset.id = "child-data";
    need(childDesign.architecture).datasets?.push(dataset);
    need(childModel.aggregates[0]).children.push(ref("child"));
    childCommand.transaction.participants.push(ref("child"));
    if (create.kind !== "create") throw new Error("fixture");
    childCommand.actions.push({
      ...structuredClone(create),
      id: "child-insert",
      kind,
      entity: ref("child"),
      values: create.values.map((v) =>
        v.field === "assignee"
          ? { ...v, value: { kind: "result", action: "new", path: ["id"] } }
          : v,
      ),
    });
    childCommand.writes.push(
      ...create.values.map((v) => ({ entity: ref("child"), field: v.field })),
    );
    expect(
      validateBackendBehavior(childDesign).some((f) => f.message.includes("child policy")),
    ).toBe(true);
    const childPolicy = structuredClone(need(childModel.accessPolicies?.[0]));
    childPolicy.id = "child-policy";
    childPolicy.resource = ref("child");
    childModel.accessPolicies?.push(childPolicy);
    childCommand.access.participants = [
      {
        entity: ref("child"),
        policy: { kind: "policy", reference: ref("child-policy") },
        action: childCommand.access.action,
        readProjection: "read",
        writeProjection: "write",
      },
    ];
    expect(errors(childDesign)).toEqual([]);
    expect(validateBackendBehavior(childDesign)).toEqual([]);
    const mapped = mapBackendModel(childModel, {
      child: "copy-child",
      "child-policy": "copy-policy",
    });
    expect(need(mapped.operations?.[0]).access.participants?.[0]).toMatchObject({
      entity: ref("copy-child"),
      policy: { reference: ref("copy-policy") },
    });
  }
  expect(
    backendActionSchema.safeParse({ id: "loop", kind: "for-each", code: "eval(input)" }).success,
  ).toBe(false);
});

it("keeps unsupported strategies explicit and validates registered capability schema/result/order", () => {
  const d = fixture("order"),
    op = operation(d);
  op.actions.unshift({
    id: "quote",
    kind: "capability",
    strategy: {
      kind: "unsupported",
      reference: ref("custom-price"),
      result: ref("strategy-result"),
    },
    input: [],
  });
  expect(errors(d)).toEqual([]);
  expect(validateBackendBehavior(d)).toContainEqual(
    expect.objectContaining({
      code: "NEEDS_TEMPLATE",
      message: expect.stringContaining("not an implicit hook"),
    }),
  );
  const unknown = need(op.actions[0]);
  expect(backendActionSchema.safeParse({ ...unknown, script: "return true" }).success).toBe(false);
  op.actions[0] = {
    id: "quote",
    kind: "capability",
    strategy: {
      kind: "registered",
      name: "checkout-order",
      version: "v1",
      options: { maximumLines: 100 },
      result: ref("strategy-result"),
    },
    input: [{ field: "cart-id", value: input("cart-id") }],
  };
  expect(validateBackendBehavior(d)).toEqual([]);
  const valid = need(op.actions[0]);
  expect(
    backendActionSchema.safeParse({
      ...valid,
      strategy: {
        kind: "registered",
        name: "arbitrary",
        version: "v1",
        options: {},
        result: ref("strategy-result"),
      },
    }).success,
  ).toBe(false);
  const patch = op.actions.find((a) => a.kind === "patch");
  if (patch?.kind !== "patch") throw new Error("fixture");
  patch.values[1] = {
    field: "body",
    value: { kind: "result", action: "quote", path: ["order-id"] },
  };
  expect(validateBackendBehavior(d).some((f) => f.code === "CONFIG_INVALID")).toBe(true);
  op.actions.reverse();
  expect(validateBackendBehavior(d).some((f) => f.code === "UNKNOWN_REFERENCE")).toBe(true);
});

it("rejects executable strings, permissive transaction choices and unbounded collections at schema boundary", () => {
  const op = operation(fixture());
  for (const candidate of [
    { ...op, code: "SQL" },
    { ...op, transaction: { ...op.transaction, externalIO: "http" } },
    { ...op, transaction: { ...op.transaction, connection: "multiple" } },
    { ...op, cancellation: { ...op.cancellation, beforeCommit: "continue" } },
    { ...op, idempotency: { ...op.idempotency, identity: "key-only" } },
    { ...op, actions: Array.from({ length: 21 }, () => op.actions[0]) },
    { ...op, guards: Array.from({ length: 21 }, () => op.guards[0]) },
    { ...op, idempotency: { ...op.idempotency, retentionSeconds: 0 } },
  ])
    expect(backendOperationSchema.safeParse(candidate).success).toBe(false);
  expect(
    backendLifecycleSchema.safeParse({
      ...lifecycle(fixture()),
      transitions: Array.from({ length: 31 }, () => lifecycle(fixture()).transitions[0]),
    }).success,
  ).toBe(false);
  expect(
    backendModelSchema.safeParse({
      ...model(fixture()),
      operations: Array.from({ length: 201 }, () => op),
    }).success,
  ).toBe(false);
});

it("protects exact lifecycle, policy and operation contracts through simultaneous consumer removal", () => {
  const before = fixture("ticket");
  const changed = structuredClone(before);
  lifecycle(changed).transitions = [];
  model(changed).operations = [];
  expect(save(before, changed).ok).toBe(false);
  const policy = structuredClone(before);
  need(model(policy).accessPolicies?.[0]).rules = [];
  model(policy).operations = [];
  expect(save(before, policy).ok).toBe(false);
  const contract = structuredClone(before);
  need(contract.architecture).interfaces = [];
  model(contract).operations = [];
  need(contract.architecture).contracts = contract.architecture?.contracts?.filter(
    (c) => c.id !== "commands",
  );
  expect(save(before, contract).ok).toBe(false);
  const result = structuredClone(fixture("order"));
  operation(result).actions.unshift({
    id: "checkout",
    kind: "capability",
    strategy: { kind: "unsupported", reference: ref("pricing"), result: ref("strategy-result") },
    input: [],
  });
  const removed = structuredClone(result);
  model(removed).operations = [];
  need(removed.architecture).contracts = removed.architecture?.contracts?.filter(
    (c) => c.id !== "strategy-result",
  );
  expect(save(result, removed).ok).toBe(false);
  const renamed = structuredClone(before);
  lifecycle(renamed).name = "Renamed";
  expect(save(before, renamed).ok).toBe(true);
  const successor = structuredClone(before);
  model(successor).lifecycles?.push({ ...structuredClone(lifecycle(before)), version: "v2" });
  expect(save(before, successor).ok).toBe(true);
  const removedState = structuredClone(before);
  model(removedState).lifecycles = [];
  expect(backendDataRemovalFindings(removedState).filter(isStructural).length).toBeGreaterThan(0);
});

it("preserves command semantics through save/copy/remapping/reuse/diffs/handoff and chat schemas", async () => {
  const source = fixture("ticket");
  const { fragment, metadata } = extractArchitectureTemplate(
    source,
    { elements: ["api", "store"] },
    { id: "commands", version: "1.0.0", name: "Commands", purpose: "Portable finite intent" },
    testLookup,
  );
  expect(fragment.architecture.backend?.operations).toHaveLength(1);
  expect(fragment.architecture.backend?.lifecycles).toHaveLength(1);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `copy-${id}`]));
  for (const id of ["state", "version", "assign", "patch", "to-assigned", "expected", "key"])
    ids[id] = `wrong-${id}`;
  const mapped = need(mappedArchitecture(fragment, ids).backend),
    o = need(mapped.operations?.[0]);
  expect(o.target.operation).toBe("assign");
  expect(o.expectedVersion).toEqual({ kind: "input", path: ["expected"] });
  expect(o.idempotency).toEqual(operation(source).idempotency);
  expect(o.writes.map((w) => w.field)).toEqual(operation(source).writes.map((w) => w.field));
  expect(o.target.owner.id).toMatch(/^copy-/);
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
  expect(validateBackendBehavior(copied.design)).toEqual([]);
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
  if (reused.ok) expect(model(reused.design)).toEqual(model(copied.design));
  const args = {
    design: copied.design,
    project: { id: "commands", name: "Commands" },
    lookup: testLookup,
  };
  const handoff = await buildArchitectureHandoff(args);
  expect(JSON.parse(handoffJson(handoff)).intent.backend).toEqual(model(copied.design));
  expect(handoffJson(await buildArchitectureHandoff(args))).toBe(handoffJson(handoff));
  expect(handoffMarkdown(handoff)).toContain("- Lifecycle ");
  expect(handoffMarkdown(handoff)).toContain("- Operation behavior ");
  const changed = structuredClone(copied.design);
  operation(changed).cancellation.deadlineSeconds = 20;
  expect(
    targetChanges(copied.design, changed).some((c) =>
      c.path.startsWith("architecture/backend/operations/"),
    ),
  ).toBe(true);
  expect(await handoffFingerprint(changed, args.project)).not.toBe(
    await handoffFingerprint(copied.design, args.project),
  );
  const schema = JSON.stringify(operationBatchJsonSchema());
  for (const word of [
    "hashInputs",
    "disconnect-is-unknown",
    "next-version",
    "checkout-order",
    "committed-or-unknown",
  ])
    expect(schema).toContain(word);
  expect(designSchema.parse(JSON.parse(JSON.stringify(copied.design)))).toEqual(copied.design);
});

it("preserves legacy shapes without implicit commands, migrations or second session authority", () => {
  const empty = { schemaVersion: 1, entities: [], aggregates: [] };
  expect(backendModelSchema.parse(empty)).toEqual(empty);
  expect(mapBackendModel(backendModelSchema.parse(empty), {})).toEqual(empty);
  const legacy = designSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
    ),
  );
  expect(legacy.architecture?.backend).toBeUndefined();
  expect(validateBackendBehavior(legacy)).toEqual([]);
  expect(contractKey(operation(fixture()))).toBe("post-command@v1");
});

it("binds bounded read-only queries, typed filter inputs and projected results without mutation or hidden reads", () => {
  const d = fixture(),
    op = operation(d),
    w = wire(d);
  w.behavior = { kind: "Query" };
  w.outcomes = w.outcomes
    ?.filter((o) => !["conflict", "uncertain"].includes(o.id))
    .map((o) => ({ ...o, state: "Unchanged" }));
  w.output = [
    {
      id: "rows",
      name: "rows",
      required: true,
      description: "",
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        fields: [
          {
            id: "body",
            name: "body",
            required: true,
            description: "",
            type: "text",
            minLength: 1,
            maxLength: 16000,
          },
        ],
      },
    },
  ];
  model(d).queries = [
    {
      id: "list",
      version: "v1",
      name: "List",
      root: ref("record"),
      joins: [],
      filters: [
        {
          id: "by-body",
          field: { source: "root", field: "body" },
          comparisons: ["eq"],
        },
      ],
      projection: [{ id: "body", field: { source: "root", field: "body" } }],
      order: [
        { field: { source: "root", field: "scope" }, direction: "asc" },
        { field: { source: "root", field: "id" }, direction: "asc" },
      ],
      limit: { default: 25, maximum: 100 },
      cursor: {
        kind: "keyset",
        fields: [
          { source: "root", field: "scope" },
          { source: "root", field: "id" },
        ],
      },
      accessPolicy: op.access.policy,
      accessProjection: "read",
      freshness: { kind: "authoritative" },
    },
  ];
  op.identity = [];
  op.kind = "query";
  op.query = ref("list");
  op.queryInputs = [{ filter: "by-body", operator: "eq", value: input("body") }];
  op.access.action = "read";
  op.actions = [];
  op.writes = [];
  op.guards = [];
  op.transaction.kind = "read-only";
  op.idempotency = { kind: "read-only" };
  op.expectedVersion = { kind: "none" };
  op.cancellation.startsWork = false;
  op.outcomes = op.outcomes.filter((o) => !["conflict", "uncertain"].includes(o.trigger));
  need(op.outcomes[0]).values = [{ field: "rows", value: { kind: "query-result" } }];
  expect(errors(d)).toEqual([]);
  expect(validateBackendBehavior(d)).toEqual([]);
  const currentRead = structuredClone(d);
  need(operation(currentRead).outcomes[0]).values = [{ field: "rows", value: current("body") }];
  expect(
    validateBackendBehavior(currentRead).some((f) => f.message.includes("bounded query result")),
  ).toBe(true);
  const wrongFilter = structuredClone(d);
  operation(wrongFilter).queryInputs = [
    { filter: "by-body", operator: "eq", value: input("expected") },
  ];
  expect(validateBackendBehavior(wrongFilter).some((f) => f.code === "CONFIG_INVALID")).toBe(true);
  const wrongComparison = structuredClone(d);
  operation(wrongComparison).queryInputs = [
    { filter: "by-body", operator: "gte", value: input("body") },
  ];
  expect(
    validateBackendBehavior(wrongComparison).some((f) => f.message.includes("allowlisted")),
  ).toBe(true);
  const mutation = structuredClone(d);
  operation(mutation).actions = operation(fixture()).actions;
  expect(validateBackendBehavior(mutation).some(isStructural)).toBe(true);
});

it("supports stable row locks and rejects conflicting access bindings and private result projections", () => {
  const d = fixture(),
    op = operation(d);
  need(model(d).aggregates[0]).concurrency = {
    kind: "row-lock",
    entities: [ref("record")],
    order: "entity-id-primary-key",
  };
  op.expectedVersion = { kind: "none" };
  expect(validateBackendBehavior(d)).toEqual([]);
  model(d).accessBindings = [
    {
      id: "conflicting",
      version: "v1",
      name: "Conflicting",
      target: { kind: "operation", ...op.target },
      resource: ref("record"),
      policy: op.access.policy,
      action: "read",
      site: "write",
      projection: "read",
    },
  ];
  expect(
    validateBackendBehavior(d).some((f) => f.message.includes("existing exact operation access")),
  ).toBe(true);
  model(d).accessBindings = [];
  need(need(model(d).accessPolicies?.[0]).projections.find((p) => p.id === "read")).fields = ["id"];
  expect(validateBackendBehavior(d).some((f) => f.message.includes("exceed"))).toBe(true);
});

it("supports direct add/remove relation actions without clearing scope and rejects nullable additions", () => {
  const d = fixture(),
    op = operation(d),
    entity = need(model(d).entities[0]);
  entity.relations = [
    {
      id: "assigned-record",
      target: ref("record"),
      fields: [
        { source: "scope", target: "scope" },
        { source: "assignee", target: "id" },
      ],
      cardinality: "many-to-one",
      ownership: "reference",
      scope: "same-scope",
      onDelete: "restrict",
    },
  ];
  op.actions = [
    {
      id: "cas",
      kind: "patch",
      entity: ref("record"),
      values: [{ field: "version", value: { kind: "server", factory: "next-version" } }],
    },
    {
      id: "assign",
      kind: "add-relation",
      entity: ref("record"),
      relation: "assigned-record",
      values: [{ field: "assignee", value: input("assignee") }],
    },
  ];
  op.writes = [
    { entity: ref("record"), field: "version" },
    { entity: ref("record"), field: "assignee" },
  ];
  expect(errors(d)).toEqual([]);
  expect(validateBackendBehavior(d)).toEqual([]);
  const remove = need(op.actions[1]);
  if (remove.kind !== "add-relation") throw new Error("fixture");
  op.actions[1] = {
    ...remove,
    kind: "remove-relation",
    values: [{ field: "assignee", value: literal(null) }],
  };
  expect(validateBackendBehavior(d)).toEqual([]);
  op.actions[1] = { ...remove, values: [{ field: "assignee", value: literal(null) }] };
  expect(validateBackendBehavior(d).some((f) => f.message.includes("nonnull relation"))).toBe(true);
});

it("binds existing identities with trusted scope, preserves registry identities and reports missing selectors as gaps", () => {
  const before = fixture(),
    d = structuredClone(before);
  operation(d).identity = [
    { field: "scope", value: input("assignee") },
    { field: "id", value: input("cart-id") },
  ];
  expect(save(before, d).ok).toBe(false);
  delete operation(d).identity;
  expect(errors(d)).toEqual([]);
  expect(
    validateBackendBehavior(d).some(
      (f) => f.code === "CONFIG_REQUIRED" && f.target.path?.includes("identity"),
    ),
  ).toBe(true);
  const source = fixture("order");
  operation(source).actions.unshift({
    id: "proposal",
    kind: "capability",
    strategy: {
      kind: "unsupported",
      reference: ref("unregistered-price"),
      result: ref("strategy-result"),
    },
    input: [],
  });
  const mapped = mapBackendModel(model(source), {
    "unregistered-price": "wrong-global-name",
    "strategy-result": "copy-result",
  });
  const action = need(mapped.operations?.[0]?.actions[0]);
  expect(action.kind).toBe("capability");
  if (action.kind === "capability")
    expect(action.strategy).toMatchObject({
      reference: ref("unregistered-price"),
      result: ref("copy-result"),
    });
});

it("preserves bounded map/union assignments and literal enum values rather than treating values as graph IDs", () => {
  const map = {
    type: "map" as const,
    keys: { maxLength: 30 },
    maxEntries: 10,
    values: { type: "integer" as const, minimum: 0, maximum: 100 },
  };
  const tagged = {
    type: "tagged-union" as const,
    discriminator: "kind",
    variants: ["draft", "published"].map((tag) => ({
      type: "object" as const,
      fields: [
        {
          id: "tag",
          name: "kind",
          required: true,
          description: "",
          type: "text" as const,
          enumValues: [tag],
        },
        {
          id: "content",
          name: "content",
          required: true,
          description: "",
          type: "text" as const,
          maxLength: 100,
        },
      ],
    })),
  };
  for (const value of [map, tagged]) {
    const d = fixture(),
      data = need(d.architecture?.contracts?.find((c) => c.id === "record-data")?.shape);
    const fields = [data.payload, wire(d).input, wire(d).output];
    for (const list of fields) {
      const i = list.findIndex((f) => f.id === "body");
      list[i] = { id: "body", name: "body", required: true, description: "", ...value };
    }
    need(model(d).entities[0]?.fields.find((f) => f.field === "body")).storage = {
      kind: "json",
      query: "opaque",
    };
    expect(errors(d)).toEqual([]);
    expect(validateBackendBehavior(d)).toEqual([]);
  }
  const d = fixture(),
    l = lifecycle(d),
    state = need(
      d.architecture?.contracts
        ?.find((c) => c.id === "record-data")
        ?.shape?.payload.find((f) => f.id === "state"),
    );
  state.enumValues = ["In progress", "Done"];
  l.states = ["In progress", "Done"];
  l.initial = "In progress";
  need(l.transitions[0]).from = "In progress";
  need(l.transitions[0]).to = "Done";
  operation(d).guards = [];
  expect(backendLifecycleSchema.safeParse(l).success).toBe(true);
  expect(validateBackendBehavior(d)).toEqual([]);
});

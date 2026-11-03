/** Isolated full-graph/compiler claims. No executable template modules or benchmark evidence. */
import {
  architectureBindingSchema,
  architectureContractSchema,
  architectureInterfaceSchema,
  backendEffectSchema,
  backendHookSchema,
  backendImplementationRequirements,
  backendOperationSchema,
  type DesignDocument,
  designSchema,
} from "@jeeves/spec";
import {
  backendPlanFixture,
  backendPlanLookup,
  irModel,
  requiredIR as need,
  irRef as ref,
} from "./backend-plan-fixture.ts";

export function backendCompileFixture(
  withHook = false,
  external = false,
  configure?: (design: DesignDocument) => void,
) {
  let design = backendPlanFixture();
  const a = need(design.architecture),
    m = irModel(design);
  const aggregate = need(m.aggregates[0]);
  aggregate.invariants.push({
    id: "revision-positive",
    strategy: "nonnegative",
    value: { entity: ref("topic-entity"), field: "revision" },
  });
  a.components?.push({ ...structuredClone(need(a.components[0])), id: "audit", name: "Audit" });
  a.componentRelationships = [
    {
      id: "local-audit",
      from: "domain",
      to: "audit",
      description: "Records audit",
      protocol: "In process",
      interaction: "Request / response",
    },
  ];
  design.connections = [
    {
      id: "data-link",
      kind: "depends-on",
      from: { element: "api" },
      to: { element: "store" },
      planned: {
        label: "Reads records",
        protocol: "SQL",
        interaction: "Request / response",
        security: "Private network",
      },
      config: {},
    },
  ];
  const outcomes = [
    "success",
    "conflict",
    "rejected",
    "failed",
    "unavailable",
    "cancelled",
    "uncertain",
  ].map((id) => ({
    id,
    name: id,
    kind:
      id === "success"
        ? "Success"
        : ["conflict", "rejected"].includes(id)
          ? "Rejection"
          : "Failure",
    state: id === "success" ? "Committed" : id === "uncertain" ? "Unknown" : "Unchanged",
    retry: id === "uncertain" ? "Reconcile first" : "Safe",
    condition: "Explicit finite outcome",
    status:
      id === "success"
        ? 200
        : id === "conflict"
          ? 409
          : id === "rejected"
            ? 403
            : id === "cancelled"
              ? 408
              : id === "failed"
                ? 500
                : id === "uncertain"
                  ? 504
                  : 503,
  }));
  a.contracts?.push(
    architectureContractSchema.parse({
      ...ref("commands"),
      name: "Commands",
      kind: "api",
      description: "",
      coverage: "Complete",
      shape: {
        payload: [],
        operations: [
          {
            id: "touch",
            name: "Touch",
            input: [
              {
                id: "key",
                name: "key",
                description: "",
                required: true,
                type: "text",
                minLength: 1,
                maxLength: 100,
              },
              { id: "id", name: "id", description: "", required: true, type: "uuid" },
            ],
            output: [],
            outcomes,
            behavior: { kind: "Command" },
            transport: {
              protocol: "http",
              method: "POST",
              path: "/topics/{id}/touch",
              parameters: [{ field: "id", in: "path", name: "id" }],
              request: { kind: "json", contentType: "application/json", fields: ["key"] },
              responses: outcomes.map((o) => ({ outcome: o.id, status: o.status, headers: [] })),
            },
          },
        ],
      },
    }),
  );
  a.interfaces = [
    {
      id: "command-interface",
      name: "Command interface",
      owner: { kind: "component", id: "domain" },
      direction: "provided",
      contract: ref("commands"),
      necessity: "required",
    },
    ...["data", "local"].flatMap((prefix) => [
      {
        id: `${prefix}-provided`,
        name: "Provided",
        owner:
          prefix === "data" ? { kind: "element", id: "store" } : { kind: "component", id: "audit" },
        direction: "provided",
        contract: ref("topic-data"),
        necessity: "required",
      },
      {
        id: `${prefix}-required`,
        name: "Required",
        owner: { kind: "component", id: "domain" },
        direction: "required",
        contract: ref("topic-data"),
        necessity: "required",
      },
    ]),
  ].map((value) => architectureInterfaceSchema.parse(value));
  a.bindings = ["data", "local"]
    .map((prefix) => ({
      id: `${prefix}-binding`,
      name: "Exact interfaces",
      relationship: {
        kind: prefix === "data" ? "connection" : "component-relationship",
        id: prefix === "data" ? "data-link" : "local-audit",
      },
      provided: `${prefix}-provided`,
      required: `${prefix}-required`,
      contract: ref("topic-data"),
      role: "read",
      transport: "SQL",
      businessSynchrony: "Synchronous",
    }))
    .map((value) => architectureBindingSchema.parse(value));
  for (const policy of m.accessPolicies ?? []) {
    policy.rules[0]?.actions.push("touch");
    policy.projections.push({
      id: "write",
      mode: "write",
      fields: ["title"],
      when: { operator: "all", clauses: ["signed-in"] },
      unknownFields: "reject",
    });
    policy.revocation.recheck.push("write", "idempotent-replay", "delivery");
  }
  m.operations = [
    backendOperationSchema.parse({
      ...ref("touch"),
      name: "Touch",
      kind: "command",
      target: {
        contract: ref("commands"),
        operation: "touch",
        owner: { kind: "component", id: "domain" },
      },
      aggregate: ref("topic-aggregate"),
      identity: [{ field: "id", value: { kind: "input", path: ["id"] } }],
      access: {
        policy: { kind: "policy", reference: ref("topic-policy") },
        action: "touch",
        readProjection: "visible",
        writeProjection: "write",
      },
      guards: [],
      actions: [
        {
          id: "touch-revision",
          kind: "patch",
          entity: ref("topic-entity"),
          values: [{ field: "revision", value: { kind: "server", factory: "next-version" } }],
        },
      ],
      writes: [{ entity: ref("topic-entity"), field: "revision" }],
      expectedVersion: { kind: "none" },
      transaction: {
        kind: "local",
        store: "store",
        participants: [ref("topic-entity"), ref("post-entity")],
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
        hashInputs: [["id"]],
        publishedWindow: true,
        expired: "new-command",
        receipt: "terminal-result-in-same-transaction",
        concurrent: "one-writer-bounded-wait-or-retry",
        replay: "current-policy-before-result",
        cleanup: "separate-controlled-policy",
      },
      cancellation: {
        kind: "cooperative",
        startsWork: false,
        deadlineSeconds: 30,
        beforeCommit: "rollback",
        afterCommit: "committed-or-unknown",
      },
      outcomes: outcomes.map((o) => ({ outcome: o.id, trigger: o.id, values: [] })),
    }),
  ];
  a.scenarios = [
    {
      id: "failure-path",
      name: "Failure path",
      scope: { level: "components", container: "api" },
      steps: [
        {
          id: "audit",
          relationship: { kind: "componentRelationship", id: "local-audit" },
          text: "Track original identity",
        },
      ],
      outcomes: [
        {
          id: "safe",
          text: "Preserve commit uncertainty",
          invariants: ["No invented success"],
          requirements: [],
          decisions: [],
        },
      ],
      mainOutcomes: ["safe"],
    },
  ];
  const recovery = (trigger: string) => ({
    trigger,
    strategy: trigger === "hook-failure" ? "confirmed-rollback" : "same-command-key",
    operation: ref("touch"),
    outcome: trigger === "hook-failure" ? "failed" : "uncertain",
    scenario: { id: "failure-path", outcome: "safe" },
    invariants: [{ aggregate: ref("topic-aggregate"), invariant: "revision-positive" }],
  });
  a.contracts?.push({
    ...ref("event"),
    name: "Touched",
    kind: "event",
    description: "",
    coverage: "Complete",
    shape: {
      payload: [{ id: "id", name: "id", description: "", required: true, type: "uuid" }],
      operations: [],
    },
  });
  m.effects = [
    backendEffectSchema.parse({
      ...ref("publish"),
      name: "Publish intent",
      source: ref("touch"),
      target: { kind: "event", contract: ref("event") },
      boundary: "atomic-intent",
      execution: "durable-intent",
      payload: ref("event"),
      values: [{ field: "id", value: { kind: "input", path: ["id"] } }],
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
        attempts: 5,
        backoffSeconds: 2,
        timeoutSeconds: 30,
        exhausted: "operator-visible",
        duplicates: "possible",
      },
      recovery: [recovery("uncertain-commit"), recovery("lost-acknowledgement")],
    }),
  ];
  if (withHook) {
    for (const id of ["hook-input", "hook-output", "hook-error"])
      a.contracts?.push({
        ...ref(id),
        name: id,
        kind: "data",
        description: "",
        coverage: "Complete",
        shape: {
          payload: [{ id: "id", name: "id", description: "", required: true, type: "uuid" }],
          operations: [],
        },
      });
    m.hooks = [
      backendHookSchema.parse({
        ...ref("custom"),
        name: "Custom hook",
        operation: ref("touch"),
        owner: { kind: "component", id: "domain" },
        kind: "pure",
        boundary: "before-commit",
        contracts: {
          input: ref("hook-input"),
          output: ref("hook-output"),
          error: ref("hook-error"),
        },
        context: ["correlation", "cancellation", "deadline"],
        authority: "current-policy-at-observation",
        dependencies: [],
        repositories: [],
        services: [],
        allowedWrites: [],
        writeMode: "validated-proposals-only",
        allowedEffects: [],
        result: "validate-exact-contract-before-use",
        privateData: "none",
        required: true,
        readiness: "before-mutation",
        timeoutSeconds: 10,
        cancellation: "cooperative-no-forced-termination",
        unavailable: { outcome: "unavailable", status: 503, writes: "none" },
        failure: {
          operation: ref("touch"),
          scope: "source-transaction",
          error: "failed",
          invalidResult: "failed",
          timeout: "failed",
          cancelled: "cancelled",
        },
        acceptance: ["custom-success", "custom-unavailable"],
        seam: { file: "src/hooks/custom.ts", ownership: "scaffold-once-project-owned" },
        recovery: [recovery("hook-failure")],
      }),
    ];
    need(m.operations[0]).actions.unshift({
      id: "custom-action",
      kind: "hook",
      hook: ref("custom"),
      input: [{ field: "id", value: { kind: "input", path: ["id"] } }],
    });
  }
  if (external) {
    design.elements.push({
      ...structuredClone(need(design.elements[0])),
      id: "provider",
      name: "External provider",
      planned: "third-party-service",
    });
    design.connections.push({
      ...structuredClone(need(design.connections[0])),
      id: "provider-link",
      to: { element: "provider" },
    });
    a.interfaces?.push({
      ...need(a.interfaces[1]),
      id: "provider-provided",
      owner: { kind: "element", id: "provider" },
    });
    a.interfaces?.push({ ...need(a.interfaces[2]), id: "provider-required" });
    a.bindings?.push({
      ...need(a.bindings[0]),
      id: "provider-binding",
      relationship: { kind: "connection", id: "provider-link" },
      provided: "provider-provided",
      required: "provider-required",
    });
  }
  m.capabilityConfigs = [
    {
      ...ref("calendar"),
      schemaVersion: 1,
      name: "Business calendar",
      owner: { kind: "component", id: "domain" },
      kind: "calendar",
      timezone: "UTC",
      weekly: [{ day: 1, intervals: [{ startMinute: 540, endMinute: 1020 }] }],
      holidays: [],
      intervalMeaning: "local-half-open-no-overnight",
      daylightSaving: "elapsed-real-minutes-in-local-open-intervals",
    },
  ];
  need(a.contracts?.find((c) => c.id === "topic-data")?.shape).payload.push({
    id: "state",
    name: "state",
    description: "",
    type: "text",
    required: true,
    enumValues: ["active", "archived"],
  });
  need(m.entities.find((e) => e.id === "topic-entity")).fields.push({
    field: "state",
    storageId: "state-column",
    storage: { kind: "scalar" },
    required: true,
    nullable: false,
  });
  m.lifecycles = [
    {
      ...ref("topic-state"),
      name: "Topic state",
      aggregate: ref("topic-aggregate"),
      state: { entity: ref("topic-entity"), field: "state" },
      states: ["active", "archived"],
      initial: "active",
      guards: [],
      transitions: [{ id: "archive", from: "active", to: "archived", guards: [] }],
    },
  ];
  configure?.(design);
  design = designSchema.parse(design);
  const lookup = backendPlanLookup(design),
    b = irModel(design);
  // Assign each secondary obligation exactly once, with its actual host/store ownership.
  for (const selection of b.implementations ?? []) selection.obligations = [];
  const primary = need(b.implementations?.find((s) => s.target.id === "domain"));
  primary.obligations = backendImplementationRequirements(design)
    .filter(
      (r) =>
        !["container", "component", "connection", "component-relationship"].includes(r.ref.kind),
    )
    .map((r) => r.ref);
  const storeContract = { kind: "contract" as const, ...ref("topic-data") };
  primary.obligations = primary.obligations.filter(
    (r) => !(r.kind === "contract" && r.id === "topic-data"),
  );
  need(b.implementations?.find((s) => s.target.id === "store")).obligations.push(storeContract);
  for (const binding of design.architecture?.bindings ?? []) {
    const owner = need(b.implementations?.find((s) => s.target.id === binding.relationship.id));
    primary.obligations = primary.obligations.filter(
      (r) => !(r.kind === "binding" && r.id === binding.id),
    );
    owner.obligations.push({ kind: "binding", id: binding.id });
  }
  if (external) {
    const selection = need(b.implementations?.find((s) => s.target.id === "provider"));
    const relationship = need(b.implementations?.find((s) => s.target.id === "provider-link"));
    relationship.obligations = [];
    selection.obligations.push({ kind: "binding", id: "provider-binding" });
    selection.environment = {
      mode: "fixture",
      adapterBinding: "provider-binding",
      configurationId: "fixture-provider",
      credentialId: "fixture-credential",
    };
    // Relationship itself must also claim its participating binding, so give it a distinct one.
    const binding = structuredClone(
      need(design.architecture?.bindings?.find((v) => v.id === "provider-binding")),
    );
    binding.id = "provider-wire-binding";
    need(design.architecture?.bindings).push(binding);
    relationship.obligations.push({ kind: "binding", id: binding.id });
  }
  if (withHook) {
    const descriptor = need(lookup.get(primary.template)?.capabilities?.[0]);
    descriptor.hooks.push({
      id: "custom-slot",
      input: ref("hook-input"),
      output: ref("hook-output"),
      error: ref("hook-error"),
      execution: "pure",
    });
    const option = need(
      descriptor.provides
        .find((p) => p.kind === "component")
        ?.options.find((o) => o.path === "family"),
    );
    option.support = { kind: "hook", hook: "custom-slot" };
    // The sibling's family uses the same descriptor. Select its own matching seam separately
    // in tests if needed; here keep hook support specific to the domain selection's descriptor.
    const own = structuredClone(descriptor);
    own.id = "hook-ir";
    option.support = { kind: "values", values: ["domain-module"] };
    need(lookup.get(primary.template)?.capabilities).push(own);
    primary.capability = ref("hook-ir");
    primary.hooks = [{ slot: "custom-slot", hook: ref("custom") }];
  }
  return { design, lookup };
}

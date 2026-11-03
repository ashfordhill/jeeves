import { expect, it } from "vitest";
import { z } from "zod";
import { applyOperations } from "./apply.ts";
import {
  buildArchitectureHandoff,
  handoffFingerprint,
  handoffJson,
  handoffMarkdown,
} from "./architecture-handoff.ts";
import { extractArchitectureTemplate } from "./architecture-library.ts";
import { fragmentIds, mappedArchitecture } from "./architecture-patterns.ts";
import { targetChanges } from "./architecture-targets.ts";
import {
  type BackendCapabilityDescriptor,
  type BackendImplementation,
  backendCapabilityDescriptorSchema,
  backendImplementationSchema,
  type ImplementationObligation,
} from "./backend-implementation-model.ts";
import {
  backendImplementationRequirements,
  capabilityOptionDemands,
  implementationKey,
  validateBackendImplementations,
} from "./backend-implementations.ts";
import { backendModelSchema, mapBackendModel } from "./backend-model.ts";
import { matchBackendImplementations } from "./backend-support.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { blocksGenerate, isStructural } from "./findings.ts";
import { type TemplateLookup, templateManifestSchema } from "./manifest.ts";
import { operationBatchJsonSchema } from "./operations.ts";
import { testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

const ref = (id: string, version = "v1") => ({ id, version });
const values = (path: string, ...values: (string | number | boolean | null)[]) => ({
  path,
  support: { kind: "values" as const, values },
});
function descriptor(): BackendCapabilityDescriptor {
  return backendCapabilityDescriptorSchema.parse({
    schemaVersion: 1,
    ...ref("audit"),
    name: "Synthetic audit only",
    targets: ["component", "container", "operation", "connection", "component-relationship"],
    provides: [
      {
        kind: "component",
        shapes: [],
        options: [
          values("family", "audit-log-module"),
          values("config.access", "Admins only"),
          { path: "config.retention", support: { kind: "range", minimum: 1, maximum: 365 } },
        ],
      },
    ],
    requires: {
      hostRoles: ["service"],
      hostTemplates: [],
      storeTemplates: [],
      transports: [],
      context: [],
      revocation: [],
    },
    dependencies: [],
    conflicts: [],
    hooks: [],
    evidencePackIds: ["synthetic-audit-check"],
    origin: { kind: "library", package: "test-only-module", version: "1.0.0" },
  });
}
function lookup(d = descriptor(), additional: BackendCapabilityDescriptor[] = []): TemplateLookup {
  const manifest = templateManifestSchema.parse({
    id: "test-module",
    version: "1.0.0",
    kind: "attachment",
    displayName: "Synthetic module",
    description: "Tests only",
    config: z.object({}),
    card: { icon: "box" },
    capabilities: [d, ...additional],
  });
  return {
    get: (r) => (r.id === "test-module" && r.version === "1.0.0" ? manifest : testLookup.get(r)),
    versions: (id) => (id === "test-module" ? ["1.0.0"] : testLookup.versions(id)),
  };
}
function selection(
  target: ImplementationObligation = { kind: "component", id: "audit-module" },
): BackendImplementation {
  return backendImplementationSchema.parse({
    ...ref("selection"),
    name: "Selected synthetic audit",
    target,
    template: ref("test-module", "1.0.0"),
    capability: ref("audit"),
    obligations: [],
    hooks: [],
  });
}
function fixture(): DesignDocument {
  return designSchema.parse({
    schemaVersion: 2,
    revision: 0,
    elements: [{ id: "api", name: "API", template: ref("svc", "1.0.0"), config: { port: 8080 } }],
    architecture: {
      system: { name: "Synthetic matcher" },
      components: [
        { id: "audit-module", name: "Audit", element: "api", capability: "audit-log-module" },
      ],
      backend: { schemaVersion: 1, entities: [], aggregates: [], implementations: [selection()] },
    },
  });
}
const report = (d: DesignDocument, l = lookup()) => matchBackendImplementations(d, l);
const row = (d: DesignDocument, key = "component:audit-module", l = lookup()) =>
  requiredValue(report(d, l).obligations.find((o) => implementationKey(o.obligation) === key));
const model = (d: DesignDocument) => requiredValue(d.architecture?.backend);
const selected = (d: DesignDocument) => requiredValue(model(d).implementations?.[0]);
const requireOne = (d: DesignDocument, key: string, desc = descriptor()) => {
  const r = requiredValue(
    backendImplementationRequirements(d).find((r) => implementationKey(r.ref) === key),
  );
  selected(d).obligations.push(r.ref);
  desc.provides.push({
    kind: r.ref.kind,
    shapes: ["uuid", "integer"],
    options: capabilityOptionDemands(r.value)
      .map((v) => values(v.path, v.value))
      .filter((v, i, all) => all.findIndex((o) => o.path === v.path) === i),
  });
  return desc;
};
function persistence(d: DesignDocument) {
  d.elements.push(
    ...designSchema.parse({
      schemaVersion: 2,
      revision: 0,
      elements: [
        { id: "store", name: "Store", template: ref("db", "1.0.0") },
        { id: "wrong-store", name: "Other store", template: ref("db", "1.0.0") },
      ],
    }).elements,
  );
  requiredValue(d.architecture).contracts = [
    {
      ...ref("record-data"),
      name: "Record",
      description: "",
      kind: "data",
      coverage: "Complete",
      shape: {
        payload: [{ id: "id", name: "id", description: "", type: "uuid", required: true }],
        operations: [],
      },
    },
  ];
  requiredValue(d.architecture).datasets = [
    {
      id: "records",
      name: "Records",
      contract: ref("record-data"),
      owners: [{ kind: "component", id: "audit-module" }],
      readers: [],
      writers: [],
      ownershipDecision: "",
      store: "store",
      tenant: "Public",
      deletion: "Delete",
      exportAccess: "Owner",
    },
  ];
  model(d).entities = [
    {
      ...ref("record"),
      name: "Record",
      dataset: "records",
      contract: ref("record-data"),
      storageId: "records",
      fields: [
        {
          field: "id",
          storageId: "id",
          required: true,
          nullable: false,
          storage: { kind: "scalar" },
        },
      ],
      primaryKey: ["id"],
      scope: { kind: "global" },
      relations: [],
      uniqueKeys: [],
      indexes: [],
    },
  ];
  model(d).accessPolicies = [
    {
      ...ref("policy"),
      name: "Current policy",
      resource: ref("record"),
      context: {
        identity: "session-principal",
        authentication: "server-established",
        scope: "authorized-scope",
        correlation: "server-established",
      },
      default: "deny",
      conflict: "deny-wins",
      clauses: [],
      rules: [],
      projections: [],
      revocation: {
        strategy: "current-state",
        cache: "none",
        recheck: ["read", "idempotent-replay"],
      },
    },
  ];
}

it("accepts the same exact component with one option combination and rejects another", () => {
  const d = fixture(),
    l = lookup();
  expect(row(d, undefined, l).status).toBe("supported");
  expect(report(d, l).fullReady).toBe(true);
  requiredValue(d.architecture?.components?.[0]).config = { retention: 366 };
  expect(row(d, undefined, l).status).toBe("unsupported");
  expect(row(d, undefined, l).reasons).toContainEqual(
    expect.objectContaining({ code: "OPTION", path: "config.retention" }),
  );
  expect(report(d, l).foundationReady).toBe(false);
  requiredValue(d.architecture?.components?.[0]).config = { access: "Organization auditors" };
  expect(row(d, undefined, l).status).toBe("unsupported");
});
it("never uses prose, technology or an existing module to blanket-discharge host and relationship barriers", () => {
  const d = fixture();
  requiredValue(d.elements[0]).template = null;
  requiredValue(d.elements[0]).planned = "application-api";
  requiredValue(d.elements[0]).notes = "Everything implemented and verified";
  requiredValue(d.architecture?.components?.[0]).technology = "Supports all policies";
  expect(row(d).status).toBe("supported");
  expect(row(d, "container:api").status).toBe("unsupported");
  selected(d).obligations.push({ kind: "container", id: "api" });
  expect(row(d, "container:api").reasons.map((r) => r.code)).toContain("PRIMARY_TARGET");
  expect(report(d).fullReady).toBe(false);
  expect(blocksGenerate(validateDesign(d, lookup()))).toBe(true);
});
it("preserves every legacy NEEDS_TEMPLATE and the global generation gate even with supported descriptor claims", () => {
  const d = fixture(),
    findings = validateDesign(d, lookup());
  expect(row(d).status).toBe("supported");
  expect(findings.some((f) => f.code === "NEEDS_TEMPLATE")).toBe(true);
  expect(blocksGenerate(findings)).toBe(true);
  expect(report(d).rawFindings).toEqual(findings);
  const before = structuredClone(d);
  report(d);
  expect(d).toEqual(before);
  const legacy = fixture();
  delete requiredValue(legacy.architecture).backend;
  expect(report(legacy).enabled).toBe(false);
  expect(report(legacy).fullReady).toBe(false);
});
it("requires exact registered template and capability versions without latest-version fallback", () => {
  const d = fixture();
  selected(d).capability.version = "v2";
  expect(row(d).reasons[0]?.code).toBe("CAPABILITY_UNAVAILABLE");
  selected(d).template.version = "2.0.0";
  expect(row(d).reasons[0]?.code).toBe("TEMPLATE_UNAVAILABLE");
});
it("blocks wrong authoritative stores, unsupported store templates and missing revocation or trusted context", () => {
  const d = fixture();
  persistence(d);
  selected(d).store = "wrong-store";
  let desc = requireOne(d, "entities:record@v1");
  desc.requires.storeTemplates = [ref("db", "1.0.0")];
  expect(row(d, "entities:record@v1", lookup(desc)).reasons.map((r) => r.code)).toContain(
    "TRANSACTION_STORE",
  );
  selected(d).store = "store";
  expect(row(d, "entities:record@v1", lookup(desc)).status).toBe("supported");
  desc.requires.storeTemplates = [ref("db", "2.0.0")];
  expect(row(d, "entities:record@v1", lookup(desc)).reasons.map((r) => r.code)).toContain(
    "STORE_TEMPLATE",
  );
  desc = requireOne(d, "accessPolicies:policy@v1");
  desc.requires.storeTemplates = [ref("db", "1.0.0")];
  desc.requires.context = ["session-principal", "authorized-scope", "correlation"];
  desc.requires.revocation = ["read"];
  expect(row(d, "accessPolicies:policy@v1", lookup(desc)).reasons).toContainEqual(
    expect.objectContaining({
      code: "REVOCATION",
      message: expect.stringContaining("idempotent-replay"),
    }),
  );
  desc.requires.revocation.push("idempotent-replay");
  desc.requires.context = [];
  expect(row(d, "accessPolicies:policy@v1", lookup(desc)).reasons.map((r) => r.code)).toContain(
    "CONTEXT",
  );
});
it("reports typed shape and semantic option gaps independently", () => {
  const d = fixture();
  persistence(d);
  selected(d).store = "store";
  const desc = requireOne(d, "entities:record@v1");
  desc.requires.storeTemplates = [ref("db", "1.0.0")];
  requiredValue(desc.provides[1]).shapes = [];
  expect(row(d, "entities:record@v1", lookup(desc)).reasons.map((r) => r.code)).toContain("SHAPE");
  requiredValue(desc.provides[1]).options = [];
  expect(row(d, "entities:record@v1", lookup(desc)).reasons.map((r) => r.code)).toContain("OPTION");
});
it("distinguishes a pending explicit hook from incompatible signatures without hiding unsupported options", () => {
  const d = fixture(),
    desc = descriptor();
  desc.hooks = [
    {
      id: "retention",
      input: ref("input"),
      output: ref("output"),
      error: ref("error"),
      execution: "pure",
    },
  ];
  requiredValue(desc.provides[0]).options[2] = {
    path: "config.retention",
    support: { kind: "hook", hook: "retention" },
  };
  let r = row(d, undefined, lookup(desc));
  expect(r.status).toBe("needs-explicit-hook");
  expect(r.hooks).toEqual([{ slot: "retention", ready: false }]);
  expect(report(d, lookup(desc)).foundationReady).toBe(false);
  selected(d).hooks = [{ slot: "retention", hook: ref("missing-hook") }];
  r = row(d, undefined, lookup(desc));
  expect(r.status).toBe("incompatible");
  expect(validateBackendImplementations(d).some((f) => f.code === "UNKNOWN_REFERENCE")).toBe(true);
  requiredValue(d.architecture?.components?.[0]).config = { access: "Organization auditors" };
  expect(row(d, undefined, lookup(desc)).status).toBe("incompatible");
  expect(row(d, undefined, lookup(desc)).reasons.map((r) => r.code)).toContain("OPTION");
});
it("rejects ambiguous claims, wrong hosts, missing dependencies, exact conflicts and cycles", () => {
  const d = fixture(),
    desc = descriptor();
  desc.dependencies = [{ template: ref("test-module", "1.0.0"), capability: ref("other") }];
  expect(row(d, undefined, lookup(desc)).reasons.map((r) => r.code)).toContain("DEPENDENCY");
  desc.dependencies = [{ template: ref("test-module", "1.0.0"), capability: ref("audit") }];
  expect(row(d, undefined, lookup(desc)).reasons.map((r) => r.code)).toContain(
    "DEPENDENCY_BLOCKED",
  );
  desc.dependencies = [];
  desc.conflicts = [{ template: ref("test-module", "1.0.0"), capability: ref("audit") }];
  expect(row(d, undefined, lookup(desc)).status).toBe("incompatible");
  requiredValue(model(d).implementations).push({ ...selection(), id: "duplicate-selection" });
  expect(row(d).reasons[0]?.code).toBe("AMBIGUOUS");
});
it("rejects malformed descriptors, duplicate option paths and dangling model refs", () => {
  const desc = descriptor();
  requiredValue(desc.provides[0]).options.push(requiredValue(desc.provides[0]?.options[0]));
  expect(backendCapabilityDescriptorSchema.safeParse(desc).success).toBe(false);
  const d = fixture();
  selected(d).obligations.push({ kind: "entities", id: "missing", version: "v1" });
  expect(
    validateBackendImplementations(d).some((f) => f.message.includes("entities:missing@v1")),
  ).toBe(true);
  expect(
    backendImplementationSchema.safeParse({
      ...selection(),
      target: { kind: "entities", id: "record" },
    }).success,
  ).toBe(false);
});
it("retains bindings in atomic editing, removal diagnostics, remapping, extraction, target diffs and schema export", () => {
  const d = fixture(),
    l = lookup();
  expect(validateDesign(d, l).filter(isStructural)).toEqual([]);
  const changed = structuredClone(d);
  selected(changed).name = "Reviewed exact module";
  const saved = applyOperations(
    d,
    [{ op: "setArchitecture", architecture: requiredValue(changed.architecture) }],
    l,
  );
  expect(saved.ok).toBe(true);
  expect(
    targetChanges(d, changed).some((c) => c.path.includes("implementations/selection@v1")),
  ).toBe(true);
  const removed = structuredClone(d);
  requiredValue(removed.architecture).components = [];
  expect(validateBackendImplementations(removed).some((f) => f.code === "UNKNOWN_REFERENCE")).toBe(
    true,
  );
  expect(
    mapBackendModel(model(d), { "audit-module": "other-module", selection: "other-selection" })
      .implementations?.[0]?.target.id,
  ).toBe("other-module");
  expect(selected(d).template.id).toBe("test-module");
  requiredValue(d.elements[0]).template = null;
  requiredValue(d.elements[0]).planned = "application-api";
  const { fragment } = extractArchitectureTemplate(
    d,
    { elements: ["api"] },
    { id: "saved", version: "1.0.0", name: "Saved", purpose: "Synthetic preservation" },
    l,
  );
  expect(fragment.architecture.backend?.implementations).toHaveLength(1);
  const ids = Object.fromEntries(fragmentIds(fragment).map((id) => [id, `mapped-${id}`]));
  expect(mappedArchitecture(fragment, ids).backend?.implementations?.[0]?.target.id).not.toBe(
    selected(d).target.id,
  );
  expect(JSON.stringify(operationBatchJsonSchema())).toContain("implementations");
  expect(backendModelSchema.parse(model(d)).implementations).toEqual(model(d).implementations);
});
it("exports deterministic selected descriptors, option/hook explanations and separate unobserved evidence", async () => {
  const d = fixture(),
    l = lookup(),
    project = { id: "synthetic", name: "Synthetic" };
  const h = await buildArchitectureHandoff({ design: d, project, lookup: l });
  expect(h.implementationSupport?.fullReady).toBe(true);
  expect(h.implementationDescriptors).toHaveLength(1);
  expect(h.evidence.generation).toBeNull();
  expect(handoffMarkdown(h)).toContain("Declared implementation support");
  expect(handoffJson(h)).toBe(
    handoffJson(await buildArchitectureHandoff({ design: d, project, lookup: l })),
  );
  const first = await handoffFingerprint(d, project);
  selected(d).capability.version = "v2";
  expect(await handoffFingerprint(d, project)).not.toBe(first);
});

it("accounts for exact command targets independently and never accepts the wrong transaction store", () => {
  const d = fixture();
  persistence(d);
  selected(d).store = "store";
  model(d).operations = [
    {
      ...ref("read-record"),
      name: "Read record",
      target: {
        owner: { kind: "component", id: "audit-module" },
        contract: ref("record-data"),
        operation: "read",
      },
      kind: "query",
      aggregate: ref("record-aggregate"),
      access: { policy: { kind: "policy", reference: ref("policy") }, action: "read" },
      guards: [],
      actions: [],
      writes: [],
      expectedVersion: { kind: "none" },
      transaction: {
        kind: "read-only",
        store: "store",
        participants: [ref("record")],
        connection: "single",
        externalIO: "forbidden",
        access: "current-state-in-transaction",
        concurrency: "aggregate-policy",
        failure: "rollback",
        commit: "disconnect-is-unknown",
      },
      idempotency: { kind: "read-only" },
      cancellation: {
        kind: "cooperative",
        startsWork: false,
        deadlineSeconds: 30,
        beforeCommit: "rollback",
        afterCommit: "committed-or-unknown",
      },
      outcomes: [{ outcome: "ok", trigger: "success", values: [] }],
    },
  ];
  const r = requiredValue(
    backendImplementationRequirements(d).find((r) => r.ref.kind === "operation"),
  );
  expect(r.ref).toEqual({ kind: "operation", id: "read-record", version: "v1" });
  expect(row(d, "operation:read-record@v1").status).toBe("unsupported");
  const desc = requireOne(d, "operation:read-record@v1");
  desc.requires.storeTemplates = [ref("db", "1.0.0")];
  desc.requires.context = ["session-principal", "authorized-scope", "correlation"];
  desc.requires.revocation = ["read", "idempotent-replay"];
  expect(row(d, "operation:read-record@v1", lookup(desc)).status).toBe("supported");
  selected(d).store = "wrong-store";
  expect(row(d, "operation:read-record@v1", lookup(desc)).reasons.map((r) => r.code)).toContain(
    "TRANSACTION_STORE",
  );
  // The deliberately incomplete operation contract remains a structural blocker for readiness.
  expect(report(d, lookup(desc)).structuralFindings.length).toBeGreaterThan(0);
  expect(report(d, lookup(desc)).foundationReady).toBe(false);
});
it("requires participating interface wiring and transport for both C2 and C3 relationships", () => {
  for (const level of ["connection", "component-relationship"] as const) {
    const d = fixture();
    requiredValue(d.architecture?.components).push({
      ...requiredValue(d.architecture?.components?.[0]),
      id: "consumer",
      name: "Consumer",
    });
    if (level === "connection") {
      d.elements.push({ ...requiredValue(d.elements[0]), id: "peer", name: "Peer" });
      requiredValue(d.architecture?.components?.[1]).element = "peer";
      d.connections = [
        {
          id: "relationship",
          kind: "calls",
          from: { element: "peer" },
          to: { element: "api" },
          planned: {
            label: "Reads audit",
            protocol: "HTTPS",
            interaction: "Request / response",
            security: "User identity",
          },
        },
      ];
    } else
      requiredValue(d.architecture).componentRelationships = [
        {
          id: "relationship",
          from: "consumer",
          to: "audit-module",
          description: "Reads audit",
          protocol: "In process",
          interaction: "Request / response",
        },
      ];
    requiredValue(d.architecture).contracts = [
      {
        ...ref("audit-api"),
        name: "Audit API",
        description: "",
        kind: "api",
        shape: {
          payload: [],
          operations: [{ id: "read", name: "Read audit", description: "", input: [], output: [] }],
        },
      },
    ];
    requiredValue(d.architecture).interfaces = [
      {
        id: "provided",
        name: "Provided",
        owner: { kind: "component", id: "audit-module" },
        direction: "provided",
        contract: ref("audit-api"),
        necessity: "required",
      },
      {
        id: "required",
        name: "Required",
        owner: { kind: "component", id: "consumer" },
        direction: "required",
        contract: ref("audit-api"),
        necessity: "required",
      },
    ];
    model(d).implementations = [selection({ kind: level, id: "relationship" })];
    let desc = requireOne(d, `${level}:relationship`);
    desc.requires.hostRoles = [];
    expect(row(d, `${level}:relationship`, lookup(desc)).reasons.map((r) => r.code)).toContain(
      "WIRING",
    );
    requiredValue(d.architecture).bindings = [
      {
        id: "wire",
        name: "Exact wire",
        relationship: { kind: level, id: "relationship" },
        provided: "provided",
        required: "required",
        contract: ref("audit-api"),
        operation: "read",
        role: "request",
        businessSynchrony: "Synchronous",
        transport: level === "connection" ? "REST" : "in-process",
      },
    ];
    desc = requireOne(d, "binding:wire", desc);
    desc.requires.transports = ["REST", "in-process"];
    // requireOne adds its ref; avoid the duplicate target used only for descriptor construction.
    selected(d).obligations = selected(d).obligations.filter(
      (o) => implementationKey(o) !== `${level}:relationship`,
    );
    expect(row(d, `${level}:relationship`, lookup(desc)).status).toBe("supported");
    expect(row(d, "binding:wire", lookup(desc)).status).toBe("supported");
    desc.requires.transports = [];
    expect(row(d, "binding:wire", lookup(desc)).reasons.map((r) => r.code)).toContain("TRANSPORT");
  }
});
it("does not infer external fixture or production configuration from a provider label", () => {
  const d = fixture();
  d.elements = [
    { ...requiredValue(d.elements[0]), template: null, planned: "third-party-service", config: {} },
  ];
  requiredValue(d.architecture).components = [];
  model(d).implementations = [selection({ kind: "container", id: "api" })];
  // Use a real planned external family, without a fake provider runtime.
  requiredValue(d.elements[0]).planned = "third-party-service";
  const desc = descriptor();
  desc.requires.hostRoles = [];
  desc.provides = [
    { kind: "container", shapes: [], options: [values("family", "third-party-service")] },
  ];
  expect(row(d, "container:api", lookup(desc)).reasons.map((r) => r.code)).toContain(
    "EXTERNAL_BINDING",
  );
});
it("freezes implementation-selected exact definitions across simultaneous retarget/removal while allowing labels", () => {
  const d = fixture();
  persistence(d);
  selected(d).obligations.push({ kind: "entities", id: "record", version: "v1" });
  const changed = structuredClone(d);
  requiredValue(model(changed).entities[0]).scope = { kind: "field", field: "id" };
  model(changed).implementations = [];
  const result = applyOperations(
    d,
    [{ op: "setArchitecture", architecture: requiredValue(changed.architecture) }],
    lookup(),
  );
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.errors.some((e) => e.message.includes("Implementation-selected"))).toBe(true);
  requiredValue(model(changed).entities[0]).scope = { kind: "global" };
  requiredValue(model(changed).entities[0]).name = "Renamed record";
  expect(
    applyOperations(
      d,
      [{ op: "setArchitecture", architecture: requiredValue(changed.architecture) }],
      lookup(),
    ).ok,
  ).toBe(true);
});

it("keeps explicit matching typed hooks pending implementation and treats signature changes as incompatible", () => {
  const d = fixture(),
    desc = descriptor();
  desc.hooks = [
    {
      id: "retention",
      input: ref("input"),
      output: ref("output"),
      error: ref("error"),
      execution: "pure",
    },
  ];
  requiredValue(desc.provides[0]).options[2] = {
    path: "config.retention",
    support: { kind: "hook", hook: "retention" },
  };
  model(d).hooks = [
    {
      ...ref("retention-hook"),
      name: "Typed retention seam",
      operation: ref("operation"),
      owner: { kind: "component", id: "audit-module" },
      kind: "pure",
      boundary: "before-commit",
      contracts: { input: ref("input"), output: ref("output"), error: ref("error") },
      context: [],
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
        operation: ref("operation"),
        scope: "source-transaction",
        error: "failed",
        invalidResult: "invalid",
        timeout: "timeout",
        cancelled: "cancelled",
      },
      acceptance: ["fixed-retention"],
      seam: { file: "hooks/retention.ts", ownership: "scaffold-once-project-owned" },
      recovery: [],
    },
  ];
  selected(d).hooks = [{ slot: "retention", hook: ref("retention-hook") }];
  const r = row(d, undefined, lookup(desc));
  expect(r.status).toBe("needs-explicit-hook");
  expect(r.hooks).toEqual([{ slot: "retention", hook: "retention-hook@v1", ready: true }]);
  expect(report(d, lookup(desc)).fullReady).toBe(false);
  requiredValue(model(d).hooks?.[0]).contracts.output = ref("different");
  expect(row(d, undefined, lookup(desc)).status).toBe("incompatible");
});

it("bounds scalar literal support without permitting unknown option paths or arbitrary trees", () => {
  const d = fixture(),
    desc = descriptor();
  requiredValue(desc.provides[0]).options[1] = {
    path: "config.access",
    support: { kind: "scalar", type: "text", maximumLength: 11 },
  };
  expect(row(d, undefined, lookup(desc)).status).toBe("supported");
  requiredValue(d.architecture?.components?.[0]).config = { access: "Organization auditors" };
  expect(row(d, undefined, lookup(desc)).status).toBe("unsupported");
  expect(
    backendCapabilityDescriptorSchema.safeParse({
      ...desc,
      provides: [{ kind: "component", shapes: [], options: [values("*", "anything")] }],
    }).success,
  ).toBe(false);
});

function requiredValue<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error("Expected a validated model member.");
  return value;
}

it("preserves a contract kind selected solely through an exact implementation obligation", () => {
  const d = fixture();
  requiredValue(d.architecture).contracts = [
    {
      ...ref("wire"),
      name: "Wire",
      description: "",
      kind: "data",
      coverage: "Complete",
      shape: {
        payload: [{ id: "value", name: "value", description: "", required: true, type: "uuid" }],
        operations: [],
      },
    },
  ];
  selected(d).obligations.push({ kind: "contract", id: "wire", version: "v1" });
  const changed = structuredClone(d);
  requiredValue(requiredValue(changed.architecture).contracts?.[0]).kind = "event";
  const result = applyOperations(
    d,
    [{ op: "setArchitecture", architecture: requiredValue(changed.architecture) }],
    lookup(),
  );
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(
      result.errors.some((e) =>
        e.message.includes("Implementation-selected definition contract:wire@v1"),
      ),
    ).toBe(true);
});

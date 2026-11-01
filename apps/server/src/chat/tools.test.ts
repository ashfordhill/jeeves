import { readFileSync } from "node:fs";
import { builtinRegistry } from "@jeeves/registry";
import { applyOperations, designSchema } from "@jeeves/spec";
import { expect, it } from "vitest";
import { Workspace } from "./tools.ts";

const registry = builtinRegistry();
const design = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(new URL("../../../../fixtures/designs/resources.json", import.meta.url), "utf8"),
    ),
  );
it("chat requests an exact human subtype review and cannot approve it itself", () => {
  const before = design();
  const workspace = new Workspace(registry, before);
  const result = JSON.parse(
    workspace.run(
      "reviewSubtype",
      JSON.stringify({ id: "links", template: { id: "web-app", version: "0.1.0" } }),
    ),
  );
  expect(result.ok).toBe(true);
  const review = workspace.question?.subtypeReview;
  expect(review?.revision).toBe(before.revision);
  expect(review?.discarded).toContain("component: links-api (rest-api-server)");
  expect(workspace.pending).toEqual([]);
  expect(workspace.working).toEqual(before);
  const op = {
    op: "changeSubtype" as const,
    id: "links",
    template: { id: "web-app", version: "0.1.0" },
    confirmation: { revision: review!.revision, discarded: review!.discarded },
  };
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops: [op] }))).ok).toBe(
    false,
  );
  const manual = applyOperations(before, [op], registry, { baseRevision: before.revision });
  expect(manual.ok).toBe(true);
});
it("chat resource config edits use the same validation as manual attachment edits", () => {
  const before = design();
  const workspace = new Workspace(registry, before);
  const attachment = before.elements[0]!.attachments[0]!;
  const config = structuredClone(attachment.config);
  const op = { op: "updateAttachment" as const, id: attachment.id, config };
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops: [op] }))).ok).toBe(true);
  const invalid = { ...config, model: { resources: [{ id: "bad" }], extensions: [] } };
  const refused = JSON.parse(
    workspace.run("applyOperations", JSON.stringify({ ops: [{ ...op, config: invalid }] })),
  );
  expect(refused.ok).toBe(false);
  expect(workspace.working.elements[0]!.attachments[0]!.config).toEqual(config);
});

it("chat routes same-template review to a compatible upgrade without an unusable discard confirmation", () => {
  const before = design();
  const workspace = new Workspace(registry, before);
  const result = JSON.parse(
    workspace.run(
      "reviewSubtype",
      JSON.stringify({ id: "links", template: { id: "http-service", version: "0.3.0" } }),
    ),
  );
  expect(result).toMatchObject({
    ok: true,
    upgrade: {
      ok: true,
      from: { id: "http-service", version: "0.1.0" },
      to: { id: "http-service", version: "0.3.0" },
    },
  });
  expect(workspace.question).toBeUndefined();
  expect(workspace.pending).toEqual([]);
  const { id, from, to, revision } = result.upgrade;
  expect(
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "upgradeTemplate", id, from, to, revision }] }),
      ),
    ).ok,
  ).toBe(true);
  expect(workspace.working.elements[0]!.attachments).toEqual(before.elements[0]!.attachments);
  expect(workspace.working.elements[0]!.template).toEqual(to);
});

it("exposes all planned options with exact defaults, schemas and compatible host roles", async () => {
  const { componentCompatible, emptyDesign, plannedCapabilities, plannedConfigSchema } =
    await import("@jeeves/spec");
  const { z } = await import("zod");
  const workspace = new Workspace(registry, emptyDesign());
  const list = (scope?: string) =>
    JSON.parse(workspace.run("listPlannedCapabilities", JSON.stringify({ scope }))).capabilities;
  expect(list().map((entry: { id: string }) => entry.id)).toEqual(
    plannedCapabilities.map((entry) => entry.id),
  );
  for (const scope of ["container", "component"]) {
    expect(list(scope).map((entry: { id: string }) => entry.id)).toEqual(
      plannedCapabilities.filter((entry) => entry.scope === scope).map((entry) => entry.id),
    );
  }
  for (const entry of plannedCapabilities) {
    const result = JSON.parse(
      workspace.run("describePlannedCapability", JSON.stringify({ id: entry.id })),
    );
    expect(result.capability).toEqual(JSON.parse(JSON.stringify(entry)));
    expect(result.configSchema).toEqual(
      z.toJSONSchema(plannedConfigSchema(entry.id), { io: "input" }),
    );
    expect(result.availability).toContain("no runtime; blocks generation");
    if (entry.scope === "component") {
      expect(result.compatibleHostRoles).toEqual(
        ["frontend", "service", "worker", "database", "external"].filter((role) =>
          componentCompatible(entry, role),
        ),
      );
    }
  }
  expect(workspace.pending).toEqual([]);
  expect(
    JSON.parse(workspace.run("describePlannedCapability", '{"id":"quantum-transport"}')),
  ).toMatchObject({ ok: false, error: expect.stringContaining("never invent IDs") });
});

it("rejects invented planning IDs/options and incompatible C3 atomically, then accepts an honest placeholder", async () => {
  const { emptyDesign } = await import("@jeeves/spec");
  const workspace = new Workspace(registry, emptyDesign());
  const add = {
    op: "addElement",
    element: {
      id: "quantum",
      name: "Quantum transport",
      template: null,
      planned: "quantum-transport",
      notes: "Requires a capability outside the library.",
    },
  };
  const run = (ops: unknown[]) =>
    JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops })));
  expect(run([add]).ok).toBe(false);
  expect(workspace.pending).toEqual([]);
  expect(
    run([
      {
        ...add,
        element: {
          ...add.element,
          planned: "browser-client",
          config: { audience: "Invented audience" },
        },
      },
    ]).ok,
  ).toBe(false);
  expect(workspace.working.elements).toEqual([]);
  expect(
    run([
      { ...add, element: { ...add.element, planned: "browser-client" } },
      {
        op: "setArchitecture",
        architecture: {
          system: { name: "Test" },
          components: [
            {
              id: "bad-backend",
              element: "quantum",
              name: "Backend on client",
              capability: "billing-module",
            },
          ],
        },
      },
    ]).ok,
  ).toBe(false);
  expect(workspace.working.elements).toEqual([]);
  const { planned: _planned, ...placeholder } = add.element;
  expect(run([{ ...add, element: placeholder }])).toMatchObject({
    ok: true,
    findings: [{ code: "NEEDS_TEMPLATE" }],
  });
  expect(workspace.working.elements[0]?.planned).toBeUndefined();
});

it("chat exposes architectural kinds and saves independent P46 choices through shared operations", async () => {
  const { emptyDesign } = await import("@jeeves/spec");
  const workspace = new Workspace(registry, emptyDesign());
  const list = JSON.parse(workspace.run("listPlannedCapabilities", "{}")).capabilities;
  expect(list.find((e: { id: string }) => e.id === "job-queue").architectureKind).toBe(
    "Data store",
  );
  expect(list.find((e: { id: string }) => e.id === "entitlements-module")).toBeDefined();
  const ops = [
    {
      op: "setArchitecture",
      architecture: {
        system: {
          name: "Teams",
          description: "",
          businessTenancy: "Organizations",
          dataIsolation: "Shared scoped data",
        },
        nodes: [],
        relationships: [],
      },
    },
  ];
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops }))).ok).toBe(true);
  expect(workspace.working.architecture!.system).not.toHaveProperty("deliveryModel");
  expect(workspace.working.architecture!.system.dataIsolation).toBe("Shared scoped data");
});

it("chat discovers authoritative sources and edits reusable exact versions through shared operations", async () => {
  const { architectureContractReview, architectureSchema } = await import("@jeeves/spec");
  const before = design();
  const workspace = new Workspace(registry, before);
  const discovery = JSON.parse(workspace.run("getArchitectureContracts", "{}"));
  const source = discovery.sources.find((item: { kind: string }) => item.kind === "api");
  expect(source.source.element).toBe("links");
  const architecture = architectureSchema.parse({
    system: { name: "Chat contracts" },
    contracts: [
      {
        id: "update-destination",
        name: "UpdateDestination",
        version: "v1",
        kind: "api",
        source: source.source,
        sourceSnapshot: source.sourceSnapshot,
        sourceDesignRevision: source.sourceDesignRevision,
      },
    ],
    interfaces: [
      {
        id: "required-update",
        name: "UpdateDestination use",
        owner: { kind: "element", id: "links" },
        direction: "required",
        necessity: "required",
        contract: { id: "update-destination", version: "v1" },
      },
    ],
  });
  expect(
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "setArchitecture", architecture }] }),
      ),
    ).ok,
  ).toBe(true);
  expect(workspace.pending).toHaveLength(1);
  expect(architectureContractReview(workspace.working)[0]?.code).toBe("UNBOUND_REQUIRED");
  const bad = structuredClone(architecture);
  bad.contracts![0]!.sourceSnapshot = "{}";
  expect(
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "setArchitecture", architecture: bad }] }),
      ),
    ).ok,
  ).toBe(false);
  expect(workspace.working.architecture).toEqual(architecture);
});

it("contract source references survive multiple tool edits committed as one chat undo step", () => {
  const before = design();
  const workspace = new Workspace(registry, before);
  expect(
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "setNotes", id: "links", notes: "Prepare interfaces" }] }),
      ),
    ).ok,
  ).toBe(true);
  const discovery = JSON.parse(workspace.run("getArchitectureContracts", "{}"));
  const source = discovery.sources.find((item: { kind: string }) => item.kind === "api");
  const architecture = {
    system: { name: "Multi-tool contracts" },
    contracts: [
      {
        id: "legacy-contract",
        name: "Legacy operation",
        kind: "api",
        version: "v1",
        source: source.source,
        sourceSnapshot: source.sourceSnapshot,
        sourceDesignRevision: source.sourceDesignRevision,
      },
    ],
  };
  expect(
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "setArchitecture", architecture }] }),
      ),
    ).ok,
  ).toBe(true);
  const committed = applyOperations(before, workspace.pending, registry);
  expect(committed.ok).toBe(true);
  if (committed.ok) expect(committed.design.revision).toBe(before.revision + 1);
});

it("chat discovers relationship policies and saves review conflicts through the shared atomic validator", async () => {
  const { readFileSync } = await import("node:fs");
  const { designSchema } = await import("@jeeves/spec");
  const before = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/relationship-policies.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const workspace = new Workspace(registry, before);
  const discovery = JSON.parse(workspace.run("getArchitectureContracts", "{}"));
  expect(discovery.bindings).toHaveLength(8);
  expect(discovery.datasets).toHaveLength(1);
  expect(discovery.objectives).toHaveLength(3);
  expect(discovery.review).toEqual([]);
  const architecture = structuredClone(before.architecture!);
  architecture.bindings![0]!.policies!.access!.identity = "Public";
  const edit = (value: typeof architecture) =>
    JSON.parse(
      workspace.run(
        "applyOperations",
        JSON.stringify({ ops: [{ op: "setArchitecture", architecture: value }] }),
      ),
    );
  expect(edit(architecture).ok).toBe(true);
  const review = JSON.parse(workspace.run("getArchitectureContracts", "{}"));
  expect(review.review.some((item: { code: string }) => item.code === "TENANT_CONFLICT")).toBe(
    true,
  );
  expect(workspace.pending).toHaveLength(1);
  const committed = applyOperations(before, workspace.pending, registry);
  expect(committed.ok && committed.design.revision).toBe(before.revision + 1);
  const invalid = structuredClone(architecture);
  invalid.bindings![0]!.relationship.id = "missing";
  expect(edit(invalid).ok).toBe(false);
  expect(workspace.working.architecture).toEqual(architecture);
});

it("previews and applies architecture patterns through shared expansion without a separate approval, refusing incompatible or stale choices", async () => {
  const { previewArchitecturePattern, patternRequestSchema } = await import("@jeeves/spec");
  const base = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/pattern-composition.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const workspace = new Workspace(registry, base);
  const run = (tool: string, args = {}) => JSON.parse(workspace.run(tool, JSON.stringify(args)));
  expect(run("listArchitecturePatterns").patterns).toHaveLength(4);
  expect(run("describeArchitecturePattern", { id: "asynchronous-work-delivery" }).ok).toBe(false);
  const req = patternRequestSchema.parse({
    pattern: "asynchronous-work-delivery",
    version: "1.0.0",
    variant: "transactional-outbox",
    instanceId: "billing",
    baseRevision: 0,
    config: { name: "Billing delivery", channel: "Billing jobs" },
    roles: {
      api: { mode: "reuse", id: "api" },
      store: { mode: "reuse", id: "store" },
      worker: { mode: "reuse", id: "worker" },
    },
  });
  expect(
    run("describeArchitecturePattern", {
      id: req.pattern,
      variant: req.variant,
    }).fragment.invariants.join(),
  ).toContain("one atomic transaction");
  const preview = run("previewArchitecturePattern", req);
  expect(preview).toEqual(previewArchitecturePattern(base, req, registry));
  expect(workspace.pending).toEqual([]);
  expect(workspace.working).toEqual(base);
  expect(
    run("applyArchitecturePattern", {
      ...req,
      roles: { ...req.roles, store: { mode: "reuse", id: "api" } },
    }).ok,
  ).toBe(false);
  expect(workspace.pending).toEqual([]);
  expect(run("applyArchitecturePattern", req).ok).toBe(true);
  expect(workspace.question).toBeUndefined();
  const mouse = applyOperations(base, preview.ops, registry);
  expect(mouse.ok).toBe(true);
  if (mouse.ok) expect(workspace.working).toEqual(mouse.design);
  const after = structuredClone(workspace.working);
  expect(run("applyArchitecturePattern", req).ok).toBe(false);
  expect(workspace.working).toEqual(after);
});

it("several pattern applications keep saved-base provenance and one pending transaction", async () => {
  const base = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/pattern-composition.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const workspace = new Workspace(registry, base);
  for (const [instanceId, pattern] of [
    ["tenant", "tenant-workspace-access"],
    ["lookup", "cached-public-lookup"],
  ]) {
    const result = JSON.parse(
      workspace.run(
        "applyArchitecturePattern",
        JSON.stringify({
          pattern,
          version: "1.0.0",
          instanceId,
          baseRevision: 0,
          config: { name: instanceId },
          roles: { api: { mode: "reuse", id: "api" }, store: { mode: "reuse", id: "store" } },
        }),
      ),
    );
    expect(result.ok).toBe(true);
  }
  expect(workspace.patternRevisionBound).toBe(true);
  const committed = applyOperations(base, workspace.pending, registry);
  expect(committed.ok).toBe(true);
  if (committed.ok) {
    expect(committed.design.revision).toBe(1);
    expect(committed.design.architecture!.patternInstances!.map((p) => p.baseRevision)).toEqual([
      0, 0,
    ]);
  }
});

it("chat review shares the mouse report and saves scoped decisions through the same validator", async () => {
  const { reviewArchitecture } = await import("@jeeves/spec");
  const before = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/architecture-review.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const r = before.architecture!.reviewRequirements!.find((r) => r.kind === "cache")!;
  if (r.kind === "cache") delete r.update;
  const workspace = new Workspace(registry, before);
  const report = JSON.parse(workspace.run("getArchitectureReview", "{}"));
  expect(report.findings).toEqual(reviewArchitecture(before).findings);
  const f = report.findings[0];
  const architecture = structuredClone(before.architecture!);
  architecture.decisions = [
    {
      id: "defer-update",
      name: "Defer update",
      context: f.message,
      decision: "Accept bounded exploration risk",
      consequence: "Must resolve before implementation",
      status: "Accepted",
      links: f.inputs,
      acknowledgements: [{ finding: f.id, fingerprint: f.fingerprint }],
    },
  ];
  const op = { op: "setArchitecture" as const, architecture };
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops: [op] }))).ok).toBe(true);
  const mouse = applyOperations(before, [op], registry);
  expect(mouse.ok).toBe(true);
  if (mouse.ok) expect(workspace.working).toEqual(mouse.design);
  expect(workspace.reviewRevisionBound).toBe(true);
  expect(workspace.question).toBeUndefined();
  expect(JSON.parse(workspace.run("getArchitectureReview", "{}")).complete).toBe(true);
});

it("previews sourced editable annotations with the same semantics as mouse and bounds target creation to a separate turn", () => {
  const before = design();
  const workspace = new Workspace(registry, before);
  const draft = JSON.parse(workspace.run("getArchitectureAnnotationDraft", "{}"));
  expect(draft.architecture.components.length).toBeGreaterThan(0);
  const op = { op: "setArchitecture" as const, architecture: draft.architecture };
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops: [op] }))).ok).toBe(true);
  const mouse = applyOperations(before, [op], registry);
  expect(mouse.ok).toBe(true);
  if (mouse.ok) expect(workspace.working).toEqual(mouse.design);
  expect(workspace.annotationRevisionBound).toBe(true);
  expect(
    JSON.parse(
      workspace.run(
        "createTargetWorkspace",
        JSON.stringify({ name: "Target", baseRevision: before.revision }),
      ),
    ).ok,
  ).toBe(false);
  const copy = new Workspace(registry, before);
  expect(
    JSON.parse(
      copy.run(
        "createTargetWorkspace",
        JSON.stringify({ name: "Target", baseRevision: before.revision }),
      ),
    ).prepared,
  ).toBe(true);
  expect(JSON.parse(copy.run("applyOperations", JSON.stringify({ ops: [op] }))).ok).toBe(false);
  expect(copy.pending).toEqual([]);
});

it("uses the same deployment validators as mouse authoring and binds edits to their saved revision", () => {
  const planned = designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../../fixtures/designs/architecture-deployments.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const before = structuredClone(planned);
  delete before.architecture!.deployments;
  const workspace = new Workspace(registry, before);
  const op = { op: "setArchitecture" as const, architecture: planned.architecture! };
  const mouse = applyOperations(before, [op], registry);
  expect(mouse.ok).toBe(true);
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops: [op] }))).ok).toBe(true);
  if (mouse.ok) expect(workspace.working).toEqual(mouse.design);
  expect(workspace.deploymentRevisionBound).toBe(true);
  expect(workspace.question).toBeUndefined();
  const invalid = structuredClone(op);
  invalid.architecture.deployments![0]!.instances[0]!.element = "email";
  expect(JSON.parse(workspace.run("applyOperations", JSON.stringify({ ops: [invalid] }))).ok).toBe(
    false,
  );
  if (mouse.ok) expect(workspace.working).toEqual(mouse.design);
});

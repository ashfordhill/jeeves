import {
  applyOperations,
  architectureViews,
  componentPresentation,
  type DesignDocument,
  scenarioRelationships,
  validateArchitecture,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { templateSet } from "./modules.ts";
import { planProject } from "./plan.ts";
import { createRecipeDesign, recipeForDesign } from "./recipes.ts";
import { fixtureDesign } from "./test-support.ts";

const templates = templateSet();
it("groups every QR operation once, preserves partial and mixed groups, and keeps uses explicit", () => {
  const design = fixtureDesign("qrwty-architecture");
  const project = (input: DesignDocument) =>
    architectureViews(input, templates.lookup, "QR").components.find(
      (view) => view.container === "qrwty",
    )!;
  const scope = project(design);
  const grouped = scope.nodes.filter((node) => node.binding?.component);
  expect(grouped).toHaveLength(5);
  expect(
    grouped.flatMap((node) => node.members ?? []).filter((node) => node.binding?.extension),
  ).toHaveLength(8);
  expect(
    new Set(grouped.flatMap((node) => node.members?.map((member) => member.id) ?? [])).size,
  ).toBe(10);
  expect(
    scope.edges
      .filter((edge) => edge.declared)
      .map((edge) => edge.from)
      .sort(),
  ).toEqual(["responsibility:analytics", "responsibility:artwork", "responsibility:redirect"]);
  expect(scope.edges.filter((edge) => edge.id.startsWith("declared:"))).toHaveLength(0);
  const partial = structuredClone(design);
  partial.architecture!.components = partial.architecture!.components!.filter(
    (item) => item.id !== "artwork",
  );
  expect(
    project(partial).nodes.filter((node) => node.unassigned && node.binding?.extension),
  ).toHaveLength(5);
  const mixed = structuredClone(design);
  const definitions = mixed.architecture!.components!;
  definitions
    .find((item) => item.id === "qr-management")!
    .members.push(...definitions.find((item) => item.id === "redirect")!.members);
  mixed.architecture!.components = definitions.filter((item) => item.id !== "redirect");
  expect(
    project(mixed).nodes.find((item) => item.binding?.component === "qr-management")?.support,
  ).toBe("mixed");
  expect(validateArchitecture(mixed)).toEqual([]);
});

it("rejects duplicate and unknown bindings atomically while retaining lost intent through a display rename", () => {
  const design = fixtureDesign("qrwty-architecture");
  const before = structuredClone(design);
  const architecture = structuredClone(design.architecture!);
  architecture.components![1]!.members.push(...architecture.components![0]!.members);
  expect(
    applyOperations(design, [{ op: "setArchitecture", architecture }], templates.lookup).ok,
  ).toBe(false);
  architecture.components![1]!.members = [
    { attachment: "missing", kind: "resource", ref: "missing" },
  ];
  expect(
    applyOperations(design, [{ op: "setArchitecture", architecture }], templates.lookup).ok,
  ).toBe(false);
  expect(design).toEqual(before);
  const removed = applyOperations(
    design,
    [{ op: "removeAttachment", id: "qrwty-api" }],
    templates.lookup,
  );
  expect(removed.ok).toBe(true);
  if (!removed.ok) return;
  expect(removed.design.architecture?.components).toEqual(design.architecture?.components);
  const renamed = structuredClone(removed.design.architecture!);
  renamed.components![0]!.name = "Renamed missing capability";
  expect(
    applyOperations(
      removed.design,
      [{ op: "setArchitecture", architecture: renamed }],
      templates.lookup,
    ).ok,
  ).toBe(true);
  const missing = architectureViews(removed.design, templates.lookup, "QR")
    .components.flatMap((view) => view.nodes)
    .filter((node) => node.missing?.length);
  expect(missing).toHaveLength(5);
});
it("projects the same QR recipe through context, containers and meaningful component bindings", () => {
  const { design } = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { title: "Independent Studio", hostPort: 18287 },
  );
  const snapshot = structuredClone(design);
  const recipe = recipeForDesign(design, templates.lookup)!;
  const views = architectureViews(design, templates.lookup, "Project", {
    id: recipe.manifest.id,
    version: recipe.manifest.version,
    ...recipe.manifest.provided,
    frontendNotes: Object.fromEntries(
      recipe.design.elements.map((element) => [element.id, element.notes]),
    ),
  });
  expect(views.context.nodes).toHaveLength(4);
  expect(views.context.edges).toContainEqual(
    expect.objectContaining({
      from: "context:scanner",
      to: "context:destination",
      description: "Browser follows the destination URL",
    }),
  );
  expect(
    views.containers.edges.filter((edge) => edge.connection).map((edge) => edge.connection),
  ).toEqual(design.connections.map((connection) => connection.id));
  const api = views.components.find((view) => view.container === "qrwty")!;
  expect(
    api.nodes.filter((node) => node.support === "recipe" && node.binding?.element === "qrwty"),
  ).toHaveLength(8);
  expect(api.nodes.find((node) => node.id === "container:qrwty-web")).toEqual(
    views.containers.nodes.find((node) => node.id === "container:qrwty-web"),
  );
  expect(api.nodes.some((node) => node.name === "Accounts and sessions")).toBe(true);
  expect(api.resources.map((resource) => resource.id)).toEqual(["qr", "scan", "artwork"]);
  expect(api.nodes.find((node) => node.binding?.extension === "redirect")?.acceptance).toContain(
    "QR-03",
  );
  expect(api.edges.some((edge) => edge.to === "container:qrwty-db")).toBe(true);
  expect(
    architectureViews(design, templates.lookup, "Project")
      .components.find((view) => view.container === "qrwty")
      ?.nodes.filter((node) => node.support === "extension" && node.binding?.element === "qrwty"),
  ).toHaveLength(8);
  expect(design).toEqual(snapshot);
});

it("uses the same projection for a non-QR resource application and never invents wiring", () => {
  const design = fixtureDesign("resources");
  const model = design.elements
    .flatMap((element) => element.attachments)
    .find((attachment) => attachment.config.model)!.config.model as {
    resources: { name: string }[];
    extensions: { id: string; notes: string }[];
  };
  model.resources[0]!.name = "inventoryItem";
  model.extensions[0]!.notes = "Summarize inventory movements for the signed-in owner.";
  const views = architectureViews(design, templates.lookup, "Inventory");
  expect(views.context.name).toBe("Inventory");
  expect(
    views.components
      .flatMap((view) => view.nodes)
      .some((node) => node.name === "Inventory Item registry"),
  ).toBe(true);
  for (const edge of views.components.flatMap((view) => view.edges))
    expect(design.connections.some((connection) => connection.id === edge.connection)).toBe(true);
  expect(views.provision).toBeUndefined();
  const attachment = design.elements
    .flatMap((element) => element.attachments)
    .find((item) => item.template.id === "rest-api-server")!;
  attachment.template.version = "99.0.0";
  const unsupported = architectureViews(design, templates.lookup, "Inventory");
  expect(
    unsupported.components
      .flatMap((view) => view.nodes)
      .filter((node) => node.binding?.attachment === attachment.id),
  ).toEqual([expect.objectContaining({ kind: "binding", support: "intent" })]);
});

it("changes documentation/configuration through the same protected recipe without changing runtime wiring", () => {
  const { design } = createRecipeDesign(
    { id: "qr-studio", version: "0.1.0" },
    { title: "Studio", hostPort: 18287 },
  );
  const before = planProject(design, templates, { projectName: "Studio" });
  const afterDesign: DesignDocument = structuredClone(design);
  afterDesign.architecture!.system.description = "A documented business responsibility";
  const after = planProject(afterDesign, templates, { projectName: "Studio" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  afterDesign.recipe!.config.tagline = "Changed in structured configuration";
  const configured = planProject(afterDesign, templates, { projectName: "Studio" });
  expect(configured.recipe).toEqual(before.recipe);
  expect(configured.artifacts).toEqual(before.artifacts);
  expect(
    configured.files.find((file) => file.path.endsWith("product.generated.ts"))?.contents,
  ).toContain("Changed in structured configuration");
  expect(configured.files.find((file) => file.path === "docker-compose.yml")).toEqual(
    before.files.find((file) => file.path === "docker-compose.yml"),
  );
});

it("ignores container description and technology in generated behavior and ownership", () => {
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  const edited = structuredClone(design);
  for (const element of edited.elements) {
    element.description = `Responsibility of ${element.name}`;
    element.technology = "Presentation only";
  }
  const after = planProject(edited, templates, { projectName: "QR" });
  // The saved input snapshot is deliberately lossless; every generated artifact is identical.
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
});

it("ignores relationship metadata in generation, contracts, wiring and ownership", () => {
  for (const design of [
    fixtureDesign("qrwty-architecture"),
    createRecipeDesign({ id: "qr-studio", version: "0.1.0" }, { title: "QR", hostPort: 5173 })
      .design,
  ]) {
    const before = planProject(design, templates, { projectName: "QR" });
    const edited = structuredClone(design);
    for (const connection of edited.connections)
      Object.assign(connection, {
        label: "Presents domain collaboration",
        protocol: "AMQP",
        interaction: "Streaming",
      });
    if (edited.architecture?.componentRelationships)
      for (const relationship of edited.architecture.componentRelationships)
        Object.assign(relationship, { protocol: "In process", interaction: "Asynchronous" });
    const after = planProject(edited, templates, { projectName: "QR" });
    expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
      before.files.filter((file) => file.path !== "jeeves/design.json"),
    );
    expect(after.artifacts).toEqual(before.artifacts);
    expect(after.elements).toEqual(before.elements);
  }
});

it("projects connection and resource labels with protocols into C3 and keeps C1 unchanged", () => {
  const design = fixtureDesign("qrwty-architecture");
  const before = architectureViews(design, templates.lookup, "QR");
  const edited = structuredClone(design);
  for (const connection of edited.connections)
    Object.assign(connection, {
      label: `Collaborates through ${connection.id}`,
      protocol: "AMQP",
      interaction: "Streaming",
    });
  const after = architectureViews(edited, templates.lookup, "QR");
  expect(after.context).toEqual(before.context);
  const scope = after.components.find((view) => view.container === "qrwty")!;
  for (const edge of scope.edges.filter((edge) => edge.connection)) {
    expect(edge).toMatchObject({ protocol: "AMQP", interaction: "Streaming", planned: false });
    expect(edge.description).not.toMatch(/Declared use|Uses store|^calls$/);
  }
  expect(
    scope.edges.find((edge) => edge.id === "use:analytics:qrwty-uses-db")?.description,
  ).toMatch(/^Reads and writes /);
});

it("hides technical adapters without losing or duplicating QR operations or declared edges", () => {
  const design = fixtureDesign("qrwty-architecture");
  const snapshot = structuredClone(design);
  const views = architectureViews(design, templates.lookup, "QR");
  const api = views.components.find((view) => view.container === "qrwty")!;
  const visible = componentPresentation(api, false);
  expect(visible.nodes.some((node) => node.name === "HTTP resource boundary")).toBe(false);
  expect(componentPresentation(api, true)).toBe(api);
  const bindings = (nodes: typeof api.nodes): string[] =>
    nodes.flatMap((node) =>
      node.members
        ? bindings(node.members)
        : node.binding?.accounts || node.binding?.resource || node.binding?.extension
          ? [node.id]
          : [],
    );
  expect(bindings(visible.nodes).sort()).toEqual(bindings(api.nodes).sort());
  expect(new Set(bindings(visible.nodes)).size).toBe(bindings(visible.nodes).length);
  expect(bindings(visible.nodes)).toHaveLength(10);
  expect(visible.edges.filter((edge) => edge.declared)).toEqual(
    api.edges.filter((edge) => edge.declared),
  );
  for (const edge of visible.edges) {
    expect(visible.nodes.some((node) => node.id === edge.from)).toBe(true);
    expect(visible.nodes.some((node) => node.id === edge.to)).toBe(true);
  }
  const client = views.components.find((view) => view.container === "qrwty-web")!;
  expect(client.nodes.some((node) => node.name === "Typed API adapter")).toBe(true);
  expect(
    componentPresentation(client, false).nodes.some((node) => node.name === "Typed API adapter"),
  ).toBe(false);
  expect(componentPresentation(views.context, false)).toBe(views.context);
  expect(design).toEqual(snapshot);
});

it("ignores component technology in generated behavior and ownership", () => {
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  for (const component of design.architecture!.components!)
    component.technology = "REST controller";
  const after = planProject(design, templates, { projectName: "QR" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
});

it("keeps dynamic scenarios in the saved snapshot while leaving generated artifacts byte-identical", () => {
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  const edited = structuredClone(design);
  edited.architecture!.scenarios = [
    {
      id: "owner-link",
      name: "Owner creates a link",
      scope: { level: "containers" },
      steps: [
        {
          id: "save",
          relationship: { kind: "connection", id: design.connections[0]!.id },
          text: "Save a new link.",
        },
      ],
    },
  ];
  const after = planProject(edited, templates, { projectName: "QR" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
  expect(after.files.find((file) => file.path === "jeeves/design.json")?.contents).toContain(
    '"owner-link"',
  );
});

it("offers projected authored C3 storage uses as scenario references", () => {
  const design = fixtureDesign("qrwty-architecture");
  const views = architectureViews(design, templates.lookup, "QR");
  for (const view of views.components) {
    const available = scenarioRelationships(design, {
      level: "components",
      container: view.container!,
    });
    for (const edge of componentPresentation(view, false).edges) {
      if (edge.connection)
        expect(
          available.some(
            (choice) =>
              choice.relationship.kind === "connection" &&
              choice.relationship.id === edge.connection,
          ),
        ).toBe(true);
    }
  }
});

it("keeps P46 classification and independent system choices out of generated behavior", () => {
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  design.elements[0]!.classification = {
    kind: "Application",
    ownership: "System responsibility",
    operation: "Externally operated",
  };
  Object.assign(design.architecture!.system, {
    businessTenancy: "Organizations",
    authorization: "Roles and permissions",
    dataIsolation: "Dedicated infrastructure",
    deliveryModel: "Hosted",
  });
  const after = planProject(design, templates, { projectName: "QR" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  expect(after.elements).toEqual(before.elements);
  expect(after.artifacts).toEqual(before.artifacts);
});

it("keeps interface contracts in the lossless design snapshot without changing executable generation", async () => {
  const { architectureContractReview, contractCanonical, contractSources, resolveContractSource } =
    await import("@jeeves/spec");
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  const source = contractSources(design).find((item) => item.source.kind === "rest-operation")!;
  design.architecture!.contracts = [
    {
      id: "existing-api",
      name: "Existing API",
      version: "v1",
      kind: "api",
      description: "",
      source: source.source,
      sourceSnapshot: contractCanonical(resolveContractSource(design, source.source)),
      sourceDesignRevision: design.revision,
    },
    {
      id: "planned-api",
      name: "UpdateDestination",
      version: "v1",
      kind: "in-process",
      description: "",
      shape: { operations: [], payload: [] },
    },
  ];
  design.architecture!.interfaces = [
    {
      id: "browser-contract-use",
      name: "Required update",
      direction: "required",
      necessity: "required",
      owner: { kind: "element", id: design.elements[0]!.id },
      contract: { id: "planned-api", version: "v1" },
    },
  ];
  expect(architectureContractReview(design).map((item) => item.code)).toEqual([
    "UNRESOLVED_CONTRACT",
    "UNBOUND_REQUIRED",
  ]);
  const after = planProject(design, templates, { projectName: "QR" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
  expect(after.files.find((file) => file.path === "jeeves/design.json")?.contents).toContain(
    "planned-api",
  );
});

it("preserves executable outputs and ownership with relationship policies, data authority and objectives", async () => {
  const { architectureReview, contractCanonical, contractSources, resolveContractSource } =
    await import("@jeeves/spec");
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  const source = contractSources(design).find((item) => item.kind === "data")!;
  const architecture = design.architecture!;
  architecture.contracts = [
    {
      id: "resource-data",
      name: "QR records",
      version: "v1",
      kind: "data",
      description: "",
      source: source.source,
      sourceSnapshot: contractCanonical(resolveContractSource(design, source.source)),
      sourceDesignRevision: design.revision,
    },
    {
      id: "store-interface",
      name: "Record storage",
      version: "v1",
      kind: "data",
      description: "",
      shape: { operations: [], payload: [] },
    },
  ];
  architecture.interfaces = [
    {
      id: "database-records",
      name: "Stored records",
      direction: "provided",
      necessity: "required",
      owner: { kind: "element", id: "qrwty-db" },
      contract: { id: "store-interface", version: "v1" },
    },
    {
      id: "record-writer",
      name: "Record writes",
      direction: "required",
      necessity: "required",
      owner: { kind: "component", id: "qr-management" },
      contract: { id: "store-interface", version: "v1" },
    },
  ];
  architecture.bindings = [
    {
      id: "record-binding",
      name: "Record policy declaration",
      relationship: { kind: "connection", id: "qrwty-uses-db" },
      provided: "database-records",
      required: "record-writer",
      contract: { id: "store-interface", version: "v1" },
      role: "write",
      transport: "SQL",
      businessSynchrony: "Synchronous",
      policies: { access: { identity: "Unknown", tenant: "Tenant scoped", network: "Private" } },
    },
  ];
  architecture.datasets = [
    {
      id: "qr-authority",
      name: "QR authority",
      contract: { id: "resource-data", version: "v1" },
      owners: [{ kind: "component", id: "qr-management" }],
      ownershipDecision: "",
      store: "qrwty-db",
      readers: [],
      writers: [{ kind: "component", id: "qr-management" }],
      tenant: "Tenant scoped",
      retentionDays: 365,
      deletion: "Delete",
      exportAccess: "Owner",
    },
  ];
  architecture.objectives = [
    {
      id: "redirect-goal",
      name: "Redirect latency",
      scope: { kind: "component", id: "redirect" },
      metric: "response-time",
      value: 100,
      unit: "milliseconds",
      boundary: "P95 ingress to Location header",
      window: "5 minutes at peak",
    },
  ];
  expect(
    validateArchitecture(design, templates.lookup).filter((item) => item.severity === "error"),
  ).toEqual([]);
  expect(architectureReview(design).length).toBeGreaterThan(0);
  const after = planProject(design, templates, { projectName: "QR" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
  expect(after.files.find((file) => file.path === "jeeves/design.json")?.contents).toContain(
    "record-binding",
  );
});

it("keeps historical architecture pattern provenance out of executable outputs and ownership", async () => {
  const { patternConfigSchema } = await import("@jeeves/spec");
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  design.architecture!.patternInstances = [
    {
      id: "historical-pattern",
      pattern: "cached-public-lookup",
      version: "1.0.0",
      variant: "standard",
      baseRevision: design.revision,
      config: patternConfigSchema.parse({ name: "Historical lookup intent" }),
      identities: {},
      invariants: ["Historical provenance does not attach or certify a runtime."],
    },
  ];
  const after = planProject(design, templates, { projectName: "QR" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
  expect(after.files.find((file) => file.path === "jeeves/design.json")!.contents).toContain(
    "historical-pattern",
  );
});

it("preserves review decisions and requirements without changing generated outputs, contracts or ownership", async () => {
  const { reviewArchitecture } = await import("@jeeves/spec");
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  design.architecture!.reviewRequirements = [
    {
      id: "scheduled-review",
      name: "Scheduled cleanup",
      kind: "delivery",
      trigger: "Schedule",
      responsible: { kind: "element", id: "qrwty" },
    },
  ];
  design.architecture!.decisions = [
    {
      id: "hosted-first",
      name: "Hosted first",
      context: "Current product scope",
      decision: "Keep shared hosting for the first release",
      consequence: "Private delivery remains a future choice",
      status: "Accepted",
      links: [{ kind: "system", id: "system" }],
      acknowledgements: [],
    },
  ];
  expect(reviewArchitecture(design).complete).toBe(true);
  const after = planProject(design, templates, { projectName: "QR" });
  expect(after.files.filter((file) => file.path !== "jeeves/design.json")).toEqual(
    before.files.filter((file) => file.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
  expect(after.files.find((file) => file.path === "jeeves/design.json")!.contents).toContain(
    "hosted-first",
  );
});

it("keeps sourced architecture annotations out of executable outputs and ownership", async () => {
  const { suggestArchitectureAnnotations } = await import("@jeeves/spec");
  const design = fixtureDesign("generated-workspace");
  const before = planProject(design, templates, { projectName: "Inventory" });
  design.architecture = suggestArchitectureAnnotations(design, "Inventory");
  expect(design.architecture.components?.length).toBeGreaterThan(0);
  const after = planProject(design, templates, { projectName: "Inventory" });
  expect(after.files.filter((f) => f.path !== "jeeves/design.json")).toEqual(
    before.files.filter((f) => f.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
  expect(after.files.find((f) => f.path === "jeeves/design.json")?.contents).toContain(
    "annotationOrigin",
  );
});

it("preserves executable artifacts and ownership with planned deployment alternatives", async () => {
  const { deploymentEnvironmentSchema } = await import("@jeeves/spec");
  const design = fixtureDesign("qrwty-architecture");
  const before = planProject(design, templates, { projectName: "QR" });
  design.architecture!.deployments = [
    deploymentEnvironmentSchema.parse({
      id: "hosting-plan",
      name: "Hosted intent",
      kind: "Hosted",
      nodes: [
        {
          id: "hosting-node",
          name: "Managed host",
          kind: "deployment",
          region: "Illustrative region",
          responsibility: "Platform operates hosts",
        },
      ],
      instances: [{ id: "api-placement", element: "qrwty", node: "hosting-node", replicas: 3 }],
    }),
  ];
  const after = planProject(design, templates, { projectName: "QR" });
  expect(after.files.filter((f) => f.path !== "jeeves/design.json")).toEqual(
    before.files.filter((f) => f.path !== "jeeves/design.json"),
  );
  expect(after.artifacts).toEqual(before.artifacts);
  expect(after.elements).toEqual(before.elements);
  expect(after.files.find((f) => f.path === "jeeves/design.json")!.contents).toContain(
    "hosting-plan",
  );
});

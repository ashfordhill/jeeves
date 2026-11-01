import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureSchema } from "./architecture.ts";
import {
  containerClassification,
  isExternalResponsibility,
  outsideSystem,
} from "./architecture-choices.ts";
import { legacyArchitectureExample as architectureExample } from "./architecture-examples.ts";
import { designSchema, elementSchema } from "./design.ts";
import { blocksGenerate } from "./findings.ts";
import {
  componentCompatible,
  componentHostRole,
  plannedCapability,
  plannedConfigSchema,
} from "./planned-capabilities.ts";
import { testLookup } from "./test-support.ts";

it("preserves legacy tenancy, provider IDs and document shape without inferred choices", () => {
  const { design } = architectureExample("qrwty-target");
  design.elements.find((e) => e.id === "api")!.config.tenancy = "Dedicated per tenant";
  const before = structuredClone(design);
  expect(designSchema.parse(design)).toEqual(before);
  expect(design.architecture!.system).not.toHaveProperty("businessTenancy");
  for (const id of ["billing-provider", "notification-service", "observability", "load-balancer"])
    expect(plannedCapability(id)).toBeDefined();
  expect(
    plannedConfigSchema("application-api").parse({ tenancy: "Dedicated per tenant" }).tenancy,
  ).toBe("Dedicated per tenant");
});

it("keeps business tenancy independent of isolation, authorization and delivery", () => {
  for (const dataIsolation of ["Shared scoped data", "Dedicated infrastructure"])
    expect(
      architectureSchema.parse({
        system: { name: "Teams", description: "", businessTenancy: "Organizations", dataIsolation },
      }).system,
    ).toEqual({ name: "Teams", description: "", businessTenancy: "Organizations", dataIsolation });
  expect(
    architectureSchema.safeParse({
      system: { name: "Bad", description: "", dataIsolation: "Auto secure" },
    }).success,
  ).toBe(false);
});

it("models externally operated stores and owned collectors without changing host compatibility", () => {
  const store = elementSchema.parse({
    id: "store",
    name: "Data",
    template: null,
    planned: "relational-store",
    classification: {
      kind: "Data store",
      ownership: "System responsibility",
      operation: "Externally operated",
    },
  });
  expect(outsideSystem(store)).toBe(false);
  expect(containerClassification(store).kind).toBe("Data store");
  const collector = elementSchema.parse({
    id: "collector",
    name: "Collector",
    template: null,
    planned: "observability",
    classification: {
      kind: "Application",
      ownership: "System responsibility",
      operation: "Self operated",
    },
  });
  expect(outsideSystem(collector)).toBe(false);
  expect(
    containerClassification({ ...collector, classification: { kind: "Application" } }).ownership,
  ).toBe("External responsibility");
  const { design } = architectureExample("qrwty-target");
  expect(
    applyOperations(
      design,
      [
        {
          op: "updateElement",
          id: design.elements.find((e) => e.planned === "observability")!.id,
          classification: { ownership: "System responsibility" },
        },
      ],
      testLookup,
    ).ok,
  ).toBe(false);
  expect(componentHostRole(collector)).toBe("external");
  const infrastructure = elementSchema.parse({
    id: "lb",
    name: "Load balancer",
    template: null,
    planned: "load-balancer",
  });
  expect(outsideSystem(infrastructure)).toBe(true);
  expect(isExternalResponsibility(infrastructure)).toBe(false);
  expect(
    elementSchema.safeParse({
      ...collector,
      classification: { kind: "External system", ownership: "System responsibility" },
    }).success,
  ).toBe(false);
  for (const id of ["job-queue", "event-stream"])
    expect(
      containerClassification(elementSchema.parse({ id, name: id, template: null, planned: id }))
        .kind,
    ).toBe("Data store");
});

it("stores classification atomically and refuses malformed choices without changing wiring", () => {
  const { design } = architectureExample("qrwty-target");
  const before = structuredClone(design);
  const saved = applyOperations(
    design,
    [{ op: "updateElement", id: "db", classification: { operation: "Externally operated" } }],
    testLookup,
  );
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  expect(saved.design.connections).toEqual(before.connections);
  expect(saved.design.elements.find((e) => e.id === "db")!.config).toEqual(
    before.elements.find((e) => e.id === "db")!.config,
  );
  expect(blocksGenerate(saved.findings)).toBe(true);
  expect(
    applyOperations(
      design,
      JSON.parse(
        '[ { "op": "updateElement", "id": "db", "classification": { "kind": "Pretend" } } ]',
      ),
      testLookup,
    ).ok,
  ).toBe(false);
  expect(design).toEqual(before);
});

it.each(["entitlements-module", "abuse-module", "custom-domains-module", "data-lifecycle-module"])(
  "%s remains planned on compatible service/worker hosts with undecided policy defaults",
  (id) => {
    const family = plannedCapability(id)!;
    for (const role of ["service", "worker"]) expect(componentCompatible(family, role)).toBe(true);
    for (const role of ["frontend", "database", "external"])
      expect(componentCompatible(family, role)).toBe(false);
    const schema = plannedConfigSchema(id);
    for (const field of family.fields.filter(
      (f) => f.options && !["workloadShape", "workloadUnit"].includes(f.key),
    ))
      expect(schema.parse({})[field.key]).toBe("Unspecified");
    expect(schema.safeParse({ invented: "guarantee" }).success).toBe(false);
  },
);

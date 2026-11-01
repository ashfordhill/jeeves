import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { architectureSchema } from "./architecture.ts";
import {
  deploymentEnvironmentSchema,
  deploymentProjection,
  validateArchitectureDeployments,
} from "./architecture-deployments.ts";
import { designSchema } from "./design.ts";
import { emptyLayout, pruneArchitectureLayout } from "./layout.ts";
import { testLookup } from "./test-support.ts";

const fixture = () =>
  designSchema.parse(
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/designs/architecture-deployments.json", import.meta.url),
        "utf8",
      ),
    ),
  );
it("loads legacy models without deployment fields and projects replicas, distinct broker channels and an outside provider", () => {
  expect(architectureSchema.parse({ system: { name: "Legacy" } })).not.toHaveProperty(
    "deployments",
  );
  const design = fixture();
  const before = structuredClone(design);
  expect(validateArchitectureDeployments(design)).toEqual([]);
  const view = deploymentProjection(design, design.architecture!.deployments![0]!);
  expect(view.nodes.filter((n) => n.binding?.element === "redirect")).toHaveLength(3);
  const channels = view.nodes.filter((n) =>
    ["visits", "billing"].includes(n.binding?.element ?? ""),
  );
  expect(channels).toHaveLength(2);
  expect(channels[0]?.parent).toBe(channels[1]?.parent);
  expect(view.nodes.find((n) => n.name === "Email provider")).toMatchObject({
    kind: "external-system",
  });
  expect(view.nodes.find((n) => n.name === "Email provider")?.parent).toBeUndefined();
  expect(view.edges.filter((e) => e.connection === "edge-redirect")).toHaveLength(2);
  expect(view.edges.find((e) => !e.connection)?.protocol).toContain("deployment only");
  expect(view.groups?.find((g) => g.id.endsWith(":zone-a"))?.parent).toBe(
    "deployment-group:hosted-plan:hosting",
  );
  expect(design).toEqual(before);
});
it.each([
  [
    "cyclic parents",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.nodes[0]!.parent = "zone-a";
    },
  ],
  [
    "dangling parent",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.nodes[0]!.parent = "missing";
    },
  ],
  [
    "external hosted instance",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.instances[0]!.element = "email";
    },
  ],
  [
    "missing placement",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.instances[0]!.node = "missing";
    },
  ],
  [
    "merged channel replication",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.instances[3]!.replicas = 2;
    },
  ],
  [
    "channel without broker",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.instances[3]!.node = "zone-a";
    },
  ],
  [
    "duplicate identity",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.id = "redirect";
    },
  ],
  [
    "wrong external",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.externals[0]!.reference.id = "redirect";
    },
  ],
  [
    "wrong logical direction",
    (e: ReturnType<typeof fixture>) => {
      const i = e.architecture!.deployments![0]!.interactions[0]!;
      [i.from, i.to] = [i.to, i.from];
    },
  ],
  [
    "new application wire",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.interactions.push({
        id: "invented",
        kind: "infrastructure",
        from: { kind: "instance", id: "redirect-a" },
        to: { kind: "instance", id: "worker-hosted" },
        description: "Invented API",
        protocol: "HTTP",
      });
    },
  ],
  [
    "unreviewed legacy mapping",
    (e: ReturnType<typeof fixture>) => {
      e.architecture!.deployments![0]!.nodes.at(-1)!.mappingReason = "";
    },
  ],
])("rejects %s atomically", (_name, mutate) => {
  const design = fixture();
  const empty = structuredClone(design);
  delete empty.architecture!.deployments;
  mutate(design);
  expect(validateArchitectureDeployments(design).length).toBeGreaterThan(0);
  const before = structuredClone(empty);
  expect(
    applyOperations(
      empty,
      [{ op: "setArchitecture", architecture: design.architecture! }],
      testLookup,
    ).ok,
  ).toBe(false);
  expect(empty).toEqual(before);
});
it("bounds counts and expansion, accepts independent alternatives and keeps C2 unchanged", () => {
  const design = fixture();
  const env = structuredClone(design.architecture!.deployments![0]!);
  for (const count of [0, -1, 1.5, 33])
    expect(
      deploymentEnvironmentSchema.safeParse({
        ...env,
        instances: [{ ...env.instances[0], replicas: count }],
      }).success,
    ).toBe(false);
  design.architecture!.deployments = undefined;
  const edit = applyOperations(
    design,
    [
      {
        op: "setArchitecture",
        architecture: {
          ...design.architecture!,
          deployments: [
            env,
            deploymentEnvironmentSchema.parse({
              id: "private-plan",
              name: "Optional private alternative",
              kind: "Private",
            }),
          ],
        },
      },
    ],
    testLookup,
  );
  expect(edit.ok).toBe(true);
  if (edit.ok) {
    expect(edit.design.elements).toEqual(design.elements);
    expect(edit.design.connections).toEqual(design.connections);
  }
  expect(
    applyOperations(
      design,
      [{ op: "setArchitecture", architecture: { ...design.architecture!, deployments: [env] } }],
      testLookup,
      { baseRevision: 9 },
    ).ok,
  ).toBe(false);
  const huge = fixture();
  huge.architecture!.deployments![0]!.instances = Array.from({ length: 7 }, (_, i) => ({
    id: `group-${i}`,
    element: "redirect",
    node: "zone-a",
    replicas: 32,
  }));
  expect(validateArchitectureDeployments(huge).some((f) => f.message.includes("200"))).toBe(true);
});
it("traces C1 external products and rejects dangling relationships and cross-environment placement", () => {
  const design = fixture();
  const env = design.architecture!.deployments![0]!;
  design.architecture!.nodes = [
    { id: "outside-email", kind: "external-system", name: "Email", description: "" },
  ];
  design.architecture!.relationships = [
    {
      id: "worker-email",
      from: "system",
      to: "outside-email",
      container: "worker",
      description: "Delivers email through",
    },
  ];
  env.externals[0]!.reference = { kind: "context", id: "outside-email" };
  const i = env.interactions.find((i) => i.id === "deployment-email")!;
  if (i.kind === "logical") i.relationship = { kind: "context", id: "worker-email" };
  expect(validateArchitectureDeployments(design)).toEqual([]);
  design.architecture!.relationships = [];
  expect(validateArchitectureDeployments(design).some((f) => f.code === "UNKNOWN_REFERENCE")).toBe(
    true,
  );
});
it("keeps managed stores logical and external infrastructure outside deployment ownership", () => {
  const design = fixture();
  const env = design.architecture!.deployments![0]!;
  design.elements.push({
    id: "primary-store",
    name: "Managed primary data",
    template: { id: "postgres", version: "0.1.0" },
    config: {},
    attachments: [],
    notes: "",
    classification: {
      kind: "Data store",
      ownership: "System responsibility",
      operation: "Externally operated",
    },
  });
  env.instances.push({
    id: "managed-store-instance",
    element: "primary-store",
    node: "hosting",
    replicas: 1,
  });
  expect(validateArchitectureDeployments(design)).toEqual([]);
  expect(
    deploymentProjection(design, env).nodes.find((n) => n.binding?.element === "primary-store")
      ?.deploymentKind,
  ).toBe("Container instance");
  design.elements.find((e) => e.id === "edge")!.classification = {
    kind: "Deployment infrastructure",
    ownership: "External responsibility",
  };
  expect(
    validateArchitectureDeployments(design).some((f) => f.message.includes("legacy mapping")),
  ).toBe(true);
});

it("prunes deployment layout by environment and instance identity without changing semantic revision", () => {
  const design = fixture();
  const before = structuredClone(design);
  const key = "deployment:hosted-plan";
  const layout = {
    ...emptyLayout(),
    architecture: {
      [key]: {
        positions: {
          "deployment:hosted-plan:redirect-a:1": { x: 2, y: 3 },
          "deployment:hosted-plan:deleted:1": { x: 4, y: 5 },
          "deployment:hosted-plan:redirect-a:9": { x: 9, y: 9 },
        },
        viewport: { x: 1, y: 2, zoom: 1 },
      },
      "deployment:deleted": { positions: {} },
    },
  };
  expect(pruneArchitectureLayout(layout, design).architecture).toEqual({
    [key]: {
      ...layout.architecture[key],
      positions: { "deployment:hosted-plan:redirect-a:1": { x: 2, y: 3 } },
    },
  });
  expect(design).toEqual(before);
});

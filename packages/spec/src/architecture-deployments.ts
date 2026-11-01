/** Deployment declarations reference logical architecture; they never provision or generate. */
import { z } from "zod";
import { containerClassification, isExternalResponsibility } from "./architecture-choices.ts";
import type { ArchitectureProjection, ArchitectureViewNode } from "./architecture-view.ts";
import type { DesignDocument, Element } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";
import { connectionPresentation } from "./relationship-display.ts";

const text = z.string().trim().max(240).default("");
const reference = z.strictObject({ kind: z.enum(["element", "context"]), id: idSchema });
export const deploymentEndpointSchema = z.strictObject({
  kind: z.enum(["instance", "node", "external"]),
  id: idSchema,
});
export const deploymentEnvironmentSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["Hosted", "Private"]),
  description: text,
  nodes: z
    .array(
      z.strictObject({
        id: idSchema,
        name: z.string().trim().min(1).max(120),
        kind: z.enum(["deployment", "infrastructure"]),
        parent: idSchema.optional(),
        replicas: z.int().min(1).max(32).default(1),
        technology: text,
        region: text,
        zone: text,
        responsibility: text,
        operation: z
          .enum(["Unspecified", "Self operated", "Externally operated"])
          .default("Unspecified"),
        /** Explicit reviewed reference, not a reclassification/removal of the source C2 element. */
        legacyElement: idSchema.optional(),
        mappingReason: text,
      }),
    )
    .max(100)
    .default([]),
  instances: z
    .array(
      z.strictObject({
        id: idSchema,
        element: idSchema,
        node: idSchema,
        replicas: z.int().min(1).max(32).default(1),
      }),
    )
    .max(100)
    .default([]),
  externals: z
    .array(z.strictObject({ id: idSchema, reference }))
    .max(50)
    .default([]),
  interactions: z
    .array(
      z.discriminatedUnion("kind", [
        z.strictObject({
          id: idSchema,
          kind: z.literal("logical"),
          from: deploymentEndpointSchema,
          to: deploymentEndpointSchema,
          relationship: z.strictObject({ kind: z.enum(["connection", "context"]), id: idSchema }),
        }),
        z.strictObject({
          id: idSchema,
          kind: z.literal("infrastructure"),
          from: deploymentEndpointSchema,
          to: deploymentEndpointSchema,
          description: z.string().trim().min(1).max(240),
          protocol: z.string().trim().min(1).max(120),
        }),
        z.strictObject({
          id: idSchema,
          kind: z.literal("replica"),
          from: deploymentEndpointSchema,
          to: deploymentEndpointSchema,
          description: z.string().trim().min(1).max(240),
          protocol: z.string().trim().min(1).max(120),
        }),
      ]),
    )
    .max(200)
    .default([]),
});
export type DeploymentEnvironment = z.output<typeof deploymentEnvironmentSchema>;
export type DeploymentEndpoint = z.output<typeof deploymentEndpointSchema>;

export function isLogicalChannel(element: Element) {
  return ["job-queue", "event-stream"].includes(element.planned ?? "");
}
export function isDeployableElement(element: Element) {
  return (
    !isExternalResponsibility(element) &&
    ["Application", "Data store"].includes(containerClassification(element).kind)
  );
}
export function deploymentExternalChoices(design: DesignDocument) {
  return [
    ...design.elements.filter(isExternalResponsibility).map((e) => ({
      value: `element:${e.id}`,
      label: e.name,
      reference: { kind: "element" as const, id: e.id },
    })),
    ...(design.architecture?.nodes ?? [])
      .filter((n) => n.kind === "external-system" && !n.container)
      .map((n) => ({
        value: `context:${n.id}`,
        label: n.name,
        reference: { kind: "context" as const, id: n.id },
      })),
  ];
}
function contextIdentity(design: DesignDocument, id: string, container?: string) {
  if (id === "system") return container ? `element:${container}` : undefined;
  const node = design.architecture?.nodes.find((n) => n.id === id);
  return node?.container ? `element:${node.container}` : `context:${id}`;
}
export function deploymentLogicalEndpoints(
  design: DesignDocument,
  relation: { kind: "connection" | "context"; id: string },
) {
  if (relation.kind === "connection") {
    const c = design.connections.find((c) => c.id === relation.id);
    return c ? [`element:${c.from.element}`, `element:${c.to.element}`] : undefined;
  }
  const c = design.architecture?.relationships.find((c) => c.id === relation.id);
  return c
    ? [contextIdentity(design, c.from, c.container), contextIdentity(design, c.to, c.container)]
    : undefined;
}
function endpointIdentity(
  design: DesignDocument,
  env: DeploymentEnvironment,
  endpoint: DeploymentEndpoint,
) {
  if (endpoint.kind === "instance") {
    const instance = env.instances.find((i) => i.id === endpoint.id);
    return instance ? `element:${instance.element}` : undefined;
  }
  if (endpoint.kind === "node") {
    const node = env.nodes.find((n) => n.id === endpoint.id);
    return node?.legacyElement ? `element:${node.legacyElement}` : undefined;
  }
  const external = env.externals.find((e) => e.id === endpoint.id);
  return external
    ? external.reference.kind === "context"
      ? contextIdentity(design, external.reference.id)
      : `element:${external.reference.id}`
    : undefined;
}
export function validateArchitectureDeployments(design: DesignDocument): Finding[] {
  const findings: Finding[] = [];
  const model = design.architecture;
  const used = new Set([
    "system",
    ...design.elements.flatMap((e) => [e.id, ...e.attachments.map((a) => a.id)]),
    ...design.connections.map((c) => c.id),
    ...design.annotations.map((a) => a.id),
    ...[
      model?.nodes,
      model?.relationships,
      model?.components,
      model?.componentRelationships,
      model?.contracts,
      model?.interfaces,
      model?.bindings,
      model?.datasets,
      model?.objectives,
      model?.scenarios,
      model?.patternInstances,
      model?.reviewRequirements,
      model?.decisions,
    ].flatMap((items) => items?.map((i) => i.id) ?? []),
  ]);
  for (const env of model?.deployments ?? []) {
    const path = ["architecture", "deployments", env.id];
    const error = (
      message: string,
      id = env.id,
      code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE" | "DUPLICATE_ID" = "CONFIG_INVALID",
    ) => findings.push(finding(code, message, { path: [...path, id] }));
    for (const item of [
      env,
      ...env.nodes,
      ...env.instances,
      ...env.externals,
      ...env.interactions,
    ]) {
      if (used.has(item.id))
        error(`Deployment identity ${item.id} is repeated.`, item.id, "DUPLICATE_ID");
      used.add(item.id);
    }
    if (env.instances.reduce((sum, i) => sum + i.replicas, 0) > 200)
      error("An environment supports at most 200 declared instances.");
    const nodes = new Map(env.nodes.map((n) => [n.id, n]));
    for (const node of env.nodes) {
      if (node.parent && nodes.get(node.parent)?.kind !== "deployment")
        error(
          "A parent must be a deployment node in this environment.",
          node.id,
          "UNKNOWN_REFERENCE",
        );
      const seen = new Set<string>([node.id]);
      let parent = node.parent;
      while (parent && nodes.has(parent)) {
        if (seen.has(parent)) {
          error("Deployment nesting must be acyclic.", node.id);
          break;
        }
        seen.add(parent);
        parent = nodes.get(parent)?.parent;
      }
      if (node.legacyElement) {
        const source = design.elements.find((e) => e.id === node.legacyElement);
        if (
          node.kind !== "infrastructure" ||
          !source ||
          isExternalResponsibility(source) ||
          containerClassification(source).kind !== "Deployment infrastructure" ||
          !node.mappingReason
        )
          error(
            "A legacy mapping needs an infrastructure node, an existing C2 infrastructure identity and a review reason.",
            node.id,
          );
        if (env.nodes.some((n) => n.id !== node.id && n.legacyElement === node.legacyElement))
          error("Map each legacy infrastructure element once per environment.", node.id);
      }
    }
    for (const instance of env.instances) {
      const element = design.elements.find((e) => e.id === instance.element);
      if (!element || !isDeployableElement(element))
        error(
          "An instance must reference a logical application or data store; external systems retain their boundary.",
          instance.id,
          "UNKNOWN_REFERENCE",
        );
      if (!nodes.has(instance.node))
        error(
          "An instance needs a placement node in this environment.",
          instance.id,
          "UNKNOWN_REFERENCE",
        );
      if (
        element &&
        isLogicalChannel(element) &&
        (nodes.get(instance.node)?.kind !== "infrastructure" || instance.replicas !== 1)
      )
        error(
          "A named logical channel is placed once on broker infrastructure; replication belongs to the broker declaration.",
          instance.id,
        );
      if (
        element &&
        isLogicalChannel(element) &&
        env.instances.some(
          (other) => other.id !== instance.id && other.element === instance.element,
        )
      )
        error(
          "Place each logical channel once per environment; separate named channels retain separate C2 identities.",
          instance.id,
        );
    }
    const available = deploymentExternalChoices(design);
    for (const external of env.externals) {
      if (
        !available.some(
          (choice) => choice.value === `${external.reference.kind}:${external.reference.id}`,
        )
      )
        error(
          "An external reference must identify an existing external product.",
          external.id,
          "UNKNOWN_REFERENCE",
        );
      if (
        env.externals.some(
          (other) =>
            other.id !== external.id &&
            other.reference.kind === external.reference.kind &&
            other.reference.id === external.reference.id,
        )
      )
        error("An external product appears once per environment.", external.id);
    }
    const exists = (e: DeploymentEndpoint) =>
      e.kind === "node"
        ? nodes.get(e.id)?.kind === "infrastructure"
        : e.kind === "instance"
          ? env.instances.some((i) => i.id === e.id)
          : env.externals.some((x) => x.id === e.id);
    const count = (e: DeploymentEndpoint) =>
      e.kind === "instance" ? (env.instances.find((i) => i.id === e.id)?.replicas ?? 0) : 1;
    if (env.interactions.reduce((sum, i) => sum + count(i.from) * count(i.to), 0) > 2000)
      error("An environment supports at most 2000 projected instance interactions.");
    for (const interaction of env.interactions) {
      if (!exists(interaction.from) || !exists(interaction.to))
        error(
          "An interaction needs existing instances, infrastructure or external endpoints in this environment.",
          interaction.id,
          "UNKNOWN_REFERENCE",
        );
      if (interaction.kind === "logical") {
        const expected = deploymentLogicalEndpoints(design, interaction.relationship);
        if (
          !expected ||
          !expected[0] ||
          !expected[1] ||
          expected[0] !== endpointIdentity(design, env, interaction.from) ||
          expected[1] !== endpointIdentity(design, env, interaction.to)
        )
          error(
            "A deployment interaction must preserve the endpoints and direction of its existing logical relationship.",
            interaction.id,
            "UNKNOWN_REFERENCE",
          );
      } else if (interaction.kind === "replica") {
        const from = env.instances.find((i) => i.id === interaction.from.id);
        const to = env.instances.find((i) => i.id === interaction.to.id);
        const element = design.elements.find((e) => e.id === from?.element);
        if (
          interaction.from.kind !== "instance" ||
          interaction.to.kind !== "instance" ||
          !from ||
          !to ||
          from.id === to.id ||
          from.element !== to.element ||
          !element ||
          isLogicalChannel(element)
        )
          error(
            "Replica communication must connect distinct placements of the same logical application or store. Named channels do not replicate independently of their broker.",
            interaction.id,
          );
      } else if (
        ![interaction.from, interaction.to].some(
          (e) => e.kind === "node" && nodes.get(e.id)?.kind === "infrastructure",
        )
      )
        error(
          "Deployment-only wiring must touch infrastructure; it cannot invent an application relationship.",
          interaction.id,
        );
    }
  }
  return findings;
}

/** Replica expansion is presentation only. Channels and external products keep their identities. */
export function deploymentProjection(
  design: DesignDocument,
  env: DeploymentEnvironment,
): ArchitectureProjection {
  const key = (id: string) => `deployment:${env.id}:${id}`;
  const nodes: ArchitectureViewNode[] = [];
  for (const node of env.nodes.filter((n) => n.kind === "infrastructure"))
    nodes.push({
      id: key(node.id),
      kind: "binding",
      deploymentKind: "Infrastructure",
      name: node.name,
      description: `${node.responsibility || "Infrastructure responsibility undecided"} · ${node.replicas} declared copies`,
      technology: node.technology || "Technology undecided",
      support: "planned",
      acceptance: [],
      parent: env.instances.some((i) => i.node === node.id)
        ? `deployment-group:${env.id}:${node.id}`
        : node.parent
          ? `deployment-group:${env.id}:${node.parent}`
          : undefined,
    });
  for (const instance of env.instances) {
    const element = design.elements.find((e) => e.id === instance.element);
    for (let replica = 1; replica <= instance.replicas; replica++)
      nodes.push({
        id: key(`${instance.id}:${replica}`),
        kind: "container",
        deploymentKind:
          element && isLogicalChannel(element) ? "Logical channel" : "Container instance",
        name: `${element?.name ?? instance.element}${instance.replicas > 1 ? ` · ${replica}/${instance.replicas}` : ""}`,
        description:
          element && isLogicalChannel(element)
            ? `Named channel · ${element?.id}`
            : `Instance of C2 ${instance.element}`,
        technology: element?.technology || "Technology undecided",
        support: "planned",
        acceptance: [],
        binding: { element: instance.element },
        parent: `deployment-group:${env.id}:${instance.node}`,
      });
  }
  // A broker with channels is a boundary as well as an inspectable infrastructure card.
  for (const external of env.externals) {
    const choice = deploymentExternalChoices(design).find(
      (c) => c.value === `${external.reference.kind}:${external.reference.id}`,
    );
    nodes.push({
      id: key(external.id),
      kind: "external-system",
      name: choice?.label ?? external.reference.id,
      description: "External product · outside deployment ownership",
      technology: "",
      support: "external",
      acceptance: [],
    });
  }
  const endpoints = (endpoint: DeploymentEndpoint) =>
    endpoint.kind === "instance"
      ? Array.from(
          { length: env.instances.find((i) => i.id === endpoint.id)?.replicas ?? 0 },
          (_, index) => key(`${endpoint.id}:${index + 1}`),
        )
      : [key(endpoint.id)];
  const edges = env.interactions.flatMap((interaction) => {
    const logical =
      interaction.kind === "logical" && interaction.relationship.kind === "connection"
        ? design.connections.find((c) => c.id === interaction.relationship.id)
        : undefined;
    const presentation = logical ? connectionPresentation(logical, design) : undefined;
    const context =
      interaction.kind === "logical" && interaction.relationship.kind === "context"
        ? design.architecture?.relationships.find((c) => c.id === interaction.relationship.id)
        : undefined;
    return endpoints(interaction.from).flatMap((from) =>
      endpoints(interaction.to).map((to) => ({
        id: `${key(interaction.id)}:${from}:${to}`,
        from,
        to,
        description:
          interaction.kind === "logical"
            ? (presentation?.description ?? context?.description ?? "Logical interaction")
            : interaction.description,
        protocol:
          interaction.kind === "logical"
            ? (presentation?.protocol ?? "Context relationship")
            : `${interaction.protocol} · ${interaction.kind === "replica" ? "replica communication" : "deployment only"}`,
        connection: logical?.id,
        context: context?.id,
        planned: true,
      })),
    );
  });
  return {
    level: "deployment",
    name: env.name,
    description: env.description,
    nodes,
    edges,
    resources: [],
    groups: env.nodes
      .filter((n) => n.kind === "deployment" || env.instances.some((i) => i.node === n.id))
      .map((n) => ({
        id: `deployment-group:${env.id}:${n.id}`,
        name: `${n.name}${[n.region, n.zone].filter(Boolean).length ? ` · ${[n.region, n.zone].filter(Boolean).join(" / ")}` : ""}`,
        parent: n.parent ? `deployment-group:${env.id}:${n.parent}` : undefined,
      })),
  };
}

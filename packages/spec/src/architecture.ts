/** Architectural intent is semantic documentation; only explicit element bindings are executable. */
import { z } from "zod";
import {
  architectureBindingSchema,
  architectureDatasetSchema,
  architectureObjectiveSchema,
  validateRelationshipBindings,
} from "./architecture-bindings.ts";
import { isExternalResponsibility, systemChoicesSchema } from "./architecture-choices.ts";
import {
  architectureContractSchema,
  architectureInterfaceSchema,
  validateArchitectureContracts,
} from "./architecture-contracts.ts";
import {
  deploymentEnvironmentSchema,
  validateArchitectureDeployments,
} from "./architecture-deployments.ts";
import { handoffScopeSchema } from "./architecture-handoff-model.ts";
import { patternInstanceSchema } from "./architecture-pattern-provenance.ts";
import {
  architectureDecisionSchema,
  reviewRequirementSchema,
  validateArchitectureReview,
} from "./architecture-review-model.ts";
import { validateBackendData } from "./backend-data.ts";
import { validateBackendImplementations } from "./backend-implementations.ts";
import { backendModelSchema } from "./backend-model.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";
import type { TemplateLookup } from "./manifest.ts";
import {
  componentCompatible,
  componentHostRole,
  plannedCapability,
  plannedConfigSchema,
} from "./planned-capabilities.ts";
import {
  relationshipInteractionSchema,
  relationshipProtocolSchema,
} from "./relationship-display.ts";
import { resourceConfigSchema } from "./resources.ts";
import { architectureScenarioSchema, validateScenarios } from "./scenarios.ts";

const description = z.string().trim().max(1200).default("");
/** Historical suggestion inputs survive edits; they are provenance, not live ownership links. */
export const annotationOriginSchema = z.strictObject({
  revision: z.int().nonnegative(),
  basis: z.string().max(1200),
  bindings: z
    .array(
      z.strictObject({
        element: idSchema,
        attachment: idSchema,
        kind: z.enum(["accounts", "resource", "extension"]),
        ref: idSchema.optional(),
      }),
    )
    .max(100),
});
export const architectureNodeSchema = z.strictObject({
  id: idSchema.refine((id) => id !== "system", "The system identity is reserved"),
  kind: z.enum(["person", "external-system"]),
  annotationOrigin: annotationOriginSchema.optional(),
  name: z.string().trim().min(1).max(120),
  description,
  /** Reuse one planned external block at C2; C1 retains the technology-free context identity. */
  container: idSchema.optional(),
});
export const contextRelationshipSchema = z.strictObject({
  id: idSchema,
  from: idSchema,
  to: idSchema,
  description: z.string().trim().min(1).max(240),
  /** The executable element at the system end. Context edges never generate network wiring. */
  container: idSchema.optional(),
});
export const architectureMemberSchema = z.strictObject({
  attachment: idSchema,
  kind: z.enum(["accounts", "resource", "extension"]),
  ref: idSchema.optional(),
});
export const architectureComponentSchema = z.strictObject({
  id: idSchema,
  element: idSchema,
  name: z.string().trim().min(1).max(120),
  responsibility: z.string().trim().max(240).default(""),
  annotationOrigin: annotationOriginSchema.optional(),
  technology: z.string().trim().max(120).optional(),
  capability: idSchema.optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  members: z.array(architectureMemberSchema).max(100).default([]),
  usesResources: z
    .array(z.strictObject({ attachment: idSchema, resource: idSchema }))
    .max(100)
    .default([]),
  usesConnections: z.array(idSchema).max(100).default([]),
});
export type ArchitectureComponent = z.output<typeof architectureComponentSchema>;
export type ArchitectureMember = z.output<typeof architectureMemberSchema>;
export const architectureSchema = z.strictObject({
  backend: backendModelSchema.optional(),
  implementationHandoff: handoffScopeSchema.optional(),
  system: z.strictObject({
    name: z.string().trim().min(1).max(120),
    description,
    ...systemChoicesSchema.shape,
  }),
  nodes: z.array(architectureNodeSchema).max(50).default([]),
  relationships: z.array(contextRelationshipSchema).max(100).default([]),
  components: z.array(architectureComponentSchema).max(200).optional(),
  scenarios: z.array(architectureScenarioSchema).max(50).optional(),
  contracts: z.array(architectureContractSchema).max(200).optional(),
  interfaces: z.array(architectureInterfaceSchema).max(500).optional(),
  bindings: z.array(architectureBindingSchema).max(500).optional(),
  datasets: z.array(architectureDatasetSchema).max(200).optional(),
  objectives: z.array(architectureObjectiveSchema).max(200).optional(),
  patternInstances: z.array(patternInstanceSchema).max(100).optional(),
  reviewRequirements: z.array(reviewRequirementSchema).max(200).optional(),
  decisions: z.array(architectureDecisionSchema).max(200).optional(),
  deployments: z.array(deploymentEnvironmentSchema).max(12).optional(),
  componentRelationships: z
    .array(
      z.strictObject({
        id: idSchema,
        from: idSchema,
        to: idSchema,
        description: z.string().trim().min(1).max(240),
        protocol: relationshipProtocolSchema.optional(),
        interaction: relationshipInteractionSchema.optional(),
      }),
    )
    .max(300)
    .optional(),
});
export type Architecture = z.output<typeof architectureSchema>;
export type ArchitectureInput = z.input<typeof architectureSchema>;

/** Shares structural findings with the design; context-only objects do not need templates. */
export function validateArchitecture(design: DesignDocument, lookup?: TemplateLookup): Finding[] {
  const model = design.architecture;
  if (!model) return [];
  const findings: Finding[] = [];
  const nodes = new Set(["system"]);
  const ids = new Set(["system"]);
  for (const node of model.nodes) {
    if (nodes.has(node.id))
      findings.push(
        finding("DUPLICATE_ID", `Architecture node ${node.id} is repeated.`, {
          path: ["architecture", "nodes"],
        }),
      );
    if (node.container) {
      const element = design.elements.find((item) => item.id === node.container);
      if (node.kind !== "external-system" || !element || !isExternalResponsibility(element))
        findings.push(
          finding(
            "CONFIG_INVALID",
            "A context provider must bind to an existing external responsibility.",
            { path: ["architecture", "nodes", node.id] },
          ),
        );
      if (model.nodes.some((other) => other.id !== node.id && other.container === node.container))
        findings.push(
          finding("CONFIG_INVALID", "An external block can bind to only one context provider.", {
            path: ["architecture", "nodes", node.id],
          }),
        );
    }
    nodes.add(node.id);
    ids.add(node.id);
  }
  for (const relation of model.relationships) {
    const target = { path: ["architecture", "relationships", relation.id] };
    if (ids.has(relation.id))
      findings.push(
        finding("DUPLICATE_ID", `Architecture identity ${relation.id} is repeated.`, target),
      );
    ids.add(relation.id);
    for (const endpoint of [relation.from, relation.to])
      if (!nodes.has(endpoint))
        findings.push(
          finding(
            "UNKNOWN_REFERENCE",
            `Architecture relationship ${relation.id} refers to missing context node ${endpoint}.`,
            target,
          ),
        );
    if (relation.from === relation.to)
      findings.push(
        finding(
          "CONFIG_INVALID",
          `Architecture relationship ${relation.id} cannot connect a context object to itself.`,
          target,
        ),
      );
    const touchesSystem = relation.from === "system" || relation.to === "system";
    if (relation.container) {
      if (!touchesSystem)
        findings.push(
          finding(
            "CONFIG_INVALID",
            `Only relationships with the system can bind to a container (${relation.id}).`,
            target,
          ),
        );
      if (!design.elements.some((element) => element.id === relation.container))
        findings.push(
          finding(
            "UNKNOWN_REFERENCE",
            `Architecture relationship ${relation.id} refers to missing container ${relation.container}.`,
            target,
          ),
        );
    }
    if (touchesSystem && !relation.container)
      findings.push(
        finding(
          "ARCHITECTURE_UNBOUND",
          `Context relationship “${relation.description}” has no container binding. It describes intent only.`,
          target,
        ),
      );
  }
  for (const instance of model.patternInstances ?? []) {
    if (
      ids.has(instance.id) ||
      design.elements.some(
        (item) => item.id === instance.id || item.attachments.some((a) => a.id === instance.id),
      ) ||
      design.connections.some((item) => item.id === instance.id) ||
      design.annotations.some((item) => item.id === instance.id)
    )
      findings.push(
        finding("DUPLICATE_ID", `Pattern identity ${instance.id} is repeated.`, {
          path: ["architecture", "patternInstances", instance.id],
        }),
      );
    ids.add(instance.id);
  }
  const memberships = new Set<string>();
  for (const component of model.components ?? []) {
    const target = {
      element: component.element,
      path: ["architecture", "components", component.id],
    };
    if (ids.has(component.id))
      findings.push(
        finding("DUPLICATE_ID", `Component identity ${component.id} is repeated.`, target),
      );
    ids.add(component.id);
    const owner = design.elements.find((element) => element.id === component.element);
    const missing = (message: string) =>
      findings.push(finding("ARCHITECTURE_UNBOUND", `${component.name}: ${message}`, target));
    if (!owner) missing(`missing application ${component.element}.`);
    if (component.capability) {
      findings.push(
        finding(
          "NEEDS_TEMPLATE",
          `${component.name} has planned component options; runtime generation comes later.`,
          target,
        ),
      );
      const capability = plannedCapability(component.capability);
      if (!capability || capability.scope !== "component")
        findings.push(finding("CONFIG_INVALID", "Select a component capability.", target));
      else if (
        owner &&
        (owner.planned || lookup) &&
        !componentCompatible(capability, componentHostRole(owner, lookup))
      )
        findings.push(
          finding(
            "CONFIG_INVALID",
            "Select a component compatible with this application's role.",
            target,
          ),
        );
      else if (!plannedConfigSchema(capability.id).safeParse(component.config).success)
        findings.push(finding("CONFIG_INVALID", "Invalid planned component options.", target));
    }
    for (const member of component.members) {
      const key = `${component.element}:${member.attachment}:${member.kind}:${member.ref ?? ""}`;
      if (memberships.has(key))
        findings.push(
          finding(
            "CONFIG_INVALID",
            "A capability can belong to only one primary component.",
            target,
          ),
        );
      memberships.add(key);
      if (!resolveArchitectureMember(design, component.element, member))
        missing(`missing ${member.kind} binding ${member.attachment}/${member.ref ?? "accounts"}.`);
    }
    for (const use of component.usesResources) {
      if (
        !resolveArchitectureMember(design, component.element, {
          attachment: use.attachment,
          kind: "resource",
          ref: use.resource,
        })
      )
        missing(`missing resource ${use.attachment}/${use.resource}.`);
    }
    for (const connection of component.usesConnections) {
      const link = design.connections.find((item) => item.id === connection);
      if (
        !link ||
        (link.from.element !== component.element && link.to.element !== component.element)
      )
        missing(`missing connected dependency ${connection}.`);
    }
  }
  for (const relation of model.componentRelationships ?? []) {
    const from = model.components?.find((item) => item.id === relation.from);
    const to = model.components?.find((item) => item.id === relation.to);
    const target = { path: ["architecture", "componentRelationships", relation.id] };
    if (ids.has(relation.id))
      findings.push(
        finding("DUPLICATE_ID", `Architecture identity ${relation.id} is repeated.`, target),
      );
    ids.add(relation.id);
    if (!from || !to || from.id === to.id || from.element !== to.element)
      findings.push(
        finding(
          "CONFIG_INVALID",
          "A component relationship needs two different components in the same application.",
          target,
        ),
      );
  }
  for (const scenario of model.scenarios ?? []) {
    const path = ["architecture", "scenarios", scenario.id];
    if (ids.has(scenario.id))
      findings.push(
        finding("DUPLICATE_ID", `Scenario identity ${scenario.id} is repeated.`, { path }),
      );
    ids.add(scenario.id);
  }
  return [
    ...findings,
    ...validateScenarios(design),
    ...validateArchitectureContracts(design),
    ...validateRelationshipBindings(design),
    ...validateArchitectureReview(design),
    ...validateArchitectureDeployments(design),
    ...validateBackendData(design),
    ...validateBackendImplementations(design),
  ];
}

export function resolveArchitectureMember(
  design: DesignDocument,
  element: string,
  member: ArchitectureMember,
) {
  const attachment = design.elements
    .find((item) => item.id === element)
    ?.attachments.find(
      (item) => item.id === member.attachment && item.template.id === "rest-api-server",
    );
  if (!attachment) return undefined;
  const model = resourceConfigSchema.safeParse(attachment.config.model);
  if (!model.success) return undefined;
  if (member.kind === "accounts")
    return attachment.config.auth === "session" && !member.ref
      ? { attachment, model: model.data }
      : undefined;
  if (member.kind === "resource") {
    const resource = model.data.resources.find((item) => item.id === member.ref);
    return resource ? { attachment, model: model.data, resource } : undefined;
  }
  const extension = model.data.extensions.find((item) => item.id === member.ref);
  return extension ? { attachment, model: model.data, extension } : undefined;
}

/** Preserve relationship intent when its implementation is removed; make the lost binding visible. */
export function unbindArchitecture(design: DesignDocument, element: string): void {
  for (const relationship of design.architecture?.relationships ?? [])
    if (relationship.container === element) delete relationship.container;
  for (const node of design.architecture?.nodes ?? [])
    if (node.container === element) delete node.container;
}

/** Reuse explicitly bound providers and their existing connections; never infer new wiring. */
export function containerContext(design: DesignDocument) {
  const nodes = design.architecture?.nodes ?? [];
  const endpoint = (id: string) => {
    const binding = nodes.find((node) => node.id === id)?.container;
    return binding && design.elements.some((element) => element.id === binding)
      ? binding
      : `context:${id}`;
  };
  const relationships = (design.architecture?.relationships ?? []).flatMap((relation) => {
    if (relation.from !== "system" && relation.to !== "system") return [];
    const systemEnd = relation.container ?? "context:system";
    const from = relation.from === "system" ? systemEnd : endpoint(relation.from);
    const to = relation.to === "system" ? systemEnd : endpoint(relation.to);
    if (
      design.connections.some(
        (connection) => connection.from.element === from && connection.to.element === to,
      )
    )
      return [];
    const host = design.elements.find((element) => element.id === systemEnd);
    const protocol =
      host &&
      (plannedCapability(host.planned)?.role === "frontend" ||
        host.planned === "application-api" ||
        host.template?.id === "http-service" ||
        host.template?.id === "web-app")
        ? "HTTPS"
        : "Undecided";
    return [{ ...relation, source: from, target: to, protocol }];
  });
  const participants = new Set(
    relationships.flatMap((relation) => [relation.source, relation.target]),
  );
  return { nodes: nodes.filter((node) => participants.has(`context:${node.id}`)), relationships };
}

/** Authored C3 dependencies share stable container wiring with the scenario validator. */
export function componentConnections(design: DesignDocument, definition: ArchitectureComponent) {
  const uses = new Map<string, { declared: boolean; resources: string[] }>();
  for (const member of definition.members) {
    if (member.kind === "extension") continue;
    const binding = resolveArchitectureMember(design, definition.element, member);
    if (binding?.model.storeConnection)
      uses.set(binding.model.storeConnection, { declared: false, resources: [] });
  }
  for (const id of definition.usesConnections) uses.set(id, { declared: true, resources: [] });
  for (const binding of design.architecture?.bindings ?? []) {
    if (binding.relationship.kind !== "connection") continue;
    if (
      design.architecture?.interfaces?.some(
        (item) =>
          (item.id === binding.provided || item.id === binding.required) &&
          item.owner.kind === "component" &&
          item.owner.id === definition.id,
      )
    )
      uses.set(binding.relationship.id, { declared: true, resources: [] });
  }
  for (const resource of definition.usesResources) {
    const binding = resolveArchitectureMember(design, definition.element, {
      attachment: resource.attachment,
      kind: "resource",
      ref: resource.resource,
    });
    if (binding?.model.storeConnection) {
      const id = binding.model.storeConnection;
      const use = uses.get(id) ?? { declared: true, resources: [] };
      const name = binding.model.resources.find((item) => item.id === resource.resource)?.name;
      if (name) use.resources.push(name);
      uses.set(id, use);
    }
  }
  return uses;
}

/** Architectural intent is semantic documentation; only explicit element bindings are executable. */
import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";
import { plannedCapability, plannedConfigSchema } from "./planned-capabilities.ts";
import {
  relationshipInteractionSchema,
  relationshipProtocolSchema,
} from "./relationship-display.ts";
import { resourceConfigSchema } from "./resources.ts";

const description = z.string().trim().max(1200).default("");
export const architectureNodeSchema = z.strictObject({
  id: idSchema.refine((id) => id !== "system", "The system identity is reserved"),
  kind: z.enum(["person", "external-system"]),
  name: z.string().trim().min(1).max(120),
  description,
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
  system: z.strictObject({ name: z.string().trim().min(1).max(120), description }),
  nodes: z.array(architectureNodeSchema).max(50).default([]),
  relationships: z.array(contextRelationshipSchema).max(100).default([]),
  components: z.array(architectureComponentSchema).max(200).optional(),
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
export function validateArchitecture(design: DesignDocument): Finding[] {
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
  return findings;
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
}

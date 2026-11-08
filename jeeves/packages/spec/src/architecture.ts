/** C1 context and the studio model. Context relationships are documentation, never wiring. */
import { z } from "zod";
import { isExternalResponsibility, systemChoicesSchema } from "./architecture-choices.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";
import { studioModelSchema } from "./studio-model.ts";
import { validateStudio } from "./studio-validation.ts";

const description = z.string().trim().max(1200).default("");
export const architectureNodeSchema = z.strictObject({
  id: idSchema.refine((id) => id !== "system", "The system identity is reserved"),
  kind: z.enum(["person", "external-system"]),
  name: z.string().trim().min(1).max(120),
  description,
  /** Reuse one external C2 box at C1; C1 keeps its technology-free context identity. */
  container: idSchema.optional(),
});
export const contextRelationshipSchema = z.strictObject({
  id: idSchema,
  from: idSchema,
  to: idSchema,
  description: z.string().trim().min(1).max(240),
  /** The C2 element at the system end. */
  container: idSchema.optional(),
});
export const architectureSchema = z.strictObject({
  studio: studioModelSchema.optional(),
  system: z.strictObject({
    name: z.string().trim().min(1).max(120),
    description,
    ...systemChoicesSchema.shape,
  }),
  nodes: z.array(architectureNodeSchema).max(50).default([]),
  relationships: z.array(contextRelationshipSchema).max(100).default([]),
});
export type Architecture = z.output<typeof architectureSchema>;
export type ArchitectureInput = z.input<typeof architectureSchema>;

/** C1 context checks plus the studio model's own validation. */
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
  return [...findings, ...validateStudio(design)];
}

/** Keep relationship intent when its container is removed; the lost binding becomes visible. */
export function unbindArchitecture(design: DesignDocument, element: string): void {
  for (const relationship of design.architecture?.relationships ?? [])
    if (relationship.container === element) delete relationship.container;
  for (const node of design.architecture?.nodes ?? [])
    if (node.container === element) delete node.container;
}

/** C1 relationships with the system, drawn at C2 between their bound containers. */
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
    return [{ ...relation, source: from, target: to, protocol: "Undecided" }];
  });
  const participants = new Set(
    relationships.flatMap((relation) => [relation.source, relation.target]),
  );
  return { nodes: nodes.filter((node) => participants.has(`context:${node.id}`)), relationships };
}

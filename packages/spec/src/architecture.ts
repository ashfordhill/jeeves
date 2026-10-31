/** Architectural intent is semantic documentation; only explicit element bindings are executable. */
import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";

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
export const architectureSchema = z.strictObject({
  system: z.strictObject({ name: z.string().trim().min(1).max(120), description }),
  nodes: z.array(architectureNodeSchema).max(50).default([]),
  relationships: z.array(contextRelationshipSchema).max(100).default([]),
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
  return findings;
}

/** Preserve relationship intent when its implementation is removed; make the lost binding visible. */
export function unbindArchitecture(design: DesignDocument, element: string): void {
  for (const relationship of design.architecture?.relationships ?? [])
    if (relationship.container === element) delete relationship.container;
}

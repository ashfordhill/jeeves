/** Review intent and decisions are semantic metadata, never executable policy or evidence. */
import { z } from "zod";
import {
  ownerExists,
  relationshipPoliciesSchema,
  tenantScopeSchema,
} from "./architecture-bindings.ts";
import { contractKey, contractOwnerSchema } from "./architecture-contracts.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";

const base = { id: idSchema, name: z.string().trim().min(1).max(120) };
export const reviewRequirementSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...base,
    kind: z.literal("access"),
    binding: idSchema,
    identity: relationshipPoliciesSchema.shape.access.unwrap().shape.identity,
    tenant: tenantScopeSchema,
  }),
  z.strictObject({
    ...base,
    kind: z.literal("cache"),
    binding: idSchema,
    fallback: idSchema.optional(),
    update: idSchema.optional(),
  }),
  z.strictObject({
    ...base,
    kind: z.literal("delivery"),
    channel: idSchema.optional(),
    trigger: z.enum(["Unknown", "Channel", "Schedule", "Request"]),
    responsible: contractOwnerSchema.optional(),
    binding: idSchema.optional(),
  }),
  z.strictObject({
    ...base,
    kind: z.literal("failure"),
    binding: idSchema,
    outcome: relationshipPoliciesSchema.shape.failure.unwrap().shape.outcome,
  }),
]);
export const reviewReferenceSchema = z.strictObject({
  kind: z.enum([
    "system",
    "element",
    "package",
    "component",
    "external-system",
    "connection",
    "component-relationship",
    "interface",
    "contract",
    "binding",
    "dataset",
    "objective",
    "requirement",
  ]),
  id: z.string().min(1).max(160),
});
export const architectureDecisionSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  context: z.string().trim().min(1).max(1200),
  decision: z.string().trim().min(1).max(1200),
  consequence: z.string().trim().min(1).max(1200),
  status: z.enum(["Unresolved", "Accepted", "Superseded"]),
  links: z.array(reviewReferenceSchema).max(100),
  acknowledgements: z
    .array(
      z.strictObject({
        finding: z.string().min(1).max(160),
        fingerprint: z.string().min(1).max(160),
      }),
    )
    .max(100),
});
export type ReviewRequirement = z.output<typeof reviewRequirementSchema>;
export type ReviewReference = z.output<typeof reviewReferenceSchema>;
export type ArchitectureDecision = z.output<typeof architectureDecisionSchema>;

/** Shared identity list for validation and mouse/chat linking. Contract keys include version. */
export function architectureReviewReferences(
  design: DesignDocument,
): (ReviewReference & { name: string })[] {
  const m = design.architecture;
  const group = (
    kind: ReviewReference["kind"],
    items: { id: string; name?: string; description?: string }[] | undefined,
  ) =>
    (items ?? []).map((item) => ({
      kind,
      id: item.id,
      name: item.name ?? item.description ?? item.id,
    }));
  return [
    { kind: "system", id: "system", name: m?.system.name ?? "System" },
    ...group("element", design.elements),
    ...group("package", m?.studio?.packages),
    ...group("connection", design.connections),
    ...group("component", m?.components),
    ...group("component-relationship", m?.componentRelationships),
    ...group(
      "external-system",
      m?.nodes.filter((n) => n.kind === "external-system"),
    ),
    ...group("interface", m?.interfaces),
    ...group("binding", m?.bindings),
    ...group("dataset", m?.datasets),
    ...group("objective", m?.objectives),
    ...group("requirement", m?.reviewRequirements),
    ...(m?.contracts ?? []).map((c) => ({
      kind: "contract" as const,
      id: contractKey(c),
      name: `${c.name} ${c.version}`,
    })),
  ];
}
export function validateArchitectureReview(design: DesignDocument): Finding[] {
  const m = design.architecture;
  if (!m) return [];
  const ids = new Set([
    ...architectureReviewReferences(design)
      .filter((r) => r.kind !== "requirement")
      .map((r) => r.id),
    ...design.elements.flatMap((e) => e.attachments.map((a) => a.id)),
    ...design.annotations.map((a) => a.id),
    ...m.nodes.map((n) => n.id),
    ...(m.relationships ?? []).map((r) => r.id),
    ...(m.scenarios ?? []).map((s) => s.id),
    ...(m.patternInstances ?? []).map((p) => p.id),
    ...(m.contracts ?? []).map((c) => c.id),
  ]);
  const result: Finding[] = [];
  for (const [group, items] of [
    ["reviewRequirements", m.reviewRequirements],
    ["decisions", m.decisions],
  ] as const)
    for (const item of items ?? []) {
      const target = { path: ["architecture", group, item.id] };
      if (ids.has(item.id))
        result.push(finding("DUPLICATE_ID", `Review identity ${item.id} is already used.`, target));
      ids.add(item.id);
      const invalid = (message: string) =>
        result.push(finding("UNKNOWN_REFERENCE", `${item.name}: ${message}`, target));
      if ("links" in item) {
        const references = architectureReviewReferences(design);
        for (const link of item.links)
          if (
            !references.some((r) => r.kind === link.kind && r.id === link.id) &&
            !(m.studio && item.id.startsWith("studio-c4b-") && item.status === "Unresolved")
          )
            invalid(`linked ${link.kind} ${link.id} was removed; update the decision first.`);
      } else {
        for (const key of ["binding", "fallback", "update"] as const)
          if (key in item) {
            const id = (item as Record<string, unknown>)[key];
            if (id && !m.bindings?.some((b) => b.id === id))
              invalid(`${key} must reference an existing binding.`);
          }
        if (item.kind === "delivery") {
          if (item.channel && !design.elements.some((e) => e.id === item.channel))
            invalid("channel must reference an existing element.");
          if (item.responsible && !ownerExists(design, item.responsible))
            invalid("delivery responsibility was removed.");
        }
      }
    }
  return result;
}

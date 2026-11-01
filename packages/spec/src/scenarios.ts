/** Dynamic scenarios describe order over authored wiring; they never create a relationship. */
import { z } from "zod";
import { componentConnections } from "./architecture.ts";
import { contractCanonical, contractKey, resolveContractSource } from "./architecture-contracts.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";
import { connectionPresentation } from "./relationship-display.ts";

export const scenarioScopeSchema = z.discriminatedUnion("level", [
  z.strictObject({ level: z.literal("containers") }),
  z.strictObject({ level: z.literal("components"), container: idSchema }),
]);
export const scenarioRelationshipSchema = z.strictObject({
  kind: z.enum(["connection", "componentRelationship", "contextRelationship"]),
  id: idSchema,
});
export const scenarioStepSchema = z.strictObject({
  id: idSchema,
  relationship: scenarioRelationshipSchema,
  text: z.string().trim().min(1).max(240),
  binding: idSchema.optional(),
  phase: z.enum(["request", "response", "continuation"]).optional(),
  client: z
    .strictObject({
      component: idSchema,
      state: z.enum(["loading", "success", "denied", "failed"]),
    })
    .optional(),
});
const outcomeRefs = z.array(idSchema).max(30);
export const architectureScenarioSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  scope: scenarioScopeSchema,
  steps: z.array(scenarioStepSchema).min(1).max(50),
  actor: idSchema.optional(),
  startCondition: z.string().trim().min(1).max(1200).optional(),
  mainOutcomes: outcomeRefs.optional(),
  outcomes: z
    .array(
      z.strictObject({
        id: idSchema,
        text: z.string().trim().min(1).max(1200),
        invariants: z.array(z.string().trim().min(1).max(240)).max(20),
        requirements: z.array(idSchema).max(30),
        decisions: z.array(idSchema).max(30),
      }),
    )
    .max(30)
    .optional(),
  alternatives: z
    .array(
      z.strictObject({
        id: idSchema,
        name: z.string().trim().min(1).max(120),
        kind: z.enum(["alternative", "failure"]),
        condition: z.string().trim().min(1).max(1200),
        afterStep: idSchema,
        steps: z.array(scenarioStepSchema).min(1).max(50),
        outcomes: outcomeRefs,
      }),
    )
    .max(12)
    .optional(),
  /** An authored review of expectations; never a test or verification result. */
  review: z.strictObject({ fingerprint: z.string().min(1).max(160) }).optional(),
});
export type ArchitectureScenario = z.output<typeof architectureScenarioSchema>;
export type ScenarioStep = z.output<typeof scenarioStepSchema>;
export type ScenarioScope = ArchitectureScenario["scope"];
export type ScenarioRelationship = z.output<typeof scenarioRelationshipSchema>;

export function sameScenarioScope(a: ScenarioScope, b: ScenarioScope): boolean {
  return (
    a.level === b.level &&
    (a.level === "containers" || (b.level === "components" && a.container === b.container))
  );
}

/** Only authored C3 dependencies are offered; hidden technical projections are not scenario wiring. */
export function scenarioRelationships(design: DesignDocument, scope: ScenarioScope) {
  const components = design.architecture?.components ?? [];
  const local =
    scope.level === "components"
      ? components.filter((component) => component.element === scope.container)
      : [];
  const localConnections = new Set(
    local.flatMap((component) => [...componentConnections(design, component).keys()]),
  );
  const connections = design.connections.filter(
    (connection) =>
      scope.level === "containers" ||
      ((connection.from.element === scope.container || connection.to.element === scope.container) &&
        localConnections.has(connection.id)),
  );
  return [
    ...connections.map((connection) => ({
      relationship: { kind: "connection" as const, id: connection.id },
      label: `${design.elements.find((item) => item.id === connection.from.element)?.name} → ${design.elements.find((item) => item.id === connection.to.element)?.name}: ${connectionPresentation(connection, design).description}`,
    })),
    ...(scope.level === "components"
      ? (design.architecture?.componentRelationships ?? [])
          .filter(
            (relationship) =>
              local.some((component) => component.id === relationship.from) &&
              local.some((component) => component.id === relationship.to),
          )
          .map((relationship) => ({
            relationship: { kind: "componentRelationship" as const, id: relationship.id },
            label: `${components.find((item) => item.id === relationship.from)?.name} → ${components.find((item) => item.id === relationship.to)?.name}: ${relationship.description}`,
          }))
      : []),
    ...(design.architecture?.relationships ?? [])
      .filter(
        (r) =>
          (r.from === "system" || r.to === "system") &&
          (scope.level === "containers" || r.container === scope.container),
      )
      .map((r) => ({
        relationship: { kind: "contextRelationship" as const, id: r.id },
        label: `Context: ${r.description}`,
      })),
  ];
}

export function sameScenarioRelationship(a: ScenarioRelationship, b: ScenarioRelationship) {
  return a.kind === b.kind && a.id === b.id;
}

export function scenarioPaths(scenario: ArchitectureScenario): {
  id: string;
  name: string;
  steps: ScenarioStep[];
  outcomes: string[];
  condition?: string;
  kind?: "alternative" | "failure";
  afterStep?: string;
}[] {
  return [
    { id: "main", name: "Main path", steps: scenario.steps, outcomes: scenario.mainOutcomes ?? [] },
    ...(scenario.alternatives ?? []),
  ];
}

/** Structural errors protect references in every path. Incomplete expectations stay saveable. */
export function validateScenarios(design: DesignDocument): Finding[] {
  const m = design.architecture;
  if (!m) return [];
  const errors: Finding[] = [];
  for (const s of m.scenarios ?? []) {
    const path = ["architecture", "scenarios", s.id];
    const invalid = (message: string) =>
      errors.push(finding("UNKNOWN_REFERENCE", `${s.name}: ${message}`, { path }));
    const ids = new Set<string>();
    const unique = (id: string) => {
      if (ids.has(id))
        errors.push(
          finding("DUPLICATE_ID", `Scenario-local identity ${id} is repeated.`, { path }),
        );
      ids.add(id);
    };
    if (s.actor && !m.nodes.some((n) => n.id === s.actor))
      invalid("select an existing context actor.");
    if (
      s.scope.level === "components" &&
      !design.elements.some((e) => e.id === (s.scope as { container: string }).container)
    )
      invalid("the component scope application is missing.");
    const available = scenarioRelationships(design, s.scope);
    for (const p of scenarioPaths(s)) {
      if (p.afterStep !== undefined) {
        if (p.id === "main")
          errors.push(
            finding("DUPLICATE_ID", "The main path identity is reserved for path selection.", {
              path,
            }),
          );
        unique(p.id);
      }
      if (p.afterStep !== undefined && !s.steps.some((step) => step.id === p.afterStep))
        invalid("an alternative must branch after an existing main-path step.");
      if (new Set(p.outcomes).size !== p.outcomes.length)
        invalid("outcome references must be unique within a path.");
      for (const id of p.outcomes)
        if (!s.outcomes?.some((o) => o.id === id)) invalid(`missing outcome ${id}.`);
      for (const step of p.steps) {
        unique(step.id);
        if (!available.some((r) => sameScenarioRelationship(r.relationship, step.relationship)))
          invalid(
            `step ${step.id} needs an existing relationship in its scope. Remove or update this step before removing its relationship.`,
          );
        const binding = m.bindings?.find((b) => b.id === step.binding);
        if (
          step.binding &&
          (!binding ||
            binding.relationship.id !== step.relationship.id ||
            binding.relationship.kind !==
              (step.relationship.kind === "componentRelationship"
                ? "component-relationship"
                : step.relationship.kind))
        )
          invalid(`step ${step.id} needs a binding on its exact relationship.`);
        if (step.client) {
          const component = m.components?.find((c) => c.id === step.client!.component);
          const owners = [binding?.provided, binding?.required].map(
            (id) => m.interfaces?.find((i) => i.id === id)?.owner,
          );
          if (
            !component ||
            component.capability !== "screen-group" ||
            !binding ||
            !owners.some((owner) => owner?.kind === "component" && owner.id === component.id) ||
            (s.scope.level === "components" && component.element !== s.scope.container)
          )
            invalid(
              `step ${step.id} needs a client feature area coupled through its binding interface in this scope.`,
            );
          const contract = m.contracts?.find(
            (c) => binding && contractKey(c) === contractKey(binding.contract),
          );
          if (
            contract &&
            (contract.kind === "api" || contract.kind === "in-process") &&
            !binding?.operation &&
            contract.source?.kind !== "rest-operation"
          )
            invalid(`step ${step.id} must identify the bound client operation.`);
        }
      }
    }
    for (const o of s.outcomes ?? []) {
      unique(o.id);
      for (const [refs, choices] of [
        [o.requirements, m.reviewRequirements],
        [o.decisions, m.decisions],
      ] as const) {
        if (new Set(refs).size !== refs.length) invalid("outcome links must be unique.");
        for (const id of refs)
          if (!choices?.some((v) => v.id === id))
            invalid(`outcome ${o.id} has a missing requirement/decision ${id}.`);
      }
    }
  }
  return errors;
}

/** Relevant semantic inputs only. Unrelated revisions and layouts do not expire review. */
export function scenarioReview(design: DesignDocument, scenario: ArchitectureScenario) {
  const m = design.architecture;
  const { review: _review, ...intent } = scenario;
  const bindings = new Set<string>();
  const relationships: unknown[] = [];
  const clients = new Set<string>();
  for (const p of scenarioPaths(scenario))
    for (const step of p.steps) {
      const r = step.relationship;
      relationships.push(
        (r.kind === "connection"
          ? design.connections
          : r.kind === "componentRelationship"
            ? m?.componentRelationships
            : m?.relationships
        )?.find((v) => v.id === r.id),
      );
      if (step.binding) bindings.add(step.binding);
      else
        for (const b of m?.bindings ?? [])
          if (
            b.relationship.id === r.id &&
            b.relationship.kind ===
              (r.kind === "componentRelationship" ? "component-relationship" : r.kind)
          )
            bindings.add(b.id);
      if (step.client) clients.add(step.client.component);
    }
  const requirements = [...new Set(scenario.outcomes?.flatMap((o) => o.requirements))]
    .sort()
    .map((id) => m?.reviewRequirements?.find((r) => r.id === id));
  const decisions = [...new Set(scenario.outcomes?.flatMap((o) => o.decisions))]
    .sort()
    .map((id) => m?.decisions?.find((r) => r.id === id));
  for (const r of requirements) {
    if (!r) continue;
    if (r.binding) bindings.add(r.binding);
    if (r.kind === "cache") for (const id of [r.fallback, r.update]) if (id) bindings.add(id);
  }
  for (const d of decisions)
    for (const link of d?.links ?? []) if (link.kind === "binding") bindings.add(link.id);
  const selected = [...bindings].sort().map((id) => m?.bindings?.find((b) => b.id === id));
  const interfaces = [...new Set(selected.flatMap((b) => (b ? [b.provided, b.required] : [])))]
    .sort()
    .map((id) => m?.interfaces?.find((i) => i.id === id));
  const contracts = [
    ...new Set([
      ...selected.flatMap((b) => (b ? [contractKey(b.contract)] : [])),
      ...decisions.flatMap(
        (d) => d?.links.filter((r) => r.kind === "contract").map((r) => r.id) ?? [],
      ),
    ]),
  ]
    .sort()
    .map((key) => {
      const c = m?.contracts?.find((c) => contractKey(c) === key);
      return {
        contract: c,
        source: c?.source ? resolveContractSource(design, c.source) : undefined,
      };
    });
  const canonical = contractCanonical({
    intent,
    actor: m?.nodes.find((n) => n.id === scenario.actor),
    relationships,
    bindings: selected,
    interfaces,
    contracts,
    requirements,
    decisions,
    clients: [...clients].sort().map((id) => m?.components?.find((c) => c.id === id)),
  });
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < canonical.length; i++) {
    a = Math.imul(a ^ canonical.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ canonical.charCodeAt(i);
  }
  const fingerprint = `scenario-v1-${canonical.length.toString(16)}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
  const incomplete: string[] = [];
  if (!scenario.actor) incomplete.push("Actor is unspecified.");
  if (!scenario.startCondition) incomplete.push("Start condition is unspecified.");
  for (const p of scenarioPaths(scenario))
    if (!p.outcomes.length) incomplete.push(`${p.name} has no expected outcome.`);
  if (!scenario.outcomes?.length) incomplete.push("Expected outcomes are unspecified.");
  for (const o of scenario.outcomes ?? [])
    if (!o.invariants.length) incomplete.push(`Outcome ${o.id} has no stated invariant.`);
  return {
    fingerprint,
    incomplete,
    status: incomplete.length
      ? ("Incomplete" as const)
      : !scenario.review
        ? ("Needs review" as const)
        : scenario.review.fingerprint === fingerprint
          ? ("Reviewed" as const)
          : ("Stale" as const),
  };
}

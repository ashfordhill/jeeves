/** Read-only review of represented design facts and explicitly declared, turn-local scope. */
import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { designScope, profileStatus, unresolvedDesignScope } from "./design-scope.ts";
import { isStructural } from "./findings.ts";
import { idSchema } from "./ids.ts";
import { designOperations, operationChanges } from "./operation-contracts.ts";
import { designOwnership, previewOwnership } from "./ownership.ts";
import { studioPatternIdSchema, studioPatterns } from "./studio-patterns.ts";
import { validateDesign } from "./validate.ts";

/** This is chat metadata, never a persisted design setting or an implementation contract. */
export const studioReviewScopeSchema = z.strictObject({
  patterns: z
    .array(
      z.strictObject({
        id: studioPatternIdSchema,
        checklistIds: z.array(idSchema).max(8),
      }),
    )
    .max(4),
  assumptions: z.array(z.string().trim().min(1).max(500)).max(8),
  obligations: z
    .array(
      z.strictObject({
        id: idSchema,
        requirement: z.string().trim().min(1).max(1000),
        element: idSchema.optional(),
        connection: idSchema.optional(),
      }),
    )
    .max(8),
});
export type StudioReviewScope = z.infer<typeof studioReviewScopeSchema>;
export const emptyReviewScope = (): StudioReviewScope => ({
  patterns: [],
  assumptions: [],
  obligations: [],
});

/** Scope is explicit: retrieving a pattern does not select it or any variant's checklist. */
export function reviewScopeProblem(
  scope: StudioReviewScope,
  design: DesignDocument,
): string | undefined {
  if (new Set(scope.patterns.map((item) => item.id)).size !== scope.patterns.length)
    return "Declare each pattern only once.";
  for (const selected of scope.patterns) {
    const pattern = studioPatterns[selected.id];
    if (new Set(selected.checklistIds).size !== selected.checklistIds.length)
      return "Declare each checklist ID only once per pattern.";
    for (const id of selected.checklistIds)
      if (!pattern.checklist.some((item) => item.id === id))
        return `Unknown checklist ID ${selected.id}/${id}. Read describeStudioPattern first.`;
  }
  if (new Set(scope.obligations.map((item) => item.id)).size !== scope.obligations.length)
    return "Declare each custom obligation ID only once.";
  for (const item of scope.obligations) {
    if (item.element && !design.elements.some((element) => element.id === item.element))
      return `There is no element ${item.element} in the working design.`;
    if (
      item.connection &&
      !design.connections.some((connection) => connection.id === item.connection)
    )
      return `There is no connection ${item.connection} in the working design.`;
  }
  return undefined;
}

export type StudioChange = {
  type:
    | "system"
    | "scope"
    | "ownership"
    | "operations"
    | "action"
    | "element"
    | "connection"
    | "package"
    | "entry"
    | "component"
    | "component-connection";
  id: string;
  name: string;
  change: "added" | "updated" | "removed";
};

/** Include settings, ownership, modules, actions and removals, not just surviving tile IDs. */
export function studioChanges(base: DesignDocument, working: DesignDocument): StudioChange[] {
  const index = (design: DesignDocument) => {
    const entries: [string, { change: Omit<StudioChange, "change">; value: unknown }][] = [];
    const add = (type: StudioChange["type"], id: string, name: string, value: unknown) =>
      entries.push([`${type}:${id}`, { change: { type, id, name }, value }]);
    const studio = design.architecture?.studio;
    if (design.schemaVersion === 3)
      add("scope", "persistent-scope", "Profile and persistent requirements", design.scope);
    if (design.schemaVersion === 3 && design.ownership)
      add(
        "ownership",
        "explicit-ownership",
        "Logical owners, roles and declared access",
        design.ownership,
      );
    if (design.schemaVersion === 3 && design.operations)
      add(
        "operations",
        "operation-bindings",
        "Exact operation implementations and caller expectations",
        design.operations,
      );
    if (design.architecture)
      add("system", "system", design.architecture.system.name, design.architecture.system);
    for (const item of studio?.actions ?? []) add("action", item.lane, item.name, item);
    for (const item of design.elements)
      add("element", item.id, item.name, {
        element: item,
        binding: studio?.elements.find((binding) => binding.element === item.id),
      });
    for (const item of design.connections)
      add("connection", item.id, item.planned.label, {
        connection: item,
        binding: studio?.connections.find((binding) => binding.connection === item.id),
      });
    for (const item of studio?.packages ?? []) add("package", item.id, item.name, item);
    for (const item of studio?.entries ?? []) add("entry", item.id, item.id, item);
    for (const item of studio?.components ?? []) add("component", item.id, item.name, item);
    for (const item of studio?.componentConnections ?? [])
      add("component-connection", item.id, item.id, item);
    return new Map(entries);
  };
  const before = index(base);
  const after = index(working);
  const changes: StudioChange[] = [];
  for (const [key, item] of after) {
    const old = before.get(key);
    if (!old || JSON.stringify(old.value) !== JSON.stringify(item.value))
      changes.push({ ...item.change, change: old ? "updated" : "added" });
  }
  for (const [key, item] of before)
    if (!after.has(key)) changes.push({ ...item.change, change: "removed" });
  return changes;
}

/** No payload, transition or side-effect claim is inferred from prose or module names. */
export function reviewStudioDesign(
  base: DesignDocument,
  working: DesignDocument,
  scope: StudioReviewScope = emptyReviewScope(),
) {
  const findings = validateDesign(working);
  const baseline = new Set(validateDesign(base).map((item) => JSON.stringify(item)));
  const obligations = scope.patterns.flatMap((selected) => {
    const pattern = studioPatterns[selected.id];
    const identity = {
      pattern: pattern.id,
      version: pattern.version,
      status: "not specified" as const,
    };
    return [
      ...selected.checklistIds.map((id) => ({
        ...identity,
        id,
        requirement: pattern.checklist.find((item) => item.id === id)?.invariant ?? id,
        limitation:
          "No typed behavior contract represents this invariant; topology and settings do not verify it.",
      })),
      ...pattern.support.obligations.map((item) => ({
        ...identity,
        id: item.id,
        requirement: item.implementation,
        limitation: item.limitation,
      })),
    ];
  });
  return {
    baseRevision: base.revision,
    changes: studioChanges(base, working),
    structurallyValid: !findings.some(isStructural),
    findings: findings.map((item) => ({
      ...item,
      introduced: !baseline.has(JSON.stringify(item)),
    })),
    scope: { ...scope, persistence: "this turn only" as const },
    ownership: {
      declarations: designOwnership(working),
      changes: previewOwnership(base, designOwnership(working)).changes,
      note: "Explicit access declarations; operation bindings are separate and runtime authorization is unavailable.",
    },
    operations: {
      declarations: designOperations(working),
      changes: operationChanges(designOperations(base), designOperations(working)),
      note: "Exact declarative operation contracts; verifier, templates and runtime evidence remain unavailable.",
    },
    persistentScope: {
      ...designScope(working),
      profileStatus: profileStatus(designScope(working)),
      unresolved: unresolvedDesignScope(working),
      persistence: "saved design" as const,
    },
    assumptions: scope.assumptions,
    obligations: [
      ...obligations,
      ...(working.schemaVersion === 3
        ? unresolvedDesignScope(working).map((item) => ({
            ...item,
            status: "not specified" as const,
            limitation:
              "Persistent design intent has no implemented behavior contract, template or runtime verification.",
          }))
        : []),
      ...scope.obligations.map((item) => ({
        ...item,
        status: "not specified" as const,
        limitation:
          "Declared requirement has no typed implementation contract in the current model.",
        // A later edit may remove a target. Retain the obligation instead of silently losing it.
        targetPresent:
          (!item.element || working.elements.some((element) => element.id === item.element)) &&
          (!item.connection ||
            working.connections.some((connection) => connection.id === item.connection)),
      })),
    ],
    limits: [
      "Only represented structural facts and existing readiness findings are checked. Pattern relationships, payloads, state transitions and side effects are not inferred from names, labels or modules.",
      "Undeclared requirements are outside this review. An empty scope does not certify application completeness.",
      "Settings and topology express design intent. No runtime template or runtime verification is supplied.",
    ],
    templateAvailability: "none" as const,
    runtimeVerification: "none" as const,
  };
}
export type StudioReview = ReturnType<typeof reviewStudioDesign>;

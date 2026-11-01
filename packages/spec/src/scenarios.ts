/** Dynamic scenarios describe order over authored wiring; they never create a relationship. */
import { z } from "zod";
import { componentConnections } from "./architecture.ts";
import type { DesignDocument } from "./design.ts";
import { idSchema } from "./ids.ts";
import { connectionPresentation } from "./relationship-display.ts";

export const scenarioScopeSchema = z.discriminatedUnion("level", [
  z.strictObject({ level: z.literal("containers") }),
  z.strictObject({ level: z.literal("components"), container: idSchema }),
]);
export const scenarioRelationshipSchema = z.strictObject({
  kind: z.enum(["connection", "componentRelationship"]),
  id: idSchema,
});
export const architectureScenarioSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  scope: scenarioScopeSchema,
  steps: z
    .array(
      z.strictObject({
        id: idSchema,
        relationship: scenarioRelationshipSchema,
        text: z.string().trim().min(1).max(240),
      }),
    )
    .min(1)
    .max(50),
});
export type ArchitectureScenario = z.output<typeof architectureScenarioSchema>;
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
  ];
}

export function sameScenarioRelationship(a: ScenarioRelationship, b: ScenarioRelationship) {
  return a.kind === b.kind && a.id === b.id;
}

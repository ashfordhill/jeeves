/** Read-only display hints. These are not studio bindings, settings, or a migration. */
import type { DesignDocument } from "./design.ts";
import type { StudioKind } from "./studio-model.ts";

/** Deliberately explicit: labels, provider names and unknown families never infer a kind. */
export const legacyStudioFamilies: Readonly<Record<string, StudioKind>> = {
  "browser-client": "browser",
  "application-api": "service",
  "background-worker": "worker",
  "serverless-function": "service",
  "realtime-service": "service",
  "api-gateway": "service",
  "notification-service": "notification",
  "identity-provider": "identity",
  "relational-store": "database",
  "document-store": "database",
  "analytics-store": "database",
  "distributed-cache": "cache",
  "job-queue": "queue",
  "event-stream": "queue",
  "object-storage": "object-store",
  "search-index": "search",
  "edge-delivery": "cdn",
  "third-party-service": "external-api",
  "billing-provider": "external-api",
};
export const legacyStudioTemplates: Readonly<Record<string, StudioKind>> = {
  "http-service": "service",
  "web-app": "browser",
  postgres: "database",
};

export function legacyStudioKind(
  element: DesignDocument["elements"][number],
): StudioKind | undefined {
  return element.planned
    ? legacyStudioFamilies[element.planned]
    : element.template
      ? legacyStudioTemplates[element.template.id]
      : undefined;
}

/** Mixed documents adapt only their unbound elements; no new field/default is written on read. */
export function legacyStudioDisplay(design: DesignDocument) {
  const bound = new Set(design.architecture?.studio?.elements.map((binding) => binding.element));
  const boundConnections = new Set(
    design.architecture?.studio?.connections.map((binding) => binding.connection),
  );
  return {
    ...(design.architecture && {
      system: {
        name: design.architecture.system.name,
        description: design.architecture.system.description,
        editable: ["name", "description"] as const,
      },
      contextNodes: design.architecture.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        name: node.name,
        description: node.description,
        ...(node.container && { container: node.container }),
        editable: ["name", "description"] as const,
      })),
    }),
    elements: design.elements
      .filter((element) => !bound.has(element.id))
      .map((element) => ({
        element: element.id,
        name: element.name,
        description: element.description ?? "",
        kind: legacyStudioKind(element),
        symbol: legacyStudioKind(element) ?? "generic",
        source: structuredClone(
          element.planned
            ? { capability: element.planned }
            : element.template
              ? { template: element.template }
              : {},
        ),
        editable: ["name", "description"] as const,
        // Preserve real identities for Generate/export; no fake configurable component children.
        summarizedComponents: (design.architecture?.components ?? [])
          .filter((component) => component.element === element.id)
          .map((component) => ({ id: component.id, name: component.name })),
      })),
    connections: design.connections
      .filter(
        (connection) =>
          !boundConnections.has(connection.id) &&
          !bound.has(connection.from.element) &&
          !bound.has(connection.to.element),
      )
      .map((connection) => ({
        connection: connection.id,
        from: connection.from.element,
        to: connection.to.element,
        description: connection.planned?.label ?? connection.label,
        protocol: connection.planned?.protocol ?? connection.protocol,
        interaction: connection.planned?.interaction ?? connection.interaction,
        planned: !!connection.planned,
        editable: [] as const,
        // Missing legacy channel roles remain unresolved; never infer a producer from its label.
        channelUse: undefined,
      })),
    contextRelationships: (design.architecture?.relationships ?? []).map((relationship) => ({
      relationship: relationship.id,
      from: relationship.from,
      to: relationship.to,
      description: relationship.description,
      editable: ["description"] as const,
    })),
  };
}

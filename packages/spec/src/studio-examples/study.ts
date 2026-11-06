/** Static study assembly over the same finite definitions and semantic identities as the editor. */
import { type ArchitectureInput, architectureSchema } from "../architecture.ts";
import { type DesignDocument, designSchema, emptyDesign } from "../design.ts";
import type { StudioComponent, StudioComponentConnection } from "../studio-components.ts";
import { studioDefinitions } from "../studio-definitions.ts";
import {
  type StudioEntry,
  type StudioLaneAction,
  type StudioPackage,
  studioDefinitionRef,
} from "../studio-model.ts";
import type { StudioConnectionCreation, StudioElementCreation } from "../studio-operations.ts";

export type StudioStudy = {
  id: string;
  version: string;
  name: string;
  description: string;
  goalManifestSha256: string;
};

export function createStudioStudy(
  study: StudioStudy,
  elements: StudioElementCreation[],
  connections: StudioConnectionCreation[],
  /** The system, plus any C1 people, external systems and relationships. */
  context: Pick<ArchitectureInput, "system" | "nodes" | "relationships">,
  /**
   * Optional lane actions and their entries, group frames and modules (C3 components), stored
   * exactly as given.
   */
  parts: {
    actions?: StudioLaneAction[];
    entries?: StudioEntry[];
    packages?: StudioPackage[];
    components?: StudioComponent[];
    componentConnections?: StudioComponentConnection[];
  } = {},
): { name: string; design: DesignDocument } {
  const design = designSchema.parse({
    ...emptyDesign(),
    elements: elements.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      classification: studioDefinitions[item.settings.kind].classification,
    })),
    connections: connections.map(({ id, from, to, kind, planned }) => ({
      id,
      from: { element: from },
      to: { element: to },
      kind,
      planned,
    })),
    architecture: architectureSchema.parse({
      ...context,
      studio: {
        version: 1,
        origin: {
          example: { id: study.id, version: study.version },
          goalManifestSha256: study.goalManifestSha256,
        },
        elements: elements.map((item) => ({
          element: item.id,
          definition: studioDefinitionRef(item.settings.kind),
          settings: item.settings,
          ...(item.owner && { owner: item.owner }),
        })),
        packages: parts.packages ?? [],
        connections: connections.map((item) => ({
          connection: item.id,
          settings: item.settings,
        })),
        ...(parts.components?.length && { components: parts.components }),
        ...(parts.componentConnections?.length && {
          componentConnections: parts.componentConnections,
        }),
        ...(parts.entries?.length && { entries: parts.entries }),
        ...(parts.actions?.length && { actions: parts.actions }),
      },
    }),
  });
  // The canvas lays a study out automatically; a study stores no positions.
  return { name: study.name, design };
}

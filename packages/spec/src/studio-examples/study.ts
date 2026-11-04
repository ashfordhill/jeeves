/** Static study assembly over the same finite definitions and semantic identities as the editor. */
import { type Architecture, architectureSchema } from "../architecture.ts";
import { type DesignDocument, designSchema, emptyDesign } from "../design.ts";
import { type LayoutDocument, layoutSchema } from "../layout.ts";
import type { StudioComponent, StudioComponentConnection } from "../studio-components.ts";
import { studioDefinitions } from "../studio-definitions.ts";
import { type StudioPackage, studioDefinitionRef } from "../studio-model.ts";
import type { StudioConnectionCreation, StudioElementCreation } from "../studio-operations.ts";
import { studioGoalManifests } from "../studio-sources.ts";
import { studioScopes, studioViews } from "../studio-view.ts";

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
  context: Pick<Architecture, "system" | "nodes" | "relationships">,
  initialLayout?: unknown,
  /** SG04: optional group frames and C3 components, stored exactly as given. */
  parts: {
    packages?: StudioPackage[];
    components?: StudioComponent[];
    componentConnections?: StudioComponentConnection[];
  } = {},
): { name: string; design: DesignDocument; layout: LayoutDocument } {
  const manifest = studioGoalManifests.find(
    (item) => item.example.id === study.id && item.example.version === study.version,
  );
  if (!manifest) throw new Error(`Missing exact goal manifest for ${study.id}@${study.version}.`);
  const decisions = manifest.requirements
    .filter((row) => row.disposition !== "represented-design")
    .map((row) => ({
      id: `studio-c4b-${row.requirementId}`,
      name: (row.summary.split(":")[0] ?? row.requirementId).slice(0, 120),
      status: "Unresolved" as const,
      context: `${row.source.sourceId}: ${row.source.location}. ${row.summary}`.slice(0, 1200),
      decision: row.remainingWork,
      consequence:
        "Source requirement remains unimplemented/unverified. Finite settings and this study do not supply application behavior or runtime support.",
      links: [
        ...row.nodeIds.map((id) => ({ kind: "element" as const, id })),
        ...row.connectionIds.map((id) => ({ kind: "connection" as const, id })),
      ],
      acknowledgements: [],
    }));
  const design = designSchema.parse({
    ...emptyDesign(),
    elements: elements.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      classification: studioDefinitions[item.settings.kind].classification,
      template: null,
      config: {},
      attachments: [],
      notes: "",
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
      },
      decisions,
      implementationHandoff: {
        description: `${study.name}: design coverage and source-linked future implementation work only.`,
        partial: true,
        excludedScope:
          "No application runtime, template binding, provisioning, generated build or behavior verification is supplied. Historical deployment and implementation detail remains pinned source.",
        assignments: decisions.map((item) => ({
          kind: "decision",
          id: item.id,
          owner: "Future application/runtime implementer",
          blocks: item.decision,
        })),
      },
    }),
  });
  const views = studioViews(design, studioDefinitions, study.name);
  // Fresh deterministic scope layouts; no old focused-view keys or source geometry is reused.
  const layout = layoutSchema.parse(
    initialLayout ?? {
      schemaVersion: 1,
      items: {},
      architecture: Object.fromEntries(
        studioScopes(views).map((view) => [
          view.key,
          {
            positions: Object.fromEntries(
              view.nodes.map((node, i) => [
                node.id,
                { x: (i % 4) * 240, y: Math.floor(i / 4) * 144 },
              ]),
            ),
          },
        ]),
      ),
    },
  );
  return { name: study.name, design, layout };
}

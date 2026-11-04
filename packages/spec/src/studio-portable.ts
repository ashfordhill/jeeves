/** Lossless project data exchange, separate from the bounded implementation-review handoff. */
import { z } from "zod";
import { type DesignDocument, designSchema } from "./design.ts";
import { type LayoutDocument, layoutSchema } from "./layout.ts";
import {
  resolveStudioSources,
  type StudioGoalManifest,
  studioSourceSchema,
  verifyStudioSources,
} from "./studio-sources.ts";

export const studioProjectSchema = z.strictObject({
  schema: z.literal("jeeves.studio-project"),
  schemaVersion: z.literal(1),
  design: designSchema,
  layout: layoutSchema,
  studioSources: z.array(studioSourceSchema).max(1).optional(),
});
export type StudioProject = z.infer<typeof studioProjectSchema>;

export async function exportStudioProject(
  design: DesignDocument,
  layout: LayoutDocument,
  registry?: readonly StudioGoalManifest[],
): Promise<string> {
  const studioSources = await resolveStudioSources(design.architecture?.studio?.origin, registry);
  return `${JSON.stringify(studioProjectSchema.parse({ schema: "jeeves.studio-project", schemaVersion: 1, design, layout, ...(studioSources && { studioSources }) }), null, 2)}\n`;
}

export async function importStudioProject(json: string): Promise<StudioProject> {
  const project = studioProjectSchema.parse(JSON.parse(json));
  await verifyStudioSources(project.design.architecture?.studio?.origin, project.studioSources);
  return project;
}

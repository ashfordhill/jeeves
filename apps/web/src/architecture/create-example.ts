/**
 * Creates a separate editable project from a planning example. The example's elements,
 * connections and architecture are saved through ordinary operations, so the result is a normal
 * design with history; the authored layout is stored alongside it.
 */
import {
  architectureExample,
  studioArchitectureExample,
  studioArchitectureExamples,
} from "@jeeves/spec";
import { api, type Project } from "../draw/api.ts";

/** The example a fresh installation opens with, and the chooser's preselected study. */
export const DEFAULT_EXAMPLE_ID = "studio-tinyurl";

export async function createExampleProject(id: string, name?: string): Promise<Project> {
  const example = studioArchitectureExamples.some((item) => item.id === id)
    ? studioArchitectureExample(id)
    : architectureExample(id);
  const project = await api.createProject(name?.trim() || example.name);
  try {
    const result = await api.edit(project.id, 0, [
      ...example.design.elements.map((element) => ({ op: "addElement" as const, element })),
      ...example.design.connections.map((connection) => ({ op: "connect" as const, connection })),
      ...(example.design.architecture
        ? [{ op: "setArchitecture" as const, architecture: example.design.architecture }]
        : []),
    ]);
    if (!result.ok) throw new Error("The example could not be saved.");
    await api.putLayout(project.id, example.layout);
    return project;
  } catch (error) {
    await api.deleteProject(project.id);
    throw error;
  }
}

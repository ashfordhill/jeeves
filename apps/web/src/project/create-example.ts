/**
 * Creates a separate editable project from a complete, versioned study through one ordinary
 * operation batch, including explicit v3 scope, ownership and operation/cache declarations.
 * A failed seed removes only the project this call just created.
 */
import {
  DEFAULT_STUDIO_EXAMPLE_ID,
  studioArchitectureExample,
  studioStudySeedOperations,
} from "@jeeves/spec";
import { api, type Project } from "./api.ts";

/** The example a fresh installation opens with, and the chooser's preselected study. */
export const DEFAULT_EXAMPLE_ID = DEFAULT_STUDIO_EXAMPLE_ID;

export async function createExampleProject(id: string, name?: string): Promise<Project> {
  const example = studioArchitectureExample(id);
  const project = await api.createProject(name?.trim() || example.name);
  try {
    const result = await api.edit(project.id, 0, studioStudySeedOperations(example.design));
    if (!result.ok) throw new Error("The example could not be saved.");
    return project;
  } catch (error) {
    await api.deleteProject(project.id);
    throw error;
  }
}

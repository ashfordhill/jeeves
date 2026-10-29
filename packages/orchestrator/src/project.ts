/**
 * Reads what planning needs from a generated template project: its lock, the design snapshot it
 * was generated from, and the element briefs (PLAN §9 layout).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DESIGN_PATH, elementNotesPath, type Lock, readLock } from "@jeeves/generator";
import { type DesignDocument, designSchema } from "@jeeves/spec";

export type GeneratedProject = {
  dir: string;
  lock: Lock;
  design: DesignDocument;
  /** `jeeves/elements/<id>.md` by element ID; missing files are left out. */
  briefs: Record<string, string>;
};

export class ProjectReadError extends Error {}

/** Throws `ProjectReadError` (or the lock's `LockError`) with a message for the person. */
export function readGeneratedProject(dir: string): GeneratedProject {
  if (!existsSync(dir)) throw new ProjectReadError(`The project folder ${dir} doesn't exist.`);
  const lock = readLock(dir);
  if (!lock) {
    throw new ProjectReadError(`${dir} has no jeeves/lock.json. Generate the project first.`);
  }
  const designPath = join(dir, DESIGN_PATH);
  if (!existsSync(designPath)) throw new ProjectReadError(`${DESIGN_PATH} is missing in ${dir}.`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(designPath, "utf8"));
  } catch (error) {
    throw new ProjectReadError(`${DESIGN_PATH} isn't valid JSON: ${(error as Error).message}`);
  }
  const parsed = designSchema.safeParse(raw);
  if (!parsed.success) throw new ProjectReadError(`${DESIGN_PATH} isn't a Jeeves design.`);
  const briefs: Record<string, string> = {};
  for (const element of lock.elements) {
    const path = join(dir, elementNotesPath(element.id));
    if (existsSync(path)) briefs[element.id] = readFileSync(path, "utf8");
  }
  return { dir, lock, design: parsed.data, briefs };
}

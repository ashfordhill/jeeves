import { readFileSync } from "node:fs";
import { planProject, templateSet } from "@jeeves/generator";
import { type DesignDocument, designSchema } from "@jeeves/spec";

export const templates = templateSet();

export function fixtureDesign(name = "link-shortener"): DesignDocument {
  const url = new URL(`../../../fixtures/designs/${name}.json`, import.meta.url);
  return designSchema.parse(JSON.parse(readFileSync(url, "utf8")));
}

/** What `jeeves/lock.json` would hold for the design, without writing a project. */
export function lockOf(design: DesignDocument) {
  return { elements: planProject(design, templates, { projectName: "Shorty" }).elements };
}

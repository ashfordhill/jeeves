// How the studio words what a module generates: a kind's place in a tile's module fan (the lead
// of a template, a part of one, or a stub there) and a module's status on its page (the template
// it generates as, or Stub, Custom or Refused with the reason, from `moduleStatus`). Words only;
// the spec decides.
import { type ModuleStatus, moduleStatusLabels, moduleTemplateNames } from "@jeeves/spec";

// The same words chat reads (`listStudioDefinitions`, `getDesign`), from the spec.
export {
  moduleGeneration,
  moduleGenerationLabels,
  moduleGenerationOrder,
  moduleTemplateNames,
} from "@jeeves/spec";

/**
 * A module's status as its page shows it: the word, then the template it generates as
 * (Template), what its template still needs (Stub), or why it can't generate or isn't covered
 * (Refused, Custom).
 */
export function moduleStatusLine(status: ModuleStatus): { label: string; detail?: string } {
  const label = moduleStatusLabels[status.status];
  if (status.status === "template")
    return status.template ? { label, detail: moduleTemplateNames[status.template] } : { label };
  return status.reason ? { label, detail: status.reason } : { label };
}

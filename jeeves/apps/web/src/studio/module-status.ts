// How the studio words what a module generates (D6): a kind's place in a tile's module fan
// (`generationWords`: Generated for the lead of a template, Building block for a part of one, You
// write it for a stub there) and a module's status on its page (Generated with the template it
// generates as, You write it with what its template still needs, or Refused with the reason, from
// `moduleStatus`). Words only; the spec decides, and keeps Template and Stub for chat and the
// generator.
import { type ModuleStatus, type ModuleStatusKind, moduleTemplateNames } from "@jeeves/spec";

export { moduleGeneration, moduleGenerationOrder, moduleTemplateNames } from "@jeeves/spec";

/** What each generation means, in the studio's words (D6). The spec keeps Template and Stub. */
export const generationWords = {
  lead: {
    word: "Generated",
    meaning: "Jeeves writes working code; you fill in one short hooks file.",
  },
  part: {
    word: "Building block",
    meaning: "Generated once a Generated module is connected to it. Until then, you write it.",
  },
  stub: { word: "You write it", meaning: "An empty, typed file for your own code." },
} as const;

/** A module's status, in the studio's words: a stub and a Custom module are both yours to write. */
const statusWords: Record<ModuleStatusKind, string> = {
  template: generationWords.lead.word,
  stub: generationWords.stub.word,
  custom: generationWords.stub.word,
  refused: "Refused",
};

/**
 * A module's status as its page shows it: the word, then the template it generates as
 * (Generated), what its template still needs (You write it, a stub), or why it can't generate or
 * isn't covered (Refused; You write it, a Custom module).
 */
export function moduleStatusLine(status: ModuleStatus): { label: string; detail?: string } {
  const label = statusWords[status.status];
  if (status.status === "template")
    return status.template ? { label, detail: moduleTemplateNames[status.template] } : { label };
  return status.reason ? { label, detail: status.reason } : { label };
}

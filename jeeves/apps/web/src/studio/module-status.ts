// How the studio words what a module generates: a kind's place in a tile's module fan (the lead
// of a template, a part of one, or a stub there) and a module's status on its page (the template
// it generates as, or Stub, Custom or Refused with the reason, from `moduleStatus`). Words only;
// the spec decides.
import {
  type GenerationBinding,
  generationCapabilities,
  type ModuleStatus,
  moduleStatusLabels,
  type StudioComponentDefinition,
  type StudioComponentKind,
  type StudioKind,
  studioComponentDefinitions,
} from "@jeeves/spec";

type Generation = StudioComponentDefinition["generation"]["kind"];

/** The module fan's rows, in order. */
export const moduleGenerationOrder: readonly Generation[] = ["lead", "part", "stub"];
/** A module kind's caption in the module fan. */
export const moduleGenerationLabels: Record<Generation, string> = {
  lead: "Template",
  part: "Part of a template",
  stub: "Stub",
};

/**
 * What a module of `kind` can generate in a tile of `host`: the lead or a part of a template only
 * where that template allows the tile's kind (a Cache reader in a Worker is a stub), else a stub.
 */
export function moduleGeneration(kind: StudioComponentKind, host: StudioKind): Generation {
  const generation = studioComponentDefinitions[kind].generation;
  const allows = (template: keyof typeof generationCapabilities) =>
    generationCapabilities[template].hosts.includes(host);
  if (generation.kind === "lead") return allows(generation.template) ? "lead" : "stub";
  if (generation.kind === "part") return generation.templates.some(allows) ? "part" : "stub";
  return "stub";
}

/** Each installed template's name, as a module page shows it. */
export const moduleTemplateNames: Record<GenerationBinding["kind"], string> = {
  "verified-identity": "Sign-in",
  "owned-multipart": "Multipart upload",
  "asset-lifecycle": "Upload lifecycle",
  "video-hls": "Video encoding",
  "positive-cache-read": "Cache read",
  "event-counter": "Event counter",
  "search-projection": "Search indexing",
  "search-query": "Search query",
  favorites: "Favorites",
  "youtube-upload": "YouTube upload",
  "youtube-watch": "YouTube watch",
  "youtube-search": "YouTube search",
  "module-stub": "Module stub",
};

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

// The module menu's groups (D5): module kinds by what they do, in this order, each with its colour
// family (the `data-family` its heading and cards take) and its kinds in catalog order
// (`studioComponentKinds`). The inspector's module cards take their kind's group's family too.
import { type StudioComponentKind, studioComponentKinds } from "@jeeves/spec";

export type ModuleGroup = {
  label: string;
  family: string;
  kinds: readonly StudioComponentKind[];
};

const groups: readonly ModuleGroup[] = [
  {
    label: "Requests",
    family: "api",
    kinds: ["auth-guard", "rate-limiter", "redirect-responder", "external-call"],
  },
  {
    label: "Data",
    family: "data",
    kinds: [
      "data-access",
      "cache-reader",
      "search-query",
      "favorites",
      "id-generator",
      "index-writer",
      "event-counter",
      "lifecycle-writer",
    ],
  },
  { label: "Events", family: "messaging", kinds: ["event-publisher", "event-consumer"] },
  {
    label: "Files & media",
    family: "worker",
    kinds: ["multipart-uploads", "video-encoder", "video-packager", "video-thumbnailer"],
  },
  { label: "Custom", family: "generic", kinds: ["custom"] },
];

/** The five groups, in order, each with its kinds in catalog order. */
export const moduleGroups: readonly ModuleGroup[] = groups.map((group) => ({
  ...group,
  kinds: studioComponentKinds.filter((kind) => group.kinds.includes(kind)),
}));

/** The group a module kind is in. */
export function moduleGroupOf(kind: StudioComponentKind): ModuleGroup {
  const group = moduleGroups.find((item) => item.kinds.includes(kind));
  if (!group) throw new Error(`Module kind ${kind} is in no group.`);
  return group;
}

/**
 * Modules (C3 components) of an application tile. Each component kind's icon, the kinds a tile may
 * hold, a fresh name and ID for a new module, the tiles a module may use through its host's own
 * links, and the slot each of its links fills.
 */
import type { DesignDocument } from "./design.ts";
import {
  type StudioComponentConnection,
  type StudioComponentKind,
  type StudioComponentTargetKind,
  type StudioModuleSlot,
  studioComponentDefinitions,
  studioComponentKinds,
} from "./studio-components.ts";
import { type StudioVisual, studioDefinitions } from "./studio-definitions.ts";
import { freshId, slug, usedIds } from "./studio-ids.ts";
import type { StudioKind } from "./studio-model.ts";

/** Each module kind's icon (a `StudioIcon` name) and colour family. */
export const studioComponentVisuals: Readonly<
  Record<StudioComponentKind, Readonly<Pick<StudioVisual, "icon" | "color">>>
> = {
  "rate-limiter": { icon: "shield", color: "generic" },
  "cache-reader": { icon: "bolt", color: "data" },
  "id-generator": { icon: "repeat", color: "generic" },
  "redirect-responder": { icon: "route", color: "api" },
  "event-publisher": { icon: "plug-connected", color: "messaging" },
  "event-consumer": { icon: "plug", color: "messaging" },
  "data-access": { icon: "database", color: "data" },
  "auth-guard": { icon: "lock", color: "generic" },
  "external-call": { icon: "world", color: "external" },
  custom: { icon: "puzzle", color: "generic" },
  "multipart-uploads": { icon: "cloud-upload", color: "data" },
  "lifecycle-writer": { icon: "progress-check", color: "data" },
  "video-encoder": { icon: "movie", color: "worker" },
  "video-packager": { icon: "stack-2", color: "worker" },
  "video-thumbnailer": { icon: "photo", color: "worker" },
  "event-counter": { icon: "sum", color: "data" },
  "index-writer": { icon: "list-search", color: "data" },
  "search-query": { icon: "search", color: "data" },
  favorites: { icon: "star", color: "data" },
};

/** What a module may use a tile of this kind as (validation's target kinds). */
export function studioComponentTargetKind(kind: StudioKind): StudioComponentTargetKind {
  switch (kind) {
    case "identity":
    case "database":
    case "cache":
    case "queue":
    case "search":
    case "object-store":
    case "cdn":
    case "external-api":
      return kind;
    default:
      return "application";
  }
}

const kindOf = (design: DesignDocument, id: string): StudioKind | undefined =>
  design.architecture?.studio?.elements.find((item) => item.element === id)?.settings.kind;

/**
 * The module kinds a new module in this tile may be, in catalog order (each kind's `hosts`): the
 * generic kinds in a Service, Worker or Uploads tile and in existing Redirect, Notifications and
 * Billing tiles, plus the leads and parts that host's templates allow. Identity, Gateway, Browser
 * and resources take none.
 */
export function moduleKinds(design: DesignDocument, host: string): StudioComponentKind[] {
  const kind = kindOf(design, host);
  if (!kind || studioDefinitions[kind].classification.kind !== "Application") return [];
  return studioComponentKinds.filter((item) =>
    studioComponentDefinitions[item].hosts.includes(kind),
  );
}

/**
 * A name and ID for a new module of this kind in `host`: the kind's name ("Data access"), then
 * "Data access 2"… (free among the host's modules), with an ID such as `shorten-data-access`.
 * Given a `name`, the ID follows it instead (`shorten-url-reader`), as a rename would re-key it.
 */
export function newModuleIdentity(
  design: DesignDocument,
  host: string,
  kind: StudioComponentKind,
  given?: string,
): { id: string; name: string } {
  const names = new Set(
    (design.architecture?.studio?.components ?? [])
      .filter((item) => item.host === host)
      .map((item) => item.name.toLowerCase()),
  );
  const base = studioComponentDefinitions[kind].name;
  let name = base;
  for (let n = 2; names.has(name.toLowerCase()); n += 1) name = `${base} ${n}`;
  const used = usedIds(design);
  const named = given?.trim() && slug(given) ? given.trim() : undefined;
  return {
    id: freshId(`${host}-${slug(named ?? name)}`, (id) => used.has(id)),
    name: named ?? name,
  };
}

export type ModuleLinkChoice = {
  /** The tile the module would use. */
  element: string;
  /** The host's link to that tile, which the module link traces. */
  via: string;
  /** A free ID for the new module link. */
  id: string;
};

/**
 * The tiles a module may link to: each tile its host links to or from, through that link, when
 * the module's kind may use that tile's kind; a publisher or consumer reaches a queue only through
 * a publish or consume link. Links the module already has are left out.
 */
export function moduleLinkChoices(design: DesignDocument, component: string): ModuleLinkChoice[] {
  const studio = design.architecture?.studio;
  const module = studio?.components?.find((item) => item.id === component);
  if (!studio || !module) return [];
  const definition = studioComponentDefinitions[module.settings.kind];
  const links = studio.componentConnections ?? [];
  const used = usedIds(design);
  return design.connections.flatMap((connection) => {
    const ends = [connection.from.element, connection.to.element];
    if (!ends.includes(module.host)) return [];
    const element = ends[0] === module.host ? ends[1] : ends[0];
    const kind = element === undefined ? undefined : kindOf(design, element);
    if (!element || !kind) return [];
    const target = studioComponentTargetKind(kind);
    if (!definition.targets.includes(target)) return [];
    const channel = studio.connections.find((item) => item.connection === connection.id)?.settings
      .channelUse;
    if (target === "queue" && definition.channelUse && channel !== definition.channelUse) return [];
    if (
      links.some(
        (link) =>
          link.from === component &&
          link.to.kind === "element" &&
          link.to.id === element &&
          link.to.via === connection.id,
      )
    )
      return [];
    const id = freshId(`${component}-${element}`, (candidate) => used.has(candidate));
    used.add(id);
    return [{ element, via: connection.id, id }];
  });
}

/**
 * The slot a module link fills: the in-process slot for a module target, else the first slot whose
 * targets accept the tile's kind. `undefined` for a link no slot takes (an old link of an older
 * kind, kept as it was).
 */
export function moduleLinkSlot(
  design: DesignDocument,
  link: StudioComponentConnection,
): StudioModuleSlot | undefined {
  const studio = design.architecture?.studio;
  const module = studio?.components?.find((item) => item.id === link.from);
  if (!module) return undefined;
  const slots = studioComponentDefinitions[module.settings.kind].slots;
  if (link.to.kind === "component") {
    const target = studio?.components?.find((item) => item.id === link.to.id);
    return slots.find((slot) => slot.module !== undefined && slot.module === target?.settings.kind);
  }
  const kind = kindOf(design, link.to.id);
  if (!kind) return undefined;
  const target = studioComponentTargetKind(kind);
  return slots.find((slot) => slot.targets.includes(target));
}

/** A module slot and what fills it: each link's ID and its target tile (or module). */
export type ModuleSlotState = {
  slot: StudioModuleSlot;
  links: { id: string; target: { tile: string } | { module: string } }[];
};

/**
 * A module's slots, in catalog order, with the links that fill each one. A kind with no slots
 * (Redirect responder, Event counter) can't connect; an empty `links` is an unconnected slot.
 */
export function moduleSlots(design: DesignDocument, component: string): ModuleSlotState[] {
  const studio = design.architecture?.studio;
  const module = studio?.components?.find((item) => item.id === component);
  if (!module) return [];
  const links = (studio?.componentConnections ?? []).filter((link) => link.from === component);
  return studioComponentDefinitions[module.settings.kind].slots.map((slot) => ({
    slot,
    links: links
      .filter((link) => moduleLinkSlot(design, link)?.id === slot.id)
      .map((link) => ({
        id: link.id,
        target: link.to.kind === "component" ? { module: link.to.id } : { tile: link.to.id },
      })),
  }));
}

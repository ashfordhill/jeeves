/**
 * IDs follow names (tile processes contract, section 7). Renaming a tile or module re-keys its ID
 * while the ID still *follows*: it equals its creation form or its current name's slug, either
 * with an optional `-n`. A tile becomes `slug(name)` and a module `<host>-<slug(name)>`; a tile's
 * following modules move to its new prefix. A clash refuses. Designs with a study origin, a
 * tile-level selection or a preset, and IDs that don't follow, keep their IDs: the rename changes
 * only the name. Link IDs are never re-keyed.
 */
import { type DesignDocument, designSchema } from "./design.ts";
import { designGeneration, type GenerationBinding } from "./generation.ts";
import { idSchema } from "./ids.ts";
import type { OperationInput } from "./operations.ts";
import { studioComponentDefinitions } from "./studio-components.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { slug, usedIds } from "./studio-ids.ts";

/** One ID a rename re-keys. */
export type Rekey = { from: string; to: string };

/** The rename a re-key follows: a tile's or a module's new name. */
export type RenameTarget = { element: string } | { component: string };

/**
 * Whether the design keeps every ID on rename: a study copy or the frozen v2 (a study origin), or
 * hand-made generation (a tile-level selection or a preset).
 */
export function idsPinned(design: DesignDocument): boolean {
  if (design.architecture?.studio?.origin) return true;
  const generation = designGeneration(design);
  return (
    !!generation?.preset || !!generation?.selections.some((item) => item.target.kind === "element")
  );
}

/** `text` cut to an ID's length, as `freshId` cuts it. */
const fit = (text: string, room = 63) => text.slice(0, room).replace(/-+$/, "");
const valid = (id: string) => idSchema.safeParse(id).success;

/** Whether `id` is `base`, or `base-n`, either cut to fit an ID. */
function followsBase(id: string, base: string) {
  if (!base) return false;
  if (id === fit(base)) return true;
  const match = /^(.*)-(\d+)$/.exec(id);
  return !!match && match[1] === fit(base, 62 - (match[2]?.length ?? 0));
}

const tileName = (design: DesignDocument, id: string) =>
  design.elements.find((item) => item.id === id)?.name;
const modules = (design: DesignDocument) => design.architecture?.studio?.components ?? [];

/** Whether a tile's ID follows its kind's name (its creation form) or its own name. */
export function tileIdFollows(design: DesignDocument, id: string): boolean {
  const name = tileName(design, id);
  if (name === undefined) return false;
  const kind = design.architecture?.studio?.elements.find((item) => item.element === id)?.settings
    .kind;
  return [kind && slug(studioDefinitions[kind].name), slug(name)].some(
    (base) => !!base && followsBase(id, base),
  );
}

/** Whether a module's ID follows `<host>-` and its kind's name (its creation form) or its name. */
export function moduleIdFollows(design: DesignDocument, id: string): boolean {
  const module = modules(design).find((item) => item.id === id);
  if (!module) return false;
  return [studioComponentDefinitions[module.settings.kind].name, module.name].some((name) => {
    const rest = slug(name);
    return !!rest && followsBase(id, `${module.host}-${rest}`);
  });
}

/** What uses an ID, in plain words ("Upload API", "Data access in Upload API", "a link"). */
function idUser(design: DesignDocument, id: string): string {
  const element = tileName(design, id);
  if (element !== undefined) return element;
  const module = modules(design).find((item) => item.id === id);
  if (module) return `${module.name} in ${tileName(design, module.host) ?? module.host}`;
  const studio = design.architecture?.studio;
  if (design.connections.some((item) => item.id === id)) return "a link";
  if (studio?.entries?.some((item) => item.id === id)) return "a lane entry";
  if (studio?.componentConnections?.some((item) => item.id === id)) return "a module link";
  const group = studio?.packages.find((item) => item.id === id);
  if (group) return group.name;
  const node = design.architecture?.nodes.find((item) => item.id === id);
  if (node) return node.name;
  return id === "system" ? "the system" : "a context relationship";
}

/**
 * The IDs renaming `target` to `name` re-keys: the tile's or module's own, then (for a tile) each
 * following module's, in order. Empty when nothing re-keys: a pinned design, an unchanged name, an
 * ID that doesn't follow, a name whose slug isn't a valid ID, or a slug the ID already has. Throws,
 * in plain words, when a new ID is already used.
 */
export function planRename(design: DesignDocument, target: RenameTarget, name: string): Rekey[] {
  if (idsPinned(design)) return [];
  const renames: { from: string; to: string; who: string }[] = [];
  if ("element" in target) {
    const id = target.element;
    if (name.trim() === tileName(design, id) || !tileIdFollows(design, id)) return [];
    const to = fit(slug(name));
    if (!valid(to) || to === id) return [];
    renames.push({ from: id, to, who: name.trim() });
    for (const module of modules(design)) {
      if (module.host !== id || !moduleIdFollows(design, module.id)) continue;
      const rest = slug(module.name);
      const next = fit(rest ? `${to}-${rest}` : `${to}${module.id.slice(id.length)}`);
      if (valid(next) && next !== module.id)
        renames.push({ from: module.id, to: next, who: `${module.name} in ${name.trim()}` });
    }
  } else {
    const id = target.component;
    const module = modules(design).find((item) => item.id === id);
    if (!module || name.trim() === module.name || !moduleIdFollows(design, id)) return [];
    const rest = slug(name);
    const to = fit(`${module.host}-${rest}`);
    if (!rest || !valid(to) || to === id) return [];
    renames.push({ from: id, to, who: name.trim() });
  }
  const used = usedIds(design);
  const taken = new Set<string>();
  for (const item of renames) {
    if (used.has(item.to) || taken.has(item.to)) {
      const user = used.has(item.to)
        ? idUser(design, item.to)
        : (renames.find((other) => other.to === item.to)?.who ?? item.to);
      throw new Error(
        `${item.who} would take the ID ${item.to}, which ${user} already uses. Choose another name.`,
      );
    }
    taken.add(item.to);
  }
  return renames.map(({ from, to }) => ({ from, to }));
}

/** Why renaming `target` to `name` is refused (an ID clash), or `undefined` when it isn't. */
export function renameRefusal(
  design: DesignDocument,
  target: RenameTarget,
  name: string,
): string | undefined {
  try {
    planRename(design, target, name);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The IDs a batch re-keys (its `rekey` operations), in order. */
export function renamedIds(ops: readonly OperationInput[]): Rekey[] {
  return ops.flatMap((op) => (op.op === "rekey" ? [{ from: op.from, to: op.to }] : []));
}

/**
 * Re-keys a tile's or a module's ID in place, with every reference to it: connection endpoints,
 * C1 bindings, the studio (bindings, owners, settings that name a tile, groups, entries, modules
 * and module links), ownership, operations, scope and generation (targets, bindings and the
 * selection IDs a module-level selection shares with its lead). Link IDs are never re-keyed.
 */
export function rekeyDesign(design: DesignDocument, from: string, to: string): void {
  const swap = (value: string) => (value === from ? to : value);
  for (const element of design.elements) element.id = swap(element.id);
  for (const connection of design.connections) {
    connection.from.element = swap(connection.from.element);
    connection.to.element = swap(connection.to.element);
  }
  const architecture = design.architecture;
  for (const node of architecture?.nodes ?? [])
    if (node.container) node.container = swap(node.container);
  for (const relationship of architecture?.relationships ?? [])
    if (relationship.container) relationship.container = swap(relationship.container);
  const studio = architecture?.studio;
  if (studio) {
    for (const binding of studio.elements) {
      binding.element = swap(binding.element);
      if (binding.owner?.kind === "element") binding.owner.id = swap(binding.owner.id);
      const settings = binding.settings;
      if (settings.kind === "browser" && settings.delivery === "bundled" && settings.servedBy)
        settings.servedBy = swap(settings.servedBy);
      if (settings.kind === "cdn" && settings.origin) settings.origin = swap(settings.origin);
    }
    for (const group of studio.packages) group.members = group.members.map(swap);
    for (const entry of studio.entries ?? []) entry.element = swap(entry.element);
    for (const module of studio.components ?? []) {
      module.id = swap(module.id);
      module.host = swap(module.host);
      if (module.settings.kind === "event-consumer" && module.settings.deadLetterQueue)
        module.settings.deadLetterQueue = swap(module.settings.deadLetterQueue);
    }
    for (const link of studio.componentConnections ?? []) {
      link.from = swap(link.from);
      link.to.id = swap(link.to.id);
    }
  }
  if (design.schemaVersion !== 3) return;
  for (const item of design.scope.customRequirements)
    if (item.element) item.element = swap(item.element);
  const ownership = design.ownership;
  if (ownership) {
    for (const role of ownership.roles) role.element = swap(role.element);
    for (const resource of ownership.resources) {
      resource.element = swap(resource.element);
      if (resource.kind === "projection") resource.source = swap(resource.source);
    }
    for (const grant of ownership.grants) {
      grant.role = swap(grant.role);
      grant.resource = swap(grant.resource);
    }
  }
  const operations = design.operations;
  if (operations) {
    for (const receiver of operations.receivers) receiver.role = swap(receiver.role);
    for (const call of operations.calls) {
      if (call.caller.kind === "entry") call.caller.element = swap(call.caller.element);
      else call.caller.role = swap(call.caller.role);
      call.receiverRole = swap(call.receiverRole);
    }
  }
  for (const selection of design.generation?.selections ?? []) {
    selection.id = swap(selection.id);
    const target = selection.target;
    if (target.kind === "element") target.element = swap(target.element);
    else {
      target.component = swap(target.component);
      target.host = swap(target.host);
    }
    rekeyBinding(selection.binding, swap);
  }
}

/** A binding's tile, module and selection references. */
function rekeyBinding(binding: GenerationBinding, swap: (value: string) => string) {
  const fields = binding as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(fields)) {
    if (key === "kind") continue;
    // `upload`, `lifecycle`, `reader` and `query` name another selection.
    if (typeof value === "string") fields[key] = swap(value);
    else if (value && typeof value === "object") {
      const reference = value as Record<string, string>;
      // A store dependency names its tile (its link is never re-keyed); an identity names its
      // Identity tile and its guard module.
      if ("resource" in reference) reference.resource = swap(String(reference.resource));
      if ("element" in reference) reference.element = swap(String(reference.element));
      if ("guard" in reference) reference.guard = swap(String(reference.guard));
    }
  }
}

/** Fields of free text, which may say anything (names, descriptions, labels, protocols). */
const freeText = new Set(["name", "description", "label", "requirement", "protocol"]);
type Path = (string | number)[];
/** IDs of other kinds, never a tile or module: owners, deployables and binding identities. */
const otherIds: readonly Path[] = [
  ["ownership", "owners", -1, "id"],
  ["ownership", "roles", -1, "owner"],
  ["ownership", "roles", -1, "deployable"],
  ["ownership", "resources", -1, "authority"],
  ["operations", "receivers", -1, "id"],
  ["operations", "calls", -1, "id"],
  ["operations", "calls", -1, "receiverBinding"],
  ["scope", "customRequirements", -1, "id"],
];
const matches = (path: Path, pattern: Path) =>
  path.length === pattern.length &&
  pattern.every((key, index) => key === -1 || key === path[index]);
/** A valid ID no enumerated value equals, written in place of a leftover to test its field. */
const probe = "rekey-probe-0";

/**
 * The completeness walk: the paths in `design` where one of `ids` still appears outside free text.
 * A string in a field of other IDs (owners, record references) or of a closed vocabulary (a kind
 * such as `cache`, which a tile's ID may equal) is not a reference: a field that refuses another
 * ID in its place is a vocabulary. Anything else is a reference the re-key missed.
 */
export function rekeyLeftovers(design: DesignDocument, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  if (!wanted.size) return [];
  const found: Path[] = [];
  const walk = (value: unknown, path: Path, parent?: Record<string, unknown>) => {
    if (typeof value === "string") {
      const key = path.at(-1);
      if (!wanted.has(value) || (typeof key === "string" && freeText.has(key))) return;
      // A record reference ({id, version}) names a catalog record, not a tile or module.
      if (key === "id" && parent && "version" in parent) return;
      if (otherIds.some((pattern) => matches(path, pattern))) return;
      found.push(path);
      return;
    }
    if (Array.isArray(value))
      for (const [index, item] of value.entries()) walk(item, [...path, index]);
    else if (value && typeof value === "object")
      for (const [key, item] of Object.entries(value))
        walk(item, [...path, key], value as Record<string, unknown>);
  };
  walk(design, []);
  if (!found.length) return [];
  const parses = designSchema.safeParse(design).success;
  return found
    .filter((path) => {
      // Without a parsing design, every leftover counts.
      if (!parses) return true;
      const probed = structuredClone(design) as unknown as Record<string | number, unknown>;
      let object: Record<string | number, unknown> = probed;
      for (const key of path.slice(0, -1)) object = object[key] as Record<string | number, unknown>;
      object[path.at(-1) as string | number] = probe;
      return designSchema.safeParse(probed).success;
    })
    .map((path) => path.join("."));
}

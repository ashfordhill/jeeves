/**
 * Module-level generation (module authoring contract, section 5). `planModules` reads the modules
 * and their links: a template is selected only by its lead, once every needed part in its tile is
 * connected; every other module is a typed stub. `deriveModuleGeneration` is the one pure pass a
 * module command runs over the whole design: it writes each module's selection, the fixed and
 * initial values its template needs and the ownership those templates need, and refuses the
 * whole command in plain words on a conflict. Reads never call it.
 */
import type { DesignDocument } from "./design.ts";
import {
  designGeneration,
  type GenerationBinding,
  type GenerationDependency,
  type GenerationSelection,
  generationHost,
  generationReferences,
} from "./generation.ts";
import { generationTemplates } from "./generation-catalog.ts";
import { generationCapabilities } from "./generation-support.ts";
import type { OperationInput } from "./operations.ts";
import { accessAllows, type DeclaredAccess, designOwnership, type Ownership } from "./ownership.ts";
import {
  type StudioComponent,
  type StudioComponentKind,
  type StudioModuleSlotId,
  type StudioModuleTemplate,
  studioComponentDefinitions,
} from "./studio-components.ts";
import { freshId, usedIds } from "./studio-ids.ts";
import { laneGraph } from "./studio-lanes.ts";
import { studioKindNoun } from "./studio-links.ts";
import { createStudioSettings, type StudioKind } from "./studio-model.ts";
import { moduleLinkSlot } from "./studio-modules.ts";

/** A lead module and its template: complete with a binding, or what it still needs. */
export type LeadPlan = {
  lead: StudioComponent;
  template: StudioModuleTemplate;
  /** The modules in its tile that fill its other fields. */
  parts: StudioComponent[];
  /** Set once every needed part is connected. */
  binding?: GenerationBinding;
  /** What it still needs, as a phrase: "a Data access connected to a database". */
  missing?: string;
  /** The store a template writes as a copy of another one: a cache or a search index. */
  projects?: { store: string; source: string };
};
export type ModulePlan = {
  leads: LeadPlan[];
  /** Conflicts that refuse a module command, in plain words. */
  refusals: string[];
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: readonly string[], last = "and") =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
const count = (n: number) => (n === 2 ? "two" : n === 3 ? "three" : String(n));
const kindName = (kind: StudioComponentKind) => studioComponentDefinitions[kind].name;
const article = (text: string) => (/^[AEIOU]/i.test(text) ? `an ${text}` : `a ${text}`);
const plural: Partial<Record<StudioKind, string>> = {
  database: "databases",
  queue: "queues",
  identity: "identity services",
  "object-store": "object storage",
  search: "search indexes",
  cache: "caches",
};
/** Templates in plain words, for refusals. */
const templateWords: Record<StudioModuleTemplate, string> = {
  "owned-multipart": "multipart upload",
  "asset-lifecycle": "upload lifecycle",
  "video-hls": "video encoding",
  "positive-cache-read": "cache read",
  "event-counter": "event counter",
  "search-projection": "search indexing",
  "search-query": "search query",
};

type ModuleLink = {
  id: string;
  module: StudioComponent;
  slot: StudioModuleSlotId;
  tile?: string;
  via?: string;
  target?: StudioComponent;
};

/** The design's modules, links and tiles as the planner reads them. */
function moduleView(design: DesignDocument) {
  const studio = design.architecture?.studio;
  const modules = studio?.components ?? [];
  const byId = new Map(modules.map((item) => [item.id, item]));
  const kinds = new Map(studio?.elements.map((item) => [item.element, item.settings.kind]));
  const names = new Map(design.elements.map((item) => [item.id, item.name]));
  const links: ModuleLink[] = (studio?.componentConnections ?? []).flatMap((link): ModuleLink[] => {
    const module = byId.get(link.from);
    const slot = module && moduleLinkSlot(design, link);
    if (!module || !slot) return [];
    return link.to.kind === "component"
      ? [{ id: link.id, module, slot: slot.id, target: byId.get(link.to.id) }]
      : [{ id: link.id, module, slot: slot.id, tile: link.to.id, via: link.to.via }];
  });
  const order = new Map(laneGraph(design).nodes.map((node, index) => [node.id, index]));
  const entries = new Set(studio?.entries?.map((item) => item.element));
  return {
    design,
    modules,
    kindOf: (id: string) => kinds.get(id),
    name: (id: string) => names.get(id) ?? id,
    inHost: (host: string) => modules.filter((item) => item.host === host),
    linksOf: (module: StudioComponent, slot: StudioModuleSlotId) =>
      links.filter((link) => link.module.id === module.id && link.slot === slot),
    links,
    rank: (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER,
    isEntry: (id: string) => entries.has(id),
  };
}
type ModuleView = ReturnType<typeof moduleView>;

const dependency = (link: ModuleLink | undefined): GenerationDependency | undefined =>
  link?.tile && link.via ? { resource: link.tile, connection: link.via } : undefined;
const noun = studioKindNoun;

/**
 * Reads every lead module and what its template still needs. Pure: the design is not changed, so
 * the inspector, chat and Generate can read it too. `previous` are the module-level selections
 * whose ownership facts a derivation is about to replace (by default the design's own).
 */
export function planModules(
  design: DesignDocument,
  previous: readonly GenerationSelection[] = moduleSelections(design),
): ModulePlan {
  const view = moduleView(design);
  const refusals: string[] = [];
  const refuse = (message: string) => {
    if (!refusals.includes(message)) refusals.push(message);
  };
  const leads: LeadPlan[] = [];
  const claims = new Map<string, LeadPlan>();
  for (const lead of view.modules) {
    const generation = studioComponentDefinitions[lead.settings.kind].generation;
    if (generation.kind !== "lead") continue;
    const plan: LeadPlan = { lead, template: generation.template, parts: [] };
    leads.push(plan);
    const hostKind = view.kindOf(lead.host);
    const hosts = generationCapabilities[plan.template].hosts;
    if (!hostKind || !hosts.includes(hostKind)) {
      plan.missing = `to be in ${list(hosts.map(noun), "or")}`;
      continue;
    }
    matchLead(view, plan, refuse);
    for (const part of plan.parts) {
      const other = claims.get(part.id);
      if (other && other !== plan)
        refuse(
          `${sentence(part.name)} already serves ${other.lead.name}; ${lead.name} needs its own ${kindName(part.settings.kind)}.`,
        );
      else claims.set(part.id, plan);
    }
  }
  settleAcrossTiles(view, leads, keptOwnership(design, previous));
  // One template of a kind per tile, and never the same template both ways.
  const tileLevel = (designGeneration(design)?.selections ?? []).filter(
    (item) => item.target.kind === "element",
  );
  for (const plan of leads) {
    if (!plan.binding) continue;
    const host = plan.lead.host;
    const same = leads.filter(
      (other) => other.binding && other.lead.host === host && other.template === plan.template,
    );
    if (same.length > 1 && same[0] === plan)
      refuse(
        `${sentence(view.name(host))} can hold one ${templateWords[plan.template]} template; ${list(same.map((item) => item.lead.name))} would each make one.`,
      );
    if (
      tileLevel.some(
        (item) =>
          item.target.kind === "element" &&
          item.target.element === host &&
          item.binding.kind === plan.template,
      )
    )
      refuse(
        `${sentence(view.name(host))} already generates a ${templateWords[plan.template]} template as a tile; ${plan.lead.name} can't make another.`,
      );
  }
  return { leads, refusals };
}

/** Fills a lead's binding from its own slots and its parts in the same tile. */
function matchLead(view: ModuleView, plan: LeadPlan, refuse: (message: string) => void) {
  const { lead } = plan;
  const host = view.name(lead.host);
  const own = (slot: StudioModuleSlotId) => view.linksOf(lead, slot)[0];
  /** The one module of `kind` in the tile with a link in `slot`; two are refused. */
  const part = (
    kind: StudioComponentKind,
    slot: StudioModuleSlotId,
    accept: (link: ModuleLink) => boolean = () => true,
  ) => {
    const found = view.inHost(lead.host).flatMap((module) => {
      if (module.settings.kind !== kind) return [];
      const link = view.linksOf(module, slot).find(accept);
      return link ? [{ module, link }] : [];
    });
    if (found.length > 1) {
      const tile = found[0]?.link.tile;
      const kindOfTile = tile ? view.kindOf(tile) : undefined;
      refuse(
        `${sentence(host)} has ${count(found.length)} ${kindName(kind)} modules on ${
          (kindOfTile && plural[kindOfTile]) ?? "tiles"
        }; ${lead.name} needs one.`,
      );
    }
    const first = found[0];
    if (first) plan.parts.push(first.module);
    return first;
  };
  const needs: string[] = [];
  const connected = (kind: StudioKind) => `a connection to ${noun(kind)}`;
  const inTile = (kind: StudioComponentKind, on: StudioKind) =>
    `${article(kindName(kind))} connected to ${noun(on)}`;
  const outboxIn = (publisher: StudioComponent, state: GenerationDependency | undefined) => {
    if (!state) return true;
    const outbox = view.linksOf(publisher, "outbox")[0];
    if (outbox?.tile === state.resource) return true;
    needs.push(`${publisher.name}'s outbox connected to ${view.name(state.resource)}`);
    return false;
  };
  const isIdentity = (link: ModuleLink) => !!link.tile && view.kindOf(link.tile) === "identity";
  switch (plan.template) {
    case "owned-multipart": {
      const objects = dependency(own("objects"));
      if (!objects) needs.push(connected("object-store"));
      const state = part("data-access", "database");
      const jobs = part("event-publisher", "channel");
      const guard = part("auth-guard", "identity", isIdentity);
      if (!state) needs.push(inTile("data-access", "database"));
      if (!jobs) needs.push(inTile("event-publisher", "queue"));
      else outboxIn(jobs.module, dependency(state?.link));
      if (!guard) needs.push(inTile("auth-guard", "identity"));
      const stateDep = dependency(state?.link);
      const jobsDep = dependency(jobs?.link);
      if (!needs.length && objects && stateDep && jobsDep && guard?.link.tile)
        plan.binding = {
          kind: "owned-multipart",
          state: stateDep,
          objects,
          identity: { element: guard.link.tile, guard: guard.module.id },
          jobs: jobsDep,
        };
      break;
    }
    case "asset-lifecycle": {
      const state = dependency(own("state"));
      if (!state) needs.push(connected("database"));
      const results = part("event-consumer", "channel");
      const publication = part("event-publisher", "channel");
      if (!results) needs.push(inTile("event-consumer", "queue"));
      if (publication) outboxIn(publication.module, state);
      const resultsDep = dependency(results?.link);
      const publicationDep = dependency(publication?.link);
      if (!needs.length && state && resultsDep)
        plan.binding = {
          kind: "asset-lifecycle",
          // Filled across tiles: the multipart upload writing the same database.
          upload: lead.id,
          state,
          results: resultsDep,
          ...(publicationDep && { publication: publicationDep }),
        };
      break;
    }
    case "video-hls": {
      const originals = dependency(own("originals"));
      if (!originals) needs.push(connected("object-store"));
      const packager = part("video-packager", "outputs");
      const thumbnailer = part("video-thumbnailer", "outputs");
      const jobs = part("event-consumer", "channel");
      const results = part("event-publisher", "channel");
      if (packager && thumbnailer && packager.link.tile !== thumbnailer.link.tile)
        refuse(
          `${sentence(packager.module.name)} and ${thumbnailer.module.name} write different storage; ${lead.name} needs one.`,
        );
      if (!packager) needs.push(inTile("video-packager", "object-store"));
      if (!thumbnailer) needs.push(inTile("video-thumbnailer", "object-store"));
      if (!jobs) needs.push(inTile("event-consumer", "queue"));
      if (!results) needs.push(inTile("event-publisher", "queue"));
      const outputs = dependency(packager?.link);
      const jobsDep = dependency(jobs?.link);
      const resultsDep = dependency(results?.link);
      if (!needs.length && originals && outputs && jobsDep && resultsDep)
        plan.binding = {
          kind: "video-hls",
          originals,
          outputs,
          jobs: jobsDep,
          results: resultsDep,
        };
      break;
    }
    case "positive-cache-read": {
      const cache = dependency(own("cache"));
      if (!cache) needs.push(connected("cache"));
      const loader = view.linksOf(lead, "loader")[0]?.target;
      let source: GenerationDependency | undefined;
      if (!loader || loader.host !== lead.host) needs.push("a Data access as its loader");
      else {
        plan.parts.push(loader);
        source = dependency(view.linksOf(loader, "database")[0]);
        if (!source) needs.push(`${loader.name}, its loader, connected to a database`);
      }
      if (!needs.length && cache && source) {
        plan.binding = { kind: "positive-cache-read", source, cache };
        plan.projects = { store: cache.resource, source: source.resource };
      }
      break;
    }
    case "event-counter": {
      const events = part("event-consumer", "channel");
      const state = part("data-access", "database");
      if (!events) needs.push(inTile("event-consumer", "queue"));
      if (!state) needs.push(inTile("data-access", "database"));
      const eventsDep = dependency(events?.link);
      const stateDep = dependency(state?.link);
      if (!needs.length && eventsDep && stateDep)
        plan.binding = { kind: "event-counter", state: stateDep, events: eventsDep };
      break;
    }
    case "search-projection": {
      const index = dependency(own("index"));
      if (!index) needs.push(connected("search"));
      const events = part("event-consumer", "channel");
      if (!events) needs.push(inTile("event-consumer", "queue"));
      const eventsDep = dependency(events?.link);
      if (!needs.length && index && eventsDep)
        plan.binding = { kind: "search-projection", index, events: eventsDep };
      break;
    }
    case "search-query": {
      const index = dependency(own("index"));
      if (!index) needs.push(connected("search"));
      else plan.binding = { kind: "search-query", index };
      break;
    }
  }
  if (needs.length) {
    plan.missing = needs[0];
    delete plan.binding;
  }
}

/**
 * Settles what crosses tiles until nothing changes: a lifecycle needs the multipart upload writing
 * its database; a search index is a copy of the outbox database feeding its Index writer's
 * queue, which a template must write; a search query needs an Index writer on its index.
 */
function settleAcrossTiles(view: ModuleView, leads: LeadPlan[], kept: Ownership) {
  const generation = designGeneration(view.design);
  const tileLevel = (generation?.selections ?? []).filter((item) => item.target.kind === "element");
  for (let changed = true; changed; ) {
    changed = false;
    const complete = leads.filter((plan) => plan.binding);
    const demote = (plan: LeadPlan, missing: string) => {
      plan.missing = missing;
      delete plan.binding;
      delete plan.projects;
      changed = true;
    };
    const bound = new Set(
      complete.flatMap((plan) =>
        plan.binding ? bindingUses(plan.binding).map((use) => use.store) : [],
      ),
    );
    // In dependency order: a lifecycle, then the index its outbox feeds, then the query.
    const stage = (plan: LeadPlan) =>
      ["asset-lifecycle", "search-projection", "search-query"].indexOf(plan.template);
    for (const plan of [...complete].sort((a, b) => stage(a) - stage(b))) {
      const binding = plan.binding;
      if (!binding) continue;
      if (binding.kind === "asset-lifecycle") {
        const state = binding.state.resource;
        const uploads = [
          ...complete.flatMap((other) =>
            other.binding?.kind === "owned-multipart" && other.binding.state.resource === state
              ? [other.lead.id]
              : [],
          ),
          ...tileLevel.flatMap((item) =>
            item.binding.kind === "owned-multipart" && item.binding.state.resource === state
              ? [item.id]
              : [],
          ),
        ];
        const [upload] = uploads;
        if (!upload)
          demote(plan, `${kindName("multipart-uploads")} writing to ${view.name(state)}`);
        else if (uploads.length > 1)
          demote(
            plan,
            `one ${kindName("multipart-uploads")} writing to ${view.name(state)}, not ${count(uploads.length)}`,
          );
        else binding.upload = upload;
      }
      if (binding.kind === "search-projection") {
        const queue = binding.events.resource;
        const sources = new Set(
          view.links.flatMap((link) => {
            if (link.slot !== "channel" || link.tile !== queue) return [];
            if (link.module.settings.kind !== "event-publisher") return [];
            const outbox = view.linksOf(link.module, "outbox")[0]?.tile;
            return outbox ? [outbox] : [];
          }),
        );
        const [source] = sources;
        const declared = (store: string) =>
          bound.has(store) ||
          kept.resources.some((item) => item.element === store && item.kind === "source");
        if (!source) demote(plan, `an Event publisher with an outbox feeding ${view.name(queue)}`);
        else if (sources.size > 1)
          demote(
            plan,
            `one outbox database feeding ${view.name(queue)}, not ${count(sources.size)}`,
          );
        else if (!declared(source)) demote(plan, `a template writing to ${view.name(source)}`);
        else plan.projects = { store: binding.index.resource, source };
      }
      if (binding.kind === "search-query") {
        const index = binding.index.resource;
        const source =
          complete.find(
            (other) =>
              other.binding?.kind === "search-projection" && other.binding.index.resource === index,
          )?.projects?.source ??
          (tileLevel.some(
            (item) =>
              item.binding.kind === "search-projection" && item.binding.index.resource === index,
          )
            ? kept.resources.find(
                (item): item is Extract<typeof item, { kind: "projection" }> =>
                  item.element === index && item.kind === "projection",
              )?.source
            : undefined);
        if (!source)
          demote(plan, `${article(kindName("index-writer"))} connected to ${view.name(index)}`);
        else plan.projects = { store: index, source };
      }
    }
  }
}

type StoreUse = {
  store: string;
  connection: string;
  access: DeclaredAccess;
  projection: boolean;
};
/** The stores a binding reads or writes, with the access its template needs on each. */
function bindingUses(binding: GenerationBinding): StoreUse[] {
  if (binding.kind === "module-stub") return [];
  const references = generationReferences(binding).resources;
  return generationCapabilities[binding.kind].resources.flatMap((requirement) => {
    const found = references.find((item) => item.field === requirement.field)?.dependency;
    return found && requirement.access
      ? [
          {
            store: found.resource,
            connection: found.connection,
            access: requirement.access,
            projection: requirement.authority === "projection",
          },
        ]
      : [];
  });
}
const widest = (a: DeclaredAccess, b: DeclaredAccess): DeclaredAccess =>
  a === b ? a : "read-write";
const writes = (access: DeclaredAccess) => access !== "read";

/** The ownership keys a set of selections needs: roles, stores, grants and links. */
function ownershipKeys(selections: readonly Pick<GenerationSelection, "target" | "binding">[]) {
  const roles = new Set<string>();
  const resources = new Set<string>();
  const grants = new Set<string>();
  const dependencies = new Set<string>();
  for (const selection of selections) {
    if (selection.binding.kind === "module-stub") continue;
    const host =
      selection.target.kind === "element" ? selection.target.element : selection.target.host;
    roles.add(host);
    if (selection.binding.kind === "owned-multipart") roles.add(selection.binding.identity.element);
    for (const use of bindingUses(selection.binding)) {
      resources.add(use.store);
      grants.add(`${host}/${use.store}`);
      dependencies.add(use.connection);
    }
  }
  return { roles, resources, grants, dependencies };
}

/** Whether a selection in the module's host covers it: its lead, its guard, or a traced link. */
export function covers(
  design: DesignDocument,
  selection: GenerationSelection,
  module: StudioComponent,
) {
  if (generationHost(selection) !== module.host) return false;
  if (selection.binding.kind === "module-stub") return false;
  if (selection.target.kind === "component" && selection.target.component === module.id)
    return true;
  const binding = selection.binding;
  if (binding.kind === "owned-multipart" && binding.identity.guard === module.id) return true;
  const links = design.architecture?.studio?.componentConnections ?? [];
  if (
    selection.target.kind === "component" &&
    binding.kind === "positive-cache-read" &&
    links.some(
      (link) =>
        link.from === (selection.target.kind === "component" ? selection.target.component : "") &&
        link.to.kind === "component" &&
        link.to.id === module.id,
    )
  )
    return true;
  const references = generationReferences(binding).resources;
  return links.some(
    (link) =>
      link.from === module.id &&
      link.to.kind === "element" &&
      references.some(
        (item) =>
          link.to.kind === "element" &&
          item.dependency.resource === link.to.id &&
          item.dependency.connection === link.to.via,
      ),
  );
}

/** The design's module-level generation selections (component targets). */
export function moduleSelections(design: DesignDocument): GenerationSelection[] {
  return (designGeneration(design)?.selections ?? []).filter(
    (item) => item.target.kind === "component",
  );
}
/** Whether the design has module-level generation selections. */
export const hasModuleSelections = (design: DesignDocument) => moduleSelections(design).length > 0;

/**
 * The design's ownership without the facts only `previous` (module-level selections) needed:
 * facts tile-level selections need, and facts no module-level selection needed, are kept. An
 * owner goes with the last fact that named it.
 */
function keptOwnership(design: DesignDocument, previous: readonly GenerationSelection[]) {
  const saved = designOwnership(design);
  const derived = ownershipKeys(previous);
  const tileLevel = ownershipKeys(
    (designGeneration(design)?.selections ?? []).filter((item) => item.target.kind === "element"),
  );
  const derivedBefore = (set: keyof typeof derived, key: string) =>
    derived[set].has(key) && !tileLevel[set].has(key);
  const kept: Ownership = {
    owners: saved.owners,
    roles: saved.roles.filter((item) => !derivedBefore("roles", item.element)),
    resources: saved.resources.filter((item) => !derivedBefore("resources", item.element)),
    grants: saved.grants.filter(
      (item) => !derivedBefore("grants", `${item.role}/${item.resource}`),
    ),
    dependencies: saved.dependencies.filter(
      (item) => !derivedBefore("dependencies", item.connection),
    ),
  };
  // A kept grant or projection still names its role and stores: those stay too.
  for (let grew = true; grew; ) {
    grew = false;
    const roles = new Set(kept.grants.map((item) => item.role));
    const stores = new Set([
      ...kept.grants.map((item) => item.resource),
      ...kept.resources.flatMap((item) => (item.kind === "projection" ? [item.source] : [])),
    ]);
    for (const role of saved.roles)
      if (roles.has(role.element) && !kept.roles.includes(role)) {
        kept.roles.push(role);
        grew = true;
      }
    for (const resource of saved.resources)
      if (stores.has(resource.element) && !kept.resources.includes(resource)) {
        kept.resources.push(resource);
        grew = true;
      }
  }
  kept.roles = saved.roles.filter((item) => kept.roles.includes(item));
  kept.resources = saved.resources.filter((item) => kept.resources.includes(item));
  const dropped = new Set([
    ...saved.roles.filter((item) => !kept.roles.includes(item)).map((item) => item.owner),
    ...saved.resources
      .filter((item) => !kept.resources.includes(item))
      .map((item) => item.authority),
  ]);
  const referenced = new Set([
    ...kept.roles.map((item) => item.owner),
    ...kept.resources.map((item) => item.authority),
  ]);
  kept.owners = saved.owners.filter((item) => !dropped.has(item.id) || referenced.has(item.id));
  return kept;
}

/**
 * Derives the module-level declarations on `draft` (schema 3, with a generation) and returns the
 * ownership and generation operations to send after its studio. `before` is the design the
 * command started from: the facts its module-level selections needed are cleaned up first. Facts
 * that tile-level selections need, or that no module-level selection ever needed, are kept, and a
 * derived fact that contradicts one refuses the command.
 */
export function deriveModuleGeneration(
  before: DesignDocument,
  draft: DesignDocument,
): OperationInput[] {
  if (draft.schemaVersion !== 3 || !draft.generation)
    throw new Error("Module generation needs a schema 3 design with a generation.");
  const previous = moduleSelections(before);
  const plan = planModules(draft, previous);
  const [refusal] = plan.refusals;
  if (refusal) throw new Error(refusal);
  const view = moduleView(draft);
  const complete = plan.leads.filter((item) => item.binding);
  const ownership = deriveOwnership(keptOwnership(draft, previous), draft, view, complete);
  writeValues(draft, view, complete);

  const generation = draft.generation;
  const tileLevel = generation.selections.filter((item) => item.target.kind === "element");
  const byLead = new Map(complete.map((item) => [item.lead.id, item]));
  const parts = new Set(complete.flatMap((item) => item.parts.map((part) => part.id)));
  const stubHosts = generationCapabilities["module-stub"].hosts;
  const selections: GenerationSelection[] = view.modules.flatMap((module) => {
    const lead = byLead.get(module.id);
    if (!lead && parts.has(module.id)) return [];
    // A module a tile-level template traces is generated by that template.
    if (!lead && tileLevel.some((item) => covers(draft, item, module))) return [];
    const hostKind = view.kindOf(module.host);
    if (!lead && (!hostKind || !stubHosts.includes(hostKind))) return [];
    if (tileLevel.some((item) => item.id === module.id))
      throw new Error(
        `The generation selection "${module.id}" already exists; ${module.name} needs that ID for its own.`,
      );
    const target = { kind: "component" as const, component: module.id, host: module.host };
    return lead?.binding
      ? [
          {
            id: module.id,
            target,
            template: generationTemplates[lead.template].ref,
            binding: lead.binding,
          },
        ]
      : [
          {
            id: module.id,
            target,
            template: generationTemplates["module-stub"].ref,
            binding: { kind: "module-stub" },
          },
        ];
  });
  const nextGeneration = { ...generation, selections: [...tileLevel, ...selections] };
  // Sent when they differ from the design the command started from (an upgrade adds both) or
  // from the draft (a removal pruned them).
  const differs = (value: unknown, ...others: unknown[]) =>
    others.some((other) => JSON.stringify(other) !== JSON.stringify(value));
  const ops: OperationInput[] = [];
  if (differs(ownership, designOwnership(before), designOwnership(draft)))
    ops.push({ op: "setOwnership", ownership: structuredClone(ownership) });
  if (differs(nextGeneration, designGeneration(before), generation))
    ops.push({ op: "setGeneration", generation: structuredClone(nextGeneration) });
  draft.ownership = ownership;
  draft.generation = nextGeneration;
  return ops;
}

/** Union-find over hosts. */
function groups(ids: readonly string[]) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    const up = parent.get(id) ?? id;
    if (up === id) return id;
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  return {
    find,
    union: (a: string, b: string) => parent.set(find(a), find(b)),
  };
}

/** Derives the module-level ownership facts on top of the kept ones (contract section 5). */
function deriveOwnership(
  kept: Ownership,
  draft: DesignDocument,
  view: ModuleView,
  complete: LeadPlan[],
): Ownership {
  const name = view.name;
  const byRank = (a: string, b: string) => view.rank(a) - view.rank(b);
  const hosts = [...new Set(complete.map((item) => item.lead.host))].sort(byRank);
  const identities = [
    ...new Set(
      complete.flatMap((item) =>
        item.binding?.kind === "owned-multipart" ? [item.binding.identity.element] : [],
      ),
    ),
  ].sort(byRank);
  const uses = complete.flatMap((item) =>
    item.binding
      ? bindingUses(item.binding).map((use) => ({ ...use, host: item.lead.host, plan: item }))
      : [],
  );
  const stores = [...new Set(uses.map((use) => use.store))].sort(byRank);
  const writers = (store: string) =>
    [
      ...new Set(
        uses.filter((use) => use.store === store && writes(use.access)).map((use) => use.host),
      ),
    ].sort(byRank);

  // Owners: the writers of one store share one; a host that only reads a projection joins its
  // owner; any other host, and each Identity a guard binds, gets its own.
  const sets = groups([...hosts, ...identities]);
  for (const store of stores) {
    const [first, ...rest] = writers(store);
    for (const other of rest) if (first) sets.union(first, other);
  }
  for (const host of hosts) {
    const own = uses.filter((use) => use.host === host);
    if (own.some((use) => writes(use.access))) continue;
    for (const use of own) {
      const [writer] = writers(use.store);
      if (use.projection && writer) sets.union(host, writer);
    }
  }
  const members = new Map<string, string[]>();
  for (const id of [...hosts, ...identities].sort(byRank)) {
    const root = sets.find(id);
    members.set(root, [...(members.get(root) ?? []), id]);
  }
  const keptRole = (id: string) => kept.roles.find((item) => item.element === id);
  const keptResource = (id: string) => kept.resources.find((item) => item.element === id);
  const ownerName = (id: string) => [...kept.owners].find((item) => item.id === id)?.name ?? id;
  const taken = new Set([...usedIds(draft), ...kept.owners.map((item) => item.id)]);
  const newOwners: Ownership["owners"] = [];
  const ownerOf = new Map<string, string>();
  for (const group of members.values()) {
    const fromRoles = group.flatMap((id) => {
      const role = keptRole(id);
      return role ? [{ id: role.owner, why: id }] : [];
    });
    const fromStores = stores.flatMap((store) => {
      const authority = keptResource(store)?.authority;
      return authority && writers(store).some((host) => group.includes(host))
        ? [{ id: authority, why: store }]
        : [];
    });
    const candidates = [...new Set([...fromRoles, ...fromStores].map((item) => item.id))];
    if (candidates.length > 1) {
      const store = stores.find(
        (id) => writers(id).length > 1 && writers(id).every((host) => group.includes(host)),
      );
      throw new Error(
        store
          ? `${sentence(list(writers(store).map(name)))} both write ${name(store)}, but they already have different owners (${list(candidates.map(ownerName))}).`
          : `${sentence(list(group.map(name)))} would need two owners: ${list(candidates.map(ownerName))}.`,
      );
    }
    let owner = candidates[0];
    const [first] = group;
    if (!owner && first) {
      owner = freshId(`${first}-owner`, (id) => taken.has(id));
      taken.add(owner);
      newOwners.push({ id: owner, name: name(first) });
    }
    if (owner) for (const id of group) ownerOf.set(id, owner);
  }

  const roles = [...kept.roles];
  for (const id of [...hosts, ...identities]) {
    const kind = view.kindOf(id) === "worker" ? "worker" : "api";
    const owner = ownerOf.get(id);
    if (!owner) continue;
    const existing = keptRole(id);
    if (existing && existing.kind !== kind)
      throw new Error(
        `${sentence(name(id))} is declared ${existing.kind === "worker" ? "a worker" : "an API"} role, but its template needs ${kind === "worker" ? "a worker" : "an API"} role.`,
      );
    if (!existing) roles.push({ element: id, owner, kind });
  }

  const resources = [...kept.resources];
  const authorityOf = new Map<string, string>();
  for (const store of stores) {
    const [writer] = writers(store);
    const readers = uses.filter((use) => use.store === store).map((use) => use.host);
    const existing = keptResource(store);
    const authority =
      (writer && ownerOf.get(writer)) ??
      existing?.authority ??
      ownerOf.get([...readers].sort(byRank)[0] ?? "");
    if (!authority) continue;
    authorityOf.set(store, authority);
    const projected = uses.find((use) => use.store === store && use.projection);
    const sources = new Set(
      uses
        .filter((use) => use.store === store && use.projection)
        .flatMap((use) => (use.plan.projects?.store === store ? [use.plan.projects.source] : [])),
    );
    if (sources.size > 1)
      throw new Error(
        `${sentence(name(store))} would be a copy of ${list([...sources].map(name))}; it can copy one database.`,
      );
    const [source] = sources;
    if (existing) {
      if (projected && existing.kind !== "projection")
        throw new Error(
          `${sentence(name(store))} is declared its own source of truth, but ${projected.plan.lead.name} needs it as a copy of ${name(source ?? "")}.`,
        );
      if (!projected && existing.kind === "projection")
        throw new Error(
          `${sentence(name(store))} is declared a copy of ${name(existing.source)}, but its templates need it as a source of truth.`,
        );
      if (existing.kind === "projection" && source && existing.source !== source)
        throw new Error(
          `${sentence(name(store))} is declared a copy of ${name(existing.source)}, not ${name(source)}.`,
        );
      if (existing.authority !== authority)
        throw new Error(
          `${sentence(name(store))} already has another owner (${ownerName(existing.authority)}).`,
        );
      continue;
    }
    resources.push(
      projected && source
        ? { element: store, authority, kind: "projection", source }
        : { element: store, authority, kind: "source" },
    );
  }

  const grants = [...kept.grants];
  const pairs = new Map<string, { host: string; store: string; access: DeclaredAccess }>();
  for (const use of uses) {
    const key = `${use.host}/${use.store}`;
    const pair = pairs.get(key);
    pairs.set(key, {
      host: use.host,
      store: use.store,
      access: pair ? widest(pair.access, use.access) : use.access,
    });
  }
  for (const [key, pair] of pairs) {
    const foreign = ownerOf.get(pair.host) !== authorityOf.get(pair.store);
    if (foreign && writes(pair.access))
      throw new Error(
        `${sentence(name(pair.host))} would write ${name(pair.store)}, which another owner holds.`,
      );
    const existing = kept.grants.find((item) => `${item.role}/${item.resource}` === key);
    if (existing) {
      if (!accessAllows(existing.access, pair.access) || (foreign && !existing.boundary))
        throw new Error(
          `${sentence(name(pair.host))}'s declared access to ${name(pair.store)} doesn't allow what its template needs.`,
        );
      continue;
    }
    grants.push({
      role: pair.host,
      resource: pair.store,
      access: pair.access,
      ...(foreign && { boundary: "published-read" as const }),
    });
  }

  const dependencies = [...kept.dependencies];
  const links = new Map<string, DeclaredAccess>();
  for (const use of uses) {
    const access = links.get(use.connection);
    links.set(use.connection, access ? widest(access, use.access) : use.access);
  }
  for (const [connection, access] of links) {
    const existing = kept.dependencies.find((item) => item.connection === connection);
    if (existing) {
      if (!accessAllows(existing.access, access))
        throw new Error(
          `The link ${connection} is declared ${existing.access}, but its template needs ${access}.`,
        );
      continue;
    }
    dependencies.push({ connection, access });
  }
  return { owners: [...kept.owners, ...newOwners], roles, resources, grants, dependencies };
}

const initial = {
  requestTimeoutMs: 1000,
  concurrencyLimit: 1000,
  concurrency: 4,
  ttlSeconds: 3600,
  poolSize: 10,
  statementTimeoutMs: 2000,
} as const;

/**
 * The values a selected template fixes, written where the tile or module still holds its
 * creation default or `unspecified`, and an initial value for each needed user setting with
 * none. Any other value is kept: the module's status then says why it is refused.
 */
function writeValues(draft: DesignDocument, view: ModuleView, complete: LeadPlan[]) {
  const studio = draft.architecture?.studio;
  if (!studio) return;
  type Settings = Record<string, unknown>;
  const tile = (id: string) =>
    studio.elements.find((item) => item.element === id)?.settings as Settings | undefined;
  const module = (id: string) =>
    studio.components?.find((item) => item.id === id)?.settings as Settings | undefined;
  /** Writes `value` where the setting holds `from` (a creation default) or is absent. */
  const fix = (settings: Settings | undefined, key: string, value: unknown, from?: unknown) => {
    if (!settings) return;
    if (settings[key] === undefined || (from !== undefined && settings[key] === from))
      settings[key] = value;
  };
  const unspecified = (settings: Settings | undefined, key: string, value: string) =>
    fix(settings, key, value, "unspecified");
  for (const plan of complete) {
    const binding = plan.binding;
    if (!binding || binding.kind === "module-stub") continue;
    const capability = generationCapabilities[binding.kind];
    const hostId = plan.lead.host;
    const host = tile(hostId);
    const hostKind = view.kindOf(hostId);
    const rules = new Set(capability.settings.map((rule) => rule.input));
    if (rules.has("host.requestTimeoutMs")) {
      fix(host, "requestTimeoutMs", initial.requestTimeoutMs);
      fix(host, "concurrencyLimit", initial.concurrencyLimit);
      if (view.isEntry(hostId) && hostKind && host?.exposure !== undefined)
        fix(
          host,
          "exposure",
          "public",
          (createStudioSettings(hostKind) as Settings).exposure ?? "internal",
        );
    }
    if (rules.has("host.concurrency"))
      fix(host, "concurrency", binding.kind === "video-hls" ? 1 : initial.concurrency);
    const references = generationReferences(binding).resources;
    for (const requirement of capability.resources) {
      const found = references.find((item) => item.field === requirement.field)?.dependency;
      if (!found) continue;
      const store = tile(found.resource);
      unspecified(store, "provider", "self-hosted");
      if (requirement.kind === "database") unspecified(store, "engine", "postgresql");
      if (requirement.kind === "search") unspecified(store, "engine", "opensearch");
      if (requirement.kind === "cache") {
        unspecified(store, "engine", "redis-compatible");
        fix(store, "ttlSeconds", initial.ttlSeconds);
      }
      if (requirement.kind === "queue" && requirement.mode === "topic")
        fix(store, "mode", "topic", "work-queue");
      if (requirement.kind === "object-store" && requirement.field === "outputs")
        fix(store, "access", "public", "private");
    }
    // Modules: the SQL settings of the Data access a database field reads, the outboxes, the
    // cache reader's single flight.
    for (const part of [plan.lead, ...plan.parts]) {
      const settings = module(part.id);
      const kind = part.settings.kind;
      if (kind === "data-access" || kind === "lifecycle-writer") {
        fix(settings, "poolSize", initial.poolSize);
        fix(settings, "statementTimeoutMs", initial.statementTimeoutMs);
      }
      if (kind === "event-publisher") {
        const field = references.find(
          (item) =>
            item.channel === "publish" &&
            view
              .linksOf(part, "channel")
              .some(
                (link) =>
                  link.tile === item.dependency.resource && link.via === item.dependency.connection,
              ),
        )?.field;
        if (field === "jobs" || field === "publication")
          fix(settings, "outbox", "enabled", "disabled");
      }
      if (kind === "cache-reader") fix(settings, "stampede", "single-flight", "none");
    }
    if (binding.kind === "owned-multipart")
      fix(tile(binding.identity.element), "exposure", "public", "internal");
  }
}

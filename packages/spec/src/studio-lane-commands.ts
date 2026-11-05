/**
 * Lane commands: add a tile, link two tiles, remove a tile or a link, and switch a tile's kind.
 * The canvas, chat and API share them through `buildStudioCommand`. Each one is checked with the
 * board edits (`@jeeves/board/graph`) under the lane rules, and a refusal names the rule in plain
 * words with tile names. The pure helpers tell the canvas and chat which tabs a tile shows, which
 * tile types its fan offers, and what removing a tile strands.
 */
import {
  addAfter,
  applyRemoval,
  type BoardEdge,
  checkGraph,
  type GraphViolation,
  insertBefore,
  link,
  planRemoval,
  type RemovalPlan,
  type Result,
  removeEdge,
  unreachableFrom,
  wouldCreateCycle,
} from "@jeeves/board/graph";
import { z } from "zod";
import { type DesignDocument, designIds, elementSchema } from "./design.ts";
import { idSchema } from "./ids.ts";
import type { OperationInput } from "./operations.ts";
import { type StudioComponentTargetKind, studioComponentDefinitions } from "./studio-components.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { LANE_ACTOR, laneFindings, laneGraph, laneRules } from "./studio-lanes.ts";
import {
  laneLimits,
  type StudioLinkMode,
  studioKindNoun,
  studioLinkDefaults,
} from "./studio-links.ts";
import {
  createStudioSettings,
  type StudioKind,
  type StudioLane,
  type StudioModel,
  studioDefinitionRef,
  studioKindSchema,
  studioLaneSchema,
  studioLanes,
  studioLimits,
  studioResourceKinds,
} from "./studio-model.ts";
import type { StudioConnectionCreation } from "./studio-operations.ts";
import { pruneStudioAfterDelete } from "./studio-prune.ts";
import {
  defaultKind,
  type StudioTileType,
  studioTileDefinitions,
  studioTileTypes,
  tileTypeOf,
} from "./studio-tiles.ts";

const tileName = z.string().trim().min(1).max(studioLimits.name);
const tileDescription = z.string().trim().max(studioLimits.description);
/** Where a lane command starts: one of the user's lanes (an entry), or a tile. */
export const laneFromSchema = z.union([
  z.strictObject({ lane: studioLaneSchema }),
  z.strictObject({ tile: idSchema }),
]);
export type LaneFrom = z.infer<typeof laneFromSchema>;
/** `after` adds on the right of a tile (host → new); `before` inserts on its left. */
export const laneSideSchema = z.enum(["after", "before"]);
export type LaneSide = z.infer<typeof laneSideSchema>;
const laneLinkSchema = z.enum(["sync", "async"]);

/** The lane commands, part of `studioCommandSchema`. */
export const laneCommandSchemas = [
  /**
   * A new tile after a tile or a lane (an entry), or before a tile. A lane is always `after` and
   * `sync`. `system` creates the system with the first tile of a new project.
   */
  z.strictObject({
    type: z.literal("addTile"),
    from: laneFromSchema,
    side: laneSideSchema,
    link: laneLinkSchema,
    tile: z.strictObject({
      id: idSchema,
      name: tileName,
      kind: studioKindSchema,
      description: tileDescription.optional(),
    }),
    linkId: idSchema,
    system: z.strictObject({ name: tileName, description: tileDescription.optional() }).optional(),
  }),
  /** Links a lane or a tile to a tile already on the board (a merge). */
  z.strictObject({
    type: z.literal("linkTiles"),
    from: laneFromSchema,
    to: idSchema,
    link: laneLinkSchema,
    linkId: idSchema,
  }),
  /** Removes a tile and restitches its links; `alsoRemove` names every tile that strands. */
  z.strictObject({
    type: z.literal("removeTile"),
    tile: idSchema,
    alsoRemove: z.array(idSchema).max(studioLimits.elements).optional(),
  }),
  /** Removes a connection or an entry, unless that strands a tile. */
  z.strictObject({ type: z.literal("removeLink"), link: idSchema }),
  /** Switches a tile to another kind of its tile type; its settings start from the defaults. */
  z.strictObject({ type: z.literal("changeKind"), element: idSchema, kind: studioKindSchema }),
] as const;
export type LaneCommand = z.infer<(typeof laneCommandSchemas)[number]>;

export type LaneTab = { from: LaneFrom; side: LaneSide; mode: StudioLinkMode };
export type LaneChoice = { type: StudioTileType; kind: StudioKind };
export type LaneResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** A lane command refused, with the reason in plain words. */
class LaneRefusal extends Error {}
function refuse(message: string): never {
  throw new LaneRefusal(message);
}
function attempt<T>(run: () => T): LaneResult<T> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    if (error instanceof LaneRefusal) return { ok: false, message: error.message };
    throw error;
  }
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: readonly string[], last = "and") =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
const noun = studioKindNoun;
const isApplication = (kind: StudioKind | undefined) =>
  kind !== undefined && studioDefinitions[kind].classification.kind === "Application";
const isResource = (kind: StudioKind) => studioResourceKinds.some((item) => item === kind);

type Tile = { id: string; kind: StudioKind; name?: string };
/**
 * The design's lane graph with names and rules. The returned view function adds a tile an edit
 * is about to create, or overrides a tile's kind, so the rules can judge it.
 */
function lanes(design: DesignDocument) {
  const graph = laneGraph(design);
  const kinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const names = new Map(design.elements.map((element) => [element.id, element.name]));
  const entries = design.architecture?.studio?.entries ?? [];
  return (tile?: Tile) => {
    const kindOf = (id: string) => (id === tile?.id ? tile.kind : kinds.get(id));
    const name = (id: string) =>
      id === LANE_ACTOR
        ? "the user"
        : id === tile?.id && tile.name
          ? tile.name
          : (names.get(id) ?? id);
    return {
      graph,
      entries,
      kindOf,
      name,
      has: (id: string) => kinds.has(id),
      rules: laneRules(kindOf),
    };
  };
}
type Lanes = ReturnType<ReturnType<typeof lanes>>;

/** Lane commands start from a design that keeps the lane rules. */
function requireLanes(design: DesignDocument) {
  const [broken] = laneFindings(design);
  if (broken) refuse(`Fix the lanes first. ${broken.message}`);
}

/** A board refusal or violation in plain words, with tile names instead of IDs. */
function explain(view: Lanes, violation: GraphViolation): string {
  const node = violation.node && view.name(violation.node);
  if (node && violation.code === "cycle")
    return `${sentence(node)} would lead back to itself; links can't form a loop.`;
  if (node && violation.code === "unreachable")
    return `${sentence(node)} would be cut off from the user.`;
  if (node && violation.code === "too-many-links")
    return `${sentence(node)} would have more than ${laneLimits.outgoingLinks} links.`;
  return sentence(violation.message.replace(/"([^"]*)"/g, (_, id: string) => view.name(id)));
}
const refusalOf = <T>(view: Lanes, result: Result<T>) =>
  result.ok ? undefined : explain(view, result);

/** Why a new `source → target` link is refused, or `undefined`. `lane` names an entry's lane. */
function linkRefusal(
  view: Lanes,
  source: string,
  target: string,
  async: boolean,
  lane?: StudioLane,
): string | undefined {
  const { name } = view;
  if (source === target) return `${sentence(name(source))} can't link to itself.`;
  if (source === LANE_ACTOR) {
    // A tile starts at most one lane, so an entry in the other lane counts as a duplicate too.
    const entry = view.entries.find((item) => item.element === target);
    if (entry)
      return `${sentence(name(target))} already starts the ${entry.lane} lane; a tile can start only one lane.`;
  } else if (view.graph.edges.some((edge) => edge.source === source && edge.target === target))
    return `${sentence(name(source))} already links to ${name(target)}.`;
  if (wouldCreateCycle(view.graph.edges, source, target))
    return `${sentence(name(target))} already leads to ${name(source)}; linking them would make a loop.`;
  const reason = view.rules.refusal(source, target, async);
  if (reason)
    return source === LANE_ACTOR
      ? `${sentence(name(target))} can't start the ${lane} lane. ${reason}`
      : `${sentence(name(source))} can't link to ${name(target)}. ${reason}`;
  if (source === LANE_ACTOR) {
    const count = view.entries.filter((item) => item.lane === lane).length;
    if (count >= laneLimits.entriesPerLane)
      return `The ${lane} lane already has ${count} entries; the most is ${laneLimits.entriesPerLane}.`;
  } else {
    const count = view.graph.edges.filter((edge) => edge.source === source).length;
    if (count >= laneLimits.outgoingLinks)
      return `${sentence(name(source))} already has ${count} links; the most is ${laneLimits.outgoingLinks}.`;
  }
  return undefined;
}

/** Why a `linkTiles` from `from` to the existing tile `to` is refused, or `undefined`. */
function linkTilesRefusal(
  view: Lanes,
  from: LaneFrom,
  to: string,
  async: boolean,
): string | undefined {
  const source = "lane" in from ? LANE_ACTOR : from.tile;
  if (source === LANE_ACTOR && !("lane" in from))
    return "A link from the user starts a lane; pull from the user's download or upload tab.";
  if (to === LANE_ACTOR)
    return "Links don't lead back to the user; pull from the user's download or upload tab to start a lane.";
  for (const id of [source, to]) if (!view.has(id)) return `There is no tile "${id}".`;
  return (
    linkRefusal(view, source, to, async, "lane" in from ? from.lane : undefined) ??
    refusalOf(view, link(view.graph, source, to, { id: "@new-link", async }, view.rules))
  );
}

/** Why adding `tile` is refused, or `undefined`. `view` must already know the tile. */
function addTileRefusal(
  view: Lanes,
  from: LaneFrom,
  side: LaneSide,
  async: boolean,
  tile: Tile,
  linkId: string,
): string | undefined {
  if (!tileTypeOf(tile.kind)) return "Browser apps aren't tiles; the user is the client.";
  const node = { id: tile.id };
  const edge = { id: linkId, async };
  if ("lane" in from) {
    if (side === "before") return "Nothing goes before the user.";
    return (
      linkRefusal(view, LANE_ACTOR, tile.id, async, from.lane) ??
      refusalOf(view, addAfter(view.graph, LANE_ACTOR, node, edge, view.rules))
    );
  }
  const host = from.tile;
  if (!view.has(host)) return `There is no tile "${host}".`;
  if (side === "after")
    return (
      linkRefusal(view, host, tile.id, async) ??
      refusalOf(view, addAfter(view.graph, host, node, edge, view.rules))
    );
  // Every link into the host moves to the new tile and keeps its mode; an entry keeps its lane.
  for (const item of view.graph.edges) {
    if (item.target !== host) continue;
    const reason = view.rules.refusal(item.source, tile.id, item.async);
    if (reason)
      return item.lane
        ? `${sentence(view.name(tile.id))} can't start the ${item.lane} lane. ${reason}`
        : `${sentence(view.name(item.source))} can't link to ${view.name(tile.id)}. ${reason}`;
  }
  return (
    linkRefusal(view, tile.id, host, async) ??
    refusalOf(view, insertBefore(view.graph, host, node, edge, view.rules))
  );
}

/**
 * Plans removing `tile` with the board's fan pairings. A restitched link gets a fresh ID
 * (`source-target`, or `lane-target` for an entry); restitched entries stay in the removed
 * tile's lane, which still holds at most `entriesPerLane`.
 */
function removal(view: Lanes, design: DesignDocument, tile: string): RemovalPlan {
  if (!view.has(tile) || tile === LANE_ACTOR) refuse(`There is no tile "${tile}".`);
  const lane = view.entries.find((entry) => entry.element === tile)?.lane;
  const used = usedIds(design);
  const plan = planRemoval(view.graph, tile, view.rules, (source, target, taken) =>
    freshId(
      source === LANE_ACTOR ? `${lane ?? "entry"}-${target}` : `${source}-${target}`,
      (id) => taken.has(id) || used.has(id),
    ),
  );
  if (!plan.ok)
    refuse(
      plan.code === "too-many-links" && plan.node
        ? `Removing ${view.name(tile)} would give ${view.name(plan.node)} more than ${laneLimits.outgoingLinks} links.`
        : explain(view, plan),
    );
  if (lane) {
    const count =
      view.entries.filter((entry) => entry.lane === lane && entry.element !== tile).length +
      plan.value.addEdges.filter((edge) => edge.source === LANE_ACTOR).length;
    if (count > laneLimits.entriesPerLane)
      refuse(
        `Removing ${view.name(tile)} would give the ${lane} lane ${count} entries; the most is ${laneLimits.entriesPerLane}.`,
      );
  }
  return plan.value;
}

/** Every identity in use, including C1 declarations and components. */
function usedIds(design: DesignDocument): Set<string> {
  const architecture = design.architecture;
  return new Set([
    "system",
    ...Array.from(designIds(design), (item) => item.id),
    ...(architecture?.nodes ?? []).map((item) => item.id),
    ...(architecture?.relationships ?? []).map((item) => item.id),
    ...(architecture?.studio?.components ?? []).map((item) => item.id),
    ...(architecture?.studio?.componentConnections ?? []).map((item) => item.id),
  ]);
}
function requireFree(design: DesignDocument, ids: string[]) {
  const used = usedIds(design);
  ids.forEach((id, index) => {
    if (used.has(id) || ids.indexOf(id) !== index) refuse(`The ID "${id}" is already in use.`);
  });
}
/** `base`, or `base-2`, `base-3`…, shortened to fit an ID. */
function freshId(base: string, taken: (id: string) => boolean): string {
  const fit = (text: string, room: number) => text.slice(0, room).replace(/-+$/, "");
  const stem = idSchema.safeParse(fit(base, 63)).success ? base : "link";
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? "" : `-${n}`;
    const id = `${fit(stem, 63 - suffix.length)}${suffix}`;
    if (!taken(id)) return id;
  }
}

type Draft = { design: DesignDocument; studio: StudioModel; ops: OperationInput[] };

function addElement(
  out: Draft,
  tile: Tile & { name: string; description?: string },
  owner?: string,
) {
  const element = elementSchema.parse({
    id: tile.id,
    name: tile.name,
    ...(tile.description !== undefined && { description: tile.description }),
    classification: { ...studioDefinitions[tile.kind].classification },
  });
  out.ops.push({ op: "addElement", element: structuredClone(element) });
  out.design.elements.push(element);
  out.studio.elements.push({
    element: tile.id,
    definition: studioDefinitionRef(tile.kind),
    settings: createStudioSettings(tile.kind),
    ...(owner && { owner: { kind: "element" as const, id: owner } }),
  });
}
function connect(out: Draft, item: StudioConnectionCreation) {
  const connection = {
    id: item.id,
    kind: item.kind,
    from: { element: item.from },
    to: { element: item.to },
    planned: item.planned,
  };
  out.ops.push({ op: "connect", connection: structuredClone(connection) });
  out.design.connections.push(connection);
  out.studio.connections.push({ connection: item.id, settings: item.settings });
}
function disconnect(out: Draft, id: string) {
  out.ops.push({ op: "disconnect", id });
  out.design.connections = out.design.connections.filter((item) => item.id !== id);
  pruneStudioAfterDelete(out.design, [], [id]);
}
/** The connection a lane link gets: the link table's defaults for the two kinds in this mode. */
function linkConnection(
  view: Lanes,
  id: string,
  from: string,
  to: string,
  mode: StudioLinkMode,
): StudioConnectionCreation {
  const source = view.kindOf(from);
  const target = view.kindOf(to);
  const defaults = source && target ? studioLinkDefaults(source, target, mode) : undefined;
  if (!defaults?.ok) return refuse(defaults?.message ?? "Both tiles need studio settings.");
  return { id, from, to, ...defaults.value };
}
const modeOf = (edge: { async?: boolean }): StudioLinkMode => (edge.async ? "async" : "sync");
const addEntry = (out: Draft, entry: { id: string; lane: StudioLane; element: string }) => {
  out.studio.entries = [...(out.studio.entries ?? []), entry];
};

/**
 * A resource whose owner is gone, or is no longer an application, passes to the first
 * application that links to it (a queue: its first publisher, else its first consumer).
 */
function adoptOrphans(out: Draft) {
  const { design, studio } = out;
  const kinds = new Map(studio.elements.map((item) => [item.element, item.settings.kind]));
  const packages = new Set(studio.packages.map((item) => item.id));
  const application = (id: string) => isApplication(kinds.get(id));
  for (const binding of studio.elements) {
    const owner = binding.owner;
    if (!owner || (owner.kind === "package" ? packages.has(owner.id) : application(owner.id)))
      continue;
    const next =
      design.connections.find(
        (item) => item.to.element === binding.element && application(item.from.element),
      )?.from.element ??
      design.connections.find(
        (item) => item.from.element === binding.element && application(item.to.element),
      )?.to.element;
    if (next) binding.owner = { kind: "element", id: next };
    else delete binding.owner;
  }
}

/** What a component may use this kind as (validation's target kinds). */
function componentTarget(kind: StudioKind): StudioComponentTargetKind {
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

/**
 * Applies a lane command to the draft (its `architecture.studio` is `studio`) and returns the
 * operations. Refusals are thrown as errors with plain-words messages.
 */
export function buildLaneCommand(
  draft: DesignDocument,
  studio: StudioModel,
  input: LaneCommand,
): OperationInput[] {
  requireLanes(draft);
  const out: Draft = { design: draft, studio, ops: [] };
  const at = lanes(draft);
  switch (input.type) {
    case "addTile": {
      const { from, tile } = input;
      requireFree(draft, [tile.id, input.linkId]);
      const view = at(tile);
      const why = addTileRefusal(
        view,
        from,
        input.side,
        input.link === "async",
        tile,
        input.linkId,
      );
      if (why) refuse(why);
      if ("lane" in from) {
        addElement(out, tile);
        addEntry(out, { id: input.linkId, lane: from.lane, element: tile.id });
        break;
      }
      // A new resource is owned by the application it is added next to.
      const host = from.tile;
      const owner = isResource(tile.kind) && isApplication(view.kindOf(host)) ? host : undefined;
      if (tile.kind === "queue" && !owner) refuse("A queue needs an application next to it.");
      addElement(out, tile, owner);
      if (input.side === "after") {
        connect(out, linkConnection(view, input.linkId, host, tile.id, input.link));
        break;
      }
      // Before: every link into the host now enters the new tile. A moved connection keeps its
      // ID and mode and takes the link table's defaults for its new target.
      for (const entry of studio.entries ?? []) if (entry.element === host) entry.element = tile.id;
      for (const edge of view.graph.edges) {
        if (edge.target !== host || edge.lane) continue;
        disconnect(out, edge.id);
        connect(out, linkConnection(view, edge.id, edge.source, tile.id, modeOf(edge)));
      }
      connect(out, linkConnection(view, input.linkId, tile.id, host, input.link));
      break;
    }
    case "linkTiles": {
      const { from, to } = input;
      requireFree(draft, [input.linkId]);
      const view = at();
      const why = linkTilesRefusal(view, from, to, input.link === "async");
      if (why) refuse(why);
      if ("lane" in from) addEntry(out, { id: input.linkId, lane: from.lane, element: to });
      else connect(out, linkConnection(view, input.linkId, from.tile, to, input.link));
      break;
    }
    case "removeLink": {
      const view = at();
      const edge = view.graph.edges.find((item) => item.id === input.link);
      if (!edge) return refuse(`There is no link "${input.link}".`);
      const result = removeEdge(view.graph, edge.id, view.rules);
      if (!result.ok) {
        const what = edge.lane
          ? `the ${edge.lane} entry to ${view.name(edge.target)}`
          : `the link from ${view.name(edge.source)} to ${view.name(edge.target)}`;
        if (result.code !== "strands") refuse(explain(view, result));
        const rest = view.graph.edges.filter((item) => item.id !== edge.id);
        const strands = unreachableFrom({ nodes: view.graph.nodes, edges: rest }, LANE_ACTOR);
        refuse(`Removing ${what} would cut off ${list(strands.map(view.name))}.`);
      }
      if (edge.lane) studio.entries = studio.entries?.filter((item) => item.id !== edge.id);
      else disconnect(out, edge.id);
      break;
    }
    case "removeTile": {
      const view = at();
      const plan = removal(view, draft, input.tile);
      const also = [...new Set(input.alsoRemove ?? [])];
      const name = view.name(input.tile);
      if (plan.strands.some((id) => !also.includes(id))) {
        const them = plan.strands.length === 1 ? "it" : "them";
        refuse(
          `Removing ${name} would cut off ${list(plan.strands.map(view.name))}; list ${them} in alsoRemove to remove ${them} too.`,
        );
      }
      const extra = also.filter((id) => !plan.strands.includes(id));
      if (extra.length)
        refuse(
          `Removing ${name} doesn't cut off ${list(extra.map(view.name))}; remove ${extra.length === 1 ? "it" : "them"} separately.`,
        );
      const result = applyRemoval(view.graph, plan, also, view.rules);
      if (!result.ok) refuse(explain(view, result));
      removeTiles(out, view, [input.tile, ...plan.strands], plan.addEdges);
      break;
    }
    case "changeKind":
      changeKind(out, at, input);
      break;
  }
  // The board edits checked the change; this also covers the lane entry cap.
  const [broken] = laneFindings(draft);
  if (broken) refuse(broken.message);
  return out.ops;
}

/**
 * Removes the first tile and the tiles it strands, then adds the restitched links. Restitched
 * entries take the removed tile's entry's place and lane.
 */
function removeTiles(out: Draft, view: Lanes, removed: string[], restitched: BoardEdge[]) {
  const { design, studio } = out;
  const [tile] = removed;
  const gone = new Set(removed);
  for (const id of removed) out.ops.push({ op: "removeElement", id });
  const connections = design.connections
    .filter((item) => gone.has(item.from.element) || gone.has(item.to.element))
    .map((item) => item.id);
  design.elements = design.elements.filter((item) => !gone.has(item.id));
  design.connections = design.connections.filter((item) => !connections.includes(item.id));
  studio.entries = studio.entries?.flatMap((entry) =>
    entry.element === tile
      ? restitched
          .filter((edge) => edge.source === LANE_ACTOR)
          .map((edge) => ({ id: edge.id, lane: entry.lane, element: edge.target }))
      : [entry],
  );
  // Hosted modules, links, entries, package memberships and settings that named what went.
  pruneStudioAfterDelete(design, removed, connections);
  for (const edge of restitched)
    if (edge.source !== LANE_ACTOR)
      connect(out, linkConnection(view, edge.id, edge.source, edge.target, modeOf(edge)));
  adoptOrphans(out);
}

function changeKind(
  out: Draft,
  at: ReturnType<typeof lanes>,
  input: Extract<LaneCommand, { type: "changeKind" }>,
) {
  const { design, studio } = out;
  const { kind } = input;
  const binding = studio.elements.find((item) => item.element === input.element);
  const element = design.elements.find((item) => item.id === input.element);
  if (!binding || !element) return refuse(`There is no tile "${input.element}".`);
  const name = sentence(element.name);
  const current = binding.settings.kind;
  const type = tileTypeOf(current);
  if (!type) return refuse("Browser apps aren't tiles; the user is the client.");
  const definition = studioTileDefinitions[type];
  if (tileTypeOf(kind) !== type) {
    const others = definition.kinds.filter((item) => item !== current);
    refuse(
      others.length
        ? `${name} can switch only to another ${definition.name} kind: ${list(others.map(noun), "or")}.`
        : `${name} can't change kind; ${definition.name} tiles have one kind.`,
    );
  }
  if (kind === current) refuse(`${name} is already ${noun(kind)}.`);

  // Every link and entry must still be allowed with the new kind.
  const view = at({ id: element.id, kind });
  for (const edge of view.graph.edges) {
    if (edge.source !== element.id && edge.target !== element.id) continue;
    const reason = view.rules.refusal(edge.source, edge.target, edge.async);
    if (reason) refuse(`${name} can't become ${noun(kind)}. ${reason}`);
  }
  const [violation] = checkGraph(view.graph, view.rules);
  if (violation) refuse(explain(view, violation));
  // Modules live in applications, and other modules' links to this tile must still fit.
  const application = isApplication(kind);
  const components = studio.components ?? [];
  if (!application && components.some((item) => item.host === element.id))
    refuse(`${name} holds modules, and ${noun(kind)} can't. Remove its modules first.`);
  const target = componentTarget(kind);
  for (const item of studio.componentConnections ?? []) {
    if (item.to.kind !== "element" || item.to.id !== element.id) continue;
    const component = components.find((candidate) => candidate.id === item.from);
    if (component && !studioComponentDefinitions[component.settings.kind].targets.includes(target))
      refuse(
        `${sentence(component.name)} in ${view.name(component.host)} can't use ${noun(kind)}; remove its link to ${element.name} first.`,
      );
  }

  // The tile keeps its name, purpose, links and owner; its settings start over.
  binding.settings = createStudioSettings(kind);
  binding.definition = studioDefinitionRef(kind);
  const classification = { ...studioDefinitions[kind].classification };
  if (element.classification?.kind !== classification.kind) {
    out.ops.push({ op: "updateElement", id: element.id, classification });
    element.classification = classification;
  }
  // Settings elsewhere that only fit the old kind are cleared.
  const targets = new Map(design.connections.map((item) => [item.id, item.to.element]));
  for (const other of studio.elements) {
    const settings = other.settings;
    if (settings.kind === "cdn" && settings.origin === element.id && !application)
      delete settings.origin;
    if (settings.kind === "browser" && settings.delivery === "bundled") {
      if (settings.servedBy === element.id && !application) delete settings.servedBy;
    }
    if (settings.kind === "redirect")
      for (const [field, lookup] of [
        ["lookupStoreConnection", "database"],
        ["lookupCacheConnection", "cache"],
      ] as const) {
        const id = settings[field];
        if (id && targets.get(id) === element.id && kind !== lookup) delete settings[field];
      }
  }
  if (!application)
    studio.packages = studio.packages.flatMap((item) => {
      const members = item.members.filter((id) => id !== element.id);
      return members.length < 2 ? [] : [{ ...item, members }];
    });
  adoptOrphans(out);
}

/**
 * The tile types the fan offers on this side and in this mode, each with the kind it adds: the
 * type's default (a Service after a queue is a worker), else its first kind the rules accept.
 */
export function laneChoices(
  design: DesignDocument,
  from: LaneFrom,
  side: LaneSide,
  mode: StudioLinkMode,
): LaneChoice[] {
  if (laneFindings(design).length) return [];
  const at = lanes(design);
  const host = "tile" in from ? at().kindOf(from.tile) : undefined;
  return studioTileTypes.flatMap((type) => {
    const preferred = defaultKind(type, side === "after" && host ? { after: host } : {});
    const kinds = [preferred, ...studioTileDefinitions[type].kinds.filter((k) => k !== preferred)];
    const kind = kinds.find((candidate) => {
      const tile = { id: "@new", kind: candidate };
      return !addTileRefusal(at(tile), from, side, mode === "async", tile, "@new-link");
    });
    return kind ? [{ type, kind }] : [];
  });
}

/**
 * The tabs a selected node shows: the side and mode pairs with at least one tile type to offer.
 * The actor (`LANE_ACTOR`) has one tab per lane; a tile has up to four.
 */
export function laneTabs(design: DesignDocument, nodeKey: string): LaneTab[] {
  const froms: LaneFrom[] =
    nodeKey === LANE_ACTOR ? studioLanes.map((lane) => ({ lane })) : [{ tile: nodeKey }];
  return froms.flatMap((from) => {
    const sides: LaneSide[] = "lane" in from ? ["after"] : ["after", "before"];
    const modes: StudioLinkMode[] = "lane" in from ? ["sync"] : ["sync", "async"];
    return sides.flatMap((side) =>
      modes.flatMap((mode) =>
        laneChoices(design, from, side, mode).length ? [{ from, side, mode }] : [],
      ),
    );
  });
}

/**
 * What removing a tile takes with it: the tiles it strands (lane order), which a `removeTile`
 * must list in `alsoRemove`. Refused when the removal itself breaks a rule.
 */
export function planRemoveTile(
  design: DesignDocument,
  id: string,
): LaneResult<{ strands: string[] }> {
  return attempt(() => {
    requireLanes(design);
    return { strands: removal(lanes(design)(), design, id).strands };
  });
}

/**
 * Why linking `from` (a lane or a tile) to the existing tile `to` is refused, in plain words, or
 * `undefined` when a `linkTiles` would be accepted. The canvas lights up drop targets with it and
 * explains a refused drop.
 */
export function laneLinkRefusal(
  design: DesignDocument,
  from: LaneFrom,
  to: string,
  mode: StudioLinkMode,
): string | undefined {
  const result = attempt(() => {
    requireLanes(design);
    return linkTilesRefusal(lanes(design)(), from, to, mode === "async");
  });
  return result.ok ? result.value : result.message;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * A name and ID for a new tile of this type: the type's name ("Cache"), then "Cache 2", "Cache 3"…,
 * whichever is free as both a name and an ID ("cache", "cache-2"…).
 */
export function newTileIdentity(
  design: DesignDocument,
  type: StudioTileType,
): { id: string; name: string } {
  const names = new Set(design.elements.map((element) => element.name.toLowerCase()));
  const used = usedIds(design);
  const base = studioTileDefinitions[type].name;
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? base : `${base} ${n}`;
    const id = slug(name);
    if (!names.has(name.toLowerCase()) && !used.has(id)) return { id, name };
  }
}

/**
 * A free ID for a new link from `from` to `to`: `source-target`, or `lane-target` for an entry
 * (as the TinyURL study names them). `reserved` are IDs about to be used in the same batch.
 */
export function newLinkId(
  design: DesignDocument,
  from: LaneFrom,
  to: string,
  reserved: readonly string[] = [],
): string {
  const used = usedIds(design);
  return freshId(
    `${"lane" in from ? from.lane : from.tile}-${to}`,
    (id) => used.has(id) || reserved.includes(id),
  );
}

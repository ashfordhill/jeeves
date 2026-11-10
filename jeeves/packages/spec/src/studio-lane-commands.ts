/**
 * Lane commands: add, rename and remove a lane's action, add a tile, link two tiles, remove a
 * tile or a link, switch a tile's kind, and move an entry to the other lane's action.
 * The canvas, chat and API share them through `buildStudioCommand`. Each one is checked with the
 * board edits (`@jeeves/board/graph`) under the lane rules, and a refusal names the rule in plain
 * words with tile and action names. A link without a mode takes its pair's default from the link
 * table. The pure helpers tell the canvas and chat which actions the user can add
 * (`laneActionOptions`), which kinds of new tile a tile or action can add and link
 * (`linkFanOptions`), where a link from a tile or action may end (`connectOptions`), and what
 * removing a tile strands.
 */
import {
  addAfter,
  applyRemoval,
  type BoardEdge,
  checkGraph,
  type GraphViolation,
  link,
  planRemoval,
  type RemovalPlan,
  type Result,
  removeEdge,
  unreachableFrom,
  wouldCreateCycle,
} from "@jeeves/board/graph";
import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { type DesignDocument, elementSchema } from "./design.ts";
import { idSchema } from "./ids.ts";
import type { OperationInput } from "./operations.ts";
import { studioComponentDefinitions } from "./studio-components.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { freshId, slug, usedIds } from "./studio-ids.ts";
import {
  LANE_ACTOR,
  laneActionNode,
  laneActionOf,
  laneFindings,
  laneGraph,
  laneRules,
} from "./studio-lanes.ts";
import {
  laneLimits,
  type StudioLinkMode,
  studioDefaultLinkMode,
  studioKindNoun,
  studioLinkDefaults,
} from "./studio-links.ts";
import {
  createStudioSettings,
  type StudioKind,
  type StudioLane,
  type StudioModel,
  studioActionDefaults,
  studioActions,
  studioDefinitionRef,
  studioKindSchema,
  studioLaneActionNameSchema,
  studioLaneSchema,
  studioLanes,
  studioLimits,
  studioResourceKinds,
} from "./studio-model.ts";
import { studioComponentTargetKind } from "./studio-modules.ts";
import type { StudioConnectionCreation } from "./studio-operations.ts";
import { pruneStudioAfterDelete } from "./studio-prune.ts";
import {
  type StudioLinkFanGroup,
  studioLinkFan,
  studioLinkFanGroups,
  studioTileDefinitions,
  tileTypeOf,
} from "./studio-tiles.ts";

const tileName = z.string().trim().min(1).max(studioLimits.name);
const tileDescription = z.string().trim().max(studioLimits.description);
const newSystem = z.strictObject({ name: tileName, description: tileDescription.optional() });
/** Where a lane command starts: a lane's action (an entry), or a tile. */
export const laneFromSchema = z.union([
  z.strictObject({ lane: studioLaneSchema }),
  z.strictObject({ tile: idSchema }),
]);
export type LaneFrom = z.infer<typeof laneFromSchema>;
const laneLinkSchema = z.enum(["sync", "async"]);

/** The lane commands, part of `studioCommandSchema`. */
export const laneCommandSchemas = [
  /**
   * The lane's action, which the user links to: at most one per lane, named by `name` (default
   * Consume for download, Produce for upload). `system` creates the system in a new project.
   */
  z.strictObject({
    type: z.literal("addAction"),
    lane: studioLaneSchema,
    name: studioLaneActionNameSchema.optional(),
    system: newSystem.optional(),
  }),
  /** Renames the lane's action (the word on its tile). */
  z.strictObject({
    type: z.literal("renameAction"),
    lane: studioLaneSchema,
    name: studioLaneActionNameSchema,
  }),
  /** Removes the lane's action and its entries, unless that strands a tile. */
  z.strictObject({ type: z.literal("removeAction"), lane: studioLaneSchema }),
  /**
   * A new tile of `tile.kind`, linked after a tile or a lane (an entry of its action, which is
   * added with its default name if the lane has none). `side` is always `after`: nothing is
   * inserted before a tile. An entry is always `sync`. Without `link`, the new link takes its
   * pair's default mode (async for queue links, sync otherwise). `system` creates the system with
   * the first tile of a new project.
   */
  z.strictObject({
    type: z.literal("addTile"),
    from: laneFromSchema,
    side: z.literal("after"),
    link: laneLinkSchema.optional(),
    tile: z.strictObject({
      id: idSchema,
      name: tileName,
      kind: studioKindSchema,
      description: tileDescription.optional(),
    }),
    linkId: idSchema,
    system: newSystem.optional(),
  }),
  /**
   * Links a lane's action or a tile to a tile already on the board (a merge, or a new entry).
   * Without `link`, the link takes its pair's default mode.
   */
  z.strictObject({
    type: z.literal("linkTiles"),
    from: laneFromSchema,
    to: idSchema,
    link: laneLinkSchema.optional(),
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
  /** Moves an entry to the other lane's action (download or upload), within its cap. */
  z.strictObject({ type: z.literal("setEntryLane"), entry: idSchema, lane: studioLaneSchema }),
] as const;
export type LaneCommand = z.infer<(typeof laneCommandSchemas)[number]>;

/**
 * A kind the link fan offers: its group (the fan's row) and, when the lane rules refuse it here,
 * why, in plain words.
 */
export type LinkFanOption = { kind: StudioKind; group: StudioLinkFanGroup; refusal?: string };
/**
 * Where a link dragged from a tile or action may end: the `linkTiles` it would run (`from`, `to`
 * and the pair's default mode), or why it can't.
 */
export type ConnectOption = { tile: string } & (
  | { link: { from: LaneFrom; to: string; mode: StudioLinkMode } }
  | { refusal: string }
);
export type LaneResult<T> = { ok: true; value: T } | { ok: false; message: string };
/** An action the user's `+` offers: its lane and default name, or why it can't be added. */
export type LaneActionOption = { lane: StudioLane; name: string; refusal?: string };

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
  const studio = design.architecture?.studio;
  const entries = studio?.entries ?? [];
  const actions = studioActions(studio);
  const actionNames = new Map(actions.map((item) => [laneActionNode(item.lane), item.name]));
  return (tile?: Tile) => {
    const kindOf = (id: string) => (id === tile?.id ? tile.kind : kinds.get(id));
    const name = (id: string) =>
      id === LANE_ACTOR
        ? "the user"
        : id === tile?.id && tile.name
          ? tile.name
          : (actionNames.get(id) ?? names.get(id) ?? id);
    return {
      graph,
      entries,
      actions,
      kindOf,
      name,
      /** On the board: the actor, an action or a tile. */
      has: (id: string) => kinds.has(id),
      /** A tile (it has a kind), not the actor or an action. */
      isTile: (id: string) => kinds.get(id) !== undefined,
      hasAction: (lane: StudioLane) => actions.some((item) => item.lane === lane),
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

/** Why the lane has no action to start from, or `undefined`. */
function noAction(view: Lanes, lane: StudioLane): string | undefined {
  return view.hasAction(lane)
    ? undefined
    : `The ${lane} lane has no action yet; add its ${studioActionDefaults[lane]} action first.`;
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

/**
 * Why a new `source → target` link is refused, or `undefined`. From a lane's action the link is
 * an entry: a tile has one, and an action holds at most `entriesPerLane`.
 */
function linkRefusal(
  view: Lanes,
  source: string,
  target: string,
  async: boolean,
): string | undefined {
  const { name } = view;
  if (source === target) return `${sentence(name(source))} can't link to itself.`;
  const lane = laneActionOf(source);
  if (lane) {
    // A tile has one entry, so an entry in the other lane counts as a duplicate too.
    const entry = view.entries.find((item) => item.element === target);
    if (entry)
      return `${sentence(name(target))} already starts the ${entry.lane} lane; a tile has one entry.`;
  } else if (view.graph.edges.some((edge) => edge.source === source && edge.target === target))
    return `${sentence(name(source))} already links to ${name(target)}.`;
  // The link table first: its reason holds whatever else is on the board.
  const reason = view.rules.refusal(source, target, async);
  if (reason) return `${sentence(name(source))} can't link to ${name(target)}. ${reason}`;
  if (wouldCreateCycle(view.graph.edges, source, target))
    return `${sentence(name(target))} already leads to ${name(source)}; linking them would make a loop.`;
  if (lane) return actionFull(view, lane);
  const count = view.graph.edges.filter((edge) => edge.source === source).length;
  if (count >= laneLimits.outgoingLinks)
    return `${sentence(name(source))} already has ${count} links; the most is ${laneLimits.outgoingLinks}.`;
  return undefined;
}

/**
 * Why one more entry for the lane's action breaks its cap, or `undefined`. `except` is an entry
 * to leave out.
 */
function actionFull(view: Lanes, lane: StudioLane, except?: string) {
  const count = view.entries.filter((item) => item.id !== except && item.lane === lane).length;
  return count >= laneLimits.entriesPerLane
    ? `${sentence(view.name(laneActionNode(lane)))} already has ${count} entries; the most is ${laneLimits.entriesPerLane}.`
    : undefined;
}

/** Why a `linkTiles` from `from` to the existing tile `to` is refused, or `undefined`. */
function linkTilesRefusal(
  view: Lanes,
  from: LaneFrom,
  to: string,
  async: boolean,
): string | undefined {
  if ("lane" in from) {
    const missing = noAction(view, from.lane);
    if (missing) return missing;
  } else if (from.tile === LANE_ACTOR)
    return "The user links only to its actions; add one with the user's +.";
  else if (laneActionOf(from.tile))
    return linkTilesRefusal(view, { lane: laneActionOf(from.tile) as StudioLane }, to, async);
  const source = "lane" in from ? laneActionNode(from.lane) : from.tile;
  if (to === LANE_ACTOR) return "Links don't lead back to the user.";
  if (laneActionOf(to))
    return `Only the user links to ${view.name(to)}; link ${view.name(to)} to a tile to give it an entry.`;
  for (const id of [source, to]) if (!view.has(id)) return `There is no tile "${id}".`;
  return (
    linkRefusal(view, source, to, async) ??
    refusalOf(view, link(view.graph, source, to, { id: "@new-link", async }, view.rules))
  );
}

/** Why moving entry `id` to `lane` is refused, or `undefined`. */
function entryLaneRefusal(view: Lanes, id: string, lane: StudioLane): string | undefined {
  const entry = view.entries.find((item) => item.id === id);
  if (!entry) return `There is no lane entry "${id}".`;
  if (entry.lane === lane)
    return `${sentence(view.name(entry.element))} already starts the ${lane} lane.`;
  return noAction(view, lane) ?? actionFull(view, lane, entry.id);
}

/** Why the user can't have this action, or `undefined`. */
function addActionRefusal(view: Lanes, lane: StudioLane): string | undefined {
  return view.hasAction(lane)
    ? `This design already has a ${studioActionDefaults[lane]} action; each lane has one.`
    : undefined;
}

/** Why removing the lane's action (and its entries) is refused, or `undefined`. */
function removeActionRefusal(view: Lanes, lane: StudioLane): string | undefined {
  if (!view.hasAction(lane)) return `This design has no ${studioActionDefaults[lane]} action.`;
  const node = laneActionNode(lane);
  const rest = {
    nodes: view.graph.nodes.filter((item) => item.id !== node),
    edges: view.graph.edges.filter((edge) => edge.source !== node && edge.target !== node),
  };
  const strands = unreachableFrom(rest, LANE_ACTOR);
  return strands.length
    ? `Removing ${view.name(node)} would cut off ${list(strands.map(view.name))}.`
    : undefined;
}

/**
 * Why adding `tile` after `from` is refused, or `undefined`. `view` must already know the tile.
 */
function addTileRefusal(
  view: Lanes,
  from: LaneFrom,
  async: boolean,
  tile: Tile,
  linkId: string,
): string | undefined {
  if (!tileTypeOf(tile.kind)) return "Browser apps aren't tiles; the user is the client.";
  const node = { id: tile.id };
  const edge = { id: linkId, async };
  if ("lane" in from) {
    const action = laneActionNode(from.lane);
    return (
      noAction(view, from.lane) ??
      linkRefusal(view, action, tile.id, async) ??
      refusalOf(view, addAfter(view.graph, action, node, edge, view.rules))
    );
  }
  const host = from.tile;
  if (!view.has(host)) return `There is no tile "${host}".`;
  return (
    linkRefusal(view, host, tile.id, async) ??
    refusalOf(view, addAfter(view.graph, host, node, edge, view.rules))
  );
}

/**
 * Plans removing `tile` with the board's fan pairings. A restitched link gets a fresh ID
 * (`source-target`, or `lane-target` for an entry); restitched entries stay with the removed
 * tile's action, which still holds at most `entriesPerLane`.
 */
function removal(view: Lanes, design: DesignDocument, tile: string): RemovalPlan {
  if (!view.isTile(tile)) refuse(`There is no tile "${tile}".`);
  const used = usedIds(design);
  const plan = planRemoval(view.graph, tile, view.rules, (source, target, taken) =>
    freshId(`${laneActionOf(source) ?? source}-${target}`, (id) => taken.has(id) || used.has(id)),
  );
  if (!plan.ok)
    refuse(
      plan.code === "too-many-links" && plan.node
        ? laneActionOf(plan.node)
          ? `Removing ${view.name(tile)} would give ${view.name(plan.node)} more than ${laneLimits.entriesPerLane} entries.`
          : `Removing ${view.name(tile)} would give ${view.name(plan.node)} more than ${laneLimits.outgoingLinks} links.`
        : explain(view, plan),
    );
  return plan.value;
}

function requireFree(design: DesignDocument, ids: string[]) {
  const used = usedIds(design);
  ids.forEach((id, index) => {
    if (used.has(id) || ids.indexOf(id) !== index) refuse(`The ID "${id}" is already in use.`);
  });
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
/** The mode a new `source → target` link gets when none is given: its pair's default. */
function pairMode(view: Lanes, source: string, target: string): StudioLinkMode {
  const from =
    source === LANE_ACTOR ? "user" : laneActionOf(source) ? "action" : view.kindOf(source);
  const to = view.kindOf(target);
  return from && to ? studioDefaultLinkMode(from, to) : "sync";
}
/** The new link's ends for an `addTile`: `from` → tile. */
const addedLink = (from: LaneFrom, tile: string): [string, string] => [
  "lane" in from ? laneActionNode(from.lane) : from.tile,
  tile,
];
const addEntry = (out: Draft, entry: { id: string; lane: StudioLane; element: string }) => {
  out.studio.entries = [...(out.studio.entries ?? []), entry];
};
/** Stores the lane's action, with its default name, when the lane has none yet. */
function ensureAction(studio: StudioModel, lane: StudioLane, name = studioActionDefaults[lane]) {
  const actions = studioActions(studio);
  if (!actions.some((item) => item.lane === lane)) actions.push({ lane, name });
  studio.actions = studioLanes.flatMap((each) => actions.filter((item) => item.lane === each));
}
/** `design` with the lane's action, as an `addTile` from that lane would store it first. */
function withAction(design: DesignDocument, lane: StudioLane): DesignDocument {
  if (studioActions(design.architecture?.studio).some((item) => item.lane === lane)) return design;
  const draft = structuredClone(design);
  const architecture =
    draft.architecture ?? architectureSchema.parse({ system: { name: "System" } });
  const studio = architecture.studio ?? { version: 1, elements: [], packages: [], connections: [] };
  ensureAction(studio, lane);
  architecture.studio = studio;
  draft.architecture = architecture;
  return draft;
}

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

/**
 * Applies a lane command to the draft (its `architecture.studio` is `studio`) and returns the
 * operations. Refusals are thrown as errors with plain-words messages.
 */
export function buildLaneCommand(
  draft: DesignDocument,
  studio: StudioModel,
  input: LaneCommand,
): OperationInput[] {
  // A design that breaks a lane rule takes only the removal of a link the rules refuse (such as
  // an entry stored before actions into storage): that is how it gets fixed.
  const before = laneFindings(draft);
  const repair = input.type === "removeLink" && before.length > 0 && refusedLink(draft, input.link);
  if (!repair) requireLanes(draft);
  const out: Draft = { design: draft, studio, ops: [] };
  // An addTile from a lane adds that lane's action first, when it has none.
  if (input.type === "addTile" && "lane" in input.from) ensureAction(studio, input.from.lane);
  const at = lanes(draft);
  switch (input.type) {
    case "addAction": {
      const why = addActionRefusal(at(), input.lane);
      if (why) refuse(why);
      ensureAction(studio, input.lane, input.name);
      break;
    }
    case "renameAction": {
      const actions = studioActions(studio);
      const action = actions.find((item) => item.lane === input.lane);
      if (!action) return refuse(`This design has no ${studioActionDefaults[input.lane]} action.`);
      action.name = input.name;
      studio.actions = actions;
      break;
    }
    case "removeAction": {
      const why = removeActionRefusal(at(), input.lane);
      if (why) refuse(why);
      studio.actions = studioActions(studio).filter((item) => item.lane !== input.lane);
      studio.entries = studio.entries?.filter((item) => item.lane !== input.lane);
      break;
    }
    case "addTile": {
      const { from, tile } = input;
      requireFree(draft, [tile.id, input.linkId]);
      const view = at(tile);
      const mode = input.link ?? pairMode(view, ...addedLink(from, tile.id));
      const why = addTileRefusal(view, from, mode === "async", tile, input.linkId);
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
      connect(out, linkConnection(view, input.linkId, host, tile.id, mode));
      break;
    }
    case "linkTiles": {
      const { from, to } = input;
      requireFree(draft, [input.linkId]);
      const view = at();
      const mode = input.link ?? pairMode(view, "lane" in from ? LANE_ACTOR : from.tile, to);
      const why = linkTilesRefusal(view, from, to, mode === "async");
      if (why) refuse(why);
      if ("lane" in from) addEntry(out, { id: input.linkId, lane: from.lane, element: to });
      else connect(out, linkConnection(view, input.linkId, from.tile, to, mode));
      break;
    }
    case "setEntryLane": {
      const why = entryLaneRefusal(at(), input.entry, input.lane);
      if (why) refuse(why);
      const entry = studio.entries?.find((item) => item.id === input.entry);
      if (entry) entry.lane = input.lane;
      break;
    }
    case "removeLink": {
      const view = at();
      const edge = view.graph.edges.find((item) => item.id === input.link);
      // The user's line to an action has no design ID, so it never gets here; it goes with
      // the action (`removeAction`).
      if (!edge) return refuse(`There is no link "${input.link}".`);
      const rest = view.graph.edges.filter((item) => item.id !== edge.id);
      const strands = unreachableFrom({ nodes: view.graph.nodes, edges: rest }, LANE_ACTOR);
      // A repair skips the board edit, which needs a design that keeps every rule.
      const result = repair ? undefined : removeEdge(view.graph, edge.id, view.rules);
      if (strands.length || (result && !result.ok)) {
        if (result && !result.ok && result.code !== "strands") refuse(explain(view, result));
        const what = edge.lane
          ? `the ${edge.lane} entry to ${view.name(edge.target)}`
          : `the link from ${view.name(edge.source)} to ${view.name(edge.target)}`;
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
  // The board edits checked the change; this also covers what they don't see. A repair may leave
  // the design's other findings, but adds none.
  const [broken] = laneFindings(draft).filter(
    (item) => !before.some((old) => old.message === item.message),
  );
  if (broken) refuse(broken.message);
  return out.ops;
}

/** Whether `id` is a link or entry on the board that the link table refuses. */
function refusedLink(design: DesignDocument, id: string): boolean {
  const view = lanes(design)();
  const edge = view.graph.edges.find((item) => item.id === id);
  return !!edge && view.rules.refusal(edge.source, edge.target, edge.async) !== undefined;
}

/**
 * Removes the first tile and the tiles it strands, then adds the restitched links. Restitched
 * entries take the removed tile's entry's place and action.
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
          .filter((edge) => edge.source === laneActionNode(entry.lane))
          .map((edge) => ({ id: edge.id, lane: entry.lane, element: edge.target }))
      : [entry],
  );
  // Hosted modules, links, entries, package memberships and settings that named what went.
  pruneStudioAfterDelete(design, removed, connections);
  for (const edge of restitched)
    if (!laneActionOf(edge.source))
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
  const target = studioComponentTargetKind(kind);
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
 * Every kind of new tile the link fan offers after a tile or a lane's action, in its slots
 * (`studioLinkFan`, group by group): each with its group and, when `addTile` would refuse it
 * here, the plain-words reason. The new link takes its pair's default mode. A new tile is named by
 * its kind in the reasons: "URL cache can't link to a database. A cache can't link onward."
 */
export function linkFanOptions(design: DesignDocument, from: LaneFrom): LinkFanOption[] {
  const [broken] = laneFindings(design);
  // From a lane with no action, the addTile would add the action first.
  const at = lanes("lane" in from ? withAction(design, from.lane) : design);
  return studioLinkFanGroups.flatMap((group) =>
    studioLinkFan[group].map((kind) => {
      const tile = { id: "@new", kind, name: noun(kind) };
      const view = at(tile);
      const async = pairMode(view, ...addedLink(from, tile.id)) === "async";
      const refusal = broken
        ? `Fix the lanes first. ${broken.message}`
        : addTileRefusal(view, from, async, tile, "@new-link");
      return { kind, group, ...(refusal && { refusal }) };
    }),
  );
}

/**
 * The two actions the user's `+` offers, download (Consume) then upload (Produce), each with its
 * default name, or why the design can't have it ("This design already has a Produce action; each
 * lane has one.").
 */
export function laneActionOptions(design: DesignDocument): LaneActionOption[] {
  const [broken] = laneFindings(design);
  const view = lanes(design)();
  return studioLanes.map((lane) => {
    const refusal = broken
      ? `Fix the lanes first. ${broken.message}`
      : addActionRefusal(view, lane);
    return { lane, name: studioActionDefaults[lane], ...(refusal && { refusal }) };
  });
}

/**
 * Why removing the lane's action is refused, in plain words, or `undefined` when a
 * `removeAction` would be accepted. The canvas's X on an action asks it first.
 */
export function laneRemoveActionRefusal(
  design: DesignDocument,
  lane: StudioLane,
): string | undefined {
  const result = attempt(() => {
    requireLanes(design);
    return removeActionRefusal(lanes(design)(), lane);
  });
  return result.ok ? result.value : result.message;
}

/**
 * Where a link from `node` (a tile, a lane's action or the user) may end: every other node on the
 * board, in lane order, each with the `linkTiles` it would run from `node` to it in the pair's
 * default mode, or why not. The link always runs from `node`: a refused direction is never
 * reversed. From an action (`laneActionNode`) a link is an entry. Nothing links onto the user or
 * an action, and the user links only to its actions (added with its `+`).
 */
export function connectOptions(design: DesignDocument, node: string): ConnectOption[] {
  const view = lanes(design)();
  if (!view.has(node)) return [];
  const [broken] = laneFindings(design);
  const lane = laneActionOf(node);
  const from: LaneFrom = lane ? { lane } : { tile: node };
  return view.graph.nodes.flatMap((item) => {
    if (item.id === node) return [];
    const mode = pairMode(view, node, item.id);
    const refusal = broken
      ? `Fix the lanes first. ${broken.message}`
      : linkTilesRefusal(view, from, item.id, mode === "async");
    return [
      refusal === undefined
        ? { tile: item.id, link: { from, to: item.id, mode } }
        : { tile: item.id, refusal },
    ];
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
 * `undefined` when a `linkTiles` would be accepted (in `mode`, else the pair's default).
 */
export function laneLinkRefusal(
  design: DesignDocument,
  from: LaneFrom,
  to: string,
  mode?: StudioLinkMode,
): string | undefined {
  const result = attempt(() => {
    requireLanes(design);
    const view = lanes(design)();
    const chosen =
      mode ?? pairMode(view, "lane" in from ? laneActionNode(from.lane) : from.tile, to);
    return linkTilesRefusal(view, from, to, chosen === "async");
  });
  return result.ok ? result.value : result.message;
}

/**
 * Why moving the entry `entry` to `lane`'s action (download or upload) is refused, in plain words,
 * or `undefined` when a `setEntryLane` would be accepted. The entry inspector disables a lane with
 * it and shows the reason.
 */
export function laneEntryRefusal(
  design: DesignDocument,
  entry: string,
  lane: StudioLane,
): string | undefined {
  const result = attempt(() => {
    requireLanes(design);
    return entryLaneRefusal(lanes(design)(), entry, lane);
  });
  return result.ok ? result.value : result.message;
}

/**
 * A name and ID for a new tile of this kind: the kind's name ("Worker service"), then "Worker
 * service 2"…, whichever is free as both a name and an ID ("worker-service", "worker-service-2"…).
 */
export function newTileIdentity(
  design: DesignDocument,
  kind: StudioKind,
): { id: string; name: string } {
  const names = new Set(design.elements.map((element) => element.name.toLowerCase()));
  const used = usedIds(design);
  const base = studioDefinitions[kind].name;
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? base : `${base} ${n}`;
    const id = slug(name);
    if (!names.has(name.toLowerCase()) && !used.has(id)) return { id, name };
  }
}

/**
 * A free ID for a new link from `from` to `to`: `source-target`, or `lane-target` for an entry of
 * a lane's action (as the TinyURL study names them). `reserved` are IDs about to be used in the
 * same batch.
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

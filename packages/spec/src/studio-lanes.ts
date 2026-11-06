/**
 * The lane graph: the design as the board sees it. One actor (the user, never stored) links to at
 * most one action per lane (download, then upload); each action reaches the tiles that handle it
 * through its entries. Every tile hangs off the actor, with no islands and no cycles. The rules
 * come from `@jeeves/board/graph` (only that entry point: the board's root pulls in React) plus
 * the studio link table.
 */
import { type BoardEdge, checkGraph, type Rules, reachableFrom } from "@jeeves/board/graph";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { laneLimits, type StudioLinkEnd, studioLinkRefusal } from "./studio-links.ts";
import { type StudioKind, type StudioLane, studioActions, studioLanes } from "./studio-model.ts";

/** The actor's graph key. `idSchema` can never produce it, so it never meets a design ID. */
export const LANE_ACTOR = "@actor";
/** A lane action's graph key ("@download", "@upload"); like the actor's, never a design ID. */
export const laneActionNode = (lane: StudioLane) => `@${lane}`;
/** The lane whose action has this graph key, if it is one. */
export const laneActionOf = (id: string): StudioLane | undefined =>
  studioLanes.find((lane) => laneActionNode(lane) === id);
/** The graph key of the user's line to a lane's action. */
export const laneActionLine = (lane: StudioLane) => `@actor-${lane}`;

/** A tile, or a lane action (`action` names its lane); the actor and actions have no kind. */
export type LaneNode = { id: string; kind?: StudioKind; action?: StudioLane };
/**
 * A connection; the user's line to an action (its source is the actor); or an entry (`lane` set;
 * its source is that lane's action). `async` follows the connection's interaction. `dashed` is
 * async, or continues after an async link: its source can only be reached from the actor through
 * one.
 */
export type LaneEdge = BoardEdge & { async: boolean; dashed: boolean; lane?: StudioLane };
export type LaneGraph = { nodes: LaneNode[]; edges: LaneEdge[] };

/**
 * Nodes are the actor, the actions (download, then upload), then tiles breadth-first from the
 * download entries, then from the upload entries (children in connection order), then any
 * unreachable tiles in document order; within a band (`laneBands`) the canvas keeps this order
 * top to bottom where it can. Edges are the user's lines to its actions, the entries, then each
 * node's connections in node order. Links to elements that do not exist are left out (validation
 * reports them). A lane with entries but no stored action has its default one (`studioActions`).
 */
export function laneGraph(design: DesignDocument): LaneGraph {
  const studio = design.architecture?.studio;
  const kinds = new Map(studio?.elements.map((item) => [item.element, item.settings.kind]));
  const exists = new Set(design.elements.map((element) => element.id));
  const actions = studioActions(studio);
  const entries = studioLanes.flatMap((lane) =>
    (studio?.entries ?? []).filter((entry) => entry.lane === lane && exists.has(entry.element)),
  );
  const outgoing = new Map<string, LaneEdge[]>();
  for (const connection of design.connections) {
    const [source, target] = [connection.from.element, connection.to.element];
    if (!exists.has(source) || !exists.has(target)) continue;
    const edge = {
      id: connection.id,
      source,
      target,
      async: connection.planned.interaction === "Asynchronous",
      dashed: false,
    };
    const list = outgoing.get(source);
    if (list) list.push(edge);
    else outgoing.set(source, [edge]);
  }

  const order: string[] = [];
  const placed = new Set<string>();
  const queue: string[] = [];
  const visit = (id: string) => {
    if (placed.has(id)) return;
    placed.add(id);
    order.push(id);
    queue.push(id);
  };
  for (const lane of studioLanes) {
    for (const entry of entries) if (entry.lane === lane) visit(entry.element);
    for (let id = queue.shift(); id !== undefined; id = queue.shift())
      for (const edge of outgoing.get(id) ?? []) visit(edge.target);
  }
  for (const element of design.elements) if (!placed.has(element.id)) order.push(element.id);

  const nodes: LaneNode[] = [
    { id: LANE_ACTOR },
    ...actions.map((action) => ({ id: laneActionNode(action.lane), action: action.lane })),
    ...order.map((id) => {
      const kind = kinds.get(id);
      return kind ? { id, kind } : { id };
    }),
  ];
  const edges: LaneEdge[] = [
    ...actions.map((action) => ({
      id: laneActionLine(action.lane),
      source: LANE_ACTOR,
      target: laneActionNode(action.lane),
      async: false,
      dashed: false,
    })),
    ...entries.map((entry) => ({
      id: entry.id,
      source: laneActionNode(entry.lane),
      target: entry.element,
      async: false,
      dashed: false,
      lane: entry.lane,
    })),
    ...order.flatMap((id) => outgoing.get(id) ?? []),
  ];
  const synchronous = reachableFrom(
    LANE_ACTOR,
    edges.filter((edge) => !edge.async),
  );
  for (const edge of edges) edge.dashed = edge.async || !synchronous.has(edge.source);
  return { nodes, edges };
}

/**
 * The lane bands, top to bottom on the canvas: what only the Consume action reaches, what both
 * actions reach, and what only the Produce action reaches.
 */
export const laneBandOrder = ["download", "shared", "upload"] as const;
export type LaneBand = (typeof laneBandOrder)[number];

/**
 * Each node's band and each line's. An action is in its own lane's band; a tile is in `download`
 * or `upload` when only that lane's action reaches it (through any links), `shared` when both
 * do. A line belongs to its source's band. The actor, its lines and tiles no action reaches have
 * none. The canvas stacks the bands in `laneBandOrder`, and lines of different bands share no run
 * except where they enter a shared tile.
 */
export function laneBands(graph: LaneGraph): {
  nodes: Map<string, LaneBand>;
  edges: Map<string, LaneBand>;
} {
  const from = (lane: StudioLane) => {
    const action = laneActionNode(lane);
    return graph.nodes.some((node) => node.id === action)
      ? reachableFrom(action, graph.edges)
      : new Set<string>();
  };
  const [download, upload] = [from("download"), from("upload")];
  const nodes = new Map<string, LaneBand>();
  for (const node of graph.nodes) {
    const [d, u] = [download.has(node.id), upload.has(node.id)];
    if (d || u) nodes.set(node.id, d && u ? "shared" : d ? "download" : "upload");
  }
  const edges = new Map<string, LaneBand>();
  for (const edge of graph.edges) {
    const band = nodes.get(edge.source);
    if (band) edges.set(edge.id, band);
  }
  return { nodes, edges };
}

/** Board rules plus `refusal`: why a link is refused, in plain words, or `undefined`. */
export type LaneRules = Rules & {
  refusal(source: string, target: string, async: boolean): string | undefined;
};

/**
 * The board rules for a lane graph, for `checkGraph` and the `@jeeves/board/graph` edits: rooted
 * at the actor, the user's lines, entries and links from the link table, and the caps (an
 * action's links are its entries). `kindOf` names each tile's kind, including a tile an edit is
 * about to add.
 */
export function laneRules(kindOf: (id: string) => StudioKind | undefined): LaneRules {
  const end = (id: string): StudioLinkEnd | undefined =>
    id === LANE_ACTOR ? "user" : laneActionOf(id) ? "action" : kindOf(id);
  const refusal = (source: string, target: string, async: boolean) => {
    const to = end(target);
    if (!to) return "The target has no studio settings.";
    const from = end(source);
    if (!from) return "The source has no studio settings.";
    return studioLinkRefusal(from, to, async ? "async" : "sync");
  };
  return {
    root: LANE_ACTOR,
    canLink: (source, target, async) => refusal(source, target, async) === undefined,
    maxOut: (node) => (laneActionOf(node) ? laneLimits.entriesPerLane : laneLimits.outgoingLinks),
    refusal,
  };
}

/** A lane action's name, or `undefined` when the design has no action in that lane. */
export function laneActionName(design: DesignDocument, lane: StudioLane): string | undefined {
  return studioActions(design.architecture?.studio).find((action) => action.lane === lane)?.name;
}

/**
 * `LANE_INVALID` findings: a tile the actor cannot reach, a cycle, a link or entry the link table
 * refuses (an entry stored before actions into storage or an external API reads this way), a pair
 * linked twice, a tile with two entries, or a broken cap (`laneLimits`). Missing references,
 * duplicate IDs, self-links and elements without studio settings are reported by the existing
 * validation. A design without a studio model has no lanes and no findings. `validateStudio`
 * includes these, so a batch that breaks a lane rule is rejected.
 */
export function laneFindings(design: DesignDocument): Finding[] {
  const studio = design.architecture?.studio;
  if (!studio) return [];
  const graph = laneGraph(design);
  const kinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const rules = laneRules((id) => kinds.get(id));
  const names = new Map(design.elements.map((element) => [element.id, element.name]));
  const actions = new Map(
    studioActions(studio).map((action) => [laneActionNode(action.lane), action.name]),
  );
  const name = (id: string) =>
    id === LANE_ACTOR ? "The user" : (actions.get(id) ?? names.get(id) ?? id);
  const entryIndex = new Map(studio.entries?.map((entry, index) => [entry.id, index]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const about = (edgeId: string) => {
    const index = entryIndex.get(edgeId);
    return index === undefined
      ? { connection: edgeId }
      : { path: ["architecture", "studio", "entries", index] };
  };
  // An action read from its entries alone (not stored yet) is reported on the entries.
  const actionPath = (node: string) => {
    const index = (studio.actions ?? []).findIndex(
      (action) => laneActionNode(action.lane) === node,
    );
    return {
      path: ["architecture", "studio", ...(index < 0 ? ["entries"] : ["actions", index])],
    };
  };
  const out: Finding[] = [];
  const report = (message: string, target: Finding["target"]) =>
    out.push(finding("LANE_INVALID", message, target));

  // A tile has one entry, in one lane.
  const entered = new Map<string, StudioLane>();
  for (const entry of studio.entries ?? []) {
    const lane = entered.get(entry.element);
    if (lane)
      report(
        `${name(entry.element)} already starts the ${lane} lane; a tile has one entry.`,
        about(entry.id),
      );
    else entered.set(entry.element, entry.lane);
  }

  const violations = checkGraph(graph, rules);
  for (const violation of violations) {
    const edge = violation.edge ? edges.get(violation.edge) : undefined;
    const node = violation.node;
    switch (violation.code) {
      case "refused-link":
        if (edge) {
          const reason = rules.refusal(edge.source, edge.target, edge.async) ?? "";
          report(
            edge.lane
              ? `${name(edge.source)} can't link to ${name(edge.target)}; ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`
              : `${name(edge.source)} → ${name(edge.target)}: ${reason}`,
            about(edge.id),
          );
        }
        break;
      case "duplicate-link":
        // A second entry of the same tile is reported above.
        if (edge && !edge.lane)
          report(`${name(edge.source)} already links to ${name(edge.target)}.`, about(edge.id));
        break;
      case "too-many-links":
        if (node) {
          const count = graph.edges.filter((item) => item.source === node).length;
          report(
            laneActionOf(node)
              ? `${name(node)} has ${count} entries; the most is ${laneLimits.entriesPerLane}.`
              : `${name(node)} has ${count} links; the most is ${laneLimits.outgoingLinks}.`,
            laneActionOf(node) ? actionPath(node) : { element: node },
          );
        }
        break;
      case "cycle":
        if (node)
          report(`${name(node)} leads back to itself; links can't form a loop.`, {
            element: node,
          });
        break;
      case "unreachable":
        // An element without studio settings is not a tile; validateDesign reports it.
        if (node && kinds.get(node))
          report(`${name(node)} can't be reached from the user; every tile hangs off a lane.`, {
            element: node,
          });
        break;
      default:
        // duplicate-id, missing-ref and self-link are reported by validateDesign/validateStudio.
        break;
    }
  }
  return out;
}

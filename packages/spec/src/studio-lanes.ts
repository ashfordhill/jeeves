/**
 * The lane graph: the design as the board sees it. One actor (the user, never stored) starts the
 * download and upload lanes through its entries; every tile hangs off the actor, with no islands
 * and no cycles. The rules come from `@jeeves/board/graph` (only that entry point: the board's
 * root pulls in React) plus the studio link table.
 */
import { type BoardEdge, checkGraph, type Rules, reachableFrom } from "@jeeves/board/graph";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { laneLimits, studioEntryKinds, studioLinkDefaults } from "./studio-links.ts";
import { type StudioKind, type StudioLane, studioLanes } from "./studio-model.ts";

/** The actor's graph key. `idSchema` can never produce it, so it never meets a design ID. */
export const LANE_ACTOR = "@actor";

/** A tile; the actor alone has no kind. */
export type LaneNode = { id: string; kind?: StudioKind };
/**
 * A connection, or an entry (`lane` set; its source is the actor). `async` follows the
 * connection's interaction. `dashed` is async, or continues after an async link: its source can
 * only be reached from the actor through one.
 */
export type LaneEdge = BoardEdge & { async: boolean; dashed: boolean; lane?: StudioLane };
export type LaneGraph = { nodes: LaneNode[]; edges: LaneEdge[] };

/**
 * Nodes are the actor, then tiles breadth-first from the download entries, then from the upload
 * entries (children in connection order), then any unreachable tiles in document order, so
 * download lays out above upload. Edges are the entries, then each node's connections in node
 * order. Links to elements that do not exist are left out (validation reports them).
 */
export function laneGraph(design: DesignDocument): LaneGraph {
  const studio = design.architecture?.studio;
  const kinds = new Map(studio?.elements.map((item) => [item.element, item.settings.kind]));
  const exists = new Set(design.elements.map((element) => element.id));
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
    ...order.map((id) => {
      const kind = kinds.get(id);
      return kind ? { id, kind } : { id };
    }),
  ];
  const edges: LaneEdge[] = [
    ...entries.map((entry) => ({
      id: entry.id,
      source: LANE_ACTOR,
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

/** Board rules plus `refusal`: why a link is refused, in plain words, or `undefined`. */
export type LaneRules = Rules & {
  refusal(source: string, target: string, async: boolean): string | undefined;
};

/**
 * The board rules for a lane graph, for `checkGraph` and the `@jeeves/board/graph` edits: rooted
 * at the actor, entries and links from the link table, and the per-tile link cap. `kindOf` names
 * each tile's kind, including a tile an edit is about to add. The per-lane entry cap is not a
 * board rule; `laneFindings` checks it.
 */
export function laneRules(kindOf: (id: string) => StudioKind | undefined): LaneRules {
  const refusal = (source: string, target: string, async: boolean) => {
    const to = kindOf(target);
    if (!to) return "The target has no studio settings.";
    if (source === LANE_ACTOR) {
      if (async) return "A lane entry is a request; it can't be asynchronous.";
      return studioEntryKinds.some((kind) => kind === to)
        ? undefined
        : "A lane starts at a service (not a worker), an API, storage or an external API.";
    }
    const from = kindOf(source);
    if (!from) return "The source has no studio settings.";
    const link = studioLinkDefaults(from, to, async ? "async" : "sync");
    return link.ok ? undefined : link.message;
  };
  return {
    root: LANE_ACTOR,
    canLink: (source, target, async) => refusal(source, target, async) === undefined,
    maxOut: laneLimits.outgoingLinks,
    refusal,
  };
}

/**
 * `LANE_INVALID` findings: a tile the actor cannot reach, a cycle, a link or entry the link table
 * refuses, a pair linked twice (a tile has one entry), or a broken cap (`laneLimits`). Missing
 * references, duplicate IDs, self-links and elements without studio settings are reported by the
 * existing validation. A design without a studio model has no lanes and no findings.
 * `validateStudio` includes these, so a batch that breaks a lane rule is rejected.
 */
export function laneFindings(design: DesignDocument): Finding[] {
  const studio = design.architecture?.studio;
  if (!studio) return [];
  const graph = laneGraph(design);
  const kinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const rules = laneRules((id) => kinds.get(id));
  const names = new Map(design.elements.map((element) => [element.id, element.name]));
  const name = (id: string) => (id === LANE_ACTOR ? "The user" : (names.get(id) ?? id));
  const entryIndex = new Map(studio.entries?.map((entry, index) => [entry.id, index]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const about = (edgeId: string) => {
    const index = entryIndex.get(edgeId);
    return index === undefined
      ? { connection: edgeId }
      : { path: ["architecture", "studio", "entries", index] };
  };
  const out: Finding[] = [];
  const report = (message: string, target: Finding["target"]) =>
    out.push(finding("LANE_INVALID", message, target));

  for (const lane of studioLanes) {
    const count = studio.entries?.filter((entry) => entry.lane === lane).length ?? 0;
    if (count > laneLimits.entriesPerLane)
      report(`The ${lane} lane has ${count} entries; the most is ${laneLimits.entriesPerLane}.`, {
        path: ["architecture", "studio", "entries"],
      });
  }

  const violations = checkGraph(graph, rules);
  for (const violation of violations) {
    const edge = violation.edge ? edges.get(violation.edge) : undefined;
    const node = violation.node;
    switch (violation.code) {
      case "refused-link":
        if (edge) {
          const reason = rules.refusal(edge.source, edge.target, edge.async);
          report(
            edge.lane
              ? `${name(edge.target)} can't start the ${edge.lane} lane. ${reason}`
              : `${name(edge.source)} → ${name(edge.target)}: ${reason}`,
            about(edge.id),
          );
        }
        break;
      case "duplicate-link":
        if (edge)
          report(
            edge.source === LANE_ACTOR
              ? `${name(edge.target)} is already a lane entry.`
              : `${name(edge.source)} already links to ${name(edge.target)}.`,
            about(edge.id),
          );
        break;
      case "too-many-links":
        if (node) {
          const count = graph.edges.filter((item) => item.source === node).length;
          report(`${name(node)} has ${count} links; the most is ${laneLimits.outgoingLinks}.`, {
            element: node,
          });
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

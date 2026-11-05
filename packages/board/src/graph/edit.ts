// Ported from automation-illustrator src/workflow/commands.ts (0803c4a).
// Pure structural edits. Each one refuses an invalid input graph and returns either the edited
// graph, checked with `checkGraph`, or the rule it would break.
//
// Changes from automation-illustrator: there is no Before/After overlay, no labels, no Split and
// no insert-on-path or insert-on-bundle; the graph is rooted, so removals can strand tiles; a
// caller's `canLink` and `maxOut` apply. Removal always uses fan pairings (every predecessor ×
// every successor), also for M:N, and a pair that already exists or is already reachable is
// dropped instead of merged into the existing link.
import { checkGraph } from "./check.ts";
import { dropRedundantNew, retargetIncoming, unreachableFrom, wouldCreateCycle } from "./reach.ts";
import {
  type BoardEdge,
  type BoardGraph,
  type BoardNode,
  fail,
  type NewLink,
  ok,
  type Refusal,
  type Result,
  type Rules,
  refuse,
} from "./types.ts";

/** What removing one tile does: the links it takes, the restitched links and the strands. */
export type RemovalPlan = {
  nodeId: string;
  /** Every link into or out of the removed tile. */
  removeEdges: string[];
  /** Restitched links, one per predecessor × successor pair that is allowed and still needed. */
  addEdges: BoardEdge[];
  /** Tiles the root no longer reaches once the tile is gone; they must be removed with it. */
  strands: string[];
};

/** Names a restitched link. The default is `source->target`, made unique. */
export type EdgeIdMaker = (source: string, target: string, taken: ReadonlySet<string>) => string;

/** Adds `node` after `hostId`: host → new. A fork when the host already has outgoing links. */
export function addAfter(
  graph: BoardGraph,
  hostId: string,
  node: BoardNode,
  edge: NewLink,
  rules: Rules,
): Result<BoardGraph> {
  const valid = requireValid(graph, rules);
  if (!valid.ok) return valid;
  const refusal = missing(graph, hostId) ?? taken(graph, node.id, edge.id);
  if (refusal) return refusal;
  const grown = { nodes: [...graph.nodes, node], edges: graph.edges };
  const async = edge.async === true;
  const refused = linkRefusal(grown, hostId, node.id, async, rules);
  if (refused) return refused;
  return checked({ ...grown, edges: [...graph.edges, newEdge(edge, hostId, node.id)] }, rules);
}

/**
 * Inserts `node` before `hostId`: every link into the host now enters the new tile (keeping its
 * id and mode), then new → host. (`addConnectedNode` with `inbound`.)
 */
export function insertBefore(
  graph: BoardGraph,
  hostId: string,
  node: BoardNode,
  edge: NewLink,
  rules: Rules,
): Result<BoardGraph> {
  const valid = requireValid(graph, rules);
  if (!valid.ok) return valid;
  const refusal = missing(graph, hostId) ?? taken(graph, node.id, edge.id);
  if (refusal) return refusal;
  if (hostId === rules.root) return fail("root", `Nothing can go before the root "${hostId}".`);
  const edges = [...retargetIncoming(graph.edges, hostId, node.id), newEdge(edge, node.id, hostId)];
  return checked({ nodes: [...graph.nodes, node], edges }, rules);
}

/** Links two tiles already on the board, for example a merge. (`connectNodes`.) */
export function link(
  graph: BoardGraph,
  source: string,
  target: string,
  edge: NewLink,
  rules: Rules,
): Result<BoardGraph> {
  const valid = requireValid(graph, rules);
  if (!valid.ok) return valid;
  const refusal = missing(graph, source) ?? missing(graph, target) ?? taken(graph, edge.id);
  if (refusal) return refusal;
  const refused = linkRefusal(graph, source, target, edge.async === true, rules);
  if (refused) return refused;
  return checked({ ...graph, edges: [...graph.edges, newEdge(edge, source, target)] }, rules);
}

/**
 * Plans removing `nodeId`. Every predecessor is paired with every successor (fan pairings); a
 * pair `canLink` refuses is dropped, as is a pair whose predecessor already reaches the successor.
 * A restitched link is async when either link it replaces was (`collapseStroke`). Tiles the root
 * no longer reaches are the plan's `strands`. Refused when the result, without the strands, would
 * still break a rule (for example a predecessor ending up with too many links).
 */
export function planRemoval(
  graph: BoardGraph,
  nodeId: string,
  rules: Rules,
  edgeId: EdgeIdMaker = uniqueEdgeId,
): Result<RemovalPlan> {
  const valid = requireValid(graph, rules);
  if (!valid.ok) return valid;
  const refusal = missing(graph, nodeId);
  if (refusal) return refusal;
  if (nodeId === rules.root) return fail("root", `The root "${nodeId}" cannot be removed.`);

  const incoming = graph.edges.filter((e) => e.target === nodeId);
  const outgoing = graph.edges.filter((e) => e.source === nodeId);
  const kept = graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
  const ids = new Set<string>([...graph.nodes.map((n) => n.id), ...graph.edges.map((e) => e.id)]);
  const pairs: BoardEdge[] = [];
  for (const inn of incoming) {
    for (const out of outgoing) {
      const async = inn.async === true || out.async === true;
      if (rules.canLink && !rules.canLink(inn.source, out.target, async)) continue;
      const id = edgeId(inn.source, out.target, ids);
      ids.add(id);
      pairs.push({ id, source: inn.source, target: out.target, async });
    }
  }
  const edges = dropRedundantNew(kept, [...kept, ...pairs]);
  const nodes = graph.nodes.filter((n) => n.id !== nodeId);
  const strands = unreachableFrom({ nodes, edges }, rules.root);
  const result = checked(without({ nodes, edges }, strands), rules);
  if (!result.ok) return result;
  return ok({
    nodeId,
    removeEdges: [...incoming, ...outgoing].map((e) => e.id),
    addEdges: edges.slice(kept.length),
    strands,
  });
}

/**
 * Applies a plan from `planRemoval` on the same graph. `alsoRemove` must name exactly the plan's
 * strands: the caller confirms every tile that goes.
 */
export function applyRemoval(
  graph: BoardGraph,
  plan: RemovalPlan,
  alsoRemove: readonly string[],
  rules: Rules,
): Result<BoardGraph> {
  const valid = requireValid(graph, rules);
  if (!valid.ok) return valid;
  const refusal = missing(graph, plan.nodeId);
  if (refusal) return refusal;
  const unnamed = plan.strands.filter((id) => !alsoRemove.includes(id));
  if (unnamed.length) {
    return fail("strands", `Removing "${plan.nodeId}" also removes ${names(unnamed)}.`);
  }
  const extra = alsoRemove.filter((id) => !plan.strands.includes(id));
  if (extra.length) {
    return fail("strands", `Removing "${plan.nodeId}" does not strand ${names(extra)}.`);
  }
  const removed = new Set(plan.removeEdges);
  const edges = [...graph.edges.filter((e) => !removed.has(e.id)), ...plan.addEdges];
  const nodes = graph.nodes.filter((n) => n.id !== plan.nodeId);
  return checked(without({ nodes, edges }, alsoRemove), rules);
}

/** Removes one link, refused when a tile would be cut off from the root. (`removePath`.) */
export function removeEdge(graph: BoardGraph, edgeId: string, rules: Rules): Result<BoardGraph> {
  const valid = requireValid(graph, rules);
  if (!valid.ok) return valid;
  if (!graph.edges.some((e) => e.id === edgeId)) {
    return fail("missing-ref", `Link "${edgeId}" is not on the board.`);
  }
  const next = { nodes: graph.nodes, edges: graph.edges.filter((e) => e.id !== edgeId) };
  const strands = unreachableFrom(next, rules.root);
  if (strands.length) {
    return fail("strands", `Removing link "${edgeId}" would cut off ${names(strands)}.`);
  }
  return checked(next, rules);
}

/**
 * The tile to select after a removal: the first predecessor still on the board, else the first
 * remaining successor, else none.
 */
export function nextTileAfterRemoval(
  remaining: BoardGraph,
  predecessorIds: readonly string[],
  successorIds: readonly string[],
): string | null {
  const ids = new Set(remaining.nodes.map((n) => n.id));
  const alive = (id: string) => ids.has(id);
  return predecessorIds.find(alive) ?? successorIds.find(alive) ?? null;
}

/** `source->target`, with `~2`, `~3`… when that id is taken. */
export function uniqueEdgeId(source: string, target: string, taken: ReadonlySet<string>): string {
  const base = `${source}->${target}`;
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}~${n}`;
  return id;
}

/** The first violation of `graph` as a refusal, or the graph. (`succeed`.) */
function checked(graph: BoardGraph, rules: Rules): Result<BoardGraph> {
  const [violation] = checkGraph(graph, rules);
  return violation ? refuse(violation) : ok(graph);
}

/** Edits start from a valid graph. (`requireValid`.) */
function requireValid(graph: BoardGraph, rules: Rules): Result<BoardGraph> {
  return checked(graph, rules);
}

/** The checks a new link must pass, each with its own refusal, before the full check. */
function linkRefusal(
  graph: BoardGraph,
  source: string,
  target: string,
  async: boolean,
  rules: Rules,
): Refusal | undefined {
  if (source === target) return fail("self-link", `"${source}" cannot link to itself.`);
  if (graph.edges.some((e) => e.source === source && e.target === target)) {
    return fail("duplicate-link", `"${source}" already links to "${target}".`);
  }
  if (wouldCreateCycle(graph.edges, source, target)) {
    return fail("cycle", `Linking "${source}" to "${target}" would make a cycle.`);
  }
  if (rules.canLink && !rules.canLink(source, target, async)) {
    const how = async ? " asynchronously" : "";
    return fail("refused-link", `"${source}" cannot link to "${target}"${how}.`);
  }
  const links = graph.edges.filter((e) => e.source === source).length;
  if (rules.maxOut !== undefined && source !== rules.root && links >= rules.maxOut) {
    return fail(
      "too-many-links",
      `"${source}" already has ${links} links; the most is ${rules.maxOut}.`,
    );
  }
  return undefined;
}

function missing(graph: BoardGraph, nodeId: string): Refusal | undefined {
  if (graph.nodes.some((n) => n.id === nodeId)) return undefined;
  return fail("missing-ref", `"${nodeId}" is not on the board.`);
}

function taken(graph: BoardGraph, ...ids: string[]): Refusal | undefined {
  const used = new Set<string>([...graph.nodes.map((n) => n.id), ...graph.edges.map((e) => e.id)]);
  const clash = ids.find((id, i) => used.has(id) || ids.indexOf(id) !== i);
  return clash === undefined ? undefined : fail("duplicate-id", `Duplicate id "${clash}".`);
}

function newEdge(edge: NewLink, source: string, target: string): BoardEdge {
  return { id: edge.id, source, target, async: edge.async === true };
}

/** `graph` without `ids` and every link touching them. */
function without(graph: BoardGraph, ids: readonly string[]): BoardGraph {
  if (!ids.length) return graph;
  const gone = new Set(ids);
  return {
    nodes: graph.nodes.filter((n) => !gone.has(n.id)),
    edges: graph.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
  };
}

/** `"a"`, `"a" and "b"`, `"a", "b" and "c"`. */
function names(ids: readonly string[]): string {
  const quoted = ids.map((id) => `"${id}"`);
  const last = quoted.pop();
  return quoted.length ? `${quoted.join(", ")} and ${last}` : (last ?? "");
}

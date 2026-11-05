// Ported from automation-illustrator src/workflow/graph.ts (0803c4a).
// Reachability over links: what a tile reaches, cycles, tiles cut off from the root, and the
// redundant-restitch filter.
import type { BoardEdge, BoardGraph } from "./types.ts";

/** Tiles reachable by following links forward from `start` (includes `start`). */
export function reachableFrom(start: string, edges: readonly BoardEdge[]): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    const list = outgoing.get(e.source);
    if (list) list.push(e.target);
    else outgoing.set(e.source, [e.target]);
  }
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift() as string;
    for (const next of outgoing.get(id) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/** True when source → target would close a directed cycle (self-links included). */
export function wouldCreateCycle(
  edges: readonly BoardEdge[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true;
  return reachableFrom(target, edges).has(source);
}

/** Tiles the root cannot reach, in tile order. */
export function unreachableFrom(graph: BoardGraph, root: string): string[] {
  const reached = reachableFrom(root, graph.edges);
  return graph.nodes.map((n) => n.id).filter((id) => !reached.has(id));
}

/**
 * After a restitch, drop the newly created links whose source already reaches their target on
 * `reach` without them. Links in `prior` always stay. (`dropDirectedRedundantNewPaths`.)
 */
export function dropRedundantNew(
  prior: readonly BoardEdge[],
  next: BoardEdge[],
  reach: readonly BoardEdge[] = next,
): BoardEdge[] {
  const priorIds = new Set(prior.map((e) => e.id));
  const drop = new Set<string>();
  for (const e of next) {
    if (priorIds.has(e.id)) continue;
    const without = reach.filter((x) => x.id !== e.id);
    if (reachableFrom(e.source, without).has(e.target)) drop.add(e.id);
  }
  if (!drop.size) return next;
  return next.filter((e) => !drop.has(e.id));
}

/**
 * Point every link that enters `hostId` at `newTarget` instead. Returns `edges` itself when
 * nothing enters the host.
 */
export function retargetIncoming(
  edges: BoardEdge[],
  hostId: string,
  newTarget: string,
): BoardEdge[] {
  if (!edges.some((e) => e.target === hostId)) return edges;
  return edges.map((e) => (e.target === hostId ? { ...e, target: newTarget } : e));
}

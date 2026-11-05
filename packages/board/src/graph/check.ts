// Ported from automation-illustrator src/workflow/graph.ts (0803c4a).
// `validateGraphInvariants`, rooted: instead of "one weakly connected piece with a source", every
// tile must be reachable from the root. Callers add link rules and a fan-out cap.
import { reachableFrom } from "./reach.ts";
import type { BoardGraph, GraphViolation, Rules } from "./types.ts";

/** Every way `graph` breaks the board's invariants or `rules`; empty when it is valid. */
export function checkGraph(graph: BoardGraph, rules: Rules): GraphViolation[] {
  const out: GraphViolation[] = [];

  // Tiles and links share one id space.
  const seen = new Set<string>();
  const parts = [
    ...graph.nodes.map((n) => ({ id: n.id, node: n.id })),
    ...graph.edges.map((e) => ({ id: e.id, edge: e.id })),
  ];
  for (const { id, ...about } of parts) {
    if (seen.has(id)) {
      out.push({ code: "duplicate-id", message: `Duplicate id "${id}".`, ...about });
    }
    seen.add(id);
  }

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  if (!nodeIds.has(rules.root)) {
    out.push({ code: "missing-ref", message: `The root "${rules.root}" is not on the board.` });
  }
  const usable = graph.edges.filter((e) => {
    for (const end of [e.source, e.target]) {
      if (nodeIds.has(end)) continue;
      out.push({
        code: "missing-ref",
        message: `Link "${e.id}" ends at "${end}", which is not on the board.`,
        edge: e.id,
      });
      return false;
    }
    return true;
  });

  const pairs = new Set<string>();
  const outgoing = new Map<string, string[]>();
  for (const e of usable) {
    if (e.source === e.target) {
      out.push({ code: "self-link", message: `"${e.source}" cannot link to itself.`, edge: e.id });
      continue;
    }
    const key = `${e.source}\0${e.target}`;
    if (pairs.has(key)) {
      out.push({
        code: "duplicate-link",
        message: `"${e.source}" already links to "${e.target}".`,
        edge: e.id,
      });
      continue;
    }
    pairs.add(key);
    const list = outgoing.get(e.source);
    if (list) list.push(e.target);
    else outgoing.set(e.source, [e.target]);
    const async = e.async === true;
    if (rules.canLink && !rules.canLink(e.source, e.target, async)) {
      const how = async ? " asynchronously" : "";
      out.push({
        code: "refused-link",
        message: `"${e.source}" cannot link to "${e.target}"${how}.`,
        edge: e.id,
      });
    }
  }

  if (rules.maxOut !== undefined) {
    for (const [source, targets] of outgoing) {
      if (source === rules.root || targets.length <= rules.maxOut) continue;
      out.push({
        code: "too-many-links",
        message: `"${source}" has ${targets.length} links; the most is ${rules.maxOut}.`,
        node: source,
      });
    }
  }

  const cycle = findCycle(graph, outgoing);
  if (cycle) out.push({ code: "cycle", message: `Cycle: ${cycle.join(" → ")}.`, node: cycle[0] });

  if (nodeIds.has(rules.root)) {
    const reached = reachableFrom(rules.root, usable);
    for (const n of graph.nodes) {
      if (reached.has(n.id)) continue;
      out.push({
        code: "unreachable",
        message: `"${n.id}" cannot be reached from "${rules.root}".`,
        node: n.id,
      });
    }
  }

  return out;
}

/** The first directed cycle found by depth-first search, closed (`a → b → a`), or null. */
function findCycle(graph: BoardGraph, outgoing: Map<string, string[]>): string[] | null {
  const color = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    color.set(id, 1);
    stack.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const c = color.get(next);
      if (c === 1) return [...stack.slice(stack.indexOf(next)), next];
      if (c === undefined) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(id, 2);
    return null;
  };
  for (const n of graph.nodes) {
    if (color.has(n.id)) continue;
    const cycle = visit(n.id);
    if (cycle) return cycle;
  }
  return null;
}

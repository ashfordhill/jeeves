/** View-only grouping. Every relationship keeps its canonical ID and design endpoint identity. */
import { type DesignDocument, designOwnership, type LaneGraph } from "@jeeves/spec";

export const ownerNodeId = (owner: string) => `@owner:${owner}`;
export function projectOwnerGraph(
  design: DesignDocument,
  graph: LaneGraph,
  expanded: readonly string[],
) {
  const model = designOwnership(design);
  const candidates = model.owners.filter(
    (owner) =>
      !expanded.includes(owner.id) &&
      model.roles.some(
        (role) => role.owner === owner.id && graph.nodes.some((x) => x.id === role.element),
      ),
  );
  const mapping = new Map(
    candidates.flatMap((owner) =>
      model.roles
        .filter((role) => role.owner === owner.id)
        .map((role) => [role.element, ownerNodeId(owner.id)] as const),
    ),
  );
  const project = (): LaneGraph => {
    const seen = new Set<string>();
    return {
      nodes: graph.nodes.flatMap((node) => {
        const id = mapping.get(node.id) ?? node.id;
        if (seen.has(id)) return [];
        seen.add(id);
        return [{ ...node, id }];
      }),
      edges: graph.edges.map((edge) => ({
        ...edge,
        source: mapping.get(edge.source) ?? edge.source,
        target: mapping.get(edge.target) ?? edge.target,
      })),
    };
  };
  const fallback = new Set<string>();
  for (const edge of graph.edges)
    if (mapping.has(edge.source) && mapping.get(edge.source) === mapping.get(edge.target)) {
      const id = mapping.get(edge.source);
      for (const [role, owner] of mapping)
        if (owner === id) {
          mapping.delete(role);
          fallback.add(owner.slice("@owner:".length));
        }
    }
  let view = project();
  const visiting = new Set<string>(),
    done = new Set<string>();
  const cyclic = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    if (view.edges.some((edge) => edge.source === id && cyclic(edge.target))) return true;
    visiting.delete(id);
    done.add(id);
    return false;
  };
  if (view.nodes.some((node) => cyclic(node.id))) {
    for (const owner of candidates) fallback.add(owner.id);
    mapping.clear();
    view = graph;
  }
  return { graph: view, roleToView: mapping, fallbackOwners: [...fallback] };
}

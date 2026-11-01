import type { ArchitectureProjection } from "./architecture-view.ts";
import type { ArchitectureLayoutView } from "./layout.ts";

/** One hop from the explicitly selected responsibility/flow; never recursively grow the view. */
export function focusedArchitectureView(
  source: ArchitectureProjection,
  view: ArchitectureLayoutView,
) {
  const members = new Set(view.members ?? []);
  const visible = new Set(members);
  if (view.includeDependencies !== false)
    for (const edge of source.edges)
      if (members.has(edge.from) || members.has(edge.to)) {
        visible.add(edge.from);
        visible.add(edge.to);
      }
  const edges = source.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  const shown = new Set(edges.map((edge) => edge.id));
  return {
    projection: {
      ...source,
      name: view.name ?? source.name,
      nodes: source.nodes.filter((node) => visible.has(node.id)),
      edges,
    },
    hidden: source.edges.filter((edge) => !shown.has(edge.id)),
  };
}
